import { $ } from "./dom.js";

let timer = 0;
export function toast(message, { duration = 3200 } = {}) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("is-visible"), duration);
}
