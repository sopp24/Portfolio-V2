// Picking + physical handling of records and application cases.
//  - pointer ray picking (mouse hover / tap) against registered pick roots
//  - subtle hover reaction (records lift, cases slide out) — no outlines, no icons
//  - "present": a record is slid out of its bin, arcs to the camera, can be dragged (springs to a face),
//    flipped to Side B, opened (gatefold flap swings, disc slides out) and returned to its slot.
import * as THREE from "three";
import { SLEEVE, ensureRecordDetail } from "./records.js";
import { softDotTexture } from "./textures.js";

const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function findPick(object) {
  let o = object;
  while (o) { if (o.userData && o.userData.pick) return o; o = o.parent; }
  return null;
}

export function createInteraction({ scene, camera, canvas, pickRoots, records, apps, quality, getLanguage, postfx, look, onHover, onSelect, onHeldChange, onSound, onHold, reducedMotion }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 40;
  const ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, active: false, dirty: true, type: "mouse" };
  let hovered = null;
  let active = false;
  let held = null;      // { root, record|null, kind, home, t, state, ... }
  let destroyed = false;
  let hints = false;
  const recordByGroup = new Map(records.map((r) => [r.group, r]));
  const markers = new Map();
  const pulses = [];
  let pickTimer = 0;

  // capture rest transforms of non-record pick roots for hover animation
  for (const root of pickRoots) {
    if (!root.userData.home) root.userData.home = { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() };
    root.userData.hover = 0;
  }

  function markersFor(root) {
    let marker = markers.get(root);
    if (marker) return marker;
    const material = new THREE.SpriteMaterial({ map: softDotTexture(64), color: 0xfff1c9, transparent: true, depthTest: false, depthWrite: false, opacity: .0, blending: THREE.AdditiveBlending });
    marker = new THREE.Sprite(material);
    marker.renderOrder = 20;
    marker.scale.setScalar(.12);
    marker.userData.isMarker = true;
    scene.add(marker);
    markers.set(root, marker);
    return marker;
  }

  function updateMarkers(time) {
    const show = hints || pulses.length;
    for (const root of pickRoots) {
      const needed = hints || pulses.some((p) => p.root === root);
      const marker = needed ? markersFor(root) : markers.get(root);
      if (!marker) continue;
      const pulse = pulses.find((p) => p.root === root);
      const target = needed && !held ? (hints ? .85 : 0) + (pulse ? 1 : 0) : 0;
      marker.material.opacity += (Math.min(1, target) - marker.material.opacity) * .15;
      const world = root.getWorldPosition(new THREE.Vector3());
      const box = root.userData.markerHeight ?? (root.userData.pick.kind === "shopkeeper" ? 2.0 : root.userData.pick.kind === "project" || root.userData.pick.kind === "music" ? .26 : .3);
      marker.position.set(world.x, world.y + box, world.z);
      const distance = marker.position.distanceTo(camera.position);
      marker.scale.setScalar((.06 + .012 * Math.sin(time * 3 + root.id)) * distance * .5 + .04);
      marker.visible = marker.material.opacity > .02;
    }
    void show;
  }

  // ------------------------------------------------------------------------------------------
  // picking
  // ------------------------------------------------------------------------------------------
  function pick() {
    if (!active || held || !pointer.active) return null;
    ndc.set(pointer.nx, pointer.ny);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickRoots, true);
    for (const hit of hits) {
      if (hit.object.userData?.isMarker) continue;
      const root = findPick(hit.object);
      if (root) return root;
    }
    return null;
  }

  function setPointer(point) {
    if (!point) { pointer.active = false; setHovered(null); return; }
    const rect = canvas.getBoundingClientRect();
    pointer.x = point.x; pointer.y = point.y; pointer.type = point.type || "mouse";
    pointer.nx = ((point.x - rect.left) / rect.width) * 2 - 1;
    pointer.ny = -((point.y - rect.top) / rect.height) * 2 + 1;
    pointer.active = true; pointer.dirty = true;
  }

  function setHovered(root) {
    if (hovered === root) return;
    hovered = root;
    canvas.style.cursor = root ? "pointer" : "";
    onHover(root ? { ...root.userData.pick, x: pointer.x, y: pointer.y } : null);
    if (root && (root.userData.pick.kind === "project" || root.userData.pick.kind === "music" || root.userData.pick.kind === "app")) onSound("hover");
  }

  function handleTap(point) {
    if (!active || held) return;
    setPointer(point);
    const root = pick();
    if (root) activate(root);
  }

  function handleClick(event) {
    if (event.button !== 0 || !active || held) return;
    setPointer({ x: event.clientX, y: event.clientY, type: "mouse" });
    const root = pick();
    if (root) activate(root);
  }

  function activate(root) {
    const info = root.userData.pick;
    if (info.kind === "project" || info.kind === "music") {
      const record = recordByGroup.get(root);
      if (record) present(root, record);
    } else if (info.kind === "app") present(root, null);
    else { onSound("click"); onSelect(info, root); }
  }

  canvas.addEventListener("click", handleClick);

  // ------------------------------------------------------------------------------------------
  // presentation (held object)
  // ------------------------------------------------------------------------------------------
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const homeFov = 55;
  let drag = null;
  let screenShift = 0;

  function presentationDistance(open) {
    const vfov = THREE.MathUtils.degToRad(look.getHome().fov);
    const aspect = camera.aspect;
    const height = held.record ? SLEEVE.size : .38;
    const width = held.record ? (SLEEVE.size * (1 + open * 1.25) + open * .12) : .3;
    const byHeight = height / (2 * Math.tan(vfov / 2) * .5);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const byWidth = width / (2 * Math.tan(hfov / 2) * .86);
    return Math.max(byHeight, byWidth, .42);
  }

  function present(root, record) {
    if (held || destroyed) return;
    look.setPointerLock(true);
    look.setZoom?.(look.getHome().fov);
    setHovered(null);
    held = {
      root, record, kind: root.userData.pick.kind, id: root.userData.pick.id,
      t: 0, state: "lifting", flipped: false, open: 0, openTarget: 0, spin: 0, spinTarget: 0, tiltX: 0, tiltY: 0,
      start: { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() },
      fromWorld: { position: root.getWorldPosition(new THREE.Vector3()), quaternion: root.getWorldQuaternion(new THREE.Quaternion()) }
    };
    if (record) ensureRecordDetail(record, getLanguage(), quality);
    root.userData.hover = 0;
    onSound(record ? "vinyl-pull" : "click");
    postfx?.setFocus?.(presentationDistance(0));
    notify();
  }

  function notify() {
    if (!held) { onHeldChange(null); return; }
    onHeldChange({
      kind: held.kind, id: held.id, state: held.state, flipped: held.flipped, open: held.openTarget > .5,
      canFlip: !!held.record, canOpen: !!held.record
    });
  }

  function flip() {
    if (!held || !held.record || held.state === "returning") return;
    held.flipped = !held.flipped;
    held.spinTarget = held.flipped ? Math.PI : 0;
    if (held.flipped && held.openTarget) held.openTarget = 0;
    onSound("flip");
    notify();
  }
  function toggleOpen() {
    if (!held || !held.record || held.state === "returning") return;
    if (held.flipped) { held.flipped = false; held.spinTarget = 0; }
    ensureRecordDetail(held.record, getLanguage(), quality);
    held.openTarget = held.openTarget ? 0 : 1;
    onSound(held.openTarget ? "sleeve-open" : "sleeve-close");
    if (held.openTarget) setTimeout(() => { if (held && held.openTarget) onSound("disc-slide"); }, 380);
    notify();
  }
  function release() {
    if (!held || held.state === "returning") return;
    held.state = "returning"; held.t = 0; held.openTarget = 0; held.flipped = false; held.spinTarget = 0;
    held.start = { position: held.root.position.clone(), quaternion: held.root.quaternion.clone(), scale: held.root.scale.clone() };
    onSound(held.record ? "vinyl-return" : "click");
    look.setPointerLock(false);
    notify();
  }
  function refreshLanguage() {
    if (held && held.record) { held.record.detailLang = null; ensureRecordDetail(held.record, getLanguage(), quality); }
  }

  // pointer drag on the held object spins it
  function onDown(event) {
    if (!held || held.state !== "held" || event.button > 0) return;
    drag = { x: event.clientX, base: held.spin, moved: 0 };
    canvas.setPointerCapture?.(event.pointerId);
  }
  function onMove(event) {
    if (!held) return;
    const rect = canvas.getBoundingClientRect();
    held.tiltX = ((event.clientX - rect.left) / rect.width - .5) * 2;
    held.tiltY = ((event.clientY - rect.top) / rect.height - .5) * 2;
    if (!drag) return;
    drag.moved += Math.abs(event.movementX || 0);
    if (held.record) held.spin = drag.base + (event.clientX - drag.x) * .012;
    else held.spin = THREE.MathUtils.clamp(drag.base + (event.clientX - drag.x) * .01, -.8, .8);
  }
  function onUp(event) {
    if (!drag || !held) { drag = null; return; }
    canvas.releasePointerCapture?.(event.pointerId);
    if (held.record) {
      // snap to nearest face
      const turns = Math.round(held.spin / Math.PI);
      const wasFlipped = held.flipped;
      held.spinTarget = turns * Math.PI;
      held.flipped = Math.abs(turns) % 2 === 1;
      if (held.flipped && held.openTarget) held.openTarget = 0;
      if (held.flipped !== wasFlipped) { onSound("flip"); notify(); }
    } else held.spinTarget = 0;
    drag = null;
  }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function updateHeld(dt) {
    const h = held;
    const root = h.root;
    const k = 1 - Math.exp(-9 * dt);
    h.open += (h.openTarget - h.open) * (1 - Math.exp(-5.5 * dt));
    if (h.record) {
      h.spin += (h.spinTarget - h.spin) * (drag ? 0 : 1 - Math.exp(-8 * dt));
      h.record.flap.rotation.y = -Math.PI * .99 * easeInOut(THREE.MathUtils.clamp(h.open, 0, 1));
      const slide = ease(THREE.MathUtils.clamp((h.open - .55) / .45, 0, 1));
      h.record.disc.position.x = h.record.discHome.x + slide * .29;
      h.record.disc.position.y = h.record.discHome.y + slide * .0;
      h.record.disc.rotation.z = slide * .35;
    } else {
      if (!drag) h.spin += (h.spinTarget - h.spin) * (1 - Math.exp(-8 * dt));
    }

    camera.updateMatrixWorld();
    const forward = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const dist = presentationDistance(h.open);
    const shift = h.record ? SLEEVE.size * .5 * h.open - .02 * h.open : 0;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const target = camera.position.clone().addScaledVector(forward, dist).addScaledVector(up, .035).addScaledVector(right, shift + screenShift * dist * 1.1);

    // orientation: face the camera, then spin (user drag / flip) and a gentle tilt following the pointer
    tmpQ.copy(camera.quaternion);
    tmpE.set(h.tiltY * .09, h.spin + h.tiltX * -.12, 0, "YXZ");
    tmpQ2.setFromEuler(tmpE);
    const targetQuat = tmpQ.clone().multiply(tmpQ2);

    if (h.state === "lifting") {
      h.t = Math.min(1, h.t + dt / (reducedMotion ? .35 : .9));
      const e = easeInOut(h.t);
      // arc: rise out of the bin first, then fly to the camera
      const from = h.start.position;
      const lift = Math.min(1, h.t * 2.4);
      const fly = easeInOut(Math.max(0, (h.t - .12) / .88));
      root.position.copy(from).lerp(target, fly);
      root.position.y += Math.sin(Math.min(1, h.t * 1.7) * Math.PI * .5) * .22 * (1 - fly) + easeOut(lift) * .12 * (1 - fly);
      root.quaternion.slerpQuaternions(h.start.quaternion, targetQuat, e);
      root.scale.lerpVectors(h.start.scale, new THREE.Vector3(1, 1, 1), e);
      if (h.t >= 1) { h.state = "held"; notify(); }
    } else if (h.state === "held") {
      root.position.lerp(target, 1 - Math.exp(-14 * dt));
      root.quaternion.slerp(targetQuat, k);
      postfx?.setFocus?.(root.position.distanceTo(camera.position));
    } else if (h.state === "returning") {
      h.t = Math.min(1, h.t + dt / (reducedMotion ? .35 : .85));
      const e = easeInOut(h.t);
      const home = root.userData.home;
      // from current held pose, arc back above the slot, then settle
      const homePos = home.position;
      root.position.copy(h.start.position).lerp(homePos, e);
      root.position.y += Math.sin(Math.min(1, h.t) * Math.PI) * .16;
      root.quaternion.slerpQuaternions(h.start.quaternion, home.quaternion, e);
      root.scale.lerpVectors(h.start.scale, home.scale, e);
      if (h.record) {
        h.record.flap.rotation.y *= .86;
        h.record.disc.position.x += (h.record.discHome.x - h.record.disc.position.x) * .2;
        h.record.disc.rotation.z *= .85;
      }
      if (h.t >= 1) {
        root.position.copy(home.position); root.quaternion.copy(home.quaternion); root.scale.copy(home.scale);
        if (h.record) { h.record.flap.rotation.y = 0; h.record.disc.position.copy(h.record.discHome); h.record.disc.rotation.z = 0; }
        held = null;
        postfx?.setDof?.(0);
        onHold?.(0);
        notify();
      }
    }
    const holdAmount = held ? (held.state === "returning" ? Math.max(0, 1 - held.t * 1.6) : easeOut(Math.min(1, held.t * 1.4 + (held.state === "held" ? 1 : 0)))) : 0;
    postfx?.setDof?.(holdAmount);
    onHold?.(holdAmount);
  }

  // ------------------------------------------------------------------------------------------
  // per-frame
  // ------------------------------------------------------------------------------------------
  const up = new THREE.Vector3(0, 1, 0);
  function update(dt, elapsed) {
    if (destroyed) return;
    pickTimer += dt;
    if (active && !held && pointer.active && (pointer.dirty || pickTimer > .12)) {
      pickTimer = 0; pointer.dirty = false;
      setHovered(pick());
    }
    // pulses (AI recommendations)
    for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].time -= dt; if (pulses[i].time <= 0) pulses.splice(i, 1); }
    // hover animation
    for (const root of pickRoots) {
      if (held && held.root === root) continue;
      const hot = root === hovered ? 1 : 0;
      const pulse = pulses.find((p) => p.root === root);
      const target = Math.max(hot, pulse ? .5 + .5 * Math.sin(elapsed * 6) : 0);
      const u = root.userData;
      u.hover += (target - u.hover) * (1 - Math.exp(-12 * dt));
      if (u.hover < .001 && target === 0) { if (u.hovering) { root.position.copy(u.home.position); root.scale.copy(u.home.scale); u.hovering = false; } continue; }
      u.hovering = true;
      const kind = u.pick.kind;
      root.position.copy(u.home.position);
      root.scale.copy(u.home.scale);
      if (kind === "project" || kind === "music") {
        tmpV.copy(up).applyQuaternion(u.home.quaternion).multiplyScalar(.032 * u.hover);
        root.position.add(tmpV);
        root.scale.multiplyScalar(1 + .02 * u.hover);
      } else if (kind === "app") {
        tmpV.set(0, 0, 1).applyQuaternion(u.home.quaternion).multiplyScalar(.045 * u.hover);
        root.position.add(tmpV);
      } else if (kind === "poster") {
        root.scale.multiplyScalar(1 + .025 * u.hover);
      } else if (u.hoverLift) {
        root.position.y += .012 * u.hover;
        root.scale.multiplyScalar(1 + .03 * u.hover);
      } else if (kind === "secret" || kind === "turntable" || kind === "about") {
        root.scale.multiplyScalar(1 + .035 * u.hover);
      }
    }
    if (held) updateHeld(dt);
    updateMarkers(elapsed);
  }

  return {
    update,
    setPointer,
    handleTap,
    setActive(v) { active = !!v; if (!active) { setHovered(null); } },
    present: (id) => { const root = pickRoots.find((r) => r.userData.pick && r.userData.pick.id === id && (r.userData.pick.kind === "project" || r.userData.pick.kind === "music" || r.userData.pick.kind === "app")); if (root && !held) activate(root); return !!root; },
    flip, toggleOpen, release, refreshLanguage,
    isHeld: () => !!held,
    getHeld: () => (held ? { kind: held.kind, id: held.id, state: held.state, flipped: held.flipped, open: held.openTarget > .5 } : null),
    setHints(v) { hints = !!v; },
    setScreenShift(v) { screenShift = v; },
    pulse(kind, id, seconds = 5) {
      const root = pickRoots.find((r) => r.userData.pick && r.userData.pick.id === id && (!kind || r.userData.pick.kind === kind));
      if (!root) return null;
      pulses.push({ root, time: seconds });
      return root;
    },
    findRoot(kind, id) { return pickRoots.find((r) => r.userData.pick && r.userData.pick.id === id && (!kind || r.userData.pick.kind === kind)) || null; },
    destroy() {
      destroyed = true;
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      for (const m of markers.values()) { m.material.dispose(); m.removeFromParent(); }
    }
  };
}
