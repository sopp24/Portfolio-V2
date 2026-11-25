// Single source of truth for the shop's geometry. All values in metres.
// Axes: +x = right (as seen from the visitor), +y = up, -z = toward the back of the shop.
// The visitor stands at CAMERA.position facing -z. The storefront is behind them (+z).
import * as THREE from "three";

export const ROOM = {
  x0: -3.7, x1: 3.7, zBack: -5.5, zFront: 4.9, height: 3.3,
  get width() { return this.x1 - this.x0; },
  get depth() { return this.zFront - this.zBack; },
  get cx() { return (this.x0 + this.x1) / 2; },
  get cz() { return (this.zFront + this.zBack) / 2; }
};

export const CAMERA = {
  position: new THREE.Vector3(0, 1.64, 3.0),
  fov: 55,
  // Look limits relative to "straight toward the back wall"
  yawLimit: THREE.MathUtils.degToRad(118),
  pitchUp: THREE.MathUtils.degToRad(34),
  pitchDown: THREE.MathUtils.degToRad(40),
  zoomMinFov: 30,
  zoomMaxFov: 62
};

// Front wall openings (x ranges), sill/lintel heights
export const FRONT = {
  windowA: { x0: -3.4, x1: -.4 },
  door: { x0: -.05, x1: 1.45 },
  windowB: { x0: 1.75, x1: 3.4 },
  sill: .85, lintel: 2.95, doorTop: 2.5
};

// Central gondola ("le rayon"): two tiers of three bins facing the visitor
export const GONDOLA = {
  cx: -.7, frontZ: .1, rearZ: -1.05, frontY: .76, rearY: 1.0, binWidth: 1.1, binGap: .06,
  binDepth: .5
};

export const SUN = {
  // Direction light TRAVELS (from the window into the shop): toward +x, downward, toward -z
  direction: new THREE.Vector3(.42, -.62, -.66).normalize(),
  color: 0xffe2b8
};

export const COUNTER = { x: 2.5, z: -3.62, width: 2.3, depth: .72, height: 1.02 };
export const SHOPKEEPER_POS = new THREE.Vector3(2.6, 0, -4.35);

// Footprints (x0,z0,x1,z1) used for the baked floor ambient-occlusion
export const FOOTPRINTS = [
  [-2.45, .1 - .3, 1.05, .1 + .3],
  [-2.45, -1.05 - .3, 1.05, -1.05 + .3],
  [COUNTER.x - COUNTER.width / 2, COUNTER.z - COUNTER.depth / 2, COUNTER.x + COUNTER.width / 2, COUNTER.z + COUNTER.depth / 2],
  [-3.7, -3.0, -3.0, .8],       // wall bins left
  [3.2, -2.9, 3.7, -.3],        // CD shelving right
  [3.35, .4, 3.7, 3.4],         // apps rack
  [-3.7, -5.4, -2.6, -3.1],     // about corner
  [-3.7, 2.4, -2.9, 4.7],       // window display left
  [-2.9, -5.5, -1.3, -4.5]      // listening corner
];
