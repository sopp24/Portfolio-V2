// Furniture & displays: the central two-tier gondola with category bins (project records),
// wall-hung sleeves, floor dig bins, shelving, checkout counter, window display.
import * as THREE from "three";
import { ROOM, GONDOLA, COUNTER, FRONT } from "./layout.js";
import { rng, composeMatrix, woodBox, createCanvas, textureFrom } from "./util.js";
import { SLEEVE, createRecord } from "./records.js";
import { atlasPlane } from "./assets.js";
import { addSign, addBin, addContactShadow, localizedTexture } from "./kit.js";
import { FONT, drawSignBoard } from "./artwork.js";

const TAB_LABELS = {
  communication: { fr: "COMMUNICATION", en: "COMMUNICATION" },
  "graphic-design": { fr: "DESIGN & DA", en: "DESIGN & ART DIR." },
  "audiovisual-music": { fr: "AUDIOVISUEL", en: "AUDIOVISUAL" },
  "web-development": { fr: "WEB & APPS", en: "WEB & APPS" },
  data: { fr: "DATA", en: "DATA" },
  "project-management": { fr: "PROJETS & ÉVÉNEMENTS", en: "PROJECTS & EVENTS" }
};

// ---------------------------------------------------------------------------------------------
// Central gondola: 2 tiers x 3 bins, each bin = 3 columns of records
// ---------------------------------------------------------------------------------------------
export function buildGondola(ctx, projects, categories) {
  const B = ctx.batcher, m = ctx.materials;
  const out = { records: [], bins: [] };
  const { cx, frontZ, rearZ, frontY, rearY, binGap, binDepth } = GONDOLA;
  // Scales with the collection: the bins are split over two tiers and each bin widens with its project count.
  const byCategory = new Map(categories.map((c) => [c.id, projects.filter((p) => p.categories[0] === c.id)]));
  const half = Math.ceil(categories.length / 2);
  const tierDefs = [
    { z: frontZ, y: frontY, cats: categories.slice(0, half), tier: "front" },
    { z: rearZ, y: rearY, cats: categories.slice(half), tier: "rear" }
  ];
  for (const tier of tierDefs) {
    tier.bins = tier.cats.map((cat) => {
      const count = (byCategory.get(cat.id) || []).length;
      if (count > 6) console.warn(`Category "${cat.id}" has ${count} projects; only 6 fit one bin.`);
      const cols = Math.min(6, Math.max(3, count));
      return { cat, cols, width: cols * .37 - .01 };
    });
    tier.span = tier.bins.reduce((sum, b) => sum + b.width, 0) + binGap * Math.max(0, tier.bins.length - 1);
    let x = cx - tier.span / 2;
    for (const bin of tier.bins) { bin.x = x + bin.width / 2; x += bin.width + binGap; }
  }
  const span = Math.max(...tierDefs.map((t) => t.span));

  // structure: tables with legs + lower shelf, stock boxes underneath
  for (const tier of tierDefs) {
    const depth = binDepth + .14;
    const span = tier.span;
    B.box(span + .12, .05, depth, m.oak, [cx, tier.y - .025, tier.z], [0, 0, 0], { bevel: .008, tile: 1.1 });
    B.box(span + .12, .1, .03, m.pine, [cx, tier.y - .1, tier.z + depth / 2 - .02], [0, 0, 0], { bevel: .006 });
    for (const lx of [-span / 2 + .03, -span / 6, span / 6, span / 2 - .03]) {
      for (const lz of [depth / 2 - .05, -depth / 2 + .05]) B.box(.07, tier.y - .05, .07, m.oak, [cx + lx, (tier.y - .05) / 2, tier.z + lz], [0, 0, 0], { bevel: .006, grain: "y" });
    }
    B.box(span, .03, depth - .08, m.pine, [cx, .22, tier.z], [0, 0, 0], { bevel: .005 });
    addContactShadow(ctx, { x: cx, z: tier.z, width: span + .5, depth: depth + .5, opacity: .55 });
  }
  // stock boxes under the front tier
  const rand = rng(99);
  for (let i = 0; i < 5; i++) {
    const w = rand.range(.32, .4);
    B.box(w, rand.range(.22, .3), .33, m.cardboard, [cx - span / 2 + .35 + i * (span / 5), .24 + .015 + .13, frontZ + .02 + rand.range(-.04, .04)], [0, rand.range(-.06, .06), 0], { bevel: .004, tile: .5 });
  }

  const filler = ctx.filler;
  let recordIndex = 0;
  for (const tier of tierDefs) {
    tier.bins.forEach(({ cat, cols: colCount, width: binWidth, x: bx }) => {
      addBin(ctx, { x: bx, y: tier.y, z: tier.z, width: binWidth, depth: binDepth, frontHeight: .095, sideHeight: .26, backHeight: .3 });
      const floorY = tier.y + .02;
      const items = byCategory.get(cat.id) || [];
      out.bins.push({ category: cat, x: bx, y: tier.y, z: tier.z, tier: tier.tier, projects: items });
      const cols = Array.from({ length: colCount }, (_, i) => (i - (colCount - 1) / 2) * .37);
      cols.forEach((cxLocal, ci) => {
        const colX = bx + cxLocal;
        const lean = .15;
        const frontSlotZ = tier.z + binDepth / 2 - .05;
        const project = items[ci];
        // filler stacks behind the front slot (or including it when there is no project)
        const skip = project ? 2 : 0;
        filler.addRow(ctx.scene, { origin: [colX, floorY, frontSlotZ], width: SLEEVE.size, count: project ? 34 : 38, lean, skip, pitch: .0112, jitter: .006 });
        if (project) {
          const rec = createRecord({ project, index: recordIndex++, quality: ctx.quality, materials: m, edgeMaterial: ctx.edgeMaterial, paperNormal: ctx.paperNormal });
          const g = rec.group;
          g.position.set(colX, floorY + .018 + (SLEEVE.size / 2) * Math.cos(lean), frontSlotZ);
          g.rotation.x = -lean;
          g.userData.home = { parent: ctx.scene, position: g.position.clone(), quaternion: g.quaternion.clone(), scale: g.scale.clone() };
          g.userData.pick = { kind: "project", id: project.id };
          ctx.scene.add(g);
          out.records.push(rec);
          ctx.pickRoots.push(g);
        }
      });
      // painted front plate with the category name (localized)
      const plateTexture = localizedTexture(ctx, (lang) => drawSignBoard((TAB_LABELS[cat.id] || { fr: cat.fr, en: cat.en })[lang] || cat.fr, { width: 1024, height: 128, bg: "#24332d", fg: "#ecd9a8", border: "#c9b07a", font: FONT.display }));
      const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture, roughness: .6 });
      ctx.owned.push(plateMat);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(.7, .0875), plateMat);
      plate.position.set(bx, tier.y + .055, tier.z + binDepth / 2 + .001);
      ctx.scene.add(plate);
    });
  }

  // hanging aisle signs (chains from the ceiling), one per bin
  tierDefs.forEach((tier) => {
    tier.bins.forEach(({ cat, x: bx }) => {
      const y = tier.tier === "front" ? 2.28 : 2.52;
      const z = tier.tier === "front" ? tier.z + .02 : tier.z + .02;
      const sign = addSign(ctx, {
        draw: (lang) => drawSignBoard((cat[lang] || cat.fr).toUpperCase(), { width: 1536, height: 256, bg: "#24332d", fg: "#ecd9a8", border: "#c9b07a", font: FONT.display }),
        width: 1.16, height: .2, position: [bx, y, z], rotationX: .0
      });
      void sign;
      for (const sx of [-.5, .5]) {
        B.add(new THREE.CylinderGeometry(.004, .004, ROOM.height - y - .1, 5), m.steel, [bx + sx, y + (ROOM.height - y) / 2 - .02, z - .01], [0, 0, 0], { cast: false });
      }
      B.box(1.2, .02, .03, m.pine, [bx, y + .11, z - .012], [0, 0, 0], { bevel: .004 });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Floor dig bins along the left wall (decorative crates full of records)
// ---------------------------------------------------------------------------------------------
export function buildDigBins(ctx) {
  const B = ctx.batcher, m = ctx.materials, filler = ctx.filler;
  const x = ROOM.x0 + .42, y = .5;
  const zs = [-2.35, -1.2, -.05, 1.1];
  zs.forEach((z, i) => {
    // low trestle + crate
    for (const dz of [-.46, .46]) for (const dx of [-.16, .16]) B.box(.05, y, .05, m.pine, [x + dx, y / 2, z + dz], [0, 0, 0], { bevel: .005, grain: "y" });
    addBin(ctx, { x, y, z, width: 1.1, depth: .5, rotY: Math.PI / 2, frontHeight: .1, sideHeight: .26, backHeight: .3, material: m.pine });
    const floorY = y + .02;
    for (let col = 0; col < 3; col++) {
      filler.addRow(ctx.scene, { origin: [x + .24, floorY, z + (col - 1) * .36], rotY: Math.PI / 2, count: 34, lean: .15 + (i % 2) * .03, pitch: .0112 });
    }
    // divider tab
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(.5, .1), new THREE.MeshStandardMaterial({ map: localizedTexture(ctx, (lang) => drawSignBoard(["NEW ARRIVALS", "STAFF PICKS", "ROCK / POP", "ELECTRO / HOUSE"][i], { width: 1024, height: 205, bg: "#f1e7cf", fg: "#1f2a26", border: "#1f2a26", font: FONT.display })), roughness: .7 }));
    tab.position.set(x + .22, floorY + .38, z);
    tab.rotation.set(-.15 * 0, Math.PI / 2, 0);
    tab.rotation.z = 0;
    ctx.scene.add(tab);
    addContactShadow(ctx, { x: x + .02, z, width: .9, depth: 1.5, opacity: .5 });
    // price tag on the crate rim
    ctx.sticker(4 + (i % 4), [x + .275, y + .06, z - .35], [0, Math.PI / 2, 0], .1);
  });
  return zs;
}

// ---------------------------------------------------------------------------------------------
// Wall-hung sleeves (left wall), poster collage (back wall), reference-style grid
// ---------------------------------------------------------------------------------------------
export function buildWallDisplays(ctx, assets) {
  const B = ctx.batcher, m = ctx.materials;
  const rand = rng(41);
  const cells = assets.decor.cells;
  const cell = .335;
  const rows = [1.52, 1.52 + cell, 1.52 + cell * 2];
  // left wall grid
  const z0 = -2.85, cols = 11;
  rows.forEach((y, r) => {
    // hanging rail
    B.box(.02, .02, cols * cell + .06, m.blackMetal, [ROOM.x0 + .03, y + .17, z0 + cols * cell / 2 - cell / 2], [0, 0, 0], { bevel: .004 });
    for (let c = 0; c < cols; c++) {
      const ref = cells[Math.floor(rand() * cells.length)];
      const z = z0 + c * cell;
      const geom = atlasPlane(SLEEVE.size, SLEEVE.size, ref, rand() < .08);
      ctx.batchDecor(geom, [ROOM.x0 + .042, y, z], [0, Math.PI / 2, (rand() - .5) * .012]);
      // thick board behind each sleeve
      B.add(new THREE.BoxGeometry(.006, SLEEVE.size, SLEEVE.size), m.cardboard, [ROOM.x0 + .036, y, z], [0, 0, 0], { receive: true });
    }
    void r;
  });
  // small stickers on the wall rail
  for (let i = 0; i < 6; i++) ctx.sticker(i, [ROOM.x0 + .04, 2.35 + rand.range(-.08, .08), z0 + 1 + i * .55], [0, Math.PI / 2, 0], .12);

  // back wall: two poster collages left and right of the neon sign (right one is above the shop-keeper)
  const poster = assets.poster;
  const placePoster = (cellDef, x, y, z, rotY, scale = 1) => {
    const w = .5 * scale, h = w * (poster.cellHeight / poster.cellWidth);
    const geom = atlasPlane(w, h, cellDef);
    ctx.batchPoster(geom, [x, y, z], [0, rotY, (rand() - .5) * .03]);
    // paper backing, slightly larger
    const back = [x - Math.sin(rotY) * .004, y, z - Math.cos(rotY) * .004];
    B.add(new THREE.BoxGeometry(w + .02, h + .02, .003), m.paper, back, [0, rotY, 0], { cast: false });
    return { w, h };
  };
  const pcells = poster.cells;
  // back wall layout (z = back wall)
  const zb = ROOM.zBack + .02;
  const layout = [
    [0, -3.2, 2.1, 1.1], [1, -2.62, 2.18, 1.1], [2, -2.04, 2.08, 1.1], [3, -3.0, 1.38, 1.0], [4, -2.22, 1.45, 1.0], [5, -1.5, 2.12, 1.05], [6, -1.45, 1.4, 1.0],
    [7, .75, 2.65, 1.15], [1, 1.45, 2.75, 1.05], [2, 2.15, 2.7, 1.0], [0, 2.85, 2.72, 1.1], [4, 3.2, 2.1, .95]
  ];
  const interactive = [];
  layout.forEach(([ci, x, y, s]) => {
    placePoster(pcells[ci], x, y, zb, 0, s);
  });
  // left wall (street end) collage
  [[0, 2.25, 1.9, 1.25], [1, 2.4, 2.6, 1.15], [2, 2.2, 3.3, 1.2], [4, 2.45, 4.0, 1.1], [5, 1.6, 2.0, 1.05], [6, 1.62, 2.65, 1.05], [3, 1.6, 3.3, 1.05], [7, 1.68, 3.95, 1.1], [0, 2.95, 2.5, 1.0], [2, 2.95, 3.55, 1.0]]
    .forEach(([ci, y, z, s]) => placePoster(pcells[ci], ROOM.x0 + .03, y, z, Math.PI / 2, s));
  // right wall above the shelving
  [[1, 2.85, -2.5, 1.2], [3, 2.9, -1.7, 1.1], [5, 2.85, -.9, 1.15], [7, 2.8, -.2, 1.1]]
    .forEach(([ci, y, z, s]) => placePoster(pcells[ci], ROOM.x1 - .03, y, z, -Math.PI / 2, s));
  // two interactive framed prints on the left wall above the sleeve grid
  const printDefs = [pcells[3], pcells[6]];
  printDefs.forEach((cellDef, i) => {
    const w = .62, h = w * (poster.cellHeight / poster.cellWidth);
    const group = new THREE.Group();
    const z = i === 0 ? -1.9 : -.35;
    group.position.set(ROOM.x0 + .06, 2.62, z);
    group.rotation.y = Math.PI / 2;
    const art = new THREE.Mesh(atlasPlane(w, h, cellDef), new THREE.MeshStandardMaterial({ map: poster.texture, roughness: .55, envMapIntensity: .6 }));
    art.position.z = .018;
    const frame = new THREE.Group();
    const fw = .04;
    for (const [bw, bh, bx, by] of [[w + fw * 2, fw, 0, h / 2 + fw / 2], [w + fw * 2, fw, 0, -h / 2 - fw / 2], [fw, h, -w / 2 - fw / 2, 0], [fw, h, w / 2 + fw / 2, 0]]) {
      const bar = new THREE.Mesh(woodBox(bw, bh, .035, { bevel: .006, tile: .5 }), m.oak);
      bar.position.set(bx, by, .017); bar.castShadow = true; frame.add(bar);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.glass);
    glass.position.z = .03; glass.renderOrder = 3;
    group.add(art, frame, glass);
    group.userData.pick = { kind: "poster", id: cellDef.id };
    group.userData.basePosition = group.position.clone();
    ctx.scene.add(group);
    ctx.pickRoots.push(group);
    interactive.push(group);
  });
  return { interactive };
}

// ---------------------------------------------------------------------------------------------
// Counter (checkout), back shelving behind it, right-wall shelving
// ---------------------------------------------------------------------------------------------
export function buildCounter(ctx) {
  const B = ctx.batcher, m = ctx.materials;
  const { x, z, width, depth, height } = COUNTER;
  // body with panel front
  B.box(width, height - .06, depth, m.paintedGreen, [x, (height - .06) / 2, z], [0, 0, 0], { bevel: .01, tile: 1.2 });
  for (let i = 0; i < 6; i++) {
    B.box(width / 6 - .08, height * .62, .012, m.oak, [x - width / 2 + width / 12 + i * width / 6, height * .45, z + depth / 2 + .004], [0, 0, 0], { bevel: .004, tile: .6 });
  }
  B.box(width + .06, .05, depth + .06, m.counterTop, [x, height - .025, z], [0, 0, 0], { bevel: .012, tile: 1.4 });
  B.box(width, .08, depth + .02, m.oak, [x, .04, z], [0, 0, 0], { bevel: .01 });
  addContactShadow(ctx, { x, z: z + .15, width: width + .6, depth: depth + .9, opacity: .5 });
  // glass-fronted display on the left end of the counter
  B.box(.7, .06, .44, m.counterTop, [x - width / 2 + .45, height + .03, z + depth / 2 - .26], [0, 0, 0], { bevel: .006 });
  // counter back-shelving: pigeon-hole unit with records on the back wall
  const bx = x, bz = ROOM.zBack + .3;
  B.box(width + .5, 1.9, .5, m.pine, [bx, .95, bz], [0, 0, 0], { bevel: .01 });
  for (let i = 0; i < 3; i++) B.box(width + .42, .03, .52, m.oak, [bx, .55 + i * .62, bz + .01], [0, 0, 0], { bevel: .006 });
  return { counterTop: height };
}

// Right wall CD / cassette shelving (rows of spines via instancing-friendly merged boxes)
export function buildShelving(ctx) {
  const B = ctx.batcher, m = ctx.materials;
  const rand = rng(61);
  const x = ROOM.x1 - .15;
  const zMin = -2.95, zMax = -.35;
  const unitDepth = .3;
  // back panel and shelves
  B.box(.04, 2.35, zMax - zMin, m.pine, [ROOM.x1 - .03, 1.2, (zMin + zMax) / 2], [0, 0, 0], { bevel: .004 });
  for (let i = 0; i <= 6; i++) B.box(unitDepth, .025, zMax - zMin, m.oak, [x, .35 + i * .34, (zMin + zMax) / 2], [0, 0, 0], { bevel: .004, grain: "z" });
  for (const z of [zMin, (zMin + zMax) / 2, zMax]) B.box(unitDepth, 2.4, .03, m.oak, [x, 1.2, z], [0, 0, 0], { bevel: .004, grain: "y" });
  const palette = ["#e9d7a2", "#c3402f", "#2d6a4f", "#1d3b4a", "#f2d16b", "#8a5a31", "#d9822b", "#3b6ea5", "#1b1b1b", "#d6e5d1", "#7d2a2a", "#e84a5f"];
  // CD spines (jewel cases) on the upper shelves, cassettes on the lower
  const spineGeo = new THREE.BoxGeometry(.011, .125, .142);
  const cassetteGeo = new THREE.BoxGeometry(.016, .1, .068);
  const mats = palette.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: .45, metalness: .0, envMapIntensity: .8 }));
  ctx.owned.push(...mats);
  for (let shelf = 0; shelf < 6; shelf++) {
    const y = .35 + shelf * .34 + .0125;
    const cassette = shelf < 2;
    let z = zMin + .05;
    while (z < zMax - .04) {
      const w = cassette ? .016 : .011;
      const mat = mats[Math.floor(rand() * mats.length)];
      const h = cassette ? .1 : .125;
      const tilt = rand() < .04 ? rand.range(-.2, .2) : 0;
      B.add(cassette ? cassetteGeo : spineGeo, mat, [x + .02, y + h / 2, z], [0, 0, tilt * .0], { cast: false });
      z += w + .0005;
    }
  }
  return { zMin, zMax };
}

// Window display (left window): a stack of crates with featured sleeves facing the street + OPEN neon
export function buildWindowDisplay(ctx, assets) {
  const B = ctx.batcher, m = ctx.materials;
  const rand = rng(17);
  const cx = (FRONT.windowA.x0 + FRONT.windowA.x1) / 2;
  const y = FRONT.sill + .05;
  // risers
  B.box(2.7, .22, .5, m.pine, [cx, y + .11, ROOM.zFront - .3], [0, 0, 0], { bevel: .008 });
  B.box(2.0, .22, .4, m.oak, [cx, y + .33, ROOM.zFront - .35], [0, 0, 0], { bevel: .008 });
  for (let i = 0; i < 7; i++) {
    const ref = assets.decor.cells[(i * 3) % assets.decor.cells.length];
    const px = cx - 1.2 + i * .4;
    const g = atlasPlane(SLEEVE.size * .8, SLEEVE.size * .8, ref);
    // sleeves face INTO the shop? No: window displays face the street (+z); seen from behind here, so we show their backs.
    ctx.batchDecor(g, [px, y + .22 + .13, ROOM.zFront - .12], [-.12, Math.PI, 0]);
  }
}
