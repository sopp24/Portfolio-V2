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

## 6. Characters — the reference

Reference image (style target, **not** a likeness to reproduce on real people): `images/6.webp` in the session scratchpad parent
(`/tmp/claude-0/-home-user-Portfolio-V2/2fc7eb57-d3c6-5ae0-a888-d464d9bb8615/images/6.webp`): a stylised 3D sculpt — clean, smooth, slightly
exaggerated, painted-looking.

Defining traits to match:
- **Head**: long narrow face, defined jaw/chin, high straight nose bridge with a soft rounded tip, small closed mouth with full lower lip,
  prominent but smooth cheekbones with a **rosy blush** on cheeks/nose/ears, large ears.
- **Eyes**: smallish, dark, slightly heavy-lidded, thin lashes; **thick, dark, straight-angled brows** (the character's signature).
- **Hair**: sculpted as a few **big smooth swooping clumps** — a side-swept quiff with a curl falling on the forehead, volume on top, shorter
  sides — near-black with a **golden/blond streak**; glossy, clean, *not* strand-noisy.
- **Skin**: smooth with warm subsurface glow, cooler shadows, a strong key + warm rim, almost no pores.
- **Clothes**: **hoodie in desaturated blue** with big soft folds, a thick sculpted hood collar around the neck, drawstrings, white tee at the neck.
- **Proportions**: slender neck, slightly narrow shoulders, stylised (not realistic) — game-hero energy.

Cast:
1. **The boss / shopkeeper** ("le patron de la boutique") — exactly this character: young man, blue hoodie, golden-streak swept hair, heavy brows.
   He keeps all shopkeeper behaviour (counter, greeting wave, head/eye tracking, jaw while talking, blink, pick proxies, chat focus).
   The brief's older "old man" is superseded by the owner's latest instruction.
2. **Customer A** — same visual family (same sculpt language), different person: e.g. taller, short textured hair, bomber/varsity jacket, headphones.
3. **Customer B** — same family: e.g. a woman with a big side-swept wave of hair (with a coloured streak), oversized jacket, tote bag.
All three: unique silhouettes and palettes from §2, same face language (heavy brows, blush, dark eyes, smooth sculpt), originals only.

## 7. Definition of done (visual)

- Side-by-side with the reference, the boss reads as the same style at the hero zoom (chat focus) and still reads well at shop distance.
- The scene reads as "bright, saturated, stylised game hub" at first glance, desktop 1280×720 and mobile 390×844, all three tiers.
- No console errors, 28/28 tests green, `npm run check` clean, FR/EN intact, a11y floor intact.
- No old fonts left in UI or signage; no text clipped by the wider typefaces at 390 px.
