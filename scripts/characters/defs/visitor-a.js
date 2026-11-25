// Visitor A — a young man in a burgundy leather bomber jacket, curly cropped hair (realistic-proportion style).
// Original character: the look follows the realism of the art-direction reference (proportions, curly volume,
// glossy leather, dark glossy eyes) without depicting any real person.
import { ellipsoid, ellipsoidRot, capsule, torus, strand, union, subtract, intersect, displace, plane, noise3, clamp, smoothstep } from "../sdf.js";
import { norm3 } from "../util.js";
import { withAO, boundsFrom, hairLine, scalpCap, tendril, leatherJacketParts, legs, shoe, bodyWeights, LEG_BONES } from "../parts.js";

const SKIN = [0.5, 0.325, 0.235];
const HAIR = [0.026, 0.021, 0.02];
const LEATHER = [0.34, 0.045, 0.055];
const RIB = [0.045, 0.04, 0.042];
const JEANS = [0.075, 0.08, 0.1];
const noise = (x, y, z) => noise3(x * 18, y * 18, z * 18);

function hair(ctx) {
  const { q, HS, hc, local } = ctx;
  const line = hairLine({ front: 0.064, sideRecede: 0.016, side: 0.004, back: -0.05 });
  const cap = scalpCap({ expand: 0.027, line, topVolume: 0.03, flow: null, feather: 0.034, curl: { scale: 96, amp: 0.0085 } });
  const T = (start, dir, len, r, o) => tendril(start, dir, len, r, { color: HAIR, ...o });
  const tendrils = [
    // fringe curls falling on the forehead
    T([-0.045, 0.1, 0.082], [-0.15, -0.5, 0.3], 0.04, 0.0031, { turns: 2.6, curl: 0.0075, droop: 0.012 }),
    T([-0.02, 0.105, 0.088], [-0.05, -0.55, 0.26], 0.046, 0.0029, { turns: 3.0, curl: 0.0072, droop: 0.016 }),
    T([0.008, 0.107, 0.09], [0.05, -0.55, 0.3], 0.04, 0.003, { turns: 2.4, curl: 0.0078, droop: 0.012 }),
    T([0.032, 0.103, 0.085], [0.2, -0.5, 0.26], 0.044, 0.0029, { turns: 2.8, curl: 0.0072, droop: 0.014 }),
    T([0.054, 0.092, 0.074], [0.35, -0.55, 0.2], 0.036, 0.0029, { turns: 2.2, curl: 0.0068, droop: 0.01 }),
    // temples
    T([-0.078, 0.05, 0.05], [-0.1, -1, 0.1], 0.04, 0.003, { turns: 2.2, curl: 0.0068 }),
    T([0.078, 0.05, 0.05], [0.1, -1, 0.1], 0.04, 0.003, { turns: 2.2, curl: 0.0068 }),
    // a few loose curls on the crown
    T([-0.03, 0.125, 0.0], [-0.4, 0.5, 0.3], 0.04, 0.0028, { turns: 2.4, curl: 0.0075, droop: -0.005 }),
    T([0.04, 0.12, 0.02], [0.5, 0.5, 0.2], 0.04, 0.0028, { turns: 2.4, curl: 0.0075, droop: -0.005 })
  ];
  const shape = union(0.005, cap, ...tendrils.map((t) => t.shape));
  const world = ctx.place(shape);
  const colorFn = (p) => {
    const lp = local(p);
    const lift = clamp((lp[1] - 0.05) * 2.4, 0, 1) * 0.008; // slightly browner on top where light hits
    return [HAIR[0] + lift, HAIR[1] + lift * 0.8, HAIR[2] + lift * 0.7];
  };
  return [{
    name: "hair", material: "hair", shape: world, min: [-0.19 * HS + hc[0], -0.1 * HS + hc[1], -0.17 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.2 * HS + hc[1], 0.17 * HS + hc[2]],
    h: q.hair.h * 0.72, tris: Math.round(q.hair.tris * 2.2), color: withAO(colorFn, world, { small: 0.008, large: 0.04, strength: 0.75 }), rigid: "head", lockBorder: true
  }];
}

function garments(ctx) {
  const { q } = ctx;
  const parts = [];
  parts.push(...leatherJacketParts(q, { leather: LEATHER, rib: RIB, width: 0.92 }));
  // ---------------- slim black jeans + white sneakers
  const jeans = displace(legs({ width: 0.93 }), (x, y, z) => 0.0018 * (noise(x, y, z) - 0.5) + 0.0016 * Math.sin(y * 150 + noise(x, y, z) * 6) * Math.exp(-(((y - 0.14) / 0.08) ** 2)));
  parts.push({ name: "jeans", material: "denim", shape: jeans, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.04, 0.2]], 0.02), h: q.legs.h, tris: q.legs.tris, color: withAO((p) => { const n = (noise(p[0] * 2, p[1] * 2, p[2] * 2) - 0.5) * 0.03; return [JEANS[0] + n, JEANS[1] + n, JEANS[2] + n]; }, jeans, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: q.shoe.tris, color: withAO((p) => (p[1] < 0.034 ? [0.78, 0.76, 0.7] : [0.88, 0.88, 0.86]), sh, { strength: 0.5 }), rigid: bone, lockBorder: false });
  }
  return parts;
}

export default {
  id: "visitor-a",
  skin: SKIN,
  headScale: 1.0,
  head: { skin: SKIN, brow: 0.85, nose: 0.74, noseLen: 0.7, noseTip: 0.95, lip: 1.25, lipFull: 1.3, mouthW: 1.12, cheek: 1.0, jaw: 1.0, chin: 1.0, eyeGap: 0.0315, blush: 0.2, browSlope: 0.2, faceW: 1.0, hollow: 0, neck: 1.1, liner: 0.35, lipColor: [0.36, 0.17, 0.16] },
  brows: { thick: 0.7, arch: 1.6, tilt: 0.15, color: [0.035, 0.026, 0.024] },
  eyes: { iris: [0.13, 0.075, 0.045], size: 1.1, lid: 0.5 },
  style: { skin: SKIN },
  hair, garments
};
