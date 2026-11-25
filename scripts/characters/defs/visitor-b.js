// Visitor B — a young woman at the CD shelves: mustard leather jacket, voluminous curly bob, headphones (runtime).
// Original character built with the same realistic-style kit as visitor A.
import { ellipsoid, union, noise3, clamp } from "../sdf.js";
import { withAO, boundsFrom, hairLine, scalpCap, tendril, leatherJacketParts, legs, shoe, bodyWeights, LEG_BONES } from "../parts.js";

const SKIN = [0.7, 0.47, 0.35];
const HAIR = [0.03, 0.022, 0.02];
const LEATHER = [0.74, 0.5, 0.1];
const RIB = [0.2, 0.13, 0.07];
const PANTS = [0.07, 0.07, 0.085];
const noise = (x, y, z) => noise3(x * 18, y * 18, z * 18);

function hair(ctx) {
  const { q, HS, hc, local } = ctx;
  const line = hairLine({ front: 0.066, sideRecede: 0.014, side: -0.044, back: -0.082 });
  // extra mass behind and beside the head turns the cap into a bob
  const extras = [
    ellipsoid(0, -0.02, -0.055, 0.084, 0.078, 0.07),
    ellipsoid(0.072, -0.012, -0.012, 0.03, 0.07, 0.062),
    ellipsoid(-0.072, -0.012, -0.012, 0.03, 0.07, 0.062)
  ];
  const cap = scalpCap({ expand: 0.03, line, topVolume: 0.026, flow: null, feather: 0.034, curl: { scale: 90, amp: 0.0095 }, extras });
  const T = (start, dir, len, r, o) => tendril(start, dir, len, r, { color: HAIR, ...o });
  const tendrils = [
    // side-swept fringe
    T([-0.03, 0.104, 0.084], [-0.1, -0.55, 0.3], 0.042, 0.0031, { turns: 2.6, curl: 0.0075 }),
    T([-0.005, 0.108, 0.09], [0.05, -0.55, 0.3], 0.048, 0.003, { turns: 3.0, curl: 0.0072 }),
    T([0.02, 0.106, 0.088], [0.22, -0.5, 0.26], 0.05, 0.003, { turns: 2.6, curl: 0.0072 }),
    T([0.045, 0.096, 0.078], [0.4, -0.55, 0.2], 0.044, 0.003, { turns: 2.4, curl: 0.007 }),
    // ringlets framing the face
    T([-0.082, 0.02, 0.03], [-0.15, -1, 0.15], 0.07, 0.0034, { turns: 3.6, curl: 0.0085, droop: 0.01 }),
    T([0.082, 0.02, 0.03], [0.15, -1, 0.15], 0.07, 0.0034, { turns: 3.6, curl: 0.0085, droop: 0.01 }),
    T([-0.075, 0.0, -0.02], [-0.1, -1, -0.1], 0.06, 0.0034, { turns: 3.2, curl: 0.0085 }),
    T([0.075, 0.0, -0.02], [0.1, -1, -0.1], 0.06, 0.0034, { turns: 3.2, curl: 0.0085 })
  ];
  const shape = union(0.005, cap, ...tendrils.map((t) => t.shape));
  const world = ctx.place(shape);
  const colorFn = (p) => { const lp = local(p); const lift = clamp((lp[1] - 0.05) * 2.4, 0, 1) * 0.008; return [HAIR[0] + lift, HAIR[1] + lift * 0.8, HAIR[2] + lift * 0.7]; };
  return [{
    name: "hair", material: "hair", shape: world, min: [-0.2 * HS + hc[0], -0.13 * HS + hc[1], -0.18 * HS + hc[2]], max: [0.2 * HS + hc[0], 0.2 * HS + hc[1], 0.17 * HS + hc[2]],
    h: q.hair.h * 0.72, tris: Math.round(q.hair.tris * 2.2), color: withAO(colorFn, world, { small: 0.008, large: 0.04, strength: 0.75 }), rigid: "head", lockBorder: true
  }];
}

function garments(ctx) {
  const { q } = ctx;
  const parts = [];
  parts.push(...leatherJacketParts(q, { leather: LEATHER, rib: RIB, tee: [0.86, 0.84, 0.8], width: 0.9 }));
  const pants = legs({ width: 0.92 });
  parts.push({ name: "pants", material: "denim", shape: pants, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.04, 0.2]], 0.02), h: q.legs.h, tris: q.legs.tris, color: withAO((p) => { const n = (noise(p[0] * 2, p[1] * 2, p[2] * 2) - 0.5) * 0.03; return [PANTS[0] + n, PANTS[1] + n, PANTS[2] + n]; }, pants, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: q.shoe.tris, color: withAO((p) => (p[1] < 0.032 ? [0.9, 0.86, 0.78] : [0.7, 0.14, 0.12]), sh, { strength: 0.5 }), rigid: bone, lockBorder: false });
  }
  return parts;
}

export default {
  id: "visitor-b",
  skin: SKIN,
  handSize: 0.94,
  headScale: 1.0,
  head: { skin: SKIN, brow: 0.7, browSlope: 0.6, nose: 0.7, noseLen: 0.7, noseTip: 0.95, lip: 1.3, lipFull: 1.35, mouthW: 1.08, cheek: 1.05, jaw: 0.92, chin: 0.95, ear: 0.9, faceW: 0.98, neck: 1.0, eyeGap: 0.0315, blush: 0.3, liner: 0.5, lipColor: [0.5, 0.18, 0.2] },
  brows: { thick: 0.62, arch: 1.7, tilt: 0.2, color: [0.04, 0.03, 0.028], y: 0.002 },
  eyes: { iris: [0.16, 0.09, 0.05], size: 1.12, lid: 0.52 },
  style: { skin: SKIN },
  hair, garments
};
