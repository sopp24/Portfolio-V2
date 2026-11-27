// Customer B — art direction v2. A young woman browsing the CD shelves: a big side-swept wave of near-black hair with a violet streak,
// an oversized mint track jacket over a cream tee, wide indigo trousers, chunky sneakers; headphones around the neck (runtime
// accessory, see people.js). Same sculpt language as the boss (defs/shopkeeper.js): stylised "painted" face (head-v2), heavy dark
// slab brows, small dark heavy-lidded eyes, rosy blush, smooth glossy hair made of a few big layered clumps, soft cloth with big folds.
// Original character: no real person is depicted. Custom shape helpers live in this file; the shared pipeline is used as is.
import { ellipsoid, ellipsoidRot, capsule, strand, torus, roundBox, plane, union, subtract, intersect, displace, fromFn, smoothstep, noise3, smin, smax, clamp } from "../sdf.js";
import { norm3, add3, scale3, sub3 } from "../util.js";
import { buildHeadV2 } from "../head-v2.js";
import { withAO, boundsFrom, hairLine, scalpLeaf, scalpTube, hairShell, lockSet, clump, torsoMass, sleeve, softFolds, bodyWeights, BODY_BONES, LEG_BONES, tint } from "../parts.js";

const SKIN = [0.74, 0.52, 0.4];
const HAIR = [0.07, 0.05, 0.062];
const STREAK = [0.52, 0.36, 0.9];
const MINT = [0.36, 0.84, 0.68];
const CREAM = [0.95, 0.93, 0.86];
const VIOLET = [0.5, 0.4, 0.88];
const INDIGO = [0.38, 0.31, 0.6];

const g3 = (x, y, z, c, sx, sy, sz) => Math.exp(-(((x - c[0]) / sx) ** 2 + ((y - c[1]) / sy) ** 2 + ((z - c[2]) / sz) ** 2));

// ---------------------------------------------------------------------------------------------
// HAIR
// ---------------------------------------------------------------------------------------------
function hair(ctx) {
  const { q, HS, hc, local, head } = ctx;
  const sk = head.raw;
  // Scalp shell: a thin skull offset (so the clumps stay readable), with an asymmetric front hairline: it runs diagonally from a deep part
  // on her left (+x, viewer's right) down to her right temple (-x), which is what a side-swept fringe looks like.
  const line = (x, z) => {
    const wf = smoothstep(0.0, 0.055, z), wb = smoothstep(-0.015, -0.075, z);
    const wob = 0.0014 * Math.sin(x * 190 + z * 40) + 0.002 * Math.sin(x * 83 + 1.3);
    const yf = 0.03 + 0.05 * smoothstep(-0.07, 0.03, x) - 0.026 * smoothstep(0.035, 0.075, x) + wob;
    const ys = 0.03 + wob * 0.5;
    const yb = -0.062 + Math.max(0, Math.abs(x) - 0.05) * 1.4;
    return wf * yf + wb * yb + (1 - wf - wb) * ys;
  };
  const extra = (x, y, z) =>
    0.014 * g3(x, y, z, [-0.02, 0.11, 0.034], 0.05, 0.034, 0.055) + // the wave's volume, front-top, leaning to her right
    0.012 * g3(x, y, z, [-0.066, 0.07, 0.006], 0.03, 0.045, 0.06) + // right side swell
    0.006 * g3(x, y, z, [0.07, 0.07, 0.0], 0.03, 0.045, 0.06) +
    0.008 * g3(x, y, z, [0, 0.07, -0.075], 0.07, 0.06, 0.05);
  const cap = hairShell(sk, line, { thick: 0.0064, thin: 0.0024, extra, volume: ellipsoid(-0.016, 0.118, 0.036, 0.05, 0.03, 0.05), kVol: 0.03 });

  // The bob (jaw length): thin curtains down the sides (her right one frames the face, her left one is tucked behind the ear so the ear
  // stays visible) and a smooth mass behind the head ending above the collar, leaving the slender neck visible.
  const bob = union(0.024,
    ellipsoid(0, -0.016, -0.05, 0.076, 0.078, 0.058), // back
    ellipsoidRot(-0.071, -0.004, -0.002, 0.01, 0.058, 0.048, 0, 0, 0.06), // her right side
    ellipsoidRot(0.074, -0.012, -0.064, 0.013, 0.058, 0.04, 0, 0, -0.06) // her left side, behind the ear
  );
  const solid = { c: cap.solid.c, r: cap.solid.r + 0.08, d: (x, y, z) => smin(cap.solid.d(x, y, z), bob.d(x, y, z), 0.016) };

  const L = (angles, w, t, color = HAIR, o = {}) => scalpLeaf(solid, angles, w, t, color, o);
  const curl = clump([[0.016, 0.118, 0.07], [-0.034, 0.128, 0.1], [-0.052, 0.082, 0.126], [-0.006, 0.05, 0.106]], [0.0165, 0.0026], [0.0115, 0.0026], HAIR, { n: 22, center: [0, 0.02, -0.01] });
  const locks = [
    // ---- her right (-x, viewer's left): the wave. Big layered sweeps from the deep part over the forehead, S-curved crest, tips
    // flicking out at the temple; the violet streak is an overlay clump riding the leading edge.
    L([[26, 64], [6, 62], [-16, 56], [-40, 48], [-64, 36], [-86, 20], [-100, 2]], 0.04, 0.0145, HAIR, { flick: 0.026, lift: 0.7 }),
    L([[24, 50], [4, 47], [-18, 40], [-42, 32], [-66, 22], [-86, 8], [-98, -10]], 0.034, 0.014, HAIR, { flick: 0.024, lift: 0.8 }),
    L([[14, 38], [-6, 33], [-28, 27], [-50, 19], [-70, 8], [-84, -8]], 0.03, 0.0135, HAIR, { lift: 0.7 }),
    L([[10, 80], [-24, 76], [-56, 66], [-86, 50], [-112, 32], [-128, 10]], 0.034, 0.013, HAIR, { lift: 0.6 }),
    L([[-8, 86], [-40, 80], [-74, 68], [-104, 50], [-132, 30]], 0.03, 0.012),
    // ---- her left (+x, viewer's right): swept back over the top and tucked behind the ear
    L([[34, 72], [58, 68], [82, 58], [104, 42], [122, 24], [134, 4]], 0.032, 0.012),
    L([[28, 54], [54, 48], [80, 38], [100, 20], [114, -2]], 0.03, 0.0125, HAIR, { lift: 0.6 }),
    L([[24, 36], [50, 31], [74, 22], [94, 6], [106, -12]], 0.028, 0.012),
    // ---- back: overlapping clumps falling to the blunt ends of the bob
    L([[180, 86], [177, 62], [174, 36], [172, 10], [172, -4]], 0.032, 0.013, HAIR, { tip: 0.3 }),
    L([[-160, 80], [-165, 56], [-168, 30], [-168, 8], [-165, -6]], 0.032, 0.013, HAIR, { tip: 0.3 }),
    L([[160, 80], [164, 56], [166, 30], [166, 8], [163, -6]], 0.032, 0.013, HAIR, { tip: 0.3 }),
    L([[-138, 70], [-143, 46], [-146, 20], [-146, 2], [-142, -8]], 0.03, 0.0125, HAIR, { tip: 0.3 }),
    L([[138, 68], [142, 44], [146, 18], [146, 0], [142, -8]], 0.03, 0.0125, HAIR, { tip: 0.3 }),
    // ---- her right curtain: falls from the wave down the cheek to the jaw
    L([[-80, 26], [-86, 8], [-90, -12], [-91, -26]], 0.024, 0.012, HAIR, { flick: 0.006, tip: 0.4 }),
    // the crescent curl falling over her forehead, like the boss's but bigger
    curl
  ];
  const set = lockSet(locks, HAIR, { k: 0.011 });
  // The coloured streak is painted: bands in (azimuth, elevation) space around the skull centre, so they stay visible on whichever clump
  // is the visible surface there (geometry-based overlays get buried under neighbouring clumps).
  const bands = [
    // a bold face-framing lock: from the middle of the fringe along the leading edge of the wave, then down the curtain to the jaw
    { path: [[16, 36], [-6, 32], [-30, 27], [-56, 21], [-76, 11], [-86, -4], [-90, -28]], hw: 5.8 },
    // a second lock at the back right, so the streak also reads when she is seen from behind (that is how the shop camera sees her)
    { path: [[-138, 56], [-146, 36], [-152, 14], [-154, -6]], hw: 5.2 }
  ];
  const streakAt = (lp) => {
    const az = (Math.atan2(lp[0], lp[2] + 0.01) * 180) / Math.PI, el = (Math.asin(clamp((lp[1] - 0.03) / (Math.hypot(lp[0], lp[1] - 0.03, lp[2] + 0.01) || 1), -1, 1)) * 180) / Math.PI;
    let best = 0;
    for (const b of bands) {
      let dmin = 1e9, tAt = 0;
      const n = b.path.length - 1;
      for (let i = 0; i < n; i++) {
        const A = b.path[i], B = b.path[i + 1];
        const abx = B[0] - A[0], aby = B[1] - A[1];
        const t = clamp(((az - A[0]) * abx + (el - A[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
        const d = Math.hypot(az - A[0] - abx * t, el - A[1] - aby * t);
        if (d < dmin) { dmin = d; tAt = (i + t) / n; }
      }
      const hw = b.hw * (0.15 + 0.85 * Math.min(1, tAt * 3.2)) * (1 - 0.55 * smoothstep(0.7, 1.0, tAt)); // starts as a point, widest mid-way, narrow at the tip
      best = Math.max(best, 1 - smoothstep(hw * 0.7, hw, dmin));
    }
    return best;
  };
  const paintStreak = (lp, col) => (curl.shape.d(lp[0], lp[1], lp[2]) < 0.003 ? col : tint(col, STREAK, streakAt(lp)));
  const hairLocal = union(0.01, cap, bob, set.shape);
  const hairWorld = ctx.place(hairLocal);
  const bounds = { min: [-0.2 * HS + hc[0], -0.19 * HS + hc[1], -0.19 * HS + hc[2]], max: [0.2 * HS + hc[0], 0.2 * HS + hc[1], 0.17 * HS + hc[2]] };
  return [{
    name: "hair", material: "hair", shape: hairWorld, ...bounds, h: q.hair.h * 0.72, tris: Math.round(q.hair.tris * 2.1),
    color: withAO((p) => paintStreak(local(p), set.colorAt(local(p))), hairWorld, { small: 0.008, large: 0.035, strength: 0.5 }),
    rigid: "head", lockBorder: true
  }];
}

// ---------------------------------------------------------------------------------------------
// GARMENTS
// ---------------------------------------------------------------------------------------------
// Oversized boxy track jacket (dropped shoulders, wide sleeves, open front with a thick fold-over collar), cream cuffs and hem,
// cream tee seen through the opening.
function jacketParts(q) {
  const parts = [];
  const body = union(0.07,
    roundBox([0, 1.12, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.196, 0.215, 0.118, 0.085), // boxy lower body
    ellipsoid(0, 1.3, -0.004, 0.186, 0.16, 0.112), // chest
    ...[-1, 1].map((s) => capsule([s * 0.07, 1.438, -0.012], [s * 0.2, 1.402, 0], 0.05, 0.064)), // dropped shoulders
    ellipsoid(0, 1.456, -0.018, 0.09, 0.032, 0.064) // yoke at the neck
  );
  const rs = [0.064, 0.058, 0.05];
  const slL = sleeve(1, { r: rs, cuff: 0.008, hole: 0.034 }), slR = sleeve(-1, { r: rs, cuff: 0.008, hole: 0.034 });
  const cuffs = [slL, slR].map((sl) => {
    const dir = norm3(sub3(sl.wr, sl.el));
    return torus(add3(sl.wr, scale3(dir, 0.014)), dir, 0.05, 0.0135);
  });
  // open front: a straight placket gap that widens to the collar
  const vBottom = 1.12;
  const half = (y) => 0.05 + Math.max(0, y - vBottom) * 0.2;
  const vCut = fromFn((x, y, z) => smax(smax(Math.abs(x) - half(y), vBottom - y, 0.014), 0.05 - z, 0.01), [0, 1.4, 0.12], 0.45);
  // fold-over collar: a thick doughnut at the neck base, a pile behind, two rolled lapel edges down the opening
  const collar = union(0.025, torus([0, 1.496, -0.014], norm3([0, 0.95, 0.3]), 0.066, 0.024), ellipsoid(0, 1.522, -0.064, 0.072, 0.026, 0.044));
  const lapels = [-1, 1].map((sd) => strandThrough([[sd * 0.082, 1.49, 0.04], [sd * 0.115, 1.43, 0.085], [sd * 0.106, 1.36, 0.112], [sd * 0.092, 1.28, 0.122], [sd * 0.072, 1.17, 0.126]], [0.026, 0.026, 0.024, 0.02, 0.015], 0.012));
  let jacket = union(0.024, subtract(body, vCut, 0.012), slL.shape, slR.shape, ...cuffs, subtract(collar, vCut, 0.01), ...lapels);
  jacket = subtract(jacket, capsule([0, 1.41, -0.012], [0, 1.7, -0.012], 0.052, 0.052), 0.012); // neck hole
  jacket = displace(jacket, softFolds({ amp: 0.0058 }));
  const colorJ = (p) => {
    const wristD = Math.min(Math.hypot(p[0] - slL.wr[0], p[1] - slL.wr[1], p[2] - slL.wr[2]), Math.hypot(p[0] - slR.wr[0], p[1] - slR.wr[1], p[2] - slR.wr[2]));
    const cuff = 1 - smoothstep(0.028, 0.05, wristD);
    const hem = 1 - smoothstep(0.935, 0.96, p[1]);
    const g = (noise3(p[0] * 2.2 + 9, p[1] * 2.2, p[2] * 2.2) - 0.5) * 0.06;
    const base = [MINT[0] + g, MINT[1] + g * 0.9, MINT[2] + g * 0.8];
    // a violet colour-block band across the chest / upper back
    const band = (1 - smoothstep(0.0, 0.012, Math.abs(p[1] - 1.235) - 0.04)) * (Math.abs(p[0]) < 0.235 ? 1 : 0);
    let c = tint(base, VIOLET, band);
    // track-jacket stripes down the outside of each sleeve: one cream, one violet
    const sleeveSide = smoothstep(0.205, 0.225, Math.abs(p[0])) * (1 - smoothstep(1.34, 1.38, p[1])) * smoothstep(0.96, 1.0, p[1]);
    c = tint(c, CREAM, sleeveSide * (1 - smoothstep(0.0055, 0.0085, Math.abs(p[2] - 0.004))));
    c = tint(c, VIOLET, sleeveSide * (1 - smoothstep(0.0055, 0.0085, Math.abs(p[2] - 0.022))));
    const k = Math.max(cuff, hem);
    c = tint(c, CREAM, k);
    return c;
  };
  parts.push({
    name: "jacket", material: "soft", shape: jacket, ...boundsFrom([[-0.38, 0.86, -0.2], [0.38, 1.66, 0.2]], 0.02), h: q.body.h * 0.8, tris: Math.round(q.body.tris * 1.25),
    color: withAO(colorJ, jacket, { small: 0.016, large: 0.07, strength: 0.6, occluders: capsule([0, 1.4, -0.012], [0, 1.66, -0.012], 0.04, 0.045) }), weights: jacketWeights(union(0.01, slL.shape, slR.shape, ...cuffs)), lockBorder: true
  });

  // cream tee: front chest and neckline, tucked 1.3 cm under the jacket
  const tm = torsoMass({ width: 0.84, chest: 1.0, belly: 1.0, lowerCut: 0.9 });
  const core = intersect(intersect(tm, plane([0, 1.06, 0], [0, -1, 0]), 0.01), ellipsoid(0, 1.3, 0.04, 0.15, 0.24, 0.13), 0.01);
  const tee = union(0.008, { c: core.c, r: core.r, d: (x, y, z) => core.d(x, y, z) + 0.014 }, torus([0, 1.47, -0.002], norm3([0, 0.93, 0.34]), 0.047, 0.0115));
  parts.push({
    name: "shirt", material: "soft", shape: tee, ...boundsFrom([[-0.16, 1.04, -0.13], [0.16, 1.54, 0.15]], 0.02), h: q.small.h, tris: q.small.tris * 3,
    color: withAO(() => CREAM, tee, { small: 0.012, large: 0.05, strength: 0.5, occluders: jacket }), weights: bodyWeights(["chest", "neck", "spine", "hips"]), lockBorder: false
  });
  return parts;
}

// Skin weights of the jacket: the sleeves follow the arm bones, the boxy body follows the torso bones (plain proximity would drag the whole
// flank along with the raised arm because the oversized body hugs the arm axis).
function blendWeights(a, b, t) {
  const m = new Map();
  for (let i = 0; i < 4; i++) {
    if (a.weight[i] > 0) m.set(a.index[i], (m.get(a.index[i]) || 0) + a.weight[i] * (1 - t));
    if (b.weight[i] > 0) m.set(b.index[i], (m.get(b.index[i]) || 0) + b.weight[i] * t);
  }
  const top = [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  const sum = top.reduce((acc, e) => acc + e[1], 0) || 1;
  const index = [0, 0, 0, 0], weight = [0, 0, 0, 0];
  top.forEach(([bi, w], i) => { index[i] = bi; weight[i] = w / sum; });
  return { index, weight };
}
function jacketWeights(armShape) {
  const torsoW = bodyWeights(["hips", "spine", "chest", "neck"]);
  const fullW = bodyWeights(BODY_BONES);
  return (p, n) => {
    const ax = Math.abs(p[0]);
    // sleeve vertices (near the sleeve solid, or simply lateral to the body box) follow the arm; folds displace the surface by ~1 cm, hence the wide range
    const a = Math.max((1 - smoothstep(0.0, 0.04, armShape.d(p[0], p[1], p[2]))) * smoothstep(0.09, 0.17, ax), smoothstep(0.208, 0.235, ax));
    if (a < 0.003) return torsoW(p, n);
    if (a > 0.997) return fullW(p, n);
    return blendWeights(torsoW(p, n), fullW(p, n), a);
  };
}

// chain of tapered capsules through points
function strandThrough(points, radii, k = 0.01) {
  const caps = [];
  for (let i = 0; i < points.length - 1; i++) caps.push(capsule(points[i], points[i + 1], radii[i], radii[i + 1]));
  return union(k, ...caps);
}

// Wide-leg trousers: pelvis, straight wide legs flaring a little towards the ankle, soft vertical folds, pooled hems resting on the sneakers.
function wideLegs() {
  const pelvis = ellipsoid(0, 0.99, 0, 0.178, 0.14, 0.11);
  const sides = [-1, 1].map((s) => {
    const hip = [s * 0.1, 0.95, 0], knee = [s * 0.11, 0.52, 0.014], ankle = [s * 0.118, 0.1, -0.004];
    return [capsule(hip, knee, 0.098, 0.084), capsule(knee, ankle, 0.084, 0.096), ellipsoid(knee[0], knee[1], knee[2] + 0.018, 0.07, 0.066, 0.066)];
  });
  let shape = union(0.04, pelvis, ...sides.flat());
  shape = subtract(shape, plane([0, 0.05, 0], [0, 1, 0]), 0.014); // hems stop just above the floor, rounded
  const fold = (x, y, z) => {
    const big = noise3(x * 7 + 2, y * 5, z * 7) - 0.5;
    const pool = Math.exp(-(((y - 0.16) / 0.1) ** 2));
    const ridges = Math.sin(y * 70 + big * 8) * 0.0034 * pool; // pooling at the ankle
    const vert = Math.sin((Math.abs(x) - 0.1) * 120 + big * 5) * 0.0016 * smoothstep(0.3, 0.7, y) * smoothstep(0.98, 0.7, y);
    return 0.0062 * big + ridges + vert;
  };
  return displace(shape, fold);
}

// Chunky "dad" sneaker: thick two-layer sole, puffy tongue, high ankle collar, toe cap.
function chunkyShoe(side) {
  const x = side * 0.1;
  const midsole = union(0.02, ellipsoid(x, 0.022, 0.07, 0.05, 0.024, 0.092), ellipsoid(x, 0.022, -0.032, 0.047, 0.024, 0.062));
  const upper = ellipsoid(x, 0.075, 0.03, 0.045, 0.045, 0.095);
  const toe = ellipsoid(x, 0.058, 0.108, 0.044, 0.034, 0.05);
  const heel = ellipsoid(x, 0.07, -0.05, 0.036, 0.048, 0.04);
  const collar = capsule([x, 0.132, -0.02], [x, 0.082, -0.016], 0.04, 0.042);
  const tongue = ellipsoidRot(x, 0.118, 0.052, 0.024, 0.036, 0.03, -0.45, 0, 0);
  let s = union(0.016, upper, toe, heel, collar, tongue);
  s = union(0.012, s, midsole);
  return subtract(s, ellipsoidRot(x, 0.112, 0.036, 0.018, 0.012, 0.05, -0.45, 0, 0), 0.006); // lacing dent
}

function garments(ctx) {
  const { q } = ctx;
  const parts = jacketParts(q);
  const legs = wideLegs();
  parts.push({
    name: "pants", material: "soft", shape: legs, ...boundsFrom([[-0.26, 0.04, -0.17], [0.26, 1.06, 0.2]], 0.02), h: q.legs.h * 0.9, tris: Math.round(q.legs.tris * 1.1),
    color: withAO((p) => { const g = (noise3(p[0] * 2.5 + 5, p[1] * 2.5, p[2] * 2.5) - 0.5) * 0.05; return [INDIGO[0] + g, INDIGO[1] + g * 0.9, INDIGO[2] + g * 0.8]; }, legs, { strength: 0.5 }),
    weights: bodyWeights(LEG_BONES), lockBorder: false
  });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = chunkyShoe(s);
    parts.push({
      name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.065, 0.0, -0.1], [s * 0.1 + 0.065, 0.16, 0.2]], 0.015), h: q.shoe.h, tris: Math.round(q.shoe.tris * 1.2),
      color: withAO((p) => {
        if (p[1] < 0.007) return [0.16, 0.15, 0.24]; // outsole
        if (p[1] < 0.036) return [0.96, 0.94, 0.88]; // midsole
        if (p[2] < -0.045 && p[1] > 0.04) return VIOLET; // heel tab
        if (p[2] > 0.128) return [0.9, 0.88, 0.82]; // toe cap
        return [0.95, 0.95, 0.93];
      }, sh, { strength: 0.5 }),
      rigid: bone, lockBorder: false
    });
  }
  return parts;
}

export default {
  id: "visitor-b",
  skin: SKIN,
  handSize: 0.94,
  headScale: 1.34,
  headBuilder: buildHeadV2,
  headAO: 0.3,
  lods: { hi: { head: { h: 0.0015, tris: 22000 } }, lo: { head: { h: 0.0023, tris: 9000 }, brow: { h: 0.0013, tris: 440 } } },
  head: { skin: SKIN, faceW: 0.97, lowerW: 0.95, faceLen: 0.98, jaw: 0.92, chin: 0.98, cheek: 0.9, nose: 0.72, noseLen: 0.72, noseTip: 0.88, noseBridge: 0.84, lip: 0.88, lipFull: 1.0, mouthW: 0.9, mouthDrop: 0.25, ear: 1.08, neck: 0.86, eyeSock: 1.04, blush: 1.0, lipColor: [0.7, 0.38, 0.36] },
  brows: { slab: true, color: [0.07, 0.052, 0.056], thick: 0.8, arch: 1.4, tilt: 0.18 },
  eyes: { iris: [0.2, 0.12, 0.08], size: 0.9, lid: 0.46, lowerLid: -0.06, irisR: 50, pupil: 0.5, lidScale: 1.04 },
  style: { skin: SKIN, lidRim: [0.1, 0.055, 0.05] },
  hair, garments
};
