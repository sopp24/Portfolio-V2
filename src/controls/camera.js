import * as THREE from "three";

const clamp = THREE.MathUtils.clamp;

export function createCameraController(camera, canvas) {
  const homePosition = camera.position.clone();
  const homeRotation = camera.rotation.clone();
  const baseYaw = homeRotation.y;
  const basePitch = homeRotation.x;
  const yawLimit = 1.46;
  const pitchLimit = .48;
  const zoomMin = 39;
  const zoomMax = 66;

  let targetYaw = 0;
  let targetPitch = 0;
  let currentYaw = 0;
  let currentPitch = 0;
  let targetFov = camera.fov;
  let activeTouch = null;
  let pinchDistance = 0;
  let gyroEnabled = false;
  let gyroBaseline = null;
  let disposed = false;

  function isOverInterface(target) {
    return target instanceof Element && !!target.closest(
      "#site-header, .screen-overlay, .project-dialog, .mode-2d, button, a, input, select, textarea"
    );
  }

  function handlePointerMove(event) {
    if (disposed || event.pointerType !== "mouse" || isOverInterface(event.target)) return;
    const bounds = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    const normalizedX = (x - .5) * 2;
    const normalizedY = (y - .5) * 2;
    targetYaw = clamp(normalizedX * yawLimit, -yawLimit, yawLimit);
    targetPitch = clamp(-normalizedY * pitchLimit, -pitchLimit, pitchLimit);
  }

  function handleWheel(event) {
    if (disposed || isOverInterface(event.target)) return;
    event.preventDefault();
    targetFov = clamp(targetFov + event.deltaY * .018, zoomMin, zoomMax);
  }

  function handleTouchStart(event) {
    if (disposed || isOverInterface(event.target)) return;
    if (event.touches.length === 1) {
      activeTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      pinchDistance = 0;
    } else if (event.touches.length >= 2) {
      activeTouch = null;
      pinchDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
    }
  }

  function handleTouchMove(event) {
    if (disposed || isOverInterface(event.target)) return;
    event.preventDefault();
    if (event.touches.length === 1 && activeTouch) {
      const touch = event.touches[0];
      const dx = touch.clientX - activeTouch.x;
      const dy = touch.clientY - activeTouch.y;
      activeTouch = { x: touch.clientX, y: touch.clientY };
      targetYaw = clamp(targetYaw - dx * .0042, -yawLimit, yawLimit);
      targetPitch = clamp(targetPitch - dy * .0036, -pitchLimit, pitchLimit);
    } else if (event.touches.length >= 2) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      if (pinchDistance > 0) targetFov = clamp(targetFov + (pinchDistance - distance) * .018, zoomMin, zoomMax);
      pinchDistance = distance;
    }
  }

  function handleTouchEnd(event) {
    if (!event.touches.length) {
      activeTouch = null;
      pinchDistance = 0;
    } else if (event.touches.length === 1) {
      activeTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      pinchDistance = 0;
    }
  }

  function handleDeviceOrientation(event) {
    if (!gyroEnabled) return;
    if (!gyroBaseline) {
      gyroBaseline = { beta: event.beta || 0, gamma: event.gamma || 0 };
      return;
    }
    const beta = (event.beta || 0) - gyroBaseline.beta;
    const gamma = (event.gamma || 0) - gyroBaseline.gamma;
    targetYaw = clamp(gamma * .018, -yawLimit, yawLimit);
    targetPitch = clamp(-beta * .012, -pitchLimit, pitchLimit);
  }

  async function enableGyroscope() {
    if (!("DeviceOrientationEvent" in window)) return false;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") return false;
      }
      gyroBaseline = null;
      gyroEnabled = true;
      window.addEventListener("deviceorientation", handleDeviceOrientation, true);
      return true;
    } catch (error) {
      console.warn("Device orientation could not be enabled.", error);
      return false;
    }
  }

  function disableGyroscope() {
    gyroEnabled = false;
    gyroBaseline = null;
    window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  }

  function reset() {
    targetYaw = 0;
    targetPitch = 0;
    targetFov = 56;
    gyroBaseline = null;
  }

  function update(delta) {
    const smoothing = 1 - Math.exp(-7.5 * Math.min(delta, .05));
    currentYaw += (targetYaw - currentYaw) * smoothing;
    currentPitch += (targetPitch - currentPitch) * smoothing;
    camera.position.copy(homePosition);
    camera.rotation.order = "YXZ";
    camera.rotation.y = baseYaw + currentYaw;
    camera.rotation.x = basePitch + currentPitch;
    camera.rotation.z = 0;
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-5.5 * Math.min(delta, .05)));
    camera.updateProjectionMatrix();
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  function destroy() {
    disposed = true;
    disableGyroscope();
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.removeEventListener("touchstart", handleTouchStart);
    canvas.removeEventListener("touchmove", handleTouchMove);
    canvas.removeEventListener("touchend", handleTouchEnd);
    canvas.removeEventListener("touchcancel", handleTouchEnd);
  }

  return {
    update,
    reset,
    enableGyroscope,
    disableGyroscope,
    isGyroscopeEnabled: () => gyroEnabled,
    getZoom: () => targetFov,
    destroy,
    homePosition,
    homeRotation
  };
}
