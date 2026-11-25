// Reusable part builders: hands, garments, legs, shoes, hair helpers, baked ambient occlusion and weights.
import {
  ellipsoid, ellipsoidAxes, ellipsoidRot, capsule, torus, roundBox, plane, strand, ribbon, union, subtract, intersect, offset, displace, fromFn,
  smoothstep, mix, clamp, noise3, len3, smin, smax, bezier3
} from "./sdf.js";
import { JOINTS as J, proximityWeights } from "./rig.js";
import { norm3, cross3, dot3, add3, sub3, scale3, lerp3 } from "./util.js";

// ---------------------------------------------------------------------------------------------
// colour helpers
// ---------------------------------------------------------------------------------------------
export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const tint = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// Baked ambient occlusion from the part's own SDF (and optional occluders), multiplied into the colour.
export function withAO(colorFn, shape, { small = 0.012, large = 0.05, strength = 0.55, occluders = null } = {}) {
  const sample = (x, y, z) => {
    let d = shape.d(x, y, z);
    if (occluders) d = Math.min(d, occluders.d(x, y, z));
    return d;
  };
  return (p, n) => {
    const c = colorFn(p, n);
    const a = clamp(sample(p[0] + n[0] * small, p[1] + n[1] * small, p[2] + n[2] * small) / small, 0, 1);
    const b = clamp(sample(p[0] + n[0] * large, p[1] + n[1] * large, p[2] + n[2] * large) / large, 0, 1);
    const ao = 0.5 * a + 0.5 * b;
    const k = 1 - strength * (1 - ao);
    return [c[0] * k, c[1] * k, c[2] * k];
  };
}

export function boundsFrom(points, pad = 0.03) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); }
  return { min: min.map((v) => v - pad), max: max.map((v) => v + pad) };
}

// ---------------------------------------------------------------------------------------------
// weights
// ---------------------------------------------------------------------------------------------
export const BODY_BONES = ["hips", "spine", "chest", "neck", "upperArm.L", "foreArm.L", "upperArm.R", "foreArm.R"];
export const LEG_BONES = ["hips", "spine", "upLeg.L", "lowLeg.L", "foot.L", "upLeg.R", "lowLeg.R", "foot.R"];
export const bodyWeights = (allowed = BODY_BONES, opts = { power: 4, soft: 0.02 }) => (p) => proximityWeights(p, allowed, opts);

// ---------------------------------------------------------------------------------------------
// HAND — built directly in character space from the wrist, finger axis F, palm normal N
// ---------------------------------------------------------------------------------------------
export function buildHand({ wrist, F, N, curl = 1, size = 1, spread = 1 }) {
  F = norm3(F);
  N = norm3(sub3(N, scale3(F, dot3(N, F))));
  let T = [0, 0, 1];
  T = norm3(sub3(sub3(T, scale3(F, dot3(T, F))), scale3(N, dot3(T, N))));
  const S = T; // thumb side
  const at = (f, s, n) => add3(wrist, add3(scale3(F, f * size), add3(scale3(S, s * size), scale3(N, n * size))));
  const rotToward = (dir, to, ang) => norm3(add3(scale3(dir, Math.cos(ang)), scale3(to, Math.sin(ang))));

  const parts = [];
  parts.push(ellipsoidAxes(at(0.046, 0, 0), S, F, N, 0.038 * size, 0.047 * size, 0.0165 * size)); // palm
  parts.push(capsule(at(-0.03, 0, 0), at(0.012, 0, 0), 0.0245 * size, 0.027 * size)); // wrist
  parts.push(ellipsoidAxes(at(0.034, 0.03, 0.004), S, F, N, 0.019 * size, 0.027 * size, 0.016 * size)); // thumb base
  const fingers = [];
  const offs = [0.0285, 0.0095, -0.0095, -0.0285], lens = [0.075, 0.084, 0.078, 0.061];
  offs.forEach((off, i) => {
    const base = at(0.088, off * spread, 0.0);
    const c = curl * (0.34 + i * 0.07);
    const dirs = [rotToward(F, N, c * 0.5), rotToward(F, N, c * 1.3), rotToward(F, N, c * 2.0)];
    const p1 = add3(base, scale3(dirs[0], lens[i] * 0.42 * size));
    const p2 = add3(p1, scale3(dirs[1], lens[i] * 0.33 * size));
    const p3 = add3(p2, scale3(dirs[2], lens[i] * 0.25 * size));
    fingers.push(strand([base, p1, p2, p3], [0.0094 * size, 0.0088 * size, 0.0079 * size, 0.0066 * size], 0.002));
  });
  const tb = at(0.034, 0.03, 0.006);
  const d1 = norm3(add3(add3(scale3(F, 0.75), scale3(S, 0.55 * spread)), scale3(N, 0.15)));
  const d2 = norm3(add3(add3(scale3(F, 0.8), scale3(S, 0.3)), scale3(N, 0.45 * curl)));
  const d3 = norm3(add3(add3(scale3(F, 0.7), scale3(S, 0.15)), scale3(N, 0.7 * curl)));
  const t1 = add3(tb, scale3(d1, 0.033 * size)), t2 = add3(t1, scale3(d2, 0.029 * size)), t3 = add3(t2, scale3(d3, 0.025 * size));
  const thumb = strand([tb, t1, t2, t3], [0.0135 * size, 0.0115 * size, 0.0098 * size, 0.0082 * size], 0.002);
  const body = union(0.006, ...parts);
  const shape = union(0.0035, body, ...fingers, thumb);
  const reach = at(0.22, 0, 0);
  const b = boundsFrom([wrist, reach, at(0.1, 0.06, 0.04), at(0.1, -0.06, -0.04)], 0.03);
  return { shape, ...b };
}

// ---------------------------------------------------------------------------------------------
// TORSO MASS shared by hoodie / cardigan / jacket (character space)
// ---------------------------------------------------------------------------------------------
export function torsoMass({ width = 1, chest = 1, belly = 1, lowerCut = 0.9 } = {}) {
  const w = width;
  const ribcage = ellipsoid(0, 1.285, -0.006, 0.172 * w, 0.2, 0.108 * chest);
  const abdomen = ellipsoid(0, 1.09, 0, 0.158 * w, 0.16, 0.102 * belly);
  const hem = ellipsoid(0, 0.99, 0, 0.17 * w, 0.085, 0.112 * belly);
  const shoulders = [-1, 1].map((s) => capsule([s * 0.06 * w, 1.455, -0.012], [s * 0.19 * w, 1.428, 0], 0.056, 0.059));
  const trap = ellipsoid(0, 1.478, -0.022, 0.118 * w, 0.04, 0.085);
  let body = union(0.07, ribcage, abdomen, hem, ...shoulders, trap);
  return subtract(body, plane([0, lowerCut, 0], [0, 1, 0]), 0.004); // flat cut at the hem
}

// Sleeve = shoulder -> elbow -> wrist tapered capsules with a hollow end
export function sleeve(side, { r = [0.062, 0.053, 0.044], cuff = 0.0, hole = 0.034 } = {}) {
  const s = side;
  const sh = [s * 0.18, 1.43, 0], el = [s * 0.24, 1.145, 0.0], wr = [s * 0.285, 0.89, 0.02];
  const upper = capsule(sh, el, r[0], r[1]);
  const lower = capsule(el, wr, r[1], r[2] + cuff);
  const elbow = ellipsoid(el[0] + s * 0.004, el[1] - 0.004, el[2] - 0.01, r[1] + 0.001, r[1] + 0.003, r[1] + 0.002);
  let sl = union(0.03, upper, lower, elbow);
  // hollow at the wrist so the hand emerges from the cuff
  const dir = norm3(sub3(wr, el));
  const holeShape = capsule(add3(wr, scale3(dir, -0.035)), add3(wr, scale3(dir, 0.08)), hole, hole);
  sl = subtract(sl, holeShape, 0.004);
  return { shape: sl, el, wr, sh };
}

// fabric wrinkles: horizontal-ish folds around joints, soft noise everywhere
export function foldField({ amp = 0.0024, elbow = 1.145, wrist = 0.9, scale = 1 } = {}) {
  return (x, y, z) => {
    const envElbow = Math.exp(-(((y - elbow) / 0.07) ** 2));
    const envWrist = Math.exp(-(((y - wrist - 0.04) / 0.06) ** 2));
    const arm = Math.abs(x) > 0.1 ? 1 : 0;
    const n = noise3(x * 22, y * 22, z * 22);
    const ridges = Math.sin(y * 210 + n * 7) * (0.35 * envElbow + 0.3 * envWrist) * arm;
    const soft = (noise3(x * 11, y * 11, z * 11) - 0.5) * 0.7 + (noise3(x * 26, y * 26, z * 26) - 0.5) * 0.35;
    return amp * scale * (ridges + soft);
  };
}

// ---------------------------------------------------------------------------------------------
// LEGS (jeans / trousers) and SHOES
// ---------------------------------------------------------------------------------------------
export function legs({ width = 1, flare = 0 } = {}) {
  const pelvis = ellipsoid(0, 0.985, 0, 0.17 * width, 0.14, 0.108);
  const sides = [-1, 1].map((s) => {
    const hip = [s * 0.095 * width, 0.95, 0], knee = [s * 0.1 * width, 0.52, 0.012], ankle = [s * 0.1 * width, 0.095, -0.01];
    const thigh = capsule(hip, knee, 0.1 * width, 0.071 * width);
    const shin = capsule(knee, ankle, 0.068 * width, 0.051 + flare);
    const kneeCap = ellipsoid(knee[0], knee[1], knee[2] + 0.02, 0.06 * width, 0.062, 0.05);
    // hollow cuff so the shoe emerges
    const hole = capsule([ankle[0], ankle[1] - 0.03, ankle[2]], [ankle[0], ankle[1] + 0.08, ankle[2]], 0.04, 0.04);
    return { thigh, shin, kneeCap, hole };
  });
  let shape = union(0.035, pelvis, ...sides.flatMap((s) => [s.thigh, s.shin, s.kneeCap]));
  for (const s of sides) shape = subtract(shape, s.hole, 0.004);
  return subtract(shape, plane([0, 0.07, 0], [0, 1, 0]), 0.003);
}

export function shoe(side) {
  const x = side * 0.1;
  const sole = roundBox([x, 0.016, 0.04], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.041, 0.0155, 0.112, 0.01);
  const upper = ellipsoid(x, 0.052, 0.03, 0.04, 0.04, 0.092);
  const toe = ellipsoid(x, 0.04, 0.105, 0.037, 0.03, 0.045);
  const heel = ellipsoid(x, 0.065, -0.045, 0.034, 0.045, 0.036);
  const ankle = capsule([x, 0.125, -0.012], [x, 0.075, -0.01], 0.037, 0.04);
  let s = union(0.016, upper, toe, heel, ankle);
  s = union(0.012, s, sole);
  // laces/opening dent
  s = subtract(s, ellipsoidRot(x, 0.112, 0.04, 0.02, 0.01, 0.055, -0.5, 0, 0), 0.006);
  return s;
}

// ---------------------------------------------------------------------------------------------
// HAIR helpers (head-local coordinates)
// ---------------------------------------------------------------------------------------------
// y of the hairline as a function of (x, z): front hairline, above-the-ear line, nape line
export function hairLine({ front = 0.055, sideRecede = 0.022, side = 0.02, back = -0.045, earClear = 0.0 } = {}) {
  return (x, z) => {
    const ax = Math.abs(x);
    const yf = front - sideRecede * (ax / 0.06) ** 2;
    const ys = side + earClear;
    const yb = back + Math.max(0, ax - 0.05) * 1.4;
    const wf = smoothstep(0.0, 0.055, z);
    const wb = smoothstep(-0.015, -0.075, z);
    const wobble = 0.0016 * Math.sin(x * 210 + z * 40) + 0.0022 * Math.sin(x * 97 + 1.3); // a natural, uneven edge
    return wf * (yf + wobble) + wb * yb + (1 - wf - wb) * (ys + wobble * 0.5);
  };
}

// Scalp hair mass. The thickness tapers to a few millimetres at the hairline so the hair feathers into the skin
// instead of ending in a thick wall (which reads as a wig).
export function scalpCap({ expand = 0.006, line, topVolume = 0.0, topCenter = [0, 0.085, 0.02], feather = 0.022, flow = { center: [0.005, 0.1, -0.035], n: 46, amp: 0.0016 }, curl = null, extras = [] } = {}) {
  const base = union(0.03, ellipsoid(0, 0.03, -0.012, 0.071, 0.084, 0.093), ellipsoid(0, 0.028, 0.04, 0.06, 0.074, 0.058));
  let cap = base;
  if (topVolume > 0) cap = union(0.03, base, ellipsoid(topCenter[0], topCenter[1], topCenter[2], 0.062, 0.03 + topVolume - expand, 0.085));
  if (extras.length) cap = union(0.03, cap, ...extras);
  const thin = 0.0032;
  return fromFn((x, y, z) => {
    const h = y - line(x, z);
    const t = smoothstep(0.0, feather, h);
    // combed strands: grooves radiate from the crown whorl, fading towards the hairline
    let groove = 0;
    if (flow) {
      const a = Math.atan2(x - flow.center[0], z - flow.center[2]);
      const w = noise3(x * 30, y * 30, z * 30) - 0.5;
      groove = flow.amp * Math.sin(a * flow.n + w * 5) * smoothstep(0.0, 0.03, h);
    }
    // curly hair: two octaves of value noise give rounded, clustered curls on the surface
    let curls = 0;
    if (curl) {
      const n1 = noise3(x * curl.scale, y * curl.scale, z * curl.scale);
      const n2 = noise3(x * curl.scale * 0.42 + 7.3, y * curl.scale * 0.42 + 1.7, z * curl.scale * 0.42 + 3.1);
      curls = curl.amp * (1.15 * n1 * n1 + 0.9 * n2 - 0.85) * smoothstep(0.0, 0.02, h);
    }
    return smax(cap.d(x, y, z) - (thin + (expand - thin) * t) - groove - curls, -h, 0.004);
  }, base.c, base.r + 0.04);
}

// A hair lock: bezier-swept tapered tube. pts = [p0,p1,p2,p3]; radii = [r0, r1]; colour per lock.
export function lock(pts, r0, r1, color, { n = 9, profile = 1.0 } = {}) {
  const path = bezier3(pts[0], pts[1], pts[2], pts[3], n);
  const radii = path.map((_, i) => {
    const t = i / (path.length - 1);
    // fat in the middle, pointed at the tip
    return mix(r0, r1, Math.pow(t, 1.3)) * (1 - 0.18 * Math.sin(t * Math.PI) * 0 + 0.12 * Math.sin(Math.min(1, t * 1.4) * Math.PI) * profile);
  });
  const shape = strand(path, radii, 0.003);
  return { shape, color };
}

export function lockSet(locks, baseColor, { k = 0.006 } = {}) {
  const shapes = locks.map((l) => l.shape);
  const merged = union(k, ...shapes);
  const colorAt = (p) => {
    let best = Infinity, col = baseColor;
    for (const l of locks) {
      const d = l.shape.d(p[0], p[1], p[2]);
      if (d < best) { best = d; col = l.color || baseColor; }
    }
    return col;
  };
  return { shape: merged, colorAt };
}

// Flat sculpted hair clump (ribbon) built from a Bezier path
export function clump(pts, widths, thick, color, { n = 10, center } = {}) {
  const path = bezier3(pts[0], pts[1], pts[2], pts[3], n);
  return { shape: ribbon(path, widths, thick, center), color };
}

// A corkscrew hair strand: a helix wrapped around a straight/drooping axis, tapering to a point.
export function tendril(start, dir, length, r, { turns = 2.5, curl = 0.008, droop = 0.02, n = 26, color } = {}) {
  const d = norm3(dir);
  let u = cross3(d, [0, 1, 0]);
  if (len3(u[0], u[1], u[2]) < 0.2) u = cross3(d, [1, 0, 0]);
  u = norm3(u);
  const v = cross3(d, u);
  const pts = [], radii = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ang = t * turns * Math.PI * 2;
    const rr = curl * (0.35 + 0.65 * Math.min(1, t * 1.6));
    const base = add3(start, scale3(d, length * t));
    pts.push([
      base[0] + u[0] * Math.cos(ang) * rr + v[0] * Math.sin(ang) * rr,
      base[1] + u[1] * Math.cos(ang) * rr + v[1] * Math.sin(ang) * rr - droop * t * t,
      base[2] + u[2] * Math.cos(ang) * rr + v[2] * Math.sin(ang) * rr
    ]);
    radii.push(r * (1 - 0.7 * t * t));
  }
  return { shape: strand(pts, radii, r * 0.4), color };
}

// ---------------------------------------------------------------------------------------------
// Shared garment: glossy leather bomber (ribbed collar / cuffs / hem, zip groove, pocket slits, creases)
// plus a tee limited to the neck and front chest so nothing pokes through when an arm is raised.
// ---------------------------------------------------------------------------------------------
export function leatherJacketParts(q, { leather, rib, tee = [0.84, 0.83, 0.8], width = 0.92 } = {}) {
  const noise = (x, y, z) => noise3(x * 18, y * 18, z * 18);
  const parts = [];
  const mass = torsoMass({ width, chest: 1.0, belly: 1.02, lowerCut: 0.985 });
  const slL = sleeve(1, { r: [0.056, 0.049, 0.043], cuff: 0.006 }), slR = sleeve(-1, { r: [0.056, 0.049, 0.043], cuff: 0.006 });
  const collar = torus([0, 1.486, -0.006], [0, 1, 0], 0.058, 0.021);
  const hemBand = ellipsoid(0, 1.012, 0, 0.176 * width, 0.034, 0.118); // the gathered rib that makes a bomber jacket's hem
  let jacket = union(0.05, mass, slL.shape, slR.shape, collar, hemBand);
  jacket = subtract(jacket, capsule([0, 1.43, -0.008], [0, 1.64, -0.01], 0.043, 0.043), 0.008);
  jacket = subtract(jacket, capsule([0, 1.462, 0.1], [0, 1.0, 0.116], 0.0021, 0.0021), 0.002); // zip groove
  for (const s of [-1, 1]) {
    jacket = subtract(jacket, capsule([s * 0.092, 1.1, 0.098], [s * 0.088, 1.04, 0.108], 0.0028, 0.0028), 0.002); // pocket slits
    jacket = subtract(jacket, capsule([s * 0.098, 1.3, 0.094], [s * 0.104, 1.31, 0.092], 0.0022, 0.0022), 0.002);
  }
  jacket = displace(jacket, foldField({ amp: 0.0042, scale: 1.2 })); // leather creases, strongest at the elbows
  const colorJ = (p) => {
    const hem = 1 - smoothstep(1.0, 1.045, p[1]);
    const wristD = Math.min(Math.hypot(p[0] - slL.wr[0], p[1] - slL.wr[1], p[2] - slL.wr[2]), Math.hypot(p[0] - slR.wr[0], p[1] - slR.wr[1], p[2] - slR.wr[2]));
    const cuff = 1 - smoothstep(0.045, 0.075, wristD);
    const col = p[1] > 1.46 ? 1 - smoothstep(0.012, 0.03, Math.hypot(Math.hypot(p[0], p[2] + 0.006) - 0.058, p[1] - 1.486)) : 0;
    const r = Math.max(hem, cuff, col);
    const g = (noise(p[0] * 3, p[1] * 3, p[2] * 3) - 0.5) * 0.05;
    const base = [leather[0] + g, leather[1] + g * 0.3, leather[2] + g * 0.3];
    return [base[0] + (rib[0] - base[0]) * r, base[1] + (rib[1] - base[1]) * r, base[2] + (rib[2] - base[2]) * r];
  };
  parts.push({ name: "jacket", material: "leather", shape: jacket, ...boundsFrom([[-0.34, 0.94, -0.17], [0.34, 1.64, 0.17]], 0.02), h: q.body.h, tris: q.body.tris, color: withAO(colorJ, jacket, { small: 0.014, large: 0.06, strength: 0.6 }), weights: bodyWeights(BODY_BONES), lockBorder: true });
  const teeCore = intersect(intersect(mass, plane([0, 1.2, 0], [0, -1, 0]), 0.01), ellipsoid(0, 1.44, 0.07, 0.1, 0.12, 0.1), 0.01);
  const teeShape = union(0.008, { c: teeCore.c, r: teeCore.r, d: (x, y, z) => teeCore.d(x, y, z) + 0.014 }, torus([0, 1.47, 0], norm3([0, 0.94, 0.3]), 0.046, 0.011));
  parts.push({ name: "shirt", material: "cloth", shape: teeShape, ...boundsFrom([[-0.14, 1.2, -0.12], [0.14, 1.54, 0.14]], 0.02), h: q.small.h, tris: q.small.tris * 2, color: withAO(() => tee, teeShape, { strength: 0.3 }), weights: bodyWeights(["chest", "neck", "spine"]), lockBorder: false });
  return parts;
}
