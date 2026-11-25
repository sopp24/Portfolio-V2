import * as THREE from "three";

const ROOM = { width: 12.4, depth: 15.2, height: 4.65, frontZ: 7.55, backZ: -7.55 };
const posterTextureCache = new Map();
const wallCoverGeometryCache = new Map();

const PROJECT_COLORS = [
  ["#bd5c3b", "#e0b474", "#182e38"],
  ["#d0a24e", "#6d3c34", "#ead8b8"],
  ["#345d76", "#d2b477", "#e5e0d0"],
  ["#587860", "#d8c6a2", "#243a39"],
  ["#9b493a", "#dba35d", "#282c32"],
  ["#6b557e", "#d9b27c", "#263b49"],
  ["#d49b32", "#a44838", "#273d4e"],
  ["#367e89", "#ced4ad", "#1e3944"],
  ["#4d6076", "#d2aa72", "#293039"],
  ["#b34b40", "#d4b292", "#252525"]
];

function makeTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function woodTexture() {
  return makeTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = "#74563b";
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 64) {
      ctx.fillStyle = y % 128 === 0 ? "#876746" : "#6f5138";
      ctx.fillRect(0, y + 1, width, 62);
      ctx.strokeStyle = "rgba(38,24,13,.28)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(width, y + 2); ctx.stroke();
      for (let n = 0; n < 28; n++) {
        const x = (n * 73 + y * 11) % width;
        const lineY = y + 7 + ((n * 19) % 48);
        ctx.strokeStyle = n % 3 === 0 ? "rgba(31,20,12,.14)" : "rgba(239,205,155,.09)";
        ctx.lineWidth = 1 + (n % 2);
        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.bezierCurveTo(x + 18, lineY - 3, x + 42, lineY + 3, x + 70, lineY - 1);
        ctx.stroke();
      }
    }
    for (let n = 0; n < 380; n++) {
      const x = (n * 97) % width, y = (n * 53) % height;
      ctx.fillStyle = n % 2 ? "rgba(255,235,200,.045)" : "rgba(23,15,9,.055)";
      ctx.fillRect(x, y, 1 + (n % 4), 1);
    }
  });
}

function floorTexture() {
  return makeTexture(768, 768, (ctx, width, height) => {
    ctx.fillStyle = "#987957";
    ctx.fillRect(0, 0, width, height);
    const boardHeight = 96;
    for (let row = 0; row < 8; row++) {
      let x = -(row % 2) * 110;
      let board = 0;
      while (x < width) {
        const boardWidth = 210 + ((row * 67 + board * 39) % 95);
        ctx.fillStyle = ["#9d7c59", "#8d6f50", "#a78661", "#927352"][(row + board) % 4];
        ctx.fillRect(x + 2, row * boardHeight + 2, boardWidth - 4, boardHeight - 4);
        ctx.strokeStyle = "rgba(42,29,18,.28)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, row * boardHeight + 2, boardWidth - 4, boardHeight - 4);
        for (let line = 0; line < 8; line++) {
          const y = row * boardHeight + 10 + line * 11;
          ctx.strokeStyle = line % 2 ? "rgba(245,218,177,.07)" : "rgba(39,25,14,.08)";
          ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x + boardWidth - 9, y + (line % 3 - 1)); ctx.stroke();
        }
        x += boardWidth;
        board++;
      }
    }
  });
}

function plasterTexture() {
  return makeTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = "#d5c7ad";
    ctx.fillRect(0, 0, width, height);
    for (let n = 0; n < 1800; n++) {
      const x = (n * 127) % width;
      const y = (n * 71) % height;
      ctx.fillStyle = n % 3 ? "rgba(255,249,231,.12)" : "rgba(89,72,51,.045)";
      ctx.fillRect(x, y, 1 + (n % 3), 1 + (n % 2));
    }
    ctx.fillStyle = "rgba(113,89,61,.08)";
    ctx.fillRect(0, height - 18, width, 18);
  });
}

function sleeveTexture(project, index) {
  const palette = project.artwork || PROJECT_COLORS[index % PROJECT_COLORS.length];
  const title = String(project.title.fr || "UNTITLED").toUpperCase();
  return makeTexture(512, 512, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(30, 20, 470, 500);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.52, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = .26;
    for (let n = 0; n < 9; n++) {
      ctx.fillStyle = n % 2 ? palette[2] : "#f2e5ca";
      ctx.beginPath();
      const x = 25 + ((n * 83 + index * 41) % 455);
      const y = 30 + ((n * 127 + index * 23) % 440);
      const radius = 28 + ((n * 17 + index * 13) % 92);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(8,12,12,.24)";
    ctx.fillRect(16, 16, 480, 480);
    ctx.strokeStyle = "rgba(246,235,211,.72)";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 476, 476);

    ctx.fillStyle = "rgba(250,241,219,.82)";
    ctx.font = "bold 17px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SIDE A  /  PROJECTS STORE", 34, 48);

    const words = title.split(/\s+/);
    const lines = [];
    let line = "";
    ctx.font = "900 48px Arial";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width > 420 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    const size = lines.length > 3 ? 34 : lines.length > 2 ? 39 : 48;
    ctx.font = "900 " + size + "px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5ebd5";
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 8;
    const startY = 244 - (Math.min(lines.length, 4) - 1) * size * .57;
    lines.slice(0, 4).forEach((part, row) => ctx.fillText(part, 256, startY + row * size * 1.12, 420));
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(7,12,12,.54)";
    ctx.fillRect(28, 432, 456, 48);
    ctx.fillStyle = "rgba(249,239,216,.8)";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "left";
    ctx.fillText("PORTFOLIO CUT  /  " + String(index + 1).padStart(2, "0"), 42, 462);

    ctx.strokeStyle = "rgba(250,238,217,.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 452, 452);
  });
}

function addBox(parent, dimensions, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

function createSign(scene, label, position, width, height, rotationY = 0) {
  const texture = makeTexture(768, 196, (ctx) => {
    ctx.fillStyle = "#24332d";
    ctx.fillRect(0, 0, 768, 196);
    ctx.fillStyle = "#d7c39d";
    ctx.fillRect(8, 8, 752, 180);
    ctx.fillStyle = "#29382f";
    ctx.fillRect(15, 15, 738, 166);
    ctx.strokeStyle = "rgba(240,224,188,.68)";
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 25, 718, 146);
    ctx.fillStyle = "#ead8b2";
    ctx.font = "bold 58px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 384, 94, 680);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  scene.add(sign);
  return sign;
}

function createPosterTexture(index, title) {
  const key = String(index) + "|" + String(title);
  if (posterTextureCache.has(key)) return posterTextureCache.get(key);
  const palette = PROJECT_COLORS[(index + 3) % PROJECT_COLORS.length];
  const texture = makeTexture(384, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 384, 512);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.55, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 384, 512);
    ctx.globalAlpha = .28;
    for (let n = 0; n < 8; n++) {
      ctx.fillStyle = n % 2 ? "#f5ebd6" : "#101b20";
      ctx.beginPath();
      ctx.arc(40 + ((n * 59) % 310), 60 + ((n * 73) % 410), 30 + ((n * 19) % 75), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(12, 12, 360, 488);
    ctx.strokeStyle = "rgba(246,235,210,.68)";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 352, 480);
    ctx.fillStyle = "#f2e6cd";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SIDE A PRESENTS", 192, 48);
    ctx.font = "900 43px Arial";
    const words = title.toUpperCase().split(/\s+/);
    let line = "", lines = [];
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > 320 && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((value, i) => ctx.fillText(value, 192, 280 + i * 50, 320));
    ctx.fillStyle = "rgba(245,235,216,.76)";
    ctx.font = "bold 13px monospace";
    ctx.fillText("INDEPENDENT RECORD STORE", 192, 466);
  });
  posterTextureCache.set(key, texture);
  return texture;
}

function addWallCover(scene, x, y, z, rotationY, title, index, width = .58, height = .70) {
  const key = width.toFixed(3) + "x" + height.toFixed(3);
  let geometry = wallCoverGeometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.PlaneGeometry(width, height);
    wallCoverGeometryCache.set(key, geometry);
  }
  const art = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ map: createPosterTexture(index, title), side: THREE.DoubleSide })
  );
  art.position.set(x, y, z);
  art.rotation.y = rotationY;
  art.castShadow = false;
  art.receiveShadow = false;
  scene.add(art);
  return art;
}

function backSleeveTexture(project, index) {
  const title = String(project.title.fr || "UNTITLED").toUpperCase();
  const summary = String(project.short.fr || "");
  return makeTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#dfd4c0"; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#28352e"; ctx.fillRect(0, 0, 512, 70);
    ctx.fillStyle = "#e8d8b7"; ctx.font = "bold 18px monospace"; ctx.textAlign = "left";
    ctx.fillText("SIDE B  /  LINER NOTES", 32, 43);
    ctx.fillStyle = "#4a4338"; ctx.font = "bold 26px Arial";
    const words = title.split(/\s+/); let line = "", lines = [];
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > 444 && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((value, i) => ctx.fillText(value, 32, 126 + i * 32));
    ctx.fillStyle = "#716552"; ctx.fillRect(32, 160, 448, 2);
    ctx.fillStyle = "#544b3e"; ctx.font = "18px Arial";
    const text = summary.length > 225 ? summary.slice(0, 222) + "…" : summary;
    const tokens = text.split(/\s+/); let paragraph = "", row = 0;
    for (const token of tokens) {
      const next = paragraph ? paragraph + " " + token : token;
      if (ctx.measureText(next).width > 440 && paragraph) {
        ctx.fillText(paragraph, 32, 205 + row * 27); row++; paragraph = token;
      } else paragraph = next;
      if (row >= 5) break;
    }
    if (paragraph && row < 6) ctx.fillText(paragraph, 32, 205 + row * 27);
    ctx.fillStyle = "#897b66"; ctx.font = "bold 14px monospace";
    ctx.fillText("CATALOGUE NO. " + String(index + 1).padStart(2, "0"), 32, 458);
    ctx.fillText("INDEPENDENT PRESSING  /  SIDE A", 32, 482);
    ctx.strokeStyle = "rgba(53,44,32,.45)"; ctx.lineWidth = 2; ctx.strokeRect(14, 14, 484, 484);
  });
}

function createRecord(project, index, position, materials) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = Math.PI + (index % 2 ? .018 : -.018);
  group.userData.projectId = project.id;
  group.userData.project = project;
  group.userData.provisionalArtwork = true;
  group.userData.isRecord = true;

  const sleeveBody = new THREE.Mesh(new THREE.BoxGeometry(.65, .72, .045), materials.cardboard);
  sleeveBody.castShadow = true; sleeveBody.receiveShadow = true; group.add(sleeveBody);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(.626, .696),
    new THREE.MeshBasicMaterial({ map: backSleeveTexture(project, index), side: THREE.DoubleSide })
  );
  back.position.z = -.024; back.rotation.y = Math.PI; back.scale.x = -1; group.add(back);

  const flap = new THREE.Group();
  flap.position.set(-.325, 0, .025); group.add(flap);
  const flapBoard = new THREE.Mesh(new THREE.BoxGeometry(.65, .72, .014), materials.cardboard);
  flapBoard.position.x = .325; flapBoard.castShadow = true; flap.add(flapBoard);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(.626, .696),
    new THREE.MeshBasicMaterial({ map: sleeveTexture(project, index), side: THREE.DoubleSide })
  );
  front.position.set(.325, 0, .009); front.scale.x = -1; flap.add(front);

  const discAssembly = new THREE.Group();
  discAssembly.position.set(.16, .02, .055); group.add(discAssembly);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.285, .285, .012, 40), materials.vinyl);
  disc.rotation.x = Math.PI / 2; disc.castShadow = false; disc.receiveShadow = true; discAssembly.add(disc);
  for (const radius of [.17, .205, .24]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(radius, .0018, 3, 40), materials.rim);
    groove.position.z = .0072; discAssembly.add(groove);
  }
  const label = new THREE.Mesh(new THREE.CircleGeometry(.075, 28), materials.label);
  label.position.z = .0075; discAssembly.add(label);
  const labelText = new THREE.Mesh(
    new THREE.CircleGeometry(.055, 28),
    new THREE.MeshBasicMaterial({ color: PROJECT_COLORS[index % PROJECT_COLORS.length][0] })
  );
  labelText.position.z = .008; discAssembly.add(labelText);
  const spindle = new THREE.Mesh(new THREE.CircleGeometry(.012, 12), materials.spindle);
  spindle.position.z = .0085; discAssembly.add(spindle);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.285, .004, 4, 40), materials.rim);
  rim.position.z = .007; discAssembly.add(rim);

  group.userData.flap = flap;
  group.userData.discAssembly = discAssembly;
  group.userData.discHome = discAssembly.position.clone();
  group.userData.isOpen = false;
  group.userData.isFlipped = false;
  return group;
}
function createRecordCrate(scene, category, categoryProjects, materials, x, z, recordRoots) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const width = 2.30;
  const depth = 1.36;
  addBox(group, [width, .15, depth], [0, .66, 0], materials.wood);
  addBox(group, [width, .72, .12], [0, .98, depth / 2 - .06], materials.wood);
  addBox(group, [width, .72, .12], [0, .98, -depth / 2 + .06], materials.wood);
  addBox(group, [.12, .72, depth - .12], [-width / 2 + .06, .98, 0], materials.wood);
  addBox(group, [.12, .72, depth - .12], [width / 2 - .06, .98, 0], materials.wood);

  const rail = addBox(group, [width - .08, .06, .07], [0, 1.34, depth / 2 - .10], materials.trim);
  rail.castShadow = false;

  const ticket = makeTexture(640, 112, (ctx) => {
    ctx.fillStyle = "#e8dec7"; ctx.fillRect(0, 0, 640, 112);
    ctx.fillStyle = "#30382f"; ctx.fillRect(7, 7, 626, 98);
    ctx.strokeStyle = "#cbb68e"; ctx.lineWidth = 2; ctx.strokeRect(15, 15, 610, 82);
    ctx.fillStyle = "#f0e2c6"; ctx.font = "bold 25px monospace"; ctx.textAlign = "center";
    ctx.fillText(category.fr.toUpperCase(), 320, 48, 590);
    ctx.fillStyle = "#d8ad69"; ctx.font = "bold 13px monospace";
    ctx.fillText(String(categoryProjects.length).padStart(2, "0") + " PRESSING" + (categoryProjects.length > 1 ? "S" : "") + "  /  SIDE A", 320, 80);
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.06, .30),
    new THREE.MeshBasicMaterial({ map: ticket })
  );
  label.position.set(0, 1.01, -depth / 2 - .012);
  label.rotation.y = Math.PI;
  label.scale.x = -1;
  group.add(label);

  const count = categoryProjects.length;
  categoryProjects.forEach((project, index) => {
    const spacing = count === 1 ? 0 : count === 2 ? .64 : .54;
    const xPosition = (index - (count - 1) / 2) * spacing;
    const record = createRecord(project, index, [xPosition, 1.38 + (index % 2) * .025, -.08 + (index % 2) * .10], materials);
    group.add(record);
    record.userData.homeParent = group;
    record.userData.homePosition = record.position.clone();
    record.userData.homeQuaternion = record.quaternion.clone();
    record.userData.homeScale = record.scale.clone();
    recordRoots.push(record);
  });

  group.userData.categoryId = category.id;
  group.userData.projectCount = count;
  scene.add(group);
  return group;
}

function applicationCardTexture(application, index) {
  const palette = [
    ["#d5a253", "#3c4e47"], ["#7e9c9a", "#233d43"], ["#d6a49a", "#4f3941"], ["#8ca2bd", "#283746"],
    ["#77a4a0", "#26433e"], ["#d6b16f", "#4f4737"], ["#ad7a6a", "#382e31"], ["#a4a6bb", "#36384b"]
  ][index % 8];
  return makeTexture(384, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 384, 512);
    gradient.addColorStop(0, palette[0]); gradient.addColorStop(1, palette[1]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = "rgba(12,17,17,.22)"; ctx.fillRect(12, 12, 360, 488);
    ctx.strokeStyle = "rgba(244,232,209,.68)"; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 352, 480);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(250,241,220,.76)"; ctx.font = "bold 22px monospace";
    ctx.fillText("SIDE A / WEB TOOLS", 192, 64);
    ctx.fillStyle = "#f7edd9"; ctx.font = "900 44px Arial";
    const words = application.name.toUpperCase().split(/\s+/);
    let line = "", lines = [];
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > 320 && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    const size = lines.length > 2 ? 31 : 42;
    ctx.font = "900 " + size + "px Arial";
    lines.slice(0, 3).forEach((value, row) => ctx.fillText(value, 192, 245 + row * size * 1.12, 320));
    ctx.fillStyle = "rgba(249,239,218,.82)"; ctx.font = "bold 17px monospace";
    ctx.fillText(application.category.fr.toUpperCase(), 192, 398, 320);
    ctx.fillStyle = "rgba(9,14,14,.52)"; ctx.fillRect(34, 435, 316, 42);
    ctx.fillStyle = "#f2e5cb"; ctx.font = "bold 15px monospace";
    ctx.fillText("APP / " + String(index + 1).padStart(2, "0"), 192, 462);
  });
}

function createApplicationRack(scene, applications, materials, applicationRoots) {
  const rack = new THREE.Group();
  rack.position.set(5.94, 0, 4.92);
  rack.rotation.y = -Math.PI / 2;

  addBox(rack, [3.02, 2.30, .16], [0, 1.92, 0], materials.wood);
  addBox(rack, [3.08, .10, .22], [0, .82, .10], materials.trim);
  addBox(rack, [3.08, .10, .22], [0, 1.89, .10], materials.trim);
  addBox(rack, [3.08, .10, .22], [0, 2.97, .10], materials.trim);
  addBox(rack, [.09, 2.18, .18], [-1.48, 1.92, .10], materials.trim);
  addBox(rack, [.09, 2.18, .18], [1.48, 1.92, .10], materials.trim);

  const header = makeTexture(768, 112, (ctx) => {
    ctx.fillStyle = "#26342e"; ctx.fillRect(0, 0, 768, 112);
    ctx.strokeStyle = "#d9c59f"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 752, 96);
    ctx.fillStyle = "#f0e2c6"; ctx.font = "bold 34px monospace"; ctx.textAlign = "center";
    ctx.fillText("SOPP AGENTS  /  WEB APPLICATIONS", 384, 68, 720);
  });
  const headerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.82, .42),
    new THREE.MeshBasicMaterial({ map: header })
  );
  headerMesh.position.set(0, 3.30, .105);
  rack.add(headerMesh);

  applications.forEach((application, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const card = new THREE.Group();
    card.position.set(-1.08 + col * .72, 1.34 + row * .98, .17);
    card.userData.isApplication = true;
    card.userData.application = application;
    card.userData.homePosition = card.position.clone();
    card.userData.homeScale = card.scale.clone();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(.62, .82, .09),
      new THREE.MeshStandardMaterial({ color: 0x443e34, roughness: .78 })
    );
    body.castShadow = true;
    card.add(body);
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(.586, .786),
      new THREE.MeshBasicMaterial({ map: applicationCardTexture(application, index), side: THREE.DoubleSide })
    );
    front.position.z = .052;
    card.add(front);
    rack.add(card);
    applicationRoots.push(card);
  });

  scene.add(rack);
  return rack;
}
function createShelf(scene, side, z, level, materials, projects, shelfIndex) {
  const x = side * 5.68;
  const y = .78 + level * 1.08;
  addBox(scene, [1.0, .09, 2.55], [x - side * .08, y, z], materials.wood);
  addBox(scene, [1.0, .045, 2.55], [x - side * .08, y + .07, z], materials.trim);
  for (let i = 0; i < 6; i++) {
    const project = projects[(shelfIndex * 6 + i) % projects.length];
    addWallCover(scene, side * 5.55, y + .47, z - 1.05 + i * .42, side === -1 ? Math.PI / 2 : -Math.PI / 2, project.title.fr, shelfIndex * 6 + i, .34, .52);
  }
}

function createFrontWindow(scene, materials) {
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc7d9d9, transparent: true, opacity: .22, roughness: .12, metalness: .06,
    side: THREE.DoubleSide
  });
  const frame = materials.trim;
  const z = ROOM.frontZ - .10;
  const windowY = 2.58;

  addBox(scene, [.16, 4.55, .18], [-6.08, 2.27, z], frame);
  addBox(scene, [.16, 4.55, .18], [6.08, 2.27, z], frame);
  addBox(scene, [12.2, .18, .18], [0, 4.48, z], frame);
  addBox(scene, [12.2, .18, .18], [0, .10, z], frame);
  addBox(scene, [12.2, .10, .18], [0, 1.03, z], frame);

  for (const x of [-4.18, -2.15, 2.15, 4.18]) {
    addBox(scene, [.09, 3.38, .20], [x, 2.72, z], frame);
  }
  const windowPanel = new THREE.Mesh(new THREE.PlaneGeometry(11.9, 3.28), glass);
  windowPanel.position.set(0, windowY, z - .10);
  scene.add(windowPanel);

  // Double entrance doors with hinged pivots. They open during the intro transition.
  const leftPivot = new THREE.Group();
  leftPivot.position.set(-.95, .10, z - .17);
  const leftDoor = addBox(leftPivot, [.92, 2.78, .10], [.46, 1.39, 0], frame);
  leftDoor.material = frame;
  const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(.80, 2.52), glass);
  leftGlass.position.set(.46, 1.40, .061);
  leftPivot.add(leftGlass);
  scene.add(leftPivot);

  const rightPivot = new THREE.Group();
  rightPivot.position.set(.95, .10, z - .17);
  const rightDoor = addBox(rightPivot, [.92, 2.78, .10], [-.46, 1.39, 0], frame);
  const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(.80, 2.52), glass);
  rightGlass.position.set(-.46, 1.40, .061);
  rightPivot.add(rightGlass);
  scene.add(rightPivot);

  addBox(scene, [.08, .42, .10], [-.06, 2.15, z - .08], materials.metal);
  const openLabel = createSign(scene, "SIDE A  /  OPEN", [0, 4.03, z - .22], 2.65, .43);
  openLabel.rotation.y = Math.PI;
  return { leftPivot, rightPivot, openLabel, open: false };
}

function createCounterAndListeningCorner(scene, materials) {
  // Checkout counter on the right-hand side, visible from the fixed entrance viewpoint.
  const counter = new THREE.Group();
  counter.position.set(4.55, 0, -3.30);
  addBox(counter, [2.42, .94, .84], [0, .55, 0], materials.wood);
  addBox(counter, [2.52, .10, .92], [0, 1.06, 0], materials.trim);
  addBox(counter, [2.30, .06, .72], [0, .98, 0], materials.wood);
  addBox(counter, [.55, .35, .42], [-.55, 1.28, -.10], materials.dark);
  addBox(counter, [.48, .25, .025], [-.55, 1.32, .115], materials.screen);
  addBox(counter, [.38, .13, .24], [.62, 1.18, -.09], materials.metal);
  const registerDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(.31, .09),
    new THREE.MeshBasicMaterial({ color: 0x9bc0a3 })
  );
  registerDisplay.position.set(-.55, 1.34, .132);
  counter.add(registerDisplay);
  // A tiny lucky-cat charm is a hidden, clickable in-store easter egg.
  const easterEgg = new THREE.Group();
  easterEgg.position.set(.78, 1.15, .18);
  easterEgg.userData.isEasterEgg = true;
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(.082, 12, 10), materials.label);
  catBody.scale.set(.82, 1.12, .78);
  catBody.position.y = .09;
  easterEgg.add(catBody);
  const catHead = new THREE.Mesh(new THREE.SphereGeometry(.073, 12, 10), materials.label);
  catHead.position.set(0, .225, .014);
  easterEgg.add(catHead);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.034, .075, 5), materials.label);
    ear.position.set(side * .046, .292, .012);
    easterEgg.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.008, 8, 6), materials.dark);
    eye.position.set(side * .025, .232, .081);
    easterEgg.add(eye);
  }
  const catCollar = new THREE.Mesh(new THREE.TorusGeometry(.056, .009, 6, 14), materials.rim);
  catCollar.position.set(0, .163, .015);
  easterEgg.add(catCollar);
  const raisedPaw = new THREE.Mesh(new THREE.SphereGeometry(.032, 10, 8), materials.label);
  raisedPaw.position.set(.086, .23, .018);
  raisedPaw.rotation.z = -.28;
  easterEgg.add(raisedPaw);
  counter.add(easterEgg);
  scene.add(counter);

  // A compact turntable with a slowly rotating record.
  const deck = new THREE.Group();
  deck.position.set(-.22, 1.13, 0);
  addBox(deck, [1.05, .13, .82], [0, .06, 0], materials.dark);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .035, 48), materials.metal);
  platter.position.set(0, .155, 0);
  deck.add(platter);
  const record = new THREE.Mesh(new THREE.CylinderGeometry(.275, .275, .012, 48), materials.vinyl);
  record.position.set(0, .18, 0);
  deck.add(record);
  const label = new THREE.Mesh(new THREE.CircleGeometry(.065, 24), materials.label);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, .188, 0);
  deck.add(label);
  const arm = new THREE.Group();
  arm.position.set(.34, .22, -.25);
  const armBar = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .38, 8), materials.metal);
  armBar.rotation.z = Math.PI / 2.8;
  armBar.position.x = -.08;
  arm.add(armBar);
  deck.add(arm);
  counter.add(deck);

  // Listening stool and a small speaker stack.
  const stool = new THREE.Group();
  stool.position.set(-4.55, 0, 4.82);
  addBox(stool, [.62, .12, .62], [0, .65, 0], materials.wood);
  for (const dx of [-.22, .22]) for (const dz of [-.22, .22]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .65, 8), materials.metal);
    leg.position.set(dx, .31, dz);
    stool.add(leg);
  }
  scene.add(stool);
  const speaker = new THREE.Group();
  speaker.position.set(-5.32, 0, 1.1);
  addBox(speaker, [.42, 1.22, .55], [0, .61, 0], materials.dark);
  for (const y of [.35, .88]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.125, .125, .035, 24), materials.metal);
    cone.rotation.z = Math.PI / 2;
    cone.position.set(.225, y, .02);
    speaker.add(cone);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .04, 16), materials.label);
    center.rotation.z = Math.PI / 2;
    center.position.set(.25, y, .02);
    speaker.add(center);
  }
  scene.add(speaker);
  return { platter: record, easterEgg };
}

function createShopkeeper(scene, materials) {
  const figure = new THREE.Group();
  figure.position.set(4.15, 0, -2.35);
  figure.rotation.y = -Math.PI / 2.3;

  const cardigan = new THREE.Mesh(new THREE.CapsuleGeometry(.29, .62, 5, 10), materials.cardigan);
  cardigan.position.set(0, 1.32, 0);
  figure.add(cardigan);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(.28, .42, .10), materials.shirt);
  shirt.position.set(0, 1.45, .235);
  figure.add(shirt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(.205, 20, 16), materials.skin);
  head.position.set(0, 2.02, .03);
  figure.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.214, 18, 12, 0, Math.PI * 2, 0, Math.PI * .50), materials.hair);
  hair.position.set(0, 2.08, .02);
  figure.add(hair);
  for (const x of [-.09, .09]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(.052, .008, 6, 18), materials.metal);
    lens.position.set(x, 2.02, .222);
    figure.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .12, 6), materials.metal);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 2.02, .23);
  figure.add(bridge);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.027, 8, 8), materials.skin);
  nose.position.set(0, 1.98, .245);
  figure.add(nose);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .42, 4, 8), materials.cardigan);
    arm.position.set(side * .34, 1.34, .02);
    arm.rotation.z = side * -.22;
    figure.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), materials.skin);
    hand.position.set(side * .39, 1.02, .04);
    figure.add(hand);
  }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(.44, .54, .045), materials.apron);
  apron.position.set(0, 1.19, .255);
  figure.add(apron);
  figure.userData.isShopkeeper = true;
  figure.userData.hovered = false;
  scene.add(figure);
  return figure;
}

export function createStoreScene(canvas, projects, categories, applications) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe0d6c2);
  scene.fog = new THREE.Fog(0xe4dac8, 17, 31);

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, .1, 80);
  camera.position.set(0, 1.66, -5.45);
  camera.lookAt(0, 1.55, 1.8);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    alpha: false
  });
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.2 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const woodMap = woodTexture();
  const floorMap = floorTexture();
  const plasterMap = plasterTexture();
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(1.3, 1.7);
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.repeat.set(1, 1);

  const materials = {
    wood: new THREE.MeshStandardMaterial({ map: woodMap, roughness: .82, metalness: .02 }),
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughness: .72, metalness: .025 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterMap, roughness: .96 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x644a32, roughness: .72 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x7d8178, metalness: .73, roughness: .35 }),
    cardboard: new THREE.MeshStandardMaterial({ color: 0xc6b18e, roughness: .92 }),
    vinyl: new THREE.MeshStandardMaterial({ color: 0x111416, roughness: .27, metalness: .18 }),
    label: new THREE.MeshStandardMaterial({ color: 0xd7a34a, roughness: .58 }),
    spindle: new THREE.MeshBasicMaterial({ color: 0xd9d0bd }),
    rim: new THREE.MeshBasicMaterial({ color: 0x414442 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x252823, roughness: .62 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x293e3b, emissive: 0x142522, emissiveIntensity: .28 }),
    cardigan: new THREE.MeshStandardMaterial({ color: 0x435447, roughness: .92 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0xe0d5bf, roughness: .95 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc49a79, roughness: .88 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x9b9b8d, roughness: .96 }),
    apron: new THREE.MeshStandardMaterial({ color: 0x80694b, roughness: .95 })
  };

  // Daylight enters through the front glass. Warm interior bounce keeps the room inviting.
  const hemi = new THREE.HemisphereLight(0xfff0d9, 0x594936, 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe4bd, 2.8);
  sun.position.set(-1.6, 7.5, 8.2);
  sun.target.position.set(0, 0, -1.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -.00025;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xd9e6ed, .65);
  fill.position.set(5, 4, -4);
  scene.add(fill);

  // Room shell: one compact shop, not a multi-room warehouse.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, .015, .05);
  floor.receiveShadow = true;
  scene.add(floor);

  addBox(scene, [ROOM.width, ROOM.height, .20], [0, ROOM.height / 2, ROOM.backZ], materials.plaster);
  addBox(scene, [.20, ROOM.height, ROOM.depth], [-ROOM.width / 2, ROOM.height / 2, .05], materials.plaster);
  addBox(scene, [.20, ROOM.height, ROOM.depth], [ROOM.width / 2, ROOM.height / 2, .05], materials.plaster);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), new THREE.MeshStandardMaterial({ color: 0xd8cdb9, roughness: .95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, .05);
  scene.add(ceiling);

  // Skirting boards and ceiling beams add scale and make the small space feel built.
  addBox(scene, [12.0, .22, .18], [0, .12, -7.38], materials.wood);
  addBox(scene, [.18, .22, 15.0], [-6.08, .12, .05], materials.wood);
  addBox(scene, [.18, .22, 15.0], [6.08, .12, .05], materials.wood);
  for (const x of [-4.3, 0, 4.3]) {
    addBox(scene, [.10, .15, 15], [x, 4.52, .05], materials.wood);
  }

  // Front windows and the double entrance are the main source of natural light.
  const doors = createFrontWindow(scene, materials);
  addBox(scene, [12.2, .16, .24], [0, 4.52, ROOM.frontZ - .1], materials.wood);

  // A modest shop sign inside the room, visible from the entrance viewpoint.
  createSign(scene, "SIDE A  /  RECORDS", [0, 4.05, -7.40], 3.9, .58, 0);
  createSign(scene, "LISTEN  /  DISCOVER  /  REPEAT", [0, 3.55, -7.39], 4.8, .25, 0);

  // Dense wall shelves retain their album-cover backdrop. The right-front module becomes the independent app rack.
  for (const side of [-1, 1]) {
    for (let level = 0; level < 3; level++) {
      for (const z of [-3.45, -.35, 2.75, 5.25]) {
        if (side === 1 && z === 5.25) continue;
        createShelf(scene, side, z, level, materials, projects, level * 8 + Math.round(z + 4));
      }
    }
  }

  // Framed decorative sleeves and gig posters give the rear wall a collected, personal look.
  for (let i = 0; i < 7; i++) {
    const project = projects[i % projects.length];
    addWallCover(scene, -4.6 + i * 1.53, 2.25 + (i % 2) * .08, -7.36, 0, project.title.fr, i, .86, 1.05);
  }
  const posterLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(.82, 1.22),
    new THREE.MeshBasicMaterial({ map: createPosterTexture(14, "LIVE / 1996"), side: THREE.DoubleSide })
  );
  posterLeft.position.set(-5.2, 3.15, -7.34);
  scene.add(posterLeft);
  const posterRight = new THREE.Mesh(
    new THREE.PlaneGeometry(.82, 1.22),
    new THREE.MeshBasicMaterial({ map: createPosterTexture(18, "LOCAL SOUNDS"), side: THREE.DoubleSide })
  );
  posterRight.position.set(5.2, 3.15, -7.34);
  scene.add(posterRight);

  // Six category bins: each physical record appears once, while multi-category tags remain available in the data.
  const recordRoots = [];
  const categoryBins = [];
  const binPositions = [
    [-3.62, -.72], [0, -.72], [3.62, -.72],
    [-3.62, 2.45], [0, 2.45], [3.62, 2.45]
  ];
  categories.forEach((category, index) => {
    const categoryProjects = projects.filter(project => project.categories[0] === category.id);
    const [x, z] = binPositions[index];
    categoryBins.push(createRecordCrate(scene, category, categoryProjects, materials, x, z, recordRoots));
  });

  // A distinct right-wall rack holds all eight live SOPP applications.
  const applicationRoots = [];
  const applicationRack = createApplicationRack(scene, applications, materials, applicationRoots);

  // A small personal corner: framed music sleeves and a discreet profile plaque.
  createSign(scene, "ABOUT  /  ADAM", [-5.91, 3.48, -1.85], 1.72, .34, Math.PI / 2);
  addWallCover(scene, -5.91, 2.56, -2.62, Math.PI / 2, "DAVIS MILES", 31, .78, .92);
  addWallCover(scene, -5.91, 2.56, -1.18, Math.PI / 2, "STORY.", 32, .78, .92);
  addBox(scene, [.16, .08, 2.18], [-5.80, 2.02, -1.90], materials.wood);
  addBox(scene, [.10, .035, 2.18], [-5.70, 2.075, -1.90], materials.trim);

  // Checkout, vintage register, turntable and listening corner.
  const listening = createCounterAndListeningCorner(scene, materials);
  const shopkeeper = createShopkeeper(scene, materials);

  // Hanging fixtures and warm bulbs, with restrained emissive highlights.
  for (const x of [-3.7, 0, 3.7]) {
    const fixture = new THREE.Group();
    fixture.position.set(x, 4.40, .35);
    addBox(fixture, [.52, .08, .56], [0, 0, 0], materials.metal);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(.095, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe6b4 })
    );
    bulb.position.y = -.12;
    fixture.add(bulb);
    const light = new THREE.PointLight(0xffd89f, 1.65, 5.5, 2);
    light.position.y = -.20;
    fixture.add(light);
    scene.add(fixture);
  }

  const doorState = { doors, progress: 0, target: 0 };
  function openDoors() { doorState.target = 1; }
  function closeDoors() { doorState.target = 0; }
  function update(delta, elapsed) {
    doorState.progress = THREE.MathUtils.damp(doorState.progress, doorState.target, 3.8, delta);
    const swing = doorState.progress * .72;
    doors.leftPivot.rotation.y = -swing;
    doors.rightPivot.rotation.y = swing;
    listening.platter.rotation.y = elapsed * .65;
    shopkeeper.position.y = Math.sin(elapsed * .7) * .006;
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  return {
    scene, camera, renderer, materials, recordRoots, applicationRoots, categoryBins, applicationRack, shopkeeper, easterEgg: listening.easterEgg, openDoors, closeDoors, update, resize,
    cameraHome: { position: camera.position.clone(), rotation: camera.rotation.clone() }
  };
}
