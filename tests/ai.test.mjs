import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { PROJECTS, CATEGORIES } from "../src/data/projects.js";
import { APPLICATIONS } from "../src/data/applications.js";
import { PROFILE } from "../src/data/profile.js";
import { buildKnowledge, getDefaultKnowledge, renderKnowledgeForPrompt, KNOWN_ACTION_TARGETS, isKnownActionTarget, compact } from "../src/data/knowledge.js";
import { answerLocally, NOT_IN_COLLECTION_SHORT, STARTER_QUESTIONS } from "../src/ai/local-faq.js";
import { createShopkeeperClient, ShopkeeperError } from "../src/ai/client.js";
import worker, { parseReply, __resetForTests } from "../worker/index.js";
import { normalizeTurns } from "../worker/providers.js";
import { buildSystemPrompt } from "../worker/prompt.js";

const ORIGIN = "https://sopp24.github.io";
const SECRET = "sk-test-SECRET-123456";

// ------------------------------------------------------------------------------------------------ knowledge

function walk(value, path, visit) {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`, visit));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, visit);
}

test("knowledge: no null / undefined / empty value leaks", () => {
  const kb = getDefaultKnowledge();
  walk(kb, "kb", (value, path) => {
    assert.notEqual(value, null, path);
    assert.notEqual(value, undefined, path);
    assert.notEqual(value, "", path);
    if (Array.isArray(value)) assert.ok(value.length > 0, `${path} is an empty array`);
  });
  assert.equal(compact({ a: null, b: "", c: [], d: { e: null } }), undefined);
});

test("knowledge: ids match the data and action targets are valid", () => {
  const kb = getDefaultKnowledge();
  assert.deepEqual(kb.projects.map(p => p.id), PROJECTS.map(p => p.id));
  assert.equal(kb.projects.length, 10);
  assert.equal(kb.applications.length, APPLICATIONS.length);
  assert.ok(isKnownActionTarget("project", "swim-sync"));
  assert.ok(isKnownActionTarget("app", "actusup"));
  assert.ok(isKnownActionTarget("cv") && isKnownActionTarget("contact") && isKnownActionTarget("about"));
  assert.ok(!isKnownActionTarget("project", "ghost"));
  assert.ok(!isKnownActionTarget("cv", "x"));
  assert.equal(KNOWN_ACTION_TARGETS.length, 10 + APPLICATIONS.length + 3);
});

test("knowledge: unconfirmed facts flagged, missing facts listed, individual vs collective separated", () => {
  const kb = getDefaultKnowledge();
  for (const item of [...kb.education, ...kb.experience]) assert.equal(item.status, "historical-unconfirmed");
  assert.equal(kb.music.historical.status, "historical-unconfirmed");
  assert.ok(kb.music.projects.find(p => p.name === "Winehouse").status === "confirmed");
  const missing = kb.notProvided.map(item => item.id);
  for (const id of ["degree-title", "institution", "availability-date", "cv-file", "email", "link-linkedin"]) assert.ok(missing.includes(id), id);
  assert.ok(!missing.includes("link-github"));
  assert.equal(kb.projects.find(p => p.id === "expodata").workMode, "collaborative");
  assert.equal(kb.projects.find(p => p.id === "winehouse-promo").workMode, "personal");
  assert.equal(kb.identity.status.openToInternational, true);
  assert.equal(kb.identity.status.degreeTitle, undefined);
  assert.equal(kb.contact.email, undefined);
});

test("knowledge: confirmed data flips the lists (no hard-coded gaps)", () => {
  const profile = structuredClone(PROFILE);
  profile.status.degreeTitle = "Master X"; profile.status.institution = "Uni Y"; profile.cv.url = "assets/cv/cv.pdf";
  profile.contact.email = "someone@example.org";
  const kb = buildKnowledge({ projects: PROJECTS, categories: CATEGORIES, applications: APPLICATIONS, profile });
  const missing = kb.notProvided.map(i => i.id);
  assert.ok(!missing.includes("degree-title") && !missing.includes("institution") && !missing.includes("cv-file") && !missing.includes("email"));
  assert.equal(kb.cv.available, true);
});

test("knowledge: prompt rendering carries flags, pointers and no unconfirmed e-mail", () => {
  const kb = getDefaultKnowledge();
  for (const lang of ["fr", "en", "both"]) {
    const text = renderKnowledgeForPrompt(kb, { lang });
    assert.match(text, /NOT PROVIDED/);
    assert.match(text, /historical-unconfirmed/);
    assert.match(text, /\[project:expodata\]/);
    assert.match(text, /\[\[app:actusup\]\]/);
    assert.ok(!text.includes("adam.s@outlook.fr"));
    assert.ok(!/\bnull\b|\bundefined\b/.test(text), "null/undefined leaked in " + lang);
  }
  assert.ok(renderKnowledgeForPrompt(kb, { lang: "fr" }).length < renderKnowledgeForPrompt(kb, { lang: "both" }).length);
});

test("system prompt: instructions only, contains the rules and no knowledge", () => {
  const prompt = buildSystemPrompt("en");
  assert.match(prompt, /Never invent/);
  assert.match(prompt, /\[\[project:<id>\]\]/);
  assert.ok(!prompt.includes("SWIM SYNC"));
  assert.ok(!prompt.includes("expodata"));
});

// ------------------------------------------------------------------------------------------------ local FAQ

const BRIEF = [
  { fr: "Qui est Adam Soppelsa ?", en: "Who is Adam Soppelsa?", intent: "who" },
  { fr: "Quel est son parcours ?", en: "What is his background?", intent: "background" },
  { fr: "Quelles sont ses compétences ?", en: "What are his skills?", intent: "skills" },
  { fr: "Quelles expériences professionnelles a-t-il réalisées ?", en: "What professional experience has he had?", intent: "experience" },
  { fr: "Quels sont ses projets les plus intéressants ?", en: "What are his most interesting projects?", intent: "best" },
  { fr: "Quel était son rôle dans ExpoData ?", en: "What was his role in ExpoData?", intent: "project", target: "expodata" },
  { fr: "Peux-tu m'expliquer le projet Wero ?", en: "Can you explain the Wero project?", intent: "project", target: "wero" },
  { fr: "Que représente SWIM SYNC ?", en: "What does SWIM SYNC represent?", intent: "project", target: "swim-sync" },
  { fr: "Quelle est son expérience en développement web ?", en: "What is his web development experience?", intent: "webdev" },
  { fr: "Quel est son rapport à la musique ?", en: "What is his relationship with music?", intent: "music" },
  { fr: "Peut-on consulter son CV ?", en: "Can I see his CV?", intent: "cv" },
  { fr: "Comment le contacter ?", en: "How can I contact him?", intent: "contact" },
  { fr: "Est-il disponible pour un poste à l'international ?", en: "Is he available for an international position?", intent: "availability" }
];

test("local FAQ: the 13 brief questions in FR and EN", () => {
  for (const item of BRIEF) {
    for (const lang of ["fr", "en"]) {
      const result = answerLocally(item[lang], { language: lang });
      assert.equal(result.intent, item.intent, `${lang}: ${item[lang]}`);
      assert.equal(result.language, lang, item[lang]);
      assert.ok(result.reply.length > 40, item[lang]);
      assert.ok(!/@/.test(result.reply), "no e-mail may appear: " + item[lang]);
      assert.ok(!/\[\[|\]\]/.test(result.reply));
      if (item.target) assert.deepEqual(result.actions[0], { type: "project", id: item.target });
      for (const action of result.actions) assert.ok(isKnownActionTarget(action.type, action.id));
    }
  }
});

test("local FAQ: never invents degree / institution / e-mail / date and says so", () => {
  const cases = {
    fr: ["Quel est le titre exact de son Master 2 ?", "Dans quel établissement a-t-il fait son master ?", "Quelle est son adresse e-mail ?", "À quelle date exacte est-il disponible ?"],
    en: ["What is the exact title of his Master's degree?", "Which university does he attend?", "What is his e-mail address?", "What is his exact availability date?"]
  };
  for (const lang of ["fr", "en"]) {
    for (const question of cases[lang]) {
      const { reply } = answerLocally(question, { language: lang });
      assert.ok(reply.toLowerCase().includes(NOT_IN_COLLECTION_SHORT[lang].toLowerCase().replace(/\.$/, "")) || /collection/.test(reply), question + " → " + reply);
      assert.ok(!/outlook|@/.test(reply), question);
      assert.ok(!/universit[eé]\s+(de|d')|école (de|d')|business school|sorbonne|montaigne/i.test(reply), question + " → " + reply);
    }
  }
  const mail = answerLocally("Quelle est son adresse e-mail ?").reply;
  assert.match(mail, /pas encore cette information dans ma collection/);
  assert.match(answerLocally("Peut-on consulter son CV ?").reply, /pas encore téléchargeable/);
});

test("local FAQ: project aliases, no ranking, unknown topics, starters", () => {
  assert.equal(answerLocally("Parle-moi de Winehouse Amy").actions[0].id, "winehouse-amy");
  assert.deepEqual(answerLocally("Tell me about Winehouse").actions.map(a => a.id).sort(), ["winehouse-amy", "winehouse-promo"]);
  assert.equal(answerLocally("Et le Krakatoa ? c'est quoi ce projet ?").actions[0].id, "smac");
  assert.equal(answerLocally("Qu'est-ce que #JugarSiQuieres ?").actions[0].id, "jugar-si-quieres");
  assert.equal(answerLocally("Le logement étudiant bordelais, c'était quoi ?").actions[0].id, "student-housing");
  assert.equal(answerLocally("RAPMAP c'est quoi").actions[0].id, "rapmap");
  assert.equal(answerLocally("Et l'ancien portfolio ?").actions[0].id, "portfolio-v1");
  assert.equal(answerLocally("Parle-moi de Diffuser et aides à la création").actions[0].id, "smac");
  assert.equal(answerLocally("What is PEPPER?").actions[0].id, "pepper");
  const best = answerLocally("Quel est son meilleur projet ?").reply;
  assert.match(best, /ne les classe pas/);
  assert.match(answerLocally("What's the best project?").reply, /don't rank/);
  assert.match(answerLocally("Quelle est la capitale du Japon ?").reply, /pas encore cette information dans ma collection/);
  assert.equal(STARTER_QUESTIONS.fr.length, 3);
  assert.equal(STARTER_QUESTIONS.en.length, 3);
  const exp = answerLocally("Quelles expériences professionnelles a-t-il réalisées ?").reply;
  assert.match(exp, /à confirmer/);
  assert.match(answerLocally("What professional experience has he had?").reply, /still to be confirmed/);
});

// ------------------------------------------------------------------------------------------------ worker

const realFetch = globalThis.fetch;
let upstream;   // calls made to the (mocked) provider

function mockUpstream(handler) {
  upstream = [];
  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
    upstream.push(call);
    return handler(call);
  };
}
const anthropicOk = (text) => () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
const openaiOk = (text) => () => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

const baseEnv = (extra = {}) => ({ AI_API_KEY: SECRET, ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8080`, DISABLE_LOGS: "1", ...extra });
const chat = (body, { origin = ORIGIN, headers = {}, method = "POST", path = "/", raw } = {}) => new Request("https://worker.example" + path, {
  method,
  headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": "203.0.113.7", ...headers },
  body: method === "GET" ? undefined : raw ?? JSON.stringify(body)
});
const q = (text = "Que représente SWIM SYNC ?", extra = {}) => ({ messages: [{ role: "user", content: text }], language: "fr", ...extra });

beforeEach(() => { __resetForTests(); });
afterEach(() => { globalThis.fetch = realFetch; });

test("worker: origin allow-list, preflight and no CORS for strangers", async () => {
  const env = baseEnv();
  let response = await worker.fetch(chat(q(), { origin: "https://evil.example" }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
  response = await worker.fetch(chat(q(), { origin: null }), env);
  assert.equal(response.status, 403);
  response = await worker.fetch(chat(null, { method: "OPTIONS" }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/);
  response = await worker.fetch(chat(null, { method: "OPTIONS", origin: "https://evil.example" }), env);
  assert.equal(response.status, 403);
  response = await worker.fetch(chat(q(), { origin: "http://localhost:8080" }), baseEnv({ AI_API_KEY: "" }));
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://localhost:8080");
});

test("worker: method, content-type, body shape and size", async () => {
  const env = baseEnv();
  mockUpstream(anthropicOk("ok"));
  assert.equal((await worker.fetch(chat(null, { method: "GET" }), env)).status, 405);
  assert.equal((await worker.fetch(chat(q(), { headers: { "Content-Type": "text/plain" } }), env)).status, 415);
  assert.equal((await worker.fetch(chat(null, { raw: "{nope" }), env)).status, 400);
  assert.equal((await worker.fetch(chat({ messages: [] , language: "fr" }), env)).status, 400);
  assert.equal((await worker.fetch(chat({ messages: [{ role: "system", content: "x" }] }), env)).status, 400);
  assert.equal((await worker.fetch(chat({ messages: [{ role: "assistant", content: "x" }] }), env)).status, 400);
  assert.equal((await worker.fetch(chat(q("x".repeat(1201))), env)).status, 400);
  assert.equal((await worker.fetch(chat(q("hello", { language: "de" })), env)).status, 400);
  const eleven = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "hi" }));
  assert.equal((await worker.fetch(chat({ messages: eleven, language: "fr" }), env)).status, 400);
  const big = await worker.fetch(chat(null, { raw: JSON.stringify({ messages: [{ role: "user", content: "a" }], pad: "x".repeat(13_000) }) }), env);
  assert.equal(big.status, 413);
  assert.equal(upstream.length, 0, "invalid requests must never reach the provider");
});

test("worker: anthropic happy path, markers parsed, validated and stripped", async () => {
  const env = baseEnv();
  mockUpstream(anthropicOk("Va voir le vinyle SWIM SYNC, c'est un bel objet.\n[[project:swim-sync]] [[project:ghost]] [[cv]] [[app:actusup]]"));
  const response = await worker.fetch(chat({ messages: [{ role: "assistant", content: "Bienvenue" }, { role: "user", content: "Que représente SWIM SYNC ?" }], language: "fr" }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const data = await response.json();
  assert.equal(data.mode, "ai");
  assert.equal(data.provider, "anthropic");
  assert.deepEqual(data.actions, [{ type: "project", id: "swim-sync" }, { type: "cv" }]);
  assert.ok(!data.reply.includes("[["));
  assert.ok(!JSON.stringify(data).includes(SECRET));
  const call = upstream[0];
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.headers["x-api-key"], SECRET);
  assert.equal(call.headers["anthropic-version"], "2023-06-01");
  assert.equal(call.body.model, "claude-haiku-5-5");
  assert.equal(call.body.max_tokens, 900);
  assert.equal(call.body.output_config, undefined, "effort is only sent when AI_EFFORT is configured");
  assert.equal(call.body.messages[0].role, "user", "leading assistant turn must be dropped");
  assert.equal(call.body.system.length, 2);
  assert.ok(call.body.system[1].cache_control);
  assert.match(call.body.system[1].text, /\[project:swim-sync\]/);
  assert.ok(!call.body.system[0].text.includes("swim-sync"), "knowledge stays out of the instructions block");
});

test("worker: openai-compatible provider needs AI_MODEL and uses AI_BASE_URL", async () => {
  mockUpstream(openaiOk("Hello [[about]]"));
  let env = baseEnv({ AI_PROVIDER: "openai" });
  let response = await worker.fetch(chat(q()), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "not_configured" });
  assert.deepEqual(await (await worker.fetch(chat(null, { method: "GET", path: "/health" }), env)).json(), { ok: true, configured: false });
  env = baseEnv({ AI_PROVIDER: "openai", AI_MODEL: "my-model", AI_BASE_URL: "https://llm.example/v1" });
  response = await worker.fetch(chat(q("What is SWIM SYNC?", { language: "en" })), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.provider, "openai");
  assert.deepEqual(data.actions, [{ type: "about" }]);
  assert.equal(upstream[0].url, "https://llm.example/v1/chat/completions");
  assert.equal(upstream[0].headers.Authorization, "Bearer " + SECRET);
  assert.equal(upstream[0].body.model, "my-model");
  assert.equal(upstream[0].body.max_tokens, 900);
  assert.equal(upstream[0].body.messages[0].role, "system");
  assert.match(upstream[0].body.messages[0].content, /Never invent/);
  assert.match(upstream[0].body.messages[0].content, /English/);
  // Official endpoint: max_completion_tokens + store:false
  env = baseEnv({ AI_PROVIDER: "openai", AI_MODEL: "my-model" });
  await worker.fetch(chat(q()), env);
  assert.equal(upstream[1].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(upstream[1].body.max_completion_tokens, 900);
  assert.equal(upstream[1].body.store, false);
  // Non-https base URL is refused as "not configured" (never called)
  upstream.length = 0;
  response = await worker.fetch(chat(q()), baseEnv({ AI_PROVIDER: "openai", AI_MODEL: "m", AI_BASE_URL: "http://evil.example" }));
  assert.equal(response.status, 503);
  assert.equal(upstream.length, 0);
});

test("worker: not configured without a key, /health honest", async () => {
  const env = baseEnv({ AI_API_KEY: "" });
  mockUpstream(anthropicOk("x"));
  const response = await worker.fetch(chat(q()), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "not_configured" });
  assert.deepEqual(await (await worker.fetch(chat(null, { method: "GET", path: "/health" }), env)).json(), { ok: true, configured: false });
  assert.deepEqual(await (await worker.fetch(chat(null, { method: "GET", path: "/health" }), baseEnv())).json(), { ok: true, configured: true });
  assert.equal((await worker.fetch(chat(null, { method: "GET", path: "/health", origin: "https://evil.example" }), env)).status, 403);
  assert.equal(upstream.length, 0);
});

test("worker: rate limit (per IP) and daily budget (memory and KV)", async () => {
  mockUpstream(anthropicOk("ok"));
  const env = baseEnv({ RATE_LIMIT_PER_MINUTE: "2" });
  assert.equal((await worker.fetch(chat(q()), env)).status, 200);
  assert.equal((await worker.fetch(chat(q()), env)).status, 200);
  const limited = await worker.fetch(chat(q()), env);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "rate_limited" });
  assert.ok(limited.headers.get("Retry-After"));
  const other = await worker.fetch(chat(q(), { headers: { "CF-Connecting-IP": "198.51.100.9" } }), env);
  assert.equal(other.status, 200, "another IP has its own bucket");

  __resetForTests();
  const budgetEnv = baseEnv({ DAILY_REQUEST_BUDGET: "1" });
  assert.equal((await worker.fetch(chat(q()), budgetEnv)).status, 200);
  const over = await worker.fetch(chat(q(), { headers: { "CF-Connecting-IP": "198.51.100.10" } }), budgetEnv);
  assert.equal(over.status, 429);
  assert.deepEqual(await over.json(), { error: "budget_exceeded" });

  __resetForTests();
  const store = new Map();
  const kv = { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
  const kvEnv = baseEnv({ DAILY_REQUEST_BUDGET: "1", BUDGET_KV: kv });
  assert.equal((await worker.fetch(chat(q()), kvEnv)).status, 200);
  assert.equal(store.size, 1);
  assert.equal((await worker.fetch(chat(q(), { headers: { "CF-Connecting-IP": "198.51.100.11" } }), kvEnv)).status, 429);
});

test("worker: Cloudflare RATE_LIMITER binding is honoured when present", async () => {
  mockUpstream(anthropicOk("ok"));
  const env = baseEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await worker.fetch(chat(q()), env)).status, 429);
  assert.equal(upstream.length, 0);
});

test("worker: upstream failure is generic and leaks nothing", async () => {
  const env = baseEnv();
  mockUpstream(() => new Response(`{"error":"invalid x-api-key ${SECRET} billing details"}`, { status: 401 }));
  let response = await worker.fetch(chat(q()), env);
  let text = await response.text();
  assert.equal(response.status, 502);
  assert.equal(text, JSON.stringify({ error: "upstream_error" }));
  assert.ok(!text.includes(SECRET));
  mockUpstream(() => { throw new TypeError("connect ECONNREFUSED " + SECRET); });
  response = await worker.fetch(chat(q()), env);
  text = await response.text();
  assert.equal(response.status, 502);
  assert.ok(!text.includes("ECONNREFUSED") && !text.includes(SECRET));
  mockUpstream(anthropicOk("[[cv]]"));
  response = await worker.fetch(chat(q()), env);
  assert.equal(response.status, 502, "a reply with no text is an upstream error");
});

test("worker: parseReply edge cases and normalizeTurns", () => {
  assert.deepEqual(parseReply("A [[project:EXPODATA]] B [[PROJECT : wero]] [[about]] [[contact]]"), { reply: "A  B", actions: [{ type: "project", id: "expodata" }, { type: "project", id: "wero" }] });
  assert.deepEqual(parseReply("x [[project:ghost]] [[app:nope]] [[cv]] [[cv]]").actions, [{ type: "cv" }]);
  assert.equal(parseReply("[[weird thing]] text").reply, "text");
  assert.deepEqual(normalizeTurns([{ role: "assistant", content: "a" }, { role: "user", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }, { role: "user", content: "e" }]),
    [{ role: "user", content: "b\nc" }, { role: "assistant", content: "d" }, { role: "user", content: "e" }]);
});

test("worker: control characters are stripped and logs never contain message content", async () => {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    mockUpstream(() => new Response("{}", { status: 500 }));
    const env = baseEnv({ DISABLE_LOGS: "0" });
    await worker.fetch(chat(q("secret question \u0007 text")), env);
    assert.ok(logs.length > 0);
    assert.ok(!logs.join("\n").includes("secret question"));
  } finally { console.log = original; }
  mockUpstream(anthropicOk("ok"));
  await worker.fetch(chat(q("a\u0000b\u0007c")), baseEnv());
  assert.equal(upstream[0].body.messages[0].content, "abc");
});

// ------------------------------------------------------------------------------------------------ browser client

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("client: no endpoint → honest catalogue mode, never 'ai'", async () => {
  const client = createShopkeeperClient({ endpoint: "", getLanguage: () => "fr" });
  assert.equal(client.isConfigured(), false);
  assert.equal(await client.checkHealth(), "offline");
  const result = await client.ask([{ role: "user", content: "Que représente SWIM SYNC ?" }]);
  assert.equal(result.mode, "catalogue");
  assert.deepEqual(result.actions, [{ type: "project", id: "swim-sync" }]);
  await assert.rejects(() => client.ask([]), (e) => e instanceof ShopkeeperError && e.code === "bad_request");
});

test("client: AI answer, history trimming, language hint", async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return jsonResponse({ reply: "Bonjour", actions: [{ type: "project", id: "wero", junk: 1 }, { nope: true }] }); };
  const client = createShopkeeperClient({ endpoint: "https://w.example/", getLanguage: () => "fr", fetchImpl });
  const history = [];
  for (let i = 0; i < 14; i++) history.push({ role: i % 2 ? "assistant" : "user", content: "m" + i });
  history.push({ role: "user", content: "What is the Wero project?" });
  const result = await client.ask(history);
  assert.equal(sent.url, "https://w.example/");
  assert.ok(sent.body.messages.length <= 8);
  assert.equal(sent.body.messages[0].role, "user");
  assert.equal(sent.body.language, "en");
  assert.equal(result.mode, "ai");
  assert.deepEqual(result.actions, [{ type: "project", id: "wero" }]);
});

test("client: failures fall back to catalogue with a typed errorCode; one retry on 504/network only", async () => {
  let calls = 0;
  let client = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => { calls++; return jsonResponse({ error: "upstream_error" }, 502); } });
  let result = await client.ask([{ role: "user", content: "Comment le contacter ?" }]);
  assert.equal(calls, 1, "a provider error (502) is not retried: it would only burn the rate limit");
  assert.equal(result.mode, "catalogue");
  assert.equal(result.degraded, true);
  assert.equal(result.errorCode, "upstream_error");

  calls = 0;
  client = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => { calls++; return jsonResponse({ error: "rate_limited" }, 429); } });
  result = await client.ask([{ role: "user", content: "Comment le contacter ?" }]);
  assert.equal(calls, 1, "4xx is never retried");
  assert.equal(result.errorCode, "rate_limited");

  calls = 0;
  client = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => { calls++; throw new TypeError("offline"); } });
  result = await client.ask([{ role: "user", content: "Comment le contacter ?" }]);
  assert.equal(calls, 2);
  assert.equal(result.errorCode, "network");
  assert.equal(result.mode, "catalogue");

  client = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => jsonResponse({ error: "not_configured" }, 503) });
  result = await client.ask([{ role: "user", content: "Peut-on consulter son CV ?" }]);
  assert.equal(result.errorCode, "not_configured");
  assert.equal(await client.checkHealth(), "offline");
});

test("client: abort is a typed error; raw provider text never surfaces", async () => {
  const fetchImpl = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const client = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl });
  const controller = new AbortController();
  const pending = client.ask([{ role: "user", content: "Qui est Adam ?" }], { signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, (e) => e instanceof ShopkeeperError && e.code === "aborted");

  const leaky = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => new Response("SECRET provider stack trace", { status: 500 }) });
  const result = await leaky.ask([{ role: "user", content: "Qui est Adam ?" }]);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  assert.equal(result.mode, "catalogue");
});

test("client: checkHealth distinguishes ai / offline", async () => {
  const ok = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async (url) => { assert.equal(url, "https://w.example/health"); return jsonResponse({ ok: true, configured: true }); } });
  assert.equal(await ok.checkHealth(), "ai");
  const notConfigured = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => jsonResponse({ ok: true, configured: false }) });
  assert.equal(await notConfigured.checkHealth(), "offline");
  const down = createShopkeeperClient({ endpoint: "https://w.example", fetchImpl: async () => { throw new TypeError("x"); } });
  assert.equal(await down.checkHealth(), "offline");
});

// ------------------------------------------------------------------------------------------------ catalogue-mode intent collisions

test("local FAQ: a named project wins over generic intent words (when / school / social / international)", () => {
  const cases = [
    ["Quand a été fait le Portfolio V1 ?", /Portfolio V1/i],
    ["Quand a eu lieu ExpoData ?", /EXPODATA/i],
    ["Is Wero a university project?", /WERO/i],
    ["Le post Winehouse, quels réseaux sociaux ?", /WINEHOUSE/i],
    ["Rock School Barbey", /SMAC/i],
    ["Dis-moi tout sur RAPMAP", /RAPMAP/i]
  ];
  for (const [question, expected] of cases) {
    const { reply } = answerLocally(question, { language: /\b(is)\b/i.test(question) ? "en" : "fr" });
    assert.match(reply, expected, question);
    assert.doesNotMatch(reply, /ouvert à travailler à l'étranger|Master 2 et sera|e-mail d'Adam/i, question);
  }
});

test("local FAQ: generic questions still reach availability / degree / contact", () => {
  assert.match(answerLocally("Quelles sont tes disponibilités ?", { language: "fr" }).reply, /septembre/i);
  assert.match(answerLocally("Is Adam available in September?", { language: "en" }).reply, /September/);
  assert.match(answerLocally("Quel est le master d'Adam ?", { language: "fr" }).reply, /Master 2/);
  assert.doesNotMatch(answerLocally("Par où commencer ?", { language: "fr" }).reply, /étranger/);
});

test("worker: AI_EFFORT is forwarded as output_config.effort (adaptive thinking must not eat the answer budget)", async () => {
  const env = baseEnv({ AI_EFFORT: "low" });
  mockUpstream(anthropicOk("Une réponse courte."));
  const response = await worker.fetch(chat(q()), env);
  assert.equal(response.status, 200);
  assert.deepEqual(upstream[0].body.output_config, { effort: "low" });
  const bad = baseEnv({ AI_EFFORT: "turbo" });
  mockUpstream(anthropicOk("Ok."));
  await worker.fetch(chat(q()), bad);
  assert.equal(upstream[upstream.length - 1].body.output_config, undefined, "unknown values are never forwarded");
});
