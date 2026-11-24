# Midnight Video — Portfolio V2

A browser-based, procedural reconstruction of the Midnight Video VHS store, built as a full-screen Three.js / WebGL2 experience.

## Run

Open `index.html` from a static web server, or publish the repository with GitHub Pages. Three.js and its post-processing modules are loaded from jsDelivr.

## Desktop controls

- WASD — walk
- Mouse — look around
- Shift — run
- Space — jump
- C — crouch
- F — flashlight
- E — inspect a VHS / investigate an anomaly
- M — movie index
- R — Survival Mode
- Escape — pause / close a panel

## Included

- Procedurally built video-store environment with long VHS shelving, fluorescent lighting, signage, a CRT screen, fog, bloom, grain, scanlines and subtle lens distortion.
- First-person movement, mouse look, pointer lock, keyboard and touch controls.
- Interactive VHS cases with generated cover art and film details.
- Searchable movie index.
- Optional Survival Mode with 38 hidden anomalies.
- Flashlight with battery management, sound ambience toggle and WebXR entry attempt.

All 3D geometry and cover artwork in this reconstruction are generated at runtime. The film catalogue is a curated sample used to populate the procedural store; it is not the original Letterboxd / TMDB archive.


## Letterboxd archive and TMDB

The reference experience is publicly described as a streamed Three.js / WebGL2 VHS store using a private Letterboxd archive and TMDB artwork/metadata. The creator's personal export and proprietary original assets are not public, so they are not bundled here.

Open the Movie Index with `M`, select **IMPORT CSV**, and import your own Letterboxd export files (for example `watched.csv` and `watchlist.csv`). Titles are deduplicated by name and year and stored locally. Add a TMDB API Read Access Token to load posters, genres, runtime, director, cast and synopsis as individual tapes are inspected. Metadata is fetched on demand to avoid thousands of requests at startup.
