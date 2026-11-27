// Atmosphere & detail pass, art direction v2: architectural neon (coral / cyan / sun tubes that stay vivid in daylight), a
// neon vinyl on the ink corner, sticker accents, the entrance mat, slowly turning hanging records, palette pennants.
// v2 is CLEAN: the v1 wall grime, water stains and floor scuffs are gone (cleaner albedos, coloured shadows do the depth).
import * as THREE from "three";
import { mergeGeometries } from "three-addons";
import { ROOM, COUNTER } from "./layout.js";
import { createCanvas, textureFrom } from "./util.js";
import { FONT } from "./artwork.js";
import { PAL, NEON, fitPx, neonShared } from "./room.js";

const PI = Math.PI;

function neonLight(ctx, color, intensity, distance, position) {
  const l = new THREE.PointLight(color, 0, distance, 2);
  l.position.set(...position);
  l.userData.base = intensity;
  ctx.scene.add(l);
  ctx.neonLights.push(l);
  return l;
}

export function buildDetails(ctx) {
  const { scene, batcher: B, materials: m } = ctx;
  ctx.neonLights = ctx.neonLights || [];
  const H = ROOM.height;
  const zb = ROOM.zBack;
  const neon = (hex, base) => neonShared(ctx, hex, base);

  // ---------------------------------------------------------------- neon accents
  const coral = neon(NEON.coral, 3.2), cyan = neon(NEON.cyan, 3.4), sun = neon(NEON.sun, 2.8);
  const strip = (w, h, d, mat, pos) => B.add(new THREE.BoxGeometry(w, h, d), mat, pos, [0, 0, 0], { cast: false, receive: false });
  // cove strip under the ceiling line on the back wall (coral | cyan)
  strip(3.55, .035, .035, coral, [-1.8, H - .13, zb + .07]);
  strip(3.55, .035, .035, cyan, [1.8, H - .13, zb + .07]);
  neonLight(ctx, NEON.coral, 2.2, 5, [-2.0, H - .3, zb + .5]);
  neonLight(ctx, NEON.cyan, 2.0, 5, [2.0, H - .3, zb + .5]);
  // counter toe-kick glow
  strip(COUNTER.width - .2, .022, .022, cyan, [COUNTER.x, .072, COUNTER.z + COUNTER.depth / 2 + .026]);
  // neon vinyl on the ink corner (concentric rings: coral / cyan / sun)
  const ring = new THREE.Group();
  ring.position.set(-3.05, 2.86, zb + .05);
  for (const [r, mat] of [[.27, coral], [.19, cyan], [.11, sun]]) ring.add(new THREE.Mesh(new THREE.TorusGeometry(r, .01, 8, 56), mat));
  const back = new THREE.Mesh(new THREE.CircleGeometry(.3, 40), new THREE.MeshStandardMaterial({ color: 0x0b0d1d, roughness: .5 }));
  back.position.z = -.012; ring.add(back);
  scene.add(ring);

  // ---------------------------------------------------------------- stickers: a small bomb on the counter's aisle-side end and by the shelving
  const rr = [3, 7, 10, 13, 1];
  rr.forEach((idx, i) => ctx.sticker(idx, [COUNTER.x - COUNTER.width / 2 - .005, .36 + (i % 3) * .22, COUNTER.z + .2 - Math.floor(i / 3) * .3 - (i % 2) * .08], [0, -PI / 2, (i - 2) * .12], .14 + (i % 2) * .03));
  ctx.sticker(11, [ROOM.x1 - .005, 1.55, 4.3], [0, -PI / 2, -.08], .2);

  // ---------------------------------------------------------------- entrance mat + one big vinyl on the cream wall by the door
  if (ctx.quality.id !== "low") {
    const mc = createCanvas(512, 320);
    const mg = mc.getContext("2d");
    mg.fillStyle = PAL.ink; mg.fillRect(0, 0, 512, 320);
    mg.strokeStyle = "rgba(255,246,227,.08)"; mg.lineWidth = 2;
    for (let i = 0; i < 512; i += 8) { mg.beginPath(); mg.moveTo(i, 0); mg.lineTo(i, 320); mg.stroke(); }
    mg.strokeStyle = PAL.coral; mg.lineWidth = 10; mg.strokeRect(16, 16, 480, 288);
    mg.strokeStyle = PAL.sun; mg.lineWidth = 4; mg.strokeRect(34, 34, 444, 252);
    mg.fillStyle = PAL.paper; mg.textAlign = "center"; mg.textBaseline = "middle";
    fitPx(mg, "SIDE A", FONT.display, 900, 380, 96); mg.fillText("SIDE A", 256, 128);
    mg.font = `700 28px ${FONT.mono}`; mg.fillStyle = PAL.cyan; mg.fillText("PROJECTS STORE", 256, 214);
    const matTex = textureFrom(mc, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    ctx.owned.push(matMat, matTex);
    const doormat = new THREE.Mesh(new THREE.BoxGeometry(1.0, .012, .64), matMat);
    doormat.position.set(.7, .008, ROOM.zFront - .62); doormat.rotation.y = .04; doormat.receiveShadow = true;
    scene.add(doormat);
  }
  {
    const S = 512, c = createCanvas(S), g = c.getContext("2d"), R = S / 2;
    const disc = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(R, R, r * R, 0, PI * 2); g.fill(); };
    disc(1, PAL.ink); disc(.96, "#0b0d1d");
    g.strokeStyle = "rgba(255,246,227,.16)"; g.lineWidth = 1.6; for (let r = .4; r < .93; r += .03) { g.beginPath(); g.arc(R, R, r * R, 0, PI * 2); g.stroke(); }
    disc(.36, PAL.coral); disc(.32, PAL.sun); disc(.29, PAL.coral);
    g.fillStyle = PAL.paper; g.textAlign = "center"; g.textBaseline = "middle"; fitPx(g, "SIDE A", FONT.display, 900, S * .28, 60); g.fillText("SIDE A", R, R);
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(R, R, 7, 0, PI * 2); g.fill();
    const tex = textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: .02, roughness: .35, metalness: 0 });
    ctx.owned.push(mat, tex);
    const vinyl = new THREE.Mesh(new THREE.CircleGeometry(.6, 48), mat);
    vinyl.position.set(ROOM.x1 - .01, 2.5, 4.05); vinyl.rotation.y = -PI / 2; vinyl.receiveShadow = true;
    scene.add(vinyl);
  }

  // ---------------------------------------------------------------- belt runner in front of the counter (ink field, the coral / sun / cyan belt of the walls)
  {
    const c = createCanvas(1024, 400), g = c.getContext("2d");
    g.fillStyle = PAL.ink; g.fillRect(0, 0, 1024, 400);
    g.fillStyle = "rgba(255,246,227,.07)"; for (let x = 24; x < 1024; x += 34) for (let y = 24; y < 400; y += 34) { g.beginPath(); g.arc(x, y, 2.4, 0, PI * 2); g.fill(); }
    [[PAL.coral, 120], [PAL.sun, 168], [PAL.cyan, 216]].forEach(([col, y]) => { g.fillStyle = col; g.fillRect(40, y, 944, 36); });
    g.strokeStyle = PAL.paper; g.lineWidth = 8; g.strokeRect(14, 14, 996, 372);
    const tex = textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, normalMap: m.fabricBlack?.normalMap || null, normalScale: new THREE.Vector2(1, 1), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    ctx.owned.push(mat, tex);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.0, .78), mat);
    runner.rotation.x = -PI / 2; runner.position.set(COUNTER.x - .1, .007, COUNTER.z + COUNTER.depth / 2 + .62); runner.receiveShadow = true;
    scene.add(runner);
  }

  // ---------------------------------------------------------------- hanging records (slow turn)
  const discs = [];
  const labelColors = [PAL.coral, PAL.sun, PAL.cyan, PAL.violet, PAL.mint, PAL.paper, PAL.coral];
  // one shared label material per colour; both label faces are ONE merged mesh and the thread is part of the static batch
  // (the disc turns on its own axis, the cord from the ceiling stays put): 4 draws per disc -> 2
  const discLabelMats = new Map();
  const labelMatFor = (hex) => {
    if (!discLabelMats.has(hex)) { const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: .5 }); ctx.owned.push(mat); discLabelMats.set(hex, mat); }
    return discLabelMats.get(hex);
  };
  const labelGeo = (() => {
    const a = new THREE.CircleGeometry(.036, 24), b = new THREE.CircleGeometry(.036, 24);
    a.translate(0, 0, .0025); b.rotateY(PI); b.translate(0, 0, -.0025);
    return mergeGeometries([a, b]);
  })();
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const x = -2.6 + i * .68 + (i % 2) * .15, z = 1.1 + (i * 37 % 11) * .12, y = 2.25 + (i % 3) * .28;
    g.position.set(x, y, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .004, 40), m.vinyl);
    disc.rotation.x = PI / 2; disc.castShadow = true; g.add(disc);
    g.add(new THREE.Mesh(labelGeo, labelMatFor(labelColors[i % labelColors.length])));
    B.add(new THREE.CylinderGeometry(.0012, .0012, H - y, 4), m.steel, [x, y + (H - y) / 2 + .15, z], [0, 0, 0], { cast: false });
    g.rotation.y = i * .7;
    scene.add(g);
    discs.push({ g, speed: .15 + (i % 3) * .08, phase: i * 1.3, y });
  }
  ctx.updaters.push((dt, elapsed) => {
    for (const d of discs) { d.g.rotation.y += dt * d.speed; d.g.rotation.x = Math.sin(elapsed * .5 + d.phase) * .06; d.g.position.y = d.y + Math.sin(elapsed * .6 + d.phase) * .012; }
  });

  // ---------------------------------------------------------------- pennant bunting in the day palette
  const flagGeo = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-.075, 0); s.lineTo(.075, 0); s.lineTo(0, -.2); s.closePath(); return s; })());
  const flagColors = [PAL.coral, PAL.sun, PAL.cyan, PAL.violet, PAL.mint, PAL.paper];
  const flagMats = flagColors.map((c) => { const mat = new THREE.MeshStandardMaterial({ color: c, roughness: .75, side: THREE.DoubleSide }); ctx.owned.push(mat); return mat; });
  const line = (a, b, sag, count) => {
    const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(pa.clone().lerp(pb, t).add(new THREE.Vector3(0, -Math.sin(t * PI) * sag, 0))); }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .004, 4), m.fabricBlack);
    scene.add(cord);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count;
      const p = pa.clone().lerp(pb, t); p.y -= Math.sin(t * PI) * sag;
      const dir = pb.clone().sub(pa).normalize();
      B.add(flagGeo, flagMats[i % flagMats.length], [p.x, p.y, p.z], [0, Math.atan2(-dir.z, dir.x), 0], { cast: false });
    }
  };
  line([ROOM.x0 + .05, H - .22, 0.6], [-1.4, H - .22, 0.6], .22, 16);
  line([-1.4, H - .22, .6], [ROOM.x0 + .05, H - .22, -2.8], .2, 20);
  line([.8, H - .2, ROOM.zBack + .1], [ROOM.x1 - .05, H - .2, ROOM.zBack + .1], .25, 20);
}
