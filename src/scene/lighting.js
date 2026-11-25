// Lighting: shadow-casting sun through the storefront, warm track spots, neon sign, volumetric-looking
// light shafts and drifting dust motes. Shop lights and neon turn on when the store "opens".
import * as THREE from "three";
import { ROOM, FRONT, SUN } from "./layout.js";
import { createCanvas, textureFrom, rng } from "./util.js";
import { shaftTexture, softDotTexture } from "./textures.js";
import { FONT } from "./artwork.js";

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

function neonTexture() {
  const c = createCanvas(2048, 512);
  const g = c.getContext("2d");
  g.fillStyle = "#07090a"; g.fillRect(0, 0, 2048, 512);
  const tube = (text, y, size, color, glow) => {
    g.save();
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `400 ${size}px ${FONT.display}`;
    g.shadowColor = glow; g.shadowBlur = 38; g.lineWidth = 14; g.strokeStyle = glow; g.globalAlpha = .55; g.strokeText(text, 1024, y);
    g.shadowBlur = 16; g.lineWidth = 8; g.strokeStyle = color; g.globalAlpha = 1; g.strokeText(text, 1024, y);
    g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.globalAlpha = .9; g.strokeText(text, 1024, y);
    g.restore();
  };
  tube("SIDE A", 200, 330, "#ff7ea8", "#ff2f7d");
  tube("RECORDS", 410, 130, "#7fffe6", "#16d9b3");
  return textureFrom(c, { srgb: true, repeat: false, anisotropy: 4 });
}
function openNeonTexture() {
  const c = createCanvas(512, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#07090a"; g.fillRect(0, 0, 512, 256);
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = `400 150px ${FONT.display}`;
  g.shadowColor = "#ff4a3a"; g.shadowBlur = 34; g.lineWidth = 8; g.strokeStyle = "#ff6a58"; g.strokeText("OPEN", 256, 128);
  g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = "#fff4ea"; g.strokeText("OPEN", 256, 128);
  return textureFrom(c, { srgb: true, repeat: false });
}

export function buildLighting(ctx) {
  const { scene, quality, materials: m } = ctx;
  const out = { updaters: [], lights: ctx.lights };
  scene.environmentIntensity = .32;
  scene.fog = new THREE.Fog(0xcfbf9a, 9, 48);

  // ---------------------------------------------------------------- sun
  const sun = new THREE.DirectionalLight(SUN.color, 5.5);
  const target = new THREE.Object3D();
  target.position.set(0, 0, -.5);
  sun.target = target;
  sun.position.copy(target.position).addScaledVector(SUN.direction, -16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  const cam = sun.shadow.camera;
  cam.left = -7.2; cam.right = 7.2; cam.top = 7.2; cam.bottom = -7.2; cam.near = 4; cam.far = 34;
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  sun.shadow.radius = 3;
  scene.add(sun, target);
  ctx.lights.sun = sun;

  // ---------------------------------------------------------------- warm track spots
  const spotDefs = [
    { pos: [-2.0, 3.16, .9], at: [-1.9, .95, .1], intensity: 13, angle: .6 },
    { pos: [2.5, 3.16, -2.4], at: [2.5, 1.15, -3.7], intensity: 24, angle: .5 },
    { pos: [-2.4, 3.16, 3.9], at: [-3.0, 1.0, 4.2], intensity: 16, angle: .7 },
    { pos: [-.2, 3.16, .9], at: [-.3, .95, .1], intensity: 13, angle: .6 },
    { pos: [-.8, 3.16, -.7], at: [-.8, 1.25, -1.05], intensity: 13, angle: .55 },
    { pos: [-2.6, 3.16, -2.2], at: [-3.5, 1.6, -1.2], intensity: 16, angle: .55 },
    { pos: [.4, 3.16, 3.9], at: [1.0, 1.0, 4.4], intensity: 14, angle: .8 }
  ].slice(0, quality.spots + 3);
  const rails = [];
  spotDefs.forEach((def, i) => {
    const light = new THREE.SpotLight(0xffd29a, def.intensity, 11, def.angle, .75, 2);
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
  const rackSpot = new THREE.SpotLight(0xe3f6ff, 20, 9, .8, .8, 2);
  rackSpot.position.set(1.4, 3.15, 1.95);
  rackSpot.target.position.set(3.5, 1.5, 1.95);
  scene.add(rackSpot, rackSpot.target);
  rackSpot.userData.base = 20;
  rails.push(rackSpot);

  // counter lamp (practical) and a soft fill from the street side so the room never goes muddy
  const counterLamp = new THREE.PointLight(0xffc27a, 1.5, 4.5, 2);
  counterLamp.position.set(2.5, 1.9, -3.1);
  scene.add(counterLamp);
  ctx.lights.counter = counterLamp;
  const fill = new THREE.HemisphereLight(0xfff0dc, 0x5a4a38, .12);
  // warm daylight bounce near the storefront so the window side never goes black
  const bounce = new THREE.PointLight(0xffe2b0, 14, 8, 2);
  bounce.position.set(-1.2, 1.4, 3.9);
  scene.add(bounce);
  const bounce2 = bounce.clone(); bounce2.position.set(2.2, 1.4, 3.6); scene.add(bounce2);
  ctx.lights.bounce = [bounce, bounce2];
  scene.add(fill);
  ctx.lights.fill = fill;

  // ---------------------------------------------------------------- neon signs
  const neonMat = new THREE.MeshStandardMaterial({ map: neonTexture(), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0, roughness: .4, metalness: 0 });
  neonMat.emissiveMap = neonMat.map;
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), neonMat);
  neon.position.set(-.55, 2.5, ROOM.zBack + .045);
  scene.add(neon);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.74, .78, .04), m.blackMetal);
  board.position.set(-.55, 2.5, ROOM.zBack + .02);
  scene.add(board);
  const neonLight = new THREE.PointLight(0xff4f94, 0, 5, 2);
  neonLight.position.set(-.55, 2.4, ROOM.zBack + .5);
  scene.add(neonLight);
  const neonLight2 = new THREE.PointLight(0x2fe3c3, 0, 4, 2);
  neonLight2.position.set(.5, 2.2, ROOM.zBack + .6);
  scene.add(neonLight2);
  ctx.lights.neon = [neonLight, neonLight2];

  const openMat = new THREE.MeshStandardMaterial({ map: openNeonTexture(), emissive: 0xffffff, roughness: .4, side: THREE.DoubleSide, emissiveIntensity: 0 });
  openMat.emissiveMap = openMat.map;
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(.62, .31), openMat);
  openSign.position.set(2.55, 2.15, ROOM.zFront - .05);
  scene.add(openSign);
  const openLight = new THREE.PointLight(0xff5a44, 0, 3, 2);
  openLight.position.set(2.55, 2.1, ROOM.zFront - .5);
  scene.add(openLight);
  for (const x of [-.12, .12]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .45, 4), m.steel);
    chain.position.set(2.55 + x * 2, 2.15 + .38, ROOM.zFront - .05);
    scene.add(chain);
  }

  // ---------------------------------------------------------------- light shafts + dust
  const dir = SUN.direction.clone();
  const shaftTex = shaftTexture(96, 512, 7);
  const shaftGroup = new THREE.Group();
  const shaftMats = [];
  const openings = [FRONT.windowA, FRONT.windowB, { x0: FRONT.door.x0, x1: FRONT.door.x1 }];
  const rand = rng(5);
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
            uniforms: { map: { value: shaftTex }, uColor: { value: new THREE.Color(1, .9, .7) }, uIntensity: { value: .05 }, uTime: { value: 0 }, uSeed: { value: rand() } }
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
  const state = { level: 0, target: 0, neon: 0, neonTarget: 0, flicker: 0 };
  const apply = () => {
    const level = state.level;
    for (const s of rails) s.intensity = s.userData.base * level;
    ctx.lights.counter.intensity = 1.5 * level;
    if (ctx.lights.lamp) ctx.lights.lamp.intensity = 1.4 * level;
    if (ctx.lights.floorLamp) ctx.lights.floorLamp.intensity = 7 * level;
    m.tube.color.setRGB(.96, 1, .98).multiplyScalar(.25 + 3.4 * level);
    m.bulb.color.setRGB(1, .86, .62).multiplyScalar(.2 + 3.8 * level);
    const neonOn = state.neon;
    neonMat.emissiveIntensity = 3.2 * neonOn;
    neonLight.intensity = 3.2 * neonOn; neonLight2.intensity = 1.9 * neonOn;
    openMat.emissiveIntensity = 3.0 * neonOn; openLight.intensity = 2.2 * neonOn;
    for (const mat of ctx.neonMaterials || []) mat.emissiveIntensity = (mat.userData.neonBase ?? 1) * neonOn;
  };
  out.setShopLights = (on, instant = false) => { state.target = on ? 1 : 0; if (instant) { state.level = state.target; apply(); } };
  out.setNeon = (on, instant = false) => { state.neonTarget = on ? 1 : 0; if (instant) { state.neon = state.neonTarget; apply(); } };
  out.update = (dt, elapsed) => {
    state.level += (state.target - state.level) * (1 - Math.exp(-3 * dt));
    // neon: stuttering ignition then a faint breathing hum
    if (state.neonTarget > state.neon) state.flicker += dt;
    const ignite = state.neonTarget > .5 ? Math.min(1, state.flicker / 1.1) : 0;
    const stutter = ignite < 1 ? (Math.sin(elapsed * 61) > .2 || Math.sin(elapsed * 23) > .5 ? 1 : .08) : 1;
    state.neon = state.neonTarget > .5 ? ignite * stutter * (.96 + Math.sin(elapsed * 2.1) * .04) : state.neon * (1 - Math.min(1, dt * 8));
    if (state.neonTarget < .5) state.flicker = 0;
    apply();
    for (const mat of shaftMats) { mat.uniforms.uTime.value = elapsed; }
    if (dust) dust.material.uniforms.uTime.value = elapsed;
  };
  out.setShaftIntensity = (v) => { for (const mat of shaftMats) mat.uniforms.uIntensity.value = v; };
  out.dust = dust;
  out.shafts = shaftGroup;
  out.sun = sun;
  out.apply = apply;
  apply();
  return out;
}
