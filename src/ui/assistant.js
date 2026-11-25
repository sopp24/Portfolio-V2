// The shopkeeper chat. Real AI only when the backend is configured and answering; otherwise it says so
// plainly and answers from the local catalogue (never pretends).
import { $, h, trapFocus } from "./dom.js";
import { t, L, getLanguage } from "../core/i18n.js";

export function createAssistant({ world, client, findEntity, onAction, sfx }) {
  const panel = $("#assistant");
  const log = $("#assistant-log");
  const chips = $("#assistant-chips");
  const form = $("#assistant-form");
  const input = $("#assistant-input");
  const statusEl = $("#assistant-status");
  const sendBtn = $("#assistant-send");
  let history = [];        // [{role, content}] — in memory only, never persisted
  let mode = "checking";   // 'ai' | 'offline' | 'checking'
  let busy = false;
  let abort = null;
  let isOpen = false;
  let talkTimer = 0;
  let announcedOffline = false;
  let opener = null; // focus returns here when the panel closes

  function renderStatus() {
    statusEl.classList.toggle("is-ai", mode === "ai");
    statusEl.textContent = mode === "ai" ? t("chat.statusAi") : mode === "offline" ? t("chat.statusCatalogue") : t("chat.statusChecking");
  }

  function bubble(role, text, { note = false, thinking = false } = {}) {
    const el = h("div", { class: `msg ${note ? "msg-note" : role === "user" ? "msg-user" : "msg-bot"}${thinking ? " msg-thinking" : ""}`, text });
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function actionLabel(action) {
    if (action.type === "project") { const e = findEntity("project", action.id); return e ? L(e.title) : action.id; }
    if (action.type === "app") { const e = findEntity("app", action.id); return e ? e.name : action.id; }
    if (action.type === "cv") return t("chat.cvAction");
    if (action.type === "contact") return t("chat.contactAction");
    if (action.type === "about") return t("chat.aboutAction");
    return action.id || action.type;
  }

  function addActions(messageEl, actions) {
    if (!actions || !actions.length) return;
    const row = h("div", { class: "msg-actions" });
    for (const action of actions.slice(0, 3)) {
      row.append(h("button", { type: "button", class: "btn btn-small", text: t("chat.go", { label: actionLabel(action) }) + " ↗", onclick: () => onAction(action) }));
    }
    messageEl.append(row);
  }

  function renderChips() {
    chips.replaceChildren();
    for (const question of client.starterQuestions(getLanguage())) {
      chips.append(h("button", { type: "button", text: question, onclick: () => send(question) }));
    }
  }

  function talkFor(text) {
    world.setShopkeeper({ talking: true });
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => world.setShopkeeper({ talking: false }), Math.min(7000, 900 + text.length * 32));
  }

  async function send(raw) {
    const text = String(raw || "").trim().slice(0, 600);
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; input.value = "";
    chips.hidden = true;
    bubble("user", text);
    history.push({ role: "user", content: text });
    const thinking = bubble("bot", t("chat.thinking"), { thinking: true });
    world.setShopkeeper({ talking: false });
    abort = new AbortController();
    try {
      const result = await client.ask(history.slice(-8), { signal: abort.signal });
      thinking.remove();
      // the header must always tell the truth about the last answer: AI only when this reply really came from the AI
      mode = result.mode === "ai" ? "ai" : "offline";
      if (result.mode === "catalogue" && !announcedOffline) {
        announcedOffline = true;
        bubble("bot", result.degraded ? t("chat.degradedNote") : t("chat.offlineNote"), { note: true });
      }
      if (result.mode === "ai") announcedOffline = false; // re-arm: a later fallback is announced again
      renderStatus();
      const el = bubble("bot", result.reply);
      addActions(el, result.actions);
      history.push({ role: "assistant", content: result.reply });
      sfx("chat-message");
      talkFor(result.reply);
    } catch (error) {
      thinking.remove();
      if (!(error && error.code === "aborted")) { bubble("bot", t("chat.error"), { note: true }); sfx("error"); }
    } finally {
      busy = false; sendBtn.disabled = false; abort = null;
      if (isOpen) input.focus({ preventScroll: true });
    }
  }

  function reset() {
    if (abort) abort.abort();
    history = []; announcedOffline = false;
    log.replaceChildren();
    chips.hidden = false;
    bubble("bot", t("chat.welcome"));
    renderChips();
  }

  async function open() {
    if (isOpen) return;
    isOpen = true;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.hidden = false;
    sfx("chat-open");
    if (!log.childElementCount) reset();
    renderStatus();
    world.focus("shopkeeper", "shopkeeper");
    world.setShopkeeper({ greeting: true });
    setTimeout(() => world.setShopkeeper({ greeting: false }), 2200);
    setTimeout(() => input.focus({ preventScroll: true }), 60);
    if (mode === "checking") {
      client.checkHealth().then((value) => { mode = value === "ai" ? "ai" : "offline"; renderStatus(); }).catch(() => { mode = "offline"; renderStatus(); });
    }
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; panel.hidden = true;
    if (abort) abort.abort();
    world.setShopkeeper({ talking: false });
    if (opener && opener.isConnected && !opener.hidden && opener !== document.body && !panel.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); send(input.value); });
  $("#assistant-close").addEventListener("click", close);
  $("#assistant-reset").addEventListener("click", reset);
  panel.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } trapFocus(panel, event); });

  return {
    open, close, reset, isOpen: () => isOpen,
    refreshLanguage() { renderStatus(); if (log.childElementCount <= 1) { log.replaceChildren(); chips.hidden = false; bubble("bot", t("chat.welcome")); } renderChips(); }
  };
}
