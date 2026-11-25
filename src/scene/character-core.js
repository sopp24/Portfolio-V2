// Runtime side of the baked characters: binary loader, skeleton, skinned parts and the shading patches
// (fake subsurface scattering for skin, triplanar micro-detail for fabric and skin pores).
import * as THREE from "three";

// ---------------------------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------------------------
const cache = new Map();
export function loadCharacterFiles(base) {
  if (cache.has(base)) return cache.get(base);
  const promise = (async () => {
    const [manifestRes, binRes] = await Promise.all([fetch(base + ".json"), fetch(base + ".bin")]);
    if (!manifestRes.ok || !binRes.ok) throw new Error("Character files missing: " + base);
    return { manifest: await manifestRes.json(), buffer: await binRes.arrayBuffer() };
  })();
  cache.set(base, promise);
  promise.catch(() => cache.delete(base));
  return promise;
}

const srgbToLinear = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; table[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  return table;
})();

export function buildGeometry(manifest, part, buffer) {
  const n = part.vertexCount;
  const q = new Int16Array(buffer, part.pos, n * 3);
  const nrm = new Int8Array(buffer, part.nrm, n * 3);
  const col = new Uint8Array(buffer, part.col, n * 3);
  const sIdx = new Uint8Array(buffer, part.sIdx, n * 4);
  const sWgt = new Uint8Array(buffer, part.sWgt, n * 4);
  const idx = new Uint16Array(buffer, part.idx, part.indexCount);
  const pos = new Float32Array(n * 3), normals = new Float32Array(n * 3), colors = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    for (let a = 0; a < 3; a++) {
      const ext = part.max[a] - part.min[a];
      pos[v * 3 + a] = part.min[a] + ((q[v * 3 + a] + 32768) / 65535) * ext;
      normals[v * 3 + a] = nrm[v * 3 + a] / 127;
      colors[v * 3 + a] = srgbToLinear[col[v * 3 + a]];
    }
    const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
    normals[v * 3] /= l; normals[v * 3 + 1] /= l; normals[v * 3 + 2] /= l;
    for (let i = 0; i < 4; i++) { skinIndex[v * 4 + i] = sIdx[v * 4 + i]; skinWeight[v * 4 + i] = sWgt[v * 4 + i] / 255; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function buildSkeleton(manifest) {
  const bones = manifest.bones.map((b) => { const bone = new THREE.Bone(); bone.name = b.name; bone.position.set(...b.pos); return bone; });
  manifest.bones.forEach((b, i) => { if (b.parent) bones.find((x) => x.name === b.parent).add(bones[i]); });
  return bones;
}

// ---------------------------------------------------------------------------------------------
// shading
// ---------------------------------------------------------------------------------------------
let noiseTexture = null;
function detailTexture() {
  if (noiseTexture) return noiseTexture;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  // tileable value-noise fbm
  const grid = (period, seed) => {
    let a = seed >>> 0;
    const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const g = new Float32Array(period * period); for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x, y) => {
      const fx = (x / size) * period, fy = (y / size) * period; const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const p = (i, j) => g[((j % period) * period) + (i % period)];
      return (p(ix, iy) * (1 - sx) + p(ix + 1, iy) * sx) * (1 - sy) + (p(ix, iy + 1) * (1 - sx) + p(ix + 1, iy + 1) * sx) * sy;
    };
  };
  const n1 = grid(8, 1), n2 = grid(32, 2), n3 = grid(64, 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = n1(x, y) * 0.3 + n2(x, y) * 0.4 + n3(x, y) * 0.3;
    const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255); data[i + 3] = 255;
  }
  noiseTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.magFilter = THREE.LinearFilter; noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTexture.generateMipmaps = true; noiseTexture.needsUpdate = true;
  return noiseTexture;
}

const DETAIL_VERT_PARS = "varying vec3 vObjPos; varying vec3 vObjNrm;";
const DETAIL_FRAG_PARS = `
uniform sampler2D tDetail; uniform float uDetailScale; uniform float uDetailBump; uniform float uDetailAlbedo;
varying vec3 vObjPos; varying vec3 vObjNrm;
float triDetail(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(tDetail, p.yz * uDetailScale).r * w.x + texture2D(tDetail, p.xz * uDetailScale).r * w.y + texture2D(tDetail, p.xy * uDetailScale).r * w.z;
}
vec3 perturbDetail(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz)); vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`;

/**
 * Patches a MeshPhysicalMaterial with:
 *  - triplanar micro-detail bump (skin pores / fabric weave) in object space,
 *  - optional wrapped diffuse + tinted terminator (cheap subsurface scattering).
 */
export function patchCharacterMaterial(material, { detailScale = 60, detailBump = 0.4, detailAlbedo = 0.0, sss = null, key = "char" } = {}) {
  const uniforms = {
    tDetail: { value: detailTexture() }, uDetailScale: { value: detailScale }, uDetailBump: { value: detailBump }, uDetailAlbedo: { value: detailAlbedo },
    uSSSWrap: { value: sss ? sss.wrap : 0 }, uSSSColor: { value: new THREE.Color(sss ? sss.color : 0xffffff) }
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + DETAIL_VERT_PARS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = position; vObjNrm = normal;");
    let physical = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (sss) {
      physical = "uniform float uSSSWrap; uniform vec3 uSSSColor;\n" + physical.replace(
        "reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );",
        `{
          float wrapNL = saturate((dot(geometryNormal, directLight.direction) + uSSSWrap) / (1.0 + uSSSWrap));
          vec3 wrapIrr = max(wrapNL - dotNL, 0.0) * directLight.color * uSSSColor;
          reflectedLight.directDiffuse += (irradiance + wrapIrr) * diffuseBRDF * ( 1.0 - F );
        }`
      );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_physical_pars_fragment>", physical)
      .replace("#include <common>", "#include <common>\n" + DETAIL_FRAG_PARS)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          float dh = triDetail(vObjPos, normalize(vObjNrm));
          vec2 dHdxy = vec2(dFdx(dh), dFdy(dh)) * uDetailBump;
          normal = perturbDetail(-vViewPosition, normal, dHdxy, faceDirection);
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        diffuseColor.rgb *= 1.0 + (triDetail(vObjPos * 0.5, normalize(vObjNrm)) - 0.5) * uDetailAlbedo;`);
  };
  material.customProgramCacheKey = () => "character-" + key + (sss ? "-sss" : "");
  material.userData.uniforms = uniforms;
  return material;
}

export function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.52, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45,
    sheen: 0.5, sheenColor: new THREE.Color(0xffd7c0), sheenRoughness: 0.55, envMapIntensity: 0.8, name: "skin"
  });
  return patchCharacterMaterial(m, { detailScale: 95, detailBump: 0.5, detailAlbedo: 0.06, sss: { wrap: 0.55, color: 0xff6a4a }, key: "skin" });
}

export function clothMaterial({ roughness = 0.9, detailScale = 120, bump = 1.2, sheen = 0.12 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness, metalness: 0, sheen, sheenColor: new THREE.Color(0x8a8a8a), sheenRoughness: 0.9, envMapIntensity: 0.6, name: "cloth"
  });
  return patchCharacterMaterial(m, { detailScale, detailBump: bump, detailAlbedo: 0.12, key: "cloth" });
}

export function hairMaterial({ roughness = 0.46, clearcoat = 0.22 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xffe0c0), sheenRoughness: 0.4, envMapIntensity: 1.0, name: "hair"
  });
  return patchCharacterMaterial(m, { detailScale: 220, detailBump: 0.35, detailAlbedo: 0.08, sss: { wrap: 0.25, color: 0xffb080 }, key: "hair" });
}

export function plainMaterial({ roughness = 0.6, metalness = 0 } = {}) {
  return patchCharacterMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness, metalness, envMapIntensity: 0.7, name: "plain" }), { detailScale: 80, detailBump: 0.3, key: "plain" });
}

export const MATERIAL_FACTORY = { skin: skinMaterial, cloth: clothMaterial, knit: () => clothMaterial({ roughness: 0.95, detailScale: 90, bump: 2.0, sheen: 0.18 }), denim: () => clothMaterial({ roughness: 0.85, detailScale: 160, bump: 1.6 }), hair: hairMaterial, fur: () => hairMaterial({ roughness: 0.7, clearcoat: 0.03 }), plain: plainMaterial, shoe: () => plainMaterial({ roughness: 0.5 }), leather: () => plainMaterial({ roughness: 0.4 }) };
