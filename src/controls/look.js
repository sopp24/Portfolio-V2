// First-person look controls for a FIXED camera position: the visitor can only turn their head and zoom.
//  - Desktop: the pointer steers the view (eased, with a calm centre and faster edges) with inertia.
//  - Touch: drag to look, pinch to zoom, tap to pick.
//  - Gyroscope: opt-in (permission aware), relative to the pose when it was enabled.
//  - Keyboard: arrow keys look, +/- zoom (accessibility).
// The camera position never changes: only yaw, pitch and field of view.
import * as THREE from "three";
import { CAMERA } from "../scene/layout.js";

const clamp = THREE.MathUtils.clamp;
const wrap180 = (deg) => ((deg + 540) % 360) - 180;

export function createLookControls({ camera, canvas, isOverInterface = () => false, reducedMotion = false, onPointer = () => {}, onTap = () => {}, onChange = () => {} }) {
  const home = { yaw: 0, pitch: -.035, fov: CAMERA.fov };
  const limits = { yaw: CAMERA.yawLimit, up: CAMERA.pitchUp, down: CAMERA.pitchDown };
  camera.position.copy(CAMERA.position);
  camera.rotation.order = "YXZ";

  let enabled = true;
  let targetYaw = home.yaw, targetPitch = home.pitch, targetFov = home.fov;
  let yaw = targetYaw, pitch = targetPitch;
  let pointer = { x: 0, y: 0, active: false, type: "mouse" };
  let dragOffsetYaw = 0, dragOffsetPitch = 0;       // touch/gyro-induced offsets
  let gyro = { enabled: false, a0: null, b0: null, g0: null, yaw: 0, pitch: 0 };
  let touch = null, pinch = 0, moved = 0, tapCandidate = null;
  let glide = null;           // programmatic "look at this" move
  let sway = 0;
  let fovScale = 1;     // portrait screens get a wider vertical FOV so the room stays readable
  const scaleFor = () => (camera.aspect < 1 ? 1 + (1 - camera.aspect) * .55 : 1);
  let disposed = false;
  let pointerLock = false;    // freeze pointer-steering (e.g. while a record is held)
  const keys = new Set();

  // Shaped response: calm in the centre, brisk toward the edges.
  const shape = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.55);

  function setPointerTarget() {
    if (pointerLock || glide) return;
    targetYaw = clamp(-shape(pointer.x) * limits.yaw, -limits.yaw, limits.yaw);
    const py = pointer.y;
    targetPitch = clamp(home.pitch - shape(py) * (py < 0 ? limits.up : limits.down) * .9, -limits.down, limits.up);
  }

  function onPointerMove(event) {
    if (disposed) return;
    pointer.type = event.pointerType;
    if (event.pointerType === "mouse") {
      if (isOverInterface(event.target)) { onPointer(null); return; }
      const rect = canvas.getBoundingClientRect();
      pointer.x = clamp(((event.clientX - rect.left) / rect.width - .5) * 2, -1, 1);
      pointer.y = clamp(((event.clientY - rect.top) / rect.height - .5) * 2, -1, 1);
      pointer.active = true;
      if (glide && (Math.abs(event.movementX) + Math.abs(event.movementY)) > 6) glide = null;
      if (enabled) setPointerTarget();
      onPointer({ x: event.clientX, y: event.clientY, type: "mouse" });
    }
  }

  function onPointerLeave() { pointer.active = false; onPointer(null); }

  function onWheel(event) {
    if (disposed || !enabled || isOverInterface(event.target)) return;
    event.preventDefault();
    targetFov = clamp(targetFov + event.deltaY * .03, CAMERA.zoomMinFov * fovScale, CAMERA.zoomMaxFov * fovScale);
    onChange();
  }

  // ---- touch ------------------------------------------------------------------------------
  function onTouchStart(event) {
    if (disposed || isOverInterface(event.target)) return;
    if (event.touches.length === 1) {
      const t = event.touches[0];
      touch = { x: t.clientX, y: t.clientY };
      tapCandidate = { x: t.clientX, y: t.clientY, time: performance.now() };
      moved = 0; pinch = 0;
    } else if (event.touches.length >= 2) {
      touch = null; tapCandidate = null;
      pinch = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    }
  }
  function onTouchMove(event) {
    if (disposed || !enabled) return;
    if (event.cancelable) event.preventDefault();
    if (event.touches.length === 1 && touch) {
      const t = event.touches[0];
      const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
      touch = { x: t.clientX, y: t.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      const k = (camera.fov / 55) * .0042;
      glide = null;
      targetYaw = clamp(targetYaw + dx * k, -limits.yaw, limits.yaw);
      targetPitch = clamp(targetPitch + dy * k * .85, -limits.down, limits.up);
      if (moved > 10) tapCandidate = null;
    } else if (event.touches.length >= 2) {
      const d = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      if (pinch > 0) targetFov = clamp(targetFov - (d - pinch) * .06, CAMERA.zoomMinFov * fovScale, CAMERA.zoomMaxFov * fovScale);
      pinch = d;
    }
  }
  function onTouchEnd(event) {
    if (event.touches.length === 0) {
      if (tapCandidate && performance.now() - tapCandidate.time < 450 && !isOverInterface(event.target)) onTap({ x: tapCandidate.x, y: tapCandidate.y, type: "touch" });
      touch = null; tapCandidate = null; pinch = 0;
    } else if (event.touches.length === 1) {
      const t = event.touches[0];
      touch = { x: t.clientX, y: t.clientY }; pinch = 0;
    }
  }

  // ---- keyboard ---------------------------------------------------------------------------
  function onKeyDown(event) {
    if (disposed || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
    // never hijack the arrow keys (page scroll, list navigation) while a panel, dialog or the 2D directory is in use
    if (!enabled || event.target?.closest?.("dialog, #mode-2d, #liner-panel, #assistant, #site-header, .record-dock")) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { keys.add(event.key); glide = null; event.preventDefault(); }
    if (event.key === "+" || event.key === "=") { targetFov = clamp(targetFov - 4, CAMERA.zoomMinFov * fovScale, CAMERA.zoomMaxFov * fovScale); }
    if (event.key === "-" || event.key === "_") { targetFov = clamp(targetFov + 4, CAMERA.zoomMinFov * fovScale, CAMERA.zoomMaxFov * fovScale); }
  }
  function onKeyUp(event) { keys.delete(event.key); }

  // ---- gyroscope --------------------------------------------------------------------------
  function onOrientation(event) {
    if (!gyro.enabled || event.alpha === null || event.beta === null) return;
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const landscape = Math.abs(angle) === 90;
    if (gyro.a0 === null) { gyro.a0 = event.alpha; gyro.b0 = landscape ? (event.gamma || 0) : event.beta; return; }
    const dAlpha = wrap180(event.alpha - gyro.a0);
    const pitchDeg = landscape ? (angle === 90 ? -(event.gamma || 0) : (event.gamma || 0)) : event.beta;
    const dPitch = pitchDeg - gyro.b0;
    gyro.yaw = clamp(THREE.MathUtils.degToRad(dAlpha), -limits.yaw, limits.yaw);
    gyro.pitch = clamp(THREE.MathUtils.degToRad(dPitch), -limits.down, limits.up);
  }
  async function enableGyroscope() {
    if (!("DeviceOrientationEvent" in window)) return false;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") return false;
      }
      gyro = { enabled: true, a0: null, b0: null, g0: null, yaw: 0, pitch: 0 };
      window.addEventListener("deviceorientation", onOrientation, true);
      // Verify real sensor data arrives (many desktops expose the API without hardware).
      const ok = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 1200);
        const probe = (e) => { if (e.alpha !== null || e.beta !== null) { clearTimeout(timer); window.removeEventListener("deviceorientation", probe, true); resolve(true); } };
        window.addEventListener("deviceorientation", probe, true);
      });
      if (!ok) { disableGyroscope(); return false; }
      return true;
    } catch (error) {
      console.warn("Gyroscope could not be enabled.", error);
      disableGyroscope();
      return false;
    }
  }
  function disableGyroscope() {
    gyro.enabled = false; gyro.a0 = null; gyro.yaw = 0; gyro.pitch = 0;
    window.removeEventListener("deviceorientation", onOrientation, true);
  }

  // ---- public API -------------------------------------------------------------------------
  function recenter() {
    glide = { yaw: home.yaw, pitch: home.pitch, fov: home.fov * fovScale, hold: 0 };
    dragOffsetYaw = dragOffsetPitch = 0;
    pointer.x = 0; pointer.y = 0;
    if (gyro.enabled) { gyro.a0 = null; gyro.yaw = 0; gyro.pitch = 0; }
    targetFov = home.fov * fovScale;
  }

  // Smoothly look toward a world-space point (used by the shopkeeper's recommendations).
  function lookAtPoint(point, { fov = 44, hold = 3 } = {}) {
    const d = point.clone().sub(camera.position);
    const yawTo = Math.atan2(-d.x, -d.z);
    const pitchTo = Math.atan2(d.y, Math.hypot(d.x, d.z));
    glide = { yaw: clamp(yawTo, -limits.yaw, limits.yaw), pitch: clamp(pitchTo, -limits.down, limits.up), fov, hold };
    targetFov = fov;
  }

  function update(dt) {
    if (disposed) return;
    const d = Math.min(dt, .05);
    const sc = scaleFor();
    if (Math.abs(sc - fovScale) > .001) { const r = sc / fovScale; targetFov *= r; if (glide) glide.fov *= r; camera.fov *= r; fovScale = sc; camera.updateProjectionMatrix(); }
    if (keys.size) {
      const rate = 1.1 * d;
      if (keys.has("ArrowLeft")) targetYaw = clamp(targetYaw + rate, -limits.yaw, limits.yaw);
      if (keys.has("ArrowRight")) targetYaw = clamp(targetYaw - rate, -limits.yaw, limits.yaw);
      if (keys.has("ArrowUp")) targetPitch = clamp(targetPitch + rate * .7, -limits.down, limits.up);
      if (keys.has("ArrowDown")) targetPitch = clamp(targetPitch - rate * .7, -limits.down, limits.up);
    }
    let ty = targetYaw, tp = targetPitch;
    if (glide) {
      ty = glide.yaw; tp = glide.pitch; targetFov = glide.fov;
      if (Math.abs(yaw - ty) < .01 && Math.abs(pitch - tp) < .01) {
        glide.hold -= d;
        if (glide.hold <= 0) { targetYaw = ty; targetPitch = tp; glide = null; }
      }
    }
    if (gyro.enabled) { ty = clamp(ty + gyro.yaw, -limits.yaw, limits.yaw); tp = clamp(tp + gyro.pitch, -limits.down, limits.up); }
    const k = 1 - Math.exp(-(glide ? 3.2 : 6.5) * d);
    yaw += (ty - yaw) * k;
    pitch += (tp - pitch) * k;
    sway += d;
    const bob = reducedMotion ? 0 : 1;
    camera.position.set(CAMERA.position.x + Math.sin(sway * .31) * .004 * bob, CAMERA.position.y + Math.sin(sway * .52) * .0035 * bob, CAMERA.position.z);
    camera.rotation.set(pitch + Math.sin(sway * .43) * .0012 * bob, yaw, Math.sin(sway * .27) * .0009 * bob, "YXZ");
    const f = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-6 * d));
    if (Math.abs(f - camera.fov) > .005) { camera.fov = f; camera.updateProjectionMatrix(); }
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    update, recenter, lookAtPoint, enableGyroscope, disableGyroscope,
    isGyroEnabled: () => gyro.enabled,
    setPointerLock(v) { pointerLock = !!v; if (!v) setPointerTarget(); },
    setEnabled(v) { enabled = !!v; },
    setZoom(fov) { targetFov = clamp(fov, CAMERA.zoomMinFov * fovScale, CAMERA.zoomMaxFov * fovScale); },
    getTargetFov: () => targetFov,
    // Debug / tests: jump straight to a pose (radians, degrees for fov) without easing
    setPose(nextYaw, nextPitch, fov) { glide = null; targetYaw = yaw = clamp(nextYaw, -limits.yaw, limits.yaw); targetPitch = pitch = clamp(nextPitch, -limits.down, limits.up); if (fov) { targetFov = fov; camera.fov = fov; camera.updateProjectionMatrix(); } },
    getState: () => ({ yaw, pitch, fov: camera.fov }),
    getHome: () => ({ ...home, fov: home.fov * scaleFor() }),
    setLimits(next) { Object.assign(limits, next); },
    isGliding: () => !!glide,
    destroy() {
      disposed = true;
      disableGyroscope();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    }
  };
}
