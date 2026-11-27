# Characters

The shopkeeper ("le patron de la boutique") and the two customers are **real rigged 3D characters**, not primitives glued together.
They are sculpted and baked offline by a small, dependency-light pipeline in `scripts/characters/`, then loaded
at runtime from `assets/characters/`.

Art direction v2: the boss follows the owner's reference image (a clean, stylised "painted" 3D sculpt, see `docs/ART_DIRECTION.md` §6).
The shared pipeline now has a **v2 style kit** (below) so the customers can be made in the same sculpt language.

## Why this pipeline

* No external model licences: every vertex is generated from code (signed-distance-field sculpting), so the
  characters are fully original and can be re-tuned (age, face proportions, hair, clothes, colours) by editing numbers.
* No heavy runtime: the shipped files are small binaries (≈ 0.5-0.6 MB per character in the *lo* level of detail,
  ≈ 1.4-1.5 MB in *hi*), loaded with a 60-line parser — no GLTF loader needed.
* Real skeleton: 18 bones (hips → spine → chest → neck → head → jaw, shoulders/arms/hands, legs/feet) with skin weights
  baked from bone proximity, so the characters can be posed and animated in code.

## What is in a character

| Piece | How it is made |
| --- | --- |
| Head, neck, ears, nose, lips, mouth cavity, eye sockets | SDF sculpt. Realistic face: `head.js`. **v2 stylised face: `head-v2.js`** (`buildHeadV2`, pass it as `def.headBuilder`) |
| Eyes, eyelids (blink), cornea highlight, catch-light | built at runtime (`src/scene/character.js`): textured sclera/iris sphere (iris size, pupil ratio and colour come from `def.eyes`), glossy cornea shell, skin lids that rotate, a painted catch-light disc fixed to the head |
| Jaw (speech) | a `jaw` bone with weights baked on the lower face; the dark mouth cavity opens when the jaw rotates (`jawWeight()` reads `head.P.mouthY`) |
| Brows | separate parts (`browParts()` in `character-builder.js`): thin tube (older style) or **`slab: true`**, the v2 signature brow: a thick, dark, cleanly edged slab, thick at the inner end, angled, tapering outward |
| Hair (v2) | `hairShell()` (skull offset, thin at the hairline, extra thickness fields for pompadour/side volume) + layered **leaf-shaped clumps** `scalpLeaf()` and round tubes `scalpTube()` laid on the hair surface by (azimuth, elevation), the forehead curl with `clump()`, a golden streak as an overlay clump (`over: true`) — glossy and clean, no strand noise |
| Hair (older styles) | `scalpCap()` with noise curls/combing, corkscrew `tendril()`s, flat `clump()` ribbons for white hair/beards |
| Hoodie (v2) | `hoodieParts()` in `parts.js`: loose hoodie, thick sculpted hood collar (ring + nape pile + two rolled front edges), V opening, ribbed cuffs, big soft folds (`softFolds()`), white tee with a V neckline over a chest-skin patch, drawstrings with aglets. Returns the `hoodie`, `shirt`, `chest`, `cords` parts |
| Cardigan / leather bomber (`leatherJacketParts()`, shared by both customers until they are restyled) | SDF garments with folds, hollow cuffs/neck, baked ambient occlusion in vertex colours |
| Glasses, headphones | runtime accessories (`character-accessories.js`) — the boss wears none |
| Skin shading | `MeshPhysicalMaterial` + wrapped diffuse with a warm red-orange terminator (cheap subsurface scattering), faint sheen and a soft warm fresnel rim; almost no pore noise (painted look) |
| Hair shading | clean glossy clearcoat band, warm sheen, warm rim, no strand bump |
| Fabric shading | `cloth` / `knit` = triplanar weave bump (older characters); **`soft`** = large-scale soft shading + velvety sheen + cool rim (v2 hoodie, tee, cords) |

## Regenerating

```bash
npm install                                  # installs meshoptimizer (mesh simplification) for the bake script
npm run bake:characters                      # all characters, both levels of detail (~1 min)
node scripts/characters/bake.mjs shopkeeper  # one character, both LODs (~30 s)
node scripts/characters/bake.mjs shopkeeper --lod hi
# work in progress without touching the shipped files (written as assets/characters/<name>.<lod>.*; delete them afterwards):
OUT_ID=shopkeeper-wip PARTS=head,browL,browR,hair node scripts/characters/bake.mjs shopkeeper --lod lo
```

Outputs: `assets/characters/<id>.<lod>.json` (manifest: bones, parts, offsets) and `<id>.<lod>.bin` (quantised geometry,
colours, skin indices/weights). Commit them: the site is served as static files.

Look at the result with the harness `tests/visual/character.html`, e.g.
`http://localhost:8080/tests/visual/character.html?id=shopkeeper&lod=hi&cam=0.42,1.74,1.0&target=-0.01,1.67,0&fov=20&look=0.9,1.7,3`
(query: `id`, `lod`, `cam`, `target`, `fov`, `look`, `env`, `key`, `exp`, `pose=talk`, `parts=a,b`, `base=<path>` for other asset folders).

* `defs/shopkeeper.js` is the reference implementation of the v2 style; `defs/visitor-a.js` / `visitor-b.js` are the customers.
* `head.js` — the realistic parametric face. `head-v2.js` — the stylised face (see below).
* `parts.js` — hands, torso/sleeves, legs, shoes, hoodie, hair helpers, baked AO, weights.
* `character-builder.js` — LOD budgets (`LODS`, overridable per character with `def.lods`), brows and the assembly of a character from its definition.

## The v2 style kit (how the boss is built)

**Face (`head-v2.js`, `buildHeadV2`).** Proportions were *measured on the reference* in units of the eye gap: eye → base of nose 0.64,
nose → mouth 0.31, mouth → chin 0.52, i.e. a short lower face under a big cranium, a tapered V jaw (stacked cheek/jaw ellipsoids trimmed by soft
jaw planes), prominent smooth cheekbones, high straight nose with a soft tip, small closed mouth (thin upper lip, fuller lower lip, corners a
hair lower), big ears, slender neck with sterno-cleido ridges, almond eye sockets with outer corners lower. Parameters (all optional):
`faceW`, `lowerW`, `faceLen`, `jaw`, `chin`, `cheek`, `nose`, `noseLen`, `noseTip`, `noseBridge`, `lip`, `lipFull`, `mouthW`, `mouthDrop`, `ear`,
`earOut`, `neck`, `forehead`, `browRidge`, `eyeGap`, `eyeY`, `eyeTilt`, `eyeSock`, `scm`, `skin`, `lipColor`, `blush`. The colour map bakes a rosy
blush (cheeks, nose tip, ears), cooler jaw/neck, under-eye and lid-crease shadows into the vertex colours.

**Eyes.** `def.eyes = { iris: [r,g,b], size, lid, lowerLid, irisR, pupil, lidScale, catch }` — `irisR` = angular radius of the iris in degrees
(36 natural, 48-52 big stylised dark eyes), `pupil` = pupil/iris ratio, `lid` = how far the upper lid is raised (0.3-0.4 = heavy-lidded, 0.8 = wide
open), `lowerLid` = rest rotation of the lower lid (negative covers more), `lidScale` = lid shell radius / eyeball radius. `def.style.lidRim` is the lash-line colour.

**Hair.** Compose: `cap = hairShell(skull, hairLine(...), { thick, thin, extra: thicknessField, volume })`; lay clumps on `cap.solid` with
`scalpLeaf(surface, [[az, el], ...], width, thickness, colour, { lift, flick, over })` (az 0 = ahead, +90 = character's left, el 90 = crown); merge with
`lockSet(locks, baseColour, { k })` which also gives the colour lookup (`over: true` clumps are colour overlays, e.g. the golden streak). Clump
spacing and thickness decide how "clumpy" it reads; `flick` lifts the last part of a clump off the scalp.

**Clothes.** `hoodieParts(q, { color, width, cowl, skin, vTop, vBottom, ... })`. `cowl` scales the hood collar, `skin` adds the chest patch seen
through the tee's V neckline. Keep colours *desaturated*; the shop's coloured light adds saturation.

**Per-character LOD overrides.** `def.lods = { hi: { head: { h, tris } }, lo: { ... } }` — the boss has a finer head and brows than the shared budgets.

### Making another character in this style (customers)

1. Copy `defs/shopkeeper.js`. Keep `headBuilder: buildHeadV2`, `brows.slab`, `eyes`, `style.lidRim`.
2. Change the face parameters (`def.head`), skin and blush; keep the heavy dark brows, dark heavy-lidded eyes, rosy blush, big ears (same face language).
3. Rebuild `hair()`: new hairline, thickness fields and clump list (angles); one coloured overlay clump for a streak (customer B: coloured streak).
4. Replace `garments()`: another `hoodieParts(...)` colour/width, or a new garment built from `torsoMass`/`sleeve`/`softFolds` (jacket, bomber, oversized coat);
   add runtime accessories in `people.js` (`addHeadphones`, ...). Use `material: "soft"` for cloth, `"leather"` for glossy jackets, `"hair"`, `"skin"`.
5. Bake with `OUT_ID=<id>-wip`, compare with `docs/ART_DIRECTION.md` §6 using the harness (front, 3/4, side, top), then bake for real (`node scripts/characters/bake.mjs <id>`).
6. Check hero view in the shop (pose `-19.8:-1.2:20`) in daylight at medium and high tiers.

## Level of detail

`src/scene/people.js` loads `hi` on the *high* quality tier and `lo` otherwise (the boss: ≈ 96 k vs ≈ 37 k triangles; the head alone is ≈ 26 k / 11 k).
If character files cannot be loaded, `people-legacy.js` (procedural stand-ins) is used so the shop is never empty.

## Shopkeeper behaviour (`people.js`)

Counter pose (right forearm near the register, left forearm on the counter), breathing, **greeting wave** (`world.greetShopkeeper()`), head and eye
tracking of the camera, **jaw while talking** (`world.setShopkeeper({ talking: true })`), random blinking, nodding to the music, invisible **pick proxies**
(head sphere, torso capsule, arms) for hover/click. The character hangs from an invisible `shopkeeper-anchor` group lifted by 0.17 m:
`world.focus('shopkeeper')` aims at `pickRoot + (0, 1.42, 0)`, so the chat zoom frames the **face**. The anchor also carries `userData.focusFov = 15` and
`userData.focusY` as hints for the framing code (the chat zoom currently uses fov 27, too wide for the face to read; 14-16 works).

## Art direction

The boss matches the owner's reference (stylised, smooth, slightly exaggerated, painted-looking): long narrow face with a defined jaw, heavy straight dark
brows, small dark heavy-lidded eyes, rosy cheeks, big ears, near-black swept hair with a curl on the forehead and a golden streak, desaturated-blue hoodie with a
thick hood collar, white tee, slender neck. The characters are **original**: no real person is depicted or recognisable.

## Limits (honest)

* It is procedural, browser-rendered geometry (SDF sculpt, 37-96 k triangles, one vertex-colour map, no hand-authored UV textures, no baked GI). It reads as the
  reference's *style* at shop and hero distance; side by side with the 3D-artist sculpt of the reference it is clearly simpler: the face is less refined (mouth,
  eye lids, nose-wing and nostril detail), the hood has no interior folds, hair clumps are layered leaves rather than hand-sculpted locks. "Console-grade" is the
  ambition, not the claim.
* Cloth is skinned, not simulated; hair does not move.
* Facial animation is: blink, eye/head tracking, jaw open/close while talking. No visemes or emotional blend shapes.
* Weights come from bone proximity (no manual painting): extreme poses (arms raised above the head) show some shoulder stretching.
* The customers were built in the older realistic language and are being restyled with the kit above; until then they differ in style from the boss.
