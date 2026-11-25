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
- src/scene/store.js — procedural record-store environment, physical sleeves/discs and shared materials.
- src/scene/record-interaction.js — center-gaze raycasting, record extraction, flip/open/return animation.
- src/controls/camera.js — fixed-position mouse, touch, pinch-zoom and gyroscope controls.
- src/data/projects.js — structured bilingual project catalogue and editable profile placeholders.
- src/data/applications.js — verified SOPP Agents application links.

## Content integrity

The ten project entries are structured independently from their 3D representation. Years that were not supplied remain null; roles that are not confirmed are described as such; historical profile information is marked for validation. The generated sleeve artwork is provisional and is not presented as original project deliverables.

The applications rack contains the eight applications listed in the SOPP Agents repository. Each destination points to the corresponding live app and repository.

## Controls currently implemented

- Desktop mouse position: look around and aim with the center reticle; click the targeted sleeve to extract it.
- Mouse wheel: zoom without moving the camera.
- Selected record: F flips Side A / Side B; O opens or closes the sleeve; Escape or R returns it to its exact crate position.
- On-screen record controls: flip, open/close, view project details and return to the bin.
- Smartphone: one-finger drag to look around, pinch to zoom, tap the targeted sleeve to extract it.
- Gyroscope: permission-based activation from the settings header.
- Escape: show / hide the compact header on desktop.
- Recenter: restore the default camera orientation and zoom.
- 2D collection: accessible project and application index, including when WebGL is unavailable.

The visitor's camera position never changes.

## Development roadmap

1. ~~Create the physical vinyl model, front/back liner art and hinged sleeve.~~
2. ~~Add center-gaze raycast selection, subtle hover response, extraction, flip, opening, project details and return-to-crate animation.~~
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


### Phase 2 — Vinyl interaction implementation

The ten central records are independent selectable 3D objects. Aim with the center reticle and click/tap the canvas to pull a record toward the fixed camera. The inspection controls can flip the sleeve to Side B, open and close its hinged front, slide the vinyl outward, open the full project sheet, or return the record to its exact original crate position. Escape and R also return a selected record. Keyboard shortcuts F and O flip/open the sleeve. The raycast and record animations are isolated in `src/scene/record-interaction.js`; the camera position remains fixed throughout.

The current sleeve artwork and its Side B liner notes are procedural placeholders, clearly marked as such in the project catalogue. Final supplied project artwork can replace the textures without changing the interaction system.
