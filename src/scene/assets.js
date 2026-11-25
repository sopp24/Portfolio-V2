// Builds the shared artwork atlases (decor covers, posters, stickers) and exposes UV helpers.
import * as THREE from "three";
import { drawDecorAtlas, drawPosterAtlas, drawStickerAtlas, drawAppCase, ensureFonts, tex } from "./artwork.js";
import { textureFrom } from "./util.js";

export async function buildAssets(quality, applications, onStep = () => {}) {
  await ensureFonts();
  onStep("fonts");
  const decor = drawDecorAtlas(quality.id === "low" ? 256 : 512);
  const decorTexture = textureFrom(decor.canvas, { srgb: true, repeat: false, anisotropy: quality.anisotropy });
  onStep("covers");
  const poster = drawPosterAtlas(quality.id === "low" ? 256 : 512, quality.id === "low" ? 360 : 720);
  const posterTexture = textureFrom(poster.canvas, { srgb: true, repeat: false, anisotropy: quality.anisotropy });
  onStep("posters");
  const sticker = drawStickerAtlas(quality.id === "low" ? 128 : 256);
  const stickerTexture = textureFrom(sticker.canvas, { srgb: true, repeat: false, anisotropy: quality.anisotropy });
  onStep("stickers");
  return {
    decor: { ...decor, texture: decorTexture },
    poster: { ...poster, texture: posterTexture },
    sticker: { ...sticker, texture: stickerTexture },
    applications
  };
}

// Plane geometry whose UVs are remapped to an atlas cell (cell: {u0,v0,u1,v1}).
const planeCache = new Map();
export function atlasPlane(width, height, cell, flipU = false) {
  const key = [width, height, cell.u0, cell.v0, cell.u1, cell.v1, flipU].join("|");
  let g = planeCache.get(key);
  if (g) return g;
  g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, cell.u0 + (flipU ? 1 - u : u) * (cell.u1 - cell.u0), cell.v0 + v * (cell.v1 - cell.v0));
  }
  planeCache.set(key, g);
  return g;
}

export { drawAppCase, tex };
