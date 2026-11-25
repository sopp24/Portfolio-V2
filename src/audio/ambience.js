// Shop ambience: room tone, electrical hum, muffled street with occasional car pass-bys,
// a quiet vinyl-crackle bed and rare wood creaks. Everything is synthesized and scheduled on the
// AudioContext clock by one lightweight look-ahead scheduler (a single timeout chain).

import { getNoiseBuffer } from "./sfx.js";

const rnd = (a, b) => a + Math.random() * (b - a);

function makeBrownNoise(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  // Short crossfade so the loop point is inaudible.
  const fade = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    data[length - fade + i] = data[length - fade + i] * (1 - k) + data[i] * k;
  }
  return buffer;
}

function makeCrackleBed(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.02; // surface hiss
  const pops = Math.floor(seconds * rnd(4, 7));
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(Math.random() * (length - 400));
    const amp = (Math.random() < 0.12 ? rnd(0.35, 0.6) : rnd(0.05, 0.25)) * (Math.random() < 0.5 ? -1 : 1);
    const size = Math.floor(rnd(6, 60));
    for (let i = 0; i < size; i++) data[at + i] += amp * Math.exp(-i / (size * 0.3)) * (i % 2 ? 1 : -0.6);
  }
  return buffer;
}

export function createAmbience(ctx, destination) {
  let running = false;
  let fadeGain = null;      // overall fade in/out
  let duckGain = null;      // ducks the whole bed while YouTube music plays
  let bedGain = null;       // crackle bed level (louder when there is no music)
  let nodes = [];           // persistent nodes to tear down
  let timer = null;
  let teardownTimer = null;
  let nextCar = 0;
  let nextCreak = 0;
  let musicActive = false;

  function track(...list) { nodes.push(...list); }

  function build() {
    const t = ctx.currentTime;
    fadeGain = ctx.createGain();
    fadeGain.gain.setValueAtTime(0.0001, t);
    fadeGain.gain.linearRampToValueAtTime(1, t + 2.2);
    duckGain = ctx.createGain();
    duckGain.gain.value = musicActive ? 0.55 : 1;
    duckGain.connect(fadeGain);
    fadeGain.connect(destination);
    track(fadeGain, duckGain);

    const brown = makeBrownNoise(ctx, 6);
    const loop = (buffer) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.start(t, Math.random() * (buffer.duration - 0.5));
      track(src);
      return src;
    };

    // Room tone.
    const room = loop(brown);
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = "lowpass"; roomLp.frequency.value = 520;
    const roomGain = ctx.createGain(); roomGain.gain.value = 0.05;
    room.connect(roomLp); roomLp.connect(roomGain); roomGain.connect(duckGain);
    track(roomLp, roomGain);

    // Electrical / fluorescent hum with slow drift (EU mains 50 Hz + harmonics).
    const humGain = ctx.createGain(); humGain.gain.value = 1; humGain.connect(duckGain);
    track(humGain);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.25;
    lfo.connect(lfoDepth);
    lfo.start(t);
    track(lfo, lfoDepth);
    [[50, 0.006], [100, 0.0035], [150, 0.0016], [300, 0.0006]].forEach(([f, level]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine"; osc.frequency.value = f;
      lfoDepth.connect(osc.frequency);
      const g = ctx.createGain(); g.gain.value = level;
      osc.connect(g); g.connect(humGain);
      osc.start(t);
      track(osc, g);
    });

    // Muffled street: low rumble with slow swell plus a thin hiss.
    const street = loop(brown);
    const streetLp = ctx.createBiquadFilter();
    streetLp.type = "lowpass"; streetLp.frequency.value = 300;
    const streetGain = ctx.createGain(); streetGain.gain.value = 0.034;
    const swell = ctx.createOscillator(); swell.frequency.value = 0.05;
    const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.011;
    swell.connect(swellDepth); swellDepth.connect(streetGain.gain);
    swell.start(t);
    street.connect(streetLp); streetLp.connect(streetGain); streetGain.connect(duckGain);
    track(streetLp, streetGain, swell, swellDepth);
    const hiss = loop(getNoiseBuffer(ctx));
    const hissLp = ctx.createBiquadFilter();
    hissLp.type = "lowpass"; hissLp.frequency.value = 1600;
    const hissGain = ctx.createGain(); hissGain.gain.value = 0.004;
    hiss.connect(hissLp); hissLp.connect(hissGain); hissGain.connect(duckGain);
    track(hissLp, hissGain);

    // Vinyl crackle bed: the shop's own quiet record when no music is playing.
    const bed = loop(makeCrackleBed(ctx, 8));
    const bedHp = ctx.createBiquadFilter();
    bedHp.type = "highpass"; bedHp.frequency.value = 350;
    bedGain = ctx.createGain();
    bedGain.gain.value = musicActive ? 0.03 : 0.3;
    bed.connect(bedHp); bedHp.connect(bedGain); bedGain.connect(duckGain);
    track(bedHp, bedGain);

    nextCar = t + rnd(4, 10);
    nextCreak = t + rnd(12, 30);
  }

  function disposeNode(node) {
    try { if (typeof node.stop === "function") node.stop(); } catch { /* not started or already stopped */ }
    try { node.disconnect(); } catch { /* already disconnected */ }
  }

  function scheduleTransient(build, duration) {
    const list = [];
    build(list);
    const first = list[0];
    if (first) first.onended = () => list.forEach((n) => { try { n.disconnect(); } catch { /* noop */ } });
    return duration;
  }

  function carPass(t) {
    const dur = rnd(3, 5.5);
    scheduleTransient((list) => {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.Q.value = 0.7;
      const f0 = rnd(180, 260);
      filter.frequency.setValueAtTime(f0, t);
      filter.frequency.linearRampToValueAtTime(f0 * 3.2, t + dur * 0.5);
      filter.frequency.linearRampToValueAtTime(f0 * 1.1, t + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(rnd(0.03, 0.055), t + dur * 0.48);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      let tail = gain;
      src.connect(filter); filter.connect(gain);
      list.push(src, filter, gain);
      if (typeof ctx.createStereoPanner === "function") {
        const pan = ctx.createStereoPanner();
        const side = Math.random() < 0.5 ? -1 : 1;
        pan.pan.setValueAtTime(0.7 * side, t);
        pan.pan.linearRampToValueAtTime(-0.7 * side, t + dur);
        gain.connect(pan); tail = pan;
        list.push(pan);
      }
      tail.connect(duckGain);
      src.start(t, rnd(0, 1.5), dur + 0.1);
    });
  }

  function creak(t) {
    const dur = rnd(0.5, 1.2);
    scheduleTransient((list) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const f = rnd(85, 140);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * rnd(0.85, 1.2), t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = rnd(260, 420); bp.Q.value = 8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.009, t + dur * 0.4);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(bp); bp.connect(gain); gain.connect(duckGain);
      osc.start(t); osc.stop(t + dur + 0.05);
      list.push(osc, bp, gain);
    });
  }

  function tick() {
    timer = null;
    if (!running) return;
    const horizon = ctx.currentTime + 1.5;
    while (nextCar < horizon) { carPass(Math.max(nextCar, ctx.currentTime)); nextCar += rnd(9, 26); }
    while (nextCreak < horizon) { creak(Math.max(nextCreak, ctx.currentTime)); nextCreak += rnd(18, 50); }
    timer = setTimeout(tick, 400);
  }

  function clearTimers() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }

  function teardown() {
    if (teardownTimer !== null) { clearTimeout(teardownTimer); teardownTimer = null; }
    clearTimers();
    for (const node of nodes) disposeNode(node);
    nodes = [];
    fadeGain = duckGain = bedGain = null;
  }

  return {
    start() {
      if (running) return;
      teardown();
      running = true;
      build();
      tick();
    },
    stop() {
      if (!running) return;
      running = false;
      clearTimers();
      if (fadeGain) {
        const t = ctx.currentTime;
        fadeGain.gain.cancelScheduledValues(t);
        fadeGain.gain.setValueAtTime(Math.max(0.0001, fadeGain.gain.value), t);
        fadeGain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
      }
      teardownTimer = setTimeout(teardown, 500);
    },
    /** Duck the bed while YouTube music plays; the crackle bed becomes nearly silent. */
    setMusicActive(active) {
      musicActive = !!active;
      if (!running || !ctx) return;
      const t = ctx.currentTime;
      duckGain.gain.cancelScheduledValues(t);
      duckGain.gain.setTargetAtTime(musicActive ? 0.55 : 1, t, 0.6);
      bedGain.gain.cancelScheduledValues(t);
      bedGain.gain.setTargetAtTime(musicActive ? 0.03 : 0.3, t, 0.8);
    },
    isRunning: () => running,
    dispose() { running = false; teardown(); }
  };
}
