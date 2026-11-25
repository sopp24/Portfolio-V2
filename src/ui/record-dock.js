// Bottom dock shown while a record or an application case is in hand.
import { $ } from "./dom.js";
import { t, L } from "../core/i18n.js";

export function createRecordDock({ world, findEntity, categories, onShowSheet, onHideSheet, sfx }) {
  const dock = $("#record-dock");
  let held = null;
  let sheetTimer = 0;

  const els = {
    eyebrow: $("#dock-eyebrow"), title: $("#dock-title"), hint: $("#dock-hint"),
    recordActions: $("#dock-record-actions"), appActions: $("#dock-app-actions"),
    flip: $("#dock-flip"), open: $("#dock-open"), details: $("#dock-details"), ret: $("#dock-return"),
    appOpen: $("#dock-app-open"), appRepo: $("#dock-app-repo"), appRet: $("#dock-app-return")
  };

  els.flip.addEventListener("click", () => world.flipRecord());
  els.open.addEventListener("click", () => world.toggleSleeve());
  els.details.addEventListener("click", () => { if (held) onShowSheet(held); });
  els.ret.addEventListener("click", () => world.releaseHeld());
  els.appRet.addEventListener("click", () => world.releaseHeld());

  function render() {
    if (!held) { dock.hidden = true; return; }
    const entity = findEntity(held.kind, held.id);
    dock.hidden = false;
    if (held.kind === "app") {
      els.recordActions.hidden = true; els.appActions.hidden = false;
      els.eyebrow.textContent = "SOPP AGENTS · " + (entity ? L(entity.category).toUpperCase() : "");
      els.title.textContent = entity ? entity.name : "";
      els.hint.textContent = entity ? L(entity.description) : "";
      if (entity) {
        els.appOpen.href = entity.url; els.appOpen.textContent = t("dock.openApp") + " ↗";
        els.appRepo.href = entity.repository; els.appRepo.textContent = t("dock.repo") + " ↗";
      }
      els.appRet.textContent = t("dock.returnApp");
    } else {
      els.recordActions.hidden = false; els.appActions.hidden = true;
      const first = entity && entity.categories && entity.categories[0];
      const cat = categories.find((c) => c.id === first);
      els.eyebrow.textContent = held.kind === "music" ? "SIDE A · " + t("dock.music").toUpperCase() : "SIDE A · " + (cat ? L(cat).toUpperCase() : "");
      els.title.textContent = entity ? L(entity.title) : "";
      els.hint.textContent = t("dock.drag");
      els.flip.textContent = held.flipped ? t("dock.unflip") : t("dock.flip");
      els.open.textContent = held.open ? t("dock.close") : t("dock.open");
      els.details.textContent = t("dock.details");
      els.ret.textContent = t("dock.return");
      els.open.disabled = els.flip.disabled = held.state === "returning";
    }
  }

  function update(info) {
    const previous = held;
    held = info;
    render();
    clearTimeout(sheetTimer);
    if (!info) { onHideSheet(); return; }
    // The sheet appears progressively once the sleeve is open and the disc has slid out.
    if (info.state === "returning") onHideSheet();
    void sfx;
  }

  return { update, rerender: render, isHeld: () => !!held, getHeld: () => held };
}
