// Shop music through the official YouTube IFrame Player API (privacy-enhanced host).
// Nothing is downloaded or re-hosted. Nothing loads until `enable()` is called from a user gesture path.

export const DEFAULT_VIDEO_ID = "RSXMwOvUui4"; // https://www.youtube.com/live/RSXMwOvUui4

const API_URL = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 10000;
const READY_TIMEOUT_MS = 15000;
const PLAYER_SIZE = 200; // YouTube policy: embedded players must be visible and at least 200×200.

let apiPromise = null;

function loadApi() {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.reject(new Error("no-dom"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let done = false;
    let script = null;
    let timer = null;
    const previous = window.onYouTubeIframeAPIReady;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) {
        apiPromise = null; // allow a later retry
        if (script && script.parentNode) script.parentNode.removeChild(script);
        reject(error);
      } else resolve(window.YT);
    };
    window.onYouTubeIframeAPIReady = () => {
      try { if (typeof previous === "function") previous(); } catch { /* ignore foreign callback errors */ }
      finish(null);
    };
    script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.onerror = () => finish(new Error("api-load-failed"));
    timer = setTimeout(() => finish(new Error("api-timeout")), API_TIMEOUT_MS);
    document.head.appendChild(script);
  });
  return apiPromise;
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const rnd = (a, b) => a + Math.random() * (b - a);

export function createYouTubeMusic({ videoId = DEFAULT_VIDEO_ID } = {}) {
  const listeners = new Set();
  const timers = new Set();
  let status = { state: "off", live: null, randomStart: null, title: null };
  let enabled = false;
  let wantPlay = false;
  let ready = false;
  let player = null;
  let wrapper = null;
  let target = null;
  let floating = false;
  let generation = 0;
  let volume = 0.55;
  let muted = false;
  let randomDone = false;     // one random start per visit (this object's lifetime)
  let buildPromise = Promise.resolve();
  let disposed = false;

  function emit() {
    for (const cb of [...listeners]) { try { cb(getStatus()); } catch { /* listener errors never break playback */ } }
  }
  function setState(patch) {
    const next = { ...status, ...patch };
    if (next.state === status.state && next.live === status.live && next.randomStart === status.randomStart && next.title === status.title) return;
    status = next;
    emit();
  }
  function getStatus() { return { ...status }; }
  function later(fn, ms) {
    const handle = setTimeout(() => { timers.delete(handle); fn(); }, ms);
    timers.add(handle);
    return handle;
  }
  function clearTimers() { for (const handle of timers) clearTimeout(handle); timers.clear(); }
  function call(fn) { try { return fn(); } catch { return undefined; } }

  function ensureWrapper() {
    if (wrapper || typeof document === "undefined") return;
    wrapper = document.createElement("div");
    wrapper.className = "music-player";
    wrapper.style.width = PLAYER_SIZE + "px";
    wrapper.style.height = PLAYER_SIZE + "px";
    wrapper.style.overflow = "hidden";
    resetTarget();
  }
  function resetTarget() {
    target = document.createElement("div");
    target.className = "music-player-target";
    wrapper.replaceChildren(target);
  }
  function attachFloatingIfNeeded() {
    if (!wrapper || wrapper.parentNode || typeof document === "undefined") return;
    floating = true;
    Object.assign(wrapper.style, { position: "fixed", left: "12px", bottom: "12px", zIndex: "5" });
    document.body.appendChild(wrapper);
  }
  function clearFloatingStyle() {
    if (!floating || !wrapper) return;
    floating = false;
    for (const key of ["position", "left", "bottom", "zIndex"]) wrapper.style[key] = "";
  }

  function teardownPlayer() {
    ready = false;
    if (player) {
      call(() => player.destroy());
      player = null;
    }
    if (wrapper) resetTarget();
  }

  function updateMeta() {
    if (!player || !ready) return;
    const data = call(() => player.getVideoData());
    const patch = {};
    if (data && typeof data.title === "string" && data.title) patch.title = data.title;
    if (data && data.isLive === true) patch.live = true;
    if (Object.keys(patch).length) setState(patch);
  }

  // --- Random start (once per visit) -------------------------------------------------------------
  function maybeRandomStart(gen) {
    if (randomDone) return;
    randomDone = true; // never re-run on later plays, even if this attempt fails
    let tries = 0;
    const attempt = () => {
      if (gen !== generation || !player || !ready) return;
      const data = call(() => player.getVideoData());
      const isLive = !!(data && data.isLive === true);
      const duration = Number(call(() => player.getDuration())) || 0;
      if (!(duration > 0) && tries < 8) { tries++; later(attempt, 500); return; }
      if (isLive) setState({ live: true });
      else if (duration > 0) setState({ live: false });
      const span = duration - 60;
      if (!(duration > 0)) { setState({ randomStart: "unavailable" }); return; }
      if (duration <= 120 || span <= 0) { setState({ randomStart: isLive ? "unavailable" : "not-applicable" }); return; }
      const targetTime = rnd(0, span);
      call(() => player.seekTo(targetTime, true));
      // Verify: never claim a random start that did not happen.
      later(() => {
        if (gen !== generation || !player) return;
        const now = Number(call(() => player.getCurrentTime()));
        const ok = Number.isFinite(now) && Math.abs(now - targetTime) < 45;
        setState({ randomStart: ok ? "applied" : "unavailable" });
      }, 2500);
    };
    later(attempt, 700);
  }

  // --- Player events ------------------------------------------------------------------------------
  function onStateChange(gen, event) {
    if (gen !== generation) return;
    const code = event && event.data;
    if (code === 1) {                // playing
      setState({ state: "playing" });
      updateMeta();
      maybeRandomStart(gen);
    } else if (code === 2) {         // paused
      setState({ state: "paused" });
    } else if (code === 3) {         // buffering
      if (status.state !== "playing") setState({ state: "loading" });
    } else if (code === 0) {         // ended
      setState({ state: "paused" });
    } else if (code === 5 || code === -1) {
      if (!(wantPlay && status.state === "loading")) setState({ state: wantPlay ? "loading" : "ready" });
    }
  }
  function onError(gen, event) {
    if (gen !== generation) return;
    const code = event && event.data;
    wantPlay = false;
    setState({ state: code === 101 || code === 150 ? "blocked" : "error" });
  }

  async function build(gen) {
    setState({ state: "loading" });
    let YT;
    try { YT = await loadApi(); } catch { if (gen === generation) setState({ state: "error" }); return; }
    if (gen !== generation || disposed) return;
    ensureWrapper();
    attachFloatingIfNeeded();
    await new Promise((resolve) => {
      let settled = false;
      const settle = () => { if (!settled) { settled = true; clearTimeout(guard); resolve(); } };
      const guard = setTimeout(() => {
        if (gen === generation && !ready) setState({ state: "error" });
        settle();
      }, READY_TIMEOUT_MS);
      const playerVars = { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, enablejsapi: 1 };
      if (/^https?:$/.test(location.protocol)) playerVars.origin = location.origin;
      try {
        player = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          width: PLAYER_SIZE, height: PLAYER_SIZE, videoId, playerVars,
          events: {
            onReady: () => {
              if (gen !== generation) { settle(); return; }
              ready = true;
              call(() => player.setVolume(Math.round(volume * 100)));
              call(() => (muted ? player.mute() : player.unMute()));
              updateMeta();
              setState({ state: wantPlay ? "loading" : "ready" });
              if (wantPlay) call(() => player.playVideo());
              settle();
            },
            onStateChange: (e) => onStateChange(gen, e),
            onError: (e) => { onError(gen, e); settle(); },
            onAutoplayBlocked: () => {
              if (gen !== generation) return;
              wantPlay = false;
              setState({ state: "paused" });
            }
          }
        });
      } catch {
        if (gen === generation) setState({ state: "error" });
        settle();
      }
    });
  }

  function start() {
    generation++;
    buildPromise = build(generation).catch(() => { /* build never throws; belt and braces */ });
    return buildPromise;
  }

  function rebuild() {
    const resume = status.state === "playing" || wantPlay;
    clearTimers();
    teardownPlayer();
    wantPlay = resume;
    return start();
  }

  const api = {
    enable() {
      if (disposed) return Promise.resolve();
      if (enabled) {
        if (status.state === "error" || status.state === "blocked") { clearTimers(); teardownPlayer(); return start(); }
        return buildPromise;
      }
      enabled = true;
      return start();
    },
    disable() {
      generation++;
      clearTimers();
      teardownPlayer();
      enabled = false;
      wantPlay = false;
      if (floating && wrapper && wrapper.parentNode) { wrapper.parentNode.removeChild(wrapper); floating = false; }
      setState({ state: "off", title: null });
    },
    play() {
      if (!enabled) return;
      wantPlay = true;
      if (ready && player) {
        if (status.state === "ready" || status.state === "paused") setState({ state: "loading" });
        call(() => player.playVideo());
      }
    },
    pause() {
      wantPlay = false;
      if (ready && player) call(() => player.pauseVideo());
    },
    toggle() { if (status.state === "playing") api.pause(); else api.play(); },
    setVolume(v) {
      volume = clamp01(v);
      if (ready && player) call(() => player.setVolume(Math.round(volume * 100)));
    },
    getVolume: () => volume,
    setMuted(value) {
      muted = !!value;
      if (ready && player) call(() => (muted ? player.mute() : player.unMute()));
    },
    isMuted: () => muted,
    isPlaying: () => status.state === "playing",
    isEnabled: () => enabled,
    getStatus,
    /** Put the visible player wrapper inside the UI's "radio" card. Call before enable() when possible:
     *  moving an iframe reloads it, so if a player already exists it is rebuilt (and resumed if it was playing). */
    mount(container) {
      if (disposed || !container || typeof document === "undefined") return;
      ensureWrapper();
      clearFloatingStyle();
      if (wrapper.parentNode !== container) {
        container.appendChild(wrapper);
        if (enabled && player) rebuild();
      }
    },
    on(eventName, cb) {
      if (eventName !== "change" || typeof cb !== "function") return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      api.disable();
      disposed = true;
      listeners.clear();
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      wrapper = null;
      target = null;
    }
  };
  return api;
}
