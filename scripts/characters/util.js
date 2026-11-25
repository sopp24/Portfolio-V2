// Shape transforms shared by the character builders.
import { len3 } from "./sdf.js";

export function translate(shape, v) {
  return { c: [shape.c[0] + v[0], shape.c[1] + v[1], shape.c[2] + v[2]], r: shape.r, d: (x, y, z) => shape.d(x - v[0], y - v[1], z - v[2]) };
}
// mirror across x = 0
export function mirrorX(shape) {
  return { c: [-shape.c[0], shape.c[1], shape.c[2]], r: shape.r, d: (x, y, z) => shape.d(-x, y, z) };
}
// Scale a head-local shape by `s` about the origin and move it to `hc`
export function placeHead(shape, hc, s = 1) {
  return { c: [hc[0] + shape.c[0] * s, hc[1] + shape.c[1] * s, hc[2] + shape.c[2] * s], r: shape.r * s, d: (x, y, z) => s * shape.d((x - hc[0]) / s, (y - hc[1]) / s, (z - hc[2]) / s) };
}
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function norm3(a) { const l = len3(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
