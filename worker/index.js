// SIDE A shopkeeper backend — Cloudflare Worker (module syntax).
//
//   POST /        { messages:[{role,content}], language:'fr'|'en' } -> { reply, actions, provider, mode:'ai' }
//   GET  /health                                                   -> { ok:true, configured:boolean }
//
// The API key lives only in the Worker secret AI_API_KEY. The browser never sees it. See docs/BACKEND.md.

import { getDefaultKnowledge, renderKnowledgeForPrompt, KNOWN_ACTION_TARGETS, isKnownActionTarget } from "../src/data/knowledge.js";
import { buildSystemPrompt, wrapKnowledge } from "./prompt.js";
import { getProvider, isSafeBaseUrl } from "./providers.js";

const MAX_BODY_BYTES = 12_000;
const MAX_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1200;
const MAX_REPLY_CHARS = 2000;
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_ACTIONS = 2;

// ---- best-effort in-memory state (per isolate; ephemeral by design) ---------------------------------------
const buckets = new Map();
const memoryBudget = { day: "", count: 0 };
const knowledgeText = new Map();

export function __resetForTests() {
  buckets.clear();
  memoryBudget.day = ""; memoryBudget.count = 0;
  knowledgeText.clear();
}

function intVar(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://sopp24.github.io")
    .split(",").map(item => item.trim().replace(/\/+$/, "")).filter(Boolean);
}

function log(env, ...parts) {
  if (env.DISABLE_LOGS === "1") return;
  console.log("[shopkeeper]", ...parts); // status codes only: never message content
}

function respond(body, status, origin, extra = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

const fail = (code, status, origin, extra) => respond({ error: code }, status, origin, extra);

function tokenBucketLimited(key, perMinute) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) bucket = { tokens: perMinute, updated: now };
  bucket.tokens = Math.min(perMinute, bucket.tokens + ((now - bucket.updated) / 60_000) * perMinute);
  bucket.updated = now;
  const limited = bucket.tokens < 1;
  if (!limited) bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (now - v.updated > 120_000) buckets.delete(k);
  }
  return limited;
}

async function rateLimited(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    try {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return true;
    } catch { /* binding failure must not take the service down: fall through to the in-memory guard */ }
  }
  return tokenBucketLimited(ip, intVar(env.RATE_LIMIT_PER_MINUTE, 8, 1, 120));
}

async function budgetExceeded(env) {
  const budget = intVar(env.DAILY_REQUEST_BUDGET, 1500, 1, 1_000_000);
  const day = new Date().toISOString().slice(0, 10);
  if (env.BUDGET_KV && typeof env.BUDGET_KV.get === "function") {
    try {
      const key = "budget:" + day;
      const count = Number.parseInt(await env.BUDGET_KV.get(key), 10) || 0;
      if (count >= budget) return true;
      // Soft cap: read-then-write is not atomic across isolates. Good enough to bound spend, not a hard quota.
      await env.BUDGET_KV.put(key, String(count + 1), { expirationTtl: 172_800 });
      return false;
    } catch { /* fall back to the per-isolate counter */ }
  }
  if (memoryBudget.day !== day) { memoryBudget.day = day; memoryBudget.count = 0; }
  if (memoryBudget.count >= budget) return true;
  memoryBudget.count += 1;
  return false;
}

function isConfigured(env) {
  const provider = getProvider(env);
  if (!provider || !provider.isConfigured(env)) return false;
  if (env.AI_BASE_URL && !isSafeBaseUrl(env.AI_BASE_URL)) return false;
  return true;
}

const clean = (text) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

function validateBody(raw) {
  let body;
  try { body = JSON.parse(raw); } catch { return null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const language = body.language === undefined ? "fr" : body.language;
  if (language !== "fr" && language !== "en") return null;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) return null;
  const messages = [];
  for (const item of body.messages) {
    if (!item || typeof item !== "object" || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") return null;
    const content = clean(item.content);
    if (!content || content.length > MAX_MESSAGE_CHARS) return null;
    messages.push({ role: item.role, content });
  }
  if (messages[messages.length - 1].role !== "user") return null;
  return { messages, language };
}

/** Extracts [[...]] markers, validates them against the knowledge base and strips every marker from the text. */
export function parseReply(text, targets = KNOWN_ACTION_TARGETS) {
  const actions = [];
  const seen = new Set();
  const markers = /\[\[\s*(?:(project|app)\s*:\s*([A-Za-z0-9_-]{1,64})|(cv|contact|about))\s*\]\]/gi;
  for (const match of text.matchAll(markers)) {
    const type = (match[1] || match[3]).toLowerCase();
    const id = match[2] ? match[2].toLowerCase() : undefined;
    const key = type + ":" + (id || "");
    if (seen.has(key) || actions.length >= MAX_ACTIONS || !isKnownActionTarget(type, id, targets)) continue;
    seen.add(key);
    actions.push(id ? { type, id } : { type });
  }
  const reply = text.replace(/\[\[[^\]]*\]\]/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_REPLY_CHARS);
  return { reply, actions };
}

function knowledgeFor(language) {
  if (!knowledgeText.has(language)) knowledgeText.set(language, wrapKnowledge(renderKnowledgeForPrompt(getDefaultKnowledge(), { lang: language })));
  return knowledgeText.get(language);
}

async function handleChat(request, env, origin) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) return fail("bad_request", 415, origin);
  if (await rateLimited(request, env)) return fail("rate_limited", 429, origin, { "Retry-After": "30" });

  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) return fail("bad_request", 413, origin);
  let raw;
  try { raw = await request.text(); } catch { return fail("bad_request", 400, origin); }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail("bad_request", 413, origin);
  const input = validateBody(raw);
  if (!input) return fail("bad_request", 400, origin);

  if (!isConfigured(env)) return fail("not_configured", 503, origin);
  if (await budgetExceeded(env)) return fail("budget_exceeded", 429, origin, { "Retry-After": "3600" });

  const provider = getProvider(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const text = await provider.complete({
      env,
      system: buildSystemPrompt(input.language),
      knowledge: knowledgeFor(input.language),
      messages: input.messages,
      maxTokens: intVar(env.MAX_OUTPUT_TOKENS, 900, 50, 2000),
      signal: controller.signal
    });
    const { reply, actions } = parseReply(text);
    if (!reply) return fail("upstream_error", 502, origin);
    return respond({ reply, actions, provider: provider.id, mode: "ai" }, 200, origin);
  } catch (error) {
    log(env, "upstream failure", error?.name === "AbortError" ? "timeout" : (error?.status ?? "network"));
    return fail("upstream_error", 502, origin);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = origin && allowedOrigins(env).includes(origin) ? origin : null;
    const route = url.pathname.replace(/\/+$/, "") || "/";

    if (!allowed) return fail("origin_not_allowed", 403, null);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": allowed, "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400", "Cache-Control": "no-store"
      } });
    }

    let response;
    if (route === "/health" && request.method === "GET") response = respond({ ok: true, configured: isConfigured(env) }, 200, allowed);
    else if (route === "/" && request.method === "POST") response = await handleChat(request, env, allowed);
    else response = fail("bad_request", route === "/" || route === "/health" ? 405 : 404, allowed);
    if (route !== "/health") log(env, request.method, response.status);
    return response;
  }
};
