# Characters

The shopkeeper and the two customers are **real rigged 3D characters**, not primitives glued together.
They are sculpted and baked offline by a small, dependency-light pipeline in `scripts/characters/`, then loaded
at runtime from `assets/characters/`.

## Why this pipeline

* No external model licences: every vertex is generated from code (signed-distance-field sculpting), so the
  characters are fully original and can be re-tuned (age, face proportions, hair, clothes, colours) by editing numbers.
* No heavy runtime: the shipped files are small binaries (≈ 0.5 MB per character in the *lo* level of detail,
  ≈ 1.3 MB in *hi*), loaded with a 60-line parser — no GLTF loader needed.
* Real skeleton: 18 bones (hips → spine → chest → neck → head → jaw, shoulders/arms/hands, legs/feet) with skin weights
  baked from bone proximity, so the characters can be posed and animated in code.

## What is in a character

| Piece | How it is made |
| --- | --- |
| Head, neck, ears, nose, lips, mouth cavity, eye sockets | SDF sculpt (`head.js`), smooth-unioned primitives + carved details |
| Eyes, eyelids (blink), cornea highlight | built at runtime (`src/scene/character.js`): textured sclera/iris sphere, glossy cornea shell, skin lids that rotate |
| Jaw (speech) | a `jaw` bone with weights baked on the lower face; the dark mouth cavity opens when the jaw rotates |
| Brows, hair, beard, flat cap | separate parts. Curly hair = a thick scalp mass displaced by two octaves of noise (rounded curls) plus corkscrew *tendrils* (`tendril()` in `parts.js`); the white hair/beard use flattened "ribbon" strands |
| Cardigan / leather bomber (`leatherJacketParts()`, shared by both customers: ribbed hem/cuffs/collar, zip groove, creases), shirts, trousers, shoes, hands | SDF garments with folds, hollow cuffs/neck, baked ambient occlusion in vertex colours |
| Glasses, headphones | runtime accessories (`character-accessories.js`) |
| Skin shading | `MeshPhysicalMaterial` + wrapped diffuse with a red-tinted terminator (cheap subsurface scattering), sheen, triplanar pore bump |
| Fabric shading | triplanar weave bump + baked AO; no UV unwrap needed |

## Regenerating

```bash
npm install            # installs meshoptimizer (mesh simplification) for the bake script
npm run bake:characters           # all characters, both levels of detail (~40 s)
node scripts/characters/bake.mjs shopkeeper --lod hi   # one character / one LOD
```

Outputs: `assets/characters/<id>.<lod>.json` (manifest: bones, parts, offsets) and `<id>.<lod>.bin` (quantised geometry,
colours, skin indices/weights). Commit them: the site is served as static files.

* `defs/shopkeeper.js`, `defs/visitor-a.js`, `defs/visitor-b.js` — the three characters (head parameters, hair, garments, colours). To make another character, copy `visitor-a.js`, change the head parameters, skin, hair parameters (`curl`, tendrils) and `leatherJacketParts` colours, then bake it.
* `head.js` — the parametric face (`skull`, `jaw`, `nose`, `lip`, `brow`, `age`, …).
* `parts.js` — hands, torso/sleeves, legs, shoes, hair helpers, baked AO.
* `character-builder.js` — LOD budgets (`LODS`) and the assembly of a character from its definition.

## Level of detail

`src/scene/people.js` loads `hi` on the *high* quality tier and `lo` otherwise (≈ 87–97 k vs ≈ 34 k triangles per character).
If character files cannot be loaded, `people-legacy.js` (procedural stand-ins) is used so the shop is never empty.

## Art direction

The style follows a realism reference supplied by the site owner (natural proportions, curly voluminous hair, glossy leather, large dark glossy eyes). The characters are **original**: no real person is depicted or recognisable, and the reference's costume is not reproduced.

## Limits (honest)

* Faces are stylised, not photoreal; the hero view is the shopkeeper at the chat zoom.
* Cloth is skinned, not simulated; hair does not move.
* Facial animation is: blink, eye/head tracking, jaw open/close while talking. No visemes or emotional blend shapes.
* Weights come from bone proximity (no manual painting): extreme poses (arms raised above the head) show some shoulder stretching.
