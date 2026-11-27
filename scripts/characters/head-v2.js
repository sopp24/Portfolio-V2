// Stylised "hero" head (art direction v2) — the sculpt language of the boss reference: long narrow face with a defined
// jaw and chin, prominent but smooth cheekbones, high straight nose with a soft rounded tip, small closed mouth with a
// fuller lower lip, heavy brow ridge, big ears, slender neck with sterno-cleido ridges. Painted-looking: almost no
// micro noise, blush baked into the vertex colours.
//
// Same interface as head.js buildHead() (HEAD-LOCAL coordinates: origin = skull centre, +z forward, +x = character's
// left), so character-builder.js / jawWeight() / the runtime eye builder work unchanged. Every number is a parameter.
import { ellipsoid, ellipsoidRot, capsule, union, subtract, intersect, plane, smoothstep, mix } from "./sdf.js";
import { surfaceZ } from "./head.js";

export const HEAD_V2_DEFAULTS = {
  skin: [0.87, 0.63, 0.5], lipColor: [0.74, 0.47, 0.41], blush: 1,
  faceW: 1, lowerW: 1, faceLen: 1, jaw: 1, chin: 1, cheek: 1, hollow: 0, nose: 1, noseLen: 1, noseTip: 1, noseBridge: 1,
  lip: 1, lipFull: 1, mouthW: 1, mouthDrop: 1, ear: 1, earOut: 1, neck: 1, forehead: 1, browRidge: 1,
  eyeGap: 0.0315, eyeY: 0.016, eyeTilt: 0.12, eyeSock: 1, scm: 1
};

export function buildHeadV2(opts = {}) {
  const P = { ...HEAD_V2_DEFAULTS, ...opts };
  const W = P.faceW, e = P.eyeGap, ey = P.eyeY;
  const MY = -0.0435; // mouth line (head-local y); jawWeight() reads P.mouthY

  // --- skull & face masses ------------------------------------------------------------------
  // Proportions measured on the reference (in units of the eye gap): eye -> base of nose 0.64, nose -> mouth 0.31, mouth -> chin
  // 0.52, i.e. a SHORT lower face under a big cranium, a tapered angular jaw and a long thin neck.
  const cranium = ellipsoid(0, 0.032, -0.012, 0.067 * W, 0.084, 0.092);
  const forehead = ellipsoid(0, 0.03, 0.036, 0.057 * W, 0.07 * P.forehead, 0.055);
  // lower face = two stacked ellipsoids (wide cheeks over a narrower jaw, smooth-unioned: the egg/V taper of the reference) trimmed by
  // soft jaw planes and an under-jaw plane (smooth-max): lean cheeks and a defined chin instead of the blobby union of primitives.
  const LW = P.lowerW;
  const jawA = [0.05 * W * LW, -0.03, -0.01], jawB = [0.019 * P.jaw, -0.078 * P.faceLen, 0.046];
  const jdx = jawB[0] - jawA[0], jdy = jawB[1] - jawA[1], jl = Math.hypot(jdx, jdy);
  const jawN = [-jdy / jl, jdx / jl, 0]; // outward normal for the +x side (points out and down)
  const cheekMass = ellipsoid(0, -0.012, 0.026, 0.0625 * W * LW, 0.05 * P.faceLen, 0.062);
  const jawMass = ellipsoid(0, -0.047 * P.faceLen, 0.03, 0.047 * W * LW, 0.045 * P.faceLen, 0.056);
  let faceMass = union(0.03, cheekMass, jawMass);
  for (const s of [-1, 1]) faceMass = intersect(faceMass, plane([s * jawA[0], jawA[1], jawA[2]], [s * jawN[0], jawN[1], 0]), 0.03);
  faceMass = intersect(faceMass, plane([0, -0.0765 * P.faceLen, 0.05], [0, -0.97, -0.25]), 0.012);
  const cheekbones = [-1, 1].map((s) => ellipsoid(s * 0.046 * W * LW, -0.006, 0.044, 0.02 * P.cheek, 0.019 * P.cheek, 0.019 * P.cheek));
  const chinY = -0.0615 * P.faceLen;
  const chin = ellipsoid(0, chinY, 0.062, 0.0175 * P.chin, 0.0148 * P.chin, 0.0185 * P.chin);
  const neck = capsule([0, -0.05, -0.022], [0, -0.22, -0.012], 0.027 * P.neck, 0.034 * P.neck);
  const scm = [-1, 1].map((s) => capsule([s * 0.029, -0.05, -0.03], [s * 0.012, -0.19, 0.016], 0.0066 * P.scm, 0.0076 * P.scm));
  let skull = union(0.02, cranium, forehead, faceMass, ...cheekbones);
  skull = union(0.014, skull, chin);
  skull = union(0.04, skull, neck);
  skull = union(0.018, skull, ...scm);
  // soft hollow under the cheekbones (the lean-face read)
  if (P.hollow > 0) for (const s of [-1, 1]) skull = subtract(skull, ellipsoidRot(s * 0.051 * W, -0.03, 0.036, 0.0105, 0.016, 0.018, 0, 0, s * 0.25), 0.02 * P.hollow + 0.006);

  // --- brow ridge (the real brows are separate sculpted parts, see character-builder.browParts) ------
  const ridge = [-1, 1].map((s) => capsule([s * 0.008, 0.03, 0.082], [s * 0.052, 0.026, 0.06], 0.0092 * P.browRidge, 0.0085 * P.browRidge));
  skull = union(0.02, skull, ...ridge);

  // --- nose: high straight bridge, soft rounded tip ----------------------------------------------
  const nz = P.noseLen;
  const bridge = capsule([0, 0.022, 0.077], [0, -0.0165, 0.1 + 0.004 * nz], 0.0062 * P.nose * P.noseBridge, 0.009 * P.nose);
  const tip = ellipsoid(0, -0.0175, 0.1065 + 0.005 * (nz - 1), 0.0092 * P.nose * P.noseTip, 0.0088 * P.nose, 0.0098 * P.nose);
  const wings = [-1, 1].map((s) => ellipsoidRot(s * 0.0088 * P.nose, -0.0205, 0.0935, 0.0058 * P.nose, 0.0068 * P.nose, 0.0066 * P.nose, 0, 0, s * 0.35));
  skull = union(0.011, skull, bridge, tip, ...wings);
  const nostrils = [-1, 1].map((s) => ellipsoid(s * 0.0056, -0.0254, 0.0975, 0.0028, 0.0021, 0.0055));
  skull = nostrils.reduce((acc, n) => subtract(acc, n, 0.003), skull);

  // --- lips: thin upper lip, fuller lower lip, small closed mouth ----------------------------------
  const L = P.lip, MW = P.mouthW, my = MY;
  const lipU = ellipsoid(0, my + 0.0054, 0.0886, 0.0158 * L * MW, 0.0064 * L * P.lipFull, 0.0105);
  const lipD = ellipsoid(0, my - 0.0072, 0.0876, 0.0146 * L * MW, 0.0098 * L * P.lipFull, 0.0108);
  const drop = 0.0012 * P.mouthDrop; // corners sit a hair lower than the centre: slightly stern mouth
  const corners = [-1, 1].map((s) => ellipsoid(s * 0.0145 * MW, my - drop, 0.0795, 0.0052, 0.0048, 0.0054));
  const lips = union(0.004, lipU, lipD, ...corners);
  skull = union(0.006, skull, lips);
  skull = subtract(skull, ellipsoid(0, my - 0.0155, 0.0855, 0.01 * MW, 0.0018, 0.006), 0.005); // lower-lip groove
  // mouth slit: one thin straight cut with the corners a touch lower; the jaw bone opens it onto a dark cavity
  const slit = union(0.0008, ...[-1, 1].map((sd) => ellipsoidRot(sd * 0.0062 * MW, my - drop * 0.35, 0.0845, 0.0092 * MW, 0.00095, 0.0125, 0, 0, -sd * 0.1 * P.mouthDrop)));
  const cavity = ellipsoid(0, my - 0.0022, 0.062, 0.0118 * MW, 0.007, 0.027);
  skull = subtract(skull, slit, 0.0012);
  skull = subtract(skull, cavity, 0.002);

  // --- eye sockets (almond, outer corners slightly lower = heavy-lidded look) -------------------------
  const eyeCenters = [];
  const sockets = [];
  for (const s of [-1, 1]) {
    const z = surfaceZ(skull, s * e, ey, 0.16, 0.02);
    const c = [s * e, ey, z - 0.0075];
    eyeCenters.push(c);
    sockets.push(ellipsoidRot(c[0], c[1] + 0.0005, c[2] + 0.0012, 0.0172 * P.eyeSock, 0.0115 * P.eyeSock, 0.0155, 0, 0, s * -P.eyeTilt));
  }
  skull = sockets.reduce((acc, sock) => subtract(acc, sock, 0.006), skull);

  // --- ears: big, slightly flared -------------------------------------------------------------------
  const ears = [-1, 1].map((s) => {
    const ear = ellipsoidRot(s * 0.0745 * W, 0.004, -0.014, 0.0085 * P.ear, 0.0245 * P.ear, 0.0185 * P.ear, 0, s * -0.17 * P.earOut, s * 0.1);
    const concha = ellipsoidRot(s * 0.0685 * W, 0.003, -0.006, 0.0105 * P.ear, 0.013 * P.ear, 0.0105 * P.ear, 0, s * -0.17 * P.earOut, 0);
    return subtract(ear, concha, 0.006);
  });
  skull = union(0.009, skull, ...ears);

  const finalSkull = skull; // painted look: no micro-noise on the skin

  // --- colour map -------------------------------------------------------------------------------------
  const base = P.skin;
  const gauss = (p, c, sx, sy, sz) => Math.exp(-(((p[0] - c[0]) / sx) ** 2 + ((p[1] - c[1]) / sy) ** 2 + ((p[2] - c[2]) / sz) ** 2));
  const tint = (col, to, k) => [mix(col[0], to[0], k), mix(col[1], to[1], k), mix(col[2], to[2], k)];
  const colorFn = (p) => {
    let c = base.slice();
    c = tint(c, [c[0] * 1.03, c[1] * 1.04, c[2] * 1.05], smoothstep(0.0, 0.07, p[1]) * 0.5); // forehead a touch lighter
    c = tint(c, [c[0] * 0.95, c[1] * 0.93, c[2] * 0.94], smoothstep(-0.05, -0.12, p[1]) * 0.8); // jaw/neck cooler
    const B = P.blush;
    for (const s of [-1, 1]) {
      c = tint(c, [0.94, 0.43, 0.4], Math.min(1, B * 0.6 * gauss(p, [s * 0.05 * W, -0.012, 0.055], 0.034, 0.03, 0.034))); // cheeks
      c = tint(c, [0.92, 0.45, 0.38], Math.min(1, B * 0.55 * gauss(p, [s * 0.0745 * W, 0.0, -0.012], 0.012, 0.03, 0.022))); // ears
      c = tint(c, [0.6, 0.4, 0.42], 0.26 * gauss(p, [s * e, ey - 0.012, 0.078], 0.02, 0.011, 0.02)); // under-eye shadow
      c = tint(c, [0.8, 0.5, 0.45], 0.5 * gauss(p, [s * e * 0.55, ey + 0.002, 0.08], 0.012, 0.009, 0.014)); // inner eye corner
      c = tint(c, [0.62, 0.42, 0.4], 0.22 * gauss(p, [s * e, ey + 0.017, 0.075], 0.024, 0.008, 0.02)); // lid crease
    }
    c = tint(c, [0.93, 0.45, 0.41], Math.min(1, B * 0.5 * gauss(p, [0, -0.018, 0.106], 0.017, 0.015, 0.017))); // nose tip
    c = tint(c, [0.9, 0.5, 0.45], B * 0.18 * gauss(p, [0, 0.01, 0.092], 0.01, 0.022, 0.014)); // bridge
    const dl = lips.d(p[0], p[1], p[2]);
    const lipT = 1 - smoothstep(-0.0004, 0.0016, dl);
    c = tint(c, p[1] > MY - 0.0005 ? [P.lipColor[0] * 0.9, P.lipColor[1] * 0.88, P.lipColor[2] * 0.9] : P.lipColor, lipT);
    const ds = slit.d(p[0], p[1], p[2]);
    const dc = cavity.d(p[0], p[1], p[2]);
    if (dc < 0.0035 || ds < 0.0015) c = tint(c, [0.16, 0.05, 0.05], 1 - smoothstep(-0.002, 0.0035, Math.min(ds * 2.5, dc)));
    const dn = Math.min(nostrils[0].d(p[0], p[1], p[2]), nostrils[1].d(p[0], p[1], p[2]));
    if (dn < 0.004) c = tint(c, [0.2, 0.07, 0.06], (1 - smoothstep(-0.001, 0.004, dn)) * 0.6);
    const dsock = Math.min(...sockets.map((so) => so.d(p[0], p[1], p[2])));
    if (dsock < 0.003) c = tint(c, [0.42, 0.26, 0.24], 0.7 * (1 - smoothstep(-0.003, 0.0025, dsock)));
    return c;
  };

  P.mouthY = MY;
  return { P, shape: finalSkull, raw: skull, eyeCenters, colorFn, lips, slit, cavity, sockets, bounds: { min: [-0.12, -0.27, -0.14], max: [0.12, 0.15, 0.16] } };
}
