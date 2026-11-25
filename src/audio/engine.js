// Audio engine for the store: synthesized SFX + ambience (Web Audio) and optional YouTube music.
// Completely silent until `start()` is called from a user gesture. Every method is safe to call
// before start() and after dispose().

import { createSfx } from "./sfx.js";
import { createAmbience } from "./ambience.js";
import { createYouTubeMusic, DEFAULT_VIDEO_ID } from "./youtube-music.js";

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export function createAudioEngine(options = {}) {
  const music = createYouTubeMusic({ videoId: options.youtubeVideoId || DEFAULT_VIDEO_ID });
  const listeners = new Set();

  let ctx = null;
  let nodes = null;        // { sfxBus, ambBus, compressor, fade, master }
  let sfxApi = null;
  let ambience = null;
  let started = false;
  let sfxEnabled = true;
  let ambienceEnabled = true;
  let master = 0.8;
  let suspendTimer = null;
  let disposed = false;

  function emit() {
    for (const cb of [...listeners]) { try { cb(getState()); } catch { /* ignore listener errors */ } }
  }
  function getState() {
    return { started, sfx: sfxEnabled, ambience: ambienceEnabled, music: music.getStatus(), master };
  }

  const offMusic = music.on("change", (status) => {
    if (ambience) ambience.setMusicActive(status.state === "playing");
    emit();
  });

  function buildGraph() {
    const AudioContextClass = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return false;
    ctx = new AudioContextClass({ latencyHint: "interactive" });
    const sfxBus = ctx.createGain();
    const ambBus = ctx.createGain();
    ambBus.gain.value = 0.9;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    const fade = ctx.createGain();
    const masterGain = ctx.createGain();
    masterGain.gain.value = master;
    sfxBus.connect(compressor);
    ambBus.connect(compressor);
    compressor.connect(fade);
    fade.connect(masterGain);
    masterGain.connect(ctx.destination);
    nodes = { sfxBus, ambBus, compressor, fade, master: masterGain };
    sfxBus.gain.value = sfxEnabled ? 0.9 : 0;
    sfxApi = createSfx(ctx, sfxBus);
    ambience = createAmbience(ctx, ambBus);
    return true;
  }

  function ramp(param, value, seconds) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
  }

  async function start({ music: wantMusic = false } = {}) {
    if (disposed) return;
    try {
      if (suspendTimer !== null) { clearTimeout(suspendTimer); suspendTimer = null; }
      if (!ctx && !buildGraph()) { started = false; }
      if (ctx) {
        if (ctx.state === "suspended") await ctx.resume();
        ramp(nodes.fade.gain, 1, 0.4);
        started = true;
        if (ambienceEnabled) ambience.start();
        ambience.setMusicActive(music.getStatus().state === "playing");
      }
    } catch (error) {
      started = false;
    }
    if (wantMusic) {
      // Do not await: the YouTube player may take seconds (or be blocked); the visitor must not wait.
      music.enable().catch(() => {});
      music.play();
    }
    emit();
  }

  function stop() {
    if (disposed) return;
    music.disable();
    if (ctx && started) {
      try {
        ambience.stop();
        ramp(nodes.fade.gain, 0.0001, 0.4);
        if (suspendTimer !== null) clearTimeout(suspendTimer);
        suspendTimer = setTimeout(() => {
          suspendTimer = null;
          if (ctx && !started) ctx.suspend().catch(() => {});
        }, 600);
      } catch { /* context already closed */ }
    }
    started = false;
    emit();
  }

  function sfx(name, opts) {
    if (!started || !sfxEnabled || !sfxApi || !ctx || ctx.state === "closed") return;
    try { sfxApi.play(name, opts || {}); } catch { /* never throws */ }
  }

  function setSfxEnabled(value) {
    sfxEnabled = !!value;
    if (ctx && nodes) { try { ramp(nodes.sfxBus.gain, sfxEnabled ? 0.9 : 0, 0.08); } catch { /* ignore */ } }
    emit();
  }

  function setAmbienceEnabled(value) {
    ambienceEnabled = !!value;
    if (ambience && started) {
      if (ambienceEnabled) ambience.start();
      else ambience.stop();
    }
    emit();
  }

  function setMasterVolume(v) {
    master = clamp01(v);
    if (ctx && nodes) { try { ramp(nodes.master.gain, master, 0.08); } catch { /* ignore */ } }
    emit();
  }

  function on(eventName, cb) {
    if (eventName !== "change" || typeof cb !== "function") return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function dispose() {
    if (disposed) return;
    if (suspendTimer !== null) { clearTimeout(suspendTimer); suspendTimer = null; }
    offMusic();
    music.dispose();
    if (ambience) ambience.dispose();
    if (nodes) {
      for (const node of Object.values(nodes)) { try { node.disconnect(); } catch { /* noop */ } }
    }
    if (ctx) { try { ctx.close().catch(() => {}); } catch { /* noop */ } }
    ctx = null; nodes = null; sfxApi = null; ambience = null;
    started = false;
    disposed = true;
    listeners.clear();
  }

  return {
    start, stop, sfx, setSfxEnabled, setAmbienceEnabled,
    setMasterVolume, getMasterVolume: () => master,
    music, getState, on, dispose
  };
}
