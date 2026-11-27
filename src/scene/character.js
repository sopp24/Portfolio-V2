// A baked, rigged character in the scene: skinned parts + procedurally built eyes (sclera, iris, cornea),
// blinking eyelids, jaw, eye/head tracking and helpers to pose the skeleton.
import * as THREE from "three";
import { loadCharacterFiles, buildGeometry, buildSkeleton, MATERIAL_FACTORY, patchCharacterMaterial } from "./character-core.js";

const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------------------------------------
// eye textures (cached per colour)
// ---------------------------------------------------------------------------------------------
const eyeTextures = new Map();
// iris: sRGB colour; irisDeg: angular radius of the iris on the eyeball (36 = natural, 42-46 = big stylised eyes); pupil: pupil/iris ratio
function eyeTexture(iris, irisDeg = 36, pupilRatio = 0.42) {
  const key = iris.join(",") + "|" + irisDeg + "|" + pupilRatio;
  if (eyeTextures.has(key)) return eyeTextures.get(key);
  const W = 1024, H = 512;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#efeae4"; g.fillRect(0, 0, W, H);
  // sclera: soft warm shading toward the corners (lids cast a soft shadow) and a few faint capillaries
  const sh = g.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, "rgba(190,140,120,.3)"); sh.addColorStop(.25, "rgba(255,255,255,0)"); sh.addColorStop(.75, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(190,140,120,.3)");
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  const cx = W * 0.25, cy = H * 0.5, R = (irisDeg / 360) * W; // iris radius in px (1024 px = 360 degrees)
  g.strokeStyle = "rgba(200,90,80,.1)"; g.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 12), cy + Math.sin(a) * (R + 12)); g.quadraticCurveTo(cx + Math.cos(a + .2) * (R + 45), cy + Math.sin(a + .2) * (R + 45), cx + Math.cos(a + .1) * (R + 100), cy + Math.sin(a + .1) * (R + 100)); g.stroke(); }
  const col = (k, a = 1) => `rgba(${Math.min(255, Math.round(iris[0] * 255 * k))},${Math.min(255, Math.round(iris[1] * 255 * k))},${Math.min(255, Math.round(iris[2] * 255 * k))},${a})`;
  // iris body (lighter ring near the pupil, dark limbal ring at the edge: the stylised "dark eye" read)
  const body = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  body.addColorStop(0, col(1.5)); body.addColorStop(.5, col(1.05)); body.addColorStop(.86, col(.6)); body.addColorStop(1, col(.2));
  g.fillStyle = body; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  // radial fibres (soft)
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 + ((i * 7919) % 100) * 0.0004;
    g.strokeStyle = col(i % 2 ? 1.7 : .5, .22); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .34, cy + Math.sin(a) * R * .34); g.lineTo(cx + Math.cos(a) * R * (.8 + (i % 5) * .03), cy + Math.sin(a) * R * (.8 + (i % 5) * .03)); g.stroke();
  }
  // pupil + soft edge
  const pr = R * pupilRatio;
  const pupil = g.createRadialGradient(cx, cy, pr * .55, cx, cy, pr * 1.1);
  pupil.addColorStop(0, "#030303"); pupil.addColorStop(.75, "#050505"); pupil.addColorStop(1, "rgba(5,5,5,0)");
  g.fillStyle = pupil; g.beginPath(); g.arc(cx, cy, pr * 1.1, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.wrapS = THREE.RepeatWrapping;
  eyeTextures.set(key, tex);
  return tex;
}

function lidGeometry(radius, skin, rimColor, lower = false) {
  const g = lower
    ? new THREE.SphereGeometry(radius, 28, 12, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28)
    : new THREE.SphereGeometry(radius, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const pos = g.attributes.position; const colors = new Float32Array(pos.count * 3);
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const base = skin.map(lin), rim = rimColor.map(lin);
  for (let i = 0; i < pos.count; i++) {
    const theta = Math.acos(clamp(pos.getY(i) / radius, -1, 1)) / Math.PI; // 0 at the pole
    const edge = lower ? clamp((0.72 - theta) / 0.05 + 1, 0, 1) * 0 : clamp((theta - 0.5) / 0.075, 0, 1);
    for (let k = 0; k < 3; k++) colors[i * 3 + k] = base[k] + (rim[k] - base[k]) * edge;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

// ---------------------------------------------------------------------------------------------
export class Character {
  constructor(id) {
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = "character:" + id;
    this.bones = {};
    this.meshes = {};
    this.eyes = [];
    this.state = { blink: 0, nextBlink: 1.5 + Math.random() * 3, headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0, jaw: 0, talk: 0 };
    this.tmp = { v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
    this.lod = null;
  }

  bone(name) { return this.bones[name]; }

  dispose() {
    this.root.traverse((o) => { o.geometry?.dispose?.(); });
  }

  // Build everything from a loaded manifest/buffer pair
  build(manifest, buffer, { quality } = {}) {
    this.manifest = manifest;
    const bones = buildSkeleton(manifest);
    for (const b of bones) this.bones[b.name] = b;
    this.root.add(bones[0]);
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(bones);
    this.materials = {};
    for (const part of manifest.parts) {
      const geometry = buildGeometry(manifest, part, buffer);
      const key = part.material;
      const mat = (MATERIAL_FACTORY[key] || MATERIAL_FACTORY.plain)();
      if (part.name === "head" && !this.materials.skin) this.materials.skin = mat;
      const mesh = new THREE.SkinnedMesh(geometry, mat);
      mesh.name = part.name;
      mesh.bind(this.skeleton);
      mesh.frustumCulled = false;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.raycast = () => {}; // picking uses dedicated proxies
      this.root.add(mesh);
      this.meshes[part.name] = mesh;
    }
    const headPart = manifest.parts.find((p) => p.name === "head");
    if (headPart && headPart.extra && headPart.extra.eyeCenters) this.buildEyes(headPart.extra.eyeCenters, headPart.extra.headScale || 1);
    this.lod = manifest.lod;
    return this;
  }

  buildEyes(centers, HS) {
    const style = this.manifest.style || {};
    const eyeDef = this.manifest.eyes || { iris: [0.3, 0.3, 0.3], size: 1, lid: 0.35 };
    const skin = style.skin || [0.87, 0.63, 0.5];
    const rimColor = (style.lidRim || [skin[0] * 0.45, skin[1] * 0.3, skin[2] * 0.28]);
    const headBone = this.bones.head;
    const R = 0.0135 * HS * (eyeDef.size || 1);
    const tex = eyeTexture(eyeDef.iris, eyeDef.irisR, eyeDef.pupil);
    const skinMat = patchCharacterMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd7c0), clearcoat: 0.1, envMapIntensity: 0.8 }), { detailScale: 95, detailBump: 0.25, sss: { wrap: 0.5, color: 0xff6a4a }, key: "lid" });
    const eyeMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.28, metalness: 0, envMapIntensity: 0.5, name: "eye" });
    const corneaMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.1, depthWrite: false, name: "cornea" });
    const sphereGeo = new THREE.SphereGeometry(R, 40, 28);
    // painted catch-light (stylised characters): a small white disc fixed to the head, upper-left of the pupil, so the eyes always look alive
    const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, name: "catchlight" });
    const catchGeo = new THREE.CircleGeometry(R * (eyeDef.catch ?? 0.15), 14);
    const corneaGeo = new THREE.SphereGeometry(R * 1.012, 32, 22);
    const lidR = R * (eyeDef.lidScale ?? 1.1);
    const upperGeo = lidGeometry(lidR, skin, rimColor, false);
    const lowerGeo = lidGeometry(lidR, skin, rimColor, true);
    for (const c of centers) {
      const holder = new THREE.Group();
      // eye centre is in character space; convert to head-bone local space
      const world = new THREE.Vector3(...c);
      holder.position.copy(headBone.worldToLocal(world.clone()));
      const ball = new THREE.Mesh(sphereGeo, eyeMat);
      const cornea = new THREE.Mesh(corneaGeo, corneaMat);
      ball.add(cornea);
      // sphere front is +z at u = 0.25: rotate so the iris faces +z
      ball.rotation.y = 0;
      const upper = new THREE.Mesh(upperGeo, skinMat);
      const lower = new THREE.Mesh(lowerGeo, skinMat);
      holder.add(ball, upper, lower);
      if (eyeDef.catch !== 0) {
        const spark = new THREE.Mesh(catchGeo, catchMat);
        spark.position.set(-R * 0.3, R * 0.3, R * 1.022 * Math.sqrt(1 - 0.18));
        spark.castShadow = false; spark.raycast = () => {};
        holder.add(spark);
      }
      for (const m of [ball, upper, lower]) { m.castShadow = false; m.receiveShadow = true; m.raycast = () => {}; }
      cornea.castShadow = false; cornea.raycast = () => {};
      headBone.add(holder);
      this.eyes.push({ holder, ball, upper, lower, side: c[0] >= 0 ? 1 : -1, open: -(eyeDef.lid ?? 0.35), lowerOpen: eyeDef.lowerLid ?? 0.04 });
    }
    this.eyeOpen = -(eyeDef.lid ?? 0.35);
    this.setLids(0);
  }

  // closed = 0 (open) .. 1 (shut)
  setLids(closed) {
    for (const eye of this.eyes) {
      eye.upper.rotation.x = THREE.MathUtils.lerp(eye.open, 1.35, closed);
      eye.lower.rotation.x = THREE.MathUtils.lerp(eye.lowerOpen, -0.28, closed);
    }
  }

  /**
   * opts: { lookAt: Vector3 (world), look: 0..1 (how strongly to face it), talk: 0..1, dt, elapsed, headRange }
   * Applies head/eye tracking, blinking and jaw motion. Body posing is done by the caller via this.bone().
   */
  animateFace(dt, elapsed, { lookAt = null, look = 0.7, talk = 0, headYawLimit = 0.9, headPitchLimit = 0.35, restYaw = 0, restPitch = 0 } = {}) {
    const s = this.state;
    const k = 1 - Math.exp(-6 * dt);
    let yaw = restYaw, pitch = restPitch;
    if (lookAt) {
      const head = this.bones.head;
      head.parent.updateWorldMatrix(true, false);
      const origin = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
      const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
      const local = lookAt.clone().applyMatrix4(rootInv).sub(origin.clone().applyMatrix4(rootInv));
      const yawTo = Math.atan2(local.x, local.z);
      const pitchTo = -Math.atan2(local.y, Math.hypot(local.x, local.z));
      yaw = clamp(yawTo, -headYawLimit, headYawLimit) * look + restYaw * (1 - look);
      pitch = clamp(pitchTo, -headPitchLimit, headPitchLimit) * look + restPitch * (1 - look);
    }
    s.headYaw += (yaw - s.headYaw) * k;
    s.headPitch += (pitch - s.headPitch) * k;
    const drift = Math.sin(elapsed * 0.6 + this.id.length) * 0.02;
    this.bones.neck.rotation.set(s.headPitch * 0.35, s.headYaw * 0.35, 0);
    this.bones.head.rotation.set(s.headPitch * 0.65 + drift * 0.5, s.headYaw * 0.65 + drift, Math.sin(elapsed * 0.4) * 0.015);
    // eyes lead the head a little
    const eyeYaw = clamp((yaw - s.headYaw * 0.65 - s.headYaw * 0.35) * 1.2, -0.3, 0.3);
    const eyePitch = clamp((pitch - s.headPitch) * 1.2, -0.2, 0.2);
    s.eyeYaw += (eyeYaw - s.eyeYaw) * (1 - Math.exp(-14 * dt));
    s.eyePitch += (eyePitch - s.eyePitch) * (1 - Math.exp(-14 * dt));
    for (const eye of this.eyes) eye.ball.rotation.set(s.eyePitch, s.eyeYaw, 0);
    // blink
    s.nextBlink -= dt;
    if (s.nextBlink <= 0 && s.blink <= 0) { s.blink = 1; s.nextBlink = 2.2 + Math.random() * 3.8; if (Math.random() < 0.15) s.nextBlink = 0.35; }
    if (s.blink > 0) { s.blink = Math.max(0, s.blink - dt * 7.5); }
    const closed = Math.sin(Math.min(1, 1 - s.blink) * Math.PI);
    this.setLids(s.blink > 0 ? closed : 0);
    // jaw (speech): irregular open/close envelope
    s.talk += (talk - s.talk) * (1 - Math.exp(-8 * dt));
    const speech = s.talk * (0.35 + 0.65 * Math.abs(Math.sin(elapsed * 9.3) * Math.sin(elapsed * 5.1 + 1.3)));
    s.jaw += (speech * 0.2 - s.jaw) * (1 - Math.exp(-18 * dt));
    this.bones.jaw.rotation.x = s.jaw;
  }
}

export async function loadCharacter(id, { lod = "hi", base = "assets/characters/" } = {}) {
  const { manifest, buffer } = await loadCharacterFiles(`${base}${id}.${lod}`);
  const c = new Character(id);
  return c.build(manifest, buffer);
}
