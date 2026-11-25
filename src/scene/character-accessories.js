// Runtime accessories for baked characters: round glasses and neck-worn headphones.
import * as THREE from "three";

export function addGlasses(character, { color = 0x1a1612, tint = 0xdfe9ee, radius = 0.0185, metal = 0.5 } = {}) {
  const HS = character.manifest.parts.find((p) => p.name === "head")?.extra?.headScale || 1;
  const head = character.bones.head;
  const group = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: metal, envMapIntensity: 1.1 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide });
  const r = radius * HS, tube = 0.0013 * HS;
  const rimGeo = new THREE.TorusGeometry(r, tube, 10, 44);
  const lensGeo = new THREE.CircleGeometry(r, 36);
  const eyes = character.eyes.map((e) => e.holder.position);
  const zFront = eyes[0].z + 0.0145 * HS;
  for (const p of eyes) {
    const rim = new THREE.Mesh(rimGeo, frameMat); rim.position.set(p.x, p.y, zFront);
    const lens = new THREE.Mesh(lensGeo, lensMat); lens.position.set(p.x, p.y, zFront);
    rim.castShadow = true; lens.castShadow = false; lens.raycast = rim.raycast = () => {};
    group.add(rim, lens);
  }
  // bridge
  const bridgeCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-eyes[0].x * 0 + Math.min(eyes[0].x, eyes[1].x) + r, eyes[0].y + r * 0.35, zFront), new THREE.Vector3(0, eyes[0].y + r * 0.6, zFront + 0.004 * HS), new THREE.Vector3(Math.max(eyes[0].x, eyes[1].x) - r, eyes[0].y + r * 0.35, zFront));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 12, tube, 6), frameMat));
  // temples to the ears
  for (const p of eyes) {
    const s = Math.sign(p.x) || 1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(p.x + s * r, p.y + 0.001, zFront), new THREE.Vector3(s * 0.073 * HS, p.y + 0.0015, zFront - 0.04 * HS),
      new THREE.Vector3(s * 0.077 * HS, p.y - 0.001, -0.012 * HS), new THREE.Vector3(s * 0.076 * HS, p.y - 0.022 * HS, -0.026 * HS)
    ]);
    const temple = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, tube, 6), frameMat);
    temple.castShadow = true; temple.raycast = () => {};
    group.add(temple);
  }
  head.add(group);
  character.glasses = group;
  return group;
}

export function addHeadphones(character, { band = 0x16161a, pad = 0x2a2a30, accent = 0xe0763a, radius = 0.105, y = 0.2, drop = 0.085 } = {}) {
  const chest = character.bones.chest;
  const group = new THREE.Group();
  const bandMat = new THREE.MeshPhysicalMaterial({ color: band, roughness: 0.4, metalness: 0.2, envMapIntensity: 0.9 });
  const padMat = new THREE.MeshPhysicalMaterial({ color: pad, roughness: 0.75, sheen: 0.3, envMapIntensity: 0.6 });
  const accentMat = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.4, metalness: 0.1 });
  // band: a horseshoe around the back of the neck, ending at two cups resting on the chest
  const pts = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * (0.18 + (i / steps) * 1.64); // from front-left, round the back, to front-right
    pts.push(new THREE.Vector3(Math.sin(a) * radius, y - Math.sin(Math.abs(i / steps - 0.5) * 2 * Math.PI * 0.5) * 0.0, Math.cos(a) * radius * 0.92 - 0.018));
  }
  // flatten the ends down to the cups
  const left = new THREE.Vector3(0.078, y - drop, 0.092), right = new THREE.Vector3(-0.078, y - drop, 0.092);
  const curve = new THREE.CatmullRomCurve3([left, pts[0], ...pts.filter((_, i) => i % 3 === 0), pts[pts.length - 1], right]);
  const bandMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.0085, 10), bandMat);
  bandMesh.castShadow = true; bandMesh.raycast = () => {};
  group.add(bandMesh);
  for (const [pos, s] of [[left, 1], [right, -1]]) {
    const cup = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.024, 28), bandMat);
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0075, 10, 28), padMat);
    cushion.rotation.x = Math.PI / 2; cushion.position.y = -0.013;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0255, 0.0255, 0.004, 24), accentMat);
    cap.position.y = 0.0125;
    cup.add(shell, cushion, cap);
    cup.position.copy(pos);
    cup.rotation.set(-0.35, 0, s * 0.35); // tilt the cup so the cushion faces the chest
    cup.traverse((o) => { o.castShadow = true; o.raycast = () => {}; });
    group.add(cup);
  }
  chest.add(group);
  character.headphones = group;
  return group;
}
