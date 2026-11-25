// Shared PBR material library for the store. Built once, reused everywhere.
import * as THREE from "three";
import {
  woodSet, plasterSet, checkerFloorSet, ceilingTileSet, brushedMetalSet, cardboardSet, fabricSet, rubberSet, pavementSet
} from "./textures.js";

function standard(options) {
  const m = new THREE.MeshStandardMaterial(options);
  return m;
}
function physical(options) {
  return new THREE.MeshPhysicalMaterial(options);
}

function bind(material, set, normalScale = 1) {
  if (set.map) material.map = set.map;
  if (set.normalMap) { material.normalMap = set.normalMap; material.normalScale = new THREE.Vector2(normalScale, normalScale); }
  if (set.roughnessMap) material.roughnessMap = set.roughnessMap;
  return material;
}

export function createMaterials(quality, onStep = () => {}) {
  const T = quality.textureSize;
  const A = quality.anisotropy;
  const tick = (label) => onStep(label);

  const oak = woodSet(T, { seed: 3, tones: ["#2f1c0f", "#6a4425"], boards: 4, knots: 3, name: "oak" }); tick("wood");
  const pine = woodSet(T, { seed: 9, tones: ["#7c5a32", "#b88a52"], boards: 5, knots: 5, name: "pine", grainContrast: .9 }); tick("wood");
  const plaster = plasterSet(T, { seed: 11 }); tick("plaster");
  const floor = checkerFloorSet(T, { seed: 21, a: "#1f3d3f", b: "#d9c9a3", tiles: 8 }); tick("floor");
  const tile = ceilingTileSet(Math.min(T, 512), { seed: 31 }); tick("ceiling");
  const metal = brushedMetalSet(Math.min(T, 512), { seed: 41 });
  const cardboard = cardboardSet(Math.min(T, 512), { seed: 51 });
  const fabric = fabricSet(Math.min(T, 512), { seed: 61 });
  const rubber = rubberSet(Math.min(T, 256), { seed: 71 });
  const pavement = pavementSet(Math.min(T, 512), { seed: 81 }); tick("props");

  for (const set of [oak, pine, plaster, floor, tile, metal, cardboard, fabric, rubber, pavement]) {
    for (const t of Object.values(set)) t.anisotropy = A;
  }

  const m = {};
  // Wood: oak bins and furniture (dark satin), pine shelves (light), varnished counter top
  m.oak = bind(standard({ color: 0xffffff, roughness: 1, metalness: 0, name: "oak" }), oak, .9);
  m.pine = bind(standard({ color: 0xffffff, roughness: 1, metalness: 0, name: "pine" }), pine, .8);
  m.counterTop = bind(physical({ color: 0xd8c0a0, roughness: 1, metalness: 0, clearcoat: .6, clearcoatRoughness: .28, name: "counterTop" }), oak, .7);
  m.painted = bind(standard({ color: 0xffffff, roughness: 1, name: "paintedWood" }), plaster, .4);
  m.paintedGreen = bind(standard({ color: 0x2f4a3f, roughness: 1, name: "paintedGreen" }), plaster, .5);
  m.paintedCream = bind(standard({ color: 0xe7dcc2, roughness: 1, name: "paintedCream" }), plaster, .5);

  // Walls and ceiling
  m.wall = bind(standard({ color: 0xc9bb9b, roughness: 1, name: "wall" }), plaster, 1);
  m.wallTeal = bind(standard({ color: 0x3f7a78, roughness: 1, name: "wallTeal" }), plaster, 1);
  m.wallDark = bind(standard({ color: 0x2c2724, roughness: 1, name: "wallDark" }), plaster, 1);
  m.ceilingTile = bind(standard({ color: 0xffffff, roughness: 1, name: "ceilingTile" }), tile, 1.2);
  m.ceilingPlain = bind(standard({ color: 0xd8cdb6, roughness: 1, name: "ceilingPlain" }), plaster, .6);

  // Floor: glossy linoleum with clearcoat sheen so sunlight patches read as real reflections
  floor.map.repeat.set(1, 1);
  m.floor = bind(physical({ color: 0xffffff, roughness: 1, metalness: 0, clearcoat: .35, clearcoatRoughness: .35, name: "floor" }), floor, .7);
  m.pavement = bind(standard({ color: 0xffffff, roughness: 1, name: "pavement" }), pavement, 1);

  // Metals and plastics
  m.steel = bind(standard({ color: 0xcfd2d4, roughness: 1, metalness: .85, name: "steel" }), metal, .5);
  m.brass = bind(standard({ color: 0xc9a050, roughness: 1, metalness: .9, name: "brass" }), metal, .4);
  m.blackMetal = bind(standard({ color: 0x1b1c1d, roughness: 1, metalness: .7, name: "blackMetal" }), metal, .5);
  m.plasticBlack = standard({ color: 0x151515, roughness: .38, metalness: .05, name: "plasticBlack" });
  m.plasticBeige = standard({ color: 0xcfc3a5, roughness: .48, metalness: 0, name: "plasticBeige" });
  m.rubber = bind(standard({ color: 0x1a1a1a, roughness: 1, name: "rubber" }), rubber, 1);
  m.cardboard = bind(standard({ color: 0xc9a77a, roughness: 1, name: "cardboard" }), cardboard, 1);
  m.paper = bind(standard({ color: 0xece3cf, roughness: .95, name: "paper" }), cardboard, .4);
  m.fabricGreen = bind(standard({ color: 0x41584a, roughness: 1, name: "fabricGreen" }), fabric, 1);
  m.fabricRed = bind(standard({ color: 0x8c3b2e, roughness: 1, name: "fabricRed" }), fabric, 1);
  m.fabricNavy = bind(standard({ color: 0x28364a, roughness: 1, name: "fabricNavy" }), fabric, 1);
  m.fabricGrey = bind(standard({ color: 0x8f8d86, roughness: 1, name: "fabricGrey" }), fabric, 1);
  m.fabricCream = bind(standard({ color: 0xd8cdb2, roughness: 1, name: "fabricCream" }), fabric, 1);
  m.fabricBlack = bind(standard({ color: 0x1b1b1d, roughness: 1, name: "fabricBlack" }), fabric, 1);
  m.denim = bind(standard({ color: 0x37506f, roughness: 1, name: "denim" }), fabric, 1);

  // Glass
  m.glass = physical({ color: 0xffffff, roughness: .05, metalness: 0, transmission: 0, transparent: true, opacity: .16, ior: 1.45, specularIntensity: 1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false, name: "glass" });

  // Vinyl: near-black, tight specular, groove micro-structure supplied by the disc geometry textures
  m.vinyl = physical({ color: 0x0b0b0c, roughness: .34, metalness: .15, clearcoat: 1, clearcoatRoughness: .08, name: "vinyl" });
  m.vinylLabelPaper = standard({ color: 0xe8e0cc, roughness: .8, name: "labelPaper" });

  // Light fixtures and emissive things
  m.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .86, .62).multiplyScalar(4), toneMapped: true, name: "bulb" });
  m.tube = new THREE.MeshBasicMaterial({ color: new THREE.Color(.96, 1, .98).multiplyScalar(3.6), name: "tube" });
  m.screenGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(.45, 1, .62).multiplyScalar(1.2), name: "screenGreen" });
  m.ledRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .12, .08).multiplyScalar(3), name: "ledRed" });

  // Skin / hair for the characters
  m.skin = standard({ color: 0xc99a7a, roughness: .72, name: "skin" });
  m.skinDark = standard({ color: 0x8a5b3f, roughness: .72, name: "skinDark" });
  m.skinLight = standard({ color: 0xe3b799, roughness: .7, name: "skinLight" });
  m.hairWhite = standard({ color: 0xd9d6cf, roughness: .9, name: "hairWhite" });
  m.hairDark = standard({ color: 0x2a211b, roughness: .85, name: "hairDark" });
  m.hairBrown = standard({ color: 0x5a3b26, roughness: .85, name: "hairBrown" });
  m.eyeWhite = standard({ color: 0xf2efe8, roughness: .3, name: "eyeWhite" });
  m.eyeDark = standard({ color: 0x1b1410, roughness: .25, name: "eyeDark" });
  m.glassesFrame = standard({ color: 0x1a1612, roughness: .35, metalness: .3, name: "glassesFrame" });
  m.lens = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .18, name: "lens" });

  m.dispose = () => {
    for (const set of [oak, pine, plaster, floor, tile, metal, cardboard, fabric, rubber, pavement]) {
      for (const t of Object.values(set)) t.dispose();
    }
    for (const value of Object.values(m)) if (value && value.dispose && value !== m.dispose) value.dispose();
  };
  return m;
}
