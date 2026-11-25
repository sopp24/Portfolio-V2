# Architecture

Adam Soppelsa — Projects Store is a static site: HTML + ES modules + one canvas. There is no bundler in the runtime path. GitHub Pages serves the repository files as they are; an optional Cloudflare Worker (`worker/`) is the only server-side piece.

## 1. Technology decisions

| Decision | Why | Trade-off |
| --- | --- | --- |
| **No-build static ES modules** (`index.html` + import map → `src/main.js`) | Works on GitHub Pages from a sub-path with no toolchain; every file stays readable; a failed deploy cannot be caused by a bundler. | No tree-shaking of our own code (≈ 0.5 MB of source, served uncompressed-friendly text), no TypeScript. |
| **Three.js r187, vendored** in `vendor/three.module.min.js` + `vendor/three-addons.min.js`, produced by `npm run vendor` (`scripts/vendor.mjs`, esbuild) | No CDN dependency at runtime, exact version pinned, add-ons limited to the list exported by `scripts/addons-entry.js` (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, GTAOPass, OutputPass, SMAAPass, BokehPass, mergeGeometries, RectAreaLightUniformsLib, RoundedBoxGeometry; RectAreaLightUniformsLib and SMAAPass are exported but not currently used). The import map maps `three` and `three-addons`. | Upgrading three means re-running `npm run vendor` and re-testing. |
| **Plain Three.js, not React / react-three-fiber** | Smaller payload and faster start (no React runtime, no reconciler); we own the render loop, which matters for the adaptive quality governor, post-processing order and the "frozen camera position" rule; the UI is ordinary DOM. | More imperative code than R3F. |
| **Procedural assets, not GLB files** | Zero download weight for the room geometry/textures, total art-direction control from code, everything bilingual-aware (signs are canvas textures redrawn on language change), no licensing questions. The only binary assets are the fonts (≈ 260 KB) and the three **baked characters** (`assets/characters/`, sculpted by code in `scripts/characters/`, ≈ 0.5 MB each in the lo LOD, ≈ 1.3 MB in hi; see `docs/CHARACTERS.md`). | Procedural people and furniture are stylised, not photo-real; the look is bounded by what code can generate. |
| **Web Audio synthesis** for SFX/ambience (`src/audio/`) | No audio files to license or download. | Sounds are synthetic; a listening pass by a human is still needed. |
| **YouTube IFrame API** for the music | Official, no re-hosting. | Needs a visible 200×200 player; random start is best-effort (see `src/audio/README.md`). |
| **Cloudflare Worker proxy** for the AI | The provider key can never be in a public static site. | An external account and a key are required for a real AI (see `docs/BACKEND.md`). |

### Replacing the procedural shell with a baked GLB (future path)

The data/UI/interaction layers do not care how the room is made. A designer can replace the shell without touching them:

1. Keep `src/scene/layout.js` coordinates (camera at `CAMERA.position`, room bounds, gondola, counter) as the contract, or update that file.
2. Export the static shop (walls, floor, ceiling, furniture, decor) as a Draco/Meshopt-compressed `.glb` with baked lighting (lightmaps) and KTX2 textures; load it in `world.js` in place of the `buildRoom` / `buildGondola` bins' furniture / `buildCounter` / `buildShelving` / static-batch calls.
3. Keep the **pick roots**: the records (`createRecord`), app cases, shopkeeper, CV folder, contact cards, lucky cat, turntable, posters and about plaque are separate objects registered in `ctx.pickRoots` with `userData.pick = { kind, id }`. Place them at the same coordinates (or expose empties named after the ids in the GLB and read their transforms).
4. Add `GLTFLoader`/`DRACOLoader` to `scripts/addons-entry.js`, re-run `npm run vendor`, and report loading progress through `onProgress` in `createWorld`.

None of this is done: the shipped shell is 100 % procedural.

## 2. Module map

| Path | Responsibility |
| --- | --- |
| `index.html`, `styles/app.css` | Document shell, import map, meta (description, OG, `assistant-endpoint`, `youtube-video-id`), accessible 2D fallback markup, all overlay UI styling. |
| `src/main.js` | Entry. Imports `src/app.js`. |
| `src/app.js` | Orchestrator: boots the world, wires UI ↔ world ↔ audio ↔ AI, intro/loading states, first-visit memory, language, mode switching (3D / 2D). |
| `src/core/i18n.js`, `src/core/storage.js` | UI strings (FR/EN) and language helper; safe `localStorage` wrapper (private-mode safe). |
| `src/ui/*` | DOM only: `intro` (closed/open screen, entry with/without sound, returning-visitor shortcut), `header` (Esc / mobile menu), `hud` (hover label, hints), `record-dock` (flip / open / details / put back), `panels` (project liner notes, about, contact, CV, app panel), `assistant` (chat), `directory2d` (accessible 2D collection), `radio` (the visible YouTube player card), `toast`. |
| `src/scene/world.js` | `createWorld()`: renderer, assembly, intro/outro camera choreography, render loop, quality governor, event emitter, public API. |
| `src/scene/layout.js` | Single source of truth for geometry (room, camera, gondola, counter, sun direction, footprints). |
| `src/scene/quality.js` | Tier table (`high`/`medium`/`low`), device detection, `?quality=` override, step-down. |
| `src/scene/room.js` | Floor (baked AO), walls, wainscot, ceiling, storefront, animated doors, open/closed card, exterior facade/street/sky. |
| `src/scene/furniture.js` | Central two-tier gondola (6 category bins, project records, hanging aisle signs), floor dig bins, wall-hung sleeves, poster collages, counter, shelving, window display. |
| `src/scene/props.js` | Turntable, counter clutter, speakers, lucky cat, CV folder + business cards, SOPP Agents rack, about corner (corkboard, guitar, keyboard, own records), listening corner, plants. |
| `src/scene/people.js` | Places the shopkeeper (head/eyes track the camera, breathing, blinking, jaw while talking, wave/gestures) and two customers; falls back to `people-legacy.js` (old procedural stand-ins) if the baked files cannot load. |
| `src/scene/character.js`, `character-core.js`, `character-accessories.js` | Loader for the baked characters (quantised binary + JSON manifest), skinned meshes + 18-bone skeleton, skin/cloth/hair materials (wrapped-diffuse SSS, triplanar detail), procedural eyes with lids, face animation, glasses and headphones. |
| `src/scene/records.js` | The physical record (hinged sleeve + disc with groove normal map), lazy liner-note/inner-spread textures, instanced filler sleeves. |
| `src/scene/artwork.js`, `assets.js` | Canvas artwork: one composition per project sleeve, liner notes, decorative covers/posters/stickers atlases (fictional bands), app cases, sign boards. |
| `src/scene/textures.js`, `materials.js`, `environment.js`, `util.js`, `kit.js` | Procedural PBR texture sets, material library, PMREM environment, noise/canvas/batching helpers, sign/bin/contact-shadow helpers. |
| `src/scene/lighting.js` | Sun (shadow-casting), track spots, practical lamps, neon, light shafts, dust motes; lights-on/neon-on ramps. |
| `src/scene/postfx.js` | Composer chain (GTAO → bloom → DOF → output → grade). |
| `src/scene/interaction.js` | Picking, hover reaction, present / flip / open / return, hints markers, recommendation pulses. |
| `src/controls/look.js` | Fixed-position look controls (mouse, touch, pinch, gyro, keyboard, programmatic look-at). |
| `src/audio/*` | `createAudioEngine()`; see `src/audio/README.md`. |
| `src/ai/*` | `createShopkeeperClient()` (Worker call with fallback) and `local-faq.js` (deterministic catalogue mode). |
| `src/data/*` | `projects.js`, `applications.js`, `profile.js` (validated content), `knowledge.js` (derives the shopkeeper knowledge base from them). Pure modules: no DOM, importable by the Worker. |
| `worker/*` | Cloudflare Worker proxy (`index.js`, `prompt.js`, `providers.js`); see `docs/BACKEND.md`. |
| `scripts/*` | `serve.mjs` (dev server), `vendor.mjs` + `addons-entry.js` (vendor build), `check.mjs` (checks). |
| `tests/*` | `ai.test.mjs` (node:test) and `visual/harness.html` (loads the world for headless screenshots). |

## 3. Data flow

```
src/data/{projects,applications,profile}.js ──► src/data/knowledge.js ──► worker (prompt) + src/ai/local-faq.js
          │
          ▼
  createWorld({ projects, categories, applications, profile, language })
          │  builds records / app cases / props from data (no hard-coded counts)
          ▼
  world.on("hover" | "select" | "held" | "cue" | "arrived" | "closed" | "sound" | "quality" | "context-lost")
          │
          ▼
  src/app.js ──► src/ui/* (labels, dock, panels, chat) and src/audio (sound cues)
```

The world never touches UI panels; the UI never touches meshes. The UI calls the world API (`openStore`, `closeStore`, `recenter`, `flipRecord`, `toggleSleeve`, `releaseHeld`, `presentProject`, `focus(kind,id)`, `lookAtRegion`, `setLanguage`, `setHints`, `enableGyro`, `setShopkeeper`, `setMusicPlaying`, `setQuality`, `dispose`). The shopkeeper's recommendation actions (`project`, `app`, `cv`, `contact`, `about`) map onto `focus` / panels.

## 4. Render pipeline

- **Renderer**: WebGL2, ACES tone mapping (exposure 0.92), PCF shadows, adaptive pixel ratio. Output goes through an `EffectComposer` with a half-float target (MSAA on the high tier).
- **Image-based light**: `environment.js` renders a stand-in model of the shop (bright street windows, warm lamps, dark floor) into a PMREM cube once; vinyl, glass, varnish and metal reflect it.
- **Direct light**: one shadow-casting directional "sun" aimed through the storefront (window mullions cast real shadows), 2–5 warm track spot lights (+ a cool one on the rack), a few practical point lights (counter, lamp, neon). Neon and shop lights ramp on during the opening sequence.
- **Volumetric look**: additive light-shaft ribbons (custom shader with a camera-distance fade) and GPU-animated dust motes; no ray-marching.
- **Baked ambient occlusion**: furniture footprints and wall edges are baked into the floor's `aoMap`; soft contact-shadow decals elsewhere.
- **Draw-call budget**: `StaticBatcher` merges every static prop per material; filler record sleeves are one `InstancedMesh` with a per-instance atlas cell (patched shader); plants are instanced leaf cards; poster / decor / sticker quads share atlas materials.
- **Post chain**: `RenderPass` → `GTAOPass` (high only) → `UnrealBloomPass` → `BokehPass` (only while a record is held, high only) → `OutputPass` → final grade shader (split-tone, filmic curve, vignette, grain, faint chromatic aberration, fade).
- **Tiers** (`quality.js`): see `docs/ACCESSIBILITY_PERFORMANCE.md`. A governor in `world.js` samples frame time every ~1.2 s; two consecutive slow samples lower the pixel ratio first, then step the tier down (`high → medium → low`) and rebuild the composer. It never steps up automatically.

## 5. Camera rules (`src/controls/look.js`, `layout.js`)

- Position is fixed at `CAMERA.position = (0, 1.64, 3.0)` (±4 mm breathing sway, disabled with reduced motion). Only yaw, pitch and FOV change; there is no movement code.
- Yaw ±118°, pitch +34° up / −40° down, FOV 30–62° (home 55°). Inertia via exponential smoothing; a shaped response keeps the centre of the screen calm.
- Desktop: the pointer steers the view; wheel zooms; arrow keys look, `+`/`-` zoom. Touch: drag to look, pinch to zoom, tap to pick. Gyro: opt-in, permission-aware (iOS), verified by waiting for real sensor data; relative to the pose when enabled. `recenter()` eases back to the home pose and zoom.
- While a record is held, pointer steering is frozen (`setPointerLock`) and the FOV is reset so the presentation distance is consistent.

## 6. Interaction model (`interaction.js`)

- Interactive objects are registered as **pick roots** (`ctx.pickRoots`), each with `userData.pick = { kind, id }`: `project`, `music`, `app`, `shopkeeper`, `poster`, `cv`, `contact`, `about`, `secret` (cat), `turntable`.
- Hover = pointer ray (mouse) or tap ray (touch). Reaction is physical only: records lift 3 cm, app cases slide out, small props scale slightly. No outlines or icons; the optional "hints" mode shows soft markers and is off by default.
- Records and app cases are **presented**: lifted out of the bin along an arc, flown to the camera at a distance computed from FOV/aspect so the sleeve fills ~56 % of the screen height (width-limited on portrait), then handled: drag to spin (snaps to front/back), flip to Side B (liner notes), open (hinged cover swings, disc slides out, inner spread = tracklist/credits), return (reverse arc into the exact slot). Detail textures are generated lazily/idle, per language.

## 7. Localisation

Two mechanisms: DOM strings come from `src/core/i18n.js`; everything *painted inside the 3D scene* (hanging aisle signs, bin plates, about plaque, CV folder, contact card, rack header, app cases, liner notes) is a **localized canvas texture** registered in `ctx.localized` with a `draw(lang)` function; `world.setLanguage(lang)` redraws them all and invalidates the record detail cache. Content strings live in the data files as `{ fr, en }` pairs and are validated by `scripts/check.mjs`.

## 8. Security model

No key, token or secret exists in the browser or the repository (`scripts/check.mjs` scans for common patterns). The AI call is `browser → Worker → provider`; the Worker holds `AI_API_KEY` as a Cloudflare secret, enforces an origin allow-list, request limits, rate/budget limits, and keeps instructions separate from knowledge. Origin checks are not authentication: see the threat model in `docs/BACKEND.md`. Nothing is persisted server-side. Local storage holds only preferences (language, sound choice, first-visit flag, quality).

## 9. Failure paths

- **No WebGL2 / shader or context failure** → the 2D directory (`directory2d`) is shown with the same categories, records and applications; a status line explains why.
- **Context lost** → `world` emits `context-lost`; the app switches to the 2D directory.
- **Reduced motion** (`prefers-reduced-motion`) → no sway, short transitions, no camera drift.
- **Slow device** → pixel ratio then tier step-down (see §4).
- **Audio / YouTube / AI unavailable** → each reports its state; the visitor sees the status, nothing blocks browsing. AI unreachable → catalogue mode, labelled as such.

## 10. Known limitations

- Performance has been measured only in headless Chromium on a software renderer (SwiftShader): no frame-rate claim exists for real hardware. See `docs/ACCESSIBILITY_PERFORMANCE.md` for the protocol.
- All sleeves are **provisional generated artwork**; `visualStatus: "provisional"` marks them. The data model has no consumed `cover.front/back` field yet (see `docs/CONTENT.md`).
- Project data has no `images`/`videos`/`documents`/`externalUrl` fields yet, although the brief lists them.
- People and furniture are stylised procedural models, not GTA-class photoreal assets (the characters are sculpted and rigged, with eyes, blink, jaw and head tracking, but hair/cloth do not simulate and faces are simpler than a hand-made game hero); there is no screen-space reflection and no baked global illumination.
- The YouTube random start depends on the stream exposing a DVR window; unverified from the build sandbox.
- The AI is real only after the Worker is deployed with a key; the answer quality was not tested against a live model.
- Sound effects are synthesized and were only checked for levels/clipping, not by ear.
- iOS Safari gyroscope/audio and low-end Android were not tested.
