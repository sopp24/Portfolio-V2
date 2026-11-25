let context = null;
let masterGain = null;
let ambientSources = [];
let enabled = false;
let sharedNoiseBuffer = null;

function getContext() {
  if (context) return context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  context = new AudioContextClass();
  masterGain = context.createGain();
  masterGain.gain.value = .72;
  masterGain.connect(context.destination);
  return context;
}

function getNoiseBuffer(ctx) {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) return sharedNoiseBuffer;
  const length = Math.floor(ctx.sampleRate * 1.6);
  sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = sharedNoiseBuffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    previous = previous * .84 + white * .16;
    data[i] = previous * .7;
  }
  return sharedNoiseBuffer;
}

function stopAmbient() {
  for (const source of ambientSources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  ambientSources = [];
}

function startAmbient(ctx) {
  if (ambientSources.length) return;
  const low = ctx.createOscillator();
  const lowGain = ctx.createGain();
  low.type = "sine";
  low.frequency.value = 58;
  lowGain.gain.value = .008;
  low.connect(lowGain).connect(masterGain);
  low.start();

  const hum = ctx.createOscillator();
  const humGain = ctx.createGain();
  hum.type = "triangle";
  hum.frequency.value = 116;
  humGain.gain.value = .0016;
  hum.connect(humGain).connect(masterGain);
  hum.start();

  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = getNoiseBuffer(ctx);
  noise.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 980;
  noiseGain.gain.value = .006;
  noise.connect(filter).connect(noiseGain).connect(masterGain);
  noise.start();

  ambientSources = [low, hum, noise];
}

function tone(first, last, duration, peak, type = "triangle", delay = 0) {
  if (!enabled || !context || context.state !== "running") return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(first, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, last), start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(.012, duration * .22));
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + .01);
}

export function createStoreAudio() {
  return {
    isEnabled: () => enabled,
    async setEnabled(value) {
      if (!value) {
        enabled = false;
        stopAmbient();
        return false;
      }
      const ctx = getContext();
      if (!ctx) return false;
      try {
        await ctx.resume();
        if (ctx.state !== "running") return false;
        enabled = true;
        startAmbient(ctx);
        return true;
      } catch {
        enabled = false;
        stopAmbient();
        return false;
      }
    },
    playCue(kind) {
      if (!enabled) return;
      switch (kind) {
        case "pickup": tone(190, 132, .105, .018, "triangle"); break;
        case "flip": tone(430, 250, .075, .012, "sawtooth"); break;
        case "sleeve": tone(320, 205, .095, .014, "triangle"); break;
        case "return": tone(125, 78, .15, .022, "sine"); break;
        case "focus": tone(510, 680, .055, .006, "sine"); break;
        case "greeting":
          tone(392, 440, .16, .009, "sine");
          tone(523, 587, .19, .007, "sine", .12);
          break;
        case "easter":
          tone(660, 660, .12, .014, "sine");
          tone(880, 880, .18, .012, "sine", .10);
          tone(990, 990, .22, .009, "sine", .22);
          break;
      }
    },
    dispose() {
      enabled = false;
      stopAmbient();
      if (context && context.state !== "closed") context.close().catch(() => {});
      context = null;
      masterGain = null;
      sharedNoiseBuffer = null;
    }
  };
}
