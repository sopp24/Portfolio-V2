// Shared skeleton (character space, metres, feet at y = 0, facing +z, character's LEFT is +x).
import { len3 } from "./sdf.js";

export const HEAD_C = [0, 1.665, 0.005]; // centre of the skull

const J = {
  hips: [0, 0.98, 0], spine: [0, 1.08, 0], chest: [0, 1.26, 0], neck: [0, 1.49, -0.008], head: [0, 1.575, -0.01], jaw: [0, 1.635, -0.03],
  "upperArm.L": [0.185, 1.425, 0], "foreArm.L": [0.24, 1.145, 0.0], "hand.L": [0.285, 0.89, 0.02],
  "upperArm.R": [-0.185, 1.425, 0], "foreArm.R": [-0.24, 1.145, 0.0], "hand.R": [-0.285, 0.89, 0.02],
  "upLeg.L": [0.095, 0.95, 0], "lowLeg.L": [0.1, 0.52, 0.01], "foot.L": [0.1, 0.09, -0.01],
  "upLeg.R": [-0.095, 0.95, 0], "lowLeg.R": [-0.1, 0.52, 0.01], "foot.R": [-0.1, 0.09, -0.01]
};
export const JOINTS = J;

// name, parent
export const BONE_DEFS = [
  ["hips", null], ["spine", "hips"], ["chest", "spine"], ["neck", "chest"], ["head", "neck"], ["jaw", "head"],
  ["upperArm.L", "chest"], ["foreArm.L", "upperArm.L"], ["hand.L", "foreArm.L"],
  ["upperArm.R", "chest"], ["foreArm.R", "upperArm.R"], ["hand.R", "foreArm.R"],
  ["upLeg.L", "hips"], ["lowLeg.L", "upLeg.L"], ["foot.L", "lowLeg.L"],
  ["upLeg.R", "hips"], ["lowLeg.R", "upLeg.R"], ["foot.R", "lowLeg.R"]
];
export const BONE_INDEX = Object.fromEntries(BONE_DEFS.map(([n], i) => [n, i]));

// segments used for proximity skinning: [bone, from, to]
const TIP = {
  hips: J.spine, spine: J.chest, chest: J.neck, neck: J.head, head: [0, 1.76, 0], jaw: [0, 1.585, 0.05],
  "upperArm.L": J["foreArm.L"], "foreArm.L": J["hand.L"], "hand.L": [0.3, 0.72, 0.03],
  "upperArm.R": J["foreArm.R"], "foreArm.R": J["hand.R"], "hand.R": [-0.3, 0.72, 0.03],
  "upLeg.L": J["lowLeg.L"], "lowLeg.L": J["foot.L"], "foot.L": [0.1, 0.03, 0.13],
  "upLeg.R": J["lowLeg.R"], "lowLeg.R": J["foot.R"], "foot.R": [-0.1, 0.03, 0.13]
};
export const SEGMENTS = Object.keys(TIP).map((name) => ({ name, a: J[name], b: TIP[name], index: BONE_INDEX[name] }));

function distToSegment(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / l2;
  t = Math.max(0, Math.min(1, t));
  return len3(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t);
}

// Proximity weights restricted to `allowed` bone names. Returns { index:[4], weight:[4] } (weights sum to 1).
export function proximityWeights(p, allowed, { power = 3, soft = 0.012, reach = 2.4 } = {}) {
  const cand = [];
  let best = Infinity;
  for (const s of SEGMENTS) {
    if (!allowed.includes(s.name)) continue;
    const d = distToSegment(p, s.a, s.b);
    cand.push({ index: s.index, d });
    if (d < best) best = d;
  }
  const kept = cand.filter((c) => c.d < best * reach + 0.02).map((c) => ({ index: c.index, w: 1 / Math.pow(c.d + soft, power) }));
  kept.sort((a, b) => b.w - a.w);
  const top = kept.slice(0, 4);
  const sum = top.reduce((s, c) => s + c.w, 0) || 1;
  const index = [0, 0, 0, 0], weight = [0, 0, 0, 0];
  top.forEach((c, i) => { index[i] = c.index; weight[i] = c.w / sum; });
  if (!top.length) weight[0] = 1;
  return { index, weight };
}

export const ALL_BODY = Object.keys(TIP).filter((n) => n !== "jaw" && n !== "head");

// Bone list for the manifest: local rest offsets relative to the parent joint.
export function boneManifest() {
  return BONE_DEFS.map(([name, parent]) => {
    const w = J[name];
    const pw = parent ? J[parent] : [0, 0, 0];
    return { name, parent, pos: [w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]] };
  });
}
