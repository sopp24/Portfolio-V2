// Loading screen (real progress) + closed-shop intro overlay.
import { $, $$ } from "./dom.js";
import { t } from "../core/i18n.js";

export function createIntro({ onEnter, onDirect, onTwoD, onLanguage }) {
  const loading = $("#loading");
  const fill = $("#loading-fill");
  const label = $("#loading-label");
  const percent = $("#loading-percent");
  const bar = $("#loading").querySelector(".loading-bar");
  const intro = $("#intro");
  const chip = $("#intro-status");
  const chipText = $("#intro-status-text");
  let statusKey = "intro.closed";
  let state = "closed";

  function setStatus(key, cls = "") {
    statusKey = key;
    chip.classList.remove("is-open", "is-limited");
    if (cls) chip.classList.add(cls);
    chipText.textContent = t(key);
  }

  $("#enter-sound").addEventListener("click", () => onEnter({ sound: true }));
  $("#enter-silent").addEventListener("click", () => onEnter({ sound: false }));
  $("#intro-direct").addEventListener("click", () => onDirect());
  $("#intro-2d").addEventListener("click", () => onTwoD());
  for (const el of $$("[data-lang]", intro)) el.addEventListener("click", () => onLanguage(el.dataset.lang));

  return {
    progress(value, key) {
      const pct = Math.round(value * 100);
      fill.style.width = pct + "%";
      percent.textContent = pct + "%";
      bar.setAttribute("aria-valuenow", String(pct));
      if (key) { const text = t("loading." + key); label.textContent = text === "loading." + key ? "" : text; }
    },
    hideLoading() { loading.classList.add("is-done"); setTimeout(() => { loading.hidden = true; }, 800); },
    showLoading() { loading.hidden = false; loading.classList.remove("is-done"); },
    show({ returning = false, limited = false } = {}) {
      state = limited ? "limited" : "closed";
      intro.hidden = false; intro.classList.remove("is-leaving");
      setStatus(limited ? "intro.limited" : "intro.closed", limited ? "is-limited" : "");
      $("#intro-direct").hidden = !returning;
      $("#enter-sound").disabled = $("#enter-silent").disabled = limited;
      requestAnimationFrame(() => $("#enter-sound").focus({ preventScroll: true }));
    },
    // the shop "opens": chip flips to OPEN while the overlay fades
    opening() {
      setStatus("intro.open", "is-open");
      intro.classList.add("is-leaving");
      state = "opening";
    },
    hide() { intro.hidden = true; },
    isVisible: () => !intro.hidden,
    refresh() { chipText.textContent = t(statusKey); },
    getState: () => state
  };
}
