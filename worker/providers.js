// Provider adapters. Each exposes: complete({ env, system, knowledge, messages, maxTokens, signal }) -> Promise<string>
// Throws ProviderError on any failure; its message never contains upstream text (nothing is leaked to the browser).

export class ProviderError extends Error {
  constructor(status) { super("provider_error"); this.name = "ProviderError"; this.status = status; }
}

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
const ANTHROPIC_VERSION = "2023-06-01";

/** Anthropic requires the first turn to be a user turn; merge consecutive same-role turns. */
export function normalizeTurns(messages) {
  const turns = [];
  for (const message of messages) {
    if (!turns.length && message.role !== "user") continue;
    const last = turns[turns.length - 1];
    if (last && last.role === message.role) last.content += "\n" + message.content;
    else turns.push({ role: message.role, content: message.content });
  }
  return turns;
}

function endpointOf(base, fallback, path) {
  const root = (base || fallback).replace(/\/+$/, "");
  return root + path;
}

export function isSafeBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

async function postJson(url, headers, body, signal) {
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  } catch (error) {
    throw error?.name === "AbortError" ? error : new ProviderError(0);
  }
  if (!response.ok) throw new ProviderError(response.status);
  try { return await response.json(); }
  catch { throw new ProviderError(502); }
}

export const providers = {
  anthropic: {
    id: "anthropic",
    isConfigured: (env) => Boolean(env.AI_API_KEY),
    async complete({ env, system, knowledge, messages, maxTokens, signal }) {
      const payload = await postJson(
        endpointOf(env.AI_BASE_URL, "https://api.anthropic.com", "/v1/messages"),
        { "x-api-key": env.AI_API_KEY, "anthropic-version": ANTHROPIC_VERSION },
        {
          model: env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          // Current Claude models think adaptively by default and thinking tokens count towards max_tokens: without a
          // low effort a short answer budget can be spent before any text is written (empty reply -> 502).
          ...(/^(low|medium|high)$/.test(String(env.AI_EFFORT || "")) ? { output_config: { effort: String(env.AI_EFFORT) } } : {}),
          // The knowledge block is identical across requests (per language): mark it cacheable.
          system: [
            { type: "text", text: system },
            { type: "text", text: knowledge, cache_control: { type: "ephemeral" } }
          ],
          messages: normalizeTurns(messages)
        },
        signal
      );
      const text = (payload.content || []).filter(part => part?.type === "text" && typeof part.text === "string").map(part => part.text).join("\n").trim();
      if (!text) throw new ProviderError(502);
      return text;
    }
  },

  // Any OpenAI Chat Completions-compatible endpoint (set AI_BASE_URL, e.g. https://api.openai.com/v1).
  openai: {
    id: "openai",
    // No invented default model: AI_MODEL is mandatory for this provider.
    isConfigured: (env) => Boolean(env.AI_API_KEY && env.AI_MODEL),
    async complete({ env, system, knowledge, messages, maxTokens, signal }) {
      const base = env.AI_BASE_URL || "https://api.openai.com/v1";
      const official = new URL(base).hostname === "api.openai.com";
      const body = {
        model: env.AI_MODEL,
        messages: [{ role: "system", content: system + "\n\n" + knowledge }, ...normalizeTurns(messages)]
      };
      // api.openai.com expects max_completion_tokens; most compatible servers still expect max_tokens.
      body[official ? "max_completion_tokens" : "max_tokens"] = maxTokens;
      if (official) body.store = false;
      const payload = await postJson(endpointOf(base, "", "/chat/completions"), { Authorization: "Bearer " + env.AI_API_KEY }, body, signal);
      const content = payload.choices?.[0]?.message?.content;
      const text = (Array.isArray(content) ? content.map(part => part?.text || "").join("") : content || "").trim();
      if (!text) throw new ProviderError(502);
      return text;
    }
  }
};

export function getProvider(env) {
  const id = String(env.AI_PROVIDER || "anthropic").toLowerCase();
  return providers[id] || null;
}
