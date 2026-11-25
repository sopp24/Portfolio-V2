// Procedural PBR texture sets (albedo + normal + roughness) for the store's materials.
// Everything is generated on the fly: no image downloads, tiny payload, fully original.
import * as THREE from "three";
import {
  rng, fbmField, noiseField, normalFromHeight, canvasFromImageData, grayCanvas, textureFrom, createCanvas
} from "./util.js";

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

function packSet(albedoData, height, roughnessField, size, { normalStrength = 2, anisotropy = 8, name = "set" } = {}) {
  const map = textureFrom(canvasFromImageData(albedoData, size), { srgb: true, anisotropy });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, normalStrength), size), { srgb: false, anisotropy });
  const roughnessMap = textureFrom(grayCanvas(roughnessField, size), { srgb: false, anisotropy });
  map.name = name + "-albedo"; normalMap.name = name + "-normal"; roughnessMap.name = name + "-rough";
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// WOOD — stained oak / pine boards with grain, rings, knots, seams
// ---------------------------------------------------------------------------------------------
export function woodSet(size, { seed = 3, tones = ["#6a4426", "#9a6b3f"], boards = 4, gap = .006, knots = 4, name = "wood", grainContrast = 1 } = {}) {
  const rand = rng(seed);
  const dark = rgb(tones[0]), light = rgb(tones[1]);
  const streak = fbmField(size, { octaves: 4, period: 2, seed: seed + 1, aspectX: 1, aspectY: 28 });
  const warp = fbmField(size, { octaves: 3, period: 2, seed: seed + 2, aspectX: 1, aspectY: 3 });
  const fine = fbmField(size, { octaves: 3, period: 24, seed: seed + 3, aspectX: 1, aspectY: 80 });
  const blotch = fbmField(size, { octaves: 3, period: 3, seed: seed + 4 });
  const boardH = size / boards;
  const boardTone = Array.from({ length: boards }, () => rand.range(-.16, .16));
  const boardShift = Array.from({ length: boards }, () => rand() * size);
  const knotList = Array.from({ length: knots }, () => ({ x: rand() * size, y: rand() * size, r: rand.range(.018, .04) * size }));
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const b = Math.min(boards - 1, Math.floor(y / boardH));
    const local = (y - b * boardH) / boardH;
    const seam = Math.min(local, 1 - local) * boardH;
    const seamW = Math.max(1.2, gap * size);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const xs = (x + boardShift[b]) % size;
      const j = y * size + Math.floor(xs);
      const rings = Math.sin((local * 9.5 + warp[j] * 7.5 + streak[j] * 2.5) * Math.PI * 2);
      let t = .5 + .22 * rings * grainContrast + (streak[j] - .5) * .85 * grainContrast + (fine[j] - .5) * .35 + boardTone[b] + (blotch[i] - .5) * .25;
      // knots
      let knot = 0;
      for (const k of knotList) {
        const dx = (x - k.x + size * 1.5) % size - size * .5, dy = (y - k.y + size * 1.5) % size - size * .5;
        const d = Math.hypot(dx * .55, dy) / k.r;
        if (d < 1.6) knot = Math.max(knot, 1 - d / 1.6);
      }
      t -= knot * .35 + (knot > 0 ? Math.sin(knot * 28) * .05 : 0);
      t = Math.min(1, Math.max(0, t));
      const color = mix3(dark, light, t);
      const seamDark = seam < seamW ? 1 - seam / seamW : 0;
      const k = 1 - seamDark * .72;
      data[i * 4] = color[0] * k; data[i * 4 + 1] = color[1] * k; data[i * 4 + 2] = color[2] * k; data[i * 4 + 3] = 255;
      height[i] = .5 + (streak[j] - .5) * .22 + rings * .035 + (fine[j] - .5) * .1 - seamDark * .8 - knot * .08;
      rough[i] = Math.min(1, Math.max(.3, .62 + (fine[j] - .5) * .3 + seamDark * .3 - (t - .5) * .12));
    }
  }
  return packSet(data, height, rough, size, { normalStrength: 2.4, name });
}

// ---------------------------------------------------------------------------------------------
// PLASTER / PAINT — neutral mottled wall, tinted through material.color
// ---------------------------------------------------------------------------------------------
export function plasterSet(size, { seed = 11, name = "plaster", roughness = .92, bump = 1 } = {}) {
  const blotch = fbmField(size, { octaves: 5, period: 3, seed });
  const fine = fbmField(size, { octaves: 3, period: 40, seed: seed + 5, gain: .6 });
  const trowel = fbmField(size, { octaves: 3, period: 5, seed: seed + 9, aspectX: 3, aspectY: 1 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rand = rng(seed + 2);
  for (let i = 0; i < size * size; i++) {
    const v = 232 + (blotch[i] - .5) * 36 + (fine[i] - .5) * 18 - Math.max(0, trowel[i] - .62) * 40;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v - 2; data[i * 4 + 3] = 255;
    height[i] = (fine[i] * .7 + trowel[i] * .5 + blotch[i] * .15) * bump;
    rough[i] = roughness + (fine[i] - .5) * .1;
  }
  // a few scuffs and chips
  const canvas = canvasFromImageData(data, size);
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  for (let n = 0; n < size / 6; n++) {
    ctx.strokeStyle = rand() < .5 ? "rgba(70,60,48,.07)" : "rgba(255,255,255,.08)";
    ctx.lineWidth = rand.range(.5, 1.6);
    ctx.beginPath();
    const x = rand() * size, y = rand() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand.range(-24, 24), y + rand.range(-18, 18));
    ctx.stroke();
  }
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 1.8), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// FLOOR — 90s checker linoleum, worn path, scuffs, rubber marks (8 x 8 tiles per texture)
// ---------------------------------------------------------------------------------------------
export function checkerFloorSet(size, { seed = 21, a = "#1f3a3a", b = "#d9c9a3", tiles = 8, name = "floor" } = {}) {
  const rand = rng(seed);
  const colorA = rgb(a), colorB = rgb(b);
  const mottle = fbmField(size, { octaves: 5, period: 6, seed: seed + 1 });
  const fine = fbmField(size, { octaves: 3, period: 60, seed: seed + 2, gain: .6 });
  const tile = size / tiles;
  const tileTone = Array.from({ length: tiles * tiles }, () => rand.range(-.06, .06));
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const ty = Math.floor(y / tile);
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / tile);
      const i = y * size + x;
      const dark = (tx + ty) % 2 === 0;
      const base = dark ? colorA : colorB;
      const tone = 1 + tileTone[ty * tiles + tx] + (mottle[i] - .5) * .22 + (fine[i] - .5) * .08;
      const edge = Math.min((x % tile), (y % tile), tile - (x % tile), tile - (y % tile));
      const chamfer = edge < 1.4 ? .55 : edge < 2.6 ? .85 : 1;
      data[i * 4] = base[0] * tone * chamfer; data[i * 4 + 1] = base[1] * tone * chamfer; data[i * 4 + 2] = base[2] * tone * chamfer; data[i * 4 + 3] = 255;
      height[i] = .5 + (fine[i] - .5) * .1 - (edge < 2 ? .5 : 0);
      rough[i] = .4 + (mottle[i] - .5) * .35 + (dark ? .06 : 0);
    }
  }
  const canvas = canvasFromImageData(data, size);
  const ctx = canvas.getContext("2d");
  // scuffs: short pale arcs on dark tiles, dark rubber streaks on light tiles
  for (let n = 0; n < size * .55; n++) {
    const x = rand() * size, y = rand() * size;
    const dark = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
    ctx.strokeStyle = dark ? `rgba(215,205,185,${rand.range(.03, .12)})` : `rgba(40,32,26,${rand.range(.04, .14)})`;
    ctx.lineWidth = rand.range(.6, 2.2);
    ctx.beginPath();
    const a0 = rand() * 6.28;
    ctx.arc(x, y, rand.range(6, 40), a0, a0 + rand.range(.4, 1.4));
    ctx.stroke();
  }
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 1.5), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// ACOUSTIC CEILING TILE — fissured mineral board, 2 x 2 tiles
// ---------------------------------------------------------------------------------------------
export function ceilingTileSet(size, { seed = 31, name = "ceiling" } = {}) {
  const rand = rng(seed);
  const base = fbmField(size, { octaves: 4, period: 8, seed });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    const gap = e < 2.5 ? 1 : 0;
    const v = 228 + (base[i] - .5) * 40 - gap * 120;
    data[i * 4] = v; data[i * 4 + 1] = v - 1; data[i * 4 + 2] = v - 6; data[i * 4 + 3] = 255;
    height[i] = .6 + (base[i] - .5) * .4 - gap * .7;
    rough[i] = .95;
  }
  const canvas = canvasFromImageData(data, size);
  const ctx = canvas.getContext("2d");
  const pits = Math.floor(size * size / 90);
  for (let n = 0; n < pits; n++) {
    const x = rand() * size, y = rand() * size;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    if (e < 6) continue;
    ctx.fillStyle = `rgba(88,80,68,${rand.range(.18, .45)})`;
    ctx.fillRect(x, y, rand.range(1, 3.4), rand.range(.8, 1.8));
  }
  // faint stains
  for (let n = 0; n < 6; n++) {
    const gradient = ctx.createRadialGradient(rand() * size, rand() * size, 4, rand() * size, rand() * size, rand.range(30, 90));
    gradient.addColorStop(0, "rgba(150,120,70,.07)"); gradient.addColorStop(1, "rgba(150,120,70,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  }
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 3), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// BRUSHED METAL, CARDBOARD, FABRIC, RUBBER — small neutral sets tinted by material.color
// ---------------------------------------------------------------------------------------------
export function brushedMetalSet(size, { seed = 41 } = {}) {
  const streak = fbmField(size, { octaves: 4, period: 2, seed, aspectX: 1, aspectY: 120 });
  const blotch = fbmField(size, { octaves: 3, period: 4, seed: seed + 3 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 190 + (streak[i] - .5) * 60 + (blotch[i] - .5) * 30;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = streak[i] * .4;
    rough[i] = .34 + (streak[i] - .5) * .22 + (blotch[i] - .5) * .12;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.2, name: "metal" });
}

export function cardboardSet(size, { seed = 51 } = {}) {
  const fibre = fbmField(size, { octaves: 5, period: 6, seed, aspectX: 3, aspectY: 1 });
  const fine = fbmField(size, { octaves: 3, period: 50, seed: seed + 2 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 218 + (fibre[i] - .5) * 40 + (fine[i] - .5) * 24;
    data[i * 4] = v; data[i * 4 + 1] = v - 6; data[i * 4 + 2] = v - 20; data[i * 4 + 3] = 255;
    height[i] = fibre[i] * .6 + fine[i] * .4;
    rough[i] = .9 + (fine[i] - .5) * .1;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.4, name: "cardboard" });
}

export function fabricSet(size, { seed = 61, weave = 64 } = {}) {
  const fine = fbmField(size, { octaves: 3, period: 30, seed });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const cell = size / weave;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const warp = Math.sin((x / cell) * Math.PI * 2) * .5 + .5;
    const weft = Math.sin((y / cell) * Math.PI * 2) * .5 + .5;
    const over = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
    const h = over ? warp : weft;
    const v = 200 + h * 36 + (fine[i] - .5) * 30;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = h * .6 + fine[i] * .2;
    rough[i] = .93;
  }
  return packSet(data, height, rough, size, { normalStrength: 2.2, name: "fabric" });
}

export function rubberSet(size, { seed = 71 } = {}) {
  const fine = fbmField(size, { octaves: 4, period: 30, seed });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 120 + (fine[i] - .5) * 40;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = fine[i];
    rough[i] = .75 + (fine[i] - .5) * .2;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.6, name: "rubber" });
}

// Concrete / asphalt for the pavement outside the window.
export function pavementSet(size, { seed = 81 } = {}) {
  const blotch = fbmField(size, { octaves: 5, period: 4, seed });
  const fine = fbmField(size, { octaves: 3, period: 70, seed: seed + 1, gain: .65 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    const gap = e < 2 ? 1 : 0;
    const v = 150 + (blotch[i] - .5) * 60 + (fine[i] - .5) * 36 - gap * 70;
    data[i * 4] = v; data[i * 4 + 1] = v - 2; data[i * 4 + 2] = v - 8; data[i * 4 + 3] = 255;
    height[i] = fine[i] * .6 - gap * .6;
    rough[i] = .86;
  }
  return packSet(data, height, rough, size, { normalStrength: 2, name: "pavement" });
}

// ---------------------------------------------------------------------------------------------
// Utility sprites / gradients
// ---------------------------------------------------------------------------------------------
export function softDotTexture(size = 64) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(.35, "rgba(255,255,255,.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return textureFrom(canvas, { srgb: true, repeat: false, mipmaps: false });
}

// Light-shaft ribbon: soft along its width, fading along its length, with drifting streaks.
export function shaftTexture(width = 128, height = 512, seed = 5) {
  const rand = rng(seed);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(width, height);
  const streak = noiseField(Math.max(width, height), 8, seed, 1, 1);
  const size = Math.max(width, height);
  for (let y = 0; y < height; y++) {
    const along = y / (height - 1);
    const longFade = Math.pow(1 - along, 1.15) * Math.min(1, along * 12);
    for (let x = 0; x < width; x++) {
      const across = Math.abs(x / (width - 1) - .5) * 2;
      const edge = Math.pow(Math.max(0, 1 - across * across), 1.4);
      const n = .55 + .45 * streak[Math.floor(y / height * (size - 1)) * size + Math.floor(x / width * (size - 1))];
      const a = edge * longFade * n;
      const i = (y * width + x) * 4;
      image.data[i] = 255; image.data[i + 1] = 236; image.data[i + 2] = 205; image.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  void rand;
  return textureFrom(canvas, { srgb: true, repeat: false });
}

// Soft rectangular contact-shadow / ambient-occlusion decal (alpha only).
export function softRectTexture(size = 128, inset = .18, blur = .16) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#000";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = size * blur;
  const pad = size * inset;
  // Draw far off-canvas and offset the shadow back in: works without ctx.filter (Safari).
  ctx.shadowOffsetX = size * 3;
  ctx.fillRect(pad - size * 3, pad, size - pad * 2, size - pad * 2);
  return textureFrom(canvas, { srgb: false, repeat: false, mipmaps: false });
}

export function verticalGradientTexture(stops, height = 256) {
  const canvas = createCanvas(4, height);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, height);
  return textureFrom(canvas, { srgb: true, repeat: false });
}

export { THREE };
