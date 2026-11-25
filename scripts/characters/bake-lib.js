// Part baking: SDF -> surface-nets mesh -> meshopt simplification -> normals / colours / skin weights -> packed binary.
import { MeshoptSimplifier } from "meshoptimizer";
import { meshSdf, fixWinding, gradient } from "./mesher.js";
import { BONE_INDEX } from "./rig.js";

await MeshoptSimplifier.ready;

const srgb = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/**
 * spec: {
 *   name, material, shape (sdf shape), min, max (bbox), h (voxel), tris (target triangles),
 *   color(p,n) -> [r,g,b] 0..1 (sRGB), weights(p) -> {index:[4], weight:[4]}  OR rigid: "boneName",
 *   lockBorder: bool
 * }
 */
export function bakePart(spec) {
  const t0 = Date.now();
  const sdf = spec.shape.d;
  let mesh = meshSdf(sdf, { min: spec.min, max: spec.max, h: spec.h, lipschitz: spec.lipschitz ?? 1.4 });
  fixWinding(mesh, sdf, spec.h);
  const raw = mesh.indices.length / 3;

  let { positions, indices } = mesh;
  // attributes that guide the simplifier: normals + colours
  const vCount = positions.length / 3;
  const attrs = new Float32Array(vCount * 6);
  for (let v = 0; v < vCount; v++) {
    const p = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    const n = gradient(sdf, p[0], p[1], p[2], spec.h * 0.4);
    const c = spec.color ? spec.color(p, n) : [0.8, 0.8, 0.8];
    attrs.set([n[0], n[1], n[2], c[0], c[1], c[2]], v * 6);
  }
  const target = Math.min(raw, spec.tris || raw) * 3;
  if (target < indices.length) {
    const flags = spec.lockBorder === false ? [] : ["LockBorder"];
    const [simplified] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attrs, 6, [0.5, 0.5, 0.5, 1.2, 1.2, 1.2], null, target, spec.error ?? 0.01, flags);
    indices = simplified;
  }
  // compact
  const remap = new Int32Array(vCount).fill(-1);
  const keep = [];
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (remap[v] < 0) { remap[v] = keep.length; keep.push(v); }
  }
  if (keep.length > 65535) throw new Error(`${spec.name}: ${keep.length} vertices exceed 16-bit indices; raise voxel size or lower target`);
  const pos = new Float32Array(keep.length * 3);
  const idx = new Uint16Array(indices.length);
  keep.forEach((v, i) => { pos[i * 3] = positions[v * 3]; pos[i * 3 + 1] = positions[v * 3 + 1]; pos[i * 3 + 2] = positions[v * 3 + 2]; });
  for (let i = 0; i < indices.length; i++) idx[i] = remap[indices[i]];

  // final attributes at the (possibly moved) simplified vertices
  const n = keep.length;
  const normals = new Int8Array(n * 3), colors = new Uint8Array(n * 3), sIdx = new Uint8Array(n * 4), sWgt = new Uint8Array(n * 4);
  let minP = [Infinity, Infinity, Infinity], maxP = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    for (let a = 0; a < 3; a++) { minP[a] = Math.min(minP[a], p[a]); maxP[a] = Math.max(maxP[a], p[a]); }
    const g = gradient(sdf, p[0], p[1], p[2], spec.h * 0.4);
    normals[v * 3] = Math.round(g[0] * 127); normals[v * 3 + 1] = Math.round(g[1] * 127); normals[v * 3 + 2] = Math.round(g[2] * 127);
    const c = spec.color ? spec.color(p, g) : [0.8, 0.8, 0.8];
    colors[v * 3] = srgb(c[0]); colors[v * 3 + 1] = srgb(c[1]); colors[v * 3 + 2] = srgb(c[2]);
    if (spec.rigid) { sIdx[v * 4] = BONE_INDEX[spec.rigid]; sWgt[v * 4] = 255; }
    else {
      const w = spec.weights(p, g);
      let sum = 0;
      for (let i = 0; i < 4; i++) { sIdx[v * 4 + i] = w.index[i]; const q = Math.round(w.weight[i] * 255); sWgt[v * 4 + i] = q; sum += q; }
      sWgt[v * 4] += 255 - sum; // exact normalisation
    }
  }
  const quant = new Int16Array(n * 3);
  const ext = [maxP[0] - minP[0], maxP[1] - minP[1], maxP[2] - minP[2]].map((e) => e || 1e-6);
  for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) quant[v * 3 + a] = Math.round(((pos[v * 3 + a] - minP[a]) / ext[a]) * 65535 - 32768);
  console.log(`  ${spec.name.padEnd(14)} raw ${String(raw).padStart(7)} tris -> ${String(idx.length / 3).padStart(6)} tris, ${String(n).padStart(6)} verts  (${Date.now() - t0} ms)`);
  return {
    name: spec.name, material: spec.material, rigid: spec.rigid || null, vertexCount: n, indexCount: idx.length,
    min: minP, max: maxP, quant, normals, colors, sIdx, sWgt, idx, extra: spec.extra || null
  };
}

// Pack parts into one binary buffer + JSON manifest
export function packParts(parts, manifestBase) {
  const chunks = [];
  let offset = 0;
  const push = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; }
    chunks.push(bytes);
    const start = offset;
    offset += bytes.byteLength;
    return start;
  };
  const manifestParts = parts.map((p) => ({
    name: p.name, material: p.material, rigid: p.rigid, vertexCount: p.vertexCount, indexCount: p.indexCount, min: p.min, max: p.max, extra: p.extra,
    pos: push(p.quant), nrm: push(p.normals), col: push(p.colors), sIdx: push(p.sIdx), sWgt: push(p.sWgt), idx: push(p.idx)
  }));
  const total = new Uint8Array(offset);
  let o = 0;
  for (const c of chunks) { total.set(c, o); o += c.byteLength; }
  return { bin: total, manifest: { ...manifestBase, parts: manifestParts, byteLength: offset } };
}
