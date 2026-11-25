// Image-based lighting: a tiny stand-in "model" of the shop (bright street windows, warm ceiling
// lamps, dark floor, plaster walls) is rendered into a PMREM cube so every glossy surface
// (vinyl, sleeves, glass, varnish, metal) reflects something believable.
import * as THREE from "three";
import { ROOM, FRONT } from "./layout.js";

export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const glow = (r, g, b, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b).multiplyScalar(k), side: THREE.DoubleSide });
  const wall = (hex) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), side: THREE.BackSide });

  const w = ROOM.width, d = ROOM.depth, h = ROOM.height;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    wall(0x6b6354), wall(0x6b6354), wall(0xc9bda3), wall(0x1b2a29), wall(0x6e6757), wall(0x6e6757)
  ]);
  shell.position.set(ROOM.cx, h / 2, ROOM.cz);
  scene.add(shell);

  // Street light pouring through the three storefront openings (very bright, slightly warm)
  const windows = [FRONT.windowA, FRONT.door, FRONT.windowB];
  for (const win of windows) {
    const width = win.x1 - win.x0;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, FRONT.lintel - FRONT.sill), glow(1, .93, .8, 14));
    pane.position.set((win.x0 + win.x1) / 2, (FRONT.lintel + FRONT.sill) / 2, ROOM.zFront - .2);
    pane.rotation.y = Math.PI;
    scene.add(pane);
  }
  // Ceiling lamps: warm spots + cool tubes
  for (const x of [-2.4, 0, 2.4]) {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(.35, .35), glow(1, .78, .5, 9));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, h - .02, -.6);
    scene.add(lamp);
  }
  for (const z of [-3.2, 0.4]) {
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .12), glow(.9, 1, .96, 6));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, h - .02, z);
    scene.add(tube);
  }
  // Neon (teal/pink accents on the back wall)
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .5), glow(.2, 1, .8, 3));
  neon.position.set(-.6, 2.4, ROOM.zBack + .1);
  scene.add(neon);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, .035);
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose?.(); o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
  return target.texture;
}
