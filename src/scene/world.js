// The world: renderer, scene assembly, intro choreography, render loop, quality governor and the
// public API the UI talks to. Nothing here knows about DOM panels: the UI subscribes to events.
import * as THREE from "three";
import { ROOM, CAMERA, SUN } from "./layout.js";
import { detectTier, stepDown, TIERS, prefersReducedMotion } from "./quality.js";
import { createMaterials } from "./materials.js";
import { buildAssets, atlasPlane } from "./assets.js";
import { createEnvironment } from "./environment.js";
import { createFillerSystem } from "./records.js";
import { StaticBatcher, disposeObject } from "./util.js";
import { buildRoom } from "./room.js";
import { buildGondola, buildDigBins, buildWallDisplays, buildCounter, buildShelving, buildWindowDisplay } from "./furniture.js";
import {
  buildTurntable, buildCounterClutter, buildSpeakers, buildLuckyCat, buildDocuments, buildAppsRack, buildAboutCorner, buildListeningCorner, buildClutter
} from "./props.js";
import { buildShopkeeper, updateShopkeeper, buildCustomers, updateCustomers } from "./people.js";
import { buildLighting } from "./lighting.js";
import { buildDetails } from "./details.js";
import { createPostFX } from "./postfx.js";
import { createInteraction } from "./interaction.js";
import { createFloorReflection } from "./reflection.js";
import { createLookControls } from "../controls/look.js";
import { ensureRecordDetail } from "./records.js";
import { MUSIC_PROJECTS } from "../data/music.js";

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 60));

export { MUSIC_PROJECTS };

export async function createWorld({ canvas, projects, categories, applications, profile, language = "fr", onProgress = () => {}, tier = null }) {
  const listeners = new Map();
  const on = (name, cb) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(cb); return () => listeners.get(name).delete(cb); };
  const emit = (name, payload) => { for (const cb of listeners.get(name) || []) { try { cb(payload); } catch (error) { console.error(error); } } };

  const reducedMotion = prefersReducedMotion();
  let quality = tier || detectTier();
  const steps = { done: 0, total: 26 };
  const progress = (label) => { steps.done = Math.min(steps.total, steps.done + 1); onProgress(steps.done / steps.total, label); };

  // --------------------------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, preserveDrawingBuffer: !!new URLSearchParams(location.search).get("capture") });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = true;
  const deviceRatio = window.devicePixelRatio || 1;
  let ratio = Math.min(deviceRatio, quality.dprCap);
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0xcfc3a8, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, .08, 120);
  camera.position.copy(CAMERA.position);
  scene.add(camera);

  // --------------------------------------------------------------------------------- context
  const musicProjects = MUSIC_PROJECTS;
  const ctx = {
    scene, quality, lang: language, camera, renderer,
    owned: [], localized: [], pickRoots: [], lights: {}, neonMaterials: [], neonLights: [], updaters: [], decorMaterial: null
  };
  progress("renderer");

  const materials = createMaterials(quality, () => progress("materials"));
  ctx.materials = materials;
  await nextFrame();

  const assets = await buildAssets(quality, applications, () => progress("artwork"));
  ctx.assets = assets;
  await nextFrame();

  scene.environment = createEnvironment(renderer);
  progress("environment");

  // shared helper materials / batching
  const batcher = new StaticBatcher();
  ctx.batcher = batcher;
  ctx.edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dec8, roughness: .9, normalMap: materials.cardboard.normalMap, normalScale: new THREE.Vector2(.5, .5) });
  ctx.paperNormal = materials.cardboard.normalMap;
  const decorMaterial = new THREE.MeshStandardMaterial({ map: assets.decor.texture, roughness: .6, metalness: 0, envMapIntensity: .7, name: "decor" });
  const posterMaterial = new THREE.MeshStandardMaterial({ map: assets.poster.texture, roughness: .72, envMapIntensity: .5, name: "poster" });
  const stickerMaterial = new THREE.MeshStandardMaterial({ map: assets.sticker.texture, roughness: .5, alphaTest: .45, envMapIntensity: .6, name: "sticker" });
  ctx.owned.push(ctx.edgeMaterial, decorMaterial, posterMaterial, stickerMaterial);
  ctx.batchDecor = (geometry, position, rotation, options = {}) => batcher.add(geometry, decorMaterial, position, rotation, { cast: false, ...options });
  ctx.batchPoster = (geometry, position, rotation, options = {}) => batcher.add(geometry, posterMaterial, position, rotation, { cast: false, ...options });
  ctx.sticker = (index, position, rotation, size = .12) => {
    const cell = assets.sticker.cells[index % assets.sticker.cells.length];
    batcher.add(atlasPlane(size, size, cell), stickerMaterial, position, rotation, { cast: false });
  };
  ctx.filler = createFillerSystem({ decorAtlas: assets.decor, quality, edgeMaterial: ctx.edgeMaterial });
  progress("setup");

  // --------------------------------------------------------------------------------- build
  const room = buildRoom(ctx);
  progress("room");
  await nextFrame();
  const gondola = buildGondola(ctx, projects, categories);
  buildDigBins(ctx);
  const wall = buildWallDisplays(ctx, assets);
  buildCounter(ctx);
  buildShelving(ctx);
  buildWindowDisplay(ctx, assets);
  progress("furniture");
  await nextFrame();

  const turntable = buildTurntable(ctx, [2.78, 1.02 + .006, -3.64]);
  buildCounterClutter(ctx);
  buildSpeakers(ctx);
  const cat = buildLuckyCat(ctx);
  const docs = buildDocuments(ctx, profile);
  const rack = buildAppsRack(ctx, applications);
  const about = buildAboutCorner(ctx, profile, musicProjects);
  buildListeningCorner(ctx);
  buildClutter(ctx);
  buildDetails(ctx);
  progress("props");
  await nextFrame();

  const shopkeeper = await buildShopkeeper(ctx);
  const customers = await buildCustomers(ctx);
  progress("people");

  const staticRoot = new THREE.Group();
  staticRoot.name = "static";
  scene.add(staticRoot);
  batcher.build(staticRoot, "static");
  progress("batch");

  const lighting = buildLighting(ctx);
  progress("lighting");

  const records = [...gondola.records, ...about.records];
  const apps = rack.cards;
  const pickRoots = ctx.pickRoots;
  void wall; void docs; void cat;

  const reflection = createFloorReflection({ renderer, scene, camera, material: materials.floor, hide: [room.floor, lighting.shafts, lighting.dust].filter(Boolean) });
  reflection.setEnabled(!!quality.reflections);
  // --------------------------------------------------------------------------------- post + controls + interaction
  let postfx = createPostFX({ renderer, scene, camera, quality, width: window.innerWidth, height: window.innerHeight, pixelRatio: ratio });
  progress("postfx");

  const interfaceSelector = "#site-header, .screen-overlay, .record-dock, .liner-panel, .dialog, dialog, .mode-2d, .assistant, .mobile-controls, button, a, input, select, textarea, .toast, .radio-card, .hud-card";
  const isOverInterface = (target) => target instanceof Element && !!target.closest(interfaceSelector) && target !== canvas;
  let interaction = null;
  const look = createLookControls({
    camera, canvas, reducedMotion, isOverInterface,
    onPointer: (p) => interaction?.setPointer(p),
    onTap: (p) => interaction?.handleTap(p)
  });
  interaction = createInteraction({
    scene, camera, canvas, pickRoots, records, apps, quality, getLanguage: () => ctx.lang, postfx, look, reducedMotion,
    onHover: (info) => emit("hover", info),
    onSelect: (info) => emit("select", info),
    onHeldChange: (info) => emit("held", info),
    onSound: (name) => emit("sound", name),
    // a record held close to the camera would be blown out by the point lights standing right behind the visitor
    onHold: (amount) => { for (const l of ctx.lights.bounce || []) l.intensity = (l.userData.base ??= l.intensity) * (1 - .88 * amount); }
  });
  progress("controls");

  // --------------------------------------------------------------------------------- compile
  scene.traverse((o) => { if (o.isMesh && o.material && !o.userData.pick) o.frustumCulled = o.frustumCulled; });
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  progress("shaders");

  // --------------------------------------------------------------------------------- state machine: intro / open
  const state = {
    open: false, transition: null, active: false, musicPlaying: false, greeting: false, talking: false, hidden: false,
    elapsed: 0, fade: 1
  };
  const exteriorPose = { position: new THREE.Vector3(.55, 1.62, 9.4), target: new THREE.Vector3(.35, 1.42, 4.9), fov: 44 };
  const tmpLook = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const homeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(look.getHome().pitch, 0, 0, "YXZ"));
  const exteriorQuat = new THREE.Quaternion();
  tmpLook.lookAt(exteriorPose.position, exteriorPose.target, new THREE.Vector3(0, 1, 0));
  exteriorQuat.setFromRotationMatrix(tmpLook);

  function placeCameraExterior(time) {
    const drift = reducedMotion ? 0 : 1;
    camera.position.copy(exteriorPose.position);
    camera.position.x += Math.sin(time * .17) * .12 * drift;
    camera.position.y += Math.sin(time * .23) * .015 * drift;
    camera.quaternion.copy(exteriorQuat);
    if (Math.abs(camera.fov - exteriorPose.fov) > .01) { camera.fov = exteriorPose.fov; camera.updateProjectionMatrix(); }
  }

  // closed state at start
  room.snapDoors(false);
  lighting.setShopLights(false, true);
  lighting.setNeon(false, true);
  placeCameraExterior(0);
  postfx.setFade(1);

  const cues = [];
  function schedule(delay, name) { cues.push({ at: state.elapsed + delay, name }); }
  function runCues() {
    for (let i = cues.length - 1; i >= 0; i--) {
      if (state.elapsed >= cues[i].at) { const cue = cues.splice(i, 1)[0]; handleCue(cue.name); }
    }
  }
  function handleCue(name) {
    emit("cue", name);
    if (name === "lights-on") lighting.setShopLights(true);
    if (name === "neon-on") lighting.setNeon(true);
    if (name === "doors-open") room.openDoors();
    if (name === "doors-close") room.closeDoors();
    if (name === "lights-off") { lighting.setShopLights(false); lighting.setNeon(false); }
    if (name === "greet") state.greeting = true;
    if (name === "greet-end") state.greeting = false;
  }

  function startTransition(kind, { instant = false } = {}) {
    const from = camera.position.clone();
    const fromQuat = camera.quaternion.clone();
    const fromFov = camera.fov;
    state.transition = { kind, t: 0, duration: instant || reducedMotion ? .6 : 3.6, from, fromQuat, fromFov };
  }

  function openStore({ instant = false } = {}) {
    if (state.open || state.transition) return;
    state.open = true;
    interaction.setActive(false);
    cues.length = 0;
    if (instant) {
      lighting.setShopLights(true); lighting.setNeon(true); room.openDoors();
      state.transition = { kind: "open", t: 0, duration: .9, from: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
      emit("cue", "lights-on"); emit("cue", "neon-on");
      schedule(.1, "doors-open");
    } else {
      schedule(0, "lights-on");
      schedule(.5, "neon-on");
      schedule(1.5, "doors-open");
      schedule(2.4, "greet"); schedule(4.4, "greet-end");
      state.transition = { kind: "open", t: -1.9, duration: 3.4, from: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
    }
  }

  function closeStore() {
    if (!state.open || state.transition) return;
    interaction.release();
    interaction.setActive(false);
    look.setPointerLock(false);
    state.open = false;
    cues.length = 0;
    schedule(.1, "doors-close");
    schedule(1.8, "lights-off");
    state.transition = { kind: "close", t: 0, duration: 2.8, from: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
  }

  const easeIO = (t) => t * t * (3 - 2 * t);
  const tmpQ = new THREE.Quaternion();
  function updateTransition(dt) {
    const tr = state.transition;
    if (!tr) return false;
    tr.t += dt;
    if (tr.t < 0) { if (tr.kind === "open") placeCameraExterior(state.elapsed); return true; }
    const u = Math.min(1, tr.t / tr.duration);
    const e = easeIO(u);
    const lookState = look.getState();
    if (tr.kind === "open") {
      // dolly from the pavement, through the open doors, to the fixed visitor position
      const toPos = CAMERA.position.clone();
      const mid = new THREE.Vector3(.6, 1.6, 6.2);
      const q1 = tr.from.clone().lerp(mid, Math.min(1, e * 1.6));
      camera.position.copy(q1).lerp(toPos, Math.max(0, (e - .35) / .65));
      const homeQ = homeQuat.clone();
      tmpQ.slerpQuaternions(tr.fromQuat, homeQ, easeIO(Math.min(1, e * 1.15)));
      camera.quaternion.copy(tmpQ);
      camera.fov = THREE.MathUtils.lerp(tr.fromFov, CAMERA.fov, e);
      camera.updateProjectionMatrix();
      void lookState;
      if (u >= 1) {
        state.transition = null;
        camera.position.copy(CAMERA.position);
        look.recenter();
        interaction.setActive(true);
        state.active = true;
        emit("arrived", {});
      }
    } else {
      camera.position.copy(tr.from).lerp(exteriorPose.position, e);
      tmpQ.slerpQuaternions(tr.fromQuat, exteriorQuat, e);
      camera.quaternion.copy(tmpQ);
      camera.fov = THREE.MathUtils.lerp(tr.fromFov, exteriorPose.fov, e);
      camera.updateProjectionMatrix();
      if (u >= 1) { state.transition = null; state.active = false; emit("closed", {}); }
    }
    return true;
  }

  // --------------------------------------------------------------------------------- language
  function drawLocalized(lang) {
    for (const item of ctx.localized) {
      const canvasEl = item.draw(lang);
      const texture = item.texture;
      texture.image = canvasEl;
      texture.needsUpdate = true;
    }
  }
  function setLanguage(lang) {
    if (lang === ctx.lang) return;
    ctx.lang = lang;
    drawLocalized(lang);
    for (const rec of records) rec.detailLang = null;
    interaction.refreshLanguage();
    queueDetails();
  }
  let detailQueue = [];
  function queueDetails() {
    detailQueue = records.slice();
    const step = () => {
      const rec = detailQueue.shift();
      if (!rec || disposed) return;
      try { ensureRecordDetail(rec, ctx.lang, quality); } catch (error) { console.warn("detail texture", error); }
      idle(step);
    };
    idle(step);
  }
  let disposed = false;
  queueDetails();

  // --------------------------------------------------------------------------------- loop + governor
  const clock = { last: performance.now(), getDelta() { const now = performance.now(); const d = (now - this.last) / 1000; this.last = now; return d; }, start() { this.last = performance.now(); } };
  const governor = { acc: 0, frames: 0, slow: 0, fast: 0, cooldown: 3 };
  let raf = 0;
  let paused = false;
  const camPos = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (document.hidden || disposed || paused) return;
    const dt = Math.min(clock.getDelta(), .1);
    state.elapsed += dt;
    const elapsed = state.elapsed;
    runCues();
    const transitioning = updateTransition(dt);
    if (!transitioning) {
      if (state.open) look.update(dt);
      else placeCameraExterior(elapsed);
    }
    for (const fn of room.updaters) fn(dt, elapsed);
    for (const fn of ctx.updaters) fn(dt, elapsed);
    lighting.update(dt, elapsed);
    interaction.update(dt, elapsed);
    camera.getWorldPosition(camPos);
    // animated props
    const propState = { playing: state.musicPlaying };
    ctx.pickRoots.forEach((root) => root.userData.update?.(dt, elapsed, propState));
    updateShopkeeper(shopkeeper, dt, elapsed, { cameraPosition: camPos, greeting: state.greeting, talking: state.talking, beat: state.musicPlaying ? 1 : 0 });
    updateCustomers(customers, dt, elapsed);
    reflection.update();
    postfx.render(dt, elapsed);
    adapt(dt);
  }

  function adapt(dt) {
    if (state.transition) return;
    governor.acc += dt; governor.frames++;
    governor.cooldown -= dt;
    if (governor.acc < 1.2) return;
    const avg = governor.acc / governor.frames * 1000;
    governor.acc = 0; governor.frames = 0;
    if (governor.cooldown > 0) return;
    if (avg > 26) { governor.slow++; governor.fast = 0; } else if (avg < 11) { governor.fast++; governor.slow = 0; } else { governor.slow = 0; governor.fast = 0; }
    if (governor.slow >= 2) {
      governor.slow = 0; governor.cooldown = 4;
      if (ratio > Math.max(.8, quality.dprCap * .55)) { ratio = Math.max(.75, ratio * .85); applySize(); emit("quality", { reason: "dpr", ratio }); }
      else {
        const next = stepDown(quality);
        if (next) { setQuality(next, true); }
      }
    }
  }

  function applySize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    postfx.resize(w, h, ratio);
  }

  function setQuality(next, auto = false) {
    if (!next || next.id === quality.id) return;
    quality = next;
    ctx.quality = next;
    reflection.setEnabled(!!next.reflections);
    ratio = Math.min(deviceRatio, quality.dprCap);
    postfx.dispose();
    postfx = createPostFX({ renderer, scene, camera, quality, width: window.innerWidth, height: window.innerHeight, pixelRatio: ratio });
    interaction && (interaction.postfx = postfx);
    lighting.sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    lighting.sun.shadow.map?.dispose(); lighting.sun.shadow.map = null;
    applySize();
    if (!auto) { try { localStorage.setItem("store.quality", next.id); } catch { /* ignore */ } }
    emit("quality", { reason: auto ? "auto" : "manual", tier: next.id, ratio });
  }

  function onResize() { applySize(); }
  window.addEventListener("resize", onResize);
  const onContextLost = (event) => { event.preventDefault(); emit("context-lost", {}); };
  canvas.addEventListener("webglcontextlost", onContextLost);
  const onVisibility = () => { if (!document.hidden) clock.getDelta(); };
  document.addEventListener("visibilitychange", onVisibility);

  progress("ready");
  onProgress(1, "ready");
  clock.start();
  frame();

  // --------------------------------------------------------------------------------- public API
  const api = {
    on, getTier: () => quality.id, getTiers: () => Object.keys(TIERS),
    setQuality: (id) => TIERS[id] && setQuality(TIERS[id]),
    setLanguage, openStore, closeStore,
    isOpen: () => state.open && !state.transition,
    recenter: () => look.recenter(),
    setPresentShift: (v) => interaction.setScreenShift(v),
    zoomBy: (delta) => look.setZoom(look.getTargetFov() + delta),
    setPaused(v) { paused = !!v; if (!paused) clock.start(); },
    setHints: (v) => interaction.setHints(v),
    enableGyro: () => look.enableGyroscope(),
    disableGyro: () => look.disableGyroscope(),
    isGyroEnabled: () => look.isGyroEnabled(),
    flipRecord: () => interaction.flip(),
    toggleSleeve: () => interaction.toggleOpen(),
    releaseHeld: () => interaction.release(),
    getHeld: () => interaction.getHeld(),
    presentProject: (id) => interaction.present(id),
    setActive: (v) => interaction.setActive(v && state.open && !state.transition),
    // point the camera at something and pulse it (used for the shopkeeper's recommendations)
    focus(kind, id) {
      let root = interaction.findRoot(kind === "app" ? "app" : kind, id);
      if (!root) root = interaction.findRoot(null, id);
      if (!root) return false;
      const point = root.getWorldPosition(new THREE.Vector3());
      const isKeeper = root.userData.pick.kind === "shopkeeper";
      point.y += isKeeper ? 1.42 : .2;
      look.lookAtPoint(point, { fov: isKeeper ? 27 : 40, hold: isKeeper ? 600 : 4.5 });
      interaction.pulse(root.userData.pick.kind, id, 5);
      return true;
    },
    lookAtRegion(name) {
      const regions = {
        about: new THREE.Vector3(ROOM.x0 + .2, 1.8, -4.3), counter: new THREE.Vector3(2.2, 1.3, -3.7), apps: new THREE.Vector3(ROOM.x1 - .2, 1.6, 1.85),
        gondola: new THREE.Vector3(0, 1.0, -.5), window: new THREE.Vector3(0, 1.8, ROOM.zFront), left: new THREE.Vector3(ROOM.x0, 1.7, -1.0)
      };
      const p = regions[name];
      if (p) look.lookAtPoint(p, { fov: 46, hold: 6 });
    },
    setShopkeeper({ greeting, talking } = {}) { if (greeting !== undefined) state.greeting = !!greeting; if (talking !== undefined) state.talking = !!talking; },
    greetShopkeeper() { state.greeting = true; schedule(2.2, "greet-end"); },
    setMusicPlaying(v) { state.musicPlaying = !!v; },
    getRecordCount: () => records.length,
    getProjectsInStore: () => gondola.records.map((r) => r.project.id),
    stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ratio, tier: quality.id }; },
    resize: onResize,
    _debug: { scene, camera, renderer, look, interaction, state, postfx: () => postfx, lighting, room, ctx },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      interaction.destroy(); look.destroy(); postfx.dispose();
      disposeObject(scene);
      materials.dispose();
      renderer.dispose();
    }
  };
  void SUN;
  return api;
}
