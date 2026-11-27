// Assembles a full character (skin parts + garments + hair) from a compact definition.
import { buildHead, jawWeight, surfaceZ } from "./head.js";
import { HEAD_C, proximityWeights, boneManifest, BONE_INDEX } from "./rig.js";
import { translate, placeHead, sub3, add3, scale3, norm3 } from "./util.js";
import { strand, ribbon, smoothstep, clamp, mix, union } from "./sdf.js";
import { buildHand, withAO, boundsFrom, tint } from "./parts.js";

export const LODS = {
  hi: { head: { h: 0.0016, tris: 20000 }, brow: { h: 0.0011, tris: 900 }, hair: { h: 0.003, tris: 13000 }, hand: { h: 0.0026, tris: 3200 }, body: { h: 0.0055, tris: 22000 }, legs: { h: 0.0055, tris: 12000 }, shoe: { h: 0.0038, tris: 2200 }, small: { h: 0.002, tris: 900 } },
  lo: { head: { h: 0.0028, tris: 7000 }, brow: { h: 0.0016, tris: 380 }, hair: { h: 0.0045, tris: 4500 }, hand: { h: 0.004, tris: 1100 }, body: { h: 0.008, tris: 7500 }, legs: { h: 0.008, tris: 4500 }, shoe: { h: 0.0055, tris: 900 }, small: { h: 0.003, tris: 360 } }
};

export function headWeights(head, HS = 1) {
  const hc = HEAD_C;
  return (p) => {
    const local = [(p[0] - hc[0]) / HS, (p[1] - hc[1]) / HS, (p[2] - hc[2]) / HS];
    const jw = jawWeight(local, head.P);
    const base = proximityWeights(p, ["head", "neck", "chest"], { power: 5, soft: 0.01 });
    const entries = base.index.map((bi, i) => ({ bi, w: base.weight[i] * (1 - jw) })).filter((e) => e.w > 0);
    if (jw > 0.001) entries.push({ bi: BONE_INDEX.jaw, w: jw });
    entries.sort((a, b) => b.w - a.w);
    const top = entries.slice(0, 4);
    const sum = top.reduce((s, e) => s + e.w, 0) || 1;
    const index = [0, 0, 0, 0], weight = [0, 0, 0, 0];
    top.forEach((e, i) => { index[i] = e.bi; weight[i] = e.w / sum; });
    return { index, weight };
  };
}

// brows. Two styles:
//  - default: a thin tube following the brow ridge (older characters);
//  - slab: true  -> the v2 "signature brow": a thick, dark, cleanly edged slab (flattened ribbon) that lies on the brow ridge,
//    thick at the inner end, angled, tapering to a point. Tune with def.brows = { slab: true, thick, arch, tilt, y, length, inner, color }.
export function browParts(head, def, q, HS = 1) {
  const hc = HEAD_C;
  const b = { thick: 1, arch: 1, tilt: 0, color: [0.1, 0.07, 0.06], length: 1, y: 0, slab: false, inner: 1, ...(def.brows || {}) };
  const parts = [];
  for (const [name, s] of [["browL", 1], ["browR", -1]]) {
    if (b.slab) {
      const xs = [0.007, 0.018, 0.032, 0.047 * b.length, 0.0605 * b.length];
      const ys = [0.0292, 0.0322 + 0.0015 * b.arch, 0.0356 + 0.0022 * b.arch, 0.0352 + 0.0012 * b.arch - 0.002 * b.tilt, 0.0298 - 0.005 * b.tilt].map((y) => y + b.y);
      const pts = xs.map((x, i) => {
        const z = surfaceZ(head.raw, s * x, ys[i], 0.16, 0.0) - 0.0009;
        return [s * x * HS + hc[0], ys[i] * HS + hc[1], z * HS + hc[2]];
      });
      const shape = ribbon(pts, [0.0066 * b.thick * b.inner * HS, 0.0011 * b.thick * HS], [0.0031 * HS, 0.0014 * HS], hc);
      parts.push({
        name, material: "hair", shape, ...boundsFrom(pts, 0.014), h: q.brow.h, tris: q.brow.tris,
        color: withAO(() => b.color, shape, { strength: 0.2 }), rigid: "head", lockBorder: false
      });
      continue;
    }
    const xs = [0.010, 0.022, 0.036, 0.05 * b.length, 0.0625 * b.length];
    const ys = [0.0438, 0.0462 + 0.002 * b.arch, 0.0470 + 0.0035 * b.arch, 0.0452 + 0.002 * b.arch - 0.002 * b.tilt, 0.0405 - 0.004 * b.tilt].map((y) => y + b.y);
    const rs = [0.0044, 0.0046, 0.0042, 0.0031, 0.0014].map((r) => r * b.thick);
    const pts = xs.map((x, i) => {
      const z = surfaceZ(head.raw, s * x, ys[i], 0.16, 0.0) - 0.0006;
      return [s * x * HS + hc[0], ys[i] * HS + hc[1], z * HS + hc[2]];
    });
    const shape = strand(pts, rs.map((r) => r * HS), 0.002 * HS);
    parts.push({
      name, material: "plain", shape, ...boundsFrom(pts, 0.012), h: q.brow.h, tris: q.brow.tris,
      color: withAO(() => b.color, shape, { strength: 0.25 }), rigid: "head", lockBorder: false
    });
  }
  return parts;
}

export function handParts(def, q) {
  const parts = [];
  const sleeveDir = (s) => norm3(sub3([s * 0.285, 0.89, 0.02], [s * 0.24, 1.145, 0.0]));
  for (const [name, s, bone, fore] of [["handL", 1, "hand.L", "foreArm.L"], ["handR", -1, "hand.R", "foreArm.R"]]) {
    const F = sleeveDir(s);
    const hand = buildHand({ wrist: [s * 0.285, 0.89, 0.02], F, N: [-s, 0, 0], curl: def.handCurl ?? 1, size: def.handSize ?? 1 });
    const skin = def.skin;
    const color = withAO((p) => tint(skin, [skin[0] * 0.92, skin[1] * 0.85, skin[2] * 0.85], clamp(0.5 - (p[1] - 0.72) * 2.2, 0, 0.6)), hand.shape, { strength: 0.35 });
    parts.push({
      name, material: "skin", shape: hand.shape, min: hand.min, max: hand.max, h: q.hand.h, tris: q.hand.tris, color,
      weights: (p) => proximityWeights(p, [fore, bone], { power: 4, soft: 0.015 }), lockBorder: false
    });
  }
  return parts;
}

export function buildCharacter(def, lod = "hi") {
  // def.lods = { hi: {head: {h, tris}, ...}, lo: {...} } overrides the shared LOD budgets for one character (hero characters get a finer head)
  const q = Object.fromEntries(Object.entries(LODS[lod]).map(([k, v]) => [k, { ...v, ...((def.lods && def.lods[lod] && def.lods[lod][k]) || {}) }]));
  const hc = HEAD_C;
  const HS = def.headScale ?? 1.1;
  // def.headBuilder: pass buildHeadV2 (head-v2.js) for the stylised v2 face; default is the realistic head.js face
  const head = (def.headBuilder || buildHead)(def.head);
  const headShape = placeHead(head.shape, hc, HS);
  const local = (p) => [(p[0] - hc[0]) / HS, (p[1] - hc[1]) / HS, (p[2] - hc[2]) / HS];
  const parts = [];
  const hcolor = (p) => head.colorFn(local(p));
  parts.push({
    name: "head", material: "skin", shape: headShape,
    min: [-0.12 * HS + hc[0], -0.27 * HS + hc[1], -0.14 * HS + hc[2]], max: [0.12 * HS + hc[0], 0.15 * HS + hc[1], 0.16 * HS + hc[2]],
    h: q.head.h, tris: q.head.tris, color: withAO(hcolor, headShape, { small: 0.006, large: 0.03, strength: def.headAO ?? 0.38 }), weights: headWeights(head, HS),
    extra: { eyeCenters: head.eyeCenters.map((c) => [c[0] * HS + hc[0], c[1] * HS + hc[1], c[2] * HS + hc[2]]), headScale: HS }
  });
  parts.push(...browParts(head, def, q, HS));
  parts.push(...handParts(def, q));
  const ctx = { head, hc, q, def, headShape, HS, local, place: (shape) => placeHead(shape, hc, HS) };
  if (def.hair) parts.push(...def.hair(ctx));
  if (def.garments) parts.push(...def.garments(ctx));
  return { id: def.id, parts, manifest: { id: def.id, lod, bones: boneManifest(), eyes: def.eyes, style: def.style || {}, headCenter: hc } };
}
