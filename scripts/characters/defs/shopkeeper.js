// The boss / shopkeeper ("le patron de la boutique") — art direction v2.
// A young man in the stylised sculpt language of the owner's reference image (a clean "painted" 3D sculpt): long narrow face,
// heavy straight dark brows, small heavy-lidded dark eyes, big ears, rosy blush, slender neck; near-black swept hair made of a few
// big smooth swooping clumps (side-swept quiff, a curl falling on the forehead, one golden streak); desaturated-blue hoodie with a
// thick sculpted hood collar, drawstrings, white tee. Original character: no real person is depicted.
import { ellipsoid, union, smoothstep } from "../sdf.js";
import { buildHeadV2 } from "../head-v2.js";
import { withAO, boundsFrom, hairLine, scalpCap, clump, scalpTube, scalpLeaf, scalpPoint, hairShell, lockSet, hoodieParts, legs, shoe, bodyWeights, LEG_BONES, surfaceY } from "../parts.js";
import { noise3 } from "../sdf.js";

const SKIN = [0.85, 0.67, 0.58];
const HAIR = [0.082, 0.066, 0.072];
const GOLD = [0.8, 0.6, 0.34];
const HOOD = [0.3, 0.37, 0.46];

function hair(ctx) {
  const { q, HS, hc, local, head } = ctx;
  const sk = head.raw;
  const C = [0, 0.02, -0.01]; // ribbons are thin along the direction away from this point (they lie on the scalp like clumps)
  // a point on the scalp at (x, z) lifted by `lift` metres
  const sp = (x, z, lift) => [x, surfaceY(sk, x, z, 0.2, -0.05) + lift, z];

  // base shell: the skull offset by a few mm (thin at the hairline so it feathers into the skin), inflated by two smooth thickness fields:
  // a big pompadour on the front-top and heavy side volumes above the ears (the wide, swept silhouette of the reference).
  const line = hairLine({ front: 0.058, sideRecede: 0.012, side: 0.034, back: -0.05 });
  const g3 = (x, y, z, c, sx, sy, sz) => Math.exp(-(((x - c[0]) / sx) ** 2 + ((y - c[1]) / sy) ** 2 + ((z - c[2]) / sz) ** 2));
  const extra = (x, y, z) => 0.02 * g3(x, y, z, [-0.006, 0.112, 0.036], 0.05, 0.034, 0.055) + 0.016 * g3(x, y, z, [-0.07, 0.07, 0.0], 0.03, 0.045, 0.06) + 0.012 * g3(x, y, z, [0.072, 0.07, 0.0], 0.03, 0.045, 0.06) + 0.008 * g3(x, y, z, [0, 0.08, -0.07], 0.07, 0.06, 0.05);
  const cap = hairShell(sk, line, { thick: 0.0062, thin: 0.0022, extra, volume: ellipsoid(-0.004, 0.118, 0.04, 0.05, 0.03, 0.05), kVol: 0.03 });
  const surf = cap.solid; // locks are laid on the hair surface, not on the bare skull

  // Layered leaf-shaped clumps (wide, thin, pointed at both ends) lying on the hair surface, all fanning out from the parting at the
  // front-top; points are [azimuth, elevation] on the skull (az 0 = ahead, +90 = viewer's right, el 90 = crown). The outermost clumps
  // lift off the scalp at their tips (the flicks of the reference). T() keeps round tubes for the small stuff.
  const L = (angles, w, t, color = HAIR, o = {}) => scalpLeaf(surf, angles, w, t, color, o);
  const T = (angles, radii, color = HAIR, o = {}) => scalpTube(surf, angles, radii, color, { sink: 0.35, ...o });
  const locks = [
    // right side (+x, viewer's right): the big swoop from the parting over the temple, curling out and up at the end
    L([[30, 62], [46, 58], [64, 46], [84, 26], [98, 12]], 0.032, 0.012, HAIR, { flick: 0.018 }),
    L([[22, 42], [38, 41], [56, 31], [76, 11]], 0.024, 0.01),
    L([[16, 25], [34, 24], [52, 18], [72, 8]], 0.027, 0.011, HAIR, { lift: 0.6 }),
    L([[10, 76], [44, 70], [76, 54], [104, 30]], 0.03, 0.011),
    L([[30, 88], [70, 82], [104, 64], [132, 42]], 0.03, 0.011),
    // left side (-x, viewer's left): bigger, with the long flick and the golden streak
    L([[-30, 66], [-48, 64], [-68, 51], [-88, 28], [-102, 12]], 0.038, 0.013, HAIR, { flick: 0.028 }),
    L([[-34, 58], [-50, 58], [-68, 48], [-88, 28], [-106, 8]], 0.02, 0.0125, GOLD, { flick: 0.026, over: true, lift: 1.1 }),
    L([[-22, 42], [-38, 41], [-56, 31], [-76, 11]], 0.024, 0.01),
    L([[-16, 25], [-34, 24], [-52, 18], [-72, 8]], 0.027, 0.011, HAIR, { lift: 0.6 }),
    L([[-10, 78], [-46, 73], [-78, 57], [-106, 33]], 0.03, 0.011),
    L([[-30, 88], [-72, 82], [-106, 64], [-134, 42]], 0.03, 0.011),
    // crown, swirling back
    L([[180, 84], [176, 62], [174, 40]], 0.034, 0.011),
    L([[-70, 84], [-120, 78], [-150, 60], [-166, 38]], 0.03, 0.011),
    L([[70, 84], [120, 78], [150, 60], [166, 38]], 0.03, 0.011),
    // the curl falling on the forehead (crescent), tip touching the brow
    clump([[0.0, 0.126, 0.07], [-0.042, 0.138, 0.1], [-0.05, 0.088, 0.124], [0.01, 0.054, 0.104]], [0.0165, 0.0026], [0.0115, 0.0026], HAIR, { n: 22, center: C }),
  ];
  const set = lockSet(locks, HAIR, { k: 0.011 });
  const hairLocal = union(0.007, cap, set.shape);
  const hairWorld = ctx.place(hairLocal);
  const bounds = { min: [-0.19 * HS + hc[0], -0.2 * HS + hc[1], -0.17 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.2 * HS + hc[1], 0.17 * HS + hc[2]] };
  const parts = [{
    name: "hair", material: "hair", shape: hairWorld, ...bounds, h: q.hair.h * 0.72, tris: Math.round(q.hair.tris * 1.5),
    color: withAO((p) => {
      const lp = local(p);
      const c = set.colorAt(lp);
      return c;
    }, hairWorld, { small: 0.008, large: 0.035, strength: 0.5 }),
    rigid: "head", lockBorder: true
  }];
  return parts;
}

function garments(ctx) {
  const { q } = ctx;
  const parts = hoodieParts(q, { color: HOOD, width: 0.8, cowl: 0.95, skin: SKIN });
  // jeans + sneakers (hidden behind the counter, kept so nothing is ever see-through)
  const trousers = legs({ width: 1.0 });
  parts.push({ name: "trousers", material: "cloth", shape: trousers, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.0, 0.2]], 0.02), h: q.legs.h * 1.2, tris: Math.round(q.legs.tris * 0.6), color: withAO(() => [0.16, 0.18, 0.24], trousers, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: Math.round(q.shoe.tris * 0.6), color: () => [0.86, 0.85, 0.82], rigid: bone, lockBorder: false });
  }
  return parts;
}

export default {
  id: "shopkeeper",
  headScale: 1.28,
  skin: SKIN,
  headBuilder: buildHeadV2,
  headAO: 0.3,
  // the face is the hero: finer head and brows than the shared LOD budgets
  lods: { hi: { head: { h: 0.0014, tris: 26000 } }, lo: { head: { h: 0.0021, tris: 11000 }, brow: { h: 0.0013, tris: 480 } } },
  head: { skin: SKIN, mouthW: 0.85, lip: 0.85, lipFull: 0.9, faceW: 1, lowerW: 0.96, faceLen: 1.0, cheek: 0.85, nose: 0.8, noseLen: 0.85, noseTip: 0.86, noseBridge: 0.9, chin: 1.05, jaw: 0.95, ear: 1.15 },
  brows: { slab: true, color: [0.075, 0.058, 0.06], thick: 1, arch: 1, tilt: 0.4 },
  eyes: { iris: [0.17, 0.17, 0.12], size: 0.84, lid: 0.34, lowerLid: -0.12, irisR: 52, pupil: 0.52, lidScale: 1.04 },
  style: { skin: SKIN, lidRim: [0.1, 0.06, 0.06] },
  hair, garments
};
