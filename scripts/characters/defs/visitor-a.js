// Visitor A — the young man in the blue hoodie (art-direction reference: stylised, sculpted hair, heavy brows).
import { ellipsoid, ellipsoidRot, capsule, torus, strand, union, subtract, intersect, displace, plane, fromFn, smoothstep, clamp, mix } from "../sdf.js";
import { translate, norm3, sub3, add3, scale3 } from "../util.js";
import { HEAD_C, JOINTS as J } from "../rig.js";
import { hex, tint, withAO, boundsFrom, hairLine, scalpCap, lock, clump, lockSet, torsoMass, sleeve, foldField, legs, shoe, bodyWeights, BODY_BONES, LEG_BONES } from "../parts.js";
import { proximityWeights } from "../rig.js";

const SKIN = [0.87, 0.63, 0.5];
const HAIR = [0.085, 0.065, 0.06];
const GOLD = [0.62, 0.45, 0.22];
const HOODIE = [0.3, 0.36, 0.45];
const JEANS = [0.15, 0.19, 0.27];

function hair(ctx) {
  const { q, HS, hc, local } = ctx;
  const line = hairLine({ front: 0.05, sideRecede: 0.02, side: 0.012, back: -0.045 });
  const cap = scalpCap({ expand: 0.0075, line, topVolume: 0.02 });
  const C = (pts, w, t, color) => clump(pts, w, t, color || HAIR);
  const clumps = [
    // big swept quiff, crown -> forehead
    C([[-0.03, 0.092, -0.05], [-0.01, 0.128, 0.01], [0.03, 0.128, 0.07], [0.05, 0.1, 0.1]], [0.036, 0.012], [0.02, 0.006]),
    C([[-0.05, 0.1, -0.02], [-0.03, 0.13, 0.03], [0.0, 0.134, 0.08], [0.024, 0.108, 0.112]], [0.032, 0.011], [0.018, 0.006]),
    // curl on the forehead
    C([[0.012, 0.102, 0.075], [0.0, 0.1, 0.112], [-0.012, 0.086, 0.12], [-0.008, 0.072, 0.112]], [0.024, 0.008], [0.014, 0.005]),
    // temple locks
    C([[-0.045, 0.1, 0.015], [-0.085, 0.078, 0.045], [-0.093, 0.03, 0.03], [-0.072, 0.008, 0.046]], [0.032, 0.008], [0.015, 0.005]),
    C([[0.042, 0.104, 0.0], [0.086, 0.082, 0.02], [0.098, 0.042, 0.004], [0.084, 0.016, 0.03]], [0.032, 0.008], [0.015, 0.005]),
    // golden streak
    C([[-0.02, 0.112, 0.03], [-0.045, 0.12, 0.062], [-0.07, 0.105, 0.076], [-0.08, 0.08, 0.07]], [0.032, 0.012], [0.015, 0.008], GOLD),
    // fringe over the forehead
    C([[0.0, 0.108, 0.03], [0.032, 0.12, 0.088], [0.07, 0.102, 0.104], [0.094, 0.07, 0.07]], [0.042, 0.01], [0.016, 0.005]),
    C([[-0.01, 0.112, 0.05], [-0.034, 0.112, 0.1], [-0.056, 0.092, 0.112], [-0.068, 0.07, 0.092]], [0.032, 0.008], [0.014, 0.005]),
    // back / nape
    C([[0.0, 0.09, -0.075], [0.0, 0.05, -0.112], [0.0, -0.01, -0.104], [0.0, -0.05, -0.088]], [0.06, 0.02], [0.018, 0.006]),
    C([[-0.05, 0.085, -0.05], [-0.092, 0.05, -0.082], [-0.088, 0.0, -0.078], [-0.07, -0.032, -0.062]], [0.04, 0.014], [0.016, 0.005]),
    C([[0.05, 0.085, -0.05], [0.092, 0.05, -0.082], [0.088, 0.0, -0.078], [0.07, -0.032, -0.062]], [0.04, 0.014], [0.016, 0.005]),
    // a short flyaway on the crown
    C([[-0.02, 0.118, -0.01], [-0.045, 0.14, -0.012], [-0.06, 0.146, -0.02], [-0.07, 0.142, -0.032]], [0.016, 0.004], [0.01, 0.003])
  ];
  const set = lockSet(clumps, HAIR, { k: 0.006 });
  const shape = union(0.008, cap, set.shape);
  const world = ctx.place(shape);
  const colorFn = (p) => {
    const lp = local(p);
    const c = set.colorAt(lp);
    const sheen = clamp((lp[1] - 0.04) * 3, 0, 1) * 0.05;
    return [c[0] + sheen, c[1] + sheen * 0.8, c[2] + sheen * 0.6];
  };
  return [{
    name: "hair", material: "hair", shape: world, min: [-0.19 * HS + hc[0], -0.1 * HS + hc[1], -0.16 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.19 * HS + hc[1], 0.16 * HS + hc[2]],
    h: q.hair.h, tris: q.hair.tris, color: withAO(colorFn, world, { small: 0.01, large: 0.04, strength: 0.6 }), rigid: "head", lockBorder: true
  }];
}

function garments(ctx) {
  const { q } = ctx;
  const parts = [];
  // ---------------- hoodie
  const mass = torsoMass({ width: 0.96, chest: 1.0, belly: 1.04, lowerCut: 0.93 });
  const slL = sleeve(1, { r: [0.059, 0.051, 0.044], cuff: 0.004 }), slR = sleeve(-1, { r: [0.059, 0.051, 0.044], cuff: 0.004 });
  const collar = torus([0, 1.472, -0.012], norm3([0, 0.89, 0.45]), 0.088, 0.027);
  const hoodBack = ellipsoid(0, 1.455, -0.08, 0.09, 0.064, 0.05);
  const pocket = ellipsoid(0, 1.062, 0.1, 0.118, 0.052, 0.032);
  let hood = union(0.05, mass, slL.shape, slR.shape, collar, hoodBack, pocket);
  hood = subtract(hood, capsule([0, 1.42, -0.01], [0, 1.64, -0.014], 0.05, 0.05), 0.012);
  hood = subtract(hood, ellipsoidRot(0, 1.425, 0.105, 0.036, 0.06, 0.06, 0.35, 0, 0), 0.016); // V opening
  // pocket slits
  for (const s of [-1, 1]) hood = subtract(hood, capsule([s * 0.1, 1.098, 0.108], [s * 0.074, 1.0, 0.118], 0.0026, 0.0026), 0.003);
  const folds = foldField({ amp: 0.0019 });
  hood = displace(hood, folds);
  const hoodColor = withAO((p, n) => {
    const v = (Math.sin(p[1] * 90) * 0.01);
    return [HOODIE[0] + v, HOODIE[1] + v, HOODIE[2] + v];
  }, hood, { small: 0.014, large: 0.06, strength: 0.6 });
  const hb = boundsFrom([[-0.34, 0.9, -0.18], [0.34, 1.62, 0.18]], 0.02);
  parts.push({ name: "hoodie", material: "cloth", shape: hood, ...hb, h: q.body.h, tris: q.body.tris, color: hoodColor, weights: bodyWeights(BODY_BONES), lockBorder: false });

  // ---------------- t-shirt (visible in the V and at the neck)
  const shirtBody = intersect(mass, plane([0, 1.37, 0], [0, -1, 0]), 0.01);
  const shirtShape = union(0.01, { c: shirtBody.c, r: shirtBody.r, d: (x, y, z) => shirtBody.d(x, y, z) + 0.014 }, torus([0, 1.47, 0.002], norm3([0, 0.9, 0.44]), 0.05, 0.012));
  const shirtBounds = boundsFrom([[-0.14, 1.32, -0.12], [0.14, 1.54, 0.14]], 0.02);
  parts.push({ name: "shirt", material: "cloth", shape: shirtShape, ...shirtBounds, h: q.small.h, tris: q.small.tris * 2, color: withAO(() => [0.8, 0.79, 0.75], shirtShape, { strength: 0.3 }), weights: bodyWeights(["chest", "neck", "spine"]), lockBorder: false });

  // ---------------- drawstrings
  const strings = [-1, 1].map((s) => strand([[s * 0.03, 1.436, 0.095], [s * 0.034, 1.385, 0.113], [s * 0.037, 1.332, 0.119], [s * 0.038, 1.295, 0.114]], [0.0046, 0.0046, 0.0046, 0.0066], 0.002));
  const strShape = union(0.003, ...strings);
  parts.push({ name: "strings", material: "cloth", shape: strShape, ...boundsFrom([[-0.06, 1.27, 0.07], [0.06, 1.45, 0.14]], 0.02), h: q.small.h * 0.8, tris: 600, color: () => [0.85, 0.85, 0.82], weights: bodyWeights(["chest", "neck"]), lockBorder: false });

  // ---------------- jeans + shoes
  const jeans = displace(legs({ width: 1 }), (x, y, z) => 0.0022 * ((noise(x, y, z)) - 0.5) + 0.0016 * Math.sin(y * 150 + noise(x, y, z) * 6) * Math.exp(-(((y - 0.14) / 0.08) ** 2)));
  parts.push({ name: "jeans", material: "denim", shape: jeans, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.04, 0.2]], 0.02), h: q.legs.h, tris: q.legs.tris, color: withAO((p) => { const n = (noise(p[0] * 2, p[1] * 2, p[2] * 2) - 0.5) * 0.04; return [JEANS[0] + n, JEANS[1] + n, JEANS[2] + n]; }, jeans, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: q.shoe.tris, color: withAO((p) => (p[1] < 0.034 ? [0.86, 0.8, 0.66] : [0.9, 0.9, 0.9]), sh, { strength: 0.5 }), rigid: bone, lockBorder: false });
  }
  return parts;
}
import { noise3 } from "../sdf.js";
const noise = (x, y, z) => noise3(x * 18, y * 18, z * 18);

export default {
  id: "visitor-a",
  skin: SKIN,
  head: { skin: SKIN, brow: 1.15, nose: 0.74, noseLen: 0.6, noseTip: 0.9, lip: 1.1, lipFull: 1.1, mouthW: 1.15, cheek: 1.12, jaw: 1.02, chin: 1.0, eyeGap: 0.0315, blush: 0.55, browSlope: 0.4, faceW: 1.04, hollow: 0, lipColor: [0.74, 0.38, 0.36] },
  brows: { thick: 1.15, arch: 1, tilt: -0.3, color: [0.08, 0.06, 0.055] },
  eyes: { iris: [0.3, 0.34, 0.26], size: 1.14, lid: 0.6 },
  hair, garments
};
