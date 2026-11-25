// Signed-distance-field toolkit used to SCULPT the characters offline (see bake-characters.mjs).
// Units are metres. Every shape is { d(x,y,z), c:[x,y,z], r } where (c, r) is a bounding sphere used
// to skip far shapes when blending (only valid because blends are smooth with a known radius k).

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

// ---------------------------------------------------------------------------------------------
// value noise (deterministic) for wrinkles & fabric
// ---------------------------------------------------------------------------------------------
function hash3(ix, iy, iz) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d);
  const x00 = mix(c(0, 0, 0), c(1, 0, 0), ux), x10 = mix(c(0, 1, 0), c(1, 1, 0), ux);
  const x01 = mix(c(0, 0, 1), c(1, 0, 1), ux), x11 = mix(c(0, 1, 1), c(1, 1, 1), ux);
  return mix(mix(x00, x10, uy), mix(x01, x11, uy), uz);
}

// ---------------------------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------------------------
export function sphere(cx, cy, cz, r) {
  return { c: [cx, cy, cz], r, d: (x, y, z) => len3(x - cx, y - cy, z - cz) - r };
}

// Axis-aligned ellipsoid (iq's bound-corrected approximation)
export function ellipsoid(cx, cy, cz, rx, ry, rz) {
  return {
    c: [cx, cy, cz], r: Math.max(rx, ry, rz),
    d: (x, y, z) => {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = len3(px, py, pz);
      const qx = px / rx, qy = py / ry, qz = pz / rz;
      const k1 = len3(qx, qy, qz);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
    }
  };
}

// Ellipsoid with arbitrary orthonormal axes (ax, ay, az are unit vectors)
export function ellipsoidAxes(c, ax, ay, az, rx, ry, rz) {
  return {
    c, r: Math.max(rx, ry, rz),
    d: (x, y, z) => {
      const dx = x - c[0], dy = y - c[1], dz = z - c[2];
      const px = (dx * ax[0] + dy * ax[1] + dz * ax[2]) / rx;
      const py = (dx * ay[0] + dy * ay[1] + dz * ay[2]) / ry;
      const pz = (dx * az[0] + dy * az[1] + dz * az[2]) / rz;
      const k0 = len3(px, py, pz);
      const k1 = len3(px / rx, py / ry, pz / rz);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
    }
  };
}

// Ellipsoid rotated by Euler angles (applied Z, X, Y) — convenient for ears, lips, etc.
export function ellipsoidRot(cx, cy, cz, rx, ry, rz, rotX = 0, rotY = 0, rotZ = 0) {
  const m = rotMatrix(rotX, rotY, rotZ);
  return ellipsoidAxes([cx, cy, cz], [m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]], rx, ry, rz);
}

export function rotMatrix(ax, ay, az) {
  const sx = Math.sin(ax), cx = Math.cos(ax), sy = Math.sin(ay), cy = Math.cos(ay), sz = Math.sin(az), cz = Math.cos(az);
  // R = Ry * Rx * Rz  (row-major 3x3)
  const rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
  ];
  return mul(ry, mul(rx, rz));
}

// Tapered capsule from a to b, radius r1 at a, r2 at b
export function capsule(a, b, r1, r2 = r1) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  return {
    c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    r: Math.sqrt(l2) / 2 + Math.max(r1, r2),
    d: (x, y, z) => {
      const t = clamp(((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2, 0, 1);
      return len3(x - a[0] - abx * t, y - a[1] - aby * t, z - a[2] - abz * t) - (r1 + (r2 - r1) * t);
    }
  };
}

// Capsule whose axis parameter t (0..1) is also exposed (for fold patterns)
export function axisT(a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  return (x, y, z) => clamp(((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2, 0, 1);
}

// Torus lying around axis `n` (unit), centre c, major radius R, minor r
export function torus(c, n, R, r) {
  // build an orthonormal frame
  const up = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  let ux = up[1] * n[2] - up[2] * n[1], uy = up[2] * n[0] - up[0] * n[2], uz = up[0] * n[1] - up[1] * n[0];
  const ul = len3(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = n[1] * uz - n[2] * uy, vy = n[2] * ux - n[0] * uz, vz = n[0] * uy - n[1] * ux;
  return {
    c, r: R + r,
    d: (x, y, z) => {
      const dx = x - c[0], dy = y - c[1], dz = z - c[2];
      const a = dx * ux + dy * uy + dz * uz, b = dx * vx + dy * vy + dz * vz, h = dx * n[0] + dy * n[1] + dz * n[2];
      const q = Math.sqrt(a * a + b * b) - R;
      return Math.sqrt(q * q + h * h) - r;
    }
  };
}

// Rounded box with arbitrary orientation (axes unit vectors)
export function roundBox(c, ax, ay, az, hx, hy, hz, round = 0) {
  return {
    c, r: len3(hx, hy, hz) + round,
    d: (x, y, z) => {
      const dx = x - c[0], dy = y - c[1], dz = z - c[2];
      const px = Math.abs(dx * ax[0] + dy * ax[1] + dz * ax[2]) - hx + round;
      const py = Math.abs(dx * ay[0] + dy * ay[1] + dz * ay[2]) - hy + round;
      const pz = Math.abs(dx * az[0] + dy * az[1] + dz * az[2]) - hz + round;
      const out = len3(Math.max(px, 0), Math.max(py, 0), Math.max(pz, 0));
      return out + Math.min(Math.max(px, py, pz), 0) - round;
    }
  };
}

// Half-space: positive on the side the normal points to
export function plane(point, n) {
  const l = len3(n[0], n[1], n[2]);
  const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  return { c: point, r: 1e9, d: (x, y, z) => (x - point[0]) * nx + (y - point[1]) * ny + (z - point[2]) * nz };
}

// Chain of tapered capsules through points (radii per point), smooth-unioned: hair locks, brows, fingers.
export function strand(points, radii, k = 0.002) {
  const caps = [];
  for (let i = 0; i < points.length - 1; i++) caps.push(capsule(points[i], points[i + 1], radii[i], radii[i + 1]));
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) { cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= points.length; cy /= points.length; cz /= points.length;
  let r = 0;
  for (const p of points) r = Math.max(r, len3(p[0] - cx, p[1] - cy, p[2] - cz));
  r += Math.max(...radii);
  return {
    c: [cx, cy, cz], r,
    d: (x, y, z) => {
      let v = caps[0].d(x, y, z);
      for (let i = 1; i < caps.length; i++) v = smin(v, caps[i].d(x, y, z), k);
      return v;
    }
  };
}

export function bezier3(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([0, 1, 2].map((a) => u * u * u * p0[a] + 3 * u * u * t * p1[a] + 3 * u * t * t * p2[a] + t * t * t * p3[a]));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// combinators
// ---------------------------------------------------------------------------------------------
export function union(k, ...shapes) {
  const list = shapes.flat();
  let cx = 0, cy = 0, cz = 0;
  for (const s of list) { cx += s.c[0]; cy += s.c[1]; cz += s.c[2]; }
  cx /= list.length; cy /= list.length; cz /= list.length;
  let r = 0;
  for (const s of list) r = Math.max(r, len3(s.c[0] - cx, s.c[1] - cy, s.c[2] - cz) + s.r);
  return {
    c: [cx, cy, cz], r: r + k,
    d: (x, y, z) => {
      let cur = Infinity;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (cur < Infinity) {
          const lower = len3(x - s.c[0], y - s.c[1], z - s.c[2]) - s.r; // lower bound of s.d
          if (lower > cur + k) continue;
        }
        const v = s.d(x, y, z);
        cur = cur === Infinity ? v : smin(cur, v, k);
      }
      return cur;
    }
  };
}

// a minus b (smooth)
export function subtract(a, b, k = 0.004) {
  return { c: a.c, r: a.r, d: (x, y, z) => smax(a.d(x, y, z), -b.d(x, y, z), k) };
}
export function intersect(a, b, k = 0.004) {
  return { c: a.c, r: a.r, d: (x, y, z) => smax(a.d(x, y, z), b.d(x, y, z), k) };
}
export function offset(a, amount) { return { c: a.c, r: a.r + Math.abs(amount), d: (x, y, z) => a.d(x, y, z) - amount }; }

// add a scalar field to the distance (wrinkles, fabric)
export function displace(a, fn) { return { c: a.c, r: a.r + 0.02, d: (x, y, z) => a.d(x, y, z) + fn(x, y, z) }; }

// Plain function wrapper
export function fromFn(fn, c = [0, 0, 0], r = 1e9) { return { c, r, d: fn }; }

// Flattened tube following a polyline: wide in the tangent plane, thin along the radial direction from
// `center` (so locks lie on the scalp like sculpted hair clumps). widths/thick are [start, end] pairs.
export function ribbon(path, widths, thick, center = [0, 0.02, -0.01]) {
  const n = path.length - 1;
  let cx = 0, cy = 0, cz = 0;
  for (const p of path) { cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= path.length; cy /= path.length; cz /= path.length;
  let R = 0;
  for (const p of path) R = Math.max(R, len3(p[0] - cx, p[1] - cy, p[2] - cz));
  const wmax = Math.max(widths[0], widths[1]), tmax = Math.max(thick[0], thick[1]);
  return {
    c: [cx, cy, cz], r: R + Math.max(wmax, tmax),
    d: (x, y, z) => {
      let best = Infinity, bt = 0, qx = 0, qy = 0, qz = 0;
      for (let i = 0; i < n; i++) {
        const a = path[i], b = path[i + 1];
        const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
        const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
        const t = clamp(((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2, 0, 1);
        const px = a[0] + abx * t, py = a[1] + aby * t, pz = a[2] + abz * t;
        const dd = (x - px) * (x - px) + (y - py) * (y - py) + (z - pz) * (z - pz);
        if (dd < best) { best = dd; bt = (i + t) / n; qx = px; qy = py; qz = pz; }
      }
      const w = widths[0] + (widths[1] - widths[0]) * Math.pow(bt, 1.2);
      const th = thick[0] + (thick[1] - thick[0]) * Math.pow(bt, 1.2);
      // radial axis at the nearest curve point
      let nx = qx - center[0], ny = qy - center[1], nz = qz - center[2];
      const nl = len3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const vx = x - qx, vy = y - qy, vz = z - qz;
      const vn = vx * nx + vy * ny + vz * nz;
      const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
      const k0 = Math.sqrt((len3(tx, ty, tz) / w) ** 2 + (vn / th) ** 2);
      return (k0 - 1) * Math.min(w, th);
    }
  };
}
