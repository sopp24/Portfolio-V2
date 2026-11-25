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
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: decalTexture, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
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
