// Customer A — art direction v2. A taller, leaner young man browsing the left bins: short textured quiff made of a few big smooth
// pointed clumps (near-black espresso with one coral streak), tapered sides, the same face language as the boss (heavy dark slab
// brows, heavy-lidded dark eyes, rosy blush, big ears, smooth painted sculpt), a sun-yellow varsity bomber (ink ribs with coral
// stripes, a vinyl-record emblem on the back) over a white tee, slim light-wash jeans with rolled cuffs, clean white sneakers.
// Original character: no real person is depicted. Built only with the shared pipeline; the bomber is composed here from the shared
// torso / sleeve / soft-fold helpers.
import { ellipsoid, torus, capsule, union, subtract, intersect, displace, plane, fromFn, smax, smin, smoothstep } from "../sdf.js";
import { buildHeadV2 } from "../head-v2.js";
import { norm3, sub3, add3, scale3 } from "../util.js";
import { withAO, boundsFrom, hairLine, scalpLeaf, hairShell, scalpPoint, lockSet, torsoMass, sleeve, softFolds, legs, shoe, bodyWeights, BODY_BONES, LEG_BONES, tint } from "../parts.js";

const SKIN = [0.44, 0.285, 0.2];
const HAIR = [0.115, 0.07, 0.052]; // warm dark chocolate (the boss is near-black)
const FADE = [0.24, 0.15, 0.11]; // the tapered sides: hair colour fades to a dark skin tone near the hairline
const STREAK = [0.93, 0.36, 0.29]; // coral
const SUN = [0.88, 0.64, 0.14]; // jacket body (sun, a touch desaturated: the shop's daylight adds saturation)
const INK = [0.1, 0.115, 0.2]; // ribs, yoke, outsoles
const CORAL = [0.9, 0.35, 0.28];
const CREAM = [0.93, 0.88, 0.78];
const TEE = [0.94, 0.93, 0.9];
const JEANS = [0.33, 0.42, 0.6];
const HS_A = 1.19; // head scale: big, but less than the boss (1.28), so he reads taller and leaner

// ------------------------------------------------------------------------------------------------------------------
// HAIR: tapered sides, a tall textured quiff of big pointed clumps that rise from the front hairline over the top towards
// the crown with their tips flicking up, a coral streak overlay, two clumps running down the back to the nape.
// ------------------------------------------------------------------------------------------------------------------
function hair(ctx) {
  const { q, HS, hc, local, head } = ctx;
  const sk = head.raw;
  const line = hairLine({ front: 0.066, sideRecede: 0.016, side: 0.05, back: 0.012 });
  const g3 = (x, y, z, c, sx, sy, sz) => Math.exp(-(((x - c[0]) / sx) ** 2 + ((y - c[1]) / sy) ** 2 + ((z - c[2]) / sz) ** 2));
  // thickness fields (metres): volume on top-front, some body on the back of the crown, very little on the sides (tapered)
  const extra = (x, y, z) => 0.016 * g3(x, y, z, [-0.004, 0.118, 0.034], 0.05, 0.04, 0.07) + 0.016 * g3(x, y, z, [-0.006, 0.098, 0.066], 0.045, 0.03, 0.03) + 0.008 * g3(x, y, z, [0, 0.1, -0.06], 0.07, 0.05, 0.05);
  const volume = ellipsoid(-0.004, 0.12, 0.034, 0.042, 0.024, 0.056);
  const cap = hairShell(sk, line, { thick: 0.0064, thin: 0.002, extra, volume, kVol: 0.03, feather: 0.024 });
  // the surface the clumps lie on = the full-thickness shell including the top volume (so they ride on the dome, not inside it)
  const surf = { c: cap.solid.c, r: cap.solid.r, d: (x, y, z) => smin(cap.solid.d(x, y, z), volume.d(x, y, z) - 0.0064 * 0.6, 0.03) };
  // a tone per clump (stylised painted hair: neighbouring clumps differ a little in value so the big shapes read even in dark hair)
  const tone = (k) => [HAIR[0] + 0.03 * k, HAIR[1] + 0.02 * k, HAIR[2] + 0.014 * k];
  const L = (angles, w, t, k = 0, o = {}) => scalpLeaf(surf, angles, w, t, tone(k), { tip: 0.05, ...o });
  // radial clumps growing from a crown whorl (a slight common twist, so the whorl reads): long over the forehead, shorter on the sides and back
  const clumpAt = (az) => {
    const front = Math.abs(az) < 56, side = Math.abs(az) < 118;
    const tipEl = front ? 27 : side ? 20 : 10;
    const els = [78, 66 - (front ? 0 : 6), 50 - (front ? 0 : 14), tipEl + 10, tipEl];
    const pts = els.map((el, i) => [az + 12 * (i / 4) - (i === 0 ? 2 : 0), el]);
    return { pts, front, side };
  };
  const tones = [0.3, -0.4, 0.9, 0.0, 0.6, -0.2, 0.8, 0.1, -0.3, 0.7, 0.2, -0.5];
  const azs = [-165, -132, -99, -66, -36, -12, 12, 36, 66, 99, 132, 165];
  const crown = scalpPoint(surf, 0, 90);
  const crownCap = { shape: ellipsoid(crown.p[0], crown.p[1] + 0.003, crown.p[2], 0.027, 0.0105, 0.027), color: tone(0.2), over: false };
  const locks = azs.map((az, i) => {
    const { pts, front } = clumpAt(az);
    return L(pts, front ? 0.027 : 0.025, front ? 0.012 : 0.0105, tones[i], { flick: front ? 0.008 : 0.003, lift: front ? 0.5 : 0.35 });
  });
  // the coral streaks (not lockSet overlays: their colour edge is blended smoothly below): one along a front clump, one down the back
  const streaks = [-12, 165].map((az) => {
    const c = clumpAt(az);
    const pts = c.pts.slice(1); // start below the crown so the colour band does not poke out above the dome
    return L(pts, 0.0085, c.front ? 0.0136 : 0.012, 0, { flick: c.front ? 0.008 : 0.003, lift: c.front ? 0.52 : 0.5 });
  });
  const set = lockSet([...locks, crownCap, ...streaks], HAIR, { k: 0.006 });
  const hairLocal = union(0.005, cap, set.shape);
  const hairWorld = ctx.place(hairLocal);
  const bounds = { min: [-0.19 * HS + hc[0], -0.2 * HS + hc[1], -0.17 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.22 * HS + hc[1], 0.17 * HS + hc[2]] };
  return [{
    name: "hair", material: "hair", shape: hairWorld, ...bounds, h: q.hair.h * 0.72, tris: Math.round(q.hair.tris * 1.5),
    color: withAO((p) => {
      const lp = local(p);
      let c = set.colorAt(lp);
      // the taper: where the shell is thin (just above the hairline) the colour fades to a dark skin tone
      const t = smoothstep(0.0, 0.034, lp[1] - line(lp[0], lp[2]));
      if (c === HAIR) c = tint(FADE, HAIR, t);
      for (const st of streaks) c = tint(c, STREAK, 1 - smoothstep(0.0022, 0.0052, st.shape.d(lp[0], lp[1], lp[2])));
      return c;
    }, hairWorld, { small: 0.008, large: 0.035, strength: 0.55 }),
  rigid: "head", lockBorder: true
  }];
}

// ------------------------------------------------------------------------------------------------------------------
// BOMBER JACKET (sun body, ink ribs with coral stripes, zip half open on a white tee) + tee + slim jeans + sneakers
// ------------------------------------------------------------------------------------------------------------------
function bomber(q) {
  const W = 0.9;
  const mass = torsoMass({ width: W, chest: 1.03, belly: 1.08, lowerCut: 0.985 });
  const rs = [0.057, 0.05, 0.045];
  const slL = sleeve(1, { r: rs, cuff: 0.006 }), slR = sleeve(-1, { r: rs, cuff: 0.006 });
  const cuffs = [slL, slR].map((sl) => {
    const dir = norm3(sub3(sl.wr, sl.el));
    return torus(add3(sl.wr, scale3(dir, 0.012)), dir, 0.044, 0.0135);
  });
  // blousy body gathered over a flat ribbed hem band
  const blouse = ellipsoid(0, 1.075, 0.0, 0.186 * W, 0.07, 0.128);
  const hemRib = ellipsoid(0, 1.003, 0, 0.17 * W, 0.034, 0.112);
  // ribbed stand collar, split in front by the half-open zip
  const vBottom = 1.31, vTop = 0.072;
  const half = (y) => 0.004 + Math.max(0, y - vBottom) * (vTop / 0.2);
  const vCut = fromFn((x, y, z) => smax(smax(Math.abs(x) - half(y), vBottom - y, 0.012), 0.04 - z, 0.01), [0, 1.4, 0.12], 0.4);
  const collar = union(0.014, torus([0, 1.489, -0.008], norm3([0, 0.97, 0.2]), 0.059, 0.0215), torus([0, 1.512, -0.012], norm3([0, 0.97, 0.2]), 0.056, 0.016));
  let body = union(0.04, subtract(union(0.05, mass, blouse), vCut, 0.012), slL.shape, slR.shape, ...cuffs, hemRib, subtract(collar, vCut, 0.01));
  body = subtract(body, capsule([0, 1.43, -0.01], [0, 1.7, -0.01], 0.043, 0.043), 0.01); // neck hole
  // closed part of the zip: a thin groove down to the hem; welt pockets
  body = subtract(body, capsule([0, 1.305, 0.112], [0, 1.0, 0.128], 0.0019, 0.0019), 0.002);
  for (const s of [-1, 1]) body = subtract(body, capsule([s * 0.088, 1.13, 0.108], [s * 0.084, 1.07, 0.122], 0.0026, 0.0026), 0.002);
  body = displace(body, softFolds({ amp: 0.0048 }));
  const colorB = (p) => {
    const wristD = Math.min(Math.hypot(p[0] - slL.wr[0], p[1] - slL.wr[1], p[2] - slL.wr[2]), Math.hypot(p[0] - slR.wr[0], p[1] - slR.wr[1], p[2] - slR.wr[2]));
    const [x, y, z] = p;
    // ribs: hem band, cuffs, collar (ink) with one coral stripe each
    const hemT = 1 - smoothstep(1.026, 1.034, y);
    const hemStripe = (1 - smoothstep(0.004, 0.0075, Math.abs(y - 1.0))) * hemT;
    const cuffT = 1 - smoothstep(0.034, 0.04, wristD);
    const cuffStripe = (1 - smoothstep(0.004, 0.0075, Math.abs(wristD - 0.056))) * (1 - cuffT) * (wristD < 0.075 ? 1 : 0);
    const cuffRib = 1 - smoothstep(0.052, 0.058, wristD);
    const colT = smoothstep(1.466, 1.472, y) * (1 - smoothstep(0.082, 0.092, Math.hypot(x, z + 0.008)));
    const colStripe = (1 - smoothstep(0.003, 0.006, Math.abs(y - 1.4985))) * colT;
    const rib = Math.max(hemT, cuffRib, colT);
    let c = SUN.slice();
    c = tint(c, INK, rib);
    c = tint(c, CORAL, Math.max(hemStripe, cuffStripe, colStripe));
    // vinyl record emblem on the back (ink disc, cream groove ring, coral label)
    if (z < -0.05) {
      const d = Math.hypot(x, y - 1.255);
      const disc = 1 - smoothstep(0.074, 0.08, d);
      const ring = (1 - smoothstep(0.003, 0.006, Math.abs(d - 0.052)));
      const label = 1 - smoothstep(0.026, 0.031, d);
      const hole = 1 - smoothstep(0.004, 0.007, d);
      c = tint(c, INK, disc);
      c = tint(c, CREAM, ring * disc * 0.7);
      c = tint(c, CORAL, label);
      c = tint(c, CREAM, hole);
    }
    // zipper: pale metal line down the closed part and along the open edges of the V
    if (z > 0.02) {
      const zl = (1 - smoothstep(0.0022, 0.0044, Math.abs(x))) * smoothstep(vBottom + 0.004, vBottom - 0.012, y) * smoothstep(0.985, 1.0, y);
      const ve = y > vBottom - 0.006 ? 1 - smoothstep(0.0022, 0.0055, Math.abs(Math.abs(x) - half(y) - 0.002)) : 0;
      c = tint(c, [0.82, 0.78, 0.7], Math.max(zl, ve * 0.8));
    }
    return c;
  };
  const parts = [];
  parts.push({
    name: "jacket", material: "soft", shape: body, ...boundsFrom([[-0.36, 0.94, -0.19], [0.36, 1.66, 0.2]], 0.02), h: q.body.h * 0.8, tris: Math.round(q.body.tris * 1.25),
    color: withAO(colorB, body, { small: 0.016, large: 0.07, strength: 0.6, occluders: capsule([0, 1.4, -0.012], [0, 1.66, -0.012], 0.04, 0.045) }),
    weights: bodyWeights(BODY_BONES), lockBorder: true
  });
  // white tee: the crew neck and the chest seen through the open zip, tucked 1.3 cm under the jacket
  const teeCore = intersect(intersect(mass, plane([0, 1.22, 0], [0, -1, 0]), 0.01), ellipsoid(0, 1.42, 0.07, 0.1, 0.13, 0.11), 0.01);
  const teeBody = { c: teeCore.c, r: teeCore.r, d: (x, y, z) => teeCore.d(x, y, z) + 0.013 };
  const teeShape = union(0.008, teeBody, torus([0, 1.468, -0.002], norm3([0, 0.93, 0.34]), 0.047, 0.0115));
  parts.push({
    name: "shirt", material: "soft", shape: teeShape, ...boundsFrom([[-0.14, 1.2, -0.12], [0.14, 1.54, 0.14]], 0.02), h: q.small.h, tris: q.small.tris * 2,
    color: withAO(() => TEE, teeShape, { small: 0.012, large: 0.05, strength: 0.5, occluders: body }), weights: bodyWeights(["chest", "neck", "spine"]), lockBorder: false
  });
  return parts;
}

function trousersAndShoes(q) {
  const parts = [];
  let jeans = legs({ width: 0.9 });
  // rolled cuffs: a soft ring at each ankle (the inner radius stays above the cut-out for the shoe)
  const rolls = [-1, 1].map((s) => torus([s * 0.1 * 0.9, 0.108, -0.01], [0, 1, 0], 0.0535, 0.0112));
  jeans = union(0.006, jeans, ...rolls);
  jeans = displace(jeans, softFolds({ amp: 0.0026, scale: 1.3 }));
  parts.push({
    name: "jeans", material: "soft", shape: jeans, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.04, 0.2]], 0.02), h: q.legs.h, tris: q.legs.tris,
    color: withAO((p) => {
      // lighter where the fabric stretches over the knees and thighs, a touch deeper in the cuffs
      const k = smoothstep(0.2, 0.55, p[1]) * 0.05;
      const cuff = (1 - smoothstep(0.08, 0.14, p[1])) * 0.05;
      return [JEANS[0] + k - cuff, JEANS[1] + k - cuff, JEANS[2] + k - cuff * 0.8];
    }, jeans, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false
  });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({
      name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: q.shoe.tris,
      color: withAO((p) => {
        if (p[1] < 0.012) return INK; // outsole
        if (p[1] < 0.036) return [0.95, 0.94, 0.9]; // clean white midsole
        if (p[2] < -0.032 && p[1] > 0.04 && p[1] < 0.1) return CORAL; // heel tab
        return [0.93, 0.92, 0.89];
      }, sh, { strength: 0.45 }), rigid: bone, lockBorder: false
    });
  }
  return parts;
}

function garments(ctx) {
  const { q } = ctx;
  return [...bomber(q), ...trousersAndShoes(q)];
}

export default {
  id: "visitor-a",
  skin: SKIN,
  headScale: HS_A,
  headBuilder: buildHeadV2,
  headAO: 0.3,
  // customers are decor but must hold the same face quality as the boss: a finer head than the shared budgets
  lods: { hi: { head: { h: 0.0015, tris: 24000 } }, lo: { head: { h: 0.0019, tris: 13000 }, brow: { h: 0.0014, tris: 420 } } },
  // taller and leaner than the boss: a longer, squarer face, a stronger jaw and chin, calmer mouth, same heavy brows and big ears
  head: { skin: SKIN, lipColor: [0.46, 0.25, 0.22], blush: 0.85, faceW: 0.97, lowerW: 1.0, faceLen: 1.07, jaw: 1.1, chin: 1.1, cheek: 0.82, nose: 0.9, noseLen: 0.92, noseTip: 0.95, noseBridge: 0.95, lip: 0.95, lipFull: 1.08, mouthW: 0.95, mouthDrop: 0.3, ear: 1.1, neck: 0.95 },
  brows: { slab: true, color: [0.05, 0.036, 0.036], thick: 1.08, arch: 0.8, tilt: 0.2 },
  eyes: { iris: [0.15, 0.09, 0.055], size: 0.86, lid: 0.38, lowerLid: -0.1, irisR: 51, pupil: 0.5, lidScale: 1.04 },
  style: { skin: SKIN, lidRim: [0.07, 0.04, 0.04] },
  hair, garments
};
