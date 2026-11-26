// Small building blocks shared by the furniture / props builders.
import * as THREE from "three";
import { createCanvas, textureFrom } from "./util.js";
import { drawSignBoard, FONT } from "./artwork.js";

// A localized canvas texture: `draw(lang)` returns a canvas. Re-rendered on language change.
export function localizedTexture(ctx, draw, options = {}) {
  const texture = textureFrom(draw(ctx.lang), { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy, ...options });
  ctx.localized.push({ texture, draw });
  return texture;
}

// Painted board sign (plane) — either fixed text or a function of language.
export function addSign(ctx, { text, draw = null, width = 1, height = .25, position, rotationY = 0, rotationX = 0, bg, fg, border, sub, font, emissive = 0, parent = null }) {
  const drawer = draw || ((lang) => drawSignBoard(typeof text === "function" ? text(lang) : text, {
    width: Math.round(width * 1024), height: Math.round(height * 1024), bg, fg, border, font, sub: typeof sub === "function" ? sub(lang) : sub
  }));
  const texture = localizedTexture(ctx, drawer);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .6, metalness: 0, emissive: emissive ? new THREE.Color(0xffffff) : new THREE.Color(0), emissiveMap: emissive ? texture : null, emissiveIntensity: emissive });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(...position);
  mesh.rotation.set(rotationX, rotationY, 0, "YXZ");
  mesh.castShadow = false;
  (parent || ctx.scene).add(mesh);
  ctx.owned.push(material);
  return mesh;
}

// Soft contact-shadow decal lying on a horizontal surface (alpha-blended black quad).
let decalTexture = null;
export function addContactShadow(ctx, { x, y = .004, z, width, depth, opacity = .5, rotationY = 0 }) {
  if (!decalTexture) {
    const c = createCanvas(128);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(.55, "rgba(0,0,0,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    decalTexture = textureFrom(c, { srgb: false, repeat: false, mipmaps: false });
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, map: decalTexture, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.set(-Math.PI / 2, 0, rotationY);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 1;
  ctx.scene.add(mesh);
  ctx.owned.push(mat);
  return mesh;
}

// Wooden record bin (open-top crate) added to the batcher. Local origin = bottom centre; opening faces +z.
export function addBin(ctx, { x, y, z, width = 1.18, depth = .5, rotY = 0, frontHeight = .1, sideHeight = .27, backHeight = .3, material = null }) {
  const B = ctx.batcher, wood = material || ctx.materials.oak;
  const t = .02;
  const place = (lx, ly, lz) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  };
  const rot = [0, rotY, 0];
  B.box(width, t, depth, wood, place(0, t / 2, 0), rot, { bevel: .004 });
  B.box(width, frontHeight, t, wood, place(0, frontHeight / 2, depth / 2 - t / 2), rot, { bevel: .004 });
  B.box(width, backHeight, t, wood, place(0, backHeight / 2, -depth / 2 + t / 2), rot, { bevel: .004 });
  for (const sx of [-1, 1]) B.box(t, sideHeight, depth - t * 2, wood, place(sx * (width / 2 - t / 2), sideHeight / 2, 0), rot, { bevel: .004 });
  return { inner: { floor: y + t, front: z + depth / 2 - t, width: width - t * 2 } };
}
export { FONT };

// A stock carton with packing tape over the top seam and down one face, plus a shipping label
// (barcode, address lines, a "this side up" arrow). `face` = the yaw (relative to the box) of the labelled face.
export function addCardboardBox(ctx, w, h, d, position, rotY = 0, face = 0) {
  const B = ctx.batcher, m = ctx.materials;
  if (!ctx.boxKit) {
    const c = createCanvas(256, 160);
    const g = c.getContext("2d");
    g.fillStyle = "#f1ede2"; g.fillRect(0, 0, 256, 160);
    g.fillStyle = "#1c1b19";
    for (let i = 0, x = 14; x < 150; i++) { const bw = 2 + ((i * 7) % 4); g.fillRect(x, 16, bw, 46); x += bw + 2 + ((i * 5) % 3); } // barcode
    for (let i = 0; i < 5; i++) g.fillRect(14, 78 + i * 15, 118 - ((i * 23) % 40), 5);
    g.strokeStyle = "#c2382b"; g.lineWidth = 6; g.strokeRect(160, 14, 82, 82);
    g.fillStyle = "#c2382b"; g.beginPath(); g.moveTo(201, 24); g.lineTo(228, 58); g.lineTo(212, 58); g.lineTo(212, 86); g.lineTo(190, 86); g.lineTo(190, 58); g.lineTo(174, 58); g.closePath(); g.fill();
    g.font = "700 20px sans-serif"; g.fillStyle = "#1c1b19"; g.fillText("FRAGILE", 150, 128);
    const label = textureFrom(c, { srgb: true, repeat: false, anisotropy: ctx.quality.anisotropy });
    const labelMat = new THREE.MeshStandardMaterial({ map: label, roughness: .75, envMapIntensity: .5, name: "boxLabel" });
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd6c392, roughness: .3, metalness: 0, envMapIntensity: .8, name: "tape" });
    ctx.owned.push(labelMat, tapeMat, label);
    ctx.boxKit = { labelMat, tapeMat, labelGeo: new THREE.PlaneGeometry(1, .625), stripGeo: new THREE.BoxGeometry(1, 1, 1) };
  }
  const { labelMat, tapeMat, labelGeo, stripGeo } = ctx.boxKit;
  B.box(w, h, d, m.cardboard, position, [0, rotY, 0], { bevel: .004, tile: .5 });
  const at = (x, y, z, yaw = 0) => {
    const a = rotY + yaw, ox = x * Math.cos(rotY) + z * Math.sin(rotY), oz = -x * Math.sin(rotY) + z * Math.cos(rotY);
    return { pos: [position[0] + ox, position[1] + y, position[2] + oz], rot: [0, a, 0] };
  };
  const top = at(0, h / 2 + .0016, 0);
  B.add(stripGeo, tapeMat, top.pos, top.rot, { cast: false, scale: [w * .15, .0032, d + .004] });
  // the labelled face: half-extent depends on whether it is a long or a short side
  const half = Math.abs(Math.cos(face)) * d / 2 + Math.abs(Math.sin(face)) * w / 2;
  const fx = Math.sin(face), fz = Math.cos(face);
  const tape = at(fx * (half + .0016), h * .3, fz * (half + .0016), face);
  B.add(stripGeo, tapeMat, tape.pos, tape.rot, { cast: false, scale: [w * .15, h * .42, .0032] });
  const label = at(fx * (half + .0026) + fz * w * .2, -h * .02, fz * (half + .0026) - fx * w * .2, face);
  B.add(labelGeo, labelMat, label.pos, label.rot, { cast: false, scale: [Math.min(w, d) * .5, Math.min(w, d) * .5, 1] });
}
