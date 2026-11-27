// Lighting: shadow-casting sun through the storefront, warm track spots, neon sign, volumetric-looking
// light shafts and drifting dust motes. Shop lights and neon turn on when the store "opens".
import * as THREE from "three";
import { ROOM, FRONT } from "./layout.js";
import { createCanvas, textureFrom, rng } from "./util.js";
import { shaftTexture, softDotTexture } from "./textures.js";
import * as ART from "./artwork.js";

// Art direction v2 daylight rig (docs/ART_DIRECTION.md §5). One strong warm sun through the windows (hard-ish shadows),
// a cool lavender sky fill and a cool street bounce for COLOURED shadows, a warm floor bounce, warm practicals, neon that
// survives the sun. The sun sits lower than v1 so the window patterns travel deep into the shop.
export const DAY_SUN = {
  // direction light TRAVELS (from the windows into the shop): toward +x, downward, toward -z
  direction: new THREE.Vector3(.50, -.38, -.78).normalize(),
  color: 0xffdba6,
  intensity: 7.6
};
const SUN_DISTANCE = 30;
export const HAZE = { color: 0xd6e8f2, near: 4, far: 46 };
const ENV_BASE = .36;
const BOUNCE = 4.2;   // warm floor-bounce points beside the windows (they stand 1 m from the sill: keep them gentle or the sill clips)
const FONT_FALLBACK = '"Unbounded Black", "Unbounded", "Arial Black", Arial, sans-serif';

const SHAFT_VERT = /* glsl */`
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FRAG = /* glsl */`
uniform sampler2D map;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
varying float vDist;
void main() {
  float a = texture2D(map, vec2(vUv.x, vUv.y)).a;
  float drift = 0.82 + 0.18 * sin(uTime * 0.35 + uSeed * 6.2831 + vUv.y * 5.0);
  float fade = smoothstep(0.6, 2.6, vDist);
  float alpha = a * fade * drift * uIntensity;
  gl_FragColor = vec4(uColor * alpha, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const DUST_VERT = /* glsl */`
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uScale;
varying float vTwinkle;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aPhase * 17.0) * 0.18 + sin(uTime * 0.37 + aPhase * 5.0) * 0.04;
  p.y += sin(uTime * 0.09 + aPhase * 23.0) * 0.10 - mod(uTime * 0.012 + aPhase * 3.0, 1.0) * 0.0;
  p.z += cos(uTime * 0.13 + aPhase * 11.0) * 0.18;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.5, -mv.z), 1.0, 9.0);
  vTwinkle = 0.45 + 0.55 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
}`;
const DUST_FRAG = /* glsl */`
uniform sampler2D map;
uniform float uIntensity;
varying float vTwinkle;
void main() {
  float a = texture2D(map, gl_PointCoord).a;
  float alpha = a * vTwinkle * uIntensity;
  gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * alpha, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Neon sign face: ink panel, two lines of tube lettering (SIDE A coral / RECORDS cyan) and a pill-shaped tube border.
function neonTexture() {
  const W = 2048, H = 512;
  let c = null;
  try { c = ART.drawNeonBoard?.([["SIDE A", "#ff8a95", "#ff4a5e"], ["RECORDS", "#8ff6ff", "#19d5e8"]], { width: W, height: H, bg: "#0b0e22" }); } catch { c = null; }
  if (!c) {
    c = createCanvas(W, H);
    const g = c.getContext("2d");
    g.fillStyle = "#0b0e22"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const tube = (text, y, size, color, glow) => {
      g.font = `900 ${size}px ${FONT_FALLBACK}`;
      g.shadowColor = glow; g.shadowBlur = 36; g.lineWidth = 12; g.strokeStyle = glow; g.globalAlpha = .6; g.strokeText(text, W / 2, y);
      g.shadowBlur = 14; g.lineWidth = 7; g.strokeStyle = color; g.globalAlpha = 1; g.strokeText(text, W / 2, y);
      g.shadowBlur = 0; g.lineWidth = 2.5; g.strokeStyle = "#ffffff"; g.globalAlpha = .9; g.strokeText(text, W / 2, y);
    };
    tube("SIDE A", 160, 270, "#ff8a95", "#ff4a5e");
    tube("RECORDS", 400, 150, "#8ff6ff", "#19d5e8");
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  // tube border (pill) - drawn over the text canvas so the sign reads as a framed game-hub marquee
  const g = c.getContext("2d");
  const r = 56, m = 26;
  const pill = () => { g.beginPath(); g.moveTo(m + r, m); g.arcTo(W - m, m, W - m, H - m, r); g.arcTo(W - m, H - m, m, H - m, r); g.arcTo(m, H - m, m, m, r); g.arcTo(m, m, W - m, m, r); g.closePath(); };
  g.save();
  g.shadowColor = "#6b4dff"; g.shadowBlur = 40; g.lineWidth = 16; g.strokeStyle = "#6b4dff"; g.globalAlpha = .55; pill(); g.stroke();
  g.shadowBlur = 14; g.lineWidth = 9; g.strokeStyle = "#a995ff"; g.globalAlpha = 1; pill(); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.globalAlpha = .9; pill(); g.stroke();
  g.restore();
  return textureFrom(c, { srgb: true, repeat: false, anisotropy: 4 });
}
function openNeonTexture() {
  let c = null;
  try { c = ART.drawOpenNeon?.("OPEN", { width: 512, height: 256, color: "#9dffd9", glow: "#3ee6a8", bg: "#0b0e22" }); } catch { c = null; }
  if (!c) {
    c = createCanvas(512, 256);
    const g = c.getContext("2d");
    g.fillStyle = "#0b0e22"; g.fillRect(0, 0, 512, 256);
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 130px ${FONT_FALLBACK}`;
    g.shadowColor = "#3ee6a8"; g.shadowBlur = 30; g.lineWidth = 8; g.strokeStyle = "#9dffd9"; g.strokeText("OPEN", 256, 128);
    g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.strokeText("OPEN", 256, 128);
  }
  return textureFrom(c, { srgb: true, repeat: false });
}

// Foliage dapple: alpha-only leaf clusters. Used by an invisible, shadow-only canopy standing in the sun's path outside the windows, so the
// sun reaches the shop as moving leaf-shaped light patches (the "tree across the street" every game daylight hub has).
function dappleTexture() {
  const S = 512;
  const c = createCanvas(S, S);
  const g = c.getContext("2d");
  const rand = rng(31);
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#fff";
  for (let i = 0; i < 150; i++) {
    const x = rand() * S, y = rand() * S, rx = 11 + rand() * 20, ry = 6 + rand() * 11, a = rand() * Math.PI;
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {   // wrap so the texture tiles
      if (ox && (x + ox < -40 || x + ox > S + 40)) continue;
      if (oy && (y + oy < -40 || y + oy > S + 40)) continue;
      g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); g.fill();
    }
  }
  const t = textureFrom(c, { srgb: false, repeat: true, anisotropy: 2 });
  t.repeat.set(2.2, 1.1);
  return t;
}

export function buildLighting(ctx) {
  const { scene, quality, materials: m } = ctx;
  const out = { updaters: [], lights: ctx.lights };
  const SUN_DIR = DAY_SUN.direction;
  // IBL carries the coloured ambient (see environment.js); direct lights add the sun, fills and practicals on top.
  scene.environmentIntensity = ENV_BASE;
  if (quality.hazeFog) scene.fog = new THREE.Fog(HAZE.color, HAZE.near, HAZE.far);
  else scene.fog = new THREE.Fog(HAZE.color, 10, 60);

  // ---------------------------------------------------------------- sun (the one hard, warm key light)
  const sun = new THREE.DirectionalLight(DAY_SUN.color, DAY_SUN.intensity);
  const target = new THREE.Object3D();
  target.position.set(0, 0, -.5);
  sun.target = target;
  sun.position.copy(target.position).addScaledVector(SUN_DIR, -SUN_DISTANCE);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  sun.shadow.radius = quality.sunSoft ?? 2;
  scene.add(sun, target);
  ctx.lights.sun = sun;
  // Tight orthographic bounds: project the room box into light space so every shadow texel lands inside the shop
  // (v1 used a fixed 14.4 m frustum: ~2x blurrier shadows for the same map size).
  const probe = new THREE.OrthographicCamera();
  const corner = new THREE.Vector3(), lo = new THREE.Vector3(), hi = new THREE.Vector3();
  const aimSun = (direction) => {
    sun.position.copy(target.position).addScaledVector(direction, -SUN_DISTANCE);
    probe.position.copy(sun.position);
    probe.lookAt(target.position);
    probe.updateMatrixWorld(true);
    const inv = probe.matrixWorldInverse.copy(probe.matrixWorld).invert();
    lo.set(Infinity, Infinity, Infinity); hi.set(-Infinity, -Infinity, -Infinity);
    for (const x of [ROOM.x0 - .4, ROOM.x1 + .4]) for (const y of [-.05, ROOM.height + .2]) for (const z of [ROOM.zBack - .3, ROOM.zFront + .5]) {
      corner.set(x, y, z).applyMatrix4(inv);
      lo.min(corner); hi.max(corner);
    }
    const cam = sun.shadow.camera;
    cam.left = lo.x - .2; cam.right = hi.x + .2; cam.bottom = lo.y - .2; cam.top = hi.y + .2;
    cam.near = Math.max(.5, -hi.z - 14); cam.far = -lo.z + 3;   // near leaves room for the leaf canopy standing ~9 m outside the windows
    cam.updateProjectionMatrix();
  };
  aimSun(SUN_DIR);
  out.aimSun = aimSun; // dev/tuning: re-aim the sun (shafts keep the built direction)

  // Shadow-only leaf canopy (layer 1 is enabled on the sun's shadow camera only, so no camera ever sees it).
  let canopy = null;
  if (quality.dapple) {
    sun.shadow.camera.layers.enable(1);
    const dappleMat = new THREE.MeshBasicMaterial({ map: dappleTexture(), alphaTest: .5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
    canopy = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), dappleMat);
    canopy.layers.set(1);
    canopy.castShadow = true;
    canopy.frustumCulled = false;
    canopy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), SUN_DIR.clone().negate());
    canopy.userData.home = new THREE.Vector3(0, 1.9, ROOM.zFront).addScaledVector(SUN_DIR, -9);
    canopy.position.copy(canopy.userData.home);
    scene.add(canopy);
    out.canopy = canopy;
  }

  // ---------------------------------------------------------------- sky fill (cool, shadow-free): coloured shadows
  // Lights what the visitor sees (surfaces facing the windows) with a lavender-blue sky tint, so sun shadows are violet, not grey.
  const skyFill = new THREE.DirectionalLight(0xa4b4ff, quality.skyFill ? 1.5 : 0);
  skyFill.position.set(-2.5, 7, 11);
  skyFill.target.position.set(0, .5, -1);
  skyFill.userData.base = skyFill.intensity;
  scene.add(skyFill, skyFill.target);
  ctx.lights.skyFill = skyFill;

  // ---------------------------------------------------------------- warm track spots (practicals)
  const spotDefs = [
    { pos: [-2.0, 3.16, .9], at: [-1.9, .95, .1], intensity: 5.5, angle: .6 },
    { pos: [2.5, 3.16, -2.4], at: [2.56, 1.38, -3.95], intensity: 8.5, angle: .52 },   // counter key: aimed at the shopkeeper's chest/face (and the counter top), not just the counter
    { pos: [-2.4, 3.16, 3.9], at: [-3.0, 1.0, 4.2], intensity: 8, angle: .7 },
    { pos: [-.2, 3.16, .9], at: [-.3, .95, .1], intensity: 5.5, angle: .6 },
    { pos: [-.8, 3.16, -.7], at: [-.8, 1.25, -1.05], intensity: 5.5, angle: .55 },
    { pos: [-2.6, 3.16, -2.2], at: [-3.5, 1.6, -1.2], intensity: 8.5, angle: .55 },
    { pos: [.4, 3.16, 3.9], at: [1.0, 1.0, 4.4], intensity: 7.5, angle: .8 }
  ].slice(0, quality.spots + (quality.id === "high" ? 3 : quality.id === "medium" ? 2 : 1));
  const rails = [];
  spotDefs.forEach((def, i) => {
    const light = new THREE.SpotLight(0xffd6a0, def.intensity, 11, def.angle, .8, 2);
    light.position.set(...def.pos);
    light.target.position.set(...def.at);
    light.castShadow = i < quality.spotShadows;
    if (light.castShadow) { light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -.0005; light.shadow.normalBias = .03; light.shadow.camera.near = .5; light.shadow.camera.far = 10; }
    scene.add(light, light.target);
    light.userData.base = def.intensity;
    rails.push(light);
    // visible track head
    const head = new THREE.Group();
    head.position.set(...def.pos);
    head.position.y += .03;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, .14, 14), m.blackMetal);
    body.castShadow = false;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.05, 16), m.bulb);
    lens.position.y = -.071; lens.rotation.x = Math.PI / 2;
    head.add(body, lens);
    const dir = new THREE.Vector3(...def.at).sub(new THREE.Vector3(...def.pos)).normalize();
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    scene.add(head);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .1, 6), m.blackMetal);
    rod.position.set(def.pos[0], ROOM.height - .05, def.pos[2]);
    scene.add(rod);
  });
  // rails
  for (const z of [.9, -.7, -2.6, -2.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5.4, .03, .04), m.blackMetal);
    rail.position.set(0, ROOM.height - .02, z);
    scene.add(rail);
  }
  ctx.lights.spots = rails;
  const rackSpot = new THREE.SpotLight(0xd4f4ff, 11, 9, .8, .85, 2);
  rackSpot.position.set(1.4, 3.15, 1.95);
  rackSpot.target.position.set(3.5, 1.5, 1.95);
  scene.add(rackSpot, rackSpot.target);
  rackSpot.userData.base = 11;
  rails.push(rackSpot);

  // Hero rim light: a cool, narrow spot from behind-right that outlines the shopkeeper's hair and shoulder against the warm key
  // (game-hub "kicker"). Only medium/high; it follows the shop-lights ramp like the track spots.
  if (quality.skyFill) {
    const rim = new THREE.SpotLight(0x9fe6ff, 12, 6.5, .34, 1, 2);
    rim.position.set(3.45, 2.7, -5.3);
    rim.target.position.set(2.6, 1.5, -4.35);
    rim.userData.base = 12;
    scene.add(rim, rim.target);
    rails.push(rim);
    ctx.lights.rim = rim;
  }

  // counter lamp (practical)
  const counterLamp = new THREE.PointLight(0xffc27a, 1.4, 4.5, 2);
  counterLamp.position.set(2.5, 1.9, -3.1);
  scene.add(counterLamp);
  ctx.lights.counter = counterLamp;

  // ---------------------------------------------------------------- bounce
  // Warm floor bounce (sunlit boards re-emit) near the storefront so the window side never goes black; the cool street bounce
  // (high tier) tints undersides and floor edges blue. The hemisphere is a whisper of sky-vs-ground colour for every tier.
  const fill = new THREE.HemisphereLight(0xc9d2ff, 0xffd0a0, .12);
  scene.add(fill);
  ctx.lights.fill = fill;
  const bounce = new THREE.PointLight(0xffe0ac, BOUNCE, 8, 2);
  bounce.position.set(-1.2, 1.4, 3.9);
  bounce.userData.base = BOUNCE;
  scene.add(bounce);
  const bounce2 = new THREE.PointLight(0xffe0ac, BOUNCE, 8, 2);
  bounce2.position.set(2.2, 1.4, 3.6);
  bounce2.userData.base = BOUNCE;
  scene.add(bounce2);
  ctx.lights.bounce = [bounce, bounce2];
  if (quality.streetBounce) {
    const street = new THREE.PointLight(0x8fb4ff, 6, 8, 2);
    street.position.set(.2, .35, ROOM.zFront + 1.6);
    street.userData.base = 6;
    scene.add(street);
    ctx.lights.street = street;
  }

  // ---------------------------------------------------------------- neon signs
  // Neon must survive the sun: bright HDR emissive on an ink panel + coloured point lights (they bloom and tint the wall).
  // Unlit (MeshBasic): the ink panel stays deep ink in any light (a lit/specular material veils it with sky reflections), only the tubes glow.
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTexture(), color: 0x000000, fog: false });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), neonMat);
  neon.position.set(-.55, 2.5, ROOM.zBack + .045);
  scene.add(neon);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x151a38, roughness: .62, metalness: 0, name: "neonBoard" });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.74, .78, .04), boardMat);
  board.position.set(-.55, 2.5, ROOM.zBack + .02);
  scene.add(board);
  const neonLight = new THREE.PointLight(0xff5b6e, 0, 5, 2);
  neonLight.position.set(-.55, 2.4, ROOM.zBack + .5);
  scene.add(neonLight);
  const neonLight2 = new THREE.PointLight(0x19d5e8, 0, 4, 2);
  neonLight2.position.set(.5, 2.2, ROOM.zBack + .6);
  scene.add(neonLight2);
  ctx.lights.neon = [neonLight, neonLight2];

  const openMat = new THREE.MeshBasicMaterial({ map: openNeonTexture(), color: 0x000000, side: THREE.DoubleSide, fog: false });
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(.62, .31), openMat);
  openSign.position.set(2.55, 2.15, ROOM.zFront - .05);
  scene.add(openSign);
  const openLight = new THREE.PointLight(0x3ee6a8, 0, 3, 2);
  openLight.position.set(2.55, 2.1, ROOM.zFront - .5);
  scene.add(openLight);
  for (const x of [-.12, .12]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .45, 4), m.steel);
    chain.position.set(2.55 + x * 2, 2.15 + .38, ROOM.zFront - .05);
    scene.add(chain);
  }

  // ---------------------------------------------------------------- light shafts + dust
  const dir = SUN_DIR.clone();
  const shaftTex = shaftTexture(96, 512, 7);
  const shaftGroup = new THREE.Group();
  const shaftMats = [];
  const openings = [FRONT.windowA, FRONT.windowB, { x0: FRONT.door.x0, x1: FRONT.door.x1 }];
  const rand = rng(5);
  const SHAFT_BASE = .18;
  if (quality.shafts) {
    for (const win of openings) {
      const count = Math.max(3, Math.round((win.x1 - win.x0) / .38));
      for (let i = 0; i < count; i++) {
        const x = win.x0 + (i + .5) / count * (win.x1 - win.x0) + (rand() - .5) * .1;
        const top = new THREE.Vector3(x, FRONT.lintel - .05, ROOM.zFront - .1);
        const bottom = new THREE.Vector3(x, FRONT.sill + .02, ROOM.zFront - .1);
        const tTop = top.y / -dir.y, tBottom = bottom.y / -dir.y;
        const A = top, B = bottom;
        const C = bottom.clone().addScaledVector(dir, tBottom * .995);
        const D = top.clone().addScaledVector(dir, tTop * .995);
        const sheet = (p0, p1, p2, p3) => {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p3.toArray()], 3));
          g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
          g.setIndex([0, 1, 2, 0, 2, 3]);
          return g;
        };
        const ribbons = [sheet(A, B, C, D)];
        // crossing horizontal ribbon along the beam axis so the shaft has volume from every angle
        const mid0 = A.clone().lerp(B, .5), mid1 = D.clone().lerp(C, .5);
        const side = new THREE.Vector3(1, 0, 0).multiplyScalar(.2 + rand() * .1);
        ribbons.push(sheet(mid0.clone().sub(side), mid0.clone().add(side), mid1.clone().add(side), mid1.clone().sub(side)));
        for (const g of ribbons) {
          const mat = new THREE.ShaderMaterial({
            vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { map: { value: shaftTex }, uColor: { value: new THREE.Color(1, .86, .6) }, uIntensity: { value: SHAFT_BASE }, uTime: { value: 0 }, uSeed: { value: rand() } }
          });
          const mesh = new THREE.Mesh(g, mat);
          mesh.frustumCulled = false; mesh.renderOrder = 4;
          shaftGroup.add(mesh);
          shaftMats.push(mat);
        }
      }
    }
    scene.add(shaftGroup);
  }

  // dust motes inside the beams
  let dust = null;
  if (quality.dust > 0) {
    const count = quality.dust;
    const positions = new Float32Array(count * 3), phases = new Float32Array(count), sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const win = openings[Math.floor(rand() * openings.length)];
      const x = win.x0 + rand() * (win.x1 - win.x0);
      const y = FRONT.sill + rand() * (FRONT.lintel - FRONT.sill);
      const t = rand() * (y / -dir.y) * .95;
      const p = new THREE.Vector3(x, y, ROOM.zFront - .1).addScaledVector(dir, t);
      positions.set([p.x, Math.max(.15, p.y), p.z], i * 3);
      phases[i] = rand(); sizes[i] = .6 + rand() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: softDotTexture(64) }, uTime: { value: 0 }, uScale: { value: 46 }, uIntensity: { value: .75 } }
    });
    dust = new THREE.Points(geo, mat);
    dust.frustumCulled = false; dust.renderOrder = 5;
    scene.add(dust);
  }

  // ---------------------------------------------------------------- state
  const state = { level: 0, target: 0, neon: 0, neonTarget: 0, flicker: 0, hold: 0 };
  const apply = () => {
    const level = state.level;
    for (const s of rails) s.intensity = s.userData.base * level;
    ctx.lights.counter.intensity = 1.4 * level;
    if (ctx.lights.lamp) ctx.lights.lamp.intensity = 1.4 * level;
    if (ctx.lights.floorLamp) ctx.lights.floorLamp.intensity = 2.4 * level;
    m.tube.color.setRGB(.96, 1, .98).multiplyScalar(.3 + 3.4 * level);
    m.bulb.color.setRGB(1, .86, .62).multiplyScalar(.25 + 3.8 * level);
    const neonOn = state.neon;
    neonMat.color.setScalar(.05 + 3.6 * neonOn);   // faint tube outlines while off, white-hot tubes on
    neonLight.intensity = 3.6 * neonOn; neonLight2.intensity = 2.2 * neonOn;
    openMat.color.setScalar(.05 + 3 * neonOn); openLight.intensity = 2.2 * neonOn;
    for (const mat of ctx.neonMaterials || []) mat.emissiveIntensity = (mat.userData.neonBase ?? 1) * neonOn;
    for (const l of ctx.neonLights || []) l.intensity = l.userData.base * neonOn;
  };
  out.setShopLights = (on, instant = false) => { state.target = on ? 1 : 0; if (instant) { state.level = state.target; apply(); } };
  out.setNeon = (on, instant = false) => { state.neonTarget = on ? 1 : 0; if (instant) { state.neon = state.neonTarget; apply(); } };
  // A record held right under the visitor's nose sits next to every light that stands behind the camera: dim them so it never blows out.
  out.setHold = (amount) => {
    state.hold = amount;
    for (const l of ctx.lights.bounce || []) l.intensity = (l.userData.base ?? BOUNCE) * (1 - .88 * amount);
    if (ctx.lights.street) ctx.lights.street.intensity = ctx.lights.street.userData.base * (1 - .9 * amount);
    skyFill.intensity = skyFill.userData.base * (1 - .45 * amount);
    sun.intensity = DAY_SUN.intensity * (1 - .22 * amount);
    scene.environmentIntensity = ENV_BASE * (1 - .18 * amount);
  };
  // Tier step-down at runtime: drop the optional lights/softness (the rebuilt composer handles the passes).
  out.setQuality = (q) => {
    skyFill.userData.base = q.skyFill ? 1.5 : 0; skyFill.intensity = skyFill.userData.base * (1 - .45 * state.hold);
    if (ctx.lights.street && !q.streetBounce) { ctx.lights.street.userData.base = 0; ctx.lights.street.intensity = 0; }
    sun.shadow.radius = q.sunSoft ?? 2;
  };
  out.update = (dt, elapsed) => {
    state.level += (state.target - state.level) * (1 - Math.exp(-3 * dt));
    // neon: stuttering ignition then a faint breathing hum
    if (state.neonTarget > state.neon) state.flicker += dt;
    // reduced motion: a plain smooth ramp (no ~10 Hz stutter, no hum) and frozen shaft/dust drift
    const motion = ctx.reducedMotion ? 0 : 1;
    const ignite = state.neonTarget > .5 ? Math.min(1, state.flicker / 1.1) : 0;
    const stutter = ignite < 1 && motion ? (Math.sin(elapsed * 61) > .2 || Math.sin(elapsed * 23) > .5 ? 1 : .08) : 1;
    state.neon = state.neonTarget > .5 ? ignite * stutter * (.96 + Math.sin(elapsed * 2.1) * .04 * motion) : state.neon * (1 - Math.min(1, dt * 8));
    if (state.neonTarget < .5) state.flicker = 0;
    apply();
    if (canopy && !ctx.reducedMotion) {
      const sway = canopy.userData.sway ||= { right: new THREE.Vector3(), up: new THREE.Vector3() };
      sway.right.set(1, 0, 0).applyQuaternion(canopy.quaternion); sway.up.set(0, 1, 0).applyQuaternion(canopy.quaternion);
      canopy.position.copy(canopy.userData.home).addScaledVector(sway.right, Math.sin(elapsed * .21) * .5 + Math.sin(elapsed * .53) * .08).addScaledVector(sway.up, Math.sin(elapsed * .17) * .22);
    }
    const drift = motion ? elapsed : 0;
    for (const mat of shaftMats) { mat.uniforms.uTime.value = drift; }
    if (dust) dust.material.uniforms.uTime.value = drift;
  };
  out.setShaftIntensity = (v) => { for (const mat of shaftMats) mat.uniforms.uIntensity.value = v; };
  out.dust = dust;
  out.shafts = shaftGroup;
  out.sun = sun;
  out.skyFill = skyFill;
  out.apply = apply;
  apply();
  return out;
}
