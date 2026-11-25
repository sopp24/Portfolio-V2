# SIDE A shopkeeper — backend & AI

> **Honest status.** The shopkeeper is a real AI **only once the Worker below is deployed with a provider key** and its URL is set in `index.html`. Until then the site runs in **catalogue mode**: a deterministic local FAQ answers from the same validated data, and the UI says so. Nothing in this repository pretends otherwise.

GitHub Pages hosts static files only. A provider key can never live in the browser, so the AI call goes through a small serverless proxy.

```
 Visitor's browser                Cloudflare Worker (worker/)                    AI provider
┌──────────────────────┐  POST /  ┌──────────────────────────────────────┐  HTTPS ┌─────────────────┐
│ GitHub Pages (static)│ ───────► │ 1 origin allow-list + CORS           │ ─────► │ Anthropic       │
│  src/ai/client.js    │          │ 2 JSON / size / schema validation    │        │  (default) or   │
│  src/ai/local-faq.js │ ◄─────── │ 3 rate limit (+ optional binding)    │ ◄───── │ OpenAI-compatible│
│  (no key, no secret) │ {reply,  │ 4 daily budget (+ optional KV)       │        └─────────────────┘
└──────────────────────┘ actions} │ 5 system prompt  ⟂  knowledge block  │
   mode 'ai' only if the          │ 6 parse/validate [[markers]]         │   secret: AI_API_KEY (wrangler secret)
   Worker really answered         └──────────────────────────────────────┘   vars:   wrangler.jsonc
```

Knowledge flow: `src/data/{projects,applications,profile}.js` → `src/data/knowledge.js` → (a) rendered into the model context by the Worker, (b) used by the local FAQ in the browser. Adding a project or filling a profile field updates both automatically. **Instructions** (`worker/prompt.js`) and **knowledge** are separate blocks; a visitor message can never edit either.

## 1. HTTP contract

| Route | Request | Success | Errors (`{ "error": code }`) |
|---|---|---|---|
| `POST /` | `Content-Type: application/json` — `{ "messages":[{"role":"user"\|"assistant","content":"…"}], "language":"fr"\|"en" }` (1–10 messages, ≤ 1200 chars each, last = user, body ≤ 12 KB) | `200 { "reply": string, "actions": [{"type":"project"\|"app"\|"cv"\|"contact"\|"about","id"?}], "provider":"anthropic"\|"openai", "mode":"ai" }` | `origin_not_allowed` 403 · `bad_request` 400/405/413/415 · `rate_limited` 429 (+`Retry-After`) · `budget_exceeded` 429 · `not_configured` 503 · `upstream_error` 502 |
| `GET /health` | — | `200 { "ok": true, "configured": boolean }` | `origin_not_allowed` 403 |
| `OPTIONS *` | CORS preflight | `204` | 403 |

Every response is `Cache-Control: no-store`. `actions` come from `[[project:<id>]]`, `[[app:<id>]]`, `[[cv]]`, `[[contact]]`, `[[about]]` markers the model may append (max 2). The Worker strips all markers from the text and keeps only those whose id exists in the knowledge base; the 3D scene uses the actions to point at a record.

`/health` reveals only whether a key (and, for OpenAI, a model) is configured — never the provider, model or key.

## 2. Deploy step by step (Cloudflare Workers, free tier is enough to start)

1. Create a Cloudflare account (no domain needed: you get `https://side-a-shopkeeper.<subdomain>.workers.dev`).
2. Create an API key at your AI provider and **set a monthly spend limit there first** (see §5).
3. From the repository root:
   ```bash
   npm install
   npx wrangler login
   ```
4. Review `wrangler.jsonc` → `vars`. Keep `ALLOWED_ORIGINS` to your real site only for production (e.g. `https://sopp24.github.io`; drop `http://localhost:8080` once you stop developing). Origins are matched exactly, without trailing slash and without path.
5. Store the key as a **secret** (never in `vars`, never in a file):
   ```bash
   npx wrangler secret put AI_API_KEY
   ```
6. Deploy and note the printed URL:
   ```bash
   npx wrangler deploy
   ```
7. Check it from a browser console on your site, or with curl (an `Origin` header is mandatory):
   ```bash
   curl -s -H "Origin: https://sopp24.github.io" https://side-a-shopkeeper.<subdomain>.workers.dev/health
   # {"ok":true,"configured":true}
   ```
8. In `index.html` set the public endpoint (a URL, not a secret), commit and publish:
   ```html
   <meta name="assistant-endpoint" content="https://side-a-shopkeeper.<subdomain>.workers.dev">
   ```
9. Reload the site: the client calls `/health`; the shopkeeper panel switches from “catalogue mode” to “AI connected” only if the Worker answers `configured: true`.

## 3. Configuration reference

| Name | Kind | Default | Purpose |
|---|---|---|---|
| `AI_API_KEY` | **secret** | — | Provider key. Only via `wrangler secret put` (prod) or `.dev.vars` (local). |
| `AI_PROVIDER` | var | `anthropic` | `anthropic` (Messages API) or `openai` (Chat Completions-compatible). |
| `AI_MODEL` | var | `claude-haiku-5-5` for `anthropic`; **none** for `openai` | Model id. For `openai` it is mandatory (no invented default); without it the Worker reports `not_configured`. Check the provider's current model list before changing it. |
| `AI_BASE_URL` | var | provider default | Override for OpenAI-compatible servers or a proxy. **https only** (http allowed for `localhost`), otherwise treated as not configured. |
| `ALLOWED_ORIGINS` | var | `https://sopp24.github.io` | Comma-separated exact origins. |
| `AI_EFFORT` | var | `low` in `wrangler.jsonc` (unset = not sent) | Sent as `output_config.effort` to the Anthropic provider. Current Claude models think by default and thinking tokens count towards `max_tokens`, so a low effort keeps short answers from being cut off. Leave it unset for models that reject `effort` (e.g. Haiku 4.5). |
| `MAX_OUTPUT_TOKENS` | var | `900` (clamped 50–2000) | Cost + verbosity cap. |
| `RATE_LIMIT_PER_MINUTE` | var | `8` | Per-IP token bucket. |
| `DAILY_REQUEST_BUDGET` | var | `1500` | Global soft cap per UTC day. |
| `DISABLE_LOGS` | var | unset | `1` silences the status-code logs. |
| `BUDGET_KV` | optional binding | — | KV namespace for a budget shared by all isolates. |
| `RATE_LIMITER` | optional binding | — | Cloudflare Rate Limiting binding. |

The frontend needs **no** environment variable or secret (see `.env.example`).

### Optional hardening (the Worker runs without these)

**Shared daily budget (KV).**
```bash
npx wrangler kv namespace create BUDGET_KV     # prints an id
```
Then add to `wrangler.jsonc`: `"kv_namespaces": [{ "binding": "BUDGET_KV", "id": "<id>" }]` and redeploy. Without it the cap is counted per isolate in memory (best effort: isolates are ephemeral and several may run at once). With KV the cap is shared but the read-then-write is not atomic, so treat it as a soft cap, not an accounting system.

**Cloudflare Rate Limiting binding.** Add (see Cloudflare's current docs for the exact syntax of your Wrangler version):
```jsonc
"unsafe": { "bindings": [{ "name": "RATE_LIMITER", "type": "ratelimit", "namespace_id": "1001", "simple": { "limit": 8, "period": 60 } }] }
```
The Worker calls it per client IP and still applies its in-memory bucket afterwards. Also consider a Cloudflare dashboard rate-limiting/WAF rule on the route — it protects before the Worker even runs.

## 4. Local development

```bash
cp .dev.vars.example .dev.vars    # git-ignored; put a real key only here
npx wrangler dev --port 8787
npm run dev                        # static site on http://localhost:8080 in another terminal
```
Set `<meta name="assistant-endpoint" content="http://127.0.0.1:8787">` locally (don't commit it) and put `ALLOWED_ORIGINS=http://localhost:8080` in your git-ignored `.dev.vars` (the deployed `wrangler.jsonc` only lists the Pages origin).

Tests (no key, no network — the provider is mocked):
```bash
node --test "tests/*.test.mjs"
```

## 5. Cost control

* Use a **small model** (the default is a small, fast one) — the task is retrieval-style Q&A over ~6k tokens of facts.
* Hard limits at the provider: **create a dedicated key/project with a monthly spend limit and usage alerts**. This is the only real guarantee; the Worker caps are additional guards.
* Worker guards: `MAX_OUTPUT_TOKENS`, ≤ 10 messages × 1200 chars, per-IP rate limit, `DAILY_REQUEST_BUDGET`.
* Order of magnitude (rendered knowledge ≈ 19,000 characters in French ≈ 5–6k tokens, plus ≈ 0.7k tokens of instructions): **~6–7k input tokens and ≤ 450 output tokens per request**; a six-question conversation therefore costs on the order of **40–50k input and 2–3k output tokens** before caching. The Anthropic adapter marks the knowledge block `cache_control: ephemeral`; whether the provider's minimum cacheable size is reached for your model must be checked, so budget as if there were no cache.
* At the default cap of 1500 requests/day the worst case is therefore on the order of **10M input tokens/day**. **Prices change and must be checked on the provider's pricing page**; multiply the token counts by the current price to choose your cap.
* The visitor's language only is rendered into the prompt (`lang: 'fr'|'en'`), which halves the context compared with sending both.

## 6. Privacy

* The Worker is stateless: **no conversation is stored**, no database, no cookies. Conversations live in the visitor's page memory only and disappear on reload.
* Logs contain method and status codes only (`[shopkeeper] POST 200`), never message content, never IPs.
* The IP is read only to rate-limit, held in memory only for the lifetime of the Worker isolate (as a rate-limit key), and sent to the optional rate-limit binding if configured.
* The provider receives: the instructions, the public knowledge block, and the last ≤ 10 messages typed by the visitor. For the official OpenAI endpoint `store:false` is set. Review your provider's retention policy. The UI footnote tells visitors not to type personal data.
* The browser client sends no cookies/credentials and no referrer.

## 7. Swapping provider

Providers are small adapters in `worker/providers.js` (`complete({ env, system, knowledge, messages, maxTokens, signal }) → text`).
* **Anthropic → OpenAI-compatible:** set `AI_PROVIDER=openai`, `AI_MODEL=<model>`, optionally `AI_BASE_URL`, and replace the secret (`wrangler secret put AI_API_KEY`).
* **New provider:** add an entry to `providers`; nothing else (prompt, validation, markers, limits, frontend) changes.

## 8. Threat model — what this does and does not give you

| Risk | Mitigation | Limit |
|---|---|---|
| Key theft | Key only in a Worker secret; never in repo/frontend; upstream errors never reach the browser. | Anyone with Cloudflare access to your account can read it — protect the account (2FA). |
| Prompt injection / “ignore your rules” / forged assistant turns | Instructions separate from knowledge; visitor text and prior assistant turns declared untrusted; knowledge read-only; markers validated against real ids; output capped. | LLMs can still be coaxed into odd replies. Facts come from a small, bounded block so damage is limited; the local FAQ remains a deterministic reference. |
| Hallucination | “Only the knowledge base”, explicit NOT PROVIDED list, status flags (`historical-unconfirmed`), exact “not in my collection” phrase. | Not a guarantee. Review real conversations/tests before sending the link to recruiters, and keep the knowledge data accurate. |
| Abuse / cost | Origin allow-list, per-IP bucket, optional binding, daily cap, token cap, provider spend limit. | **The `Origin` header is not authentication**: a non-browser client can forge it. The site is public, so any caller can use the endpoint within the limits above. Rate limits per IP can be bypassed by rotating IPs. That is why the provider-side spend cap is mandatory. |
| Data exposure | Knowledge contains only public portfolio data; no secrets in the repo (`.dev.vars`/`.env*` git-ignored). | `profile.js` is public — keep unconfirmed personal data (e.g. the candidate e-mail) out of what is displayed until confirmed. |

## 9. Verification log (what was and was not verified)

Verified here: `node --test` suite (knowledge builder, local FAQ on the 13 brief questions in FR/EN, Worker request handling with mocked providers incl. origin/size/schema/rate-limit/budget/marker parsing/error leakage, browser client retry/abort/health); `wrangler deploy --dry-run` bundles the Worker; the Worker ran in the real local Workers runtime (`wrangler dev`): `/health`, origin rejection, validation errors, and a clean generic `upstream_error` when the provider rejected a fake key.

**Not verified:** a real, successful provider completion (no valid key in this environment), the real quality of the model's answers under the prompt, the effect of prompt caching, and the Cloudflare Rate Limiting / KV bindings against a live account. Do a manual acceptance pass with the 13 recruiter questions in FR and EN after deploying.
