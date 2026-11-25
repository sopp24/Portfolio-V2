// Visitor B — a young woman browsing the CD shelves: mustard jacket, hair in a bun, headphones (runtime).
import { ellipsoid, ellipsoidRot, capsule, torus, strand, union, subtract, intersect, displace, plane, fromFn, smoothstep, clamp, noise3, sphere } from "../sdf.js";
import { norm3 } from "../util.js";
import { withAO, boundsFrom, hairLine, scalpCap, clump, lockSet, torsoMass, sleeve, foldField, legs, shoe, bodyWeights, BODY_BONES, LEG_BONES } from "../parts.js";

const SKIN = [0.62, 0.42, 0.32];
const HAIR = [0.06, 0.045, 0.045];
const JACKET = [0.82, 0.6, 0.18];

function hair(ctx) {
  const { q, HS, hc, local } = ctx;
  const line = hairLine({ front: 0.054, sideRecede: 0.012, side: 0.0, back: -0.035 });
  const cap = scalpCap({ expand: 0.0075, line, topVolume: 0.012 });
  const C = (pts, w, t, color) => clump(pts, w, t, color || HAIR);
  const clumps = [
    // swept-back strands towards the bun
    C([[-0.04, 0.098, 0.05], [-0.03, 0.125, 0.0], [-0.01, 0.13, -0.05], [0.0, 0.118, -0.08]], [0.03, 0.02], [0.014, 0.012]),
    C([[0.04, 0.098, 0.05], [0.03, 0.125, 0.0], [0.01, 0.13, -0.05], [0.0, 0.118, -0.08]], [0.03, 0.02], [0.014, 0.012]),
    // side-swept fringe
    C([[-0.01, 0.112, 0.06], [0.03, 0.115, 0.1], [0.06, 0.098, 0.108], [0.082, 0.064, 0.09]], [0.026, 0.006], [0.012, 0.004]),
    C([[-0.04, 0.1, 0.03], [-0.08, 0.08, 0.05], [-0.09, 0.04, 0.045], [-0.085, 0.0, 0.05]], [0.026, 0.008], [0.012, 0.004]),
    // sides tucked behind the ears
    C([[-0.06, 0.07, -0.01], [-0.092, 0.03, -0.03], [-0.085, -0.02, -0.06], [-0.05, -0.04, -0.09]], [0.036, 0.012], [0.014, 0.005]),
    C([[0.06, 0.07, -0.01], [0.092, 0.03, -0.03], [0.085, -0.02, -0.06], [0.05, -0.04, -0.09]], [0.036, 0.012], [0.014, 0.005]),
    // nape
    C([[0.0, 0.08, -0.085], [0.0, 0.04, -0.112], [0.0, -0.01, -0.1], [0.0, -0.04, -0.08]], [0.05, 0.02], [0.014, 0.005])
  ];
  const set = lockSet(clumps, HAIR, { k: 0.006 });
  const bun = union(0.012, ellipsoid(0, 0.128, -0.082, 0.05, 0.046, 0.046), torus([0, 0.128, -0.082], norm3([0, 0.3, 1]), 0.04, 0.011), ellipsoid(0, 0.105, -0.075, 0.04, 0.03, 0.04));
  const shape = union(0.01, cap, set.shape, bun);
  const world = ctx.place(shape);
  return [{
    name: "hair", material: "hair", shape: world, min: [-0.19 * HS + hc[0], -0.1 * HS + hc[1], -0.17 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.2 * HS + hc[1], 0.16 * HS + hc[2]],
    h: q.hair.h, tris: q.hair.tris, color: withAO((p) => { const lp = local(p); const c = set.colorAt(lp); const sh = clamp((lp[1] - 0.04) * 3, 0, 1) * 0.04; return [c[0] + sh, c[1] + sh, c[2] + sh]; }, world, { small: 0.01, large: 0.04, strength: 0.6 }),
    rigid: "head", lockBorder: true
  }];
}

function garments(ctx) {
  const { q } = ctx;
  const parts = [];
  const mass = torsoMass({ width: 0.9, chest: 0.96, belly: 0.98, lowerCut: 0.97 });
  const slL = sleeve(1, { r: [0.052, 0.046, 0.041], cuff: 0.005 }), slR = sleeve(-1, { r: [0.052, 0.046, 0.041], cuff: 0.005 });
  const stand = torus([0, 1.49, -0.006], [0, 1, 0], 0.057, 0.022);
  let jacket = union(0.05, mass, slL.shape, slR.shape, stand);
  jacket = subtract(jacket, capsule([0, 1.43, -0.008], [0, 1.64, -0.01], 0.043, 0.043), 0.008);
  jacket = subtract(jacket, capsule([0, 1.455, 0.112], [0, 0.98, 0.118], 0.0022, 0.0022), 0.002); // zip
  jacket = subtract(jacket, ellipsoidRot(0, 1.46, 0.1, 0.03, 0.04, 0.04, 0.3, 0, 0), 0.01);
  for (const s of [-1, 1]) jacket = subtract(jacket, capsule([s * 0.085, 1.06, 0.1], [s * 0.08, 1.0, 0.108], 0.0025, 0.0025), 0.002);
  jacket = displace(jacket, foldField({ amp: 0.002 }));
  parts.push({ name: "jacket", material: "cloth", shape: jacket, ...boundsFrom([[-0.32, 0.94, -0.17], [0.32, 1.62, 0.17]], 0.02), h: q.body.h, tris: q.body.tris, color: withAO((p) => { const v = Math.sin(p[1] * 80) * 0.008; return [JACKET[0] + v, JACKET[1] + v, JACKET[2] + v]; }, jacket, { small: 0.014, large: 0.06, strength: 0.55 }), weights: bodyWeights(BODY_BONES), lockBorder: true });
  // the tee only needs to exist under the neck opening (front chest): elsewhere it would poke through the jacket when an arm is raised
  const tee = intersect(intersect(mass, plane([0, 1.2, 0], [0, -1, 0]), 0.01), ellipsoid(0, 1.44, 0.07, 0.1, 0.12, 0.1), 0.01);
  const teeShape = union(0.008, { c: tee.c, r: tee.r, d: (x, y, z) => tee.d(x, y, z) + 0.014 }, torus([0, 1.47, 0], norm3([0, 0.94, 0.3]), 0.046, 0.011));
  parts.push({ name: "shirt", material: "cloth", shape: teeShape, ...boundsFrom([[-0.14, 1.2, -0.12], [0.14, 1.54, 0.14]], 0.02), h: q.small.h, tris: q.small.tris * 2, color: withAO(() => [0.8, 0.79, 0.76], teeShape, { strength: 0.3 }), weights: bodyWeights(["chest", "neck", "spine"]), lockBorder: false });
  const pants = displace(legs({ width: 0.95 }), (x, y, z) => 0.0016 * (noise3(x * 25, y * 25, z * 25) - 0.5));
  parts.push({ name: "pants", material: "denim", shape: pants, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.04, 0.2]], 0.02), h: q.legs.h, tris: q.legs.tris, color: withAO(() => [0.1, 0.1, 0.12], pants, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: q.shoe.tris, color: withAO((p) => (p[1] < 0.032 ? [0.9, 0.86, 0.78] : [0.78, 0.2, 0.18]), sh, { strength: 0.5 }), rigid: bone, lockBorder: false });
  }
  return parts;
}

export default {
  id: "visitor-b",
  skin: SKIN,
  handSize: 0.94,
  headScale: 1.08,
  head: { skin: SKIN, brow: 0.8, browSlope: 0.8, nose: 0.74, noseLen: 0.66, noseTip: 0.95, lip: 1.3, lipFull: 1.35, mouthW: 1.05, cheek: 1.16, jaw: 0.95, chin: 0.95, ear: 0.9, faceW: 1.0, neck: 0.9, eyeGap: 0.0315, blush: 0.4, lipColor: [0.58, 0.26, 0.27] },
  brows: { thick: 0.85, arch: 1.6, tilt: 0.3, color: [0.06, 0.045, 0.04], y: 0.002 },
  eyes: { iris: [0.2, 0.12, 0.07], size: 1.15, lid: 0.62 },
  style: { skin: SKIN },
  hair, garments
};
