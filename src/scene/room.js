// Room shell: floor (with baked ambient occlusion), walls with painted wainscot, drop ceiling with
// troffers, storefront with windows and animated double doors, exterior facade and street backdrop.
import * as THREE from "three";
import { ROOM, FRONT, FOOTPRINTS } from "./layout.js";
import { createCanvas, textureFrom, rng, applyBoxUV, woodBox, composeMatrix } from "./util.js";
import { drawSignBoard, FONT } from "./artwork.js";
import { atlasPlane } from "./assets.js";

function bakeFloorAO(quality) {
  const cw = quality.id === "low" ? 256 : 512;
  const ch = Math.round(cw * ROOM.depth / ROOM.width);
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
  const X = (x) => ((x - ROOM.x0) / ROOM.width) * cw;
  const Z = (z) => ((z - ROOM.zBack) / ROOM.depth) * ch;
  // wall edges
  const edge = (x0, y0, x1, y1, gx, gy, size) => {
    const g = ctx.createLinearGradient(gx, gy, gx + (x1 - x0 ? 0 : size), gy + (y1 - y0 ? 0 : size));
    return g;
  };
  void edge;
  const edgeSize = cw * .09;
  let g = ctx.createLinearGradient(0, 0, edgeSize, 0); g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, edgeSize, ch);
  g = ctx.createLinearGradient(cw, 0, cw - edgeSize, 0); g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(cw - edgeSize, 0, edgeSize, ch);
  g = ctx.createLinearGradient(0, 0, 0, edgeSize); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, edgeSize);
  g = ctx.createLinearGradient(0, ch, 0, ch - edgeSize); g.addColorStop(0, "rgba(0,0,0,.4)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, ch - edgeSize, cw, edgeSize);
  // furniture contact shadows (offset trick: shadowBlur works everywhere, unlike ctx.filter)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.85)";
  ctx.shadowBlur = cw * .028;
  ctx.shadowOffsetX = cw * 4;
  ctx.fillStyle = "#000";
  for (const [x0, z0, x1, z1] of FOOTPRINTS) ctx.fillRect(X(x0) - cw * 4, Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  ctx.restore();
  return textureFrom(canvas, { srgb: false, repeat: false, channel: 1, anisotropy: 2 });
}

function skyTexture() {
  const canvas = createCanvas(4, 256);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#7fb2d6"); g.addColorStop(.55, "#bcd6e2"); g.addColorStop(.8, "#f3e8cd"); g.addColorStop(1, "#f6dcae");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  return textureFrom(canvas, { srgb: true, repeat: false });
}

function windowGridTexture(seed, base, cols, rows) {
  const rand = rng(seed);
  const canvas = createCanvas(256, 512);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 512);
  const cw = 256 / cols, rh = 512 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    ctx.fillStyle = rand() < .25 ? "#e9d7a2" : "#46545c";
    ctx.fillRect(x * cw + cw * .18, y * rh + rh * .16, cw * .64, rh * .56);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x * cw + cw * .18, y * rh + rh * .72, cw * .64, rh * .08);
  }
  return textureFrom(canvas, { srgb: true, repeat: true });
}

export function buildRoom(ctx) {
  const { scene, batcher: B, materials: m, assets, quality } = ctx;
  const out = { updaters: [], texturesToDispose: [] };
  const H = ROOM.height;
  const zF = ROOM.zFront;

  // ---------------------------------------------------------------- floor
  const floorGeo = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  floorGeo.setAttribute("uv1", floorGeo.attributes.uv.clone());
  const rx = ROOM.width / 2.4, rz = ROOM.depth / 2.4;
  for (const t of [m.floor.map, m.floor.normalMap, m.floor.roughnessMap]) t.repeat.set(rx, rz);
  const ao = bakeFloorAO(quality);
  m.floor.aoMap = ao;
  m.floor.aoMapIntensity = 1;
  const floor = new THREE.Mesh(floorGeo, m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM.cx, 0, ROOM.cz);
  floor.receiveShadow = true;
  scene.add(floor);
  out.floor = floor;

  // ---------------------------------------------------------------- walls
  const wallT = .22;
  B.add(applyBoxUV(new THREE.BoxGeometry(wallT, H, ROOM.depth + .5), 1.6), m.wall, [ROOM.x0 - wallT / 2, H / 2, ROOM.cz], [0, 0, 0], { cast: true });
  B.add(applyBoxUV(new THREE.BoxGeometry(wallT, H, ROOM.depth + .5), 1.6), m.wall, [ROOM.x1 + wallT / 2, H / 2, ROOM.cz], [0, 0, 0], { cast: true });
  B.add(applyBoxUV(new THREE.BoxGeometry(ROOM.width + .6, H, wallT), 1.6), m.wall, [ROOM.cx, H / 2, ROOM.zBack - wallT / 2], [0, 0, 0], { cast: true });

  // painted wainscot (teal) with a wooden chair rail, baseboards
  const wain = 1.08;
  const lengthZ = ROOM.depth;
  B.add(applyBoxUV(new THREE.BoxGeometry(.02, wain, lengthZ), 1.6), m.wallTeal, [ROOM.x0 + .01, wain / 2, ROOM.cz]);
  B.add(applyBoxUV(new THREE.BoxGeometry(.02, wain, lengthZ), 1.6), m.wallTeal, [ROOM.x1 - .01, wain / 2, ROOM.cz]);
  B.add(applyBoxUV(new THREE.BoxGeometry(ROOM.width, wain, .02), 1.6), m.wallTeal, [ROOM.cx, wain / 2, ROOM.zBack + .01]);
  for (const x of [ROOM.x0 + .03, ROOM.x1 - .03]) {
    B.box(.06, .06, lengthZ, m.oak, [x, wain + .03, ROOM.cz], [0, 0, 0], { bevel: .012, tile: .9 });
    B.box(.035, .14, lengthZ, m.oak, [x < 0 ? ROOM.x0 + .0175 : ROOM.x1 - .0175, .07, ROOM.cz], [0, 0, 0], { bevel: .006 });
  }
  B.box(ROOM.width, .06, .06, m.oak, [ROOM.cx, wain + .03, ROOM.zBack + .03], [0, 0, 0], { bevel: .012 });
  B.box(ROOM.width, .14, .035, m.oak, [ROOM.cx, .07, ROOM.zBack + .0175], [0, 0, 0], { bevel: .006 });
  // crown moulding
  for (const x of [ROOM.x0 + .03, ROOM.x1 - .03]) B.box(.06, .08, lengthZ, m.paintedCream, [x, H - .04, ROOM.cz], [0, 0, 0], { bevel: .01 });
  B.box(ROOM.width, .08, .06, m.paintedCream, [ROOM.cx, H - .04, ROOM.zBack + .03], [0, 0, 0], { bevel: .01 });

  // ---------------------------------------------------------------- front wall with openings
  const T = .3;
  const zc = zF + T / 2;
  const pillar = (x0, x1) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, H, T), 1.6), m.wall, [(x0 + x1) / 2, H / 2, zc]);
  pillar(ROOM.x0 - .3, FRONT.windowA.x0);
  pillar(FRONT.windowA.x1, FRONT.door.x0);
  pillar(FRONT.door.x1, FRONT.windowB.x0);
  pillar(FRONT.windowB.x1, ROOM.x1 + .3);
  const bulk = (x0, x1) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, FRONT.sill, T), 1.6), m.paintedGreen, [(x0 + x1) / 2, FRONT.sill / 2, zc]);
  bulk(FRONT.windowA.x0, FRONT.windowA.x1);
  bulk(FRONT.windowB.x0, FRONT.windowB.x1);
  const header = (x0, x1, y0) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, H - y0, T), 1.6), m.wall, [(x0 + x1) / 2, y0 + (H - y0) / 2, zc]);
  header(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.lintel);
  header(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.lintel);
  header(FRONT.door.x0, FRONT.door.x1, FRONT.lintel);

  // window and door frames (painted dark green), mullions, transom bars
  const frame = m.paintedGreen;
  const fz = zF - .02;
  const addFrame = (x0, x1, y0, y1, mullions = []) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    B.box(w, .07, .12, frame, [cx, y1 - .035, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(w, .07, .12, frame, [cx, y0 + .035, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(.07, h, .12, frame, [x0 + .035, cy, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(.07, h, .12, frame, [x1 - .035, cy, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    for (const mx of mullions) B.box(.05, h, .09, frame, [mx, cy, fz], [0, 0, 0], { bevel: .006, tile: .5 });
  };
  addFrame(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.sill, FRONT.lintel, [-2.15, -1.65]);
  addFrame(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.sill, FRONT.lintel, [2.55]);
  B.box(FRONT.windowA.x1 - FRONT.windowA.x0, .05, .09, frame, [(FRONT.windowA.x0 + FRONT.windowA.x1) / 2, 2.35, fz], [0, 0, 0], { bevel: .006 });
  B.box(FRONT.windowB.x1 - FRONT.windowB.x0, .05, .09, frame, [(FRONT.windowB.x0 + FRONT.windowB.x1) / 2, 2.35, fz], [0, 0, 0], { bevel: .006 });
  // door frame + transom
  const dcx = (FRONT.door.x0 + FRONT.door.x1) / 2;
  B.box(FRONT.door.x1 - FRONT.door.x0, .08, .14, frame, [dcx, FRONT.doorTop + .04, fz], [0, 0, 0], { bevel: .008 });
  B.box(.08, FRONT.doorTop, .14, frame, [FRONT.door.x0 + .04, FRONT.doorTop / 2, fz], [0, 0, 0], { bevel: .008 });
  B.box(.08, FRONT.doorTop, .14, frame, [FRONT.door.x1 - .04, FRONT.doorTop / 2, fz], [0, 0, 0], { bevel: .008 });
  B.box(FRONT.door.x1 - FRONT.door.x0, .06, .1, frame, [dcx, FRONT.lintel - .03, fz], [0, 0, 0], { bevel: .006 });
  // sill boards (interior)
  B.box(FRONT.windowA.x1 - FRONT.windowA.x0 + .2, .05, .3, m.oak, [(FRONT.windowA.x0 + FRONT.windowA.x1) / 2, FRONT.sill + .025, zF - .08], [0, 0, 0], { bevel: .01 });
  B.box(FRONT.windowB.x1 - FRONT.windowB.x0 + .2, .05, .3, m.oak, [(FRONT.windowB.x0 + FRONT.windowB.x1) / 2, FRONT.sill + .025, zF - .08], [0, 0, 0], { bevel: .01 });

  // glass (double-sided, never casts shadows so the sun reaches the floor)
  const glassGroup = new THREE.Group();
  const glassPane = (x0, x1, y0, y1) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), m.glass);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, zF + .1);
    mesh.renderOrder = 3;
    glassGroup.add(mesh);
  };
  glassPane(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.sill, FRONT.lintel);
  glassPane(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.sill, FRONT.lintel);
  glassPane(FRONT.door.x0, FRONT.door.x1, FRONT.doorTop + .08, FRONT.lintel - .06);
  scene.add(glassGroup);

  // ---------------------------------------------------------------- doors (animated)
  const doorLeaves = [];
  const mkLeaf = (hingeX, dir) => {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0, zF + .02);
    const width = (FRONT.door.x1 - FRONT.door.x0) / 2 - .04;
    const leaf = new THREE.Group();
    const h = FRONT.doorTop - .06;
    const stile = (x, w) => { const mesh = new THREE.Mesh(woodBox(w, h, .05, { bevel: .008, tile: .5 }), frame); mesh.position.set(dir * x, h / 2 + .03, 0); mesh.castShadow = true; leaf.add(mesh); };
    stile(.045, .09); stile(width - .045, .09);
    for (const y of [.12, h - .06]) { const rail = new THREE.Mesh(woodBox(width, y === .12 ? .2 : .12, .05, { bevel: .008, tile: .5 }), frame); rail.position.set(dir * width / 2, y + .03, 0); rail.castShadow = true; leaf.add(rail); }
    const mid = new THREE.Mesh(woodBox(width, .06, .05, { bevel: .006, tile: .5 }), frame); mid.position.set(dir * width / 2, h * .46, 0); leaf.add(mid);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - .12, h - .5), m.glass);
    glass.position.set(dir * width / 2, h * .53, 0); glass.renderOrder = 3; leaf.add(glass);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .5, 10), m.brass);
    bar.position.set(dir * (width - .1), 1.05, .05); bar.castShadow = true; leaf.add(bar);
    pivot.add(leaf);
    scene.add(pivot);
    doorLeaves.push({ pivot, dir });
    return pivot;
  };
  mkLeaf(FRONT.door.x0 + .02, 1);
  mkLeaf(FRONT.door.x1 - .02, -1);
  // OPEN/CLOSED card hanging on the door (turns when the shop opens)
  const signPivot = new THREE.Group();
  signPivot.position.set(dcx - .22, 1.62, zF - .05);
  const mkFace = (label, bg, fg, flip) => {
    const c = createCanvas(512, 300); const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 512, 300);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(14, 14, 484, 272);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `400 128px ${FONT.display}`; g.fillText(label[0], 256, 118);
    g.font = `500 40px ${FONT.sans}`; g.fillText(label[1], 256, 226);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.26, .152), new THREE.MeshStandardMaterial({ map: textureFrom(c, { srgb: true, repeat: false }), roughness: .5 }));
    mesh.rotation.y = flip ? 0 : Math.PI;
    mesh.position.z = flip ? .002 : -.002;
    mesh.castShadow = false;
    return mesh;
  };
  // Face toward the street (+z) first: CLOSED. Face toward the shop (-z): OPEN.
  signPivot.add(mkFace(["FERMÉ", "CLOSED"], "#b3342b", "#f4e9d3", true), mkFace(["OUVERT", "OPEN"], "#2f7d4f", "#f4e9d3", false));
  const string = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .12, 4), m.steel);
  string.position.y = .13; signPivot.add(string);
  scene.add(signPivot);

  // ---------------------------------------------------------------- ceiling
  const ceilGeo = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  const cx = ROOM.width / 1.2, cz = ROOM.depth / 1.2;
  for (const t of [m.ceilingTile.map, m.ceilingTile.normalMap, m.ceilingTile.roughnessMap]) t.repeat.set(cx, cz);
  const ceiling = new THREE.Mesh(ceilGeo, m.ceilingTile);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(ROOM.cx, H, ROOM.cz);
  ceiling.receiveShadow = false;
  scene.add(ceiling);
  // troffers (emissive fluorescent panels)
  for (const z of [-4.2, -1.6, .9, 3.3]) {
    for (const x of [-1.6, 1.6]) {
      B.box(1.25, .02, .32, m.steel, [x, H - .012, z], [0, 0, 0], { bevel: .004, cast: false, receive: false });
      B.add(new THREE.BoxGeometry(1.1, .005, .18), m.tube, [x, H - .026, z], [0, 0, 0], { cast: false, receive: false });
    }
  }
  // ceiling collage of sleeves above the back-left corner (reference: sleeve-covered ceiling)
  if (assets?.decor) {
    const rand = rng(77);
    const cols = 9, rows = 6, cell = .34;
    const ox = -2.75, oz = -5.15;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cellRef = assets.decor.cells[Math.floor(rand() * assets.decor.cells.length)];
      const g = atlasPlane(cell - .012, cell - .012, cellRef, rand() < .12);
      ctx.batchDecor(g, [ox + c * cell, H - .006, oz + r * cell], [Math.PI / 2, 0, (rand() - .5) * .03], { cast: false });
    }
  }

  // ---------------------------------------------------------------- exterior: facade, pavement, street
  const exterior = new THREE.Group();
  const facade = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry(ROOM.width + 1.2, 1.3, .24), 1.6), m.paintedGreen);
  facade.position.set(ROOM.cx, H + .62, zF + .12); facade.castShadow = true; facade.receiveShadow = true; exterior.add(facade);
  const signTex = textureFrom(drawSignBoard("SIDE A RECORDS", { width: 2048, height: 380, bg: "#24332d", fg: "#e9cf8b", border: "#c9b07a", sub: "DISQUAIRE INDÉPENDANT · NEW & USED VINYL · SINCE 1991" }), { srgb: true, repeat: false });
  const fascia = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.0), new THREE.MeshStandardMaterial({ map: signTex, roughness: .55 }));
  fascia.position.set(ROOM.cx, H + .62, zF + .245); exterior.add(fascia);
  // exterior lower panels & kick plates
  for (const [x0, x1] of [[FRONT.windowA.x0, FRONT.windowA.x1], [FRONT.windowB.x0, FRONT.windowB.x1]]) {
    const panel = new THREE.Mesh(woodBox(x1 - x0 - .1, FRONT.sill - .15, .05, { bevel: .015, tile: .8 }), m.paintedGreen);
    panel.position.set((x0 + x1) / 2, FRONT.sill / 2, zF + .32); panel.castShadow = true; exterior.add(panel);
  }
  // pavement + curb + road
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.2), m.pavement);
  for (const t of [m.pavement.map, m.pavement.normalMap, m.pavement.roughnessMap]) t.repeat.set(40 / 1.2, 3.2 / 1.2);
  pave.rotation.x = -Math.PI / 2; pave.position.set(0, .001, zF + 1.9); pave.receiveShadow = true; exterior.add(pave);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ color: 0x3d3d3c, roughness: .9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -.12, zF + 12.6); exterior.add(road);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(40, .14, .22), new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: .9 }));
  curb.position.set(0, -.02, zF + 3.6); exterior.add(curb);
  // opposite buildings, washed out by daylight
  const rand = rng(5);
  const palette = ["#d8c6a4", "#b9a58a", "#c9b79c", "#a6988a", "#d1bfa2"];
  let bx = -26;
  while (bx < 26) {
    const w = rand.range(5, 9), h = rand.range(9, 15);
    const tex = windowGridTexture(Math.floor(rand() * 999), palette[Math.floor(rand() * palette.length)], Math.round(w / 1.6), Math.round(h / 3));
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.45, 1.35), fog: false }));
    b.position.set(bx + w / 2, h / 2, zF + 23);
    exterior.add(b);
    bx += w + .15;
    out.texturesToDispose.push(tex);
  }
  // parked car, lamp post and tree on the street (seen through the windows)
  const carMat = new THREE.MeshStandardMaterial({ color: 0x2f7a78, roughness: .35, metalness: .3, envMapIntensity: 1.2 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: .5 });
  const darkGlass = new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: .1, metalness: .6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 });
  const car = new THREE.Group();
  car.position.set(-1.7, 0, zF + 5.6);
  car.rotation.y = .04;
  const add = (geo, mat, pos, rot) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; car.add(mesh); return mesh; };
  add(woodBox(4.2, .62, 1.7, { bevel: .2, tile: 2 }), carMat, [0, .58, 0]);
  add(woodBox(2.3, .55, 1.55, { bevel: .18, tile: 2 }), carMat, [-.1, 1.08, 0]);
  add(woodBox(2.1, .4, 1.58, { bevel: .1, tile: 2 }), darkGlass, [-.1, 1.1, 0]);
  add(woodBox(4.22, .06, 1.72, { bevel: .02, tile: 2 }), creamMat, [0, .45, 0]);
  for (const x of [-1.4, 1.4]) for (const z of [-.85, .85]) add(new THREE.CylinderGeometry(.33, .33, .22, 24), tireMat, [x, .33, z], [Math.PI / 2, 0, 0]);
  for (const z of [-.6, .6]) add(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .92, .7).multiplyScalar(2.5) }), [2.1, .66, z]);
  exterior.add(car);
  const post = new THREE.Group();
  post.position.set(3.4, 0, zF + 3.3);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: .5, metalness: .6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 4.2, 10), iron); pole.position.y = 2.1; pole.castShadow = true; post.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .9, .65).multiplyScalar(2) })); lamp.position.y = 4.35; post.add(lamp);
  exterior.add(post);
  const tree = new THREE.Group();
  tree.position.set(-5.2, 0, zF + 4.6);
  tree.scale.setScalar(.7);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 })); trunk.position.y = 1.3; trunk.castShadow = true; tree.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8a4a, roughness: .9 });
  for (let i = 0; i < 6; i++) { const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(.9 + (i % 3) * .2, 1), leafMat); blob.position.set(Math.sin(i * 1.9) * .8, 3 + (i % 3) * .4, Math.cos(i * 2.3) * .8); blob.castShadow = true; tree.add(blob); }
  exterior.add(tree);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  sky.renderOrder = -10;
  sky.position.set(0, 0, 0);
  scene.add(sky);
  exterior.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  scene.add(exterior);

  // ---------------------------------------------------------------- door/sign animation hook
  let progress = 0, target = 0, signFlip = 0, signTarget = 0;
  out.openDoors = () => { target = 1; signTarget = 1; };
  out.closeDoors = () => { target = 0; signTarget = 0; };
  out.snapDoors = (open) => { progress = target = open ? 1 : 0; signFlip = signTarget = open ? 1 : 0; apply(); };
  out.doorProgress = () => progress;
  const apply = () => {
    const ease = progress * progress * (3 - 2 * progress);
    for (const leaf of doorLeaves) leaf.pivot.rotation.y = leaf.dir * ease * 1.45;
    signPivot.rotation.y = signFlip * Math.PI;
  };
  out.updaters.push((dt) => {
    const k = 1 - Math.exp(-2.6 * dt);
    progress += (target - progress) * k;
    signFlip += (signTarget - signFlip) * (1 - Math.exp(-5 * dt));
    apply();
  });
  out.signPivot = signPivot;
  out.glassGroup = glassGroup;
  out.sky = sky;
  out.exterior = exterior;
  void composeMatrix;
  return out;
}
