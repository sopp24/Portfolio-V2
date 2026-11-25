// Parametric stylised head: skull, face, jaw, nose, lips, ears, brows, eye sockets. Built in HEAD-LOCAL
// coordinates (origin = skull centre, +z forward, +x = character's left) then returned with helpers.
import {
  ellipsoid, ellipsoidRot, capsule, union, subtract, strand, smoothstep, mix, smin, smax, len3, noise3, fromFn, clamp
} from "./sdf.js";

export const HEAD_DEFAULTS = {
  skin: [0.87, 0.64, 0.52], lipColor: [0.76, 0.38, 0.36], blush: 0.5,
  skull: 1, faceW: 1, jaw: 1, chin: 1, cheek: 1, nose: 1, noseLen: 1, noseTip: 1, brow: 1, lip: 1, lipFull: 1, ear: 1, eyeGap: 0.0345, eyeY: 0.016,
  eyeR: 0.0135, age: 0, neck: 1, browSlope: 0, mouthW: 1, forehead: 1, hollow: 0
};

// Find the front surface z of `shape` at (x, y) by marching from zFrom toward zTo
export function surfaceZ(shape, x, y, zFrom = 0.2, zTo = 0.0) {
  let z = zFrom;
  const step = 0.002;
  while (z > zTo && shape.d(x, y, z) > 0) z -= step;
  let lo = z, hi = z + step;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (shape.d(x, y, m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

export function buildHead(opts = {}) {
  const P = { ...HEAD_DEFAULTS, ...opts };
  const e = P.eyeGap, ey = P.eyeY;

  // --- skull & face masses ---------------------------------------------------------------
  const cranium = ellipsoid(0, 0.03, -0.012, 0.071 * P.skull * P.faceW, 0.084 * P.skull, 0.093 * P.skull);
  const forehead = ellipsoid(0, 0.028, 0.04, 0.06 * P.faceW, 0.074 * P.forehead, 0.058);
  const faceMass = ellipsoid(0, -0.034, 0.03, 0.054 * P.faceW, 0.068, 0.062);
  const cheeks = [-1, 1].map((s) => ellipsoid(s * 0.04 * P.faceW, -0.014, 0.052, 0.024 * P.cheek, 0.024 * P.cheek, 0.022 * P.cheek));
  // jaw line: ear -> chin, tapered
  const jawLines = [-1, 1].map((s) => capsule([s * 0.048 * P.faceW, -0.03, -0.012], [s * 0.022 * P.jaw, -0.087, 0.05], 0.02 * P.jaw, 0.0165 * P.jaw));
  const chin = ellipsoid(0, -0.094, 0.059, 0.021 * P.chin * P.jaw, 0.019 * P.chin, 0.021 * P.chin);
  const neck = capsule([0, -0.07, -0.02], [0, -0.2, -0.016], 0.036 * P.neck, 0.042 * P.neck);
  let skull = union(0.03, cranium, forehead, faceMass, ...cheeks);
  skull = union(0.02, skull, ...jawLines, chin);
  skull = union(0.045, skull, neck);
  if (P.hollow > 0) for (const s of [-1, 1]) skull = subtract(skull, ellipsoidRot(s * 0.058 * P.faceW, -0.03, 0.03, 0.016, 0.018, 0.024, 0, 0, s * 0.2), 0.03 * P.hollow + 0.008);

  // --- brow ridge -----------------------------------------------------------------------
  const brows = [-1, 1].map((s) => capsule([s * 0.006, 0.047, 0.079], [s * 0.05, 0.043 + 0.006 * P.browSlope, 0.059], 0.0108 * P.brow, 0.009 * P.brow));
  const masseter = [-1, 1].map((s) => ellipsoidRot(s * 0.049 * P.faceW, -0.046, 0.012, 0.016, 0.027, 0.022, 0, 0, s * 0.15));
  skull = union(0.02, skull, ...brows, ...masseter);

  // --- nose -----------------------------------------------------------------------------
  const nz = P.noseLen;
  const bridge = capsule([0, 0.026, 0.078], [0, -0.02, 0.098 + 0.004 * nz], 0.0072 * P.nose, 0.0098 * P.nose);
  const tip = ellipsoid(0, -0.028, 0.105 + 0.005 * (nz - 1), 0.0098 * P.nose * P.noseTip, 0.0092 * P.nose, 0.0102 * P.nose);
  const wings = [-1, 1].map((s) => ellipsoidRot(s * 0.0098 * P.nose, -0.0305, 0.0925, 0.0064 * P.nose, 0.0076 * P.nose, 0.0072 * P.nose, 0, 0, s * 0.35));
  skull = union(0.011, skull, bridge, tip, ...wings);
  const nostrils = [-1, 1].map((s) => ellipsoid(s * 0.0062, -0.0368, 0.0975, 0.0036, 0.0028, 0.0065));
  skull = nostrils.reduce((acc, n) => subtract(acc, n, 0.003), skull);

  // --- lips & mouth ---------------------------------------------------------------------
  const L = P.lip;
  const lipU = ellipsoid(0, -0.0574, 0.0834, 0.0178 * L * P.mouthW, 0.0076 * L * P.lipFull, 0.0115);
  const lipD = ellipsoid(0, -0.0694, 0.0806, 0.0164 * L * P.mouthW, 0.0088 * L * P.lipFull, 0.0115);
  const corners = [-1, 1].map((s) => ellipsoid(s * 0.0165 * P.mouthW, -0.0625, 0.0745, 0.006, 0.0055, 0.006));
  const lips = union(0.004, lipU, lipD, ...corners);
  skull = union(0.006, skull, lips);
  // philtrum & lower-lip groove
  skull = subtract(skull, ellipsoid(0, -0.0775, 0.0805, 0.015 * P.mouthW, 0.0026, 0.007), 0.004);
  skull = subtract(skull, ellipsoid(0, -0.046, 0.0965, 0.0035, 0.0075, 0.006), 0.004);
  // mouth slit (so the jaw can open onto a dark cavity)
  const slit = ellipsoid(0, -0.0628, 0.082, 0.0165 * P.mouthW, 0.00115, 0.017);
  const cavity = ellipsoid(0, -0.065, 0.058, 0.014 * P.mouthW, 0.007, 0.03);
  skull = subtract(skull, slit, 0.0012);
  skull = subtract(skull, cavity, 0.002);

  // --- eye sockets ----------------------------------------------------------------------
  const eyeCenters = [];
  const sockets = [];
  for (const s of [-1, 1]) {
    // find the front surface at the eye position, place the eyeball 1.1 mm behind a flat lid plane
    const z = surfaceZ(skull, s * e, ey, 0.16, 0.02);
    const c = [s * e, ey, z - 0.0075];
    eyeCenters.push(c);
    // slightly tilted almond-shaped opening
    sockets.push(ellipsoidRot(c[0], c[1] + 0.0005, c[2] + 0.0012, 0.0195, 0.0125, 0.0155, 0, 0, s * -0.12));
  }
  skull = sockets.reduce((acc, sock) => subtract(acc, sock, 0.006), skull);

  // --- ears -----------------------------------------------------------------------------
  const ears = [-1, 1].map((s) => {
    const ear = ellipsoidRot(s * 0.0775 * P.faceW, -0.004, -0.014, 0.0082 * P.ear, 0.0265 * P.ear, 0.0185 * P.ear, 0, s * -0.17, s * 0.1);
    const concha = ellipsoidRot(s * 0.0715 * P.faceW, -0.005, -0.006, 0.0105, 0.0135, 0.0105, 0, s * -0.17, 0);
    return subtract(ear, concha, 0.006);
  });
  skull = union(0.009, skull, ...ears);

  // --- age lines (nasolabial, forehead, crow's feet) -------------------------------------
  if (P.age > 0) {
    const a = P.age;
    const lines = [];
    for (const s of [-1, 1]) {
      lines.push(capsule([s * 0.052, 0.012, 0.071], [s * 0.062, 0.008, 0.062], 0.0012 * a, 0.0009 * a)); // crow's feet
      lines.push(capsule([s * 0.052, 0.002, 0.073], [s * 0.065, -0.006, 0.059], 0.0011 * a, 0.0008 * a));
    }
    for (let i = 0; i < 3; i++) lines.push(capsule([-0.04, 0.066 + i * 0.012, 0.085 - i * 0.002], [0.04, 0.066 + i * 0.012, 0.085 - i * 0.002], 0.0011 * a, 0.0011 * a)); // forehead
    for (const l of lines) skull = subtract(skull, l, 0.006);
  }
  // very fine skin undulation so highlights break up
  const fine = skull;
  const finalSkull = { c: fine.c, r: fine.r + 0.01, d: (x, y, z) => fine.d(x, y, z) + 0.0002 * (noise3(x * 120, y * 120, z * 120) - 0.5) };

  // --- colour map -----------------------------------------------------------------------
  const base = P.skin;
  const gauss = (p, c, sx, sy, sz) => Math.exp(-(((p[0] - c[0]) / sx) ** 2 + ((p[1] - c[1]) / sy) ** 2 + ((p[2] - c[2]) / sz) ** 2));
  const tint = (col, to, k) => [mix(col[0], to[0], k), mix(col[1], to[1], k), mix(col[2], to[2], k)];
  const colorFn = (p) => {
    let c = base.slice();
    // forehead slightly lighter, jaw/neck slightly cooler
    c = tint(c, [c[0] * 1.04, c[1] * 1.05, c[2] * 1.05], smoothstep(0.0, 0.07, p[1]) * 0.6);
    c = tint(c, [c[0] * 0.93, c[1] * 0.9, c[2] * 0.92], smoothstep(-0.07, -0.16, p[1]) * 0.8);
    const blush = P.blush;
    for (const s of [-1, 1]) {
      c = tint(c, [0.95, 0.46, 0.42], blush * 0.62 * gauss(p, [s * 0.05 * P.faceW, -0.026, 0.07], 0.03, 0.026, 0.03));
      c = tint(c, [0.9, 0.5, 0.45], 0.28 * gauss(p, [s * 0.0775 * P.faceW, -0.005, -0.012], 0.012, 0.03, 0.02)); // ears
      c = tint(c, [0.62, 0.42, 0.42], 0.22 * gauss(p, [s * e, ey - 0.012, 0.078], 0.02, 0.011, 0.02)); // under-eye
      c = tint(c, [0.78, 0.5, 0.45], 0.55 * gauss(p, [s * e * 0.55, ey + 0.002, 0.08], 0.012, 0.009, 0.014)); // eye corner
    }
    c = tint(c, [0.93, 0.47, 0.43], 0.42 * gauss(p, [0, -0.03, 0.106], 0.016, 0.014, 0.016)); // nose tip
    const dl = lips.d(p[0], p[1], p[2]);
    c = tint(c, P.lipColor, 1 - smoothstep(-0.0004, 0.0016, dl) * 1.0);
    const ds = slit.d(p[0], p[1], p[2]);
    const dc = cavity.d(p[0], p[1], p[2]);
    if (dc < 0.0035 || ds < 0.0015) c = tint(c, [0.16, 0.05, 0.05], 1 - smoothstep(-0.002, 0.0035, Math.min(ds * 2.5, dc)));
    const dn = Math.min(nostrils[0].d(p[0], p[1], p[2]), nostrils[1].d(p[0], p[1], p[2]));
    if (dn < 0.004) c = tint(c, [0.2, 0.07, 0.06], (1 - smoothstep(-0.001, 0.004, dn)) * 0.85);
    const dsock = Math.min(...sockets.map((so) => so.d(p[0], p[1], p[2])));
    if (dsock < 0.003) c = tint(c, [0.74, 0.4, 0.38], 1 - smoothstep(-0.002, 0.003, dsock));
    return c;
  };

  return { P, shape: finalSkull, raw: skull, eyeCenters, colorFn, lips, slit, cavity, sockets, bounds: { min: [-0.12, -0.27, -0.14], max: [0.12, 0.15, 0.16] } };
}

// jaw weight: 1 for the lower face (below the mouth line) fading to 0 above it, and 0 behind the jaw pivot
export function jawWeight(p, P) {
  const below = smoothstep(-0.0575, -0.0745, p[1]);              // lower lip level and under
  const lipZone = smoothstep(0.012, 0.0, Math.abs(p[1] + 0.0628)) * (p[1] < -0.0628 ? 1 : 0.0); // lower lip belongs to the jaw
  const front = smoothstep(-0.045, 0.0, p[2]);
  const neckFade = 1 - smoothstep(-0.11, -0.16, p[1]);
  const side = 1 - smoothstep(0.062, 0.085, Math.abs(p[0]));
  return clamp(Math.max(below, lipZone) * front * neckFade * (0.55 + 0.45 * side), 0, 1);
}
