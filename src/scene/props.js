// Props and themed corners: turntable, register, speakers, lucky cat, CV folder, contact cards,
// applications rack, about corner (guitar, keyboard, own records), listening corner, plants, clutter.
import * as THREE from "three";
import { ROOM, COUNTER } from "./layout.js";
import { rng, createCanvas, textureFrom, woodBox, composeMatrix, roundRectPath, wrapText } from "./util.js";
import { SLEEVE, createRecord, getGrooveSet } from "./records.js";
import { atlasPlane, drawAppCase } from "./assets.js";
import { addSign, addContactShadow, addCardboardBox, localizedTexture } from "./kit.js";
import { FONT, drawSignBoard, tex } from "./artwork.js";

const PI = Math.PI;

function mesh(geometry, material, { position, rotation, scale, cast = true, receive = true, parent } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale) typeof scale === "number" ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Turntable on the counter (spinning record, tonearm resting on the groove)
// ---------------------------------------------------------------------------------------------
export function buildTurntable(ctx, position) {
  const m = ctx.materials;
  const group = new THREE.Group();
  group.position.set(...position);
  const plinth = mesh(woodBox(.46, .07, .37, { bevel: .01, tile: .5 }), m.plasticBlack, { position: [0, .035, 0], parent: group });
  mesh(woodBox(.46, .012, .37, { bevel: .004, tile: .5 }), m.steel, { position: [0, .074, 0], parent: group });
  for (const [x, z] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) mesh(new THREE.CylinderGeometry(.018, .02, .02, 12), m.rubber, { position: [x, -.002, z], parent: group });
  const platter = new THREE.Group();
  platter.position.set(-.04, .085, .0);
  mesh(new THREE.CylinderGeometry(.158, .158, .014, 64), m.steel, { position: [0, .007, 0], parent: platter });
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: .9 });
  mesh(new THREE.CylinderGeometry(.15, .15, .004, 64), mat, { position: [0, .016, 0], parent: platter });
  const grooves = getGrooveSet(ctx.quality);
  const discMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 1, metalness: .2, clearcoat: .7, clearcoatRoughness: .1, normalMap: grooves.normal, roughnessMap: grooves.roughness, normalScale: new THREE.Vector2(.8, .8) });
  const disc = mesh(new THREE.CircleGeometry(.1524, 96), discMat, { position: [0, .0192, 0], rotation: [-PI / 2, 0, 0], parent: platter, cast: false });
  const labelCanvas = createCanvas(128);
  const lg = labelCanvas.getContext("2d");
  lg.fillStyle = "#c3402f"; lg.beginPath(); lg.arc(64, 64, 64, 0, PI * 2); lg.fill();
  lg.fillStyle = "#f2d16b"; lg.beginPath(); lg.arc(64, 64, 52, 0, PI * 2); lg.fill();
  lg.fillStyle = "#c3402f"; lg.font = `400 20px ${FONT.display}`; lg.textAlign = "center"; lg.fillText("SIDE A", 64, 70);
  const label = mesh(new THREE.CircleGeometry(.05, 40), new THREE.MeshStandardMaterial({ map: textureFrom(labelCanvas, { srgb: true, repeat: false }), roughness: .8 }), { position: [0, .0196, 0], rotation: [-PI / 2, 0, 0], parent: platter, cast: false });
  void label;
  mesh(new THREE.CylinderGeometry(.003, .003, .02, 8), m.steel, { position: [0, .028, 0], parent: platter });
  group.add(platter);
  // tonearm
  const armPivot = new THREE.Group();
  armPivot.position.set(.17, .1, -.12);
  mesh(new THREE.CylinderGeometry(.022, .026, .035, 20), m.steel, { position: [0, -.01, 0], parent: armPivot });
  const arm = new THREE.Group();
  mesh(new THREE.CylinderGeometry(.0035, .0035, .27, 8), m.steel, { position: [0, 0, .135], rotation: [PI / 2, 0, 0], parent: arm });
  mesh(woodBox(.026, .008, .04, { bevel: .002, tile: .2 }), m.plasticBlack, { position: [0, -.004, .285], parent: arm });
  mesh(new THREE.CylinderGeometry(.012, .012, .05, 12), m.steel, { position: [0, 0, -.03], rotation: [PI / 2, 0, 0], parent: arm });
  arm.rotation.y = -.74;
  armPivot.add(arm);
  group.add(armPivot);
  // start/stop and speed controls
  mesh(new THREE.CylinderGeometry(.012, .012, .01, 12), m.steel, { position: [.18, .08, .14], parent: group });
  mesh(new THREE.BoxGeometry(.014, .004, .006), m.ledRed, { position: [.15, .082, .15], parent: group, cast: false });
  group.userData.pick = { kind: "turntable", id: "main" };
  group.userData.update = (dt, elapsed, state) => {
    if (state.playing) platter.rotation.y -= dt * 3.49;
    const target = state.playing ? -.74 : -.3;
    arm.rotation.y += (target - arm.rotation.y) * Math.min(1, dt * 3);
  };
  ctx.scene.add(group);
  ctx.pickRoots.push(group);
  return group;
}

// ---------------------------------------------------------------------------------------------
// Register, bag, mug, bell, speaker, stack of boxes
// ---------------------------------------------------------------------------------------------
export function buildCounterClutter(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const y = COUNTER.height;
  const x0 = COUNTER.x, z0 = COUNTER.z;
  // vintage cash register
  const rx = x0 - .84, rz = z0 - .02;
  B.box(.44, .17, .4, m.plasticBeige, [rx, y + .085, rz], [0, 0, 0], { bevel: .015, tile: .6 });
  B.box(.4, .08, .3, m.plasticBeige, [rx, y + .21, rz + .02], [-.28, 0, 0], { bevel: .012, tile: .6 });
  B.box(.34, .03, .32, m.steel, [rx, y + .185, rz + .08], [-.05, 0, 0], { bevel: .006 });
  const keyGeo = new THREE.CylinderGeometry(.011, .011, .012, 10);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) B.add(keyGeo, (r + c) % 5 === 0 ? m.ledRed : m.plasticBlack, [rx - .13 + c * .052, y + .225 + r * .02, rz + .1 - r * .03], [-.28, 0, 0], { cast: false });
  B.box(.22, .05, .02, m.plasticBlack, [rx, y + .33, rz - .12], [0, 0, 0], { bevel: .004 });
  B.add(new THREE.PlaneGeometry(.17, .028), m.screenGreen, [rx, y + .331, rz - .109], [0, 0, 0], { cast: false, receive: false });
  B.box(.05, .1, .03, m.steel, [rx, y + .27, rz - .13], [0, 0, 0], { bevel: .004 });
  // pencil cup + receipt spike + bell
  const cup = new THREE.CylinderGeometry(.035, .03, .08, 16);
  B.add(cup, m.paintedGreen, [x0 - .62, y + .04, z0 - .22]);
  for (let i = 0; i < 4; i++) B.add(new THREE.CylinderGeometry(.003, .003, .13, 5), i % 2 ? m.brass : m.plasticBlack, [x0 - .62 + (i - 1.5) * .01, y + .11, z0 - .22], [(i - 1.5) * .12, 0, (i % 2 - .5) * .2], { cast: false });
  B.add(new THREE.CylinderGeometry(.045, .05, .018, 20), m.brass, [x0 - .05, y + .009, z0 + .22]);
  B.add(new THREE.SphereGeometry(.03, 16, 8, 0, PI * 2, 0, PI / 2), m.brass, [x0 - .05, y + .018, z0 + .22]);
  // mug
  B.add(new THREE.CylinderGeometry(.04, .035, .09, 18), m.paintedCream, [x0 - .12, y + .045, z0 - .24]);
  // paper shop bags (logo printed)
  const bagTexture = textureFrom(drawSignBoard("SIDE A", { width: 512, height: 512, bg: "#c9a77a", fg: "#24332d", border: "#24332d", sub: "RECORDS" }), { srgb: true, repeat: false });
  const bagMat = new THREE.MeshStandardMaterial({ map: bagTexture, roughness: .9 });
  ctx.owned.push(bagMat);
  const bag = mesh(new THREE.BoxGeometry(.24, .3, .12), [m.cardboard, m.cardboard, m.cardboard, m.cardboard, bagMat, m.cardboard], { position: [x0 + .7, y + .15 + .03, z0 - .2], rotation: [0, -.3, 0] });
  void bag;
  // rubber mat under the turntable
  B.add(new THREE.BoxGeometry(.6, .006, .5), m.fabricBlack, [x0 + .28, y + .003, z0 - .02]);
  // a few loose records leaning on the counter
  const rand = rng(23);
  for (let i = 0; i < 4; i++) {
    const ref = ctx.assets.decor.cells[(i * 5 + 2) % ctx.assets.decor.cells.length];
    ctx.batchDecor(atlasPlane(SLEEVE.size, SLEEVE.size, ref), [x0 - 1.15 + i * .02, y + .17 + .0, z0 + .24 - i * .012], [-.22, 0, (rand() - .5) * .03]);
  }
}

// Speakers (tower) flanking the counter and one on the back shelf
export function buildSpeakers(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const mk = (x, z, rotY) => {
    const h = 1.05, w = .34, d = .3;
    B.box(w, h, d, m.oak, [x, h / 2 + .12, z], [0, rotY, 0], { bevel: .012, grain: "y" });
    B.box(.3, .12, .26, m.blackMetal, [x, .06, z], [0, rotY, 0], { bevel: .004 });
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const front = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
    B.box(w - .03, h - .05, .012, m.fabricBlack, front(0, h / 2 + .12, d / 2 + .004), [0, rotY, 0], { bevel: .002, cast: false });
    const driver = new THREE.TorusGeometry(.11, .012, 8, 28);
    B.add(driver, m.blackMetal, front(0, .5, d / 2 + .014), [0, rotY, 0], { cast: false });
    B.add(driver, m.blackMetal, front(0, .95, d / 2 + .014), [0, rotY, 0], { cast: false });
    B.add(new THREE.CircleGeometry(.1, 28), m.rubber, front(0, .5, d / 2 + .012), [0, rotY, 0], { cast: false });
    B.add(new THREE.CircleGeometry(.1, 28), m.rubber, front(0, .95, d / 2 + .012), [0, rotY, 0], { cast: false });
    B.add(new THREE.CylinderGeometry(.03, .03, .01, 14), m.steel, front(0, .72, d / 2 + .014), [PI / 2, rotY, 0], { cast: false });
    addContactShadow(ctx, { x, z, width: .8, depth: .8, opacity: .5 });
  };
  mk(COUNTER.x - COUNTER.width / 2 - .4, COUNTER.z - .35, .22);
  mk(COUNTER.x + COUNTER.width / 2 - .1, ROOM.zBack + .5, -.1);
}

// ---------------------------------------------------------------------------------------------
// Lucky cat easter egg on the counter
// ---------------------------------------------------------------------------------------------
export function buildLuckyCat(ctx) {
  const root = new THREE.Group();
  root.position.set(COUNTER.x + 1.0, COUNTER.height + .05, COUNTER.z - .04);
  root.userData.pick = { kind: "secret", id: "cat" };
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf4efe3, roughness: .22, clearcoat: 1, clearcoatRoughness: .08, name: "ceramic" });
  const gold = ctx.materials.brass;
  ctx.owned.push(ceramic);
  const profile = [[0, 0], [.07, .0], [.09, .04], [.095, .09], [.085, .14], [.065, .17], [.0, .175]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = mesh(new THREE.LatheGeometry(profile, 24), ceramic, { parent: root });
  const head = mesh(new THREE.SphereGeometry(.07, 24, 18), ceramic, { position: [0, .235, .01], scale: [1.12, .96, .95], parent: root });
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(.026, .05, 4), ceramic, { position: [side * .05, .295, .005], rotation: [0, 0, -side * .22], parent: root });
    void ear;
    mesh(new THREE.SphereGeometry(.0065, 8, 6), ctx.materials.eyeDark, { position: [side * .028, .245, .069], parent: root, cast: false });
    mesh(new THREE.SphereGeometry(.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe9a2a0, roughness: .5 }), { position: [side * .052, .21, .058], scale: [1, .7, .4], parent: root, cast: false });
  }
  mesh(new THREE.SphereGeometry(.009, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd98b8b, roughness: .4 }), { position: [0, .222, .072], parent: root, cast: false });
  mesh(new THREE.TorusGeometry(.062, .009, 8, 28), gold, { position: [0, .168, .01], rotation: [PI / 2 - .12, 0, 0], parent: root });
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
  // CV folder
  const folder = new THREE.Group();
  folder.position.set(COUNTER.x - .38, y, COUNTER.z + .1);
  folder.rotation.y = .32;
  const tab = (lang) => {
    const c = createCanvas(512, 700);
    const g = c.getContext("2d");
    g.fillStyle = "#c9a77a"; g.fillRect(0, 0, 512, 700);
    g.strokeStyle = "rgba(60,40,20,.25)"; g.lineWidth = 3; g.strokeRect(24, 24, 464, 652);
    g.fillStyle = "#f4ead2"; roundRectPath(g, 70, 90, 372, 220, 10); g.fill();
    g.strokeStyle = "#24332d"; g.lineWidth = 4; roundRectPath(g, 80, 100, 352, 200, 8); g.stroke();
    g.fillStyle = "#24332d"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = `400 86px ${FONT.display}`; g.fillText("CURRICULUM", 256, 190);
    g.font = `500 34px ${FONT.sans}`; g.fillText(lang === "fr" ? "VITAE · À EMPORTER" : "VITAE · TAKE ONE", 256, 242);
    g.font = `26px ${FONT.type}`; g.fillText("ADAM SOPPELSA", 256, 284);
    g.fillStyle = "#6e5a3b"; g.font = `22px ${FONT.hand}`;
    g.fillText(profile.cv.url ? "PDF ↓" : (lang === "fr" ? "(version à jour bientôt)" : "(updated version soon)"), 256, 380);
    return c;
  };
  const tabTexture = localizedTexture(ctx, tab);
  const covMat = new THREE.MeshStandardMaterial({ map: tabTexture, roughness: .85, normalMap: ctx.paperNormal, normalScale: new THREE.Vector2(.4, .4) });
  ctx.owned.push(covMat);
  mesh(new THREE.BoxGeometry(.24, .008, .32), [m.cardboard, m.cardboard, covMat, m.cardboard, m.cardboard, m.cardboard], { position: [0, .004, 0], parent: folder });
  const sheaf = mesh(woodBox(.225, .012, .3, { bevel: .001 }), m.paper, { position: [0, .012, .0], parent: folder });
  void sheaf;
  mesh(new THREE.BoxGeometry(.24, .004, .32), [m.cardboard, m.cardboard, covMat, m.cardboard, m.cardboard, m.cardboard], { position: [0, .022, 0], parent: folder });
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
    g.fillStyle = "#f4ead2"; g.fillRect(0, 0, 512, 292);
    g.fillStyle = "#24332d"; g.fillRect(0, 0, 512, 22); g.fillRect(0, 270, 512, 22);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = `400 62px ${FONT.display}`; g.fillText("ADAM SOPPELSA", 30, 106);
    g.fillStyle = "#c3402f"; g.font = `500 22px ${FONT.sans}`; g.fillText("PROJECTS STORE · SIDE A RECORDS", 32, 142);
    g.fillStyle = "#24332d"; g.font = `20px ${FONT.type}`;
    g.fillText(lang === "fr" ? "Master 2 · communication · web · musique · data" : "Master’s 2 · communication · web · music · data", 32, 192);
    g.fillText(lang === "fr" ? "→ clique pour voir les contacts" : "→ click to see contact details", 32, 232);
    return c;
  });
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTexture, roughness: .8 });
  ctx.owned.push(cardMat);
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .25, clearcoat: 1 });
  ctx.owned.push(acrylic);
  mesh(new THREE.BoxGeometry(.1, .06, .028), acrylic, { position: [0, .03, 0], parent: cards, cast: false });
  for (let i = 0; i < 7; i++) {
    const card = mesh(new THREE.PlaneGeometry(.09, .051), cardMat, { position: [0, .045, .003 - i * .003], rotation: [-.12, 0, 0], parent: cards, cast: false });
    void card;
  }
  mesh(new THREE.BoxGeometry(.09, .004, .02), m.cardboard, { position: [0, .002, 0], parent: cards });
  // single card lying flat, larger and readable when hovered (click target)
  const flat = mesh(new THREE.PlaneGeometry(.17, .097), cardMat, { position: [.0, .005, .09], rotation: [-PI / 2, 0, .2], parent: cards, cast: false });
  void flat;
  cards.userData.pick = { kind: "contact", id: "contact" };
  cards.userData.hoverLift = true;
  ctx.scene.add(cards);
  ctx.pickRoots.push(cards);
  return { folder, cards };
}

// ---------------------------------------------------------------------------------------------
// SOPP AGENTS rack (applications) on the right wall
// ---------------------------------------------------------------------------------------------
export function buildAppsRack(ctx, applications) {
  const m = ctx.materials, B = ctx.batcher;
  const x = ROOM.x1 - .08, zc = 1.95;
  const out = { cards: [] };
  const cols = 4, rows = Math.ceil(applications.length / cols);
  const pitch = .62, rowGap = .9, w = pitch * cols + .14;
  const baseY = .98;
  // unit: charcoal back board, shelf ledges and side cheeks
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x2a2f34, roughness: .55, metalness: .3 });
  ctx.owned.push(charcoal);
  B.box(.05, 2.45, w, m.paintedGreen, [x + .02, 1.7, zc], [0, 0, 0], { bevel: .006 });
  B.add(new THREE.BoxGeometry(.04, 2.45, w - .06), charcoal, [x - .005, 1.7, zc]);
  for (let r = 0; r <= rows; r++) B.box(.26, .04, w, m.oak, [x - .12, baseY + r * rowGap, zc], [0, 0, 0], { bevel: .006, grain: "z" });
  for (const sz of [-w / 2 + .02, w / 2 - .02]) B.box(.26, 2.45, .04, m.oak, [x - .12, 1.7, zc + sz], [0, 0, 0], { bevel: .006, grain: "y" });
  // storage cabinet under the rack (instead of a dark void): painted doors with brass pulls
  B.box(.34, .9, w - .04, m.paintedGreen, [x - .13, .45, zc], [0, 0, 0], { bevel: .008 });
  const doors = 4, doorW = (w - .14) / doors;
  for (let i = 0; i < doors; i++) {
    const dz = zc - w / 2 + .07 + doorW * (i + .5);
    B.box(.012, .74, doorW - .035, m.paintedGreen, [x - .303, .45, dz], [0, 0, 0], { bevel: .004 });
    B.box(.014, .1, .012, m.brass, [x - .318, .55, dz + (i % 2 ? -1 : 1) * (doorW / 2 - .06)], [0, 0, 0], { bevel: .003 });
  }
  B.box(.36, .035, w - .02, m.oak, [x - .13, .915, zc], [0, 0, 0], { bevel: .006, grain: "z" });
  // header: neon-style board
  addSign(ctx, {
    draw: (lang) => {
      const c = createCanvas(1536, 256);
      const g = c.getContext("2d");
      g.fillStyle = "#16191c"; g.fillRect(0, 0, 1536, 256);
      g.strokeStyle = "#6ad0e0"; g.lineWidth = 4; g.strokeRect(14, 14, 1508, 228);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#6ad0e0"; g.shadowBlur = 24; g.fillStyle = "#d9fbff";
      g.font = `400 150px ${FONT.display}`; g.fillText("SOPP AGENTS", 768, 100);
      g.shadowBlur = 8; g.font = `500 44px ${FONT.sans}`; g.fillStyle = "#6ad0e0";
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
    const face = new THREE.MeshStandardMaterial({ map: art, roughness: .55, envMapIntensity: .6, emissive: 0xffffff, emissiveMap: art, emissiveIntensity: .3 });
    ctx.owned.push(face);
    mesh(new THREE.BoxGeometry(.38, .47, .055), [charcoal, charcoal, charcoal, charcoal, face, charcoal], { parent: group });
    group.userData.pick = { kind: "app", id: app.id };
    group.userData.home = { position: group.position.clone(), quaternion: group.quaternion.clone(), scale: group.scale.clone() };
    group.userData.appIndex = i;
    ctx.scene.add(group);
    ctx.pickRoots.push(group);
    out.cards.push(group);
  });
  addContactShadow(ctx, { x: x - .2, z: zc, width: .6, depth: w + .5, opacity: .5 });
  // small kiosk table with a retro CRT beside the rack (boot screen)
  const kx = x - .3, kz = zc + w / 2 + .5;
  for (const dz of [-.18, .18]) for (const dx of [-.14, .14]) B.box(.05, .72, .05, m.oak, [kx + dx, .36, kz + dz], [0, 0, 0], { bevel: .005, grain: "y" });
  B.box(.5, .04, .5, m.oak, [kx, .74, kz], [0, 0, 0], { bevel: .008 });
  const crt = new THREE.Group();
  crt.position.set(kx, .76, kz);
  crt.rotation.y = -PI / 2 + .25;
  mesh(woodBox(.36, .3, .32, { bevel: .035, tile: .5 }), m.plasticBeige, { position: [0, .15, 0], parent: crt });
  const screenTex = (() => {
    const c = createCanvas(256, 192);
    const g = c.getContext("2d");
    g.fillStyle = "#06150f"; g.fillRect(0, 0, 256, 192);
    g.fillStyle = "#6dffb0"; g.font = `20px ${FONT.type}`; g.textAlign = "left";
    ["SOPP AGENTS v1.0", "> 8 apps found", "> ready_", ""].forEach((l, i) => g.fillText(l, 20, 40 + i * 28));
    g.fillStyle = "rgba(0,0,0,.25)"; for (let y = 0; y < 192; y += 3) g.fillRect(0, y, 256, 1);
    return textureFrom(c, { srgb: true, repeat: false });
  })();
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(1.1, 1.1, 1.1) });
  ctx.owned.push(screenMat);
  mesh(new THREE.PlaneGeometry(.26, .2), screenMat, { position: [0, .16, .162], parent: crt, cast: false });
  ctx.scene.add(crt);
  return out;
}

// ---------------------------------------------------------------------------------------------
// About corner: corkboard, hand-lettered plaque, own records, acoustic guitar, mini keyboard
// ---------------------------------------------------------------------------------------------
function acousticGuitar(ctx) {
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
  const wood = new THREE.MeshPhysicalMaterial({ color: 0xc2833d, roughness: .4, clearcoat: .8, clearcoatRoughness: .2, map: m.oak.map, name: "guitarWood" });
  ctx.owned.push(wood);
  mesh(bodyGeo, wood, { parent: g });
  mesh(new THREE.CircleGeometry(.04, 28), m.plasticBlack, { position: [0, .035, .0415], parent: g, cast: false });
  mesh(new THREE.TorusGeometry(.043, .004, 6, 28), m.oak, { position: [0, .035, .0415], parent: g, cast: false });
  mesh(woodBox(.1, .012, .012, { bevel: .003 }), m.blackMetal, { position: [0, -.1, .045], parent: g, cast: false });
  mesh(woodBox(.045, .62, .022, { bevel: .004, tile: .5 }), m.blackMetal, { position: [0, .55, .012], parent: g });
  mesh(woodBox(.06, .17, .02, { bevel: .006, tile: .5 }), m.oak, { position: [0, .93, .0], rotation: [0, 0, 0], parent: g });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.006, .006, .02, 8), m.steel, { position: [s * .032, .88 + i * .045, -.01], rotation: [PI / 2, 0, 0], parent: g, cast: false });
  for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(.0006, .0006, 1.08, 3), m.steel, { position: [-.0125 + i * .005, .32, .047], parent: g, cast: false });
  return g;
}

function miniKeyboard(ctx) {
  const m = ctx.materials;
  const g = new THREE.Group();
  mesh(woodBox(.52, .035, .16, { bevel: .01, tile: .5 }), m.plasticBlack, { position: [0, .0175, 0], parent: g });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0eadc, roughness: .5 });
  ctx.owned.push(white);
  const keyGeo = new THREE.BoxGeometry(.0185, .012, .105);
  const blackGeo = new THREE.BoxGeometry(.011, .012, .064);
  for (let i = 0; i < 25; i++) mesh(keyGeo, white, { position: [-.222 + i * .0185, .041, .015], parent: g, cast: false });
  const pattern = [0, 1, 3, 4, 5];
  for (let i = 0; i < 24; i++) if (pattern.includes(i % 7)) mesh(blackGeo, m.plasticBlack, { position: [-.2125 + i * .0185, .049, -.006], parent: g, cast: false });
  return g;
}

export function buildAboutCorner(ctx, profile, musicProjects) {
  const m = ctx.materials, B = ctx.batcher;
  const x = ROOM.x0, zc = -4.3;
  const out = { records: [], interactive: [] };
  // wall shelving with 2 shelves
  for (const y of [1.0, 1.55]) B.box(.3, .035, 1.7, m.oak, [x + .17, y, zc], [0, 0, 0], { bevel: .006, grain: "z" });
  for (const dz of [-.8, .8]) B.box(.28, .08, .03, m.blackMetal, [x + .16, 1.0 - .055, zc + dz], [0, 0, 0], { bevel: .003 });
  // plaque: ABOUT (clickable)
  const plaque = addSign(ctx, {
    draw: (lang) => drawSignBoard(lang === "fr" ? "À PROPOS D’ADAM" : "ABOUT ADAM", { width: 1536, height: 256, bg: "#3c2a1d", fg: "#f1d9a0", border: "#c9a050", font: FONT.display, sub: lang === "fr" ? "CLIQUE POUR EN SAVOIR PLUS" : "CLICK TO LEARN MORE" }),
    width: 1.3, height: .22, position: [x + .045, 2.52, zc], rotationY: PI / 2
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

  // corkboard with pinned cards
  const cork = new THREE.MeshStandardMaterial({ color: 0xb58a58, roughness: 1, map: m.cardboard.map, normalMap: m.cardboard.normalMap, normalScale: new THREE.Vector2(1.6, 1.6) });
  ctx.owned.push(cork);
  const boardGroup = new THREE.Group();
  boardGroup.position.set(x + .03, 1.9, zc);
  boardGroup.rotation.y = PI / 2;
  mesh(woodBox(1.35, .82, .03, { bevel: .01, tile: .6 }), cork, { position: [0, 0, 0], parent: boardGroup });
  for (const [bw, bh, bx, by] of [[1.43, .04, 0, .43], [1.43, .04, 0, -.43], [.04, .82, -.69, 0], [.04, .82, .69, 0]]) mesh(woodBox(bw, bh, .05, { bevel: .006, tile: .5 }), m.oak, { position: [bx, by, .012], parent: boardGroup });
  // availability index card (confirmed facts only: Master 2, September, open to work abroad)
  const cardTex = localizedTexture(ctx, (lang) => {
    const c = createCanvas(640, 400);
    const g = c.getContext("2d");
    g.fillStyle = "#f6f0de"; g.fillRect(0, 0, 640, 400);
    g.strokeStyle = "#d4584a"; g.lineWidth = 3; for (let y = 90; y < 400; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }
    g.strokeStyle = "#d4584a"; g.beginPath(); g.moveTo(70, 0); g.lineTo(70, 400); g.stroke();
    g.fillStyle = "#24332d"; g.font = `400 62px ${FONT.display}`; g.textAlign = "left";
    g.fillText(lang === "fr" ? "MASTER 2 — DISPO !" : "MASTER’S 2 — AVAILABLE!", 92, 70);
    g.font = `34px ${FONT.hand}`; g.fillStyle = "#1b3a5c";
    const lines = lang === "fr"
      ? ["• disponible dès septembre", "• ouvert à l’international", "• communication, web, data,", "  audiovisuel & musique"]
      : ["• available from September", "• open to working abroad", "• communication, web, data,", "  audiovisual & music"];
    lines.forEach((l, i) => g.fillText(l, 92, 142 + i * 42));
    return c;
  });
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: .9 });
  ctx.owned.push(cardMat);
  mesh(new THREE.PlaneGeometry(.46, .29), cardMat, { position: [-.34, .05, .022], rotation: [0, 0, -.03], parent: boardGroup, cast: false });
  const rand = rng(9);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xc3402f, roughness: .4 });
  ctx.owned.push(pinMat);
  mesh(new THREE.SphereGeometry(.009, 10, 8), pinMat, { position: [-.34, .18, .032], parent: boardGroup, cast: false });
  // concert ticket stubs / photos (generative, decorative)
  for (let i = 0; i < 6; i++) {
    const ref = ctx.assets.poster.cells[(i * 2 + 1) % ctx.assets.poster.cells.length];
    const w = .15 + rand() * .05, h = w * 1.42;
    const p = mesh(atlasPlane(w, h, ref), new THREE.MeshStandardMaterial({ map: ctx.assets.poster.texture, roughness: .8 }), { position: [.02 + (i % 3) * .21 + rand() * .03, .22 - Math.floor(i / 3) * .3 + rand() * .04, .021], rotation: [0, 0, (rand() - .5) * .22], parent: boardGroup, cast: false });
    void p;
  }
  ctx.scene.add(boardGroup);
  // guitar + mini keyboard + headphones
  const guitar = acousticGuitar(ctx);
  guitar.position.set(x + .1, 1.52, zc + 1.2);
  guitar.rotation.set(0, PI / 2, -.12, "YXZ");
  guitar.scale.setScalar(.95);
  ctx.scene.add(guitar);
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
  // second shelf: books/zines stack + plant
  for (let i = 0; i < 5; i++) B.box(.2 + (i % 2) * .03, .03 + i * .0, .27, i % 2 ? m.fabricRed : m.fabricNavy, [x + .21, 1.555 + .015 + i * .03, zc + .45 + (i % 2) * .01], [0, PI / 2 + (i - 2) * .02, 0], { bevel: .004 });
  buildPlant(ctx, x + .25, 1.57, zc - .55, .55, 1);
  addContactShadow(ctx, { x: x + .5, z: zc, width: .8, depth: 2.1, opacity: .4 });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plants (instanced leaf cards), armchair + side table + lamp (listening corner), stool, crates
// ---------------------------------------------------------------------------------------------
let leafTexture = null;
function getLeafTexture() {
  if (leafTexture) return leafTexture;
  const c = createCanvas(128, 256);
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 256);
  const grad = g.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, "#5b9b45"); grad.addColorStop(1, "#2c6a31");
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(64, 250); g.bezierCurveTo(-20, 160, 10, 40, 64, 4); g.bezierCurveTo(118, 40, 148, 160, 64, 250); g.fill();
  g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 245); g.lineTo(64, 12); g.stroke();
  g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(64, 220 - i * 24); g.lineTo(64 - 30, 196 - i * 24); g.moveTo(64, 220 - i * 24); g.lineTo(64 + 30, 196 - i * 24); g.stroke(); }
  leafTexture = textureFrom(c, { srgb: true, repeat: false });
  return leafTexture;
}

export function buildPlant(ctx, x, y, z, scale = 1, seed = 1) {
  const m = ctx.materials;
  const rand = rng(seed * 31 + 5);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const potProfile = [[0, 0], [.1, 0], [.13, .05], [.15, .22], [.16, .26], [.14, .26], [.0, .24]].map(([a, b]) => new THREE.Vector2(a, b));
  const clay = new THREE.MeshStandardMaterial({ color: 0xb4623e, roughness: .8, map: m.cardboard.map });
  ctx.owned.push(clay);
  mesh(new THREE.LatheGeometry(potProfile, 20), clay, { parent: group });
  const soil = mesh(new THREE.CircleGeometry(.14, 16), new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 1 }), { position: [0, .24, 0], rotation: [-PI / 2, 0, 0], parent: group, cast: false });
  void soil;
  const leafGeo = new THREE.PlaneGeometry(.17, .34);
  leafGeo.translate(0, .17, 0);
  const leafMat = new THREE.MeshStandardMaterial({ map: getLeafTexture(), alphaTest: .5, side: THREE.DoubleSide, roughness: .6, metalness: 0 });
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

export function buildListeningCorner(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  const x = -2.25, z = -4.55;
  // armchair
  const seat = ctx.materials.fabricRed;
  B.box(.9, .22, .85, seat, [x, .3, z], [0, 0, 0], { bevel: .06, tile: 1 });
  B.box(.9, .62, .2, seat, [x, .62, z - .33], [-.08, 0, 0], { bevel: .06, tile: 1 });
  for (const s of [-1, 1]) B.box(.16, .36, .8, seat, [x + s * .44, .46, z], [0, 0, 0], { bevel: .05, tile: 1 });
  for (const sx of [-.38, .38]) for (const sz of [-.34, .34]) B.box(.05, .16, .05, m.oak, [x + sx, .08, z + sz], [0, 0, 0], { bevel: .008, grain: "y" });
  // side table + lamp
  B.add(new THREE.CylinderGeometry(.22, .22, .03, 24), m.oak, [x + 1.0, .52, z + .1]);
  B.add(new THREE.CylinderGeometry(.02, .02, .5, 8), m.blackMetal, [x + 1.0, .26, z + .1]);
  B.add(new THREE.CylinderGeometry(.14, .14, .02, 20), m.blackMetal, [x + 1.0, .01, z + .1]);
  const lampGroup = new THREE.Group();
  lampGroup.position.set(x + 1.0, .535, z + .1);
  mesh(new THREE.CylinderGeometry(.04, .06, .03, 16), m.brass, { parent: lampGroup });
  mesh(new THREE.CylinderGeometry(.012, .012, .3, 8), m.brass, { position: [0, .16, 0], parent: lampGroup });
  const shade = new THREE.MeshStandardMaterial({ color: 0xf1dcae, roughness: .9, side: THREE.DoubleSide, emissive: 0xffc878, emissiveIntensity: .8 });
  ctx.owned.push(shade);
  mesh(new THREE.CylinderGeometry(.09, .15, .2, 24, 1, true), shade, { position: [0, .36, 0], parent: lampGroup, cast: false });
  ctx.scene.add(lampGroup);
  ctx.lights.lamp = new THREE.PointLight(0xffc27a, 1.4, 4.2, 2);
  ctx.lights.lamp.position.set(x + 1.0, .95, z + .1);
  ctx.scene.add(ctx.lights.lamp);
  // headphones hanging on the chair
  const hp = new THREE.Group();
  hp.position.set(x + .45, .72, z - .1);
  mesh(new THREE.TorusGeometry(.085, .008, 8, 24, PI), m.plasticBlack, { position: [0, .0, 0], parent: hp });
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.04, .04, .03, 18), m.plasticBlack, { position: [s * .085, -.005, 0], rotation: [0, 0, PI / 2], parent: hp });
  ctx.scene.add(hp);
  // speakers on stands left/right of the chair
  for (const sx of [-1.25, 1.35]) {
    B.box(.3, .4, .26, m.oak, [x + sx, .7, z - .35], [0, sx < 0 ? .3 : -.3, 0], { bevel: .01 });
    B.add(new THREE.CylinderGeometry(.02, .02, .5, 8), m.blackMetal, [x + sx, .25, z - .35]);
    B.add(new THREE.CylinderGeometry(.12, .12, .01, 16), m.blackMetal, [x + sx, .0, z - .35]);
  }
  addContactShadow(ctx, { x, z, width: 1.4, depth: 1.3, opacity: .5 });
  // rug
  const rugCanvas = createCanvas(256, 256);
  const g = rugCanvas.getContext("2d");
  g.fillStyle = "#7d2a2a"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#e0b86a"; g.lineWidth = 6; g.strokeRect(16, 16, 224, 224); g.strokeRect(34, 34, 188, 188);
  g.fillStyle = "#1d3b4a"; g.beginPath(); g.moveTo(128, 60); g.lineTo(196, 128); g.lineTo(128, 196); g.lineTo(60, 128); g.closePath(); g.fill();
  g.fillStyle = "#e0b86a"; g.beginPath(); g.arc(128, 128, 18, 0, PI * 2); g.fill();
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.6), new THREE.MeshStandardMaterial({ map: textureFrom(rugCanvas, { srgb: true, repeat: false }), roughness: 1, normalMap: m.fabricRed.normalMap, normalScale: new THREE.Vector2(1.5, 1.5) }));
  rug.rotation.x = -PI / 2; rug.position.set(x + .1, .006, z + .55); rug.receiveShadow = true;
  ctx.scene.add(rug);
  buildPlant(ctx, x - 1.15, 0, z + .4, 1.6, 2);
}

// Small clutter: cardboard stacks, milk crate with records, step stool, clock
export function buildClutter(ctx) {
  const m = ctx.materials, B = ctx.batcher;
  // cardboard boxes by the counter (back right)
  addCardboardBox(ctx, .5, .36, .38, [3.2, .18, -4.7], .15, -Math.PI / 2);
  addCardboardBox(ctx, .44, .3, .34, [3.18, .51, -4.68], -.1, -Math.PI / 2);
  // crate with records on the floor near the gondola
  const crate = new THREE.Group();
  crate.position.set(-2.55, 0, -.2);
  crate.rotation.y = .3;
  const plastic = new THREE.MeshStandardMaterial({ color: 0x3b6ea5, roughness: .5 });
  ctx.owned.push(plastic);
  mesh(woodBox(.36, .02, .33, { bevel: .003 }), plastic, { position: [0, .01, 0], parent: crate });
  mesh(woodBox(.36, .27, .015, { bevel: .003 }), plastic, { position: [0, .135, .165], parent: crate });
  mesh(woodBox(.36, .27, .015, { bevel: .003 }), plastic, { position: [0, .135, -.165], parent: crate });
  for (const s of [-1, 1]) mesh(woodBox(.015, .27, .33, { bevel: .003 }), plastic, { position: [s * .18, .135, 0], parent: crate });
  ctx.scene.add(crate);
  // low bench with record crates + floor lamp on the street-side left wall
  B.box(.5, .08, 1.7, m.oak, [-3.38, .46, 2.55], [0, 0, 0], { bevel: .01 });
  for (const dz of [-.75, .75]) for (const dx of [-.18, .18]) B.box(.06, .42, .06, m.oak, [-3.38 + dx, .21, 2.55 + dz], [0, 0, 0], { bevel: .005, grain: "y" });
  addCardboardBox(ctx, .4, .3, .5, [-3.38, .65, 2.1], .1, Math.PI / 2);
  addCardboardBox(ctx, .36, .26, .44, [-3.36, .63, 2.9], -.15, Math.PI / 2);
  const fl = new THREE.Group();
  fl.position.set(-3.25, 0, 3.95);
  mesh(new THREE.CylinderGeometry(.14, .16, .03, 20), m.blackMetal, { position: [0, .015, 0], parent: fl });
  mesh(new THREE.CylinderGeometry(.012, .012, 1.55, 8), m.brass, { position: [0, .8, 0], parent: fl });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf1dcae, roughness: .9, side: THREE.DoubleSide, emissive: 0xffc878, emissiveIntensity: .38 });
  ctx.owned.push(shadeMat);
  mesh(new THREE.CylinderGeometry(.16, .26, .3, 24, 1, true), shadeMat, { position: [0, 1.62, 0], parent: fl, cast: false });
  ctx.scene.add(fl);
  ctx.lights.floorLamp = new THREE.PointLight(0xffc27a, 2.2, 5.5, 2);
  ctx.lights.floorLamp.position.set(-3.1, 1.6, 3.95);
  ctx.scene.add(ctx.lights.floorLamp);
  buildPlant(ctx, -3.3, 0, 4.4, 1.5, 4);
  // wall clock above the door (inside)
  const clock = new THREE.Group();
  clock.position.set(1.25, 2.92, ROOM.zFront - .12);
  clock.rotation.y = PI;
  mesh(new THREE.CylinderGeometry(.2, .2, .04, 40), m.brass, { rotation: [PI / 2, 0, 0], parent: clock });
  const faceC = createCanvas(256);
  const g = faceC.getContext("2d");
  g.fillStyle = "#f4ead2"; g.beginPath(); g.arc(128, 128, 124, 0, PI * 2); g.fill();
  g.fillStyle = "#161412";
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.fillRect(128 + Math.sin(a) * 104 - 3, 128 - Math.cos(a) * 104 - 8, 6, 16); }
  g.strokeStyle = "#161412"; g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50, 128 + 28); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 8, 128 - 84); g.stroke();
  const face = mesh(new THREE.CircleGeometry(.185, 40), new THREE.MeshStandardMaterial({ map: textureFrom(faceC, { srgb: true, repeat: false }), roughness: .5 }), { position: [0, 0, .021], parent: clock, cast: false });
  void face;
  ctx.scene.add(clock);
  // fire exit-style "OPEN" neon in the window (updated by lighting)
  buildPlant(ctx, 3.0, 0, -5.0, 1.9, 3);
}
