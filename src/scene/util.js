// Shared helpers for the procedural store: seeded randomness, tileable noise, canvas helpers,
// physically-scaled box UVs and a static batcher that merges props into a handful of draw calls.
import * as THREE from "three";
import { mergeGeometries, RoundedBoxGeometry } from "three-addons";

// ---------------------------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------------------------
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + (max - min) * next();
  next.int = (min, max) => Math.floor(min + (max - min + 1) * next());
  next.pick = (list) => list[Math.floor(next() * list.length) % list.length];
  next.sign = () => (next() < .5 ? -1 : 1);
  return next;
}

// ---------------------------------------------------------------------------------------------
// Tileable value noise fields (Float32Array, size*size, values 0..1)
// ---------------------------------------------------------------------------------------------
function smooth(t) { return t * t * (3 - 2 * t); }

export function noiseField(size, period, seed = 1, aspectX = 1, aspectY = 1) {
  const rand = rng(seed);
  const px = Math.max(1, Math.round(period * aspectX));
  const py = Math.max(1, Math.round(period * aspectY));
  const grid = new Float32Array(px * py);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * py;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    const y0 = iy % py, y1 = (iy + 1) % py;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * px;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const x0 = ix % px, x1 = (ix + 1) % px;
      const a = grid[y0 * px + x0], b = grid[y0 * px + x1];
      const c = grid[y1 * px + x0], d = grid[y1 * px + x1];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

export function fbmField(size, { octaves = 5, period = 4, seed = 1, gain = .5, aspectX = 1, aspectY = 1 } = {}) {
  const out = new Float32Array(size * size);
  let amplitude = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = noiseField(size, period * 2 ** o, seed + o * 101, aspectX, aspectY);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Height field -> tangent-space normal map pixels (OpenGL convention, wraps for tiling).
export function normalFromHeight(height, size, strength = 2) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size, y0 = y * size, yp = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const dx = (height[y0 + xm] - height[y0 + xp]) * strength;
      const dy = (height[yp + x] - height[ym + x]) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y0 + x) * 4;
      data[i] = (dx * inv * .5 + .5) * 255;
      data[i + 1] = (dy * inv * .5 + .5) * 255;
      data[i + 2] = (inv * .5 + .5) * 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------------------------
export function createCanvas(width, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasFromImageData(data, width, height = width) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

export function grayCanvas(field, size, map = (v) => v) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(255, map(field[i]) * 255));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return canvasFromImageData(data, size);
}

export function textureFrom(canvas, { srgb = true, repeat = true, anisotropy = 8, channel = 0, mipmaps = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.channel = channel;
  texture.generateMipmaps = mipmaps;
  texture.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

// Film-like paper grain over an existing canvas (cheap, deterministic).
export function addGrain(canvas, amount = .06, seed = 7) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const rand = rng(seed);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - .5) * 255 * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
}

export function hexToRgb(hex) {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function shadeHex(hex, amount) {
  return amount >= 0 ? mixHex(hex, "#ffffff", amount) : mixHex(hex, "#000000", -amount);
}

// ---------------------------------------------------------------------------------------------
// Physically-scaled UVs (1 UV unit = `tile` metres) and bevelled boxes
// ---------------------------------------------------------------------------------------------
export function applyBoxUV(geometry, tile = 1, grainAxis = null, offset = [0, 0]) {
  geometry.computeBoundingBox();
  const normal = geometry.attributes.normal;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv || new THREE.BufferAttribute(new Float32Array(position.count * 2), 2);
  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  let grain = grainAxis;
  if (!grain) grain = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
  const axisIndex = { x: 0, y: 1, z: 2 };
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    let faceAxis = 0;
    if (ny >= nx && ny >= nz) faceAxis = 1; else if (nz >= nx && nz >= ny) faceAxis = 2;
    const tangents = [0, 1, 2].filter((a) => a !== faceAxis);
    let uAxis = tangents[0], vAxis = tangents[1];
    if (grain && axisIndex[grain] !== faceAxis) {
      uAxis = axisIndex[grain];
      vAxis = tangents.find((a) => a !== uAxis);
    }
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    uv.setXY(i, p[uAxis] / tile + offset[0], p[vAxis] / tile + offset[1]);
  }
  geometry.setAttribute("uv", uv);
  uv.needsUpdate = true;
  return geometry;
}

const boxCache = new Map();
export function woodBox(w, h, d, { bevel = .012, tile = .9, grain = null, segments = 2, shared = true } = {}) {
  const key = [w, h, d, bevel, tile, grain, segments].map((v) => (typeof v === "number" ? +v.toFixed(4) : v)).join("|");
  if (shared && boxCache.has(key)) return boxCache.get(key);
  const radius = Math.min(bevel, w / 2.01, h / 2.01, d / 2.01);
  const geometry = radius > 0 ? new RoundedBoxGeometry(w, h, d, segments, radius) : new THREE.BoxGeometry(w, h, d);
  applyBoxUV(geometry, tile, grain);
  if (shared) boxCache.set(key, geometry);
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Static batcher: collect many meshes, merge per material (+ shadow flags) into a few draw calls
// ---------------------------------------------------------------------------------------------
const tmpMatrix = new THREE.Matrix4();
const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

export function composeMatrix(position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], target = new THREE.Matrix4()) {
  tmpPosition.set(position[0], position[1], position[2]);
  tmpEuler.set(rotation[0], rotation[1], rotation[2], "YXZ");
  tmpQuaternion.setFromEuler(tmpEuler);
  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  tmpScale.set(s[0], s[1], s[2]);
  return target.compose(tmpPosition, tmpQuaternion, tmpScale);
}

export class StaticBatcher {
  constructor() {
    this.buckets = new Map();
    this.triangles = 0;
  }

  add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], { cast = true, receive = true, scale = [1, 1, 1], matrix = null } = {}) {
    const key = material.uuid + "|" + (cast ? 1 : 0) + (receive ? 1 : 0);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { material, cast, receive, geometries: [] };
      this.buckets.set(key, bucket);
    }
    let g = geometry.clone();
    if (!g.index) {
      const count = g.attributes.position.count;
      const index = new Uint32Array(count);
      for (let i = 0; i < count; i++) index[i] = i;
      g.setIndex(new THREE.BufferAttribute(index, 1));
    }
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const name of Object.keys(g.attributes)) {
      if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    }
    g.applyMatrix4(matrix || composeMatrix(position, rotation, scale, tmpMatrix));
    bucket.geometries.push(g);
    return this;
  }

  box(w, h, d, material, position, rotation, options = {}) {
    const geometry = woodBox(w, h, d, { bevel: options.bevel ?? .01, tile: options.tile ?? .9, grain: options.grain ?? null, segments: options.segments ?? 2 });
    return this.add(geometry, material, position, rotation, options);
  }

  build(parent, name = "static") {
    const meshes = [];
    for (const bucket of this.buckets.values()) {
      const merged = mergeGeometries(bucket.geometries, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = bucket.cast;
      mesh.receiveShadow = bucket.receive;
      mesh.name = name + ":" + (bucket.material.name || "material");
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.triangles += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
      parent.add(mesh);
      meshes.push(mesh);
      for (const g of bucket.geometries) g.dispose();
    }
    this.buckets.clear();
    return meshes;
  }
}

export function disposeObject(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value && value.isTexture) value.dispose();
      material.dispose?.();
    }
  });
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
