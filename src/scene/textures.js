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
// WOOD — stylised honey oak / birch boards: bold broad grain, soft rings, few knots, crisp seams (art direction v2: no muddy noise)
// ---------------------------------------------------------------------------------------------
export function woodSet(size, { seed = 3, tones = ["#6b3f1d", "#c98f50"], boards = 4, gap = .005, knots = 3, name = "wood", grainContrast = 1 } = {}) {
  const rand = rng(seed);
  const dark = rgb(tones[0]), light = rgb(tones[1]);
  const streak = fbmField(size, { octaves: 3, period: 2, seed: seed + 1, aspectX: 1, aspectY: 22 });
  const warp = fbmField(size, { octaves: 2, period: 2, seed: seed + 2, aspectX: 1, aspectY: 3 });
  const fine = fbmField(size, { octaves: 2, period: 18, seed: seed + 3, aspectX: 1, aspectY: 60 });
  const boardH = size / boards;
  const boardTone = Array.from({ length: boards }, () => rand.range(-.09, .09));
  const boardShift = Array.from({ length: boards }, () => rand() * size);
  const knotList = Array.from({ length: knots }, () => ({ x: rand() * size, y: rand() * size, r: rand.range(.016, .03) * size }));
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
      const rings = Math.sin((local * 7.5 + warp[j] * 6 + streak[j] * 2) * Math.PI * 2);
      let t = .55 + .13 * rings * grainContrast + (streak[j] - .5) * .55 * grainContrast + (fine[j] - .5) * .14 + boardTone[b];
      let knot = 0;
      for (const k of knotList) {
        const dx = (x - k.x + size * 1.5) % size - size * .5, dy = (y - k.y + size * 1.5) % size - size * .5;
        const d = Math.hypot(dx * .55, dy) / k.r;
        if (d < 1.5) knot = Math.max(knot, 1 - d / 1.5);
      }
      t -= knot * .26;
      t = Math.min(1, Math.max(0, t));
      const color = mix3(dark, light, t);
      const seamDark = seam < seamW ? 1 - seam / seamW : 0;
      const k = 1 - seamDark * .55;
      data[i * 4] = color[0] * k; data[i * 4 + 1] = color[1] * k; data[i * 4 + 2] = color[2] * k; data[i * 4 + 3] = 255;
      height[i] = .5 + (streak[j] - .5) * .12 + rings * .02 + (fine[j] - .5) * .05 - seamDark * .8 - knot * .05;
      rough[i] = Math.min(1, Math.max(.35, .52 + (fine[j] - .5) * .12 + seamDark * .3));
    }
  }
  return packSet(data, height, rough, size, { normalStrength: 1.6, name });
}

// ---------------------------------------------------------------------------------------------
// PLASTER / PAINT — near-flat paint with a whisper of roller texture, tinted through material.color
// ---------------------------------------------------------------------------------------------
export function plasterSet(size, { seed = 11, name = "plaster", roughness = .9, bump = 1 } = {}) {
  const blotch = fbmField(size, { octaves: 3, period: 3, seed });
  const fine = fbmField(size, { octaves: 2, period: 36, seed: seed + 5, gain: .55 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 244 + (blotch[i] - .5) * 12 + (fine[i] - .5) * 7;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v - 1; data[i * 4 + 3] = 255;
    height[i] = (fine[i] * .8 + blotch[i] * .12) * bump * .8;
    rough[i] = roughness + (fine[i] - .5) * .06;
  }
  const canvas = canvasFromImageData(data, size);
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 1.2), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// FLOOR — crisp graphic checker (8 x 8 tiles per texture), ink / cream with sparse palette accent tiles,
// sealed finish: uniform gloss, hairline bevels, no dirt
// ---------------------------------------------------------------------------------------------
export function checkerFloorSet(size, { seed = 21, a = "#1d2350", b = "#f3e8d0", tiles = 8, accents = [], name = "floor" } = {}) {
  const rand = rng(seed);
  const colorA = rgb(a), colorB = rgb(b);
  const accent = accents.map(rgb);
  const mottle = fbmField(size, { octaves: 2, period: 4, seed: seed + 1 });
  const tile = size / tiles;
  // accent tiles sit on the cream squares only, never adjacent, in a loose diagonal rhythm
  const accentAt = new Map();
  if (accent.length) {
    const slots = [[1, 2], [5, 1], [3, 6], [7, 4]].filter(([x, y]) => (x + y) % 2 === 1);
    slots.forEach(([x, y], n) => accentAt.set(y * tiles + x, accent[n % accent.length]));
  }
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const ty = Math.floor(y / tile);
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / tile);
      const i = y * size + x;
      const dark = (tx + ty) % 2 === 0;
      const base = accentAt.get(ty * tiles + tx) || (dark ? colorA : colorB);
      const tone = 1 + (mottle[i] - .5) * .05;
      const edge = Math.min((x % tile), (y % tile), tile - (x % tile), tile - (y % tile));
      const bevel = edge < 1.2 ? .62 : edge < 2.2 ? .88 : 1;
      data[i * 4] = base[0] * tone * bevel; data[i * 4 + 1] = base[1] * tone * bevel; data[i * 4 + 2] = base[2] * tone * bevel; data[i * 4 + 3] = 255;
      height[i] = .5 - (edge < 1.6 ? .45 : 0);
      rough[i] = .24 + (mottle[i] - .5) * .06 + (dark ? .03 : 0) + (edge < 1.6 ? .25 : 0);
    }
  }
  void rand;
  const canvas = canvasFromImageData(data, size);
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 1.2), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// ACOUSTIC CEILING TILE — clean white mineral board, 2 x 2 tiles, fine perforation, no stains
// ---------------------------------------------------------------------------------------------
export function ceilingTileSet(size, { seed = 31, name = "ceiling" } = {}) {
  const rand = rng(seed);
  const base = fbmField(size, { octaves: 2, period: 6, seed });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    const gap = e < 2.2 ? 1 : 0;
    const v = 246 + (base[i] - .5) * 8 - gap * 70;
    data[i * 4] = v; data[i * 4 + 1] = v - 1; data[i * 4 + 2] = v - 3; data[i * 4 + 3] = 255;
    height[i] = .6 + (base[i] - .5) * .2 - gap * .6;
    rough[i] = .92;
  }
  const canvas = canvasFromImageData(data, size);
  const ctx = canvas.getContext("2d");
  const pits = Math.floor(size * size / 260);
  for (let n = 0; n < pits; n++) {
    const x = rand() * size, y = rand() * size;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    if (e < 6) continue;
    ctx.fillStyle = `rgba(110,118,150,${rand.range(.08, .2)})`;
    ctx.fillRect(x, y, rand.range(1, 2.4), rand.range(.8, 1.4));
  }
  const map = textureFrom(canvas, { srgb: true });
  const normalMap = textureFrom(canvasFromImageData(normalFromHeight(height, size, 2), size), { srgb: false });
  const roughnessMap = textureFrom(grayCanvas(rough, size), { srgb: false });
  return { map, normalMap, roughnessMap };
}

// ---------------------------------------------------------------------------------------------
// BRUSHED METAL, CARDBOARD, FABRIC, RUBBER — small neutral sets tinted by material.color (cleaner than v1)
// ---------------------------------------------------------------------------------------------
export function brushedMetalSet(size, { seed = 41 } = {}) {
  const streak = fbmField(size, { octaves: 3, period: 2, seed, aspectX: 1, aspectY: 100 });
  const blotch = fbmField(size, { octaves: 2, period: 3, seed: seed + 3 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 218 + (streak[i] - .5) * 30 + (blotch[i] - .5) * 14;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = streak[i] * .25;
    rough[i] = .3 + (streak[i] - .5) * .14 + (blotch[i] - .5) * .06;
  }
  return packSet(data, height, rough, size, { normalStrength: .8, name: "metal" });
}

export function cardboardSet(size, { seed = 51 } = {}) {
  const fibre = fbmField(size, { octaves: 3, period: 5, seed, aspectX: 3, aspectY: 1 });
  const fine = fbmField(size, { octaves: 2, period: 40, seed: seed + 2 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 236 + (fibre[i] - .5) * 18 + (fine[i] - .5) * 10;
    data[i * 4] = v; data[i * 4 + 1] = v - 4; data[i * 4 + 2] = v - 13; data[i * 4 + 3] = 255;
    height[i] = fibre[i] * .5 + fine[i] * .3;
    rough[i] = .88 + (fine[i] - .5) * .06;
  }
  return packSet(data, height, rough, size, { normalStrength: 1, name: "cardboard" });
}

export function fabricSet(size, { seed = 61, weave = 64 } = {}) {
  const fine = fbmField(size, { octaves: 2, period: 24, seed });
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
    const v = 226 + h * 22 + (fine[i] - .5) * 12;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = h * .5 + fine[i] * .15;
    rough[i] = .92;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.6, name: "fabric" });
}

export function rubberSet(size, { seed = 71 } = {}) {
  const fine = fbmField(size, { octaves: 3, period: 28, seed });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + (fine[i] - .5) * 24;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    height[i] = fine[i];
    rough[i] = .7 + (fine[i] - .5) * .12;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.2, name: "rubber" });
}

// Concrete / paving for the pavement outside the window: light, clean, warm-grey slabs.
export function pavementSet(size, { seed = 81 } = {}) {
  const blotch = fbmField(size, { octaves: 3, period: 3, seed });
  const fine = fbmField(size, { octaves: 2, period: 60, seed: seed + 1, gain: .6 });
  const data = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const e = Math.min(x % half, y % half, half - (x % half), half - (y % half));
    const gap = e < 2 ? 1 : 0;
    const v = 196 + (blotch[i] - .5) * 26 + (fine[i] - .5) * 16 - gap * 58;
    data[i * 4] = v; data[i * 4 + 1] = v - 1; data[i * 4 + 2] = v - 5; data[i * 4 + 3] = 255;
    height[i] = fine[i] * .5 - gap * .6;
    rough[i] = .84;
  }
  return packSet(data, height, rough, size, { normalStrength: 1.4, name: "pavement" });
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
