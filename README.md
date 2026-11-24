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
- Detailed streamed fluorescent fittings with shared housings, diffusers and subtle ceiling spill.
- Tapes slide out of the shelf when targeted, then open an inspection panel with a reversible front/back sleeve, synopsis, year, director, cast and catalogue information.
- Searchable, filterable, sortable and paginated film index.
- Letterboxd CSV import, duplicate removal, browser-side archive persistence, progressive TMDB artwork lookup for face-out tapes on nearby shelves, and on-demand full metadata when a tape is inspected.
- Proximity-based interaction raycasting: only nearby shelf sections and fixed endcap targets are tested, instead of every cassette in the streamed store.
- Survival Mode with 38 varied anomalies placed in the aisles.
- First-person movement, jump, run, crouch, flashlight/battery, store ambience, CRT grain/scanlines/chromatic fringe/barrel distortion, bloom, depth of field, fog and WebXR controller support.
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
