// Atmosphere & detail pass: neon accents, wall grime, hanging records, bunting. These are the small
// things that make a space feel lived-in instead of modelled.
import * as THREE from "three";
import { ROOM, COUNTER } from "./layout.js";
import { rng, createCanvas, textureFrom } from "./util.js";

const PI = Math.PI;

function neonMaterial(ctx, color, base = 3) {
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: .4 });
  m.userData.neonBase = base;
  ctx.neonMaterials.push(m);
  ctx.owned.push(m);
  return m;
}
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

  // ---------------------------------------------------------------- neon accents
  const magenta = neonMaterial(ctx, 0xff3b8d, 3.4), teal = neonMaterial(ctx, 0x27e0c0, 3.2), amber = neonMaterial(ctx, 0xffa63a, 2.6);
  const strip = (w, h, d, mat, pos) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(...pos); scene.add(mesh); return mesh; };
  // cove strip under the crown moulding on the back wall (magenta | teal)
  strip(3.55, .035, .035, magenta, [-1.8, H - .13, zb + .07]);
  strip(3.55, .035, .035, teal, [1.8, H - .13, zb + .07]);
  neonLight(ctx, 0xff3b8d, 2.2, 5, [-2.0, H - .3, zb + .5]);
  neonLight(ctx, 0x27e0c0, 2.0, 5, [2.0, H - .3, zb + .5]);
  // under-counter LED line
  strip(COUNTER.width - .2, .022, .022, teal, [COUNTER.x, .13, COUNTER.z + COUNTER.depth / 2 + .02]);
  neonLight(ctx, 0x27e0c0, 1.5, 3, [COUNTER.x, .35, COUNTER.z + COUNTER.depth / 2 + .5]);
  // neon vinyl disc on the back wall (concentric rings)
  const ring = new THREE.Group();
  ring.position.set(-3.05, 2.86, zb + .05);
  for (const [r, mat] of [[.27, magenta], [.19, teal], [.11, amber]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, .01, 8, 56), mat);
    ring.add(t);
  }
  const back = new THREE.Mesh(new THREE.CircleGeometry(.3, 40), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: .6 }));
  back.position.z = -.012; ring.add(back);
  scene.add(ring);
  neonLight(ctx, 0xff3b8d, 1.2, 3, [-3.05, 2.6, zb + .6]);
  // warm amber sign strip above the apps rack
  strip(.03, .03, 2.4, amber, [ROOM.x1 - .1, 2.96 - .22, 1.95]);

  // ---------------------------------------------------------------- wall grime (soft, multiplicative-look decals)
  const gradient = (stops) => {
    const c = createCanvas(4, 128);
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 128);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
    return textureFrom(c, { srgb: false, repeat: false, mipmaps: false });
  };
  const floorGrime = gradient([[0, "rgba(0,0,0,0)"], [.55, "rgba(30,18,8,.12)"], [1, "rgba(24,14,6,.42)"]]);
  const ceilGrime = gradient([[0, "rgba(40,28,14,.38)"], [.6, "rgba(40,28,14,.1)"], [1, "rgba(0,0,0,0)"]]);
  const mk = (map, w, h, pos, rotY) => {
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    ctx.owned.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos); mesh.rotation.y = rotY; mesh.renderOrder = 1;
    scene.add(mesh);
  };
  const len = ROOM.depth - .3;
  mk(floorGrime, len, 1.9, [ROOM.x0 + .016, .95, ROOM.cz], PI / 2);
  mk(floorGrime, len, 1.9, [ROOM.x1 - .016, .95, ROOM.cz], -PI / 2);
  mk(floorGrime, ROOM.width, 1.9, [ROOM.cx, .95, zb + .016], 0);
  mk(ceilGrime, len, .7, [ROOM.x0 + .016, H - .38, ROOM.cz], PI / 2);
  mk(ceilGrime, len, .7, [ROOM.x1 - .016, H - .38, ROOM.cz], -PI / 2);
  mk(ceilGrime, ROOM.width, .7, [ROOM.cx, H - .38, zb + .016], 0);

  // water stains and scuffs near the corners
  const stain = (() => {
    const c = createCanvas(256, 256);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 90, 8, 128, 110, 120);
    grad.addColorStop(0, "rgba(110,80,40,.22)"); grad.addColorStop(.7, "rgba(110,80,40,.08)"); grad.addColorStop(1, "rgba(110,80,40,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    return textureFrom(c, { srgb: false, repeat: false, mipmaps: false });
  })();
  const sMat = new THREE.MeshBasicMaterial({ map: stain, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  ctx.owned.push(sMat);
  const rand = rng(88);
  for (const [x, y, z, ry, s] of [[ROOM.x1 - .017, 2.7, -4.2, -PI / 2, 1.4], [ROOM.x1 - .017, 2.4, 3.6, -PI / 2, 1.1], [ROOM.x0 + .017, 2.9, 4.0, PI / 2, 1.2], [-3.3, 2.95, zb + .017, 0, 1.0], [1.4, 3.0, zb + .017, 0, 1.2]]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s, s), sMat);
    mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.renderOrder = 1; scene.add(mesh);
  }
  void rand;

  // ---------------------------------------------------------------- floor wear: traffic paths, scuffs, dust, paper scraps, door mat
  if (ctx.quality.id !== "low") {
    const W = ROOM.width, D = ROOM.depth, px = 1024, py = Math.round(1024 * D / W);
    const c = createCanvas(px, py);
    const g = c.getContext("2d");
    const R = rng(404);
    const X = (x) => ((x - ROOM.x0) / W) * px, Y = (z) => ((z - ROOM.zBack) / D) * py, S = px / W; // world -> canvas
    // soft worn paths (door -> counter, along the gondola, to the shelves)
    const path = (pts, width, alpha, color) => {
      g.lineCap = "round"; g.lineJoin = "round";
      for (let pass = 0; pass < 6; pass++) {
        g.strokeStyle = color.replace("A", String(alpha * (0.25 + pass * 0.08)));
        g.lineWidth = (width * S) * (1.6 - pass * 0.18);
        g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z)))); g.stroke();
      }
    };
    const canBlur = "filter" in g;
    if (canBlur) g.filter = "blur(10px)";
    path([[.7, ROOM.zFront - .3], [.7, 1.8], [1.6, -.4], [2.3, -2.9]], .9, .1, "rgba(60,44,24,A)");
    path([[-2.2, 2.0], [1.0, 1.9], [2.6, 1.2]], .8, .08, "rgba(60,44,24,A)");
    path([[1.4, -.3], [2.8, -.8], [3.1, -2.6]], .7, .07, "rgba(60,44,24,A)");
    if (canBlur) g.filter = "none";
    // scuffs & heel marks
    for (let i = 0; i < 520; i++) {
      const x = ROOM.x0 + .1 + R() * (W - .2), z = ROOM.zBack + .1 + R() * (D - .2);
      const a = R() * Math.PI, l = (.04 + R() * .16) * S;
      const dark = R() < .72;
      g.strokeStyle = dark ? `rgba(30,22,14,${.05 + R() * .13})` : `rgba(255,248,230,${.05 + R() * .1})`;
      g.lineWidth = (.004 + R() * .01) * S;
      g.beginPath(); g.moveTo(X(x), Y(z)); g.quadraticCurveTo(X(x) + Math.cos(a) * l * .5 + R() * 4, Y(z) + Math.sin(a) * l * .5 + R() * 4, X(x) + Math.cos(a) * l, Y(z) + Math.sin(a) * l); g.stroke();
    }
    // dust bunnies along the walls and under the furniture
    for (let i = 0; i < 160; i++) {
      const side = R() < .5, x = side ? ROOM.x0 + .04 + R() * .12 : ROOM.x1 - .04 - R() * .12, z = ROOM.zBack + .1 + R() * (D - .2);
      const r = (.01 + R() * .03) * S;
      const gr = g.createRadialGradient(X(x), Y(z), 0, X(x), Y(z), r);
      gr.addColorStop(0, "rgba(120,110,95,.22)"); gr.addColorStop(1, "rgba(120,110,95,0)");
      g.fillStyle = gr; g.fillRect(X(x) - r, Y(z) - r, r * 2, r * 2);
    }
    // water marks by the door and a spilled-coffee ring
    for (const [x, z, r, col] of [[.7, ROOM.zFront - .9, .5, "rgba(40,48,50,.12)"], [1.1, ROOM.zFront - 1.3, .3, "rgba(40,48,50,.09)"]]) {
      const gr = g.createRadialGradient(X(x), Y(z), 0, X(x), Y(z), r * S);
      gr.addColorStop(0, col); gr.addColorStop(1, "rgba(40,48,50,0)");
      g.fillStyle = gr; g.beginPath(); g.ellipse(X(x), Y(z), r * S, r * S * .7, .3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "rgba(60,34,14,.35)"; g.lineWidth = .006 * S; g.beginPath(); g.arc(X(-.4), Y(2.3), .045 * S, .2, 5.9); g.stroke();
    // paper scraps (flyers, receipts) lying around
    for (let i = 0; i < 9; i++) {
      const x = -2.6 + R() * 5.4, z = -.9 + R() * 4.6;
      g.save(); g.translate(X(x), Y(z)); g.rotate(R() * 6.28);
      g.fillStyle = R() < .5 ? "rgba(240,236,224,.9)" : "rgba(236,200,92,.85)";
      const w = (.05 + R() * .05) * S, h = (.07 + R() * .06) * S;
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 3; g.fillRect(-w / 2, -h / 2, w, h);
      g.shadowBlur = 0; g.fillStyle = "rgba(60,60,60,.5)"; for (let k = 0; k < 3; k++) g.fillRect(-w / 2 + 2, -h / 2 + 4 + k * 5, w - 4 - R() * 6, 1.4);
      g.restore();
    }
    const wearTex = textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const wearMat = new THREE.MeshStandardMaterial({ map: wearTex, transparent: true, depthWrite: false, roughness: .95, metalness: 0, envMapIntensity: .3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    ctx.owned.push(wearMat, wearTex);
    const wear = new THREE.Mesh(new THREE.PlaneGeometry(W, D), wearMat);
    wear.rotation.x = -PI / 2; wear.position.set(ROOM.cx, .0035, ROOM.cz); wear.receiveShadow = true; wear.renderOrder = 1;
    scene.add(wear);
    // door mat inside the entrance (woven rubber with the shop name)
    const mc = createCanvas(512, 320);
    const mg = mc.getContext("2d");
    mg.fillStyle = "#2b2a28"; mg.fillRect(0, 0, 512, 320);
    mg.strokeStyle = "rgba(255,255,255,.06)"; mg.lineWidth = 2;
    for (let i = 0; i < 512; i += 6) { mg.beginPath(); mg.moveTo(i, 0); mg.lineTo(i, 320); mg.stroke(); }
    mg.strokeStyle = "#c3402f"; mg.lineWidth = 8; mg.strokeRect(14, 14, 484, 292);
    mg.fillStyle = "#e9dcc0"; mg.textAlign = "center"; mg.textBaseline = "middle"; mg.font = "700 74px Impact, sans-serif"; mg.fillText("SIDE A", 256, 130);
    mg.font = "600 30px sans-serif"; mg.fillText("RECORDS · SINCE 1991", 256, 212);
    const matTex = textureFrom(mc, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    ctx.owned.push(matMat, matTex);
    const doormat = new THREE.Mesh(new THREE.BoxGeometry(1.0, .012, .64), matMat);
    doormat.position.set(.7, .008, ROOM.zFront - .62); doormat.rotation.y = .04; doormat.receiveShadow = true;
    scene.add(doormat);
  }

  // ---------------------------------------------------------------- hanging records (slow turn)
  const discs = [];
  const labelColors = ["#c3402f", "#f2d16b", "#2d6a4f", "#3b6ea5", "#e84a5f", "#d9822b", "#7d2a2a"];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const x = -2.6 + i * .68 + (i % 2) * .15, z = 1.1 + (i * 37 % 11) * .12, y = 2.25 + (i % 3) * .28;
    g.position.set(x, y, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .004, 40), m.vinyl);
    disc.rotation.x = PI / 2; disc.castShadow = true; g.add(disc);
    for (const side of [1, -1]) {
      const labelMat = new THREE.MeshStandardMaterial({ color: labelColors[i % labelColors.length], roughness: .7 });
      ctx.owned.push(labelMat);
      const l = new THREE.Mesh(new THREE.CircleGeometry(.036, 24), labelMat);
      l.position.z = side * .0025; l.rotation.y = side === 1 ? 0 : PI; g.add(l);
    }
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(.0012, .0012, H - y, 4), m.steel);
    thread.position.y = (H - y) / 2 + .15; g.add(thread);
    g.rotation.y = i * .7;
    scene.add(g);
    discs.push({ g, speed: .15 + (i % 3) * .08, phase: i * 1.3, y });
  }
  ctx.updaters.push((dt, elapsed) => {
    for (const d of discs) { d.g.rotation.y += dt * d.speed; d.g.rotation.x = Math.sin(elapsed * .5 + d.phase) * .06; d.g.position.y = d.y + Math.sin(elapsed * .6 + d.phase) * .012; }
  });

  // ---------------------------------------------------------------- bunting
  const flagGeo = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-.075, 0); s.lineTo(.075, 0); s.lineTo(0, -.2); s.closePath(); return s; })());
  const flagColors = ["#c3402f", "#f2d16b", "#2d8a6a", "#3b6ea5", "#e8a5b8", "#f4ead2"];
  const flagMats = flagColors.map((c) => { const mat = new THREE.MeshStandardMaterial({ color: c, roughness: .9, side: THREE.DoubleSide }); ctx.owned.push(mat); return mat; });
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
      B.add(flagGeo, flagMats[i % flagMats.length], [p.x, p.y, p.z], [0, Math.atan2(-dir.z, dir.x) + 0, (Math.random() - .5) * 0], { cast: false });
    }
  };
  line([ROOM.x0 + .05, H - .22, 0.6], [-1.4, H - .22, 0.6], .22, 16);
  line([-1.4, H - .22, .6], [ROOM.x0 + .05, H - .22, -2.8], .2, 20);
  line([.8, H - .2, ROOM.zBack + .1], [ROOM.x1 - .05, H - .2, ROOM.zBack + .1], .25, 20);
}
