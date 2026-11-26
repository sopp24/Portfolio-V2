// Furniture & displays, art direction v2: the central two-tier gondola with COLOUR-CODED category bins (every bin, its front
// plate and its hanging sign share one accent), wall-hung sleeves on ink rails, painted floor dig bins, shelving, the
// "SIDE A" checkout counter, the staff-picks wall behind it, the window display.
// Layout, pick roots and bin/record coordinates are unchanged (src/scene/layout.js is the contract).
import * as THREE from "three";
import { ROOM, GONDOLA, COUNTER, FRONT } from "./layout.js";
import { rng, woodBox, createCanvas, textureFrom } from "./util.js";
import { SLEEVE, createRecord } from "./records.js";
import { atlasPlane } from "./assets.js";
import { addSign, addBin, addContactShadow, addCardboardBox, localizedTexture } from "./kit.js";
import { FONT, drawSignBoard } from "./artwork.js";
import { makeNeonMaterial } from "./materials.js";
import { PAL, NEON, fitPx, pickMat } from "./room.js";

const TAB_LABELS = {
  communication: { fr: "COMMUNICATION", en: "COMMUNICATION" },
  "graphic-design": { fr: "DESIGN & DA", en: "DESIGN & ART DIR." },
  "audiovisual-music": { fr: "AUDIOVISUEL", en: "AUDIOVISUAL" },
  "web-development": { fr: "WEB & APPS", en: "WEB & APPS" },
  data: { fr: "DATA", en: "DATA" },
  "project-management": { fr: "PROJETS & ÉVÉNEMENTS", en: "PROJECTS & EVENTS" }
};

// One accent per bin: `paint` = lacquer for the bin body, `sign` = hanging-sign background, `text` = lettering on ink plates.
function accentSet(ctx) {
  const m = ctx.materials;
  let sky = null;
  const getSky = () => {
    if (sky) return sky;
    const base = m.lacquerCyan || m.paintedCyan;
    sky = base.clone(); sky.color.set(0x8fcff5); sky.name = "lacquerSky";
    ctx.owned.push(sky);
    return sky;
  };
  return [
    { id: "coral", paint: pickMat(m, "lacquerCoral", "paintedCoral"), sign: PAL.coral, signFg: PAL.ink, text: "#ff7a6c" },
    { id: "violet", paint: pickMat(m, "lacquerViolet", "paintedViolet"), sign: PAL.violet, signFg: PAL.paper, text: "#b7a9ff" },
    { id: "cyan", paint: pickMat(m, "lacquerCyan", "paintedCyan"), sign: PAL.cyan, signFg: PAL.ink, text: "#5fe4f2" },
    { id: "mint", paint: pickMat(m, "lacquerMint", "paintedMint"), sign: PAL.mint, signFg: PAL.ink, text: "#7ff0c4" },
    { id: "sun", paint: pickMat(m, "lacquerSun", "paintedSun"), sign: PAL.sun, signFg: PAL.ink, text: "#ffd25e" },
    { id: "sky", get paint() { return getSky(); }, sign: PAL.sky, signFg: PAL.ink, text: "#b9e4ff" }
  ];
}

const neonOf = (ctx, hex, base = 3) => { const mat = makeNeonMaterial(hex, base); ctx.neonMaterials.push(mat); ctx.owned.push(mat); return mat; };

// ---------------------------------------------------------------------------------------------
// Central gondola: 2 tiers x 3 bins, each bin = 3 columns of records
// ---------------------------------------------------------------------------------------------
export function buildGondola(ctx, projects, categories) {
  const B = ctx.batcher, m = ctx.materials;
  const out = { records: [], bins: [] };
  const { cx, frontZ, rearZ, frontY, rearY, binGap, binDepth } = GONDOLA;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const cream = pickMat(m, "lacquerPaper", "paintedCream");
  const accents = accentSet(ctx);
  const neonCyan = neonOf(ctx, NEON.cyan, 3.2), neonCoral = neonOf(ctx, NEON.coral, 3);
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
      return { cat, cols, width: cols * .37 - .01, accent: accents[categories.indexOf(cat) % accents.length] };
    });
    tier.span = tier.bins.reduce((sum, b) => sum + b.width, 0) + binGap * Math.max(0, tier.bins.length - 1);
    let x = cx - tier.span / 2;
    for (const bin of tier.bins) { bin.x = x + bin.width / 2; x += bin.width + binGap; }
  }
  const span = Math.max(...tierDefs.map((t) => t.span));

  // structure: powder-coated ink frames with cream lacquer tops, a coloured under-glow, stock boxes underneath
  for (const tier of tierDefs) {
    const depth = binDepth + .14;
    const span = tier.span;
    B.box(span + .12, .05, depth, cream, [cx, tier.y - .025, tier.z], [0, 0, 0], { bevel: .01, tile: 1.1 });
    B.box(span + .12, .11, .03, ink, [cx, tier.y - .105, tier.z + depth / 2 - .015], [0, 0, 0], { bevel: .006 });
    B.box(span + .12, .06, .03, ink, [cx, tier.y - .08, tier.z - depth / 2 + .015], [0, 0, 0], { bevel: .006 });
    for (const lx of [-span / 2 + .03, -span / 6, span / 6, span / 2 - .03]) {
      for (const lz of [depth / 2 - .05, -depth / 2 + .05]) B.box(.05, tier.y - .05, .05, m.blackMetal, [cx + lx, (tier.y - .05) / 2, tier.z + lz], [0, 0, 0], { bevel: .006, grain: "y" });
    }
    B.box(span, .025, depth - .08, cream, [cx, .22, tier.z], [0, 0, 0], { bevel: .005 });
    // neon under-glow (front tier cyan, rear tier coral): the "game shelf" light line
    B.add(new THREE.BoxGeometry(span - .1, .014, .014), tier.tier === "front" ? neonCyan : neonCoral, [cx, tier.y - .162, tier.z + depth / 2 - .03], [0, 0, 0], { cast: false, receive: false });
    addContactShadow(ctx, { x: cx, z: tier.z, width: span + .5, depth: depth + .5, opacity: .5 });
  }
  // stock boxes under the front tier
  const rand = rng(99);
  for (let i = 0; i < 5; i++) {
    const w = rand.range(.32, .4);
    const bh = rand.range(.22, .3);
    addCardboardBox(ctx, w, bh, .33, [cx - span / 2 + .35 + i * (span / 5), .236 + bh / 2, frontZ + .02 + rand.range(-.04, .04)], rand.range(-.06, .06), 0);
  }

  const filler = ctx.filler;
  let recordIndex = 0;
  for (const tier of tierDefs) {
    tier.bins.forEach(({ cat, cols: colCount, width: binWidth, x: bx, accent }) => {
      addBin(ctx, { x: bx, y: tier.y, z: tier.z, width: binWidth, depth: binDepth, frontHeight: .095, sideHeight: .26, backHeight: .3, material: accent.paint });
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
      // front plate with the category name (localized): ink plate, lettering in the bin's accent
      const plateTexture = localizedTexture(ctx, (lang) => drawSignBoard((TAB_LABELS[cat.id] || { fr: cat.fr, en: cat.en })[lang] || cat.fr, { width: 1024, height: 128, bg: PAL.ink, fg: accent.text, border: accent.text, font: FONT.display }));
      const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture, roughness: .5, emissive: 0xffffff, emissiveMap: plateTexture, emissiveIntensity: .12 });
      ctx.owned.push(plateMat);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(.7, .0875), plateMat);
      plate.position.set(bx, tier.y + .055, tier.z + binDepth / 2 + .001);
      ctx.scene.add(plate);
      ctx.sticker(4 + (recordIndex % 4), [bx + binWidth / 2 - .1, tier.y + .05, tier.z + binDepth / 2 + .003], [0, 0, 0], .1);
      ctx.sticker(12 + (recordIndex % 4), [bx - binWidth / 2 + .1, tier.y + .05, tier.z + binDepth / 2 + .003], [0, 0, 0], .1);
    });
  }

  // hanging aisle signs: accent panel on two thin rods, one per bin, self-lit so they read in shade
  tierDefs.forEach((tier) => {
    tier.bins.forEach(({ cat, x: bx, accent }) => {
      const y = tier.tier === "front" ? 2.28 : 2.52;
      const z = tier.z + .02;
      addSign(ctx, {
        draw: (lang) => drawSignBoard((cat[lang] || cat.fr).toUpperCase(), { width: 1536, height: 256, bg: accent.sign, fg: accent.signFg, border: accent.signFg, font: FONT.display }),
        width: 1.16, height: .2, position: [bx, y, z], rotationX: .0, emissive: .22
      });
      for (const sx of [-.5, .5]) {
        B.add(new THREE.CylinderGeometry(.004, .004, ROOM.height - y - .06, 6), m.steel, [bx + sx, y + (ROOM.height - y) / 2 - .02, z - .01], [0, 0, 0], { cast: false });
      }
      B.box(1.2, .22, .035, accent.paint, [bx, y, z - .02], [0, 0, 0], { bevel: .008 });
      B.box(1.24, .014, .045, ink, [bx, y - .118, z - .02], [0, 0, 0], { bevel: .004 });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Floor dig bins along the left wall (decorative crates full of records), one accent each
// ---------------------------------------------------------------------------------------------
export function buildDigBins(ctx) {
  const B = ctx.batcher, m = ctx.materials, filler = ctx.filler;
  const accents = accentSet(ctx);
  const x = ROOM.x0 + .42, y = .5;
  const zs = [-2.35, -1.2, -.05, 1.1];
  const order = [accents[4], accents[2], accents[0], accents[3]];
  zs.forEach((z, i) => {
    // low ink trestle + painted crate
    for (const dz of [-.46, .46]) for (const dx of [-.16, .16]) B.box(.045, y, .045, m.blackMetal, [x + dx, y / 2, z + dz], [0, 0, 0], { bevel: .005, grain: "y" });
    B.box(.36, .03, 1.0, m.blackMetal, [x, .14, z], [0, 0, 0], { bevel: .005 });
    addBin(ctx, { x, y, z, width: 1.1, depth: .5, rotY: Math.PI / 2, frontHeight: .1, sideHeight: .26, backHeight: .3, material: order[i].paint });
    const floorY = y + .02;
    for (let col = 0; col < 3; col++) {
      filler.addRow(ctx.scene, { origin: [x + .24, floorY, z + (col - 1) * .36], rotY: Math.PI / 2, count: 34, lean: .15 + (i % 2) * .03, pitch: .0112 });
    }
    // divider tab: paper card, ink lettering (mono-width display)
    const label = ["NEW ARRIVALS", "STAFF PICKS", "ROCK / POP", "ELECTRO / HOUSE"][i];
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(.5, .1), new THREE.MeshStandardMaterial({ map: localizedTexture(ctx, () => drawSignBoard(label, { width: 1024, height: 205, bg: PAL.paper, fg: PAL.ink, border: PAL.ink, font: FONT.display })), roughness: .6 }));
    tab.position.set(x + .22, floorY + .38, z);
    tab.rotation.set(0, Math.PI / 2, 0);
    ctx.scene.add(tab);
    addContactShadow(ctx, { x: x + .02, z, width: .9, depth: 1.5, opacity: .45 });
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
  // left wall grid (hangs on ink rails over the teal field)
  const z0 = -2.85, cols = 11;
  rows.forEach((y, r) => {
    B.box(.02, .02, cols * cell + .06, m.blackMetal, [ROOM.x0 + .03, y + .17, z0 + cols * cell / 2 - cell / 2], [0, 0, 0], { bevel: .004 });
    for (let c = 0; c < cols; c++) {
      const ref = cells[Math.floor(rand() * cells.length)];
      const z = z0 + c * cell;
      const geom = atlasPlane(SLEEVE.size, SLEEVE.size, ref, rand() < .08);
      ctx.batchDecor(geom, [ROOM.x0 + .042, y, z], [0, Math.PI / 2, (rand() - .5) * .012]);
      B.add(new THREE.BoxGeometry(.006, SLEEVE.size, SLEEVE.size), m.paper, [ROOM.x0 + .036, y, z], [0, 0, 0], { receive: true });
    }
    void r;
  });
  // stickers on the grid rail
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
  // two interactive framed prints on the left wall above the sleeve grid: slim ink frames on a paper mat
  const printDefs = [pcells[3], pcells[6]];
  const frameMat = pickMat(m, "lacquerInk", "paintedInk");
  printDefs.forEach((cellDef, i) => {
    const w = .62, h = w * (poster.cellHeight / poster.cellWidth);
    const group = new THREE.Group();
    const z = i === 0 ? -1.9 : -.35;
    group.position.set(ROOM.x0 + .06, 2.62, z);
    group.rotation.y = Math.PI / 2;
    const art = new THREE.Mesh(atlasPlane(w, h, cellDef), new THREE.MeshStandardMaterial({ map: poster.texture, roughness: .55, envMapIntensity: .6 }));
    art.position.z = .018;
    const frame = new THREE.Group();
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + .1, h + .1), m.paper);
    mat.position.z = .0155; frame.add(mat);
    const fw = .035;
    for (const [bw, bh, bx, by] of [[w + .1 + fw * 2, fw, 0, (h + .1) / 2 + fw / 2], [w + .1 + fw * 2, fw, 0, -(h + .1) / 2 - fw / 2], [fw, h + .1, -(w + .1) / 2 - fw / 2, 0], [fw, h + .1, (w + .1) / 2 + fw / 2, 0]]) {
      const bar = new THREE.Mesh(woodBox(bw, bh, .035, { bevel: .006, tile: .5 }), frameMat);
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
// Counter (checkout), staff-picks wall behind it, right-wall shelving
// ---------------------------------------------------------------------------------------------
function counterLogoTexture(ctx) {
  const W = 1024, H = 420;
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = PAL.ink; g.fillRect(0, 0, W, H);
  [[PAL.coral, 0], [PAL.sun, .34], [PAL.cyan, .67]].forEach(([col, f]) => { g.fillStyle = col; g.fillRect(W * f, 0, W * .34, 16); g.fillRect(W * (1 - f - .34), H - 16, W * .34, 16); });
  g.fillStyle = "rgba(255,246,227,.06)";
  for (let x = 20; x < W; x += 34) for (let y = 34; y < H - 30; y += 34) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
  // vinyl glyph
  const vx = 200, vy = H / 2, vr = 138;
  g.fillStyle = "#0b0d1d"; g.beginPath(); g.arc(vx, vy, vr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,246,227,.14)"; g.lineWidth = 2;
  for (let r = vr * .42; r < vr * .96; r += vr * .08) { g.beginPath(); g.arc(vx, vy, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = PAL.paper; g.lineWidth = 5; g.beginPath(); g.arc(vx, vy, vr, 0, Math.PI * 2); g.stroke();
  g.fillStyle = PAL.coral; g.beginPath(); g.arc(vx, vy, vr * .34, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.paper; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 ${Math.round(vr * .36)}px ${FONT.display}`; g.fillText("A", vx, vy + 3);
  // wordmark
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  const px = fitPx(g, "SIDE A", FONT.display, 900, 560, 180);
  g.fillStyle = PAL.coral; g.fillText("SIDE A", 396 + px * .04, 222 + px * .04);
  g.fillStyle = PAL.paper; g.fillText("SIDE A", 396, 222);
  g.font = `700 30px ${FONT.mono}`; g.fillStyle = PAL.cyan; g.fillText("PROJECTS STORE", 400, 282);
  g.fillStyle = PAL.sun; g.fillText("33 1/3 RPM · OPEN 7/7", 400, 330);
  return textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
}

export function buildCounter(ctx) {
  const B = ctx.batcher, m = ctx.materials;
  const { x, z, width, depth, height } = COUNTER;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const coral = pickMat(m, "lacquerCoral", "paintedCoral");
  const cream = pickMat(m, "lacquerPaper", "paintedCream");
  // ink body with coral slat wings and the "SIDE A" logo plate on the front
  B.box(width, height - .06, depth, ink, [x, (height - .06) / 2, z], [0, 0, 0], { bevel: .012, tile: 1.2 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      B.box(.1, height * .72, .014, coral, [x + side * (width / 2 - .1 - i * .13), height * .46, z + depth / 2 + .006], [0, 0, 0], { bevel: .005, tile: .6 });
    }
  }
  const logoMat = new THREE.MeshStandardMaterial({ map: counterLogoTexture(ctx), roughness: .5, emissive: 0xffffff, emissiveIntensity: .08 });
  logoMat.emissiveMap = logoMat.map;
  ctx.owned.push(logoMat);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .492), logoMat);
  logo.position.set(x, height * .46, z + depth / 2 + .0135);
  ctx.scene.add(logo);
  // cream lacquer top with a crisp ink lip, kick plate
  B.box(width + .06, .05, depth + .06, cream, [x, height - .025, z], [0, 0, 0], { bevel: .014, tile: 1.4 });
  B.box(width + .02, .012, depth + .1, ink, [x, height - .058, z + .01], [0, 0, 0], { bevel: .004 });
  B.box(width, .08, depth + .02, m.blackMetal, [x, .04, z], [0, 0, 0], { bevel: .01 });
  addContactShadow(ctx, { x, z: z + .15, width: width + .6, depth: depth + .9, opacity: .5 });
  // card / tray riser on the left end of the counter
  B.box(.7, .05, .44, pickMat(m, "lacquerInk", "paintedInk"), [x - width / 2 + .45, height + .025, z + depth / 2 - .26], [0, 0, 0], { bevel: .006 });

  // STAFF-PICKS WALL behind the counter: hollow ink cube shelves with facing sleeves, plants and toys (replaces the old solid block)
  const ux1 = ROOM.x1 - .02, ux0 = x - width / 2 - .05;
  const uw = ux1 - ux0, ucx = (ux0 + ux1) / 2, uz = ROOM.zBack + .26, ud = .44, uh = 2.0;
  const shelfY = [.12, .6, 1.08, 1.56];
  B.box(uw, .06, ud, ink, [ucx, uh - .03, uz], [0, 0, 0], { bevel: .008 });
  B.box(uw, .02, .02, ink, [ucx, uh - .07, uz + ud / 2 - .01], [0, 0, 0], { bevel: .004 });
  B.box(uw - .1, uh - .08, .03, pickMat(m, "paintedCream", "painted"), [ucx, (uh - .08) / 2 + .04, uz - ud / 2 + .02], [0, 0, 0], { bevel: .004 });
  const colsN = 4, pitch = uw / colsN;
  for (let i = 0; i <= colsN; i++) B.box(.035, uh, ud, ink, [ux0 + i * pitch + (i === colsN ? -.0175 : i === 0 ? .0175 : 0), uh / 2, uz], [0, 0, 0], { bevel: .006 });
  shelfY.forEach((sy) => B.box(uw, .035, ud, ink, [ucx, sy, uz], [0, 0, 0], { bevel: .006 }));
  // base cabinet doors (coral / cream alternate) under the first shelf
  for (let i = 0; i < colsN; i++) B.box(pitch - .09, .42, .012, i % 2 ? cream : coral, [ux0 + (i + .5) * pitch, .36, uz + ud / 2 + .004], [0, 0, 0], { bevel: .004 });
  // facing sleeves: three levels x four cubbies (the sleeve art is the decor atlas); a few cubbies hold props instead
  const rr = rng(52), cells = ctx.assets.decor.cells;
  const leafFlat = new THREE.MeshStandardMaterial({ color: 0x35d99d, roughness: .55, flatShading: true });
  ctx.owned.push(leafFlat);
  const propAt = { "3-0": "plant", "2-1": "stack", "3-3": "plant", "2-3": "stack", "1-2": "stack" };
  const potMats = [pickMat(m, "plasticCoral", "paintedCoral"), pickMat(m, "plasticSun", "paintedSun"), ink];
  const stackMats = [pickMat(m, "lacquerCoral", "paintedCoral"), pickMat(m, "lacquerCyan", "paintedCyan"), pickMat(m, "lacquerSun", "paintedSun"), pickMat(m, "lacquerViolet", "paintedViolet")];
  for (let lvl = 1; lvl < shelfY.length; lvl++) {
    for (let i = 0; i < colsN; i++) {
      const cxCub = ux0 + (i + .5) * pitch;
      const prop = propAt[`${lvl}-${i}`];
      const top = shelfY[lvl] + .0175;
      if (prop === "plant") {
        B.add(new THREE.CylinderGeometry(.06, .045, .1, 18), potMats[(lvl + i) % potMats.length], [cxCub, top + .05, uz + ud / 2 - .13]);
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * Math.PI * 2, tall = .2 + (k % 3) * .06;
          B.add(new THREE.ConeGeometry(.03, tall, 5), leafFlat, [cxCub + Math.cos(a) * .035, top + .1 + tall / 2 - .02, uz + ud / 2 - .13 + Math.sin(a) * .035], [Math.sin(a) * .35, 0, -Math.cos(a) * .35], { cast: false });
        }
        continue;
      }
      if (prop === "stack") {
        for (let k = 0; k < 4; k++) B.box(.31 - k * .006, .014, .31, stackMats[(lvl + i + k) % stackMats.length], [cxCub + (k % 2 ? .006 : -.006), top + .007 + k * .0155, uz + ud / 2 - .2], [0, (k - 1.5) * .05, 0], { bevel: .003, cast: false });
        continue;
      }
      const n = rr() < .5 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const ref = cells[Math.floor(rr() * cells.length)];
        const sz = SLEEVE.size * (.92 + rr() * .08);
        const px = cxCub + (n === 2 ? (k - .5) * .21 : (rr() - .5) * .12);
        ctx.batchDecor(atlasPlane(sz, sz, ref), [px, top + sz / 2 * Math.cos(.12), uz + ud / 2 - .09 - k * .004], [-.12, (rr() - .5) * .08, (rr() - .5) * .04], { cast: false });
        B.add(new THREE.BoxGeometry(sz + .008, .004, .03), ink, [px, top + .004, uz + ud / 2 - .085], [0, 0, 0], { cast: false });
      }
    }
  }
  addContactShadow(ctx, { x: ucx, z: uz + .3, width: uw + .3, depth: .8, opacity: .35 });
  return { counterTop: height };
}

// Right wall CD / cassette shelving: ink frame, cream shelves, day-palette spines, cyan under-shelf glow on two levels
export function buildShelving(ctx) {
  const B = ctx.batcher, m = ctx.materials;
  const rand = rng(61);
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  const cream = pickMat(m, "lacquerPaper", "paintedCream");
  const neonCyan = neonOf(ctx, NEON.cyan, 3);
  const x = ROOM.x1 - .15;
  const zMin = -2.95, zMax = -.35;
  const unitDepth = .3;
  // back panel (ink so every spine pops), shelves, uprights
  B.box(.04, 2.35, zMax - zMin, ink, [ROOM.x1 - .03, 1.2, (zMin + zMax) / 2], [0, 0, 0], { bevel: .004 });
  for (let i = 0; i <= 6; i++) B.box(unitDepth, .025, zMax - zMin, cream, [x, .35 + i * .34, (zMin + zMax) / 2], [0, 0, 0], { bevel: .004, grain: "z" });
  for (const z of [zMin, (zMin + zMax) / 2, zMax]) B.box(unitDepth, 2.4, .035, ink, [x, 1.2, z], [0, 0, 0], { bevel: .004, grain: "y" });
  B.box(unitDepth, .035, zMax - zMin + .035, ink, [x, 2.42, (zMin + zMax) / 2], [0, 0, 0], { bevel: .004 });
  for (const i of [3, 6]) B.add(new THREE.BoxGeometry(.012, .012, zMax - zMin - .1), neonCyan, [x - unitDepth / 2 + .02, .35 + i * .34 - .02, (zMin + zMax) / 2], [0, 0, 0], { cast: false, receive: false });
  const palette = [PAL.coral, PAL.sun, PAL.cyan, PAL.violet, PAL.mint, PAL.paper, PAL.sky, "#ff9f2e", PAL.teal, "#e8dcc0", "#ff7aa8", PAL.ink];
  // CD spines (jewel cases) on the upper shelves, cassettes on the lower. Cases are thin along z (the shelf
  // direction) and deep along x, standing spine-out towards the room (-x). Heights, depths and the odd
  // leaning case vary, and most spines carry a pale label strip.
  const cdGeo = new THREE.BoxGeometry(.142, .125, .011);
  const tapeGeo = new THREE.BoxGeometry(.068, .1, .016);
  const labelGeo = new THREE.BoxGeometry(.0012, .05, .0088);
  const mats = palette.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .0, envMapIntensity: .8 }));
  const labelMats = [PAL.paper, "#ffffff", PAL.sun].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, envMapIntensity: .5 }));
  ctx.owned.push(...mats, ...labelMats);
  for (let shelf = 0; shelf < 6; shelf++) {
    const y = .35 + shelf * .34 + .0125;
    const cassette = shelf < 2;
    let z = zMin + .05;
    while (z < zMax - .04) {
      if (rand() < .015) { z += .035 + rand() * .06; continue; } // a gap where a disc is out being played
      const w = cassette ? .016 : .011;
      const mat = mats[Math.floor(rand() * mats.length)];
      const h = (cassette ? .1 : .125) * (.94 + rand() * .06);
      const depth = cassette ? .068 : .142;
      const lean = rand() < .03 ? rand.range(-.18, .18) : 0;
      const front = x - .035; // spine face sits near the shelf's front edge
      const sx = 1, sy = h / (cassette ? .1 : .125);
      B.add(cassette ? tapeGeo : cdGeo, mat, [front, y + h / 2, z], [0, 0, lean * .35], { cast: false, scale: [sx, sy, 1] });
      if (!cassette && rand() < .72) B.add(labelGeo, labelMats[Math.floor(rand() * labelMats.length)], [front - depth / 2 - .0004, y + h * .62, z], [0, 0, lean * .35], { cast: false, scale: [1, sy, 1] });
      z += w + .0006;
    }
  }
  return { zMin, zMax };
}

// Window display (left window): sun + violet risers, a stage of featured sleeves facing BOTH the shop and the street
export function buildWindowDisplay(ctx, assets) {
  const B = ctx.batcher, m = ctx.materials;
  const cx = (FRONT.windowA.x0 + FRONT.windowA.x1) / 2;
  const y = FRONT.sill + .05;
  const ink = pickMat(m, "paintedInk", "paintedGreen");
  B.box(2.7, .22, .5, pickMat(m, "lacquerViolet", "paintedViolet"), [cx, y + .11, ROOM.zFront - .3], [0, 0, 0], { bevel: .01 });
  B.box(2.0, .22, .4, pickMat(m, "lacquerSun", "paintedSun"), [cx, y + .33, ROOM.zFront - .35], [0, 0, 0], { bevel: .01 });
  B.box(2.74, .03, .54, ink, [cx, y + .005, ROOM.zFront - .3], [0, 0, 0], { bevel: .004 });
  for (let i = 0; i < 7; i++) {
    const ref = assets.decor.cells[(i * 3) % assets.decor.cells.length];
    const px = cx - 1.2 + i * .4;
    const g = atlasPlane(SLEEVE.size * .8, SLEEVE.size * .8, ref);
    const tilt = i % 2 ? -.12 : -.16;
    // facing the shop (visitor side) and facing the street (seen from the entrance dolly)
    ctx.batchDecor(g, [px, y + .22 + .13, ROOM.zFront - .12], [tilt, Math.PI, 0]);
    ctx.batchDecor(g, [px, y + .22 + .13, ROOM.zFront - .12 + .012], [-tilt, 0, 0]);
    B.box(.3, .012, .035, ink, [px, y + .222, ROOM.zFront - .17], [0, 0, 0], { bevel: .003, cast: false });
  }
  // window decals (stickers) on the glass, readable from both sides
  const sc = (idx, px, py, s) => { ctx.sticker(idx, [px, py, ROOM.zFront + .098], [0, Math.PI, 0], s); ctx.sticker(idx, [px, py, ROOM.zFront + .102], [0, 0, 0], s); };
  sc(2, cx - 1.2, 1.2, .26); sc(6, cx + 1.15, 1.95, .22); sc(9, cx - .15, 2.05, .2);
}
