// Procedural characters: the shopkeeper (interactive AI host) and two decorative customers.
// Stylised, warm and slightly caricatured on purpose: no uncanny realism, but proper proportions,
// soft materials, eye-contact head tracking, breathing, blinking and gesture animation.
import * as THREE from "three";
import { SHOPKEEPER_POS } from "./layout.js";

const PI = Math.PI;

function headGeometry(r) {
  const g = new THREE.SphereGeometry(r, 40, 30);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = v.x / r, y = v.y / r, z = v.z / r;
    // proportions
    y *= 1.2; x *= .9; z *= 1.02;
    if (y < -.05) {
      const t = Math.min(1, (-y - .05) / 1.1);
      x *= 1 - .3 * t * t;
      z *= 1 - .08 * t;
      if (z > 0) z += .035 * t * Math.sin(Math.min(1, t * 1.4) * PI * .5) * (1 - Math.abs(x));
    }
    if (y > .55) y = .55 + (y - .55) * .86;
    // cheekbones
    z += .03 * Math.exp(-((y + .1) * (y + .1)) * 6) * Math.max(0, 1 - Math.abs(Math.abs(x) - .52) * 3) * (z > 0 ? 1 : 0);
    p.setXYZ(i, x * r, y * r, z * r);
  }
  g.computeVertexNormals();
  return g;
}

function limbGeometry(radius, length) {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 12);
  g.translate(0, -length / 2 - radius * .4, 0);
  return g;
}

function part(geometry, material, parent, { position, rotation, scale, cast = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) typeof scale === "number" ? mesh.scale.setScalar(scale) : mesh.scale.set(...scale);
  mesh.castShadow = cast; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// options: { skin, top, topInner, bottom, shoes, hair, hat, glasses, beard, height, build, legs }
export function buildHuman(ctx, o) {
  const m = ctx.materials;
  const root = new THREE.Group();
  const scale = o.height || 1;
  const build = o.build || 1;
  const hipY = .92;

  const body = new THREE.Group();
  body.position.y = hipY;
  root.add(body);

  // legs (customers only)
  if (o.legs !== false) {
    for (const s of [-1, 1]) {
      const leg = part(new THREE.CapsuleGeometry(.07 * build, .72, 6, 12), o.bottom, root, { position: [s * .1, .45, 0], scale: [1, 1, .9] });
      void leg;
      part(new THREE.BoxGeometry(.1, .07, .26), o.shoes, root, { position: [s * .1, .035, .05] });
    }
  }
  // hips / torso (lathe, elliptical)
  const profile = [[.16, -.04], [.18, .0], [.185, .2], [.2, .38], [.205, .5], [.18, .57], [.09, .62], [.0, .63]].map(([r, y]) => new THREE.Vector2(r * build, y));
  const torso = new THREE.Group();
  body.add(torso);
  const torsoMesh = part(new THREE.LatheGeometry(profile, 28), o.top, torso, { scale: [1.18, 1, .74] });
  void torsoMesh;
  // shirt collar/inner
  if (o.topInner) {
    part(new THREE.BoxGeometry(.15 * build, .42, .04), o.topInner, torso, { position: [0, .36, .136 * build], cast: false });
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(.075, .12, .02), o.topInner, torso, { position: [s * .05, .6, .1], rotation: [-.3, 0, s * .6], cast: false });
    for (let i = 0; i < 4; i++) part(new THREE.CylinderGeometry(.012, .012, .006, 10), m.plasticBlack, torso, { position: [0, .2 + i * .1, .16 * build], rotation: [PI / 2, 0, 0], cast: false });
  }
  // shoulders
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(.068 * build, 16, 12), o.top, torso, { position: [s * .225 * build, .56, 0], scale: [1, .95, 1] });
  // neck
  const neckMat = o.skin;
  part(new THREE.CylinderGeometry(.045, .052, .12, 16), neckMat, torso, { position: [0, .66, 0] });

  // head rig
  const headRig = new THREE.Group();
  headRig.position.set(0, .8, .01);
  torso.add(headRig);
  const r = .098;
  part(headGeometry(r), o.skin, headRig, {});
  // nose, ears, brows
  part(new THREE.SphereGeometry(.019, 14, 10), o.skin, headRig, { position: [0, -.015, r * 1.03], scale: [1, 1.5, 1.3], cast: false });
  part(new THREE.SphereGeometry(.014, 10, 8), o.skin, headRig, { position: [0, -.045, r * .98], scale: [1.7, .9, 1], cast: false });
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(.026, 12, 10), o.skin, headRig, { position: [s * r * .9, -.005, -.005], scale: [.5, 1.1, .8], cast: false });
    part(new THREE.CapsuleGeometry(.0045, .034, 4, 8), o.browMat || m.hairWhite, headRig, { position: [s * .034, .043, r * .93], rotation: [0, 0, PI / 2 + s * .08], cast: false });
  }
  // eyes (flattened for blinking)
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * .035, .018, r * .9);
    part(new THREE.SphereGeometry(.0125, 12, 10), m.eyeWhite, eye, { cast: false });
    part(new THREE.SphereGeometry(.0072, 10, 8), m.eyeDark, eye, { position: [0, 0, .0075], cast: false });
    headRig.add(eye);
    eyes.push(eye);
  }
  // mouth
  part(new THREE.CapsuleGeometry(.0035, .03, 4, 8), m.eyeDark, headRig, { position: [0, -.058, r * .93], rotation: [0, 0, PI / 2], cast: false });
  // glasses
  if (o.glasses) {
    for (const s of [-1, 1]) {
      part(new THREE.TorusGeometry(.027, .0028, 8, 28), m.glassesFrame, headRig, { position: [s * .036, .018, r * .98], cast: false });
      part(new THREE.CircleGeometry(.026, 20), m.lens, headRig, { position: [s * .036, .018, r * .975], cast: false });
      part(new THREE.CylinderGeometry(.0018, .0018, .105, 5), m.glassesFrame, headRig, { position: [s * .09, .02, r * .5], rotation: [PI / 2, 0, 0], cast: false });
    }
    part(new THREE.CylinderGeometry(.0018, .0018, .02, 5), m.glassesFrame, headRig, { position: [0, .022, r * .99], rotation: [0, 0, PI / 2], cast: false });
  }
  // beard + moustache
  if (o.beard) {
    const beard = part(new THREE.SphereGeometry(r * 1.01, 32, 20, 0, PI * 2, PI * .55, PI * .45), o.beard, headRig, { position: [0, -.012, .006], scale: [.94, 1.14, 1.02], cast: false });
    void beard;
    for (const s of [-1, 1]) {
      part(new THREE.CapsuleGeometry(.009, .04, 4, 8), o.beard, headRig, { position: [s * .02, -.043, r * 1.0], rotation: [0, 0, PI / 2 - s * .35], cast: false });
      part(new THREE.SphereGeometry(.03, 12, 10), o.beard, headRig, { position: [s * .06, -.06, r * .66], scale: [.8, 1.1, .9], cast: false });
    }
  }
  // hair / hat
  if (o.hair === "cap") {
    const capMat = o.hat;
    part(new THREE.SphereGeometry(r * 1.07, 32, 18, 0, PI * 2, 0, PI * .5), capMat, headRig, { position: [0, .028, -.002], scale: [1.0, .78, 1.12] });
    part(new THREE.BoxGeometry(r * 1.9, .01, r * .95), capMat, headRig, { position: [0, .06, r * .78], rotation: [-.16, 0, 0] });
    part(new THREE.SphereGeometry(r * .5, 20, 10, 0, PI * 2, 0, PI * .5), capMat, headRig, { position: [0, .1, r * .1], scale: [1.3, .35, 1.3], cast: false });
    // white hair at the back and sides
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(.036, 12, 10), m.hairWhite, headRig, { position: [s * r * .93, .0, -.03], scale: [.6, 1.1, 1.2], cast: false });
    part(new THREE.SphereGeometry(r * .98, 20, 12, 0, PI * 2, PI * .3, PI * .3), m.hairWhite, headRig, { position: [0, .0, -.028], scale: [1, 1, 1.0], cast: false });
  } else if (o.hair === "short") {
    part(new THREE.SphereGeometry(r * 1.06, 28, 16, 0, PI * 2, 0, PI * .55), o.hairMat, headRig, { position: [0, .02, -.006], scale: [1.0, .98, 1.08] });
  } else if (o.hair === "bun") {
    part(new THREE.SphereGeometry(r * 1.06, 28, 16, 0, PI * 2, 0, PI * .6), o.hairMat, headRig, { position: [0, .02, -.01], scale: [1.0, 1, 1.1] });
    part(new THREE.SphereGeometry(.045, 14, 10), o.hairMat, headRig, { position: [0, .12, -.07] });
  } else if (o.hair === "hood") {
    part(new THREE.SphereGeometry(r * 1.18, 28, 18, 0, PI * 2, 0, PI * .62), o.top, headRig, { position: [0, .015, -.03], scale: [1.05, 1.02, 1.0] });
  }
  // headphones around the neck / on ears
  if (o.headphones) {
    const hp = new THREE.Group();
    hp.position.set(0, .64, .0);
    part(new THREE.TorusGeometry(.115, .012, 8, 30, PI * 1.25), m.plasticBlack, hp, { rotation: [PI / 2 + .3, 0, PI * .87], cast: false });
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(.04, .04, .03, 18), m.plasticBlack, hp, { position: [s * .11, -.0, .06], rotation: [0, 0, PI / 2], cast: false });
    torso.add(hp);
  }

  // arms
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * .225 * build, .56, 0);
    torso.add(shoulder);
    part(limbGeometry(.048 * build, .27), o.sleeve || o.top, shoulder, {});
    const elbow = new THREE.Group();
    elbow.position.set(0, -.34, 0);
    shoulder.add(elbow);
    part(limbGeometry(.04 * build, .22), o.sleeve || o.top, elbow, {});
    const wrist = new THREE.Group();
    wrist.position.set(0, -.29, 0);
    elbow.add(wrist);
    part(new THREE.SphereGeometry(.04, 14, 10), o.skin, wrist, { position: [0, -.045, .005], scale: [.9, 1.35, .6] });
    part(new THREE.CapsuleGeometry(.011, .035, 4, 8), o.skin, wrist, { position: [s * -.038, -.032, .018], rotation: [0, 0, s * .6] });
    part(new THREE.CylinderGeometry(.044, .04, .03, 12), o.cuff || o.top, wrist, { position: [0, .0, 0] });
    arms[s === -1 ? "left" : "right"] = { shoulder, elbow, wrist };
  }
  // static pose defaults
  arms.left.shoulder.rotation.set(0, 0, -.08);
  arms.right.shoulder.rotation.set(0, 0, .08);

  root.scale.setScalar(scale);
  const rig = { root, body, torso, headRig, eyes, arms, blink: 0, nextBlink: 2 + Math.random() * 3 };
  return rig;
}

// ---------------------------------------------------------------------------------------------
// The shopkeeper: old, warm, passionate. Stands behind the counter facing the visitor.
// ---------------------------------------------------------------------------------------------
export function buildShopkeeper(ctx) {
  const m = ctx.materials;
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2f3a3a, roughness: .95, map: m.fabricGreen.map, normalMap: m.fabricGreen.normalMap });
  ctx.owned.push(capMat);
  const rig = buildHuman(ctx, {
    skin: m.skin, top: m.fabricGreen, topInner: m.fabricCream, sleeve: m.fabricGreen, cuff: m.fabricCream, bottom: m.fabricNavy, shoes: m.plasticBlack,
    hair: "cap", hat: capMat, glasses: true, beard: m.hairWhite, legs: false, height: 1.0, build: 1.06, headphones: true, browMat: m.hairWhite
  });
  const g = rig.root;
  g.position.copy(SHOPKEEPER_POS);
  g.rotation.y = -.22;
  rig.torso.rotation.x = .05;
  // working pose: left hand resting on the counter edge, right hand holding a record sleeve near the register
  rig.arms.left.shoulder.rotation.set(-.32, 0, -.1);
  rig.arms.left.elbow.rotation.set(-1.3, 0, 0);
  rig.arms.right.shoulder.rotation.set(-.4, 0, .14);
  rig.arms.right.elbow.rotation.set(-1.25, 0, 0);
  g.userData.pick = { kind: "shopkeeper", id: "shopkeeper" };
  rig.state = { greeting: 0, talking: 0, talkingTarget: 0, look: new THREE.Vector3(), headYaw: 0, headPitch: 0, music: 0 };
  ctx.scene.add(g);
  ctx.pickRoots.push(g);
  return rig;
}

export function updateShopkeeper(rig, dt, elapsed, { cameraPosition, greeting = false, talking = false, beat = 0 }) {
  const s = rig.state;
  const k = 1 - Math.exp(-4.5 * dt);
  s.greeting += ((greeting ? 1 : 0) - s.greeting) * (1 - Math.exp(-5 * dt));
  s.talkingTarget = talking ? 1 : 0;
  s.talking += (s.talkingTarget - s.talking) * k;
  // breathing and subtle sway
  rig.torso.scale.y = 1 + Math.sin(elapsed * 1.5) * .006;
  rig.torso.rotation.z = Math.sin(elapsed * .5) * .012;
  rig.body.position.y = .92 + Math.sin(elapsed * 1.5) * .0015;
  // head tracks the visitor (eye contact) within a natural range, plus idle drift
  const world = new THREE.Vector3();
  rig.headRig.getWorldPosition(world);
  const local = rig.root.worldToLocal(cameraPosition.clone());
  const yaw = Math.atan2(local.x - world.x + rig.root.position.x, local.z);
  const dy = cameraPosition.y - world.y;
  const dist = Math.hypot(local.x, local.z);
  const pitch = -Math.atan2(dy, dist);
  const targetYaw = THREE.MathUtils.clamp(yaw, -.9, .9) * (.5 + .4 * Math.max(s.talking, s.greeting));
  const targetPitch = THREE.MathUtils.clamp(pitch, -.3, .3) * .8;
  s.headYaw += (targetYaw - s.headYaw) * k;
  s.headPitch += (targetPitch - s.headPitch) * k;
  const nod = Math.sin(elapsed * 4.2) * .02 * beat + Math.sin(elapsed * 9) * .02 * s.talking;
  rig.headRig.rotation.set(s.headPitch + nod + Math.sin(elapsed * .7) * .015, s.headYaw + Math.sin(elapsed * .43) * .05, Math.sin(elapsed * .37) * .02);
  // blinking
  rig.nextBlink -= dt;
  if (rig.nextBlink <= 0) { rig.blink = .16; rig.nextBlink = 2.2 + Math.random() * 3.5; }
  rig.blink = Math.max(0, rig.blink - dt);
  const lid = rig.blink > 0 ? .1 : 1;
  for (const eye of rig.eyes) eye.scale.y += (lid - eye.scale.y) * .6;
  // arms: working idle, wave on greeting, gesture while talking
  const idle = Math.sin(elapsed * .8) * .02;
  const wave = s.greeting * (1 + Math.sin(elapsed * 10) * .15);
  rig.arms.right.shoulder.rotation.set(-.4 + s.greeting * .15, 0, .14 + wave * 1.9 + idle);
  rig.arms.right.elbow.rotation.set(-1.25 + s.greeting * .9 - s.talking * .15, 0, 0);
  rig.arms.right.wrist.rotation.z = Math.sin(elapsed * 10) * .4 * s.greeting;
  rig.arms.left.shoulder.rotation.set(-.32 - Math.sin(elapsed * 3.1) * .05 * s.talking, 0, -.1 - idle);
  rig.arms.left.elbow.rotation.set(-1.3 + Math.sin(elapsed * 2.3) * .14 * s.talking, 0, 0);
}

// ---------------------------------------------------------------------------------------------
// Customers (decor only)
// ---------------------------------------------------------------------------------------------
export function buildCustomers(ctx) {
  const m = ctx.materials;
  const out = [];
  // Customer A: browsing the left dig bins, hoodie + backpack
  const a = buildHuman(ctx, {
    skin: m.skinLight, top: m.fabricGrey, topInner: null, sleeve: m.fabricGrey, bottom: m.denim, shoes: m.plasticBeige,
    hair: "short", hairMat: m.hairDark, glasses: false, height: 1.0, build: .95, browMat: m.hairDark
  });
  a.root.position.set(-2.72, 0, -1.22);
  a.root.rotation.y = -PI / 2 + .1;
  a.torso.rotation.x = .28;
  a.arms.right.shoulder.rotation.set(-.75, 0, .12);
  a.arms.right.elbow.rotation.set(-.9, 0, 0);
  a.arms.left.shoulder.rotation.set(-.65, 0, -.12);
  a.arms.left.elbow.rotation.set(-.8, 0, 0);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .15), m.fabricRed);
  pack.position.set(0, .3, -.18); pack.castShadow = true; a.torso.add(pack);
  const sleeveCell = ctx.assets.decor.cells[3];
  const held = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), new THREE.MeshStandardMaterial({ map: ctx.assets.decor.texture, roughness: .6 }));
  const uv = held.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, sleeveCell.u0 + uv.getX(i) * (sleeveCell.u1 - sleeveCell.u0), sleeveCell.v0 + uv.getY(i) * (sleeveCell.v1 - sleeveCell.v0));
  held.position.set(0, -.09, .08); held.rotation.x = -.5;
  a.arms.right.wrist.add(held);
  ctx.scene.add(a.root);
  a.kind = "browser";
  out.push(a);

  // Customer B: browsing CDs on the right wall shelving, headphones around neck, jacket
  const b = buildHuman(ctx, {
    skin: m.skinDark, top: m.fabricNavy, topInner: m.fabricCream, sleeve: m.fabricNavy, bottom: m.fabricBlack, shoes: m.plasticBlack,
    hair: "bun", hairMat: m.hairDark, glasses: false, height: .96, build: .9, headphones: true, browMat: m.hairDark
  });
  b.root.position.set(3.0, 0, -1.7);
  b.root.rotation.y = PI / 2 - .1;
  b.torso.rotation.x = .08;
  b.arms.right.shoulder.rotation.set(-1.05, 0, .1);
  b.arms.right.elbow.rotation.set(-.95, 0, 0);
  b.arms.left.shoulder.rotation.set(-.1, 0, -.1);
  b.arms.left.elbow.rotation.set(-.5, 0, 0);
  ctx.scene.add(b.root);
  b.kind = "cd";
  out.push(b);
  return out;
}

export function updateCustomers(customers, dt, elapsed) {
  const [a, b] = customers;
  if (a) {
    a.torso.scale.y = 1 + Math.sin(elapsed * 1.4) * .006;
    // flipping through records
    const flip = Math.sin(elapsed * 1.1);
    a.arms.right.shoulder.rotation.x = -.75 - flip * .12;
    a.arms.left.shoulder.rotation.x = -.65 + flip * .1;
    a.headRig.rotation.x = .35 + Math.sin(elapsed * .6) * .05;
    a.headRig.rotation.y = Math.sin(elapsed * .3) * .15;
    a.torso.rotation.x = .28 + Math.sin(elapsed * 1.1) * .02;
  }
  if (b) {
    b.torso.scale.y = 1 + Math.sin(elapsed * 1.3 + 1) * .006;
    b.arms.right.shoulder.rotation.x = -1.05 + Math.sin(elapsed * .5) * .06;
    b.headRig.rotation.y = .5 + Math.sin(elapsed * .25) * .12;
    b.headRig.rotation.x = -.05 + Math.sin(elapsed * .4) * .04;
  }
}
