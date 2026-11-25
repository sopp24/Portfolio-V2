// Synthesized sound effects. No audio files: everything is generated with the Web Audio API,
// so the effects are original and license-free. Every effect is randomized slightly on each play.
//
// `createSfx(ctx, out)` works with any BaseAudioContext (live or Offline), which keeps it testable.

const MAX_VOICES = 70;
const rnd = (a, b) => a + Math.random() * (b - a);
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const pos = (v, fallback = 0.0001) => Math.max(0.0001, num(v, fallback));

const noiseCache = new WeakMap();

/** Shared 3 s white-noise buffer per context (also used by ambience.js). */
export function getNoiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (buffer) return buffer;
  const length = Math.floor(ctx.sampleRate * 3);
  buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

function freq(v, f) {
  const nyquist = v.ctx.sampleRate / 2 - 200;
  return Math.min(nyquist, Math.max(20, num(f, 1000) * v.r));
}

function release(v, nodes) {
  v.count.n++;
  const last = nodes[0];
  last.onended = () => {
    v.count.n--;
    for (const node of nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
  };
}

/** Filtered noise burst. o: { f, f2, type, q, dur, peak, attack, shape: 'decay'|'swell' } */
function noiseBurst(v, t, o) {
  if (v.count.n > MAX_VOICES) return;
  const { ctx } = v;
  const dur = pos(o.dur, 0.05);
  const peak = pos(num(o.peak, 0.1) * v.g);
  const attack = Math.min(pos(o.attack, 0.003), dur * 0.6);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.type || "bandpass";
  filter.frequency.setValueAtTime(freq(v, o.f), t);
  if (o.f2) filter.frequency.exponentialRampToValueAtTime(freq(v, o.f2), t + dur);
  filter.Q.value = num(o.q, 0.8);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  if (o.shape === "swell") {
    gain.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
  } else {
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  src.connect(filter);
  filter.connect(gain);
  gain.connect(v.out);
  src.start(t, rnd(0, 1.4), dur + 0.05);
  release(v, [src, filter, gain]);
}

/** Oscillator tone with exponential decay. o: { f, f2, type, dur, peak, attack, lp } */
function tone(v, t, o) {
  if (v.count.n > MAX_VOICES) return;
  const { ctx } = v;
  const dur = pos(o.dur, 0.2);
  const peak = pos(num(o.peak, 0.1) * v.g);
  const attack = Math.min(pos(o.attack, 0.004), dur * 0.6);
  const osc = ctx.createOscillator();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(freq(v, o.f), t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(freq(v, o.f2), t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const nodes = [osc, gain];
  if (o.lp) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = freq(v, o.lp);
    osc.connect(lp);
    lp.connect(gain);
    nodes.push(lp);
  } else osc.connect(gain);
  gain.connect(v.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  release(v, nodes);
}

/** Small metallic bell: inharmonic partials with shorter decay for the upper ones. */
function bell(v, t, o) {
  const ratios = o.ratios || [1, 2.76, 5.4];
  const amps = [1, 0.5, 0.22];
  ratios.forEach((ratio, i) => {
    tone(v, t, { f: o.f * ratio, dur: o.dur / (1 + i * 0.7), peak: o.peak * amps[i % 3], attack: 0.002 });
  });
}

function rustle(v, t, count, span, o) {
  for (let i = 0; i < count; i++) {
    noiseBurst(v, t + rnd(0, span), {
      type: "bandpass", f: rnd(o.lo, o.hi), q: rnd(0.5, 2.5), dur: rnd(0.02, 0.09),
      peak: o.peak * rnd(0.3, 1), attack: 0.004
    });
  }
}

function thud(v, t, size = 1) {
  tone(v, t, { f: 95, f2: 50, dur: 0.18, peak: 0.34 * size, attack: 0.003 });
  noiseBurst(v, t, { type: "lowpass", f: 320, q: 0.6, dur: 0.09, peak: 0.2 * size, attack: 0.002 });
}

const DEFS = {
  hover(v, t) {
    noiseBurst(v, t, { type: "highpass", f: 5200, q: 0.7, dur: 0.03, peak: 0.05, attack: 0.002 });
  },
  click(v, t) {
    tone(v, t, { f: 1800, f2: 900, dur: 0.045, peak: 0.12, attack: 0.001 });
    noiseBurst(v, t, { type: "bandpass", f: 3200, q: 1.2, dur: 0.02, peak: 0.12, attack: 0.001 });
  },
  "vinyl-pull"(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 800, f2: 2800, q: 1.1, dur: 0.38, peak: 0.34, shape: "swell" });
    for (let i = 0; i < 3; i++) noiseBurst(v, t + rnd(0.05, 0.3), { type: "highpass", f: 4000, dur: 0.012, peak: 0.08 });
    thud(v, t + 0.34, 0.7);
  },
  "vinyl-return"(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 2800, f2: 800, q: 1.1, dur: 0.34, peak: 0.3, shape: "swell" });
    thud(v, t + 0.3, 0.9);
  },
  flip(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 500, f2: 2400, q: 0.9, dur: 0.14, peak: 0.34, shape: "swell" });
    noiseBurst(v, t + 0.12, { type: "bandpass", f: 2400, f2: 700, q: 0.9, dur: 0.15, peak: 0.28, shape: "swell" });
    noiseBurst(v, t + 0.27, { type: "bandpass", f: 2200, q: 1.5, dur: 0.02, peak: 0.16 });
  },
  "sleeve-open"(v, t) {
    rustle(v, t, 8, 0.7, { lo: 1500, hi: 4200, peak: 0.34 });
    noiseBurst(v, t, { type: "bandpass", f: 420, f2: 300, q: 1.4, dur: 0.38, peak: 0.26, shape: "swell" });
  },
  "sleeve-close"(v, t) {
    rustle(v, t, 5, 0.38, { lo: 1400, hi: 3600, peak: 0.3 });
    noiseBurst(v, t + 0.4, { type: "bandpass", f: 700, q: 1.2, dur: 0.05, peak: 0.26 });
  },
  "disc-slide"(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 2000, f2: 4500, q: 0.8, dur: 0.55, peak: 0.2, shape: "swell" });
    noiseBurst(v, t + 0.04, { type: "highpass", f: 6500, dur: 0.5, peak: 0.07, shape: "swell" });
    rustle(v, t, 4, 0.45, { lo: 2500, hi: 5000, peak: 0.1 });
  },
  "needle-drop"(v, t) {
    tone(v, t, { f: 72, f2: 40, dur: 0.28, peak: 0.42, attack: 0.003 });
    noiseBurst(v, t, { type: "lowpass", f: 220, dur: 0.22, peak: 0.25, attack: 0.002 });
    const pops = Math.floor(rnd(12, 20));
    for (let i = 0; i < pops; i++) {
      noiseBurst(v, t + 0.06 + rnd(0, 0.7), { type: "bandpass", f: rnd(2200, 4200), q: 1.2, dur: rnd(0.004, 0.012), peak: rnd(0.05, 0.22), attack: 0.001 });
    }
    noiseBurst(v, t + 0.1, { type: "lowpass", f: 130, dur: 1.1, peak: 0.12, shape: "swell" });
  },
  "door-open"(v, t) {
    tone(v, t, { f: 900, f2: 420, dur: 0.03, peak: 0.14, attack: 0.001 });
    noiseBurst(v, t, { type: "bandpass", f: 1500, q: 1.5, dur: 0.03, peak: 0.3 });
    noiseBurst(v, t + 0.06, { type: "bandpass", f: 1100, q: 1.5, dur: 0.04, peak: 0.26 });
    const strikes = Math.floor(rnd(4, 6));
    let at = t + 0.14;
    for (let i = 0; i < strikes; i++) {
      bell(v, at, { f: rnd(2300, 3300), dur: Math.max(0.3, 0.9 - i * 0.12), peak: 0.1 * (1 - i * 0.1), ratios: [1, 2.7, 5.2] });
      at += rnd(0.07, 0.14);
    }
  },
  "door-close"(v, t) {
    thud(v, t, 1);
    noiseBurst(v, t, { type: "bandpass", f: 900, q: 1, dur: 0.05, peak: 0.24 });
    bell(v, t + 0.05, { f: rnd(2400, 3000), dur: 0.35, peak: 0.05, ratios: [1, 2.7, 5.2] });
    bell(v, t + 0.14, { f: rnd(2600, 3200), dur: 0.25, peak: 0.03, ratios: [1, 2.7, 5.2] });
  },
  "neon-on"(v, t) {
    const ticks = [0, 0.08, 0.15, 0.3, 0.38, 0.5];
    for (const dt of ticks) {
      noiseBurst(v, t + dt, { type: "highpass", f: 3000, dur: 0.015, peak: 0.28, attack: 0.001 });
      tone(v, t + dt, { f: 100, type: "sawtooth", dur: 0.045, peak: 0.07, lp: 500, attack: 0.002 });
    }
    // Rising buzz that settles into a faint steady hum, then fades (the ambience takes over).
    const { ctx } = v;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq(v, 100);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = freq(v, 520);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.setValueAtTime(0.0001, t + 0.55);
    gain.gain.linearRampToValueAtTime(pos(0.04 * v.g), t + 0.72);
    gain.gain.exponentialRampToValueAtTime(pos(0.012 * v.g), t + 1.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(v.out);
    osc.start(t + 0.5);
    osc.stop(t + 1.55);
    release(v, [osc, lp, gain]);
  },
  "lights-on"(v, t) {
    tone(v, t, { f: 140, f2: 70, dur: 0.12, peak: 0.28, attack: 0.002 });
    noiseBurst(v, t, { type: "bandpass", f: 2500, q: 1.2, dur: 0.02, peak: 0.28 });
    for (const dt of [0.1, 0.2, 0.28]) {
      noiseBurst(v, t + dt, { type: "highpass", f: 3500, dur: 0.012, peak: 0.2 });
      tone(v, t + dt, { f: 100, type: "sawtooth", dur: 0.06, peak: 0.09, lp: 600 });
    }
    tone(v, t + 0.36, { f: 100, type: "sawtooth", dur: 0.7, peak: 0.05, lp: 480, attack: 0.1 });
  },
  register(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 3000, q: 1.5, dur: 0.04, peak: 0.34 });
    tone(v, t + 0.03, { f: 220, f2: 120, dur: 0.09, peak: 0.2 });
    noiseBurst(v, t + 0.12, { type: "lowpass", f: 700, f2: 1500, q: 0.8, dur: 0.26, peak: 0.3, shape: "swell" });
    bell(v, t + 0.1, { f: 2200, dur: 0.9, peak: 0.12, ratios: [1, 1.5, 2.76] });
    thud(v, t + 0.4, 0.5);
  },
  "cat-tap"(v, t) {
    tone(v, t, { f: 3200, dur: 0.04, peak: 0.12, attack: 0.001 });
    bell(v, t, { f: rnd(2700, 2900), dur: 0.32, peak: 0.07, ratios: [1, 2.4, 4.6] });
  },
  secret(v, t) {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const at = t + i * 0.14;
      tone(v, at, { f, dur: 1.1, peak: 0.12, attack: 0.006 });
      tone(v, at, { f: f * 2, type: "triangle", dur: 0.7, peak: 0.04, attack: 0.006 });
    });
    tone(v, t + 0.42, { f: 1046.5, dur: 1.0, peak: 0.05, attack: 0.01 });
  },
  paper(v, t) {
    rustle(v, t, 4, 0.32, { lo: 2200, hi: 5200, peak: 0.28 });
  },
  page(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 2000, f2: 4500, q: 0.9, dur: 0.18, peak: 0.28, shape: "swell" });
    rustle(v, t + 0.12, 3, 0.12, { lo: 3000, hi: 5500, peak: 0.12 });
  },
  "chat-open"(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 3500, q: 1.5, dur: 0.012, peak: 0.12 });
    bell(v, t, { f: 1760, dur: 0.7, peak: 0.12, ratios: [1, 2.76, 4.2] });
  },
  "chat-message"(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 2500, q: 1.4, dur: 0.015, peak: 0.2 });
    tone(v, t, { f: 600, f2: 300, dur: 0.03, peak: 0.07, attack: 0.001 });
  },
  error(v, t) {
    tone(v, t, { f: 90, f2: 60, dur: 0.22, peak: 0.24, attack: 0.004 });
    noiseBurst(v, t, { type: "lowpass", f: 250, dur: 0.1, peak: 0.14 });
  },
  zoom(v, t) {
    noiseBurst(v, t, { type: "bandpass", f: 700, f2: 1200, q: 0.8, dur: 0.25, peak: 0.07, shape: "swell" });
  }
};

export const SFX_NAMES = Object.keys(DEFS);

const MIN_GAP = { hover: 0.07, "chat-message": 0.03 };

export function createSfx(ctx, out) {
  const count = { n: 0 };
  const last = new Map();

  function play(name, opts = {}) {
    const def = DEFS[name];
    if (!def || !ctx || !out) return false;
    try {
      const now = ctx.currentTime;
      const gap = MIN_GAP[name] ?? 0.025;
      if (now - (last.get(name) ?? -1) < gap) return false;
      last.set(name, now);
      const v = {
        ctx, out, count,
        g: pos(num(opts.gain, 1), 1),
        r: pos(num(opts.rate, 1), 1) * rnd(0.94, 1.06)
      };
      def(v, now + 0.005);
      return true;
    } catch (error) {
      return false;
    }
  }

  return { play, has: (name) => name in DEFS, names: SFX_NAMES };
}
