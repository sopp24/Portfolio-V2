// Shared PBR material library for the store. Built once, reused everywhere.
// Art direction v2: stylised PBR - clean albedos, bold colour fields from the day palette (docs/ART_DIRECTION.md §2),
// believable gloss on plastic / lacquer / vinyl / glass, warmer and cleaner wood and metal.
//
// Palette keys (all MeshStandard/Physical, ready to use from any builder through `ctx.materials`):
//   wall*      plaster colour blocks  : wall (cream, default), wallCream, wallCoral, wallTeal, wallCyan, wallInk, wallDark (ink), wallSun, wallViolet, wallMint
//   painted*   satin paint on wood    : painted, paintedCream, paintedInk, paintedGreen (ink - legacy name), paintedCoral, paintedSun, paintedCyan, paintedViolet, paintedMint
//   lacquer*   glossy lacquer         : lacquerInk, lacquerPaper, lacquerCoral, lacquerSun, lacquerCyan, lacquerViolet, lacquerMint
//   plastic*   glossy moulded plastic : plasticBlack, plasticBeige, plasticInk, plasticPaper, plasticCoral, plasticSun, plasticCyan, plasticViolet, plasticMint
//   fabric*    cloth                  : fabricGreen (mint-teal), fabricRed (coral), fabricNavy, fabricGrey, fabricCream, fabricBlack, denim
// `makeNeonMaterial(hex, base)` builds an emissive tube material that follows the neon ramp when pushed to `ctx.neonMaterials`.
import * as THREE from "three";
import {
  woodSet, plasterSet, checkerFloorSet, ceilingTileSet, brushedMetalSet, cardboardSet, fabricSet, rubberSet, pavementSet
} from "./textures.js";

// day palette (UI tokens) and their 3D-albedo counterparts (a little deeper so that sunlit surfaces never clip)
export const DAY = Object.freeze({
  ink: 0x12162b, paper: 0xfff6e3, sun: 0xffc83d, coral: 0xff5b4a, cyan: 0x19d5e8, violet: 0x6b4dff, mint: 0x3ee6a8, sky: 0x9ed8ff,
  // albedos
  cream: 0xf0e4c9, teal: 0x14a6b3, inkSoft: 0x1b2145, coralAlb: 0xf0584a, sunAlb: 0xf5b92f, cyanAlb: 0x17c4d6, violetAlb: 0x6a50f0, mintAlb: 0x35d99d
});

function standard(options) { return new THREE.MeshStandardMaterial(options); }
function physical(options) { return new THREE.MeshPhysicalMaterial(options); }

function bind(material, set, normalScale = 1) {
  if (set.map) material.map = set.map;
  if (set.normalMap) { material.normalMap = set.normalMap; material.normalScale = new THREE.Vector2(normalScale, normalScale); }
  if (set.roughnessMap) material.roughnessMap = set.roughnessMap;
  return material;
}

// Emissive tube / sign material that follows the neon ramp: push it to ctx.neonMaterials and it fades in with the shop's neon.
export function makeNeonMaterial(hex, base = 3, { map = null } = {}) {
  const material = new THREE.MeshStandardMaterial({ color: 0x0a0c18, emissive: new THREE.Color(hex), emissiveIntensity: 0, roughness: .35, metalness: 0, name: "neon" });
  if (map) { material.map = map; material.emissiveMap = map; material.color.setHex(0xffffff); material.emissive.setHex(0xffffff); }
  material.userData.neonBase = base;
  return material;
}

export function createMaterials(quality, onStep = () => {}) {
  const T = quality.textureSize;
  const A = quality.anisotropy;
  const glossy = quality.id !== "low"; // clearcoat costs an extra BRDF lobe per light: low tier uses plain standard materials
  const tick = (label) => onStep(label);
  const gloss = (options, coat = {}) => (glossy ? physical({ ...options, ...coat }) : standard(options));

  const oak = woodSet(T, { seed: 3, tones: ["#6b3f1d", "#c98f50"], boards: 4, knots: 3, name: "oak" }); tick("wood");
  const pine = woodSet(T, { seed: 9, tones: ["#cf9d62", "#efd09a"], boards: 5, knots: 4, name: "pine", grainContrast: .8 }); tick("wood");
  const plaster = plasterSet(T, { seed: 11 }); tick("plaster");
  const floor = checkerFloorSet(T, { seed: 21, a: "#212a66", b: "#ecdcb9", tiles: 8, accents: ["#ff5b4a", "#ffc83d", "#19d5e8"] }); tick("floor");
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
  // ---- Wood: honey oak bins and furniture, light birch shelves, lacquered counter top
  m.oak = bind(gloss({ color: 0xffffff, roughness: 1, metalness: 0, name: "oak" }, { clearcoat: .22, clearcoatRoughness: .5 }), oak, .55);
  m.pine = bind(standard({ color: 0xffffff, roughness: 1, metalness: 0, name: "pine" }), pine, .5);
  m.counterTop = bind(gloss({ color: 0xf0d3a8, roughness: 1, metalness: 0, name: "counterTop" }, { clearcoat: .8, clearcoatRoughness: .16 }), oak, .4);

  // ---- Painted wood (satin) - colour fields from the day palette
  const painted = (name, color, normal = .22) => bind(standard({ color, roughness: 1, name }), plaster, normal);
  m.painted = painted("paintedWood", 0xffffff);
  m.paintedCream = painted("paintedCream", DAY.cream);
  m.paintedInk = painted("paintedInk", DAY.inkSoft, .18);
  m.paintedGreen = painted("paintedGreen", DAY.inkSoft, .18);   // legacy name: window frames, bin fronts, cabinets -> now deep ink
  m.paintedCoral = painted("paintedCoral", DAY.coralAlb);
  m.paintedSun = painted("paintedSun", DAY.sunAlb);
  m.paintedCyan = painted("paintedCyan", DAY.cyanAlb);
  m.paintedViolet = painted("paintedViolet", DAY.violetAlb);
  m.paintedMint = painted("paintedMint", DAY.mintAlb);

  // ---- Glossy lacquer (no texture: clean flat colour with a clearcoat highlight)
  const lacquer = (name, color) => gloss({ color, roughness: .46, metalness: 0, name }, { clearcoat: .55, clearcoatRoughness: .2 });
  m.lacquerInk = lacquer("lacquerInk", DAY.inkSoft);
  m.lacquerPaper = lacquer("lacquerPaper", DAY.cream);
  m.lacquerCoral = lacquer("lacquerCoral", DAY.coralAlb);
  m.lacquerSun = lacquer("lacquerSun", DAY.sunAlb);
  m.lacquerCyan = lacquer("lacquerCyan", DAY.cyanAlb);
  m.lacquerViolet = lacquer("lacquerViolet", DAY.violetAlb);
  m.lacquerMint = lacquer("lacquerMint", DAY.mintAlb);

  // ---- Walls and ceiling: clean plaster colour blocks (the texture is only a whisper of paint roller)
  const wallMat = (name, color, normal = .5) => bind(standard({ color, roughness: 1, name }), plaster, normal);
  m.wall = wallMat("wall", DAY.cream);
  m.wallCream = m.wall;
  m.wallTeal = wallMat("wallTeal", DAY.teal);
  m.wallCyan = wallMat("wallCyan", DAY.cyanAlb);
  m.wallCoral = wallMat("wallCoral", DAY.coralAlb);
  m.wallInk = wallMat("wallInk", DAY.inkSoft);
  m.wallDark = wallMat("wallDark", DAY.inkSoft);
  m.wallSun = wallMat("wallSun", DAY.sunAlb);
  m.wallViolet = wallMat("wallViolet", DAY.violetAlb);
  m.wallMint = wallMat("wallMint", DAY.mintAlb);
  m.ceilingTile = bind(standard({ color: 0xffffff, roughness: 1, name: "ceilingTile" }), tile, .8);
  m.ceilingPlain = bind(standard({ color: 0xf2eadb, roughness: 1, name: "ceilingPlain" }), plaster, .3);

  // ---- Floor: crisp graphic checker (ink / cream + a few palette accent tiles), sealed and glossy so the sun and windows glint in it
  floor.map.repeat.set(1, 1);
  m.floor = bind(gloss({ color: 0xffffff, roughness: 1, metalness: 0, name: "floor" }, { clearcoat: .6, clearcoatRoughness: .14 }), floor, .25);
  m.pavement = bind(standard({ color: 0xffffff, roughness: 1, name: "pavement" }), pavement, .8);

  // ---- Metals and plastics
  m.steel = bind(standard({ color: 0xdfe3ea, roughness: 1, metalness: .9, name: "steel" }), metal, .3);
  m.brass = bind(standard({ color: 0xf0bd55, roughness: 1, metalness: .95, name: "brass" }), metal, .25);
  m.blackMetal = bind(standard({ color: 0x1c2140, roughness: 1, metalness: .65, name: "blackMetal" }), metal, .3);
  const plastic = (name, color, rough = .36) => gloss({ color, roughness: rough, metalness: 0, name }, { clearcoat: .4, clearcoatRoughness: .16 });
  m.plasticBlack = plastic("plasticBlack", 0x151932, .3);
  m.plasticInk = m.plasticBlack;
  m.plasticBeige = plastic("plasticBeige", 0xe9dcc0, .38);
  m.plasticPaper = m.plasticBeige;
  m.plasticCoral = plastic("plasticCoral", DAY.coralAlb);
  m.plasticSun = plastic("plasticSun", DAY.sunAlb);
  m.plasticCyan = plastic("plasticCyan", DAY.cyanAlb);
  m.plasticViolet = plastic("plasticViolet", DAY.violetAlb);
  m.plasticMint = plastic("plasticMint", DAY.mintAlb);
  m.rubber = bind(standard({ color: 0x1b1f36, roughness: 1, name: "rubber" }), rubber, .8);
  m.cardboard = bind(standard({ color: 0xe0b57a, roughness: 1, name: "cardboard" }), cardboard, .7);
  m.paper = bind(standard({ color: 0xfaf1dc, roughness: .92, name: "paper" }), cardboard, .25);

  // ---- Cloth (palette-aligned)
  const cloth = (name, color) => bind(standard({ color, roughness: 1, name }), fabric, .8);
  m.fabricGreen = cloth("fabricGreen", 0x2c9c82);
  m.fabricRed = cloth("fabricRed", 0xe14d42);
  m.fabricNavy = cloth("fabricNavy", 0x2d3a78);
  m.fabricGrey = cloth("fabricGrey", 0x9ea6bd);
  m.fabricCream = cloth("fabricCream", 0xf1e5c8);
  m.fabricBlack = cloth("fabricBlack", 0x1d2140);
  m.denim = cloth("denim", 0x4a68ad);

  // ---- Glass: faint sky tint, restrained reflection (a strong one milks the street view and the interior seen through it)
  m.glass = physical({ color: 0xe6f5ff, roughness: .03, metalness: 0, transmission: 0, transparent: true, opacity: .1, ior: 1.5, specularIntensity: .45, side: THREE.DoubleSide, depthWrite: false, name: "glass" });
  // Stylised diagonal sheen (the classic game-window glare): a wide soft band + a thin one, repeating every ~2.4 m along a world-space
  // diagonal, painted as a touch of opacity + white so it reads over the shop interior seen through the glass. Costs nothing.
  m.glass.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSheenW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSheenW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSheenW;")
      .replace("#include <opaque_fragment>", `
        {
          float sd = fract((vSheenW.x * .82 + vSheenW.y * .57) * .42);
          float wide = smoothstep(.085, .0, abs(sd - .32));
          float thin = smoothstep(.026, .0, abs(sd - .43));
          float sheen = wide * .8 + thin * .9;
          diffuseColor.a = min(1., diffuseColor.a + sheen * .17);
          outgoingLight = mix(outgoingLight, vec3(1.0, .97, .9) * 1.6, sheen * .5);
        }
        #include <opaque_fragment>`);
  };
  m.glass.customProgramCacheKey = () => "glassSheen";

  // ---- Vinyl: ink-black, tight specular, deep clearcoat (+ a very light iridescent sheen on capable tiers)
  m.vinyl = gloss({ color: 0x0b0d18, roughness: .3, metalness: .2, name: "vinyl" }, { clearcoat: 1, clearcoatRoughness: .06 });
  if (quality.id === "high" && m.vinyl.isMeshPhysicalMaterial) { m.vinyl.iridescence = .28; m.vinyl.iridescenceIOR = 1.4; m.vinyl.iridescenceThicknessRange = [180, 420]; }
  m.vinylLabelPaper = standard({ color: 0xf6ecd4, roughness: .8, name: "labelPaper" });

  // ---- Light fixtures and emissive things (HDR values on purpose: they feed the bloom)
  m.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .86, .62).multiplyScalar(4), toneMapped: true, name: "bulb" });
  m.tube = new THREE.MeshBasicMaterial({ color: new THREE.Color(.96, 1, .98).multiplyScalar(3.6), name: "tube" });
  m.screenGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(.24, 1, .66).multiplyScalar(1.3), name: "screenGreen" });
  m.ledRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .18, .12).multiplyScalar(3), name: "ledRed" });

  // ---- Skin / hair for the legacy stand-in characters (the baked characters bring their own materials)
  m.skin = standard({ color: 0xe0a58a, roughness: .7, name: "skin" });
  m.skinDark = standard({ color: 0x9a6246, roughness: .7, name: "skinDark" });
  m.skinLight = standard({ color: 0xedc2a6, roughness: .68, name: "skinLight" });
  m.hairWhite = standard({ color: 0xe6e3dc, roughness: .75, name: "hairWhite" });
  m.hairDark = standard({ color: 0x241d22, roughness: .6, name: "hairDark" });
  m.hairBrown = standard({ color: 0x5a3b26, roughness: .65, name: "hairBrown" });
  m.eyeWhite = standard({ color: 0xf6f3ee, roughness: .25, name: "eyeWhite" });
  m.eyeDark = standard({ color: 0x15100e, roughness: .2, name: "eyeDark" });
  m.glassesFrame = standard({ color: 0x14172c, roughness: .3, metalness: .3, name: "glassesFrame" });
  m.lens = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .04, transparent: true, opacity: .16, name: "lens" });

  // Glossy materials reflect the daylight stand-in environment a bit harder than matte ones (per-material intensity needs an explicit envMap).
  const envGloss = {
    glass: .4, vinyl: 1.5, steel: 1.2, brass: 1.2, blackMetal: .8, floor: 1.15, counterTop: 1.1, oak: 1, plasticBlack: .8, plasticBeige: 1.1,
    plasticCoral: 1.2, plasticSun: 1.2, plasticCyan: 1.2, plasticViolet: 1.2, plasticMint: 1.2,
    lacquerInk: .8, lacquerPaper: 1.1, lacquerCoral: 1.2, lacquerSun: 1.2, lacquerCyan: 1.2, lacquerViolet: 1.2, lacquerMint: 1.2, lens: 1.4
  };
  m.applyEnvironment = (texture) => {
    for (const [key, intensity] of Object.entries(envGloss)) {
      const material = m[key];
      if (!material) continue;
      material.envMap = texture; material.envMapIntensity = intensity; material.needsUpdate = true;
    }
  };

  m.dispose = () => {
    for (const set of [oak, pine, plaster, floor, tile, metal, cardboard, fabric, rubber, pavement]) {
      for (const t of Object.values(set)) t.dispose();
    }
    for (const value of Object.values(m)) if (value && value.dispose && value !== m.dispose) value.dispose();
  };
  return m;
}
