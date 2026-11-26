// Discreet HUD: hover card that follows the pointer, status chip, a fading keycap legend, touch buttons.
import { $, h, clockText } from "./dom.js";
import { t, L } from "../core/i18n.js";

export function createHud({ world, findEntity, isTouch }) {
  const label = $("#hover-label");
  const hint = $("#hud-hint");
  const mobile = $("#mobile-controls");
  const status = $("#hud-status");
  const frame = $("#hud-frame");
  const statusText = $("#hud-status-text");
  const clock = $("#hud-clock");
  let hoverInfo = null;
  let hintTimer = 0;
  let clockTimer = 0;
  let visible = false;

  function describe(info) {
    switch (info.kind) {
      case "project": case "music": { const e = findEntity(info.kind, info.id); return [e ? L(e.title) : "", t("hover.project")]; }
      case "app": { const e = findEntity("app", info.id); return [e ? e.name : "", t("hover.app")]; }
      case "shopkeeper": return [t("chat.title"), t("hover.shopkeeper")];
      case "poster": return [t("poster.title"), t("hover.poster")];
      case "cv": return [t("cv.title"), t("hover.cv")];
      case "contact": return [t("contact.title"), t("hover.contact")];
      case "about": return [t("about.title"), t("hover.about")];
      case "turntable": return ["SIDE A · 33 RPM", t("hover.turntable")];
      case "secret": return ["…", t("hover.secret")];
      default: return ["", ""];
    }
  }

  function renderLabel() {
    if (!hoverInfo || !visible) { label.hidden = true; return; }
    const [title, action] = describe(hoverInfo);
    label.replaceChildren();
    const strong = document.createElement("strong"); strong.textContent = title;
    const span = document.createElement("span"); span.textContent = action;
    label.append(strong, span);
    label.hidden = false;
    position(hoverInfo.x, hoverInfo.y);
  }
  function position(x, y) {
    const w = label.offsetWidth || 180, hgt = label.offsetHeight || 50;
    const px = Math.min(x, window.innerWidth - w - 36), py = Math.min(y, window.innerHeight - hgt - 40);
    label.style.left = Math.max(8, px) + "px"; label.style.top = Math.max(8, py) + "px";
  }

  window.addEventListener("pointermove", (e) => { if (hoverInfo && e.pointerType === "mouse") { hoverInfo.x = e.clientX; hoverInfo.y = e.clientY; position(e.clientX, e.clientY); } }, { passive: true });

  // keycap legend: [KEY] action, in the visitor's language
  function renderHint() {
    const items = isTouch
      ? [[t("hud.kc.drag"), t("hud.k.look")], [t("hud.kc.pinch"), t("hud.k.zoom")], [t("hud.kc.tap"), t("hud.k.pick")]]
      : [[t("hud.kc.mouse"), t("hud.k.look")], [t("hud.kc.click"), t("hud.k.pick")], [t("hud.kc.scroll"), t("hud.k.zoom")], ["ESC", t("hud.k.menu")]];
    hint.replaceChildren(...items.map(([key, text]) => h("span", { class: "hint-item" }, h("kbd", { text: key }), text)));
  }
  function showHint() {
    renderHint();
    hint.hidden = false; hint.classList.remove("is-faded");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add("is-faded"), 9000);
  }

  function renderStatus() {
    statusText.textContent = "SIDE A · " + t("intro.open");
    clock.textContent = clockText();
  }

  $("#mc-recenter").addEventListener("click", () => world.recenter());
  $("#mc-zoom-in").addEventListener("click", () => world.zoomBy(-6));
  $("#mc-zoom-out").addEventListener("click", () => world.zoomBy(6));

  return {
    setVisible(v) {
      visible = !!v;
      $("#menu-button").hidden = !visible;
      mobile.hidden = !visible || !isTouch;
      status.hidden = !visible;
      frame.hidden = !visible;
      clearInterval(clockTimer);
      if (visible) { renderStatus(); clockTimer = setInterval(renderStatus, 15000); showHint(); }
      else { hint.hidden = true; label.hidden = true; }
    },
    onHover(info) { hoverInfo = info ? { ...info } : null; renderLabel(); },
    refresh() { if (visible) { renderHint(); renderStatus(); renderLabel(); } },
    // the keycap legend steps aside while a record is in hand (the dock shows the relevant keys)
    suppressHint(on) { hint.classList.toggle("is-suppressed", !!on); },
    showHint
  };
}
