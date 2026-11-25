// Safe localStorage wrapper. Everything is optional: private windows, blocked storage and quota errors
// must never break the experience. Only non-personal preferences are stored (language, visited flag,
// quality override). Sound is never auto-enabled from a stored preference.
const PREFIX = "store.";

export function getPref(key, fallback = null) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch { return fallback; }
}
export function setPref(key, value) {
  try { localStorage.setItem(PREFIX + key, String(value)); return true; } catch { return false; }
}
export function isReturningVisitor() { return getPref("visited") !== null; }
export function markVisited() { setPref("visited", new Date().toISOString().slice(0, 10)); }
