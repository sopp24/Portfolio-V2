import * as THREE from "three";

export function createRecordInteraction({
  scene,
  camera,
  canvas,
  records,
  onPanelChange = () => {},
  onOpenProject = () => {}
}) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const flipQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  let active = false;
  let hovered = null;
  let selected = null;
  let returning = false;
  let destroyed = false;

  function recordFromObject(object) {
    let current = object;
    while (current && !current.userData.isRecord) current = current.parent;
    return current || null;
  }

  function panel(mode) {
    if (!selected) {
      onPanelChange({ mode: "none" });
      return;
    }
    onPanelChange({
      mode,
      project: selected.userData.project,
      isOpen: !!selected.userData.isOpen,
      isFlipped: !!selected.userData.isFlipped
    });
  }

  function pick() {
    if (!active || selected || destroyed) return;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(records, true);
    let next = null;
    for (const hit of hits) {
      const candidate = recordFromObject(hit.object);
      if (candidate && candidate !== selected) {
        next = candidate;
        break;
      }
    }
    if (next !== hovered) {
      if (hovered) hovered.userData.hovered = false;
      hovered = next;
      if (hovered) hovered.userData.hovered = true;
      if (hovered) {
        onPanelChange({ mode: "hover", project: hovered.userData.project });
      } else {
        onPanelChange({ mode: "none" });
      }
    }
  }

  function present(record) {
    if (!active || selected || !record || destroyed) return;
    const parent = record.parent;
    if (!parent) return;

    parent.updateMatrixWorld(true);
    record.updateMatrixWorld(true);
    record.userData.presentationHomePosition = record.getWorldPosition(new THREE.Vector3());
    record.userData.presentationHomeQuaternion = record.getWorldQuaternion(new THREE.Quaternion());
    record.userData.presentationHomeParent = parent;

    parent.remove(record);
    scene.add(record);
    record.position.copy(record.userData.presentationHomePosition);
    record.quaternion.copy(record.userData.presentationHomeQuaternion);

    record.userData.presentationBaseQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
    record.userData.isPresented = true;
    record.userData.isOpen = false;
    record.userData.isFlipped = false;
    record.userData.flap.rotation.y = 0;
    record.userData.discAssembly.position.copy(record.userData.discHome);

    selected = record;
    hovered = null;
    returning = false;
    panel("selected");
  }

  function handleCanvasClick(event) {
    if (!active || selected || destroyed || event.button !== 0) return;
    if (hovered) {
      event.preventDefault();
      present(hovered);
    }
  }

  function flipSelected() {
    if (!selected || returning) return;
    selected.userData.isFlipped = !selected.userData.isFlipped;
    if (selected.userData.isFlipped) {
      selected.userData.isOpen = false;
    }
    panel("selected");
  }

  function toggleSleeve() {
    if (!selected || returning || selected.userData.isFlipped) return;
    selected.userData.isOpen = !selected.userData.isOpen;
    panel("selected");
  }

  function showProjectDetails() {
    if (!selected || returning || !selected.userData.isOpen) return;
    onOpenProject(selected.userData.project);
  }

  function returnSelected() {
    if (!selected || returning) return;
    returning = true;
    panel("returning");
  }

  function finishReturn(record) {
    const parent = record.userData.homeParent;
    if (parent) {
      scene.remove(record);
      parent.add(record);
      record.position.copy(record.userData.homePosition);
      record.quaternion.copy(record.userData.homeQuaternion);
      record.scale.copy(record.userData.homeScale);
    }
    record.userData.flap.rotation.y = 0;
    record.userData.discAssembly.position.copy(record.userData.discHome);
    record.userData.isOpen = false;
    record.userData.isFlipped = false;
    record.userData.isPresented = false;
    selected = null;
    returning = false;
    onPanelChange({ mode: "none" });
  }

  function update(delta) {
    if (destroyed) return;
    const amount = 1 - Math.exp(-7.8 * Math.min(delta, .05));

    for (const record of records) {
      if (record === selected) continue;
      const targetScale = record.userData.hovered ? 1.035 : 1;
      record.scale.lerp(new THREE.Vector3(
        record.userData.homeScale.x * targetScale,
        record.userData.homeScale.y * targetScale,
        record.userData.homeScale.z * targetScale
      ), amount);
    }

    if (!selected) {
      if (active) pick();
      return;
    }

    const record = selected;
    record.userData.flap.rotation.y += ((record.userData.isOpen ? -1.42 : 0) - record.userData.flap.rotation.y) * amount;
    const discTargetX = record.userData.isOpen ? .49 : record.userData.discHome.x;
    record.userData.discAssembly.position.x += (discTargetX - record.userData.discAssembly.position.x) * amount;
    record.userData.discAssembly.position.y += (record.userData.discHome.y - record.userData.discAssembly.position.y) * amount;
    record.userData.discAssembly.position.z += ((record.userData.isOpen ? .075 : record.userData.discHome.z) - record.userData.discAssembly.position.z) * amount;

    if (returning) {
      record.position.lerp(record.userData.presentationHomePosition, amount);
      record.quaternion.slerp(record.userData.presentationHomeQuaternion, amount);
      record.scale.lerp(record.userData.homeScale, amount);
      if (
        record.position.distanceTo(record.userData.presentationHomePosition) < .012 &&
        record.quaternion.angleTo(record.userData.presentationHomeQuaternion) < .025
      ) finishReturn(record);
      return;
    }

    camera.getWorldDirection(forward);
    camera.getWorldPosition(desiredPosition);
    desiredPosition.addScaledVector(forward, 1.34);
    camera.getWorldDirection(up);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    desiredPosition.addScaledVector(up, -.015);

    targetQuaternion.copy(record.userData.presentationBaseQuaternion);
    if (record.userData.isFlipped) targetQuaternion.multiply(flipQuaternion);

    record.position.lerp(desiredPosition, amount);
    record.quaternion.slerp(targetQuaternion, amount);
    record.scale.lerp(new THREE.Vector3(1.06, 1.06, 1.06), amount);
  }

  function setActive(value) {
    active = !!value;
    if (!active) {
      if (hovered) hovered.userData.hovered = false;
      hovered = null;
      if (selected) returnSelected();
      else onPanelChange({ mode: "none" });
    }
  }

  function destroy() {
    destroyed = true;
    canvas.removeEventListener("click", handleCanvasClick);
    if (hovered) hovered.userData.hovered = false;
    hovered = null;
    if (selected) {
      selected.userData.flap.rotation.y = 0;
      selected.userData.discAssembly.position.copy(selected.userData.discHome);
      finishReturn(selected);
    }
  }

  canvas.addEventListener("click", handleCanvasClick);
  return {
    update,
    setActive,
    flipSelected,
    toggleSleeve,
    showProjectDetails,
    returnSelected,
    hasSelection: () => !!selected,
    destroy
  };
}
