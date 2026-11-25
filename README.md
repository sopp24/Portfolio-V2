# Adam Soppelsa — Projects Store

A 3D portfolio designed as a compact independent record store from the 1990s. The visitor stays in one fixed position and looks around the shop; projects are represented as vinyl records and web applications have their own rack.

## Current direction

- Portfolio identity: **Adam Soppelsa — Projects Store**
- Store identity: **SIDE A / RECORDS**
- Art direction: daylight, warm wood, plaster, metal, paper sleeves, gig posters and a collected independent-record-shop atmosphere.
- Interaction principle: the store is the navigation. The visitor does not walk through the room.
- Reference balance: record handling and object-based presentation informed by A24 — Ravi Klaassens; environmental immersion informed by Midnight Video — Cuchillo. The references guide usability, not copied artwork.

## Run locally

This is a static ES-module project. No bundler is required.

    python3 -m http.server 8080

Open http://localhost:8080/.

Three.js is loaded from the jsDelivr ESM import map in index.html. Project data and scene modules use relative paths so the site can run from a GitHub Pages repository subpath.

## Architecture

- index.html — accessible entry point, intro, menu, 2D directory and project dialog.
- styles.css — responsive visual system.
- main.js — lightweight module entry.
- src/app.js — experience lifecycle, intro states, language, 2D directory and UI.
- src/scene/store.js — procedural record-store environment and shared materials.
- src/controls/camera.js — fixed-position mouse, touch, pinch-zoom and gyroscope controls.
- src/data/projects.js — structured bilingual project catalogue and editable profile placeholders.
- src/data/applications.js — verified SOPP Agents application links.

## Content integrity

The ten project entries are structured independently from their 3D representation. Years that were not supplied remain null; roles that are not confirmed are described as such; historical profile information is marked for validation. The generated sleeve artwork is provisional and is not presented as original project deliverables.

The applications rack contains the eight applications listed in the SOPP Agents repository. Each destination points to the corresponding live app and repository.

## Controls currently implemented

- Desktop mouse position: look around.
- Mouse wheel: zoom without moving the camera.
- Smartphone: one-finger drag to look around, pinch to zoom.
- Gyroscope: permission-based activation from the settings header.
- Escape: show / hide the compact header on desktop.
- Recenter: restore the default camera orientation and zoom.
- 2D collection: accessible project and application index, including when WebGL is unavailable.

The visitor's camera position never changes.

## Development roadmap

1. Complete the physical vinyl model: sleeve, disc, label, thickness, front/back and opening.
2. Add raycast selection, hover response, tactile extraction and return-to-crate animations.
3. Build category bins and the dedicated applications rack as navigable objects.
4. Add the About corner, validated CV/contact links and the interactive shopkeeper.
5. Connect the shopkeeper to a secure serverless AI backend. No API secret is allowed in the frontend.
6. Add the official YouTube player, opt-in audio, effects, bilingual refinements and Easter eggs.
7. Test desktop, tablet, phone, reduced-motion and WebGL fallback paths.

## External services and pending information

- YouTube live audio is not connected in this first build.
- The AI shopkeeper is not connected to an AI provider yet.
- The CV, current Master 2 title/institution, availability date, email and social links remain unconfigured until confirmed.
- The current project artwork is procedural placeholder artwork and should be replaced by approved project visuals.
- Historical music statistics and previous internships are retained as editable reference data, not shown as current verified claims.

## Publish

The project is compatible with GitHub Pages at the repository root. The application uses relative asset and module paths and does not require a build step.
