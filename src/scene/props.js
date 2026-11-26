// Props and themed corners, art direction v2: modern deck on the counter, POS tablet, hi-fi towers, lucky cat, CV folder +
// business cards, SOPP AGENTS rack (ink + mint/cyan), about corner (memo board, plaque, coral guitar), listening corner
// (lounge chair, memphis rug, globe lamp), clean glossy plants, small clutter.
// Every pick root (turntable, cat, cv, contact, app cases, about plaque, music records) keeps its id and coordinates.
import * as THREE from "three";
import { ROOM, COUNTER } from "./layout.js";
import { rng, createCanvas, textureFrom, woodBox, roundRectPath } from "./util.js";
import { SLEEVE, createRecord, getGrooveSet } from "./records.js";
import { atlasPlane, drawAppCase } from "./assets.js";
import { addSign, addContactShadow, addCardboardBox, localizedTexture } from "./kit.js";
import { FONT, drawSignBoard } from "./artwork.js";
import { makeNeonMaterial } from "./materials.js";
import { PAL, NEON, fitPx, pickMat } from "./room.js";

const PI = Math.PI;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function mesh(geometry, material, { position, rotation, scale, cast = true, receive = true, parent } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale) typeof scale === "number" ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}
const neonOf = (ctx, hex, base = 3) => { const mat = makeNeonMaterial(hex, base); ctx.neonMaterials.push(mat); ctx.owned.push(mat); return mat; };
const ledMat = (ctx, hex, k = 2.2) => { const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }); ctx.owned.push(mat); return mat; };
const lacquer = (ctx, hex, rough = .35) => { const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, clearcoat: .8, clearcoatRoughness: .16 }); ctx.owned.push(mat); return mat; };

// ---------------------------------------------------------------------------------------------
// Turntable on the counter (modern deck: ink body, cream plate, spinning record, tonearm resting on the groove)
// ---------------------------------------------------------------------------------------------
export function buildTurntable(ctx, position) {
  const m = ctx.materials;
  const group = new THREE.Group();
  group.position.set(...position);
  const ink = pickMat(m, "lacquerInk", "plasticBlack");
  mesh(woodBox(.46, .06, .37, { bevel: .02, tile: .5 }), ink, { position: [0, .03, 0], parent: group });
  mesh(woodBox(.44, .012, .35, { bevel: .005, tile: .5 }), pickMat(m, "lacquerPaper", "plasticBeige"), { position: [0, .066, 0], parent: group });
  mesh(woodBox(.46, .008, .03, { bevel: .003, tile: .5 }), pickMat(m, "lacquerCoral", "plasticCoral"), { position: [0, .058, .185], parent: group, cast: false });
  for (const [x, z] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) mesh(new THREE.CylinderGeometry(.018, .02, .02, 12), m.rubber, { position: [x, -.002, z], parent: group });
  const platter = new THREE.Group();
  platter.position.set(-.04, .074, .0);
  mesh(new THREE.CylinderGeometry(.158, .158, .014, 64), m.steel, { position: [0, .007, 0], parent: platter });
  // strobe dots ring on the platter rim (flat colour, reads as a tiny graphic detail)
  const ringCanvas = createCanvas(256, 256), rg = ringCanvas.getContext("2d");
  rg.fillStyle = "#2a2f57"; rg.beginPath(); rg.arc(128, 128, 128, 0, PI * 2); rg.fill();
  rg.fillStyle = PAL.coral; for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2; rg.beginPath(); rg.arc(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118, 3.2, 0, PI * 2); rg.fill(); }
  const ringMat = new THREE.MeshStandardMaterial({ map: textureFrom(ringCanvas, { srgb: true, repeat: false }), roughness: .5, metalness: .3 });
  ctx.owned.push(ringMat);
  mesh(new THREE.CircleGeometry(.158, 64), ringMat, { position: [0, .0145, 0], rotation: [-PI / 2, 0, 0], parent: platter, cast: false });
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b2145, roughness: .9 });
  mesh(new THREE.CylinderGeometry(.15, .15, .004, 64), mat, { position: [0, .016, 0], parent: platter });
  const grooves = getGrooveSet(ctx.quality);
  const discMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c18, roughness: 1, metalness: .2, clearcoat: .7, clearcoatRoughness: .1, normalMap: grooves.normal, roughnessMap: grooves.roughness, normalScale: new THREE.Vector2(.8, .8) });
  ctx.owned.push(discMat);
  mesh(new THREE.CircleGeometry(.1524, 96), discMat, { position: [0, .0192, 0], rotation: [-PI / 2, 0, 0], parent: platter, cast: false });
  const labelCanvas = createCanvas(128);
  const lg = labelCanvas.getContext("2d");
  lg.fillStyle = PAL.coral; lg.beginPath(); lg.arc(64, 64, 64, 0, PI * 2); lg.fill();
  lg.fillStyle = PAL.sun; lg.beginPath(); lg.arc(64, 64, 52, 0, PI * 2); lg.fill();
  lg.fillStyle = PAL.ink; lg.textAlign = "center"; lg.textBaseline = "middle"; fitPx(lg, "SIDE A", FONT.display, 900, 84, 26); lg.fillText("SIDE A", 64, 64);
  const label = mesh(new THREE.CircleGeometry(.05, 40), new THREE.MeshStandardMaterial({ map: textureFrom(labelCanvas, { srgb: true, repeat: false }), roughness: .7 }), { position: [0, .0196, 0], rotation: [-PI / 2, 0, 0], parent: platter, cast: false });
  void label;
  mesh(new THREE.CylinderGeometry(.003, .003, .02, 8), m.steel, { position: [0, .028, 0], parent: platter });
  group.add(platter);
  // tonearm
  const armPivot = new THREE.Group();
  armPivot.position.set(.17, .09, -.12);
  mesh(new THREE.CylinderGeometry(.022, .026, .035, 20), m.steel, { position: [0, -.01, 0], parent: armPivot });
  const arm = new THREE.Group();
  mesh(new THREE.CylinderGeometry(.0035, .0035, .27, 8), m.steel, { position: [0, 0, .135], rotation: [PI / 2, 0, 0], parent: arm });
  mesh(woodBox(.026, .008, .04, { bevel: .002, tile: .2 }), pickMat(m, "plasticCoral", "plasticBlack"), { position: [0, -.004, .285], parent: arm });
  mesh(new THREE.CylinderGeometry(.012, .012, .05, 12), pickMat(m, "plasticCoral", "steel"), { position: [0, 0, -.03], rotation: [PI / 2, 0, 0], parent: arm });
  arm.rotation.y = -.74;
  armPivot.add(arm);
  group.add(armPivot);
  // start/stop button, speed buttons and a mint LED
  mesh(new THREE.CylinderGeometry(.012, .012, .01, 12), pickMat(m, "plasticSun", "steel"), { position: [.18, .077, .14], parent: group });
  mesh(new THREE.BoxGeometry(.014, .004, .006), ledMat(ctx, NEON.mint, 2.4), { position: [.15, .074, .15], parent: group, cast: false });
  mesh(new THREE.BoxGeometry(.012, .005, .008), pickMat(m, "plasticCyan", "steel"), { position: [.19, .073, .09], parent: group, cast: false });
  // tiny VU meter on the deck (mint / mint / sun / coral LEDs): dances while the music plays
  const vu = [NEON.mint, NEON.mint, NEON.sun, NEON.sun, NEON.coral].map((hex, i) => mesh(new THREE.BoxGeometry(.012, .02, .006), ledMat(ctx, hex, 2.2), { position: [.19, .08, -.08 + i * .0155], parent: group, cast: false }));
  vu.forEach((bar) => { bar.geometry = bar.geometry.clone(); bar.geometry.translate(0, .01, 0); bar.position.y = .073; });
  ctx.pulse = ctx.pulse || [];
  let amp = 0;
  group.userData.pick = { kind: "turntable", id: "main" };
  group.userData.update = (dt, elapsed, state) => {
    if (state.playing) platter.rotation.y -= dt * 3.49;
    const target = state.playing ? -.74 : -.3;
    arm.rotation.y += (target - arm.rotation.y) * Math.min(1, dt * 3);
    // beat: ~118 BPM, smoothed in/out, disabled with reduced motion (the speakers' woofers thump, the VU bars dance)
    const want = state.playing && !reducedMotion() ? 1 : 0;
    const prev = amp;
    amp += (want - amp) * Math.min(1, dt * 6);
    if (amp > .002 || prev > .002) {
      const beat = Math.pow(Math.max(0, Math.sin(elapsed * 1.97 * PI * 2)), 5);
      for (const t of ctx.pulse) { const k = 1 + t.k * beat * amp; t.node.scale.set(k, k, 1); }
      vu.forEach((bar, i) => { bar.scale.y = .2 + amp * (.25 + .75 * Math.abs(Math.sin(elapsed * (4.2 + i * 1.3) + i * 1.9))); });
    } else vu.forEach((bar) => { bar.scale.y = .2; });
  };
  ctx.scene.add(group);
  ctx.pickRoots.push(group);
  return group;
}

// ---------------------------------------------------------------------------------------------
// POS tablet, card reader, bell, mug, shop bag, loose records
// ---------------------------------------------------------------------------------------------
function posScreen(ctx) {
  const W = 512, H = 360;
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = PAL.ink0; g.fillRect(0, 0, W, H);
  const hg = g.createLinearGradient(0, 0, W, H); hg.addColorStop(0, "rgba(25,213,232,.22)"); hg.addColorStop(1, "rgba(107,77,255,.22)");
  g.fillStyle = hg; g.fillRect(0, 0, W, H);
  g.fillStyle = PAL.mint; g.beginPath(); g.arc(34, 34, 9, 0, PI * 2); g.fill();
  g.fillStyle = PAL.paper; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `700 22px ${FONT.mono}`; g.fillText("SIDE A · POS", 56, 34);
  g.textAlign = "right"; g.fillStyle = PAL.sun; g.fillText("PLAYER 1", W - 28, 34);
  g.textAlign = "center"; fitPx(g, "READY", FONT.display, 900, 360, 110); g.fillStyle = PAL.paper; g.fillText("READY", W / 2, 150);
  g.fillStyle = PAL.coral; roundRectPath(g, 70, 232, 160, 62, 16); g.fill();
  g.fillStyle = PAL.cyan; roundRectPath(g, 282, 232, 160, 62, 16); g.fill();
  g.fillStyle = PAL.ink; g.font = `700 24px ${FONT.mono}`; g.fillText("NEW", 150, 264); g.fillText("PLAY", 362, 264);
  return textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
}

export function buildCounterClutter(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const y = COUNTER.height;
  const x0 = COUNTER.x, z0 = COUNTER.z;
  const ink = pickMat(m, "lacquerInk", "plasticBlack");
  // POS tablet on a stand (screen glows)
  const rx = x0 - .84, rz = z0 - .02;
  B.add(new THREE.CylinderGeometry(.11, .12, .02, 28), m.steel, [rx, y + .01, rz]);
  B.add(new THREE.CylinderGeometry(.018, .022, .2, 12), m.steel, [rx, y + .12, rz]);
  const tablet = new THREE.Group();
  tablet.position.set(rx, y + .28, rz + .02); tablet.rotation.x = -.22;
  mesh(woodBox(.3, .21, .016, { bevel: .01, tile: .4 }), ink, { parent: tablet });
  const screenMat = new THREE.MeshBasicMaterial({ map: posScreen(ctx), color: new THREE.Color(1.05, 1.05, 1.05) });
  ctx.owned.push(screenMat);
  mesh(new THREE.PlaneGeometry(.275, .183), screenMat, { position: [0, 0, .0085], parent: tablet, cast: false });
  ctx.scene.add(tablet);
  // card reader (cream body, coral button) and a receipt printer
  B.box(.075, .02, .11, pickMat(m, "plasticBeige", "paintedCream"), [rx + .27, y + .012, rz + .1], [0, -.3, 0], { bevel: .006 });
  B.add(new THREE.CylinderGeometry(.012, .012, .006, 12), pickMat(m, "plasticCoral", "paintedCoral"), [rx + .27, y + .025, rz + .1], [0, 0, 0], { cast: false });
  B.box(.14, .1, .12, pickMat(m, "plasticBeige", "paintedCream"), [rx - .26, y + .05, rz], [0, .2, 0], { bevel: .012 });
  B.box(.1, .004, .05, m.paper, [rx - .26, y + .102, rz - .01], [.35, .2, 0], { bevel: .001, cast: false });
  // pen cup + call bell (sun) + mug (coral)
  const cup = new THREE.CylinderGeometry(.035, .03, .08, 16);
  B.add(cup, pickMat(m, "paintedInk", "paintedGreen"), [x0 - .62, y + .04, z0 - .22]);
  const penColors = [m.plasticCoral, m.plasticCyan, m.plasticSun, m.plasticBlack];
  for (let i = 0; i < 4; i++) B.add(new THREE.CylinderGeometry(.003, .003, .13, 5), penColors[i] || m.plasticBlack, [x0 - .62 + (i - 1.5) * .01, y + .11, z0 - .22], [(i - 1.5) * .12, 0, (i % 2 - .5) * .2], { cast: false });
  B.add(new THREE.CylinderGeometry(.045, .05, .018, 20), pickMat(m, "plasticSun", "brass"), [x0 - .05, y + .009, z0 + .22]);
  B.add(new THREE.SphereGeometry(.03, 16, 8, 0, PI * 2, 0, PI / 2), pickMat(m, "plasticSun", "brass"), [x0 - .05, y + .018, z0 + .22]);
  B.add(new THREE.CylinderGeometry(.04, .035, .09, 18), pickMat(m, "plasticCoral", "paintedCoral"), [x0 - .12, y + .045, z0 - .24]);
  // paper shop bag (logo printed on the front, sun-yellow paper)
  const bagTexture = textureFrom(drawSignBoard("SIDE A", { width: 512, height: 512, bg: PAL.sun, fg: PAL.ink, border: PAL.ink, sub: "RECORDS" }), { srgb: true, repeat: false });
  const bagMat = new THREE.MeshStandardMaterial({ map: bagTexture, roughness: .85 });
  const bagSide = new THREE.MeshStandardMaterial({ color: 0xf5b92f, roughness: .85 });
  ctx.owned.push(bagMat, bagSide, bagTexture);
  mesh(new THREE.BoxGeometry(.24, .3, .12), [bagSide, bagSide, bagSide, bagSide, bagMat, bagSide], { position: [x0 + .7, y + .15 + .03, z0 - .2], rotation: [0, -.3, 0] });
  // ink mat under the turntable
  B.add(new THREE.BoxGeometry(.6, .006, .5), m.fabricBlack, [x0 + .28, y + .003, z0 - .02]);
  // a few loose records leaning on the counter
  const rand = rng(23);
  for (let i = 0; i < 4; i++) {
    const ref = ctx.assets.decor.cells[(i * 5 + 2) % ctx.assets.decor.cells.length];
    ctx.batchDecor(atlasPlane(SLEEVE.size, SLEEVE.size, ref), [x0 - 1.15 + i * .02, y + .17 + .0, z0 + .24 - i * .012], [-.22, 0, (rand() - .5) * .03]);
  }
}

// Hi-fi: one tower beside the counter, two shelf speakers on top of the staff-picks wall behind it (their woofers thump with the music)
export function buildSpeakers(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const coral = pickMat(m, "plasticCoral", "paintedCoral");
  ctx.pulse = ctx.pulse || [];
  const mk = (x, y0, z, rotY, w, h, d, big) => {
    const cy = y0 + h / 2;
    B.box(w, h, d, ink, [x, cy, z], [0, rotY, 0], { bevel: .02, tile: 1 });
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const front = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
    B.box(w - .03, h - .04, .01, m.fabricBlack, front(0, cy, d / 2 + .003), [0, rotY, 0], { bevel: .002, cast: false });
    const woofer = big ? .11 : .08;
    const wy = big ? y0 + h * .3 : cy - h * .1, ty = big ? y0 + h * .72 : cy + h * .26;
    for (const [py, r, k] of [[wy, woofer, .05], [ty, woofer * .55, .03]]) {
      const driver = new THREE.Group();
      driver.position.set(...front(0, py, d / 2 + .012)); driver.rotation.y = rotY;
      mesh(new THREE.TorusGeometry(r, r * .12, 8, 28), coral, { parent: driver, cast: false });
      mesh(new THREE.CircleGeometry(r, 28), m.rubber, { position: [0, 0, -.003], parent: driver, cast: false });
      mesh(new THREE.CircleGeometry(r * .3, 20), m.steel, { position: [0, 0, -.001], parent: driver, cast: false });
      ctx.scene.add(driver);
      ctx.pulse.push({ node: driver, k });
    }
    B.add(new THREE.CylinderGeometry(.008, .008, .006, 10), ledMat(ctx, NEON.mint, 2.4), front(w / 2 - .04, y0 + .05, d / 2 + .01), [PI / 2, rotY, 0], { cast: false });
    if (big) addContactShadow(ctx, { x, z, width: .8, depth: .8, opacity: .5 });
  };
  mk(COUNTER.x - COUNTER.width / 2 - .4, .06, COUNTER.z - .35, .22, .34, 1.05, .3, true);
  B.box(.3, .06, .26, m.blackMetal, [COUNTER.x - COUNTER.width / 2 - .4, .03, COUNTER.z - .35], [0, .22, 0], { bevel: .006 });
  // shelf speakers on top of the staff-picks wall
  mk(1.68, 2.0, ROOM.zBack + .26, 0, .3, .42, .26, false);
  mk(3.38, 2.0, ROOM.zBack + .26, 0, .3, .42, .26, false);
}

// ---------------------------------------------------------------------------------------------
// Lucky cat easter egg on the counter
// ---------------------------------------------------------------------------------------------
export function buildLuckyCat(ctx) {
  const root = new THREE.Group();
  root.position.set(COUNTER.x + 1.0, COUNTER.height + .05, COUNTER.z - .04);
  root.userData.pick = { kind: "secret", id: "cat" };
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xfff6e3, roughness: .2, clearcoat: 1, clearcoatRoughness: .06, name: "ceramic" });
  const gold = pickMat(ctx.materials, "lacquerSun", "brass");
  ctx.owned.push(ceramic);
  const profile = [[0, 0], [.07, .0], [.09, .04], [.095, .09], [.085, .14], [.065, .17], [.0, .175]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(profile, 24), ceramic, { parent: root });
  mesh(new THREE.SphereGeometry(.07, 24, 18), ceramic, { position: [0, .235, .01], scale: [1.12, .96, .95], parent: root });
  const cheek = new THREE.MeshStandardMaterial({ color: 0xff8d82, roughness: .5 });
  ctx.owned.push(cheek);
  for (const side of [-1, 1]) {
    mesh(new THREE.ConeGeometry(.026, .05, 4), pickMat(ctx.materials, "lacquerCoral", "plasticCoral"), { position: [side * .05, .295, .005], rotation: [0, 0, -side * .22], parent: root });
    mesh(new THREE.SphereGeometry(.0065, 8, 6), ctx.materials.eyeDark, { position: [side * .028, .245, .069], parent: root, cast: false });
    mesh(new THREE.SphereGeometry(.014, 8, 6), cheek, { position: [side * .052, .21, .058], scale: [1, .7, .4], parent: root, cast: false });
  }
  mesh(new THREE.SphereGeometry(.009, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8483c, roughness: .4 }), { position: [0, .222, .072], parent: root, cast: false });
  mesh(new THREE.TorusGeometry(.062, .009, 8, 28), pickMat(ctx.materials, "lacquerCoral", "plasticCoral"), { position: [0, .168, .01], rotation: [PI / 2 - .12, 0, 0], parent: root });
  mesh(new THREE.CylinderGeometry(.018, .018, .004, 16), gold, { position: [0, .13, .08], rotation: [PI / 2, 0, 0], parent: root });
  const paw = new THREE.Group();
  paw.position.set(.07, .18, .03);
  mesh(new THREE.CapsuleGeometry(.018, .06, 6, 10), ceramic, { position: [.01, .035, 0], rotation: [0, 0, -.3], parent: paw });
  root.add(paw);
  mesh(new THREE.CapsuleGeometry(.018, .05, 6, 10), ceramic, { position: [-.075, .075, .03], rotation: [0, 0, .25], parent: root });
  root.userData.update = (dt, elapsed) => { paw.rotation.z = -.35 + Math.sin(elapsed * 2.4) * .3; };
  ctx.scene.add(root);
  ctx.pickRoots.push(root);
  return root;
}

// ---------------------------------------------------------------------------------------------
// CV folder + business cards (physical, clickable)
// ---------------------------------------------------------------------------------------------
export function buildDocuments(ctx, profile) {
  const m = ctx.materials;
  const y = COUNTER.height + .006;
  // CV folder: sun-yellow board, ink label, big "CV" in the wide display face
  const folder = new THREE.Group();
  folder.position.set(COUNTER.x - .38, y, COUNTER.z + .1);
  folder.rotation.y = .32;
  const tab = (lang) => {
    const c = createCanvas(512, 700);
    const g = c.getContext("2d");
    g.fillStyle = PAL.sun; g.fillRect(0, 0, 512, 700);
    [[PAL.coral, 0], [PAL.paper, 1], [PAL.cyan, 2]].forEach(([col, i]) => { g.fillStyle = col; g.fillRect(0, 36 + i * 14, 512, 10); });
    g.fillStyle = PAL.ink; roundRectPath(g, 52, 120, 408, 250, 22); g.fill();
    g.fillStyle = PAL.paper; g.textAlign = "center"; g.textBaseline = "middle";
    fitPx(g, "CV", FONT.display, 900, 300, 190); g.fillText("CV", 256, 232);
    g.fillStyle = PAL.sun; g.font = `700 26px ${FONT.mono}`; g.fillText("CURRICULUM VITAE", 256, 338);
    g.fillStyle = PAL.ink; g.textBaseline = "alphabetic";
    g.font = `700 30px ${FONT.mono}`; g.fillText(lang === "fr" ? "À EMPORTER" : "TAKE ONE", 256, 440);
    g.font = `700 24px ${FONT.mono}`; g.fillText("ADAM SOPPELSA", 256, 488);
    g.font = `500 24px ${FONT.ui}`;
    g.fillText(profile.cv.url ? "PDF ↓" : (lang === "fr" ? "(version à jour bientôt)" : "(updated version soon)"), 256, 560);
    g.fillStyle = PAL.coral; g.fillRect(52, 604, 408, 12);
    return c;
  };
  const tabTexture = localizedTexture(ctx, tab);
  const covMat = new THREE.MeshStandardMaterial({ map: tabTexture, roughness: .6, normalMap: ctx.paperNormal, normalScale: new THREE.Vector2(.3, .3) });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe8a826, roughness: .7 });
  ctx.owned.push(covMat, edgeMat);
  mesh(new THREE.BoxGeometry(.24, .008, .32), [edgeMat, edgeMat, covMat, edgeMat, edgeMat, edgeMat], { position: [0, .004, 0], parent: folder });
  mesh(woodBox(.225, .012, .3, { bevel: .001 }), m.paper, { position: [0, .012, .0], parent: folder });
  mesh(new THREE.BoxGeometry(.24, .004, .32), [edgeMat, edgeMat, covMat, edgeMat, edgeMat, edgeMat], { position: [0, .022, 0], parent: folder });
  folder.userData.pick = { kind: "cv", id: "cv" };
  folder.userData.hoverLift = true;
  ctx.scene.add(folder);
  ctx.pickRoots.push(folder);

  // business cards in an acrylic stand
  const cards = new THREE.Group();
  cards.position.set(COUNTER.x + .78, y, COUNTER.z + .2);
  cards.rotation.y = -.35;
  const cardTexture = localizedTexture(ctx, (lang) => {
    const c = createCanvas(512, 292);
    const g = c.getContext("2d");
    g.fillStyle = PAL.paper; g.fillRect(0, 0, 512, 292);
    g.fillStyle = PAL.ink; g.fillRect(0, 0, 512, 22);
    [PAL.coral, PAL.sun, PAL.cyan].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 171, 270, 172, 22); });
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = PAL.ink; fitPx(g, "ADAM SOPPELSA", FONT.display, 900, 450, 56); g.fillText("ADAM SOPPELSA", 30, 106);
    g.fillStyle = PAL.coral; fitPx(g, "PROJECTS STORE · SIDE A RECORDS", FONT.mono, 700, 450, 22); g.fillText("PROJECTS STORE · SIDE A RECORDS", 32, 142);
    g.fillStyle = PAL.ink; g.font = `500 21px ${FONT.ui}`;
    g.fillText(lang === "fr" ? "Master 2 · communication · web · musique · data" : "Master’s 2 · communication · web · music · data", 32, 192);
    g.font = `700 20px ${FONT.mono}`;
    g.fillText(lang === "fr" ? "→ CLIQUE POUR VOIR LES CONTACTS" : "→ CLICK TO SEE CONTACT DETAILS", 32, 238);
    return c;
  });
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTexture, roughness: .7 });
  ctx.owned.push(cardMat);
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .25, clearcoat: 1 });
  ctx.owned.push(acrylic);
  mesh(new THREE.BoxGeometry(.1, .06, .028), acrylic, { position: [0, .03, 0], parent: cards, cast: false });
  for (let i = 0; i < 7; i++) mesh(new THREE.PlaneGeometry(.09, .051), cardMat, { position: [0, .045, .003 - i * .003], rotation: [-.12, 0, 0], parent: cards, cast: false });
  mesh(new THREE.BoxGeometry(.09, .004, .02), pickMat(m, "plasticCoral", "paper"), { position: [0, .002, 0], parent: cards });
  // single card lying flat, larger and readable when hovered (click target)
  mesh(new THREE.PlaneGeometry(.17, .097), cardMat, { position: [.0, .005, .09], rotation: [-PI / 2, 0, .2], parent: cards, cast: false });
  cards.userData.pick = { kind: "contact", id: "contact" };
  cards.userData.hoverLift = true;
  ctx.scene.add(cards);
  ctx.pickRoots.push(cards);
  return { folder, cards };
}

// ---------------------------------------------------------------------------------------------
// SOPP AGENTS rack (applications) on the right wall: violet unit, cream ledges, mint + cyan light lines, an arcade cabinet in the corner
// ---------------------------------------------------------------------------------------------
export function buildAppsRack(ctx, applications) {
  const m = ctx.materials, B = ctx.batcher;
  const x = ROOM.x1 - .08, zc = 1.95;
  const out = { cards: [] };
  const cols = 4, rows = Math.ceil(applications.length / cols);
  const pitch = .62, rowGap = .9, w = pitch * cols + .14;
  const baseY = .98;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const cream = pickMat(m, "lacquerPaper", "paintedCream");
  const neonMint = neonOf(ctx, NEON.mint, 3), neonCyan = neonOf(ctx, NEON.cyan, 3.2);
  const caseInk = m.blackMetal;
  // unit: ink back board, cream ledges, ink side cheeks, vertical light lines
  B.box(.05, 2.45, w, ink, [x + .02, 1.7, zc], [0, 0, 0], { bevel: .006 });
  B.add(new THREE.BoxGeometry(.04, 2.45, w - .06), pickMat(m, "lacquerViolet", "paintedViolet"), [x - .005, 1.7, zc]);
  for (let r = 0; r <= rows; r++) B.box(.26, .04, w, cream, [x - .12, baseY + r * rowGap, zc], [0, 0, 0], { bevel: .006, grain: "z" });
  for (let r = 0; r <= rows; r++) B.add(new THREE.BoxGeometry(.012, .012, w - .1), r % 2 ? neonMint : neonCyan, [x - .25, baseY + r * rowGap - .028, zc], [0, 0, 0], { cast: false, receive: false });
  for (const sz of [-w / 2 + .02, w / 2 - .02]) B.box(.26, 2.45, .04, ink, [x - .12, 1.7, zc + sz], [0, 0, 0], { bevel: .006, grain: "y" });
  for (const sz of [-w / 2 + .045, w / 2 - .045]) B.add(new THREE.BoxGeometry(.012, 2.3, .012), neonCyan, [x - .252, 1.7, zc + sz], [0, 0, 0], { cast: false, receive: false });
  // storage cabinet under the rack: ink doors with mint pulls
  B.box(.34, .9, w - .04, ink, [x - .13, .45, zc], [0, 0, 0], { bevel: .008 });
  const doors = 4, doorW = (w - .14) / doors;
  for (let i = 0; i < doors; i++) {
    const dz = zc - w / 2 + .07 + doorW * (i + .5);
    B.box(.012, .74, doorW - .035, pickMat(m, "lacquerInk", "paintedInk"), [x - .303, .45, dz], [0, 0, 0], { bevel: .004 });
    B.box(.014, .1, .012, pickMat(m, "plasticMint", "brass"), [x - .318, .55, dz + (i % 2 ? -1 : 1) * (doorW / 2 - .06)], [0, 0, 0], { bevel: .003 });
  }
  B.box(.36, .035, w - .02, cream, [x - .13, .915, zc], [0, 0, 0], { bevel: .006, grain: "z" });
  // header: neon-style board
  addSign(ctx, {
    draw: (lang) => {
      const c = createCanvas(1536, 256);
      const g = c.getContext("2d");
      g.fillStyle = PAL.ink0; g.fillRect(0, 0, 1536, 256);
      g.strokeStyle = "#5fe4f2"; g.lineWidth = 5; roundRectPath(g, 14, 14, 1508, 228, 26); g.stroke();
      g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#19d5e8"; g.shadowBlur = 26; g.fillStyle = "#e6fcff";
      fitPx(g, "SOPP AGENTS", FONT.display, 900, 1240, 150); g.fillText("SOPP AGENTS", 768, 98);
      g.shadowBlur = 8; g.fillStyle = "#7ff0c4";
      fitPx(g, lang === "fr" ? "APPLICATIONS WEB · RAYON INDÉPENDANT" : "WEB APPLICATIONS · INDEPENDENT RACK", FONT.mono, 700, 1240, 40);
      g.fillText(lang === "fr" ? "APPLICATIONS WEB · RAYON INDÉPENDANT" : "WEB APPLICATIONS · INDEPENDENT RACK", 768, 205);
      return c;
    },
    width: 2.1, height: .35, position: [x - .26, 3.02, zc], rotationY: -PI / 2, emissive: .9
  });
  // cases
  applications.forEach((app, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const group = new THREE.Group();
    const px = x - .15, py = baseY + row * rowGap + .02 + .235, pz = zc - (cols - 1) * pitch / 2 + col * pitch;
    group.position.set(px, py, pz);
    group.rotation.set(-.08, -PI / 2, 0, "YXZ");
    const artSize = ctx.quality.id === "low" ? 256 : 512;
    const art = textureFrom(drawAppCase(app, i, ctx.lang, artSize), { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    ctx.localized.push({ texture: art, draw: (lang) => drawAppCase(app, i, lang, artSize) });
    const face = new THREE.MeshStandardMaterial({ map: art, roughness: .5, envMapIntensity: .6, emissive: 0xffffff, emissiveMap: art, emissiveIntensity: .3 });
    ctx.owned.push(face);
    mesh(new THREE.BoxGeometry(.38, .47, .055), [caseInk, caseInk, caseInk, caseInk, face, caseInk], { parent: group });
    group.userData.pick = { kind: "app", id: app.id };
    group.userData.home = { position: group.position.clone(), quaternion: group.quaternion.clone(), scale: group.scale.clone() };
    group.userData.appIndex = i;
    ctx.scene.add(group);
    ctx.pickRoots.push(group);
    out.cards.push(group);
  });
  addContactShadow(ctx, { x: x - .2, z: zc, width: .6, depth: w + .5, opacity: .5 });
  // arcade cabinet in the corner (the app "level select"): ink body, coral / sun / cyan side art, a marquee and a screen listing the apps
  {
    const cab = new THREE.Group();
    cab.position.set(x - .42, 0, zc + w / 2 + .62);
    cab.rotation.y = -PI / 2 - .2;
    const wd = .62, ink0 = pickMat(m, "lacquerInk", "plasticBlack");
    const profile = new THREE.Shape();
    [[-.4, 0], [.4, 0], [.4, .76], [.5, .9], [.5, .99], [.3, 1.05], [.22, 1.5], [.3, 1.5], [.3, 1.78], [-.4, 1.78]].forEach(([px, py], i) => (i ? profile.lineTo(px, py) : profile.moveTo(px, py)));
    profile.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: wd - .03, bevelEnabled: true, bevelSize: .014, bevelOffset: -.014, bevelThickness: .014, bevelSegments: 3, curveSegments: 4 });
    bodyGeo.translate(0, 0, -(wd - .03) / 2);
    bodyGeo.rotateY(-PI / 2);
    mesh(bodyGeo, ink0, { parent: cab });
    // side art (profile-shaped decal, both sides): diagonal coral / sun / cyan bands + a vinyl glyph
    const artCanvas = createCanvas(512, 1024), ag = artCanvas.getContext("2d");
    ag.fillStyle = PAL.ink; ag.fillRect(0, 0, 512, 1024);
    ag.save(); ag.translate(256, 512); ag.rotate(-.5);
    [[PAL.coral, -330], [PAL.sun, -240], [PAL.cyan, -150]].forEach(([col, off]) => { ag.fillStyle = col; ag.fillRect(-700, off, 1400, 70); });
    ag.restore();
    ag.fillStyle = "#0b0d1d"; ag.beginPath(); ag.arc(256, 740, 150, 0, PI * 2); ag.fill();
    ag.strokeStyle = "rgba(255,246,227,.2)"; ag.lineWidth = 2; for (let r = 60; r < 145; r += 12) { ag.beginPath(); ag.arc(256, 740, r, 0, PI * 2); ag.stroke(); }
    ag.fillStyle = PAL.coral; ag.beginPath(); ag.arc(256, 740, 48, 0, PI * 2); ag.fill();
    ag.fillStyle = PAL.paper; ag.beginPath(); ag.arc(256, 740, 8, 0, PI * 2); ag.fill();
    const sideTex = textureFrom(artCanvas, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: .4, metalness: 0 });
    ctx.owned.push(sideMat, sideTex);
    const sideGeo = new THREE.ShapeGeometry(profile);
    { const pos = sideGeo.attributes.position, uv = sideGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + .4) / .9, pos.getY(i) / 1.78); }
    sideGeo.rotateY(-PI / 2);
    const sideL = mesh(sideGeo, sideMat, { position: [-wd / 2 - .001, 0, 0], parent: cab, cast: false });
    const sideR = mesh(sideGeo, sideMat, { position: [wd / 2 + .001, 0, 0], parent: cab, cast: false });
    sideR.scale.x = -1;
    void sideL;
    // marquee (self-lit, pulses gently)
    const mqCanvas = createCanvas(512, 190), mg = mqCanvas.getContext("2d");
    mg.fillStyle = PAL.ink0; mg.fillRect(0, 0, 512, 190);
    mg.strokeStyle = "#5fe4f2"; mg.lineWidth = 6; roundRectPath(mg, 8, 8, 496, 174, 18); mg.stroke();
    mg.textAlign = "center"; mg.textBaseline = "middle"; mg.shadowColor = "#19d5e8"; mg.shadowBlur = 18; mg.fillStyle = "#e6fcff";
    fitPx(mg, "SOPP", FONT.display, 900, 400, 78); mg.fillText("SOPP", 256, 70);
    mg.shadowColor = "#3ee6a8"; mg.fillStyle = "#7ff0c4"; fitPx(mg, "AGENTS", FONT.display, 900, 400, 62); mg.fillText("AGENTS", 256, 138);
    const mqTex = textureFrom(mqCanvas, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const mqMat = new THREE.MeshStandardMaterial({ map: mqTex, emissive: 0xffffff, emissiveMap: mqTex, emissiveIntensity: .9, roughness: .5 });
    ctx.owned.push(mqMat, mqTex);
    mesh(new THREE.PlaneGeometry(.58, .215), mqMat, { position: [0, 1.64, .3 + .004], parent: cab, cast: false });
    const calm = reducedMotion();
    ctx.updaters.push((dt, elapsed) => { mqMat.emissiveIntensity = calm ? .9 : .85 + Math.sin(elapsed * 1.7) * .12; });
    // screen: level-select list of the apps
    const scCanvas = createCanvas(320, 256), sg = scCanvas.getContext("2d");
    sg.fillStyle = "#07122a"; sg.fillRect(0, 0, 320, 256);
    sg.fillStyle = PAL.mint; sg.font = `700 17px ${FONT.mono}`; sg.textAlign = "left"; sg.textBaseline = "middle";
    sg.fillText("SELECT AGENT", 18, 24);
    sg.fillStyle = PAL.cyan; sg.fillRect(18, 38, 284, 3);
    applications.slice(0, 8).forEach((app, i) => {
      const yy = 64 + i * 22;
      if (i === 1) { sg.fillStyle = "rgba(62,230,168,.22)"; sg.fillRect(12, yy - 11, 296, 22); }
      sg.fillStyle = i === 1 ? PAL.mint : PAL.paper; sg.font = `700 14px ${FONT.mono}`;
      const label = String(app.name).toUpperCase(); sg.fillText((i === 1 ? "> " : "  ") + (label.length > 24 ? label.slice(0, 23) + "…" : label), 18, yy);
    });
    sg.fillStyle = PAL.sun; sg.font = `700 14px ${FONT.mono}`; sg.textAlign = "center"; sg.fillText("PRESS START", 160, 240);
    sg.fillStyle = "rgba(0,0,0,.28)"; for (let yy = 0; yy < 256; yy += 3) sg.fillRect(0, yy, 320, 1);
    const scTex = textureFrom(scCanvas, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const scMat = new THREE.MeshBasicMaterial({ map: scTex, color: new THREE.Color(1.1, 1.1, 1.1) });
    ctx.owned.push(scMat, scTex);
    mesh(new THREE.PlaneGeometry(.5, .4), scMat, { position: [0, 1.28, .26 + .004], rotation: [-.17, 0, 0], parent: cab, cast: false });
    // control panel: stick + buttons
    const panel = new THREE.Group();
    panel.position.set(0, 1.02, .4); panel.rotation.x = .29;
    mesh(new THREE.CylinderGeometry(.03, .035, .02, 16), pickMat(m, "plasticBlack", "steel"), { position: [-.15, .012, 0], parent: panel, cast: false });
    mesh(new THREE.CylinderGeometry(.007, .007, .09, 8), m.steel, { position: [-.15, .06, 0], parent: panel, cast: false });
    mesh(new THREE.SphereGeometry(.026, 16, 12), pickMat(m, "plasticCoral", "paintedCoral"), { position: [-.15, .11, 0], parent: panel, cast: false });
    [[.0, "plasticSun"], [.07, "plasticCyan"], [.14, "plasticMint"], [.21, "plasticCoral"]].forEach(([bx, key], i) => mesh(new THREE.CylinderGeometry(.021, .023, .018, 16), pickMat(m, key, "steel"), { position: [bx, .01, i % 2 ? .03 : -.02], parent: panel, cast: false }));
    mesh(new THREE.CylinderGeometry(.012, .012, .012, 12), pickMat(m, "plasticBeige", "steel"), { position: [.1, .008, .075], parent: panel, cast: false });
    cab.add(panel);
    // coin door with two lit slots
    mesh(woodBox(.22, .16, .012, { bevel: .004, tile: .3 }), m.blackMetal, { position: [0, .42, .4 + .004], parent: cab, cast: false });
    for (const sx of [-.05, .05]) mesh(new THREE.BoxGeometry(.03, .05, .004), ledMat(ctx, sx < 0 ? NEON.coral : NEON.sun, 2.4), { position: [sx, .42, .4 + .012], parent: cab, cast: false });
    // cyan light lines up the front edges of the marquee box
    for (const sx of [-wd / 2 + .02, wd / 2 - .02]) mesh(new THREE.BoxGeometry(.012, .26, .012), neonOf(ctx, NEON.cyan, 3.2), { position: [sx, 1.64, .31], parent: cab, cast: false });
    ctx.scene.add(cab);
    addContactShadow(ctx, { x: x - .42, z: zc + w / 2 + .62, width: 1.1, depth: 1.2, opacity: .4 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// About corner: memo board, plaque, own records, coral guitar, mini keyboard
// ---------------------------------------------------------------------------------------------
function guitar(ctx) {
  const m = ctx.materials;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -.22);
  shape.bezierCurveTo(.19, -.22, .21, -.04, .12, .02);
  shape.bezierCurveTo(.1, .04, .1, .07, .12, .09);
  shape.bezierCurveTo(.17, .14, .15, .26, 0, .26);
  shape.bezierCurveTo(-.15, .26, -.17, .14, -.12, .09);
  shape.bezierCurveTo(-.1, .07, -.1, .04, -.12, .02);
  shape.bezierCurveTo(-.21, -.04, -.19, -.22, 0, -.22);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: .085, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 2, curveSegments: 24 });
  bodyGeo.translate(0, 0, -.045);
  const body = lacquer(ctx, 0xf0584a, .28);
  const inkMat = pickMat(m, "lacquerInk", "plasticBlack");
  mesh(bodyGeo, body, { parent: g });
  mesh(new THREE.CircleGeometry(.04, 28), inkMat, { position: [0, .035, .0415], parent: g, cast: false });
  mesh(new THREE.TorusGeometry(.043, .004, 6, 28), pickMat(m, "lacquerPaper", "paintedCream"), { position: [0, .035, .0415], parent: g, cast: false });
  mesh(woodBox(.1, .012, .012, { bevel: .003 }), pickMat(m, "lacquerPaper", "paintedCream"), { position: [0, -.1, .045], parent: g, cast: false });
  mesh(woodBox(.045, .62, .022, { bevel: .004, tile: .5 }), inkMat, { position: [0, .55, .012], parent: g });
  mesh(woodBox(.06, .17, .02, { bevel: .006, tile: .5 }), pickMat(m, "lacquerSun", "oak"), { position: [0, .93, .0], parent: g });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.006, .006, .02, 8), m.steel, { position: [s * .032, .88 + i * .045, -.01], rotation: [PI / 2, 0, 0], parent: g, cast: false });
  for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(.0006, .0006, 1.08, 3), m.steel, { position: [-.0125 + i * .005, .32, .047], parent: g, cast: false });
  return g;
}

function miniKeyboard(ctx) {
  const m = ctx.materials;
  const g = new THREE.Group();
  mesh(woodBox(.52, .035, .16, { bevel: .012, tile: .5 }), pickMat(m, "lacquerInk", "plasticBlack"), { position: [0, .0175, 0], parent: g });
  mesh(new THREE.BoxGeometry(.46, .004, .012), ledMat(ctx, NEON.cyan, 2.2), { position: [0, .037, -.07], parent: g, cast: false });
  const white = new THREE.MeshStandardMaterial({ color: 0xfff6e3, roughness: .45 });
  ctx.owned.push(white);
  const keyGeo = new THREE.BoxGeometry(.0185, .012, .105);
  const blackGeo = new THREE.BoxGeometry(.011, .012, .064);
  for (let i = 0; i < 25; i++) mesh(keyGeo, white, { position: [-.222 + i * .0185, .041, .015], parent: g, cast: false });
  const pattern = [0, 1, 3, 4, 5];
  for (let i = 0; i < 24; i++) if (pattern.includes(i % 7)) mesh(blackGeo, pickMat(m, "lacquerInk", "plasticBlack"), { position: [-.2125 + i * .0185, .049, -.006], parent: g, cast: false });
  return g;
}

export function buildAboutCorner(ctx, profile, musicProjects) {
  const m = ctx.materials, B = ctx.batcher;
  const x = ROOM.x0, zc = -4.3;
  const out = { records: [], interactive: [] };
  const cream = pickMat(m, "lacquerPaper", "paintedCream");
  // wall shelving with 2 cream shelves on ink brackets
  for (const y of [1.0, 1.55]) B.box(.3, .035, 1.7, cream, [x + .17, y, zc], [0, 0, 0], { bevel: .008, grain: "z" });
  for (const y of [1.0, 1.55]) for (const dz of [-.8, .8]) B.box(.28, .05, .03, m.blackMetal, [x + .16, y - .042, zc + dz], [0, 0, 0], { bevel: .003 });
  // plaque: ABOUT (clickable): sun-yellow board on the ink wall
  const plaque = addSign(ctx, {
    draw: (lang) => drawSignBoard(lang === "fr" ? "À PROPOS D’ADAM" : "ABOUT ADAM", { width: 1536, height: 256, bg: PAL.sun, fg: PAL.ink, border: PAL.ink, font: FONT.display, sub: lang === "fr" ? "CLIQUE POUR EN SAVOIR PLUS" : "CLICK TO LEARN MORE" }),
    width: 1.3, height: .22, position: [x + .045, 2.52, zc], rotationY: PI / 2, emissive: .12
  });
  const aboutPick = new THREE.Group();
  aboutPick.userData.pick = { kind: "about", id: "about" };
  plaque.removeFromParent();
  aboutPick.position.set(x + .045, 2.52, zc); // hover scales the group: pivot at the plaque, not at the world origin
  aboutPick.add(plaque);
  plaque.position.set(0, 0, 0);
  ctx.scene.add(aboutPick);
  ctx.pickRoots.push(aboutPick);
  out.interactive.push(aboutPick);

  // memo board (cream felt in an ink frame) with pinned cards: pops on the ink wall
  const felt = new THREE.MeshStandardMaterial({ color: 0xf0e4c9, roughness: 1, map: m.fabricCream?.map || null, normalMap: m.fabricCream?.normalMap || null, normalScale: new THREE.Vector2(.9, .9) });
  ctx.owned.push(felt);
  const boardGroup = new THREE.Group();
  boardGroup.position.set(x + .03, 1.9, zc);
  boardGroup.rotation.y = PI / 2;
  mesh(woodBox(1.35, .82, .03, { bevel: .01, tile: .6 }), felt, { position: [0, 0, 0], parent: boardGroup });
  for (const [bw, bh, bx, by] of [[1.43, .04, 0, .43], [1.43, .04, 0, -.43], [.04, .82, -.69, 0], [.04, .82, .69, 0]]) mesh(woodBox(bw, bh, .05, { bevel: .006, tile: .5 }), pickMat(m, "lacquerInk", "paintedInk"), { position: [bx, by, .012], parent: boardGroup });
  // availability index card (confirmed facts only: Master 2, September, open to work abroad)
  const cardTex = localizedTexture(ctx, (lang) => {
    const c = createCanvas(640, 400);
    const g = c.getContext("2d");
    g.fillStyle = PAL.paper; g.fillRect(0, 0, 640, 400);
    g.fillStyle = PAL.coral; g.fillRect(0, 0, 640, 18);
    g.fillStyle = PAL.mint; g.beginPath(); g.arc(46, 70, 14, 0, PI * 2); g.fill();
    g.fillStyle = PAL.ink; g.textAlign = "left"; g.textBaseline = "middle";
    const head = lang === "fr" ? "MASTER 2 · DISPO" : "MASTER’S 2 · AVAILABLE";
    fitPx(g, head, FONT.display, 900, 520, 44); g.fillText(head, 76, 72);
    g.textBaseline = "alphabetic"; g.font = `600 34px ${FONT.ui}`;
    const lines = lang === "fr"
      ? ["• disponible dès septembre", "• ouvert à l’international", "• communication, web, data,", "  audiovisuel & musique"]
      : ["• available from September", "• open to working abroad", "• communication, web, data,", "  audiovisual & music"];
    lines.forEach((l, i) => g.fillText(l, 40, 154 + i * 52));
    g.fillStyle = PAL.cyan; g.fillRect(0, 382, 640, 18);
    return c;
  });
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: .8 });
  ctx.owned.push(cardMat);
  mesh(new THREE.PlaneGeometry(.46, .29), cardMat, { position: [-.34, .05, .022], rotation: [0, 0, -.03], parent: boardGroup, cast: false });
  const rand = rng(9);
  const pinMats = [PAL.coral, PAL.cyan, PAL.sun].map((c) => { const mat = new THREE.MeshStandardMaterial({ color: c, roughness: .35 }); ctx.owned.push(mat); return mat; });
  mesh(new THREE.SphereGeometry(.011, 10, 8), pinMats[0], { position: [-.34, .18, .032], parent: boardGroup, cast: false });
  // gig flyers pinned around (generative, decorative)
  for (let i = 0; i < 6; i++) {
    const ref = ctx.assets.poster.cells[(i * 2 + 1) % ctx.assets.poster.cells.length];
    const w = .15 + rand() * .05, h = w * 1.42;
    const px = .02 + (i % 3) * .21 + rand() * .03, py = .22 - Math.floor(i / 3) * .3 + rand() * .04;
    mesh(atlasPlane(w, h, ref), new THREE.MeshStandardMaterial({ map: ctx.assets.poster.texture, roughness: .75 }), { position: [px, py, .021], rotation: [0, 0, (rand() - .5) * .22], parent: boardGroup, cast: false });
    mesh(new THREE.SphereGeometry(.008, 8, 6), pinMats[i % 3], { position: [px, py + h * .44, .026], parent: boardGroup, cast: false });
  }
  ctx.scene.add(boardGroup);
  // guitar + mini keyboard
  const gtr = guitar(ctx);
  gtr.position.set(x + .1, 1.52, zc + 1.2);
  gtr.rotation.set(0, PI / 2, -.12, "YXZ");
  gtr.scale.setScalar(.95);
  ctx.scene.add(gtr);
  const keys = miniKeyboard(ctx);
  keys.position.set(x + .21, 1.0 + .0175, zc - .2);
  keys.rotation.y = PI / 2 + .08;
  ctx.scene.add(keys);
  // Adam's own releases on the lower shelf
  musicProjects.forEach((project, i) => {
    const rec = createRecord({ project, index: 20 + i, quality: ctx.quality, materials: m, edgeMaterial: ctx.edgeMaterial, paperNormal: ctx.paperNormal, kind: "music" });
    const g = rec.group;
    g.position.set(x + .21, 1.0 + .0175 + .157 * Math.cos(.2) + .006, zc + .35 + i * .34);
    g.rotation.set(0, PI / 2, 0, "YXZ");
    g.rotateX(-.2);
    g.userData.home = { parent: ctx.scene, position: g.position.clone(), quaternion: g.quaternion.clone(), scale: g.scale.clone() };
    g.userData.pick = { kind: "music", id: project.id };
    ctx.scene.add(g);
    ctx.pickRoots.push(g);
    out.records.push(rec);
  });
  // second shelf: zine stack + plant
  const zines = [m.fabricRed, m.fabricNavy, pickMat(m, "plasticSun", "fabricCream"), m.fabricGreen, m.fabricRed];
  for (let i = 0; i < 5; i++) B.box(.2 + (i % 2) * .03, .03, .27, zines[i], [x + .21, 1.555 + .0175 + i * .03, zc + .45 + (i % 2) * .01], [0, PI / 2 + (i - 2) * .02, 0], { bevel: .004 });
  buildPlant(ctx, x + .25, 1.57, zc - .55, .55, 1);
  addContactShadow(ctx, { x: x + .5, z: zc, width: .8, depth: 2.1, opacity: .35 });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plants (instanced leaf cards, glossy stylised leaves), armchair + side table + lamp (listening corner), clutter
// ---------------------------------------------------------------------------------------------
let leafTexture = null;
function getLeafTexture() {
  if (leafTexture) return leafTexture;
  const c = createCanvas(128, 256);
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 256);
  const grad = g.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, "#43e08f"); grad.addColorStop(.55, "#1fb877"); grad.addColorStop(1, "#0d8057");
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(64, 252); g.bezierCurveTo(-14, 170, 8, 50, 64, 3); g.bezierCurveTo(120, 50, 142, 170, 64, 252); g.fill();
  g.fillStyle = "rgba(255,255,255,.14)";
  g.beginPath(); g.moveTo(64, 250); g.bezierCurveTo(100, 180, 108, 80, 64, 10); g.bezierCurveTo(90, 90, 92, 180, 64, 250); g.fill();
  g.strokeStyle = "rgba(224,255,238,.7)"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(64, 248); g.lineTo(64, 14); g.stroke();
  g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(64, 220 - i * 30); g.lineTo(64 - 28, 190 - i * 30); g.moveTo(64, 220 - i * 30); g.lineTo(64 + 28, 190 - i * 30); g.stroke(); }
  leafTexture = textureFrom(c, { srgb: true, repeat: false });
  return leafTexture;
}

export function buildPlant(ctx, x, y, z, scale = 1, seed = 1) {
  const rand = rng(seed * 31 + 5);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const potProfile = [[0, 0], [.1, 0], [.13, .05], [.15, .2], [.16, .26], [.14, .26], [.0, .24]].map(([a, b]) => new THREE.Vector2(a, b));
  const potColors = [0xf0e4c9, 0xf0584a, 0x1b2145, 0xf5b92f];
  const clay = new THREE.MeshPhysicalMaterial({ color: potColors[(seed - 1 + potColors.length) % potColors.length], roughness: .42, clearcoat: .6, clearcoatRoughness: .2 });
  ctx.owned.push(clay);
  mesh(new THREE.LatheGeometry(potProfile, 24), clay, { parent: group });
  const soil = mesh(new THREE.CircleGeometry(.14, 16), new THREE.MeshStandardMaterial({ color: 0x241d3a, roughness: 1 }), { position: [0, .24, 0], rotation: [-PI / 2, 0, 0], parent: group, cast: false });
  void soil;
  const leafGeo = new THREE.PlaneGeometry(.17, .34);
  leafGeo.translate(0, .17, 0);
  const leafMat = new THREE.MeshStandardMaterial({ map: getLeafTexture(), alphaTest: .5, side: THREE.DoubleSide, roughness: .4, metalness: 0 });
  ctx.owned.push(leafMat);
  const count = 46;
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rand() * PI * 2, tilt = .35 + rand() * 1.0, h = .24 + rand() * .18;
    d.position.set(Math.cos(a) * .04, h, Math.sin(a) * .04);
    d.rotation.set(0, 0, 0);
    d.rotateY(a); d.rotateX(tilt);
    d.scale.setScalar(.8 + rand() * .7);
    d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix);
  }
  leaves.castShadow = true; leaves.receiveShadow = true;
  group.add(leaves);
  ctx.scene.add(group);
  return group;
}

// geometric "memphis" rug: coral half-disc, violet quarter-disc, sun dots, ink zig-zag, cyan triangle on cream
function rugTexture() {
  const W = 512, H = 410;
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = PAL.cream; g.fillRect(0, 0, W, H);
  g.fillStyle = PAL.coral; g.beginPath(); g.arc(150, 410, 170, PI, 0); g.fill();
  g.fillStyle = PAL.violet; g.beginPath(); g.moveTo(512, 0); g.lineTo(512, 230); g.arc(512, 0, 230, PI / 2, PI); g.closePath(); g.fill();
  g.fillStyle = PAL.cyan; g.beginPath(); g.moveTo(300, 330); g.lineTo(420, 330); g.lineTo(360, 230); g.closePath(); g.fill();
  g.fillStyle = PAL.sun; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(70 + i * 24, 50 + j * 24, 6, 0, PI * 2); g.fill(); }
  g.strokeStyle = PAL.ink; g.lineWidth = 9; g.lineJoin = "round"; g.beginPath(); for (let i = 0; i <= 9; i++) { const px = 220 + i * 22, py = 70 + (i % 2 ? 26 : 0); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  g.lineWidth = 12; g.strokeStyle = PAL.ink; g.strokeRect(6, 6, W - 12, H - 12);
  return c;
}

export function buildListeningCorner(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const x = -2.25, z = -4.55;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const sunCloth = new THREE.MeshStandardMaterial({ color: 0xf5b92f, roughness: 1, normalMap: m.fabricRed.normalMap, normalScale: new THREE.Vector2(.8, .8) });
  ctx.owned.push(sunCloth);
  // lounge armchair: chunky rounded coral cushions on slim ink legs, a sun pillow
  const seat = m.fabricRed;
  B.box(.9, .22, .85, seat, [x, .3, z], [0, 0, 0], { bevel: .09, tile: 1 });
  B.box(.9, .62, .2, seat, [x, .62, z - .33], [-.1, 0, 0], { bevel: .09, tile: 1 });
  for (const s of [-1, 1]) B.box(.16, .36, .8, seat, [x + s * .44, .46, z], [0, 0, 0], { bevel: .07, tile: 1 });
  B.box(.34, .34, .1, sunCloth, [x - .12, .56, z - .17], [-.3, .15, .1], { bevel: .04, tile: 1 });
  for (const sx of [-.38, .38]) for (const sz of [-.34, .34]) B.box(.035, .16, .035, m.blackMetal, [x + sx, .08, z + sz], [sz > 0 ? -.12 : .12, 0, sx > 0 ? .12 : -.12], { bevel: .008, grain: "y" });
  // side table (sun top, ink stem) + globe lamp
  B.add(new THREE.CylinderGeometry(.22, .22, .03, 28), pickMat(m, "lacquerSun", "paintedSun"), [x + 1.0, .52, z + .1]);
  B.add(new THREE.CylinderGeometry(.02, .02, .5, 10), m.blackMetal, [x + 1.0, .26, z + .1]);
  B.add(new THREE.CylinderGeometry(.14, .14, .02, 24), m.blackMetal, [x + 1.0, .01, z + .1]);
  const lampGroup = new THREE.Group();
  lampGroup.position.set(x + 1.0, .535, z + .1);
  mesh(new THREE.CylinderGeometry(.05, .06, .03, 20), m.blackMetal, { parent: lampGroup });
  mesh(new THREE.CylinderGeometry(.012, .012, .18, 10), m.blackMetal, { position: [0, .1, 0], parent: lampGroup });
  const shade = new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: .6, emissive: 0xffc878, emissiveIntensity: .9 });
  ctx.owned.push(shade);
  mesh(new THREE.SphereGeometry(.12, 28, 20), shade, { position: [0, .3, 0], cast: false, parent: lampGroup });
  ctx.scene.add(lampGroup);
  ctx.lights.lamp = new THREE.PointLight(0xffc27a, 1.4, 4.2, 2);
  ctx.lights.lamp.position.set(x + 1.0, .95, z + .1);
  ctx.scene.add(ctx.lights.lamp);
  // headphones hanging on the chair
  const hp = new THREE.Group();
  hp.position.set(x + .45, .72, z - .1);
  mesh(new THREE.TorusGeometry(.085, .008, 8, 24, PI), pickMat(m, "lacquerInk", "plasticBlack"), { position: [0, .0, 0], parent: hp });
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.04, .04, .03, 18), pickMat(m, "plasticCyan", "plasticBlack"), { position: [s * .085, -.005, 0], rotation: [0, 0, PI / 2], parent: hp });
  ctx.scene.add(hp);
  // speakers on stands left/right of the chair: ink cabinets, coral cones
  for (const sx of [-1.25, 1.35]) {
    const rot = sx < 0 ? .3 : -.3;
    B.box(.3, .4, .26, ink, [x + sx, .7, z - .35], [0, rot, 0], { bevel: .02 });
    const c = Math.cos(rot), s = Math.sin(rot);
    const front = (lx, ly, lz) => [x + sx + lx * c + lz * s, ly, z - .35 - lx * s + lz * c];
    B.add(new THREE.TorusGeometry(.075, .01, 8, 24), pickMat(m, "plasticCoral", "paintedCoral"), front(0, .66, .136), [0, rot, 0], { cast: false });
    B.add(new THREE.CircleGeometry(.07, 24), m.rubber, front(0, .66, .132), [0, rot, 0], { cast: false });
    B.add(new THREE.CylinderGeometry(.02, .02, .5, 8), m.blackMetal, [x + sx, .25, z - .35]);
    B.add(new THREE.CylinderGeometry(.12, .12, .01, 20), m.blackMetal, [x + sx, .005, z - .35]);
  }
  addContactShadow(ctx, { x, z, width: 1.4, depth: 1.3, opacity: .45 });
  // memphis rug
  const rugMat = new THREE.MeshStandardMaterial({ map: textureFrom(rugTexture(), { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy }), roughness: 1, normalMap: m.fabricRed.normalMap, normalScale: new THREE.Vector2(1.2, 1.2) });
  ctx.owned.push(rugMat);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.6), rugMat);
  rug.rotation.x = -PI / 2; rug.position.set(x + .1, .006, z + .55); rug.receiveShadow = true;
  ctx.scene.add(rug);
  buildPlant(ctx, x - 1.15, 0, z + .4, 1.6, 2);
}

// Small clutter: cardboard stacks, crate with records, bench, floor lamp, clock
export function buildClutter(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  // cardboard boxes behind the counter (left of the shopkeeper, in front of the staff-picks wall)
  addCardboardBox(ctx, .5, .36, .38, [1.55, .18, -4.78], .15, 0);
  addCardboardBox(ctx, .44, .3, .34, [1.58, .51, -4.76], -.1, 0);
  // crate with records on the floor near the gondola
  const crate = new THREE.Group();
  crate.position.set(-2.55, 0, -.2);
  crate.rotation.y = .3;
  const plastic = pickMat(m, "plasticCyan", "plasticBlack");
  mesh(woodBox(.36, .02, .33, { bevel: .003 }), plastic, { position: [0, .01, 0], parent: crate });
  mesh(woodBox(.36, .27, .015, { bevel: .003 }), plastic, { position: [0, .135, .165], parent: crate });
  mesh(woodBox(.36, .27, .015, { bevel: .003 }), plastic, { position: [0, .135, -.165], parent: crate });
  for (const s of [-1, 1]) mesh(woodBox(.015, .27, .33, { bevel: .003 }), plastic, { position: [s * .18, .135, 0], parent: crate });
  ctx.scene.add(crate);
  // low bench with record crates + floor lamp on the street-side left wall
  B.box(.5, .06, 1.7, pickMat(m, "lacquerPaper", "paintedCream"), [-3.38, .46, 2.55], [0, 0, 0], { bevel: .012 });
  for (const dz of [-.75, .75]) for (const dx of [-.18, .18]) B.box(.04, .43, .04, m.blackMetal, [-3.38 + dx, .215, 2.55 + dz], [0, 0, 0], { bevel: .004, grain: "y" });
  addCardboardBox(ctx, .4, .3, .5, [-3.38, .64, 2.1], .1, Math.PI / 2);
  addCardboardBox(ctx, .36, .26, .44, [-3.36, .62, 2.9], -.15, Math.PI / 2);
  const fl = new THREE.Group();
  fl.position.set(-3.25, 0, 3.95);
  mesh(new THREE.CylinderGeometry(.14, .16, .03, 24), m.blackMetal, { position: [0, .015, 0], parent: fl });
  mesh(new THREE.CylinderGeometry(.012, .012, 1.5, 10), m.blackMetal, { position: [0, .78, 0], parent: fl });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: .6, emissive: 0xffc878, emissiveIntensity: .45 });
  ctx.owned.push(shadeMat);
  mesh(new THREE.SphereGeometry(.2, 28, 20), shadeMat, { position: [0, 1.62, 0], cast: false, parent: fl });
  ctx.scene.add(fl);
  ctx.lights.floorLamp = new THREE.PointLight(0xffc27a, 2.2, 5.5, 2);
  ctx.lights.floorLamp.position.set(-3.1, 1.6, 3.95);
  ctx.scene.add(ctx.lights.floorLamp);
  buildPlant(ctx, -3.3, 0, 4.4, 1.5, 4);
  // wall clock above the door (inside): ink ring, cream face, coral second hand
  const clock = new THREE.Group();
  clock.position.set(1.25, 2.92, ROOM.zFront - .12);
  clock.rotation.y = PI;
  mesh(new THREE.CylinderGeometry(.2, .2, .04, 40), ink, { rotation: [PI / 2, 0, 0], parent: clock });
  const faceC = createCanvas(256);
  const g = faceC.getContext("2d");
  g.fillStyle = PAL.paper; g.beginPath(); g.arc(128, 128, 124, 0, PI * 2); g.fill();
  g.fillStyle = PAL.ink;
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.fillRect(128 + Math.sin(a) * 104 - 4, 128 - Math.cos(a) * 104 - 9, 8, 18); }
  g.strokeStyle = PAL.ink; g.lineCap = "round"; g.lineWidth = 11; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50, 128 + 28); g.stroke();
  g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 8, 128 - 84); g.stroke();
  g.strokeStyle = PAL.coral; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 128 + 24); g.lineTo(128 + 30, 128 - 80); g.stroke();
  g.fillStyle = PAL.coral; g.beginPath(); g.arc(128, 128, 8, 0, PI * 2); g.fill();
  mesh(new THREE.CircleGeometry(.185, 40), new THREE.MeshStandardMaterial({ map: textureFrom(faceC, { srgb: true, repeat: false }), roughness: .45 }), { position: [0, 0, .021], parent: clock, cast: false });
  ctx.scene.add(clock);
  // big plant right of the shopkeeper
  buildPlant(ctx, 3.45, 0, -4.7, 1.9, 3);
}
