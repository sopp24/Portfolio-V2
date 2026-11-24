# Midnight Video — Portfolio V2

A clean-room, browser-based recreation of the Midnight Video experience using Three.js, WebGL2, GLSL post-processing and WebXR. The geometry, generated covers and interface code in this repository are original; the site owner's private Letterboxd archive, API credentials, and original proprietary artwork are not included.

## Run and publish

Serve `index.html` from a static web host. GitHub Pages works with the repository root. Three.js and post-processing modules are loaded from jsDelivr.

## Controls

| Input | Action |
|---|---|
| ZQSD / WASD / arrows | Walk |
| Mouse drag | Look / aim |
| Mouse wheel | Walk forward / backward |
| Shift | Run |
| Space | Jump |
| C | Crouch |
| F | Flashlight |
| E / click | Take or inspect a tape |
| M | Movie index |
| R | Survival Mode |
| V | WebXR VR session |
| H / ? | Help |
| Esc | Pause / close panel |

Touch devices have a movement pad, run, jump, crouch, flashlight and examine controls. WebXR requires a compatible headset, browser and secure HTTPS origin.

## Recreated systems

- Endless aisle streaming: shelves, aisle categories, ceiling fluorescents, floor and side walls are recycled as the player walks in either direction.
- Mixed face-out movie covers and readable VHS spines, with softly rounded reusable cassette moulds and individual reusable GPU textures to limit memory growth as the catalogue streams.
- Detailed streamed fluorescent fittings with shared housings, diffusers and subtle ceiling spill; each tube now has a slightly independent output drift and an extremely restrained warm/cool colour shift to keep the aisle lighting from feeling perfectly uniform.
- Reusable rental ticket strips along the shelf edges, small shared metallic fasteners at the rail ends, and subtle hovering/rotation motion for the hidden anomalies in Survival Mode.
- Tapes slide out of the shelf when targeted, then open an inspection panel with a reversible front/back sleeve, synopsis, year, director, cast and catalogue information.
- Searchable, filterable, sortable and paginated film index.
- Letterboxd CSV import, duplicate removal, browser-side archive persistence, progressive TMDB artwork lookup for face-out tapes on nearby shelves, and on-demand full metadata when a tape is inspected. Loaded poster art receives a restrained cinematic gradient, MIDNIGHT VIDEO title treatment and readable year/genre footer so covers remain legible at shelf distance.
- Proximity-based interaction raycasting: only nearby shelf sections and fixed endcap targets are tested, instead of every cassette in the streamed store. Target selection includes a small distance hysteresis so neighbouring cassette meshes do not rapidly steal focus, keeping the highlight, prompt and extraction animation stable.
- Full pause behaviour for the film/library panels, including frozen movement, look interaction, in-game clock and flashlight battery; movement keys and touch controls are cleared on focus loss or when the interface closes.
- Recycled shelf sections reset any extracted cassette to its correct seated position and clear stale selection state before receiving the next catalogue segment.
- Collision-aware first-person movement with a circular player footprint, corridor edge clearance, a solid counter obstacle, swept sub-steps to prevent tunnelling, and axis-separated sliding when brushing against objects. Keyboard, touch, XR and mouse-wheel movement share the same collision resolver.
- Subtle speed-sensitive first-person head bob and lateral camera lean, smoothly blended with acceleration, reduced for crouching and reduced-motion preferences, and disabled in XR to avoid unnecessary headset motion.
- Survival Mode with 38 varied anomalies placed in the aisles.
- Dynamic desktop depth of field that follows the cassette under inspection, eased VHS extraction with a small forward slide, a slight lift and restrained multi-axis tilt/roll for a more tactile feel, plus a short inspection-panel entrance transition; depth of field is skipped on touch devices for smoother rendering.
- First-person movement, jump, run, crouch and flashlight/battery; opt-in layered store ambience with a spatial TV hum, speed-sensitive footsteps, a quiet high-pitched mechanical cue when a VHS becomes the active target, and distinct tape/anomaly interaction sounds. VHS spines carry a small MIDNIGHT VIDEO header and individually seeded rental barcodes to give the shelves more believable physical detail without adding scene meshes.
- Animated CRT static on the in-world television, with a restrained green phosphor point-light that gently brightens as the player approaches and flickers in sync with the static; plus CRT grain/scanlines/chromatic fringe/barrel distortion, bloom, depth of field, fog and WebXR controller support.
- Responsive desktop and touch layouts.

## Load the original-sized personal archive

The reference is publicly described as using roughly 10,000 films from the creator's personal Letterboxd history and watchlist, with film metadata and artwork supplied through TMDB. That private source export and its API credentials are not publicly distributed.

To populate this repository with your own full collection:

1. Export your Letterboxd data and open the Movie Index in the experience with `M`.
2. Choose **IMPORT CSV** and select your Letterboxd `watched.csv`, `watchlist.csv`, or other export files. The importer deduplicates by title and release year.
3. To load original movie artwork and metadata, provide your own TMDB API Read Access Token in the index panel. Once you enter the store, face-out tapes on nearby shelves are enriched progressively with real TMDB posters (two lookups at a time); full film details are fetched when you inspect a tape. Poster URLs are cached in the browser so they do not need to be looked up again after a reload.
4. The Movie Index contains a TMDB Credits section with the approved logo and required attribution notice. TMDB's developer API is free for non-commercial use with attribution; commercial use requires a separate license.

The default built-in sample catalogue is a small demo, not the creator's 10,000-film dataset. A personal CSV is required to reproduce that data layer faithfully.

## Project files

- `index.html` — full-screen experience and overlay panels
- `styles.css` — interface, responsive behaviour and VHS sleeve styling
- `main.js` — Three.js scene, controls, tape catalogue, imports and interactions
- `Dirtyline 36daysoftype 2022.*` — original repository font assets retained
