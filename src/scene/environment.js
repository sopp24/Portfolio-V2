// Image-based lighting, art direction v2 (DAY). A tiny stand-in "model" of the shop is rendered into a PMREM cube once:
//   * bright sky-blue / warm-horizon panes where the storefront windows are (the big soft key every glossy surface reflects),
//   * a cool lavender ceiling and violet-tinted side walls  -> shadow areas facing up/sideways get a COOL, coloured ambient,
//   * a warm sunlit-floor bounce below                       -> surfaces facing down get a WARM bounce,
//   * a few warm practicals and a hint of the neon.
// Result: ambient light is directional and coloured (violet/blue fill vs warm sun) instead of a flat grey/brown lift.
import * as THREE from "three";
import { ROOM, FRONT } from "./layout.js";

export function createEnvironment(renderer, { size = 256 } = {}) {
  const scene = new THREE.Scene();
  const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide });
  const wall = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.BackSide });

  const w = ROOM.width, d = ROOM.depth, h = ROOM.height;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    wall(0xcfc4d6, .95),   // +x  right wall: cream with a lavender cast (in shadow it picks up the sky)
    wall(0xd6cbd2, .95),   // -x  left wall
    wall(0xbfc9f0, 1.15),  // +y  ceiling: pale cool sky glow
    wall(0xe6c8a8, .5),    // -y  floor: warm sunlit-floor bounce (kept low: it also lights the ceiling)
    wall(0xd8d2dc, .9),    // +z  storefront wall (windows added below)
    wall(0xe6dccb, .95)    // -z  back wall: sunlit cream
  ]);
  shell.position.set(ROOM.cx, h / 2, ROOM.cz);
  scene.add(shell);

  // Daylight pouring through the three storefront openings: deep sky above, warm hazy horizon below, bright sunlit street at the sill.
  const windows = [FRONT.windowA, FRONT.door, FRONT.windowB];
  const top = FRONT.lintel, bottom = FRONT.sill, mid = bottom + (top - bottom) * .38;
  for (const win of windows) {
    const width = win.x1 - win.x0, cx = (win.x0 + win.x1) / 2;
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(width, top - mid), glow(0x8fcfff, 15));
    upper.position.set(cx, (top + mid) / 2, ROOM.zFront - .2);
    upper.rotation.y = Math.PI;
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(width, mid - bottom), glow(0xfff0d2, 17));
    lower.position.set(cx, (mid + bottom) / 2, ROOM.zFront - .2);
    lower.rotation.y = Math.PI;
    scene.add(upper, lower);
  }
  // Ceiling lamps: warm spots + cool tubes (they stay on in the day, but small)
  for (const x of [-2.4, 0, 2.4]) {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(.35, .35), glow(0xffc78a, 6));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, h - .02, -.6);
    scene.add(lamp);
  }
  for (const z of [-3.2, 0.4]) {
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .12), glow(0xe8f4ff, 5));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, h - .02, z);
    scene.add(tube);
  }
  // Neon (cyan + coral accents on the back wall) - a small, coloured hot spot in every reflection
  const neonCyan = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .22), glow(0x19d5e8, 3.2));
  neonCyan.position.set(-.1, 2.25, ROOM.zBack + .1);
  const neonCoral = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .3), glow(0xff5b4a, 3));
  neonCoral.position.set(-.6, 2.62, ROOM.zBack + .1);
  scene.add(neonCyan, neonCoral);

  const pmrem = new THREE.PMREMGenerator(renderer);
  // captured from eye height in the middle of the room (the old capture sat on the floor plane, so the floor face z-fought)
  const target = pmrem.fromScene(scene, .03, .1, 100, { size, position: new THREE.Vector3(ROOM.cx, 1.5, ROOM.cz) });
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose?.(); o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
  return target.texture;
}
