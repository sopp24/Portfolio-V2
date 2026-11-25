// Browser client for the shopkeeper.
//
//   const shop = createShopkeeperClient({ endpoint, getLanguage });
//   await shop.checkHealth();                       // 'ai' | 'offline'
//   const r = await shop.ask(history, { signal });  // { reply, actions, mode:'ai'|'catalogue', ... }
//
// `mode:'ai'` is returned ONLY when the backend really answered. Otherwise the local FAQ answers and the result
// says `mode:'catalogue'` (with `degraded:true` + `errorCode` when an AI call was attempted and failed),
// so the UI can state plainly that the AI is not connected. Raw provider/server text is never surfaced.

import { answerLocally, detectLanguage, STARTER_QUESTIONS } from "./local-faq.js";
import { getDefaultKnowledge } from "../data/knowledge.js";

export { STARTER_QUESTIONS };

const REQUEST_TIMEOUT_MS = 25_000;
const HEALTH_TIMEOUT_MS = 6_000;
const HEALTH_TTL_MS = 60_000;
const MAX_HISTORY = 8;
const MAX_CONTENT = 1200;
const RETRY_DELAY_MS = 600;

export class ShopkeeperError extends Error {
  /** @param {'aborted'|'timeout'|'network'|'rate_limited'|'budget_exceeded'|'not_configured'|'bad_request'|'upstream_error'|'origin_not_allowed'|'invalid_response'} code */
  constructor(code, status = 0) {
    super(code);
    this.name = "ShopkeeperError";
    this.code = code;
    this.status = status;
  }
}

const KNOWN_CODES = new Set(["rate_limited", "budget_exceeded", "not_configured", "bad_request", "upstream_error", "origin_not_allowed"]);

function trimHistory(messages) {
  const clean = (Array.isArray(messages) ? messages : [])
    .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, MAX_CONTENT) }));
  let tail = clean.slice(-MAX_HISTORY);
  while (tail.length && tail[0].role !== "user") tail = tail.slice(1);
  return tail;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new ShopkeeperError("aborted")); }, { once: true });
  });
}

export function createShopkeeperClient({ endpoint = "", getLanguage = () => "fr", knowledge = null, fetchImpl = null } = {}) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);
  let health = { value: null, at: 0 };

  const isConfigured = () => Boolean(base);

  async function request(url, init, { signal, timeoutMs }) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) { clearTimeout(timer); throw new ShopkeeperError("aborted"); }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      return await doFetch(url, { ...init, signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    } catch (error) {
      if (signal?.aborted) throw new ShopkeeperError("aborted");
      throw new ShopkeeperError(timedOut ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function checkHealth({ force = false } = {}) {
    if (!base) return "offline";
    if (!force && health.value && Date.now() - health.at < HEALTH_TTL_MS) return health.value;
    let value = "offline";
    try {
      const response = await request(base + "/health", { method: "GET" }, { timeoutMs: HEALTH_TIMEOUT_MS });
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok === true && data.configured === true) value = "ai";
      }
    } catch { /* offline */ }
    health = { value, at: Date.now() };
    return value;
  }

  async function callBackend(messages, language, signal) {
    const body = JSON.stringify({ messages, language });
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await request(base + "/", { method: "POST", headers: { "Content-Type": "application/json" }, body }, { signal, timeoutMs: REQUEST_TIMEOUT_MS });
        if (response.ok) {
          let data;
          try { data = await response.json(); } catch { throw new ShopkeeperError("invalid_response", response.status); }
          if (!data || typeof data.reply !== "string" || !data.reply.trim()) throw new ShopkeeperError("invalid_response", response.status);
          const actions = Array.isArray(data.actions)
            ? data.actions.filter(a => a && typeof a.type === "string").slice(0, 2).map(a => (a.id ? { type: a.type, id: String(a.id) } : { type: a.type }))
            : [];
          return { reply: data.reply.trim(), actions, mode: "ai" };
        }
        let code = "upstream_error";
        try { const data = await response.json(); if (KNOWN_CODES.has(data?.error)) code = data.error; } catch { /* keep generic */ }
        throw new ShopkeeperError(code, response.status);
      } catch (error) {
        lastError = error instanceof ShopkeeperError ? error : new ShopkeeperError("network");
        const retryable = attempt === 0 && (lastError.code === "network" || (lastError.status >= 500 && lastError.status < 600));
        if (!retryable) throw lastError;
        await sleep(RETRY_DELAY_MS, signal);
      }
    }
    throw lastError;
  }

  function local(text, language, extra = {}) {
    const result = answerLocally(text, { language, kb: knowledge || getDefaultKnowledge() });
    return { reply: result.reply, actions: result.actions, mode: "catalogue", intent: result.intent, ...extra };
  }

  /**
   * @param {{role:'user'|'assistant', content:string}[]} messages  full conversation, last item = visitor's question
   * @param {{signal?:AbortSignal}} [options]
   * @returns {Promise<{reply:string, actions:{type:string,id?:string}[], mode:'ai'|'catalogue', degraded?:boolean, errorCode?:string}>}
   * @throws {ShopkeeperError} only with code 'aborted' (visitor cancelled) or 'bad_request' (nothing to send)
   */
  async function ask(messages, { signal } = {}) {
    const history = trimHistory(messages);
    if (!history.length) throw new ShopkeeperError("bad_request");
    const question = history[history.length - 1].content;
    const language = detectLanguage(question, getLanguage() === "en" ? "en" : "fr");
    if (!base) return local(question, language);
    try {
      return await callBackend(history, language, signal);
    } catch (error) {
      if (error instanceof ShopkeeperError && error.code === "aborted") throw error;
      if (error?.code === "not_configured") health = { value: "offline", at: Date.now() };
      return local(question, language, { degraded: true, errorCode: error?.code || "upstream_error" });
    }
  }

  return { isConfigured, checkHealth, ask, starterQuestions: (lang) => STARTER_QUESTIONS[lang === "en" ? "en" : "fr"] };
}

/** Reads the endpoint from `<meta name="assistant-endpoint" content="...">` (empty → catalogue mode). */
export function readEndpointFromDocument(doc = globalThis.document) {
  return doc?.querySelector?.('meta[name="assistant-endpoint"]')?.getAttribute("content")?.trim() || "";
}
