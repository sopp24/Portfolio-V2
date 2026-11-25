// Tiny DOM helpers (no framework). Text is always set through textContent: no innerHTML with data.
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "hidden") el.hidden = !!value;
      else el.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }

export function trapFocus(container, event) {
  if (event.key !== "Tab") return;
  const focusables = $$("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])", container)
    .filter((el) => !el.hidden && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
  else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
}

export function isTouchDevice() {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return !!coarse || (navigator.maxTouchPoints > 0 && !window.matchMedia?.("(pointer: fine)").matches);
}
