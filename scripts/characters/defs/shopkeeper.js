// The shopkeeper — a warm, passionate old record-store owner: flat cap, white beard, round glasses (runtime),
// bushy brows, knit cardigan over a cream shirt, bow tie.
import { ellipsoid, ellipsoidRot, capsule, torus, strand, union, subtract, intersect, displace, plane, fromFn, smoothstep, smax, smin, clamp, mix, noise3, sphere } from "../sdf.js";
import { norm3 } from "../util.js";
import { HEAD_C } from "../rig.js";
import { withAO, boundsFrom, hairLine, scalpCap, clump, lockSet, torsoMass, sleeve, foldField, legs, shoe, bodyWeights, BODY_BONES, LEG_BONES } from "../parts.js";
import { headWeights } from "../character-builder.js";

const SKIN = [0.86, 0.64, 0.54];
const WHITE = [0.9, 0.89, 0.86];
const CARDI = [0.22, 0.33, 0.27];
const CREAM = [0.78, 0.73, 0.62];
const TWEED = [0.36, 0.32, 0.27];

function hair(ctx) {
  const { q, HS, hc, local, head } = ctx;
  const parts = [];
  const bounds = { min: [-0.19 * HS + hc[0], -0.22 * HS + hc[1], -0.17 * HS + hc[2]], max: [0.19 * HS + hc[0], 0.17 * HS + hc[1], 0.17 * HS + hc[2]] };
  // ---- flat cap
  const edgeY = (x, z) => 0.032 + 0.028 * smoothstep(0.0, 0.07, z) - 0.006 * smoothstep(0.0, -0.08, z);
  const crown = ellipsoid(0, 0.07, -0.004, 0.09, 0.052, 0.103);
  const frontPanel = ellipsoid(0, 0.07, 0.052, 0.086, 0.04, 0.062);
  const brim = ellipsoidRot(0, 0.06, 0.096, 0.058, 0.0085, 0.046, -0.28, 0, 0);
  const button = ellipsoid(0, 0.119, 0.0, 0.007, 0.005, 0.007);
  const capBase = union(0.02, crown, frontPanel);
  const capCut = fromFn((x, y, z) => smax(capBase.d(x, y, z), edgeY(x, z) - y, 0.003), capBase.c, capBase.r + 0.05);
  const capWithDetail = displace(union(0.008, capCut, brim, button), (x, y, z) => 0.0012 * (noise3(x * 70, y * 70, z * 70) - 0.5));
  const capWorld = ctx.place(capWithDetail);
  parts.push({
    name: "cap", material: "knit", shape: capWorld, ...bounds, h: q.hair.h * 0.9, tris: Math.round(q.hair.tris * 0.55),
    color: withAO((p) => { const lp = local(p); const n = (noise3(lp[0] * 14, lp[1] * 14, lp[2] * 14) - 0.5) * 0.06; return [TWEED[0] + n, TWEED[1] + n, TWEED[2] + n]; }, capWorld, { small: 0.01, large: 0.04, strength: 0.55 }),
    rigid: "head", lockBorder: false
  });
  // ---- white hair around the ears and nape (under the cap)
  const line = hairLine({ front: 0.06, sideRecede: 0.0, side: -0.012, back: -0.05 });
  const cap = scalpCap({ expand: 0.0075, line, topVolume: 0 });
  const tufts = [
    clump([[-0.07, 0.03, 0.0], [-0.09, 0.0, -0.01], [-0.088, -0.03, -0.02], [-0.07, -0.05, -0.03]], [0.026, 0.008], [0.014, 0.005], WHITE),
    clump([[0.07, 0.03, 0.0], [0.09, 0.0, -0.01], [0.088, -0.03, -0.02], [0.07, -0.05, -0.03]], [0.026, 0.008], [0.014, 0.005], WHITE),
    clump([[0.0, 0.03, -0.09], [0.0, -0.01, -0.108], [0.0, -0.045, -0.1], [0.0, -0.07, -0.08]], [0.05, 0.016], [0.015, 0.005], WHITE)
  ];
  const tuftSet = lockSet(tufts, WHITE, { k: 0.006 });
  const hairShape = union(0.008, cap, tuftSet.shape);
  const hairWorld = ctx.place(hairShape);
  parts.push({
    name: "hair", material: "fur", shape: hairWorld, ...bounds, h: q.hair.h, tris: Math.round(q.hair.tris * 0.5),
    color: withAO((p) => { const lp = local(p); const n = (noise3(lp[0] * 90, lp[1] * 90, lp[2] * 90) - 0.5) * 0.06; return [WHITE[0] + n, WHITE[1] + n, WHITE[2] + n * 0.8]; }, hairWorld, { small: 0.01, large: 0.04, strength: 0.5 }),
    rigid: "head", lockBorder: true
  });
  // ---- beard + moustache (skinned like the lower face so it follows the jaw)
  const beardLine = (x) => -0.049 + smoothstep(0.035, 0.07, Math.abs(x)) * 0.052;
  const outer = fromFn((x, y, z) => head.raw.d(x, y, z) - 0.0085 * (1 - smoothstep(-0.022, 0.0, y - beardLine(x))) - 0.0012, head.raw.c, head.raw.r + 0.05);
  const mouthCarve = ellipsoid(0, -0.062, 0.088, 0.027, 0.0135, 0.034);
  const shell = fromFn((x, y, z) => {
    let d = outer.d(x, y, z);
    d = smax(d, y - beardLine(x), 0.008);
    d = smax(d, -(z + 0.045), 0.006);
    d = smax(d, -(mouthCarve.d(x, y, z)), 0.005);
    return smax(d, -(y + 0.2), 0.004);
  }, outer.c, outer.r + 0.05);
  const BC = [0, -0.03, 0.0];
  const BW = [0.95, 0.94, 0.9];
  const beardClumps = [
    clump([[0.064, -0.012, 0.0], [0.06, -0.045, 0.032], [0.043, -0.085, 0.052], [0.024, -0.125, 0.062]], [0.028, 0.012], [0.014, 0.008], BW, { center: BC }),
    clump([[-0.064, -0.012, 0.0], [-0.06, -0.045, 0.032], [-0.043, -0.085, 0.052], [-0.024, -0.125, 0.062]], [0.028, 0.012], [0.014, 0.008], BW, { center: BC }),
    clump([[0.03, -0.075, 0.075], [0.026, -0.105, 0.08], [0.016, -0.135, 0.074], [0.008, -0.155, 0.066]], [0.024, 0.008], [0.014, 0.008], BW, { center: BC }),
    clump([[-0.03, -0.075, 0.075], [-0.026, -0.105, 0.08], [-0.016, -0.135, 0.074], [-0.008, -0.155, 0.066]], [0.024, 0.008], [0.014, 0.008], BW, { center: BC }),
    clump([[0.0, -0.08, 0.082], [0.0, -0.115, 0.088], [0.0, -0.145, 0.082], [0.0, -0.17, 0.07]], [0.026, 0.01], [0.015, 0.008], BW, { center: BC }),
    // moustache
    clump([[0.002, -0.048, 0.101], [0.02, -0.05, 0.099], [0.036, -0.062, 0.088], [0.045, -0.082, 0.07]], [0.012, 0.005], [0.011, 0.006], BW, { center: [0, -0.05, 0.0] }),
    clump([[-0.002, -0.048, 0.101], [-0.02, -0.05, 0.099], [-0.036, -0.062, 0.088], [-0.045, -0.082, 0.07]], [0.012, 0.005], [0.011, 0.006], BW, { center: [0, -0.05, 0.0] })
  ];
  const bset = lockSet(beardClumps, BW, { k: 0.006 });
  let beardAll = union(0.008, shell, bset.shape);
  const beardStreaks = fromFn((x, y, z) => beardAll.d(x, y, z) + 0.0013 * Math.sin(x * 300 + z * 120 + noise3(x * 40, y * 40, z * 40) * 4), beardAll.c, beardAll.r + 0.02);
  const beardWorld = ctx.place(beardStreaks);
  parts.push({
    name: "beard", material: "fur", shape: beardWorld, ...bounds, h: q.hair.h * 0.75, tris: Math.round(q.hair.tris * 0.7),
    color: withAO((p) => { const lp = local(p); const n = (noise3(lp[0] * 100, lp[1] * 100, lp[2] * 100) - 0.5) * 0.08; const g = 0.9 + n; return [g, g - 0.005, g - 0.03]; }, beardWorld, { small: 0.008, large: 0.035, strength: 0.5 }),
    weights: headWeights(head, HS), lockBorder: true
  });
  return parts;
}

function garments(ctx) {
  const { q } = ctx;
  const parts = [];
  const mass = torsoMass({ width: 1.02, chest: 1.02, belly: 1.14, lowerCut: 0.9 });
  const slL = sleeve(1, { r: [0.06, 0.052, 0.045], cuff: 0.003 }), slR = sleeve(-1, { r: [0.06, 0.052, 0.045], cuff: 0.003 });
  // shawl collar: two thick rolls from the nape around the neck down to the chest centre
  const rollL = capsule([0.04, 1.49, 0.01], [0.012, 1.31, 0.112], 0.024, 0.02);
  const rollR = capsule([-0.04, 1.49, 0.01], [-0.012, 1.31, 0.112], 0.024, 0.02);
  const napeRoll = torus([0, 1.478, -0.012], norm3([0, 0.9, 0.2]), 0.075, 0.026);
  let card = union(0.04, mass, slL.shape, slR.shape, rollL, rollR, napeRoll);
  card = subtract(card, capsule([0, 1.42, -0.01], [0, 1.64, -0.014], 0.047, 0.047), 0.01);
  const vCut = fromFn((x, y, z) => smax(smax(Math.abs(x) - (0.004 + Math.max(0, y - 1.19) * 0.2), 1.19 - y, 0.006), 0.03 - z, 0.006), [0, 1.35, 0.12], 0.3);
  card = subtract(card, vCut, 0.01); // V neckline
  card = displace(card, foldField({ amp: 0.0018 }));
  const cardColor = withAO(() => CARDI, card, { small: 0.014, large: 0.06, strength: 0.6 });
  parts.push({ name: "cardigan", material: "knit", shape: card, ...boundsFrom([[-0.34, 0.88, -0.18], [0.34, 1.64, 0.18]], 0.02), h: q.body.h, tris: q.body.tris, color: cardColor, weights: bodyWeights(BODY_BONES), lockBorder: false });

  // shirt (cream) + collar wings + bow tie
  const shirtBody = intersect(mass, plane([0, 1.2, 0], [0, -1, 0]), 0.01);
  const collarL = ellipsoidRot(0.034, 1.495, 0.052, 0.036, 0.012, 0.03, 0.4, -0.6, 0.35);
  const collarR = ellipsoidRot(-0.034, 1.495, 0.052, 0.036, 0.012, 0.03, 0.4, 0.6, -0.35);
  const shirt = union(0.008, { c: shirtBody.c, r: shirtBody.r, d: (x, y, z) => shirtBody.d(x, y, z) + 0.016 }, collarL, collarR, torus([0, 1.476, 0.0], norm3([0, 0.9, 0.3]), 0.048, 0.012));
  parts.push({ name: "shirt", material: "cloth", shape: shirt, ...boundsFrom([[-0.15, 1.2, -0.12], [0.15, 1.54, 0.15]], 0.02), h: q.small.h, tris: q.small.tris * 3, color: withAO(() => CREAM, shirt, { strength: 0.35 }), weights: bodyWeights(["chest", "neck", "spine"]), lockBorder: false });
  const bow = union(0.004, ellipsoidRot(0.02, 1.448, 0.082, 0.019, 0.012, 0.01, 0, -0.3, 0.2), ellipsoidRot(-0.02, 1.448, 0.082, 0.019, 0.012, 0.01, 0, 0.3, -0.2), ellipsoid(0, 1.448, 0.085, 0.0085, 0.0085, 0.009));
  parts.push({ name: "bowtie", material: "cloth", shape: bow, ...boundsFrom([[-0.05, 1.43, 0.06], [0.05, 1.47, 0.1]], 0.01), h: 0.0014, tris: 500, color: () => [0.55, 0.12, 0.14], weights: bodyWeights(["chest", "neck"]), lockBorder: false });
  // buttons
  const buttons = union(0.0, ...[1.23, 1.15, 1.07, 0.99].map((y) => sphere(0, y, 0.108 + 0.0 - (y < 1.1 ? 0.0 : 0.0), 0.0105)));
  parts.push({ name: "buttons", material: "plain", shape: buttons, ...boundsFrom([[-0.02, 0.97, 0.09], [0.02, 1.25, 0.13]], 0.01), h: 0.0014, tris: 600, color: () => [0.2, 0.13, 0.09], weights: bodyWeights(["chest", "spine"]), lockBorder: false });

  // trousers (hidden behind the counter, kept so nothing is ever see-through)
  const trousers = legs({ width: 1.0 });
  parts.push({ name: "trousers", material: "cloth", shape: trousers, ...boundsFrom([[-0.24, 0.06, -0.16], [0.24, 1.0, 0.2]], 0.02), h: q.legs.h * 1.2, tris: Math.round(q.legs.tris * 0.6), color: withAO(() => [0.2, 0.19, 0.18], trousers, { strength: 0.5 }), weights: bodyWeights(LEG_BONES), lockBorder: false });
  for (const [name, s, bone] of [["shoeL", 1, "foot.L"], ["shoeR", -1, "foot.R"]]) {
    const sh = shoe(s);
    parts.push({ name, material: "shoe", shape: sh, ...boundsFrom([[s * 0.1 - 0.06, 0.0, -0.09], [s * 0.1 + 0.06, 0.14, 0.2]], 0.015), h: q.shoe.h, tris: Math.round(q.shoe.tris * 0.6), color: () => [0.18, 0.12, 0.09], rigid: bone, lockBorder: false });
  }
  return parts;
}

export default {
  id: "shopkeeper",
  skin: SKIN,
  headScale: 1.1,
  head: { skin: SKIN, age: 1, brow: 1.35, browSlope: -0.2, nose: 1.22, noseLen: 1.1, noseTip: 1.15, cheek: 1.18, jaw: 0.92, chin: 0.92, lip: 0.85, lipFull: 0.85, mouthW: 1.05, ear: 1.18, faceW: 1.04, neck: 1.1, forehead: 1.08, eyeGap: 0.0345, blush: 0.5, lipColor: [0.7, 0.4, 0.38] },
  brows: { thick: 1.7, arch: 1.3, tilt: 0.1, color: [0.86, 0.85, 0.82], length: 1.1 },
  eyes: { iris: [0.36, 0.23, 0.12], size: 1.0, lid: 0.42 },
  style: { skin: SKIN },
  hair, garments
};
