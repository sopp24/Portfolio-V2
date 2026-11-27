# Art direction v2 — "Midnight Video, but by day"

> Status: brief written for the v2 redesign. The reference site (midnightvideo.cuchillo.rocks) could **not** be opened from the build
> environment (DNS blocked), so this direction is derived from the owner's description ("same DA, but in daytime, a much more modern
> font and global style, game-like, PS5/GTA-grade ambition") and from the character reference image they supplied. Nothing here
> copies the reference site's assets.

## 1. Intent

A **game-like, modern, stylised** record shop, lit by hard **daylight**. Think "AAA stylised third-person game hub": confident colour
blocking, clean sculpted forms, strong rim/key light, neon that is still visible in the sun, bold wide typography, HUD-style UI.
The shop is still a 1990s independent record store (brief unchanged: one room, fixed camera, 10 vinyl projects in 6 bins,
SOPP Agents rack, About corner, interactive shopkeeper) — what changes is the *rendering language* and the *UI language*.

Honest ceiling: this is a no-build, procedural, browser-rendered scene (no photoscans, no baked GI, no hand-authored 4K assets).
"PS5-grade" is the ambition and the benchmark for choices, not a claim about the result.

## 2. Palette (day)

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#12162B` | text on light, deep shadows, outlines, HUD frames |
| `--paper` | `#FFF6E3` | sunlit walls, UI cards |
| `--sun` | `#FFC83D` | key light colour accent, highlights, primary CTA |
| `--coral` | `#FF5B4A` | signage, danger/live dot, hot accents |
| `--cyan` | `#19D5E8` | neon, secondary accent, links, cool fill light |
| `--violet` | `#6B4DFF` | tertiary accent, coloured shadows |
| `--mint` | `#3EE6A8` | success / OPEN state / app rack |
| `--sky` | `#9ED8FF` | window light, fog tint |

Rules: 2–3 accents per surface, never all at once. Shadows are **coloured** (violet/blue fill vs warm sun), not grey. Neon stays on
in daylight (emissive + restrained bloom). Large flat colour fields on walls/furniture, with material detail kept subtle.

## 3. Typography

| Role | Family | Weights | Notes |
| --- | --- | --- | --- |
| Display / titles / signage | **Unbounded** | 600, 800, 900 | wide, uppercase for titles, tight tracking on big sizes |
| UI / body | **Space Grotesk** | 400, 500, 600, 700 | sentence case, 15–17 px body |
| HUD / labels / numbers / keycaps | **JetBrains Mono** | 400, 500, 700 | uppercase, +0.08em tracking, small sizes |

Self-hosted in `assets/fonts/` (already vendored, `assets/fonts/fonts.css`). The old families (Anton, Poppins, Special Elite, Playfair,
Caveat, Permanent Marker, Dirtyline) are **retired** from UI and in-world signage (Dirtyline also had a licence question). Hand-written
price tags may keep a marker face only if it clearly adds value; otherwise use JetBrains Mono.

## 4. UI language (DOM overlay)

- Light **frosted-glass** cards (`--paper` at ~78 % + backdrop blur) with `--ink` text, 1.5 px `--ink` hairline, 18–24 px radius, a hard 4 px offset
  shadow in `--ink` at 12 % for the "game card" feel; dark variant only for the intro/loader.
- **HUD corners**: mono labels ("SIDE A · 14:02 · OPEN"), thin corner brackets, keycap chips (`ESC`, `E`, `F`), pill status chips.
- Buttons: pill or 14 px radius, bold weights, primary = `--sun` fill + `--ink` text, secondary = outline; clear hover/pressed/focus states.
- Motion: short, springy (180–320 ms), `prefers-reduced-motion` respected. No decorative parallax that hurts reading.
- Loading screen: big Unbounded title, real progress (never fake), a spinning vinyl glyph or progress ring.
- Accessibility floor is unchanged: keyboard, focus rings (2 px `--ink` + 2 px `--sun`), contrast ≥ 4.5:1 for text, 44 px touch targets, FR/EN everywhere.

## 5. 3D rendering language

- **Lighting**: one strong warm sun through the windows (hard-ish shadows, coloured by sky fill), cool bounce from the street, warm practicals,
  neon emissives that read in daylight. Light shafts and dust stay. Roof blocks the sun (already fixed).
- **Grade**: filmic-but-punchy — more contrast and saturation than v1, lifted blacks removed, slight teal-orange split, soft bloom,
  subtle grain, gentle vignette, *no* heavy chromatic aberration. Optional light posterisation of shadows is allowed only if it stays subtle.
- **Materials**: stylised PBR. Cleaner albedos, less noisy dirt, bold colour fields, gloss on plastics/neon/vinyl, believable wood/metal.
  Wall paint in colour blocks (cream, coral, teal, ink) with a bold graphic wainscot / stripe; floor becomes a crisp graphic pattern.
- **Props & signage**: modern wide typography in-world (neon, hanging bin dividers, price tags), sticker-bomb accents, game-hub clarity:
  interactive objects must remain readable (no clutter that hides records).
- **Perf**: keep the three tiers (high / medium / low). New effects must be gated by tier.

## 6. Characters — revised cast (owner's 2nd reference set)

The owner replaced the first character reference (blue hoodie) with a new **model for the shopkeeper** (full-body figure + two close-ups,
`images/10-12`), and asked for two decorative customers in **1980s clothes** (`images/13` man, `images/14` woman). Reference files:
`/tmp/claude-0/-home-user-Portfolio-V2/2fc7eb57-d3c6-5ae0-a888-d464d9bb8615/images/{10.webp,11.webp,12.webp,13.jpg,14.jpg}`.

**Likeness rule (hard).** The photos show real people. We use them **only for clothing design, materials, colours, silhouette/proportions, pose,
skin finish and hair type/volume**. Faces are **original** (own proportions; do not try to match any reference nose/eyes/mouth/jaw), nobody is
named or identified, and no character is meant to be recognisable as a real person. The owner asked for "100 %": we deliver 100 % of the
outfit, finish and silhouette, not the face.

### 6.1 The boss / shopkeeper ("le patron de la boutique") — from `images/10-12`
- **Jacket**: glossy **red leather** bomber-length jacket. **High stand-up collar with horizontal quilted channels** (stitched ridges),
  collar flares slightly open at the neck. **Two black leather V-bands** on the front: each starts at a shoulder and runs diagonally down to meet
  near the navel (wide at the shoulders, apex low centre). **Black band along the outer sleeve** and across the shoulder top. Chest placket with
  snaps, a snap flap pocket on the chest (wearer's right), a slanted zip pocket on the lower front (wearer's left). Red ribbed waistband with a
  **black belt strap and buckle** at the waist (buckle on wearer's left hip). **Sleeves pushed up** and bunched on the forearm, red cuff edge,
  a **black strap with a buckle** around the upper forearm on each sleeve. Many soft glossy wrinkles/folds.
- **Trousers**: slim, straight, long **red** trousers (satin-matte), slightly short so **white socks** show, **black loafers**.
- **Skin**: deep brown, **matte** (high roughness, very low specular, restrained SSS), smooth, slender hands with long fingers.
- **Hair**: short, dense, **black tight curls**, volume on top, a few loose curls falling on the forehead; glossy sheen, no helmet look.
- **Build**: slender, narrow shoulders, long limbs, relaxed upright stance, arms hanging slightly away from the body.
- Keeps all shopkeeper behaviour (counter, greeting wave, head/eye tracking, jaw while talking, blink, pick proxies, chat focus).

### 6.2 Customer A (man, decor) — from `images/13`
Short feathered hair with a lifted quiff/crown (light brown-blond). **Orange quilted down vest** (channel stitching, stand collar, snaps) over a
**stone-washed denim jacket** (faded patches, sleeves rolled back showing a **cream cuff lining with a small dot print**), **pale blue/white check
shirt** with the collar out, **high-waisted straight stone-washed jeans**, brown belt, white sneakers. Relaxed, hands low.

### 6.3 Customer B (woman, decor) — from `images/14`
**Big voluminous 1980s hair** (long feathered waves, lots of height at the crown, golden-blond with lighter highlights, past the shoulders).
**Black leather biker jacket** (wide notched lapels, diagonal zip, epaulettes, studs, snap collar) over a **black scoop/V top**, wide black belt with a
silver buckle, **high-waisted tapered leopard-print trousers**, gold hoop earrings, small red ribbon pin on the lapel. One hand near the hip pocket.

All three: unique silhouettes, 80s costume language, original faces, same sculpt/shading quality bar (matte skin, glossy leather, believable denim/nylon).

## 7. Definition of done (visual)

- Side-by-side with the owner's model (`images/10`), the boss shows the same outfit, finish and silhouette at the hero zoom (chat focus) and still reads well at shop distance; the face is original. Customers read as 1980s at shop distance (denim + orange down vest; black biker jacket + leopard trousers + big hair).
- Day lighting: mean luminance of the home view >= 0.50, saturated paints keep their hue in shade (no crimson/olive drift), the sun is legible from the home pose.
- The scene reads as "bright, saturated, stylised game hub" at first glance, desktop 1280×720 and mobile 390×844, all three tiers.
- No console errors, 28/28 tests green, `npm run check` clean, FR/EN intact, a11y floor intact.
- No old fonts left in UI or signage; no text clipped by the wider typefaces at 390 px.
