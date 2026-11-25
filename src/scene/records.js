// The vinyl assets: a physically-built record (gatefold-style sleeve with hinged cover + disc),
// and instanced "filler" sleeves that make the bins feel full without hundreds of draw calls.
import * as THREE from "three";
import { rng, createCanvas, textureFrom, noiseField, grayCanvas, canvasFromImageData, normalFromHeight, mixHex } from "./util.js";
import { drawProjectCover, drawProjectBack, drawProjectInner, FONT } from "./artwork.js";

export const SLEEVE = { size: .314, t: .0025, gap: .0016, disc: .3048 / 2 };
const RING = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// Vinyl grooves: concentric micro-rings as normal + roughness maps (shared by every disc)
// ---------------------------------------------------------------------------------------------
let grooveSet = null;
export function getGrooveSet(quality) {
  if (grooveSet) return grooveSet;
  const size = quality.id === "low" ? 512 : 1024;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const noise = noiseField(size, 40, 3);
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / c; // 0..1 across the disc diameter
    const i = y * size + x;
    // lead-in, three "tracks" with brighter lanes between, run-out
    const groove = Math.sin(r * 620) * .5 + .5;
    const lane = (r > .39 && r < .43) || (r > .6 && r < .625) || (r > .8 && r < .82) ? 1 : 0;
    height[i] = groove * (lane ? .08 : .55) + (noise[i] - .5) * .08;
    rough[i] = .3 + (lane ? .12 : 0) + (noise[i] - .5) * .1 + groove * .08;
  }
  const normal = textureFrom(canvasFromImageData(normalFromHeight(height, size, 1.4), size), { srgb: false, repeat: false, anisotropy: 4 });
  const roughness = textureFrom(grayCanvas(rough, size), { srgb: false, repeat: false, anisotropy: 4 });
  grooveSet = { normal, roughness };
  return grooveSet;
}

function discMaterials(quality, materials) {
  const grooves = getGrooveSet(quality);
  const face = new THREE.MeshPhysicalMaterial({
    color: 0x090909, roughness: 1, metalness: .2, clearcoat: .6, clearcoatRoughness: .12,
    normalMap: grooves.normal, normalScale: new THREE.Vector2(.7, .7), roughnessMap: grooves.roughness,
    envMapIntensity: 1.1, name: "discFace"
  });
  if ("anisotropy" in face) face.anisotropy = .8;
  return { face, rim: materials.vinyl };
}

function labelTexture(project, index) {
  const c = createCanvas(256);
  const g = c.getContext("2d");
  const [c0, c1, c2] = project.artwork || ["#b45a3a", "#e0b474", "#182e38"];
  g.fillStyle = c0; g.beginPath(); g.arc(128, 128, 128, 0, RING); g.fill();
  g.fillStyle = c1; g.beginPath(); g.arc(128, 128, 118, 0, RING); g.fill();
  g.fillStyle = c0; g.beginPath(); g.arc(128, 128, 96, 0, RING); g.fill();
  g.fillStyle = "#f3e9d1";
  g.font = `400 26px ${FONT.display}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("SIDE A", 128, 92);
  g.font = `500 11px ${FONT.sans}`;
  const title = String((project.title && project.title.fr) || project.id).toUpperCase();
  g.fillText(title.length > 24 ? title.slice(0, 23) + "…" : title, 128, 148);
  g.font = `10px ${FONT.type}`; g.fillText(`CAT. ${String(index + 1).padStart(3, "0")} · 33⅓ RPM`, 128, 168);
  g.fillStyle = c2; g.beginPath(); g.arc(128, 128, 8, 0, RING); g.fill();
  g.fillStyle = "#151515"; g.beginPath(); g.arc(128, 128, 3.2, 0, RING); g.fill();
  return textureFrom(c, { srgb: true, repeat: false });
}

// ---------------------------------------------------------------------------------------------
// A single physical record. Faces +z. `flap` hinges on the left edge; `disc` slides out on open.
// ---------------------------------------------------------------------------------------------
export function createRecord({ project, index, quality, materials, edgeMaterial, paperNormal, kind = "project" }) {
  const { size: S, t, gap, disc: R } = SLEEVE;
  const group = new THREE.Group();
  group.name = "record:" + project.id;

  const frontCanvas = drawProjectCover(project, index, quality.coverSize);
  const frontTexture = textureFrom(frontCanvas, { srgb: true, repeat: false, anisotropy: quality.anisotropy });

  // Final artwork hook: set `project.cover.front` (image URL) to replace the generated provisional sleeve.
  if (project.cover && project.cover.front) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { frontTexture.image = img; frontTexture.needsUpdate = true; };
    img.onerror = () => console.warn("Cover image failed to load:", project.cover.front);
    img.src = project.cover.front;
  }

  const makeFace = (map) => new THREE.MeshPhysicalMaterial({
    map, roughness: .62, metalness: 0, clearcoat: .1, clearcoatRoughness: .4, normalMap: paperNormal || null,
    normalScale: new THREE.Vector2(.25, .25), envMapIntensity: .8, name: "sleeveFace"
  });
  const frontMat = makeFace(frontTexture);
  const innerPaper = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: .85, name: "sleeveInner" });
  const backPaper = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: .85, name: "sleeveBack" });
  const innerLeftMat = innerPaper.clone();
  const edge = edgeMaterial;

  // back board (carries the back cover on -z and the right inner panel on +z)
  const back = new THREE.Mesh(new THREE.BoxGeometry(S, S, t), [edge, edge, edge, edge, innerPaper, backPaper]);
  back.castShadow = true; back.receiveShadow = true;
  group.add(back);

  // hinged front cover
  const flap = new THREE.Group();
  flap.position.set(-S / 2, 0, t / 2 + gap + t / 2);
  const front = new THREE.Mesh(new THREE.BoxGeometry(S, S, t), [edge, edge, edge, edge, frontMat, innerLeftMat]);
  front.position.x = S / 2;
  front.castShadow = true; front.receiveShadow = true;
  flap.add(front);
  group.add(flap);

  // disc assembly
  const discGroup = new THREE.Group();
  const dm = discMaterials(quality, materials);
  const faceGeo = new THREE.CircleGeometry(R, 96);
  const faceA = new THREE.Mesh(faceGeo, dm.face);
  faceA.position.z = .0006;
  const faceB = new THREE.Mesh(faceGeo, dm.face);
  faceB.rotation.y = Math.PI; faceB.position.z = -.0006;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .0012, 96, 1, true), dm.rim);
  rim.rotation.x = Math.PI / 2;
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(project, index), roughness: .75 });
  const label = new THREE.Mesh(new THREE.CircleGeometry(.05, 48), labelMat);
  label.position.z = .00075;
  const labelB = label.clone(); labelB.rotation.y = Math.PI; labelB.position.z = -.00075;
  discGroup.add(faceA, faceB, rim, label, labelB);
  discGroup.position.set(0, 0, t / 2 + gap / 2);
  discGroup.traverse((o) => { o.castShadow = o !== label && o !== labelB; });
  group.add(discGroup);

  const state = {
    kind, project, index, group, flap, disc: discGroup, frontMat, innerLeftMat, innerRight: innerPaper, backMat: backPaper,
    detailLang: null, detailCache: new Map(), frontTexture, labelMat, discHome: discGroup.position.clone()
  };
  group.userData.record = state;
  group.userData.kind = kind;
  group.userData.projectId = project.id;
  return state;
}

// Builds (or reuses) the readable liner notes + inner spread for a record in a language.
export function ensureRecordDetail(record, lang, quality) {
  if (record.detailLang === lang) return;
  const cached = record.detailCache.get(lang);
  const size = quality.id === "low" ? 768 : 1024;
  let entry = cached;
  if (!entry) {
    const back = textureFrom(drawProjectBack(record.project, lang, record.index, size), { srgb: true, repeat: false, anisotropy: quality.anisotropy });
    if (record.project.cover && record.project.cover.back) {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { back.image = img; back.needsUpdate = true; };
      img.src = record.project.cover.back;
    }
    const innerCanvas = drawProjectInner(record.project, lang, record.index, size);
    // split the spread into two textures (left = front cover inner, right = back inner)
    const half = (x) => {
      const c = createCanvas(size);
      c.getContext("2d").drawImage(innerCanvas, x, 0, size, size, 0, 0, size, size);
      return textureFrom(c, { srgb: true, repeat: false, anisotropy: quality.anisotropy });
    };
    entry = { back, left: half(0), right: half(size) };
    record.detailCache.set(lang, entry);
  }
  // BoxGeometry orients each face's UVs for a viewer outside it, so no mirroring is needed.
  for (const [mat, map] of [[record.backMat, entry.back], [record.innerLeftMat, entry.left], [record.innerRight, entry.right]]) {
    mat.map = map; mat.color.set(0xd9d3c6); mat.needsUpdate = true; // slightly below pure white so lit paper never clips
  }
  record.detailLang = lang;
}

export function disposeRecord(record) {
  record.frontTexture.dispose();
  record.labelMat.map?.dispose();
  for (const entry of record.detailCache.values()) { entry.back.dispose(); entry.left.dispose(); entry.right.dispose(); }
}

// ---------------------------------------------------------------------------------------------
// Instanced filler sleeves with per-instance atlas cell
// ---------------------------------------------------------------------------------------------
export function createFillerSystem({ decorAtlas, quality, edgeMaterial, capacity = 900 }) {
  const { size: S } = SLEEVE;
  const geometry = new THREE.BoxGeometry(S, S, .0032);
  const uvAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const faceMat = new THREE.MeshStandardMaterial({ map: decorAtlas.texture, roughness: .62, metalness: 0, envMapIntensity: .7, name: "fillerFace" });
  faceMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 instanceUV;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = instanceUV.xy + vMapUv * instanceUV.zw;\n#endif");
  };
  faceMat.customProgramCacheKey = () => "fillerFace";
  const back = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: .9, name: "fillerBack" });
  const mesh = new THREE.InstancedMesh(geometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, faceMat, back], capacity);
  mesh.geometry.setAttribute("instanceUV", uvAttr);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const rand = rng(1234);
  let n = 0;

  // Add a row of records standing in a bin. `origin` is the world position of the first slot
  // (bottom of the sleeves at origin.y); records pack along the bin's local -z (rotated by rotY)
  // and lean backwards by `lean` radians.
  const rotation = new THREE.Quaternion();
  const local = new THREE.Vector3();
  function addRow(parent, { origin, rotY = 0, width = S, count, lean = .16, pitch = .0105, skip = 0, jitter = .004 }) {
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    for (let i = 0; i < count; i++) {
      if (n >= capacity) return;
      const cell = decorAtlas.cells[Math.floor(rand() * decorAtlas.cells.length)];
      const flip = rand() < .5;
      uvAttr.setXYZW(n, flip ? cell.u1 : cell.u0, cell.v0, flip ? cell.u0 - cell.u1 : cell.u1 - cell.u0, cell.v1 - cell.v0);
      const l = lean + (rand() - .5) * .05 + (i > count * .6 ? (i - count * .6) * .006 : 0);
      local.set((rand() - .5) * jitter, S / 2 * Math.cos(l) + (rand() - .5) * .006, -(i + skip) * pitch).applyQuaternion(rotation);
      dummy.position.set(origin[0] + local.x, origin[1] + local.y, origin[2] + local.z);
      dummy.quaternion.copy(rotation);
      dummy.rotateX(-l);
      dummy.rotateY((rand() - .5) * .03);
      dummy.scale.set(width / S, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      n++;
    }
    mesh.count = n;
    uvAttr.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (!mesh.parent) parent.add(mesh);
  }
  return { mesh, addRow, get count() { return n; } };
}

export { RING, mixHex };
