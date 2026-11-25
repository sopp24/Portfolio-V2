import * as THREE from "three";

export function createRecordInteraction({
  scene, camera, canvas, records, applications = [], shopkeeper = null, easterEgg = null,
  onPanelChange = () => {}, onOpenProject = () => {}, onOpenAssistant = () => {},
  onOpenEasterEgg = () => {}, onSound = () => {}
}) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const hoverScale = new THREE.Vector3(1, 1, 1);
  const presentationScale = new THREE.Vector3(1.06, 1.06, 1.06);
  const pickTargets = [...records, ...applications, ...(shopkeeper ? [shopkeeper] : []), ...(easterEgg ? [easterEgg] : [])];
  const flipQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  let active = false, hoveredRecord = null, hoveredApplication = null, hoveredShopkeeper = null, hoveredEasterEgg = null;
  let selectedRecord = null, selectedApplication = null;
  let returningRecord = false, destroyed = false;

  function findRoot(object, flag) {
    let current = object;
    while (current && !current.userData[flag]) current = current.parent;
    return current || null;
  }

  function emitPanel(state) { onPanelChange(state); }

  function emitRecordPanel(mode) {
    if (!selectedRecord) return emitPanel({ mode: "none" });
    emitPanel({
      mode,
      project: selectedRecord.userData.project,
      isOpen: !!selectedRecord.userData.isOpen,
      isFlipped: !!selectedRecord.userData.isFlipped
    });
  }

  function setHoveredRecord(next) {
    if (hoveredRecord === next) return;
    if (hoveredRecord) hoveredRecord.userData.hovered = false;
    hoveredRecord = next;
    if (hoveredRecord) hoveredRecord.userData.hovered = true;
  }

  function setHoveredApplication(next) {
    if (hoveredApplication === next) return;
    if (hoveredApplication) hoveredApplication.userData.hovered = false;
    hoveredApplication = next;
    if (hoveredApplication) hoveredApplication.userData.hovered = true;
  }

  function setHoveredShopkeeper(next) {
    if (hoveredShopkeeper === next) return;
    if (hoveredShopkeeper) hoveredShopkeeper.userData.hovered = false;
    hoveredShopkeeper = next;
    if (hoveredShopkeeper) hoveredShopkeeper.userData.hovered = true;
  }

  function setHoveredEasterEgg(next) {
    if (hoveredEasterEgg === next) return;
    if (hoveredEasterEgg) hoveredEasterEgg.userData.hovered = false;
    hoveredEasterEgg = next;
    if (hoveredEasterEgg) hoveredEasterEgg.userData.hovered = true;
  }

  function pick() {
    if (!active || selectedRecord || selectedApplication || destroyed) return;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(pickTargets, true);
    let nextRecord = null, nextApplication = null, nextShopkeeper = null, nextEasterEgg = null;
    for (const hit of hits) {
      const record = findRoot(hit.object, "isRecord");
      if (record) { nextRecord = record; break; }
      const application = findRoot(hit.object, "isApplication");
      if (application) { nextApplication = application; break; }
      const person = findRoot(hit.object, "isShopkeeper");
      if (person) { nextShopkeeper = person; break; }
      const secret = findRoot(hit.object, "isEasterEgg");
      if (secret) { nextEasterEgg = secret; break; }
    }
    const changed = nextRecord !== hoveredRecord || nextApplication !== hoveredApplication ||
      nextShopkeeper !== hoveredShopkeeper || nextEasterEgg !== hoveredEasterEgg;
    setHoveredRecord(nextRecord);
    setHoveredApplication(nextApplication);
    setHoveredShopkeeper(nextShopkeeper);
    setHoveredEasterEgg(nextEasterEgg);
    if (!changed) return;
    if (hoveredRecord) emitPanel({ mode: "hover", project: hoveredRecord.userData.project });
    else if (hoveredApplication) emitPanel({ mode: "application-hover", application: hoveredApplication.userData.application });
    else if (hoveredShopkeeper) emitPanel({ mode: "shopkeeper-hover" });
    else if (hoveredEasterEgg) emitPanel({ mode: "easter-hover" });
    else emitPanel({ mode: "none" });
  }

  function present(record) {
    if (!active || selectedRecord || selectedApplication || !record || destroyed) return;
    const parent = record.parent;
    if (!parent) return;
    parent.updateMatrixWorld(true);
    record.updateMatrixWorld(true);
    record.userData.presentationHomePosition = record.getWorldPosition(new THREE.Vector3());
    record.userData.presentationHomeQuaternion = record.getWorldQuaternion(new THREE.Quaternion());
    parent.remove(record);
    scene.add(record);
    record.position.copy(record.userData.presentationHomePosition);
    record.quaternion.copy(record.userData.presentationHomeQuaternion);
    record.userData.isPresented = true;
    record.userData.isOpen = false;
    record.userData.isFlipped = false;
    record.userData.flap.rotation.y = 0;
    record.userData.discAssembly.position.copy(record.userData.discHome);
    selectedRecord = record;
    setHoveredRecord(null);
    setHoveredApplication(null);
    setHoveredShopkeeper(null);
    setHoveredEasterEgg(null);
    returningRecord = false;
    onSound("pickup");
    emitRecordPanel("selected");
  }

  function selectApplication(applicationObject) {
    if (!active || selectedRecord || selectedApplication || !applicationObject || destroyed) return;
    selectedApplication = applicationObject;
    setHoveredApplication(null);
    setHoveredRecord(null);
    setHoveredShopkeeper(null);
    setHoveredEasterEgg(null);
    selectedApplication.userData.selected = true;
    onSound("focus");
    emitPanel({ mode: "application-selected", application: selectedApplication.userData.application });
  }

  function handleCanvasClick(event) {
    if (!active || selectedRecord || selectedApplication || destroyed || event.button !== 0) return;
    if (hoveredRecord) {
      event.preventDefault();
      present(hoveredRecord);
    } else if (hoveredApplication) {
      event.preventDefault();
      selectApplication(hoveredApplication);
    } else if (hoveredShopkeeper) {
      event.preventDefault();
      setHoveredShopkeeper(null);
      emitPanel({ mode: "none" });
      onOpenAssistant();
    } else if (hoveredEasterEgg) {
      event.preventDefault();
      setHoveredEasterEgg(null);
      emitPanel({ mode: "none" });
      onSound("easter");
      onOpenEasterEgg();
    }
  }

  function flipSelected() {
    if (!selectedRecord || returningRecord) return;
    onSound("flip");
    selectedRecord.userData.isFlipped = !selectedRecord.userData.isFlipped;
    if (selectedRecord.userData.isFlipped) selectedRecord.userData.isOpen = false;
    emitRecordPanel("selected");
  }

  function toggleSleeve() {
    if (!selectedRecord || returningRecord || selectedRecord.userData.isFlipped) return;
    onSound("sleeve");
    selectedRecord.userData.isOpen = !selectedRecord.userData.isOpen;
    emitRecordPanel("selected");
  }

  function showProjectDetails() {
    if (!selectedRecord || returningRecord || !selectedRecord.userData.isOpen) return;
    onOpenProject(selectedRecord.userData.project);
  }

  function returnSelectedRecord() {
    if (!selectedRecord || returningRecord) return;
    onSound("return");
    selectedRecord.userData.isOpen = false;
    selectedRecord.userData.isFlipped = false;
    returningRecord = true;
    emitRecordPanel("returning");
  }

  function returnSelectedApplication() {
    if (!selectedApplication) return;
    selectedApplication.userData.selected = false;
    selectedApplication = null;
    emitPanel({ mode: "none" });
  }

  function finishRecordReturn(record) {
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
    selectedRecord = null;
    returningRecord = false;
    emitPanel({ mode: "none" });
  }

  function update(delta) {
    if (destroyed) return;
    const amount = 1 - Math.exp(-7.8 * Math.min(delta, .05));

    for (const record of records) {
      if (record === selectedRecord) continue;
      const targetScale = record.userData.hovered ? 1.035 : 1;
      hoverScale.copy(record.userData.homeScale).multiplyScalar(targetScale);
      record.scale.lerp(hoverScale, amount);
    }

    for (const application of applications) {
      const isSelected = application === selectedApplication;
      const targetScale = isSelected ? 1.07 : application.userData.hovered ? 1.035 : 1;
      hoverScale.copy(application.userData.homeScale).multiplyScalar(targetScale);
      application.scale.lerp(hoverScale, amount);
      const home = application.userData.homePosition;
      const targetZ = home.z + (isSelected ? .17 : 0);
      application.position.z += (targetZ - application.position.z) * amount;
    }

    if (!selectedRecord) {
      if (active) pick();
      return;
    }

    const record = selectedRecord;
    record.userData.flap.rotation.y += ((record.userData.isOpen ? -1.42 : 0) - record.userData.flap.rotation.y) * amount;
    const discTargetX = record.userData.isOpen ? .49 : record.userData.discHome.x;
    record.userData.discAssembly.position.x += (discTargetX - record.userData.discAssembly.position.x) * amount;
    record.userData.discAssembly.position.y += (record.userData.discHome.y - record.userData.discAssembly.position.y) * amount;
    record.userData.discAssembly.position.z += ((record.userData.isOpen ? .075 : record.userData.discHome.z) - record.userData.discAssembly.position.z) * amount;

    if (returningRecord) {
      record.position.lerp(record.userData.presentationHomePosition, amount);
      record.quaternion.slerp(record.userData.presentationHomeQuaternion, amount);
      record.scale.lerp(record.userData.homeScale, amount);
      if (record.position.distanceTo(record.userData.presentationHomePosition) < .012 &&
          record.quaternion.angleTo(record.userData.presentationHomeQuaternion) < .025) finishRecordReturn(record);
      return;
    }

    camera.getWorldDirection(forward);
    camera.getWorldPosition(desiredPosition);
    desiredPosition.addScaledVector(forward, 1.34);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    desiredPosition.addScaledVector(up, -.015);
    camera.getWorldQuaternion(targetQuaternion);
    if (record.userData.isFlipped) targetQuaternion.multiply(flipQuaternion);
    record.position.lerp(desiredPosition, amount);
    record.quaternion.slerp(targetQuaternion, amount);
    record.scale.lerp(presentationScale, amount);
  }

  function setActive(value) {
    active = !!value;
    if (!active) {
      setHoveredRecord(null);
      setHoveredApplication(null);
      setHoveredShopkeeper(null);
      setHoveredEasterEgg(null);
      if (selectedRecord) returnSelectedRecord();
      if (selectedApplication) returnSelectedApplication();
      if (!selectedRecord) emitPanel({ mode: "none" });
    }
  }

  function destroy() {
    destroyed = true;
    canvas.removeEventListener("click", handleCanvasClick);
    setHoveredRecord(null);
    setHoveredApplication(null);
    setHoveredShopkeeper(null);
    setHoveredEasterEgg(null);
    if (selectedApplication) returnSelectedApplication();
    if (selectedRecord) {
      selectedRecord.userData.flap.rotation.y = 0;
      selectedRecord.userData.discAssembly.position.copy(selectedRecord.userData.discHome);
      finishRecordReturn(selectedRecord);
    }
  }

  canvas.addEventListener("click", handleCanvasClick);
  return {
    update, setActive, flipSelected, toggleSleeve, showProjectDetails,
    returnSelectedRecord, returnSelectedApplication,
    hasSelection: () => !!selectedRecord || !!selectedApplication,
    hasRecordSelection: () => !!selectedRecord,
    hasApplicationSelection: () => !!selectedApplication,
    destroy
  };
}
