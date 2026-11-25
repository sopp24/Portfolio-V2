// The people of the shop: a rigged, sculpted shopkeeper (interactive AI host) and two customers.
// Characters are baked offline (scripts/characters) and loaded here; if the files cannot be loaded the
// procedural fallback in people-legacy.js is used so the shop is never empty.
import * as THREE from "three";
import { SHOPKEEPER_POS } from "./layout.js";
import { loadCharacter } from "./character.js";
import { addGlasses, addHeadphones } from "./character-accessories.js";
import * as legacy from "./people-legacy.js";

const BASE = new URL("../../assets/characters/", import.meta.url).href;
const lodFor = (quality) => (quality.id === "high" ? "hi" : "lo");
const ease = (t) => t * t * (3 - 2 * t);

async function load(id, quality) {
  try { return await loadCharacter(id, { lod: lodFor(quality), base: BASE }); }
  catch (error) {
    if (lodFor(quality) === "hi") { try { return await loadCharacter(id, { lod: "lo", base: BASE }); } catch { /* fall through */ } }
    console.warn(`Character "${id}" could not be loaded; using the procedural fallback.`, error);
    return null;
  }
}

function addPickProxies(character) {
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat);
  head.position.set(0, 0.1, 0.01);
  character.bones.head.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), mat);
  torso.position.set(0, 0.0, 0);
  character.bones.chest.add(torso);
  const arms = [];
  for (const side of ["L", "R"]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), mat);
    arm.position.set(0, -0.15, 0);
    character.bones[`upperArm.${side}`].add(arm);
    arms.push(arm);
  }
}

// ---------------------------------------------------------------------------------------------
// shopkeeper
// ---------------------------------------------------------------------------------------------
export async function buildShopkeeper(ctx) {
  const c = await load("shopkeeper", ctx.quality);
  if (!c) { const rig = legacy.buildShopkeeper(ctx); rig.legacy = true; return rig; }
  addGlasses(c, { color: 0x1b1713, radius: 0.0172, metal: 0.55 });
  c.root.position.copy(SHOPKEEPER_POS);
  c.root.rotation.y = -0.2;
  c.root.scale.setScalar(0.97);
  c.root.userData.pick = { kind: "shopkeeper", id: "shopkeeper" };
  addPickProxies(c);
  ctx.scene.add(c.root);
  ctx.pickRoots.push(c.root);
  return { char: c, root: c.root, greeting: 0, talking: 0 };
}

export function updateShopkeeper(rig, dt, elapsed, opts) {
  if (!rig) return;
  if (rig.legacy) return legacy.updateShopkeeper(rig, dt, elapsed, opts);
  const { cameraPosition, greeting = false, talking = false, beat = 0 } = opts;
  const c = rig.char, b = c.bones;
  rig.greeting += ((greeting ? 1 : 0) - rig.greeting) * (1 - Math.exp(-5 * dt));
  rig.talking += ((talking ? 1 : 0) - rig.talking) * (1 - Math.exp(-6 * dt));
  const g = ease(rig.greeting), t = rig.talking;
  const breathe = Math.sin(elapsed * 1.5);
  b.hips.rotation.set(0, 0, Math.sin(elapsed * 0.35) * 0.015);
  b.spine.rotation.set(0.06 + breathe * 0.008, 0, 0);
  b.chest.rotation.set(0.03 + breathe * 0.012 + Math.sin(elapsed * 4.2) * 0.006 * beat, Math.sin(elapsed * 0.3) * 0.02, 0);
  // character's left arm = +x side (screen right): rests on the counter, or waves
  b["upperArm.L"].rotation.set(-0.8 * (1 - g) - 0.15 * g, 0, -0.1 + g * 2.05 + Math.sin(elapsed * 0.8) * 0.01);
  b["foreArm.L"].rotation.set(-0.42 * (1 - g) - 0.55 * g + Math.sin(elapsed * 2.3) * 0.12 * t, 0, 0);
  b["hand.L"].rotation.set(0.1, 0, Math.sin(elapsed * 10) * 0.4 * g);
  // right arm: holding a sleeve near the register, gesturing while talking
  b["upperArm.R"].rotation.set(-0.72 - Math.sin(elapsed * 3.1) * 0.06 * t, 0, 0.1);
  b["foreArm.R"].rotation.set(-0.62 - 0.18 * t * (0.5 + 0.5 * Math.sin(elapsed * 2.6)), 0, 0);
  b["hand.R"].rotation.set(0.15, 0, 0);
  c.animateFace(dt, elapsed, { lookAt: cameraPosition, look: 0.5 + 0.45 * Math.max(t, g), talk: t, headYawLimit: 0.8 });
  b.head.rotation.x += Math.sin(elapsed * 4.2) * 0.02 * beat; // nodding to the music
}

// ---------------------------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------------------------
export async function buildCustomers(ctx) {
  const [a, b] = await Promise.all([load("visitor-a", ctx.quality), load("visitor-b", ctx.quality)]);
  if (!a || !b) { const list = legacy.buildCustomers(ctx); list.legacy = true; return list; }
  a.root.position.set(-2.72, 0, -1.22);
  a.root.rotation.y = -Math.PI / 2 + 0.1;
  a.root.scale.setScalar(0.99);
  b.root.position.set(3.0, 0, -1.7);
  b.root.rotation.y = Math.PI / 2 - 0.1;
  b.root.scale.setScalar(0.95);
  addHeadphones(b, { radius: 0.1, y: 0.205, drop: 0.09 });
  // the record the first customer is flipping through
  const cell = ctx.assets.decor.cells[3];
  const geo = new THREE.BoxGeometry(0.31, 0.31, 0.004);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cell.u0 + uv.getX(i) * (cell.u1 - cell.u0), cell.v0 + uv.getY(i) * (cell.v1 - cell.v0));
  const sleeve = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ctx.assets.decor.texture, roughness: 0.6 }));
  sleeve.position.set(0.0, -0.11, 0.045);
  sleeve.rotation.set(0.15, 0, 0);
  sleeve.castShadow = true;
  a.bones["hand.R"].add(sleeve);
  ctx.scene.add(a.root, b.root);
  const list = [{ char: a, kind: "browser" }, { char: b, kind: "cd" }];
  return list;
}

export function updateCustomers(customers, dt, elapsed) {
  if (!customers) return;
  if (customers.legacy) return legacy.updateCustomers(customers, dt, elapsed);
  const [A, B] = customers;
  if (A) {
    const c = A.char, b = c.bones;
    const flip = Math.sin(elapsed * 1.1);
    b.hips.rotation.set(0, 0, Math.sin(elapsed * 0.4) * 0.01);
    b.spine.rotation.set(0.2 + Math.sin(elapsed * 1.1) * 0.015, 0, 0);
    b.chest.rotation.set(0.1 + Math.sin(elapsed * 1.5) * 0.008, 0, 0);
    b["upperArm.R"].rotation.set(-0.62 - flip * 0.1, 0, 0.08);
    b["foreArm.R"].rotation.set(-0.8 - flip * 0.14, 0, 0);
    b["hand.R"].rotation.set(0.35 + flip * 0.1, 0, 0);
    b["upperArm.L"].rotation.set(-0.58 + flip * 0.08, 0, -0.1);
    b["foreArm.L"].rotation.set(-0.75, 0, 0);
    c.animateFace(dt, elapsed, { lookAt: null, look: 0, restPitch: 0.42 + Math.sin(elapsed * 0.7) * 0.05, restYaw: Math.sin(elapsed * 0.3) * 0.22 });
  }
  if (B) {
    const c = B.char, b = c.bones;
    b.hips.rotation.set(0, 0, Math.sin(elapsed * 0.35) * 0.012);
    b.spine.rotation.set(0.04, 0, 0);
    b.chest.rotation.set(0.02 + Math.sin(elapsed * 1.4 + 1) * 0.008, 0, 0);
    b["upperArm.R"].rotation.set(-1.25 + Math.sin(elapsed * 0.5) * 0.05, 0, 0.12);
    b["foreArm.R"].rotation.set(-0.55, 0, 0);
    b["hand.R"].rotation.set(0.2, 0, 0);
    b["upperArm.L"].rotation.set(-0.08, 0, -0.12);
    b["foreArm.L"].rotation.set(-0.35, 0, 0);
    c.animateFace(dt, elapsed, { lookAt: null, look: 0, restPitch: -0.03 + Math.sin(elapsed * 0.4) * 0.03, restYaw: 0.1 + Math.sin(elapsed * 0.25) * 0.12 });
  }
}
