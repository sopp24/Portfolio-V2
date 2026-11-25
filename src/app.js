// Orchestrator: boots data, audio, world and UI, and wires events between them.
import { PROJECTS, CATEGORIES } from "./data/projects.js";
import { APPLICATIONS } from "./data/applications.js";
import { PROFILE } from "./data/profile.js";
import { t, L, getLanguage, setLanguage, onLanguage, detectLanguage, applyTranslations } from "./core/i18n.js";
import { isReturningVisitor, markVisited } from "./core/storage.js";
import { $, $$, isTouchDevice, trapFocus } from "./ui/dom.js";
import { toast } from "./ui/toast.js";
import { createIntro } from "./ui/intro.js";
import { createHud } from "./ui/hud.js";
import { createMenu } from "./ui/header.js";
import { createRecordDock } from "./ui/record-dock.js";
import { createAssistant } from "./ui/assistant.js";
import { createRadio } from "./ui/radio.js";
import { createDirectory } from "./ui/directory2d.js";
import { renderProjectSheet, renderAbout, renderCv, renderContact, renderPoster } from "./ui/panels.js";
import { createAudioEngine } from "./audio/engine.js";
import { createShopkeeperClient, readEndpointFromDocument } from "./ai/client.js";
import { MUSIC_PROJECTS } from "./scene/world.js";

const params = new URLSearchParams(location.search);
const isTouch = isTouchDevice();
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const data = { projects: PROJECTS, categories: CATEGORIES, applications: APPLICATIONS, profile: PROFILE };

function findEntity(kind, id) {
  if (kind === "project") return PROJECTS.find((p) => p.id === id) || null;
  if (kind === "music") return MUSIC_PROJECTS.find((p) => p.id === id) || null;
  if (kind === "app") return APPLICATIONS.find((a) => a.id === id) || null;
  return null;
}

function supportsWebGL2() {
  try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch { return false; }
}

export async function boot() {
  setLanguage(detectLanguage(), { persist: false });
  applyTranslations();
  document.title = t("site.title");

  const audio = createAudioEngine();
  const client = createShopkeeperClient({ endpoint: readEndpointFromDocument(), getLanguage });
  let world = null;
  let inStore = false;
  let panels = null;

  // ------------------------------------------------------------------ audio helpers
  const sfx = (name) => { try { audio.sfx(name); } catch { /* never blocks */ } };
  const radio = createRadio({ audio, isTouch });
  async function ensureAudio({ music }) {
    if (!audio.getState().started) await audio.start({ music: !!music });
    else if (music) { await audio.music.enable(); audio.music.play(); }
    radio.setEnabled(audio.music.isEnabled());
  }
  audio.on("change", () => { if (world) world.setMusicPlaying(audio.music.isPlaying()); radio.setEnabled(audio.music.isEnabled()); });

  // ------------------------------------------------------------------ dialogs
  const info = $("#info-dialog");
  const infoContent = $("#info-content");
  function openInfo(node) {
    infoContent.replaceChildren(node);
    if (!info.open) info.showModal();
    info.scrollTop = 0;
  }
  $("#info-close").addEventListener("click", () => info.close());
  info.addEventListener("keydown", (e) => trapFocus(info, e));
  info.addEventListener("click", (e) => { if (e.target === info) info.close(); });

  const liner = $("#liner-panel");
  let linerRef = null;
  function showSheet(held) {
    const entity = findEntity(held.kind, held.id);
    if (!entity) return;
    linerRef = { kind: held.kind, id: held.id };
    const index = held.kind === "project" ? PROJECTS.indexOf(entity) : 20 + MUSIC_PROJECTS.indexOf(entity);
    $("#liner-content").replaceChildren(renderProjectSheet(entity, CATEGORIES, { index, kind: held.kind }));
    liner.hidden = false; liner.scrollTop = 0;
    world && world.setPresentShift(window.innerWidth > 860 ? -.2 : 0);
  }
  function hideSheet() { liner.hidden = true; linerRef = null; world && world.setPresentShift(0); }
  $("#liner-close").addEventListener("click", hideSheet);

  const showAbout = () => openInfo(renderAbout(PROFILE, { onCv: showCv, onContact: showContact, onAsk: () => { info.close(); assistant && assistant.open(); } }));
  const showCv = () => openInfo(renderCv(PROFILE, { onAbout: showAbout, onAsk: () => { info.close(); assistant && assistant.open(); } }));
  const showContact = () => openInfo(renderContact(PROFILE));

  // ------------------------------------------------------------------ 2D directory
  const directory = createDirectory({
    data,
    onOpenProject: (project, index) => openInfo(wrapSheet(renderProjectSheet(project, CATEGORIES, { index }))),
    onAbout: showAbout, onCv: showCv, onContact: showContact,
    onBack: () => hideDirectory(),
    onEnter3d: () => { location.search = ""; },
    canEnter3d: () => !!world,
    onLanguage: (code) => changeLanguage(code)
  });
  function wrapSheet(node) {
    const body = document.createElement("div"); body.className = "dialog-body";
    body.append(node);
    return body;
  }
  function showDirectory(message = "") {
    if (world) { world.setActive(false); world.setPaused(true); }
    menu && menu.hide(); assistant && assistant.close();
    $("#intro").hidden = true; hud.setVisible(false);
    directory.show({ message });
    $("#skip-link").hidden = true;
  }
  function hideDirectory() {
    directory.hide();
    if (!world) return;
    world.setPaused(false);
    if (inStore) { hud.setVisible(true); world.setActive(true); } else intro.show({ returning: isReturningVisitor() });
  }

  // ------------------------------------------------------------------ language
  function changeLanguage(code) {
    setLanguage(code);
  }
  for (const el of $$("[data-lang]")) { /* handled by intro / menu / directory */ void el; }

  // ------------------------------------------------------------------ UI pieces that need the world
  let menu = null, assistant = null, dock = null;
  const hud = createHud({ world: { recenter: () => world?.recenter(), zoomBy: (d) => world?.zoomBy(d) }, findEntity, isTouch });
  const intro = createIntro({
    onEnter: (opts) => enterStore(opts),
    onDirect: () => enterStore({ sound: false, direct: true }),
    onTwoD: () => showDirectory(),
    onLanguage: (code) => changeLanguage(code)
  });

  // ------------------------------------------------------------------ build the world
  if (params.get("mode") === "2d" || !supportsWebGL2()) {
    intro.hideLoading();
    showDirectory(supportsWebGL2() ? t("dir.reduced") : t("dir.noWebgl"));
    wireLanguage();
    return;
  }
  intro.showLoading();
  try {
    const { createWorld } = await import("./scene/world.js");
    world = await createWorld({
      canvas: $("#world"), projects: PROJECTS, categories: CATEGORIES, applications: APPLICATIONS, profile: PROFILE, language: getLanguage(),
      onProgress: (p, key) => intro.progress(p, key)
    });
  } catch (error) {
    console.error("3D store failed to start", error);
    intro.hideLoading();
    showDirectory(t("loading.error"));
    wireLanguage();
    return;
  }

  dock = createRecordDock({ world, findEntity, categories: CATEGORIES, onShowSheet: showSheet, onHideSheet: hideSheet, sfx });
  assistant = createAssistant({
    world, client, findEntity, sfx,
    onAction: (action) => {
      if (action.type === "about") return showAbout();
      if (action.type === "cv") return showCv();
      if (action.type === "contact") return showContact();
      assistant.close();
      const kind = action.type === "app" ? "app" : "project";
      world.focus(kind, action.id);
      setTimeout(() => { if (inStore && !world.getHeld()) world.presentProject(action.id); }, 1500);
    }
  });
  menu = createMenu({
    world, audio, radio, isTouch, ensureAudio, toast, onLanguage: changeLanguage,
    onGo: (target) => {
      if (target === "shopkeeper") assistant.open();
      else if (target === "about") { world.lookAtRegion("about"); showAbout(); }
      else if (target === "cv") showCv();
      else if (target === "contact") showContact();
      else if (target === "directory") showDirectory();
      else if (target === "leave") leaveStore();
    }
  });

  world.on("hover", (h) => hud.onHover(h));
  world.on("sound", (name) => sfx(name));
  world.on("held", (h) => dock.update(h));
  world.on("select", (sel) => handleSelect(sel));
  world.on("quality", (q) => { if (q.reason === "auto") toast(t("toast.quality", { tier: q.tier || "" })); });
  world.on("context-lost", () => { toast(t("toast.contextLost")); showDirectory(t("toast.contextLost")); });
  world.on("cue", (name) => {
    if (name === "lights-on") sfx("lights-on");
    if (name === "neon-on") sfx("neon-on");
    if (name === "doors-open") sfx("door-open");
    if (name === "doors-close") sfx("door-close");
  });
  world.on("arrived", () => {
    inStore = true;
    intro.hide();
    hud.setVisible(true);
    world.setActive(true);
    if (pendingDirect) { pendingDirect = false; world.lookAtRegion("gondola"); }
  });
  world.on("closed", () => { inStore = false; intro.show({ returning: true }); });

  function handleSelect(sel) {
    switch (sel.kind) {
      case "shopkeeper": assistant.open(); break;
      case "about": showAbout(); break;
      case "cv": sfx("page"); showCv(); break;
      case "contact": sfx("page"); showContact(); break;
      case "poster": sfx("paper"); openInfo(renderPoster({ title: sel.id.toUpperCase() })); break;
      case "secret": sfx("cat-tap"); setTimeout(() => sfx("secret"), 250); toast(t("secret.cat"), { duration: 4800 }); break;
      case "turntable": toggleMusic(); break;
      default: break;
    }
  }
  async function toggleMusic() {
    if (!audio.music.isEnabled()) { await ensureAudio({ music: true }); radio.expand(); toast(t("secret.turntableOn")); sfx("needle-drop"); return; }
    audio.music.toggle();
    toast(audio.music.isPlaying() ? t("secret.turntableOff") : t("secret.turntableOn"));
  }

  // ------------------------------------------------------------------ enter / leave
  let pendingDirect = false;
  async function enterStore({ sound, direct = false }) {
    if (inStore || intro.getState() === "opening") return;
    markVisited();
    // Audio starts only from this explicit click, and only if the visitor chose sound.
    if (sound) { ensureAudio({ music: true }).catch(() => {}); }
    intro.opening();
    pendingDirect = direct;
    world.openStore({ instant: direct || reducedMotion });
    if (sound) radio.expand();
    const sync = () => { $("#opt-sfx").checked = !!sound; $("#opt-ambience").checked = !!sound; $("#opt-music").checked = !!sound; };
    sync();
  }
  function leaveStore() {
    if (!inStore) return;
    hud.setVisible(false); hideSheet(); assistant.close(); dock.update(null);
    audio.stop(); radio.setEnabled(false);
    toast(t("toast.leaving"));
    world.closeStore();
  }

  // ------------------------------------------------------------------ keyboard
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (e.key === "Escape") {
      if (directory.isVisible()) { if (world) hideDirectory(); return; }
      if (info.open) return; // native dialog closes itself
      if (!inStore) return;
      if (assistant.isOpen()) return assistant.close();
      if (!$("#site-header").hidden) return menu.hide();
      if (!liner.hidden && !world.getHeld()) return hideSheet();
      if (world.getHeld()) return world.releaseHeld();
      menu.show();
      return;
    }
    if (!inStore || typing || info.open) return;
    const held = world.getHeld();
    if (held && held.kind !== "app") {
      if (e.key === "f" || e.key === "F") world.flipRecord();
      if (e.key === "o" || e.key === "O") world.toggleSleeve();
      if (e.key === "d" || e.key === "D") showSheet(held);
    }
    if (held && (e.key === "r" || e.key === "R" || e.key === "Backspace")) world.releaseHeld();
  });

  // ------------------------------------------------------------------ language refresh
  function wireLanguage() {
    onLanguage(() => {
      applyTranslations();
      document.title = t("site.title");
      intro.refresh(); hud.refresh(); directory.refresh();
      for (const el of $$("[data-lang]")) el.setAttribute("aria-pressed", String(el.dataset.lang === getLanguage()));
      if (world) {
        world.setLanguage(getLanguage());
        dock && dock.rerender();
        assistant && assistant.refreshLanguage();
        const held = world.getHeld();
        if (linerRef && !liner.hidden) showSheet(linerRef);
        void held;
      }
      radio.render();
    });
    for (const el of $$("[data-lang]")) el.setAttribute("aria-pressed", String(el.dataset.lang === getLanguage()));
  }
  wireLanguage();

  intro.hideLoading();
  intro.show({ returning: isReturningVisitor() });
  if (params.get("debug")) { window.__store = { world, audio, client }; }
  void L;
}
