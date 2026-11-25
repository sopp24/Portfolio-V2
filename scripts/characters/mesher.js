// Naive Surface Nets over a signed-distance function, with narrow-band evaluation (blocks that are
// provably far from the surface are never sampled), Newton projection of vertices onto the zero level
// set and analytic-gradient normals. Output: indexed triangle mesh (Float32/Uint32 typed arrays).
import { len3 } from "./sdf.js";

export function gradient(sdf, x, y, z, e) {
  const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
  const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
  const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = len3(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

export function meshSdf(sdf, { min, max, h, lipschitz = 1.35, block = 6, project = 2 }) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 2;
  const ny = Math.ceil((max[1] - min[1]) / h) + 2;
  const nz = Math.ceil((max[2] - min[2]) / h) + 2;
  const field = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => i + nx * (j + ny * k);
  const ox = min[0] - h, oy = min[1] - h, oz = min[2] - h;

  // 1. sample the field, skipping blocks that cannot contain the surface
  const half = (block - 1) * 0.5;
  const reach = Math.sqrt(3) * half * h * lipschitz + h * 1.5;
  let evaluated = 0;
  for (let bk = 0; bk < nz; bk += block) for (let bj = 0; bj < ny; bj += block) for (let bi = 0; bi < nx; bi += block) {
    const ci = Math.min(bi + half, nx - 1), cj = Math.min(bj + half, ny - 1), ck = Math.min(bk + half, nz - 1);
    const dc = sdf(ox + ci * h, oy + cj * h, oz + ck * h);
    const ei = Math.min(bi + block, nx), ej = Math.min(bj + block, ny), ek = Math.min(bk + block, nz);
    if (Math.abs(dc) > reach) {
      for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) field[at(i, j, k)] = dc;
    } else {
      for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) { field[at(i, j, k)] = sdf(ox + i * h, oy + j * h, oz + k * h); evaluated++; }
    }
  }

  // 2. one vertex per sign-changing cell
  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const positions = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const vals = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = field[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
      vals[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = vals[a], vb = vals[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      n++;
    }
    cellVertex[cidx(i, j, k)] = positions.length / 3;
    positions.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
  }

  // 3. quads across every sign-changing grid edge
  const indices = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { indices.push(a, c, b, a, d, c); } else { indices.push(a, b, c, a, c, d); }
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = field[at(i, j, k)] < 0;
    // edge along +x
    if (v0 !== (field[at(i + 1, j, k)] < 0)) {
      quad(cellVertex[cidx(i, j - 1, k - 1)], cellVertex[cidx(i, j, k - 1)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i, j - 1, k)], !v0);
    }
    // edge along +y
    if (v0 !== (field[at(i, j + 1, k)] < 0)) {
      quad(cellVertex[cidx(i - 1, j, k - 1)], cellVertex[cidx(i - 1, j, k)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i, j, k - 1)], !v0);
    }
    // edge along +z
    if (v0 !== (field[at(i, j, k + 1)] < 0)) {
      quad(cellVertex[cidx(i - 1, j - 1, k)], cellVertex[cidx(i, j - 1, k)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i - 1, j, k)], !v0);
    }
  }

  const pos = new Float32Array(positions);
  // 4. project vertices onto the true zero level set
  const eps = h * 0.35;
  for (let v = 0; v < pos.length; v += 3) {
    let x = pos[v], y = pos[v + 1], z = pos[v + 2];
    for (let it = 0; it < project; it++) {
      const d = sdf(x, y, z);
      const g = gradient(sdf, x, y, z, eps);
      const step = Math.max(-h, Math.min(h, d));
      x -= g[0] * step; y -= g[1] * step; z -= g[2] * step;
    }
    pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
  }
  return { positions: pos, indices: new Uint32Array(indices), evaluated };
}

// Make triangle winding agree with the SDF gradient (outward normals). Samples a subset and flips globally if needed.
export function fixWinding(mesh, sdf, h) {
  const { positions: p, indices: ix } = mesh;
  let agree = 0, total = 0;
  const step = Math.max(1, Math.floor(ix.length / 3 / 400));
  for (let t = 0; t < ix.length; t += 3 * step) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
    const g = gradient(sdf, cx, cy, cz, h * 0.35);
    if (nx * g[0] + ny * g[1] + nz * g[2] > 0) agree++;
    total++;
  }
  if (agree < total / 2) {
    for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
  }
  return agree / Math.max(1, total);
}
