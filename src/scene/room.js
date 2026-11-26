// Room shell, art direction v2 ("Midnight Video, but by day"): bold colour-blocked walls painted as ONE mural per wall
// (ink wainscot + coral/sun/cyan belt, teal / coral / violet / ink zones, a sun halo behind the neon sign), a crisp
// graphic floor with a vinyl-disc inlay, a modern shop-front (ink frames, coral doors, striped awnings, neon trim),
// and a stylised daylight street (flat-colour towers, cel clouds, a coral hatchback).
// The layout contract (src/scene/layout.js) is untouched: only the rendering language changed.
import * as THREE from "three";
import { ROOM, FRONT, FOOTPRINTS } from "./layout.js";
import { createCanvas, textureFrom, rng, applyBoxUV, woodBox } from "./util.js";
import { drawSignBoard, FONT } from "./artwork.js";
import { atlasPlane } from "./assets.js";
import { makeNeonMaterial } from "./materials.js";

// ---------------------------------------------------------------------------------------------
// shared set-dressing tokens (albedo-side colours of the day palette) and helpers, re-used by furniture / props / details
// ---------------------------------------------------------------------------------------------
export const PAL = Object.freeze({
  ink: "#1b2145", ink0: "#12162b", paper: "#fff6e3", cream: "#f0e4c9", teal: "#14a6b3", coral: "#f0584a", sun: "#f5b92f",
  cyan: "#17c4d6", violet: "#6a50f0", mint: "#35d99d", sky: "#9ed8ff"
});
// saturated UI-token hexes for emissives (neon keeps its glow in daylight)
export const NEON = Object.freeze({ coral: 0xff5b4a, cyan: 0x19d5e8, sun: 0xffc83d, violet: 0x6b4dff, mint: 0x3ee6a8, paper: 0xfff6e3 });

// Largest pixel size <= startPx at which `text` fits `maxW` (wide display faces overflow small boards otherwise).
export function fitPx(g, text, family, weight, maxW, startPx, minPx = 10) {
  let px = startPx;
  for (; px > minPx; px -= 2) { g.font = `${weight} ${px}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  g.font = `${weight} ${px}px ${family}`;
  return px;
}

// Fallback-safe material lookup (the material library is shared with other agents).
export const pickMat = (m, ...keys) => { for (const k of keys) if (m[k]) return m[k]; return m.painted || m.wall; };

// ---------------------------------------------------------------------------------------------
// floor ambient occlusion (kept from v1, lighter: the v2 floor is bright and clean)
// ---------------------------------------------------------------------------------------------
function bakeFloorAO(quality) {
  const cw = quality.id === "low" ? 256 : 512;
  const ch = Math.round(cw * ROOM.depth / ROOM.width);
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
  const X = (x) => ((x - ROOM.x0) / ROOM.width) * cw;
  const Z = (z) => ((z - ROOM.zBack) / ROOM.depth) * ch;
  const edgeSize = cw * .07;
  const edge = (x0, y0, x1, y1, a) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); return g; };
  ctx.fillStyle = edge(0, 0, edgeSize, 0, .42); ctx.fillRect(0, 0, edgeSize, ch);
  ctx.fillStyle = edge(cw, 0, cw - edgeSize, 0, .42); ctx.fillRect(cw - edgeSize, 0, edgeSize, ch);
  ctx.fillStyle = edge(0, 0, 0, edgeSize, .46); ctx.fillRect(0, 0, cw, edgeSize);
  ctx.fillStyle = edge(0, ch, 0, ch - edgeSize, .3); ctx.fillRect(0, ch - edgeSize, cw, edgeSize);
  // furniture contact shadows (offset trick: shadowBlur works everywhere, unlike ctx.filter)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.8)";
  ctx.shadowBlur = cw * .026;
  ctx.shadowOffsetX = cw * 4;
  ctx.fillStyle = "#000";
  for (const [x0, z0, x1, z1] of FOOTPRINTS) ctx.fillRect(X(x0) - cw * 4, Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  ctx.restore();
  return textureFrom(canvas, { srgb: false, repeat: false, channel: 1, anisotropy: 2 });
}

// ---------------------------------------------------------------------------------------------
// sky: vivid daylight gradient + flat cel clouds, painted on an equirect canvas for the backdrop sphere
// ---------------------------------------------------------------------------------------------
function skyTexture() {
  const W = 1024, H = 512;
  const canvas = createCanvas(W, H);
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#3f8fe8"); grad.addColorStop(.3, "#6db7f5"); grad.addColorStop(.46, "#b5e1fb"); grad.addColorStop(.5, "#fff0d2"); grad.addColorStop(.56, "#ffe7bd"); grad.addColorStop(1, "#ffd9a0");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const rand = rng(404);
  const cloud = (x, y, s) => {
    const blobs = [[0, 0, 1], [-1.0, .22, .72], [1.05, .2, .8], [-.45, -.34, .78], [.5, -.3, .66], [1.7, .34, .5], [-1.7, .36, .55]];
    const draw = (dx, dy, color) => {
      g.fillStyle = color; g.beginPath();
      for (const [bx, by, br] of blobs) { g.moveTo(x + (bx * s + dx) + br * s * .5, y + by * s * .5 + dy); g.arc(x + bx * s + dx, y + by * s * .5 + dy, br * s * .5, 0, Math.PI * 2); }
      g.fill();
      g.fillRect(x - 2.0 * s + dx, y + .1 * s + dy, 4.0 * s, .22 * s); // flat bottom
    };
    draw(0, s * .1, "#bcd4fb");     // cool underside
    draw(0, 0, "#ffffff");
  };
  for (let i = 0; i < 22; i++) cloud(rand() * W, H * (.16 + rand() * .26), 26 + rand() * 34);
  return textureFrom(canvas, { srgb: true, repeat: false, anisotropy: 2 });
}

// ---------------------------------------------------------------------------------------------
// street towers: flat, saturated blocks with crisp window grids (unlit, so they stay vivid)
// ---------------------------------------------------------------------------------------------
function towerTexture(seed, base, trim, cols, rows) {
  const rand = rng(seed);
  const W = 256, H = 512;
  const canvas = createCanvas(W, H);
  const g = canvas.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, "rgba(255,255,255,.18)"); lg.addColorStop(.6, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(18,22,43,.28)");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const cw = W / cols, rh = H / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = x * cw + cw * .2, wy = y * rh + rh * .16, ww = cw * .6, wh = rh * .56;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, "#d9f1ff"); sky.addColorStop(1, "#7cc2f2");
    g.fillStyle = rand() < .2 ? "#ffd98a" : sky; g.fillRect(wx, wy, ww, wh);
    if (rand() < .3) { g.fillStyle = trim; g.fillRect(wx, wy, ww, wh * (.2 + rand() * .3)); } // blind
    g.fillStyle = "rgba(18,22,43,.35)"; g.fillRect(wx, wy + wh, ww, rh * .06); // sill
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(wx + ww * .08, wy + wh * .08, ww * .12, wh * .84); // glint
  }
  g.fillStyle = trim; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 14, W, 14);
  return textureFrom(canvas, { srgb: true, repeat: true, anisotropy: 2 });
}

// ---------------------------------------------------------------------------------------------
// wall murals: one painted canvas per wall (coordinates are in world metres along the wall)
// ---------------------------------------------------------------------------------------------
const WAINSCOT = 1.0;
function makePainter(kind, ppm) {
  const side = kind !== "back";
  const c0 = side ? ROOM.zBack : ROOM.x0, c1 = side ? ROOM.zFront : ROOM.x1;
  const flip = kind === "left";           // left wall: u runs front -> back
  const len = c1 - c0, H = ROOM.height;
  const W = Math.round(len * ppm), Hh = Math.round(H * ppm);
  const canvas = createCanvas(W, Hh);
  const g = canvas.getContext("2d");
  const X = (c) => (flip ? c1 - c : c - c0) * ppm;
  const Y = (y) => (H - y) * ppm;
  const rect = (a, b, y0, y1, color) => { const xa = X(a), xb = X(b); g.fillStyle = color; g.fillRect(Math.min(xa, xb), Y(y1), Math.abs(xb - xa), (y1 - y0) * ppm); };
  const circle = (c, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(X(c), Y(y), r * ppm, 0, Math.PI * 2); g.fill(); };
  return { canvas, g, X, Y, rect, circle, c0, c1, len, H, ppm, W, Hh };
}

function paintMural(kind, ppm) {
  const P = makePainter(kind, ppm);
  const { g, rect, circle, c0, c1, H, Y, X } = P;
  const zones = {
    left: [[c0, -3.05, PAL.ink], [-3.05, 1.05, PAL.teal]],
    right: [[c0, -.3, PAL.coral], [.55, 3.35, PAL.violet]],
    back: [[c0, -1.95, PAL.ink], [.95, c1, PAL.coral]]
  }[kind];
  // base: warm cream, then the colour fields
  rect(c0, c1, 0, H, PAL.cream);
  for (const [a, b, color] of zones) rect(a, b, WAINSCOT, H, color);

  // sun halo behind the neon sign (back wall centre): a vinyl-like ring pair
  if (kind === "back") {
    g.save(); g.beginPath(); g.rect(X(-1.95), Y(H), (X(.95) - X(-1.95)), (H - WAINSCOT - .074) * ppm); g.clip();
    circle(-.55, 2.5, 1.46, PAL.sun); circle(-.55, 2.5, 1.3, "#f8ecd0"); circle(-.55, 2.5, 1.18, PAL.sun);
    g.restore();
  }
  // halftone gradient on every field (dots grow toward the belt, like the gig-poster print): painterly depth without noise
  {
    const x0 = Math.min(...zones.map((z) => z[0]), c0);
    const fields = [...zones.map(([a, b, color]) => [a, b, color]), [c0, c1, PAL.cream]];
    const seen = new Set();
    for (const [a, b, color] of fields) {
      const key = a + "|" + b; if (seen.has(key)) continue; seen.add(key);
      const dark = color === PAL.ink;
      g.fillStyle = dark ? "rgba(255,246,227,.075)" : color === PAL.cream ? "rgba(34,22,86,.035)" : "rgba(255,246,227,.14)";
      const pitch = .13;
      for (let c = Math.ceil((a + .06) / pitch) * pitch; c < b - .06; c += pitch) {
        for (let y = WAINSCOT + .1, row = 0; y < WAINSCOT + 1.05; y += pitch * .87, row++) {
          const k = 1 - (y - WAINSCOT - .1) / .95;
          const r = .026 * k * k;
          if (r < .004) continue;
          g.beginPath(); g.arc(X(c + (row % 2 ? pitch / 2 : 0)), Y(y), r * ppm, 0, Math.PI * 2); g.fill();
        }
      }
    }
    void x0;
  }
  // zone boundary pin-lines (paper) so the colour blocks read as printed panels
  for (const [a, b] of zones) for (const c of [a, b]) if (c > c0 + .01 && c < c1 - .01) rect(c - .012, c + .012, WAINSCOT + .074, H, PAL.paper);

  // ink wainscot with a dot-grid, then the coral / sun / cyan belt
  rect(c0, c1, 0, WAINSCOT, PAL.ink);
  g.fillStyle = "rgba(255,246,227,.075)";
  const step = .08, r = Math.max(1.1, .0075 * ppm);
  for (let c = c0 + step / 2; c < c1; c += step) for (let y = step / 2; y < WAINSCOT - .02; y += step) { g.beginPath(); g.arc(X(c), Y(y), r, 0, Math.PI * 2); g.fill(); }
  rect(c0, c1, WAINSCOT, WAINSCOT + .026, PAL.coral);
  rect(c0, c1, WAINSCOT + .026, WAINSCOT + .052, PAL.sun);
  rect(c0, c1, WAINSCOT + .052, WAINSCOT + .074, PAL.cyan);
  rect(c0, c1, WAINSCOT + .074, WAINSCOT + .084, "rgba(255,246,227,.9)");

  // baked soft occlusion: ceiling line, floor line, corners (a violet-tinted shadow, not grey)
  const sh = (a) => `rgba(34,22,86,${a})`;
  const vGrad = (y0, y1, a) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, sh(a)); gr.addColorStop(1, sh(0)); return gr; };
  g.fillStyle = vGrad(0, .55 * ppm, .34); g.fillRect(0, 0, P.W, .55 * ppm);
  g.fillStyle = vGrad(P.Hh, P.Hh - .22 * ppm, .3); g.fillRect(0, P.Hh - .22 * ppm, P.W, .22 * ppm);
  const hGrad = (x0, x1, a) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, sh(a)); gr.addColorStop(1, sh(0)); return gr; };
  g.fillStyle = hGrad(0, .5 * ppm, .3); g.fillRect(0, 0, .5 * ppm, P.Hh);
  g.fillStyle = hGrad(P.W, P.W - .5 * ppm, .3); g.fillRect(P.W - .5 * ppm, 0, .5 * ppm, P.Hh);
  return P.canvas;
}

export function buildRoom(ctx) {
  const { scene, batcher: B, materials: m, assets, quality } = ctx;
  const out = { updaters: [], texturesToDispose: [] };
  const H = ROOM.height;
  const zF = ROOM.zFront;
  const frame = pickMat(m, "paintedInk", "paintedGreen");
  const inkLacquer = pickMat(m, "lacquerInk", "paintedInk");
  const neon = (hex, base = 3) => { const mat = makeNeonMaterial(hex, base); ctx.neonMaterials.push(mat); ctx.owned.push(mat); return mat; };
  const neonCyan = neon(NEON.cyan, 3.4), neonCoral = neon(NEON.coral, 3.2), neonSun = neon(NEON.sun, 2.8);

  // ---------------------------------------------------------------- floor: crisp graphic checker, 0.6 m tiles aligned to the room
  const floorGeo = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  floorGeo.setAttribute("uv1", floorGeo.attributes.uv.clone());
  const tilesX = 12, tilesZ = 17, perRepeat = 8;       // 8 tiles per texture repeat -> 0.617 x 0.612 m tiles, exact fit wall to wall
  for (const t of [m.floor.map, m.floor.normalMap, m.floor.roughnessMap]) if (t) t.repeat.set(tilesX / perRepeat, tilesZ / perRepeat);
  const ao = bakeFloorAO(quality);
  m.floor.aoMap = ao;
  m.floor.aoMapIntensity = .9;
  const floor = new THREE.Mesh(floorGeo, m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM.cx, 0, ROOM.cz);
  floor.receiveShadow = true;
  scene.add(floor);
  out.floor = floor;

  // vinyl-disc inlay in the entrance aisle (what the visitor sees when looking down): ink / coral / sun rings, SIDE A label
  {
    const S = quality.id === "low" ? 512 : 1024;
    const c = createCanvas(S), g = c.getContext("2d"), R = S / 2;
    g.clearRect(0, 0, S, S);
    const ring = (r, color) => { g.fillStyle = color; g.beginPath(); g.arc(R, R, r * R, 0, Math.PI * 2); g.fill(); };
    ring(1, PAL.paper); ring(.985, PAL.coral); ring(.945, PAL.ink); ring(.9, "#232a57");
    g.strokeStyle = "rgba(255,246,227,.13)"; g.lineWidth = Math.max(1, S * .0016);
    for (let r = .36; r < .88; r += .028) { g.beginPath(); g.arc(R, R, r * R, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = "rgba(255,246,227,.5)"; g.lineWidth = S * .008; g.lineCap = "round";
    g.beginPath(); g.arc(R, R, .74 * R, -2.5, -1.9); g.stroke(); g.beginPath(); g.arc(R, R, .74 * R, .6, 1.2); g.stroke();
    ring(.34, PAL.coral); ring(.3, PAL.sun); ring(.27, PAL.coral);
    g.fillStyle = PAL.paper; g.textAlign = "center"; g.textBaseline = "middle";
    fitPx(g, "SIDE A", FONT.display, 900, S * .3, S * .075); g.fillText("SIDE A", R, R - S * .02);
    g.font = `700 ${Math.round(S * .028)}px ${FONT.mono}`; g.fillStyle = PAL.ink; g.fillText("33 1/3 RPM", R, R + S * .06);
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(R, R, S * .012, 0, Math.PI * 2); g.fill();
    const tex = textureFrom(c, { srgb: true, repeat: false, anisotropy: quality.anisotropy });
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .28, metalness: 0, envMapIntensity: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
    ctx.owned.push(mat, tex);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), mat);
    disc.rotation.x = -Math.PI / 2; disc.rotation.z = .3; disc.position.set(.55, .006, 1.75); disc.receiveShadow = true; disc.renderOrder = 1;
    scene.add(disc);
  }

  // ---------------------------------------------------------------- walls: structure + one painted mural per wall
  const wallT = .22;
  const wallMat = m.wall;
  B.add(applyBoxUV(new THREE.BoxGeometry(wallT, H, ROOM.depth + .5), 1.6), wallMat, [ROOM.x0 - wallT / 2, H / 2, ROOM.cz], [0, 0, 0], { cast: true });
  B.add(applyBoxUV(new THREE.BoxGeometry(wallT, H, ROOM.depth + .5), 1.6), wallMat, [ROOM.x1 + wallT / 2, H / 2, ROOM.cz], [0, 0, 0], { cast: true });
  B.add(applyBoxUV(new THREE.BoxGeometry(ROOM.width + .6, H, wallT), 1.6), wallMat, [ROOM.cx, H / 2, ROOM.zBack - wallT / 2], [0, 0, 0], { cast: true });
  {
    const ppm = quality.id === "high" ? 210 : quality.id === "medium" ? 150 : 96;
    const mural = (kind, w, pos, rotY) => {
      const tex = textureFrom(paintMural(kind, ppm), { srgb: true, repeat: false, anisotropy: quality.anisotropy });
      const normal = m.wall.normalMap ? m.wall.normalMap.clone() : null;
      if (normal) { normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(w / 1.6, H / 1.6); normal.needsUpdate = true; }
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, normalMap: normal, normalScale: normal ? new THREE.Vector2(.3, .3) : undefined, name: "mural" });
      ctx.owned.push(mat, tex);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat);
      mesh.position.set(...pos); mesh.rotation.y = rotY; mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    mural("left", ROOM.depth, [ROOM.x0 + .003, H / 2, ROOM.cz], Math.PI / 2);
    mural("right", ROOM.depth, [ROOM.x1 - .003, H / 2, ROOM.cz], -Math.PI / 2);
    mural("back", ROOM.width, [ROOM.cx, H / 2, ROOM.zBack + .003], 0);
  }
  // baseboard (ink, crisp) and ceiling cove with a cyan / coral neon line (architecture neon)
  const lengthZ = ROOM.depth;
  for (const x of [ROOM.x0, ROOM.x1]) {
    const s = x < 0 ? 1 : -1;
    B.box(.03, .09, lengthZ, frame, [x + s * .02, .045, ROOM.cz], [0, 0, 0], { bevel: .004 });
    B.box(.05, .06, lengthZ, frame, [x + s * .03, H - .03, ROOM.cz], [0, 0, 0], { bevel: .006 });
    B.add(new THREE.BoxGeometry(.012, .016, lengthZ - .2), x < 0 ? neonCyan : neonCoral, [x + s * .058, H - .11, ROOM.cz], [0, 0, 0], { cast: false, receive: false });
  }
  B.box(ROOM.width, .09, .03, frame, [ROOM.cx, .045, ROOM.zBack + .02], [0, 0, 0], { bevel: .004 });
  B.box(ROOM.width, .06, .05, frame, [ROOM.cx, H - .03, ROOM.zBack + .03], [0, 0, 0], { bevel: .006 });

  // ---------------------------------------------------------------- front wall with openings (interior face cream, bulkheads ink)
  const T = .3;
  const zc = zF + T / 2;
  const pillar = (x0, x1) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, H, T), 1.6), m.wall, [(x0 + x1) / 2, H / 2, zc]);
  pillar(ROOM.x0 - .3, FRONT.windowA.x0);
  pillar(FRONT.windowA.x1, FRONT.door.x0);
  pillar(FRONT.door.x1, FRONT.windowB.x0);
  pillar(FRONT.windowB.x1, ROOM.x1 + .3);
  const bulk = (x0, x1) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, FRONT.sill, T), 1.6), pickMat(m, "paintedInk", "paintedGreen"), [(x0 + x1) / 2, FRONT.sill / 2, zc]);
  bulk(FRONT.windowA.x0, FRONT.windowA.x1);
  bulk(FRONT.windowB.x0, FRONT.windowB.x1);
  const header = (x0, x1, y0) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, H - y0, T), 1.6), m.wall, [(x0 + x1) / 2, y0 + (H - y0) / 2, zc]);
  header(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.lintel);
  header(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.lintel);
  header(FRONT.door.x0, FRONT.door.x1, FRONT.lintel);
  // exterior skin: teal pillars and headers so the shop-front reads as one bold colour block (coral awnings + kick panels, ink frames)
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0x0c8693, roughness: .85, name: "facadeTeal" }); // deeper than the interior teal: it sits in direct sun
    ctx.owned.push(skin);
    const zs = zF + T + .004;
    const skinBox = (x0, x1, y0, y1) => B.add(applyBoxUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, .008), 1.6), skin, [(x0 + x1) / 2, (y0 + y1) / 2, zs], [0, 0, 0], { cast: false });
    skinBox(ROOM.x0 - .3, FRONT.windowA.x0, 0, H); skinBox(FRONT.windowA.x1, FRONT.door.x0, 0, H);
    skinBox(FRONT.door.x1, FRONT.windowB.x0, 0, H); skinBox(FRONT.windowB.x1, ROOM.x1 + .3, 0, H);
    skinBox(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.lintel, H); skinBox(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.lintel, H); skinBox(FRONT.door.x0, FRONT.door.x1, FRONT.lintel, H);
  }
  // interior colour belt on the front wall, same coral / sun / cyan as the walls' stripe
  for (const [x0, x1] of [[ROOM.x0, FRONT.windowA.x0], [FRONT.windowA.x1, FRONT.door.x0], [FRONT.door.x1, FRONT.windowB.x0], [FRONT.windowB.x1, ROOM.x1]]) {
    const w = x1 - x0 - .002, cx = (x0 + x1) / 2;
    [[PAL.coral, .013], [PAL.sun, .039], [PAL.cyan, .065]].forEach(([c, dy]) => B.add(new THREE.BoxGeometry(w, .026, .006), pickMat(m, c === PAL.coral ? "paintedCoral" : c === PAL.sun ? "paintedSun" : "paintedCyan", "painted"), [cx, WAINSCOT + dy, zF - .003], [0, 0, 0], { cast: false }));
  }

  // window and door frames (ink), slim mullions, transom bars
  const fz = zF - .02;
  const addFrame = (x0, x1, y0, y1, mullions = []) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    B.box(w, .06, .12, frame, [cx, y1 - .03, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(w, .06, .12, frame, [cx, y0 + .03, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(.06, h, .12, frame, [x0 + .03, cy, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    B.box(.06, h, .12, frame, [x1 - .03, cy, fz], [0, 0, 0], { bevel: .008, tile: .5 });
    for (const mx of mullions) B.box(.04, h, .09, frame, [mx, cy, fz], [0, 0, 0], { bevel: .006, tile: .5 });
  };
  addFrame(FRONT.windowA.x0, FRONT.windowA.x1, FRONT.sill, FRONT.lintel, [-2.15, -1.65]);
  addFrame(FRONT.windowB.x0, FRONT.windowB.x1, FRONT.sill, FRONT.lintel, [2.55]);
  B.box(FRONT.windowA.x1 - FRONT.windowA.x0, .04, .09, frame, [(FRONT.windowA.x0 + FRONT.windowA.x1) / 2, 2.35, fz], [0, 0, 0], { bevel: .006 });
  B.box(FRONT.windowB.x1 - FRONT.windowB.x0, .04, .09, frame, [(FRONT.windowB.x0 + FRONT.windowB.x1) / 2, 2.35, fz], [0, 0, 0], { bevel: .006 });
  // cyan neon along the top of both windows (shop-front glow, visible from the street)
  for (const w of [FRONT.windowA, FRONT.windowB]) B.add(new THREE.BoxGeometry(w.x1 - w.x0 - .12, .014, .014), neonCyan, [(w.x0 + w.x1) / 2, FRONT.lintel - .075, zF + .0], [0, 0, 0], { cast: false, receive: false });
  // door frame + transom
  const dcx = (FRONT.door.x0 + FRONT.door.x1) / 2;
  B.box(FRONT.door.x1 - FRONT.door.x0, .08, .14, frame, [dcx, FRONT.doorTop + .04, fz], [0, 0, 0], { bevel: .008 });
  B.box(.08, FRONT.doorTop, .14, frame, [FRONT.door.x0 + .04, FRONT.doorTop / 2, fz], [0, 0, 0], { bevel: .008 });
  B.box(.08, FRONT.doorTop, .14, frame, [FRONT.door.x1 - .04, FRONT.doorTop / 2, fz], [0, 0, 0], { bevel: .008 });
  B.box(FRONT.door.x1 - FRONT.door.x0, .05, .1, frame, [dcx, FRONT.lintel - .025, fz], [0, 0, 0], { bevel: .006 });
  // sill boards (interior): crisp cream lacquer with ink edge
  for (const w of [FRONT.windowA, FRONT.windowB]) B.box(w.x1 - w.x0 + .2, .05, .3, pickMat(m, "lacquerPaper", "paintedCream"), [(w.x0 + w.x1) / 2, FRONT.sill + .025, zF - .08], [0, 0, 0], { bevel: .01 });

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

  // ---------------------------------------------------------------- doors (animated): coral lacquer leaves, steel pulls
  const doorLeaves = [];
  const doorMat = pickMat(m, "lacquerCoral", "paintedCoral");
  const mkLeaf = (hingeX, dir) => {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0, zF + .02);
    const width = (FRONT.door.x1 - FRONT.door.x0) / 2 - .04;
    const leaf = new THREE.Group();
    const h = FRONT.doorTop - .06;
    const stile = (x, w) => { const mesh = new THREE.Mesh(woodBox(w, h, .05, { bevel: .01, tile: .5 }), doorMat); mesh.position.set(dir * x, h / 2 + .03, 0); mesh.castShadow = true; leaf.add(mesh); };
    stile(.05, .1); stile(width - .05, .1);
    for (const y of [.12, h - .06]) { const rail = new THREE.Mesh(woodBox(width, y === .12 ? .22 : .12, .05, { bevel: .01, tile: .5 }), doorMat); rail.position.set(dir * width / 2, y + .03, 0); rail.castShadow = true; leaf.add(rail); }
    const mid = new THREE.Mesh(woodBox(width, .06, .05, { bevel: .006, tile: .5 }), doorMat); mid.position.set(dir * width / 2, h * .46, 0); leaf.add(mid);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - .14, h - .52), m.glass);
    glass.position.set(dir * width / 2, h * .53, 0); glass.renderOrder = 3; leaf.add(glass);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .5, 12), m.steel);
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
    fitPx(g, label[0], FONT.display, 900, 420, 110); g.fillText(label[0], 256, 118);
    g.font = `700 36px ${FONT.mono}`; g.fillText(label[1], 256, 226);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.26, .152), new THREE.MeshStandardMaterial({ map: textureFrom(c, { srgb: true, repeat: false }), roughness: .5 }));
    mesh.rotation.y = flip ? 0 : Math.PI;
    mesh.position.z = flip ? .002 : -.002;
    mesh.castShadow = false;
    return mesh;
  };
  // Face toward the street (+z) first: CLOSED. Face toward the shop (-z): OPEN.
  signPivot.add(mkFace(["FERMÉ", "CLOSED"], PAL.coral, PAL.ink, true), mkFace(["OUVERT", "OPEN"], PAL.mint, PAL.ink, false));
  const string = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .12, 4), m.steel);
  string.position.y = .13; signPivot.add(string);
  scene.add(signPivot);

  // ---------------------------------------------------------------- ceiling
  const ceilGeo = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 1, metalness: 0, emissive: 0x9db8ff, emissiveIntensity: .3, name: "ceilingSky" }); // pale paint with a cool sky glow: counter-balance to the warm sun
  ctx.owned.push(ceilingMat);
  const ceiling = new THREE.Mesh(ceilGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(ROOM.cx, H, ROOM.cz);
  ceiling.receiveShadow = false;
  ceiling.castShadow = true; // the roof blocks the sun: daylight enters through the windows only, like the light shafts show
  scene.add(ceiling);
  // linear LED panels (slim ink housing, emissive diffuser)
  for (const z of [-4.2, -1.6, .9, 3.3]) {
    for (const x of [-1.6, 1.6]) {
      B.box(1.3, .02, .26, frame, [x, H - .012, z], [0, 0, 0], { bevel: .006, cast: false, receive: false });
      B.add(new THREE.BoxGeometry(1.16, .005, .16), m.tube, [x, H - .026, z], [0, 0, 0], { cast: false, receive: false });
    }
  }
  // ceiling collage of sleeves above the back-left corner, framed in ink
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

  // ---------------------------------------------------------------- exterior: facade, awnings, pavement, street
  const exterior = new THREE.Group();
  const facade = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry(ROOM.width + 1.2, 1.3, .24), 1.6), frame);
  facade.position.set(ROOM.cx, H + .62, zF + .12); facade.castShadow = true; facade.receiveShadow = true; exterior.add(facade);
  const signTex = textureFrom(drawSignBoard("SIDE A RECORDS", { width: 2048, height: 380, bg: PAL.ink, fg: PAL.paper, border: PAL.sun, sub: "PROJECTS STORE · ADAM SOPPELSA" }), { srgb: true, repeat: false, anisotropy: quality.anisotropy });
  const fascia = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.0), new THREE.MeshStandardMaterial({ map: signTex, roughness: .5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: .16 }));
  fascia.position.set(ROOM.cx, H + .62, zF + .245); exterior.add(fascia);
  // neon trim above and below the fascia (picked up by bloom from the street)
  for (const [y, mat] of [[H + .62 + .53, neonCyan], [H + .62 - .53, neonCoral]]) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(5.4, .028, .028), mat); tube.position.set(ROOM.cx, y, zF + .255); exterior.add(tube);
  }
  // lower exterior panels: coral under the windows
  for (const [x0, x1] of [[FRONT.windowA.x0, FRONT.windowA.x1], [FRONT.windowB.x0, FRONT.windowB.x1]]) {
    const panel = new THREE.Mesh(woodBox(x1 - x0 - .1, FRONT.sill - .15, .05, { bevel: .015, tile: .8 }), pickMat(m, "paintedCoral", "painted"));
    panel.position.set((x0 + x1) / 2, FRONT.sill / 2, zF + .32); panel.castShadow = true; exterior.add(panel);
  }
  // striped awnings over both windows (flat cel colours, scalloped valance)
  {
    const stripes = (w) => {
      const S = 512, c = createCanvas(S, 256), g = c.getContext("2d");
      const n = Math.max(6, Math.round(w / .22)), sw = S / n;
      for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? PAL.paper : PAL.coral; g.fillRect(i * sw, 0, sw + 1, 256); }
      const lg = g.createLinearGradient(0, 0, 0, 256); lg.addColorStop(0, "rgba(255,255,255,.15)"); lg.addColorStop(1, "rgba(34,22,86,.22)");
      g.fillStyle = lg; g.fillRect(0, 0, S, 256);
      return textureFrom(c, { srgb: true, repeat: false, anisotropy: 2 });
    };
    const valance = (w) => {
      const S = 512, c = createCanvas(S, 64), g = c.getContext("2d");
      const n = Math.max(6, Math.round(w / .22)), sw = S / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? PAL.paper : PAL.coral;
        g.beginPath(); g.moveTo(i * sw, 0); g.lineTo((i + 1) * sw + 1, 0); g.lineTo((i + 1) * sw + 1, 36); g.arc(i * sw + sw / 2, 36, sw / 2 + .5, 0, Math.PI); g.lineTo(i * sw, 36); g.closePath(); g.fill();
      }
      return textureFrom(c, { srgb: true, repeat: false, anisotropy: 2 });
    };
    const mk = (x0, x1) => {
      const w = x1 - x0 + .24, cxm = (x0 + x1) / 2;
      const top = { y: 3.02, z: zF + .3 }, drop = .42, reach = .8;
      const len = Math.hypot(reach, drop), ang = Math.atan2(drop, reach);
      const sheetTex = stripes(w), valTex = valance(w);
      ctx.owned.push(sheetTex, valTex);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: .85, side: THREE.DoubleSide }));
      sheet.position.set(cxm, top.y - drop / 2, top.z + reach / 2);
      sheet.rotation.x = -(Math.PI / 2 - ang);
      const val = new THREE.Mesh(new THREE.PlaneGeometry(w, .16), new THREE.MeshStandardMaterial({ map: valTex, roughness: .85, side: THREE.DoubleSide, transparent: true, alphaTest: .5 }));
      val.position.set(cxm, top.y - drop - .08 + .02, top.z + reach);
      exterior.add(sheet, val);
      for (const sx of [-w / 2 + .05, w / 2 - .05]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, len + .05, 8), m.steel);
        rod.position.set(cxm + sx, top.y - drop / 2 - .02, top.z + reach / 2);
        rod.rotation.set(Math.PI / 2 + ang, 0, 0);
        exterior.add(rod);
      }
    };
    mk(FRONT.windowA.x0, FRONT.windowA.x1);
    mk(FRONT.windowB.x0, FRONT.windowB.x1);
  }
  // pavement + curb + road (flat ink asphalt with a dashed sun line)
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.2), m.pavement);
  for (const t of [m.pavement.map, m.pavement.normalMap, m.pavement.roughnessMap]) if (t) t.repeat.set(40 / 1.2, 3.2 / 1.2);
  pave.rotation.x = -Math.PI / 2; pave.position.set(0, .001, zF + 1.9); pave.receiveShadow = true; exterior.add(pave);
  const roadTex = (() => {
    const c = createCanvas(1024, 256), g = c.getContext("2d");
    g.fillStyle = "#3a4062"; g.fillRect(0, 0, 1024, 256);
    g.fillStyle = PAL.sun; for (let x = 20; x < 1024; x += 128) g.fillRect(x, 120, 72, 12);
    g.fillStyle = "rgba(255,246,227,.55)"; g.fillRect(0, 232, 1024, 8);
    return textureFrom(c, { srgb: true, repeat: false, anisotropy: 4 });
  })();
  ctx.owned.push(roadTex);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ map: roadTex, roughness: .9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -.12, zF + 12.6); road.rotation.z = Math.PI; exterior.add(road);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(40, .14, .22), new THREE.MeshStandardMaterial({ color: 0xe9dcc2, roughness: .9 }));
  curb.position.set(0, -.02, zF + 3.6); exterior.add(curb);
  // sandwich board + planters by the door (cheap, readable from the entrance dolly)
  {
    const board = new THREE.Group();
    board.position.set(1.95, 0, zF + 1.15); board.rotation.y = -.25;
    const tex = textureFrom((() => {
      const c = createCanvas(256, 360), g = c.getContext("2d");
      g.fillStyle = PAL.ink; g.fillRect(0, 0, 256, 360);
      g.fillStyle = PAL.coral; g.fillRect(0, 0, 256, 26); g.fillStyle = PAL.sun; g.fillRect(0, 334, 256, 26);
      g.fillStyle = PAL.paper; g.textAlign = "center"; g.textBaseline = "middle";
      fitPx(g, "SIDE A", FONT.display, 900, 200, 52); g.fillText("SIDE A", 128, 130);
      g.fillStyle = PAL.cyan; g.font = `700 20px ${FONT.mono}`; g.fillText("PROJECTS STORE", 128, 190);
      g.fillStyle = PAL.sun; g.beginPath(); g.arc(128, 262, 40, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.ink; g.beginPath(); g.arc(128, 262, 14, 0, Math.PI * 2); g.fill();
      return c;
    })(), { srgb: true, repeat: false, anisotropy: 4 });
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .6 });
    ctx.owned.push(faceMat, tex);
    for (const s of [-1, 1]) {
      const side = new THREE.Group();
      side.rotation.y = s > 0 ? 0 : Math.PI;
      const leg = new THREE.Mesh(woodBox(.6, .92, .03, { bevel: .01, tile: .6 }), frame);
      leg.position.set(0, .45, .09); leg.rotation.x = -.2; side.add(leg);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(.52, .74), faceMat);
      face.position.set(0, .45, .09 + .0165 / Math.cos(.2)); face.rotation.x = -.2;
      side.add(face);
      board.add(side);
    }
    exterior.add(board);
    const potMat = new THREE.MeshStandardMaterial({ color: 0xf0e4c9, roughness: .5 }), potInk = new THREE.MeshStandardMaterial({ color: 0x1b2145, roughness: .45 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x35d99d, roughness: .6, flatShading: true });
    ctx.owned.push(potMat, potInk, leafMat);
    for (const [x, mat] of [[-.02, potInk], [1.65, potMat]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .42, 20), mat); pot.position.set(x, .21, zF + .7); exterior.add(pot);
      for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(.045, .6 + (i % 3) * .12, 5), leafMat); const a = i / 9 * Math.PI * 2; lf.position.set(x + Math.cos(a) * .08, .42 + .3, zF + .7 + Math.sin(a) * .08); lf.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); exterior.add(lf); }
    }
  }
  // opposite towers: flat saturated blocks with crisp window grids
  const rand = rng(5);
  const towerPalette = [[PAL.coral, PAL.ink], [PAL.sun, PAL.coral], [PAL.cyan, PAL.ink], [PAL.violet, PAL.sun], [PAL.mint, PAL.ink], [PAL.paper, PAL.coral], [PAL.sky, PAL.violet], [PAL.teal, PAL.sun]];
  let bx = -26, ti = 0;
  while (bx < 26) {
    const w = rand.range(5, 9), h = rand.range(9, 15);
    const [base, trim] = towerPalette[ti++ % towerPalette.length];
    const tex = towerTexture(Math.floor(rand() * 999), base, trim, Math.round(w / 1.6), Math.round(h / 3));
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.05, 1.05, 1.05), fog: false }));
    b.position.set(bx + w / 2, h / 2, zF + 23);
    exterior.add(b);
    bx += w + .15;
    out.texturesToDispose.push(tex);
  }
  // parked car, lamp post and tree on the street (seen through the windows)
  const carMat = new THREE.MeshStandardMaterial({ color: 0xf0584a, roughness: .3, metalness: .15, envMapIntensity: 1.3 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: .45 });
  const darkGlass = new THREE.MeshStandardMaterial({ color: 0x14183a, roughness: .1, metalness: .5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14173a, roughness: .9 });
  const car = new THREE.Group();
  car.position.set(-1.7, 0, zF + 5.6);
  car.rotation.y = .04;
  const add = (geo, mat, pos, rot) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; car.add(mesh); return mesh; };
  add(woodBox(4.2, .62, 1.7, { bevel: .22, tile: 2 }), carMat, [0, .58, 0]);
  add(woodBox(2.3, .55, 1.55, { bevel: .2, tile: 2 }), carMat, [-.1, 1.08, 0]);
  add(woodBox(2.1, .4, 1.58, { bevel: .12, tile: 2 }), darkGlass, [-.1, 1.1, 0]);
  add(woodBox(4.22, .06, 1.72, { bevel: .02, tile: 2 }), creamMat, [0, .45, 0]);
  for (const x of [-1.4, 1.4]) for (const z of [-.85, .85]) add(new THREE.CylinderGeometry(.33, .33, .22, 24), tireMat, [x, .33, z], [Math.PI / 2, 0, 0]);
  for (const z of [-.6, .6]) add(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .92, .7).multiplyScalar(2.5) }), [2.1, .66, z]);
  exterior.add(car);
  const post = new THREE.Group();
  post.position.set(3.4, 0, zF + 3.3);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b2145, roughness: .45, metalness: .5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 4.2, 10), iron); pole.position.y = 2.1; pole.castShadow = true; post.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .9, .65).multiplyScalar(2) })); lamp.position.y = 4.35; post.add(lamp);
  exterior.add(post);
  const tree = new THREE.Group();
  tree.position.set(-5.2, 0, zF + 4.6);
  tree.scale.setScalar(.7);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a52, roughness: 1 })); trunk.position.y = 1.3; trunk.castShadow = true; tree.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x35d99d, roughness: .7, flatShading: true });
  for (let i = 0; i < 6; i++) { const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(.9 + (i % 3) * .2, 1), leafMat); blob.position.set(Math.sin(i * 1.9) * .8, 3 + (i % 3) * .4, Math.cos(i * 2.3) * .8); blob.castShadow = true; tree.add(blob); }
  exterior.add(tree);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(1.28, 1.28, 1.28) }));
  sky.renderOrder = -10;
  sky.position.set(0, 0, 0);
  scene.add(sky);
  exterior.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  scene.add(exterior);

  // ---------------------------------------------------------------- street life: passers-by and the odd car, seen through the windows
  {
    const rr = rng(2024);
    const skins = [0xf0b899, 0xc48a68, 0x8a5a3c, 0xf5d2b2];
    const coats = [0x19d5e8, 0xff5b4a, 0x8b73ff, 0xffc83d, 0x3ee6a8, 0xfff6e3, 0xff8fb0];
    const trousers = [0x2d3a78, 0xf0e4c9, 0x4a68ad, 0x3a4062];
    const std = (color, roughness = .6) => { const mat = new THREE.MeshStandardMaterial({ color, roughness }); ctx.owned.push(mat); return mat; };
    const limb = new THREE.CapsuleGeometry(.062, .56, 4, 10);
    const arm = new THREE.CapsuleGeometry(.045, .46, 4, 10);
    const torsoGeo = new THREE.CapsuleGeometry(.165, .42, 6, 14);
    torsoGeo.scale(1, 1, .78);
    const headGeo = new THREE.SphereGeometry(.105, 20, 16);
    headGeo.scale(.9, 1.08, .95);
    const hairGeo = new THREE.SphereGeometry(.116, 20, 14, 0, Math.PI * 2, 0, Math.PI * .56);
    const quiffGeo = new THREE.SphereGeometry(.07, 14, 10);
    const shoeGeo = new THREE.CapsuleGeometry(.05, .12, 4, 8);
    const handGeo = new THREE.SphereGeometry(.045, 10, 8);
    const hoodGeo = new THREE.TorusGeometry(.12, .045, 8, 18);
    const packGeo = new THREE.BoxGeometry(.24, .3, .12, 2, 2, 2);
    const walkers = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const coat = std(coats[Math.floor(rr() * coats.length)]), pants = std(trousers[Math.floor(rr() * trousers.length)]), skin = std(skins[Math.floor(rr() * skins.length)], .5), hair = std([0x1d1a18, 0x4a3425, 0xf0b23a, 0x6b4dff][Math.floor(rr() * 4)], .4);
      const shoe = std([0xfff6e3, 0xff5b4a, 0x19d5e8, 0xffc83d][Math.floor(rr() * 4)], .45);
      const height = .93 + rr() * .12;
      const torso = new THREE.Mesh(torsoGeo, coat); torso.position.y = 1.2;
      const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.76;
      const cap = new THREE.Mesh(hairGeo, hair); cap.position.set(0, 1.775, -.01); cap.rotation.x = -.15;
      const quiff = new THREE.Mesh(quiffGeo, hair); quiff.position.set(0, 1.86, .06); quiff.scale.set(1.2, .7, 1.1);
      const hood = new THREE.Mesh(hoodGeo, coat); hood.position.set(0, 1.56, 0); hood.rotation.x = Math.PI / 2;
      const pivots = [-1, 1].map((side) => {
        const leg = new THREE.Group(); leg.position.set(side * .09, .9, 0);
        const m1 = new THREE.Mesh(limb, pants); m1.position.y = -.4; leg.add(m1);
        const foot = new THREE.Mesh(shoeGeo, shoe); foot.position.set(0, -.88, .05); foot.rotation.x = Math.PI / 2; leg.add(foot);
        const swing = new THREE.Group(); swing.position.set(side * .22, 1.42, 0);
        const m2 = new THREE.Mesh(arm, coat); m2.position.y = -.28; swing.add(m2);
        const hand = new THREE.Mesh(handGeo, skin); hand.position.y = -.58; swing.add(hand);
        g.add(leg, swing);
        return { leg, swing, side };
      });
      g.add(torso, head, cap, quiff, hood);
      if (i % 2 === 0) { const pack = new THREE.Mesh(packGeo, std(coats[(i + 3) % coats.length], .7)); pack.position.set(0, 1.25, -.16); g.add(pack); }
      g.scale.setScalar(height);
      g.visible = false;
      exterior.add(g);
      walkers.push({ g, pivots, x: 0, dir: 1, speed: 1.1, wait: i === 0 ? .4 : 4 + i * 6 + rr() * 10, phase: rr() * 6, z: zF + 1.5 + rr() * 1.4, first: true });
    }
    // a second car that drives past now and then (sun-yellow cab)
    const traffic = car.clone(true);
    const trafficMat = new THREE.MeshStandardMaterial({ color: 0xf5b92f, roughness: .3, metalness: .15, envMapIntensity: 1.3 });
    traffic.traverse((o) => { if (o.isMesh && o.material === carMat) o.material = trafficMat; });
    traffic.visible = false; traffic.position.set(0, 0, zF + 9.2); traffic.rotation.y = 0;
    exterior.add(traffic);
    const car2 = { g: traffic, x: 0, dir: 1, speed: 7, wait: 12 + rr() * 20 };
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    out.updaters.push((dt, elapsed = 0) => {
      if (reduced) return;
      for (const w of walkers) {
        if (w.wait > 0) { w.wait -= dt; if (w.wait <= 0) { w.dir = rr() < .5 ? -1 : 1; w.speed = .9 + rr() * .5; w.x = -w.dir * (w.first ? 3 : 11); w.first = false; w.g.visible = true; w.g.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; } continue; }
        w.x += w.dir * w.speed * dt;
        const ph = (w.x * 3.2) + w.phase;
        for (const { leg, swing, side } of w.pivots) { leg.rotation.x = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * .55; swing.rotation.x = Math.sin(ph + (side > 0 ? Math.PI : 0)) * .4; }
        w.g.position.set(w.x, Math.abs(Math.sin(ph)) * .025, w.z);
        if (Math.abs(w.x) > 12) { w.g.visible = false; w.wait = 14 + rr() * 40; }
      }
      if (car2.wait > 0) { car2.wait -= dt; if (car2.wait <= 0) { car2.dir = rr() < .5 ? -1 : 1; car2.x = -car2.dir * 24; car2.g.visible = true; car2.g.rotation.y = car2.dir > 0 ? 0 : Math.PI; } }
      else {
        car2.x += car2.dir * car2.speed * dt;
        car2.g.position.x = car2.x;
        if (Math.abs(car2.x) > 25) { car2.g.visible = false; car2.wait = 30 + rr() * 50; }
      }
      void elapsed;
    });
  }

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
  void inkLacquer;
  return out;
}
