# Accessibility and performance

## 1. Accessibility

Implemented by design (UI files are `index.html`, `styles/app.css`, `src/ui/*`; items marked † depend on the final UI code and are listed in the README status block when verified):

| Topic | What exists |
| --- | --- |
| **2D alternative** | `src/ui/directory2d.js`: the full collection (6 categories, 10 projects, 8 applications, about, contact, CV) as normal HTML with filters. Offered from the intro, from the header, and automatically when WebGL fails or the context is lost. It is not a bare list: it keeps categories, sleeves and detail sheets. |
| **Keyboard** | `src/controls/look.js`: arrow keys look around, `+` / `-` zoom (ignored while typing in inputs and with Ctrl/Alt/Meta). Esc toggles the header on desktop†. Held record: flip / open / put back are real buttons in the record dock†. |
| **Reduced motion** | `prefers-reduced-motion` is read by `quality.js` and `world.js`: camera sway and exterior drift off, intro/outro and record flights shortened to ~0.35–0.6 s. CSS transitions† should honour it too. |
| **No forced sound** | Nothing plays before an explicit choice ("enter with / without sound"); the audio engine is silent until `start()`; SFX, ambience and music have separate switches; the music can be disabled completely (`music.disable()` destroys the player). |
| **Touch** | Drag, pinch, tap; gyro is opt-in with permission and a real-sensor check; the 3D can be left for the 2D version at any time. |
| **Controls always discoverable** | Recenter, language switch, "show interactive objects" (hints markers) and close/return controls live in the header/dock†; hints are off by default to preserve realism. |
| **Contrast / text** | In-scene text is generated at readable sizes (liner notes auto-fit between ~15–27 px in a 1024 px texture) and the full details are also provided as HTML panels†, which is where WCAG contrast applies. Provisional/unconfirmed information is labelled. |
| **Skip links / landmarks / alt** | †`index.html` provides a skip link to the 2D collection, landmarks, an accessible name on the canvas, and text alternatives for sleeves in the directory. |
| **Language** | `lang` attribute follows the selected language†; FR/EN complete (brief §14). |

Not done / not verified: screen-reader behaviour of the 3D scene itself (a canvas is opaque to assistive tech — the 2D collection is the accessible path); no automated axe/Lighthouse run exists; focus order of overlays was not audited with a screen reader.

## 2. Performance

### Tiers (`src/scene/quality.js`)

| | `high` | `medium` | `low` |
| --- | --- | --- | --- |
| Selected when | desktop (fine-pointer) where neither `hardwareConcurrency` ≤ 4 nor `deviceMemory` ≤ 4 GB is reported | desktop with ≤ 4 cores / ≤ 4 GB; coarse-pointer devices with ≥ 6 GB and ≥ 8 cores | other coarse-pointer / small-screen devices |
| Procedural texture size | 1024 | 1024 | 512 |
| Sleeve cover size | 1024 | 768 | 512 |
| Sun shadow map | 2048² | 1024² | 1024² |
| Pixel-ratio cap | 2 | 1.5 | 1.25 |
| MSAA (composer target) | 4× | off | off |
| GTAO ambient occlusion | yes | no | no |
| Bloom | yes | yes | no |
| Depth of field while holding a record | yes | no | no |
| Grade (vignette/grain/split-tone) | yes | yes | yes |
| Light shafts | yes | yes | yes |
| Dust motes | 420 | 220 | 90 |
| Track spots (+ shadow-casting spots) | 5 (1) | 4 (0) | 3 (0) |
| Anisotropy | 8 | 4 | 2 |

Override: `?quality=high|medium|low`. The adaptive governor (`world.js`) lowers pixel ratio, then steps the tier down when frame time stays above ~26 ms over two ~1.2 s samples (and never steps up). A step-down is stored in localStorage (`store.quality`), so a device that was once slow stays on the lower tier until that key is cleared.

Structural budget: static props merged per material, filler records instanced, shared atlases for decor/posters/stickers, lazy liner-note textures (generated on idle, per language), render loop paused when the tab is hidden, picking throttled to pointer movement / 8 Hz.

### Targets (goals, not results)

| Device class | Target |
| --- | --- |
| Recent desktop with a discrete or recent integrated GPU, `high` | 60 fps at 1080p |
| 2–3-year-old laptop, `medium` | ≥ 45 fps |
| Mid-range phone, `low` | ≥ 30 fps, first interactive frame < 8 s on 4G |
| Payload | `vendor/` ≈ 1.07 MB, fonts ≈ 0.26 MB, source ≈ 0.5 MB, **no image/model downloads** |

### Honest measurement status

- **Measured here:** only that the scene builds and renders without console errors in headless Chromium on a **software renderer (SwiftShader)**; first load took ≈ 7 s there (texture/artwork generation is CPU work, and software GL compiles shaders slowly) — not representative of GPUs. Draw-call/triangle counts come from `renderer.info` in the same environment.
- **Not measured:** frame rate or GPU memory on any real GPU, any phone, thermal behaviour, battery, load on slow networks, the effect of the governor in the field. **No fps claim is made anywhere in this repository.**

### Manual test protocol

1. Devices: a recent desktop (Chrome + Firefox + Safari), one older laptop with integrated graphics, one mid-range Android phone, one iPhone (iOS Safari: gyro permission and audio unlock).
2. For each: load the deployed URL cold (DevTools Network "Fast 3G" once, then normal), note time to the "open" button and to the first interactive frame.
3. Force each tier with `?quality=high`, `?quality=medium`, `?quality=low`; look around for 60 s, open and flip 3 records, open the shopkeeper chat. Record fps from DevTools Performance (or the browser's FPS meter) and watch for hitching when a record is opened (detail textures) and when the language is switched.
4. Read renderer statistics: the test harness `tests/visual/harness.html` exposes `window.__world`, so `__world.stats()` returns `{ calls, triangles, textures, geometries, ratio, tier }` (note `calls` counts the composer's passes in the last pass only; use the Spector.js extension for a full capture). The main application exposes the same object only if a debug flag was implemented in `src/app.js` — at the time of writing, check `grep -n debug src/app.js`; if absent, use the harness page for statistics.
5. Check the governor: throttle the CPU (DevTools 6× slowdown) and confirm the tier steps down and the visual remains acceptable.
6. Reduced motion: enable the OS setting and confirm no camera drift and short transitions.
7. Context loss: in Chrome run `__world._debug.renderer.getContext().getExtension('WEBGL_lose_context').loseContext()` in the harness and confirm the `context-lost` event (the app must show the 2D collection).
8. Console: no errors or unhandled rejections during all of the above.

### Capturing visual regressions

The harness plus Playwright (`require('playwright')`, Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`) was used to take screenshots (`http://localhost:8080/tests/visual/harness.html?quality=medium&capture=1`, then `window.__world.openStore({instant:true})` and `window.__world._debug.look.setPose(yaw, pitch, fov)`). This verifies composition and errors, not speed.
