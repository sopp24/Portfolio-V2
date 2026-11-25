// Discreet menu: appears with Escape (desktop) or the MENU button (touch), never permanently.
import { $, $$, trapFocus } from "./dom.js";
import { t } from "../core/i18n.js";
import { getPref, setPref } from "../core/storage.js";

export function createMenu({ world, audio, radio, isTouch, onGo, onLanguage, ensureAudio, toast }) {
  const menu = $("#site-header");
  const button = $("#menu-button");
  let open = false;

  const opt = {
    music: $("#opt-music"), sfx: $("#opt-sfx"), ambience: $("#opt-ambience"), volume: $("#opt-volume"),
    hints: $("#opt-hints"), gyro: $("#opt-gyro"), gyroRow: $("#opt-gyro-row"), quality: $("#opt-quality")
  };

  // Gyroscope control only where the sensor API exists and the device is touch-first.
  opt.gyroRow.hidden = !(isTouch && "DeviceOrientationEvent" in window);

  function sync() {
    const state = audio.getState();
    opt.music.checked = !!(state.music && state.music.state && !["off", "error", "blocked"].includes(state.music.state));
    opt.sfx.checked = !!state.sfx;
    opt.ambience.checked = !!state.ambience;
    opt.volume.value = String(Math.round((state.master ?? .7) * 100));
    opt.gyro.checked = world.isGyroEnabled();
    const stored = getPref("quality");
    opt.quality.value = stored && ["high", "medium", "low"].includes(stored) ? stored : "auto";
  }

  function show() {
    if (open) return;
    open = true; menu.hidden = false; sync();
    $("#menu-close").focus({ preventScroll: true });
  }
  function hide() {
    if (!open) return;
    open = false; menu.hidden = true;
    (document.activeElement instanceof HTMLElement) && document.activeElement.blur();
  }
  function toggle() { open ? hide() : show(); }

  button.addEventListener("click", toggle);
  $("#menu-close").addEventListener("click", hide);
  menu.addEventListener("keydown", (event) => { trapFocus(menu, event); if (event.key === "Escape") { event.stopPropagation(); hide(); } });

  // audio ------------------------------------------------------------------
  opt.music.addEventListener("change", async () => {
    if (opt.music.checked) {
      await ensureAudio({ music: true });
      radio.setEnabled(true);
      radio.expand();
    } else {
      audio.music.disable();
      radio.setEnabled(false);
    }
    sync();
  });
  opt.sfx.addEventListener("change", async () => { if (opt.sfx.checked) await ensureAudio({ music: false }); audio.setSfxEnabled(opt.sfx.checked); sync(); });
  opt.ambience.addEventListener("change", async () => { if (opt.ambience.checked) await ensureAudio({ music: false }); audio.setAmbienceEnabled(opt.ambience.checked); sync(); });
  opt.volume.addEventListener("input", () => audio.setMasterVolume(Number(opt.volume.value) / 100));

  // view -------------------------------------------------------------------
  $("#opt-recenter").addEventListener("click", () => { world.recenter(); hide(); });
  opt.hints.addEventListener("change", () => world.setHints(opt.hints.checked));
  opt.gyro.addEventListener("change", async () => {
    if (opt.gyro.checked) {
      const ok = await world.enableGyro();
      if (!ok) { opt.gyro.checked = false; toast(t("menu.gyroUnavailable")); } else toast(t("menu.gyroOn"));
    } else { world.disableGyro(); toast(t("menu.gyroOff")); }
  });
  opt.quality.addEventListener("change", () => {
    const value = opt.quality.value;
    if (value === "auto") { setPref("quality", ""); try { localStorage.removeItem("store.quality"); } catch { /* ignore */ } }
    else { setPref("quality", value); world.setQuality(value); }
  });

  // navigation -------------------------------------------------------------
  for (const el of $$("[data-go]", menu)) el.addEventListener("click", () => { hide(); onGo(el.dataset.go); });
  $("#opt-leave").addEventListener("click", () => { hide(); onGo("leave"); });
  for (const el of $$("[data-lang]", menu)) el.addEventListener("click", () => onLanguage(el.dataset.lang));

  return { show, hide, toggle, isOpen: () => open, sync };
}
