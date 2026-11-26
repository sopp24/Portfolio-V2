// Procedural artwork — art direction v2 ("Midnight Video, but by day"): project sleeves, liner notes, decorative covers,
// gig posters, stickers, app cases and sign boards. Everything is ORIGINAL and generated at runtime on 2D canvases.
//   * Type system: Unbounded (display), Space Grotesk (UI / body), JetBrains Mono (HUD / labels) — see docs/ART_DIRECTION.md §3.
//   * Palette: the eight day tokens (ink, paper, sun, coral, cyan, violet, mint, sky) — see §2.
//   * Project sleeves are PROVISIONAL placeholders: swap them for final art by setting `project.cover.front` / `project.cover.back`.
import * as THREE from "three";
import { rng, createCanvas, textureFrom, addGrain, roundRectPath, mixHex, shadeHex, hexToRgb } from "./util.js";

// ---------------------------------------------------------------------------------------------
// design tokens
// ---------------------------------------------------------------------------------------------
export const PALETTE = Object.freeze({ ink: "#12162B", paper: "#FFF6E3", sun: "#FFC83D", coral: "#FF5B4A", cyan: "#19D5E8", violet: "#6B4DFF", mint: "#3EE6A8", sky: "#9ED8FF" });
const { ink: INK, paper: PAPER, sun: SUN, coral: CORAL, cyan: CYAN, violet: VIOLET, mint: MINT, sky: SKY } = PALETTE;
const ORANGE = "#FF9F2E";

const FALLBACK = '"Helvetica Neue", Arial, sans-serif';
// "Unbounded Black" / "Unbounded Bold" are canvas-only aliases (registered below) that map EVERY requested weight onto the 900 / 800
// file, so legacy call sites that still ask for `400 NNpx ${FONT.display}` render the punchy heavy cut instead of the thin one.
export const FONT = {
  display: `"Unbounded Black", "Unbounded", "Arial Black", ${FALLBACK}`,
  displayBold: `"Unbounded Bold", "Unbounded", "Arial Black", ${FALLBACK}`,
  ui: `"Space Grotesk", ${FALLBACK}`,
  mono: '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace'
};
// retired v1 keys, kept so every importing file keeps working (they now resolve to the v2 families)
FONT.grunge = FONT.display;
FONT.serif = FONT.displayBold;
FONT.type = FONT.mono;
FONT.marker = FONT.mono;
FONT.hand = FONT.ui;
FONT.sans = FONT.ui;

const FONT_DIR = new URL("../../assets/fonts/", import.meta.url).href;
const FONT_ALIASES = [["Unbounded Black", "unbounded-latin-900-normal.woff2"], ["Unbounded Bold", "unbounded-latin-800-normal.woff2"]];
let aliasPromises = null;
function registerAliases() {
  if (aliasPromises) return aliasPromises;
  aliasPromises = [];
  if (typeof document === "undefined" || !document.fonts || typeof FontFace === "undefined") return aliasPromises;
  for (const [family, file] of FONT_ALIASES) {
    try {
      const face = new FontFace(family, `url("${FONT_DIR}${file}") format("woff2")`, { weight: "100 900", style: "normal", display: "swap" });
      document.fonts.add(face);
      aliasPromises.push(face.load().catch(() => null));
    } catch { /* the real "Unbounded" family is the fallback */ }
  }
  return aliasPromises;
}
registerAliases();

const FONT_REQUESTS = [
  '900 40px "Unbounded"', '800 40px "Unbounded"', '600 40px "Unbounded"', '400 40px "Unbounded"',
  '400 24px "Space Grotesk"', '500 24px "Space Grotesk"', '600 24px "Space Grotesk"', '700 24px "Space Grotesk"',
  '400 24px "JetBrains Mono"', '500 24px "JetBrains Mono"', '700 24px "JetBrains Mono"',
  '400 40px "Unbounded Black"', '400 40px "Unbounded Bold"'
];
export async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all([...registerAliases(), ...FONT_REQUESTS.map((f) => document.fonts.load(f, "AaÉé0123 €·—’"))]),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  } catch { /* fonts are a nicety, never a blocker */ }
}

const TAU = Math.PI * 2;
const HAS_LS = typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype;

// ---------------------------------------------------------------------------------------------
// colour + text helpers
// ---------------------------------------------------------------------------------------------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
const onColor = (bg, light = PAPER, dark = INK) => (lum(bg) > .56 ? dark : light);
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

// push a colour toward the day palette's saturated, mid-light range (used for unknown projects only)
function vividHex(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  s = Math.max(s, .62);
  const L = clamp(l, .2, .6) < .3 ? .16 : clamp(l, .46, .62);
  const q = L < .5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return `#${hex2(f(h + 1 / 3) * 255)}${hex2(f(h) * 255)}${hex2(f(h - 1 / 3) * 255)}`;
}

const fontStr = (family, weight, px) => `${weight} ${px}px ${FONT[family] || family}`;

function measure(ctx, str, family, weight, px, track = 0) {
  ctx.save();
  ctx.font = fontStr(family, weight, px);
  if (HAS_LS) ctx.letterSpacing = `${(track * px).toFixed(2)}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

function fitPx(ctx, str, family, weight, maxW, startPx, minPx = 8, track = 0) {
  const w = measure(ctx, str, family, weight, 100, track);
  return w <= 0 ? startPx : clamp(maxW / w * 100, minPx, startPx);
}

// Draw one run of text. o.max auto-fits the size to a width. Returns the pixel size used.
function put(ctx, str, x, y, o = {}) {
  let { family = "ui", weight = 500, px = 24, color = INK, align = "left", base = "alphabetic", track = 0, alpha = 1, shadow = null, stroke = null, max = 0, minPx = 8 } = o;
  if (max) px = fitPx(ctx, str, family, weight, max, px, minPx, track);
  ctx.save();
  ctx.font = fontStr(family, weight, px);
  ctx.textAlign = align; ctx.textBaseline = base;
  let spacing = 0;
  if (HAS_LS) { spacing = track * px; ctx.letterSpacing = `${spacing.toFixed(2)}px`; }
  const dx = align === "center" ? spacing / 2 : align === "right" ? spacing : 0; // the trailing tracking belongs to the last glyph
  ctx.globalAlpha *= alpha;
  if (shadow) { ctx.fillStyle = shadow.color; ctx.fillText(str, x + dx + shadow.dx, y + shadow.dy); }
  if (stroke) { ctx.lineJoin = "round"; ctx.miterLimit = 2; ctx.lineWidth = stroke.w; ctx.strokeStyle = stroke.color; ctx.strokeText(str, x + dx, y); }
  ctx.fillStyle = color; ctx.fillText(str, x + dx, y);
  ctx.restore();
  return px;
}

// "Cocon-S-mantique Studcorp" -> breakable tokens (after hyphens, at spaces)
function tokenise(text) {
  const out = [], re = /(\s*)([^\s-]+-?|-)/g;
  let m;
  while ((m = re.exec(text))) out.push({ t: m[2], sp: m[1].length > 0 && out.length > 0 });
  return out;
}
const joinTokens = (toks) => toks.map((k, i) => (i && k.sp ? " " : "") + k.t).join("");

// Largest size at which `text` wraps into <= maxLines lines that all fit maxW. `balance` evens the line widths.
function wrapFit(ctx, text, { family = "display", weight = 900, maxW, maxPx, minPx = 10, maxLines = 3, track = 0, balance = true } = {}) {
  const toks = tokenise(String(text));
  const lineW = (arr, px) => measure(ctx, joinTokens(arr), family, weight, px, track);
  const tryPx = (px) => {
    const lines = [];
    let cur = [];
    for (const tok of toks) {
      const next = [...cur, tok];
      if (cur.length && lineW(next, px) > maxW) { lines.push(cur); cur = [tok]; } else cur = next;
    }
    if (cur.length) lines.push(cur);
    if (lines.length > maxLines || lines.some((l) => lineW(l, px) > maxW)) return null;
    if (balance && lines.length > 1 && toks.length <= 9) {
      let best = null, bestScore = Infinity;
      const n = lines.length;
      const rec = (start, left, acc) => {
        if (left === 1) {
          const part = [...acc, toks.slice(start)];
          if (!part[part.length - 1].length) return;
          const widths = part.map((l) => lineW(l, px));
          const score = Math.max(...widths);
          if (score <= maxW && score < bestScore) { bestScore = score; best = part; }
          return;
        }
        for (let end = start + 1; end <= toks.length - (left - 1); end++) rec(end, left - 1, [...acc, toks.slice(start, end)]);
      };
      rec(0, n, []);
      if (best) return best.map(joinTokens);
    }
    return lines.map(joinTokens);
  };
  for (let px = maxPx; px >= minPx; px -= Math.max(1, px * .035)) {
    const lines = tryPx(px);
    if (lines) return { lines, px };
  }
  // last resort: one line per token at the minimum size
  return { lines: [String(text)], px: Math.min(maxPx, fitPx(ctx, String(text), family, weight, maxW, maxPx, 6, track)) };
}

// wrapped paragraph with a hard line limit; returns the y after the last line
function paragraph(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) {
    let last = shown[shown.length - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    shown[shown.length - 1] = last.replace(/[\s,;:.]+$/, "") + "…";
  }
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}
function paragraphHeight(ctx, text, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = "", n = 0;
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { n++; line = word; } else line = candidate;
  }
  return (n + (line ? 1 : 0)) * lineHeight;
}

// ---------------------------------------------------------------------------------------------
// shape helpers
// ---------------------------------------------------------------------------------------------
function fillRR(ctx, x, y, w, h, r, fill, stroke = null, lw = 0) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// "game card": ink hairline + hard offset shadow
function card(ctx, x, y, w, h, r, fill, { line = INK, lw = 3, off = 10, shadow = rgba(INK, .22) } = {}) {
  if (off) fillRR(ctx, x + off, y + off, w, h, r, shadow);
  fillRR(ctx, x, y, w, h, r, fill, line, lw);
}

// pill chip with mono text. align "right" makes x the right edge. Returns the box.
function chip(ctx, x, y, str, { bg = INK, fg = PAPER, px = 22, family = "mono", weight = 700, track = .08, padX = .75, h = 1.95, align = "left", border = null, lw = 2 } = {}) {
  const tw = measure(ctx, str, family, weight, px, track);
  const w = tw + px * padX * 2, hh = px * h;
  const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  fillRR(ctx, x0, y, w, hh, hh / 2, bg, border, lw);
  put(ctx, str, x0 + w / 2, y + hh / 2 + px * .02, { family, weight, px, color: fg, align: "center", base: "middle", track });
  return { x: x0, y, w, h: hh };
}

function sparkle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

function pin(ctx, x, y, r, fill, line = INK, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y - r * 1.55, r, Math.PI * .78, Math.PI * 2.22);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.lineJoin = "round"; ctx.stroke();
  ctx.fillStyle = line; ctx.beginPath(); ctx.arc(x, y - r * 1.55, r * .38, 0, TAU); ctx.fill();
}

function halftone(ctx, x, y, w, h, tone, { spacing = 14, color = "#000", angle = .52, maxR = null } = {}) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const diag = Math.hypot(w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = color;
  const r0 = maxR ?? spacing * .72;
  for (let gy = -diag; gy < diag; gy += spacing) {
    for (let gx = -diag; gx < diag; gx += spacing) {
      const px = x + w / 2 + gx * cos - gy * sin;
      const py = y + h / 2 + gx * sin + gy * cos;
      if (px < x - spacing || px > x + w + spacing || py < y - spacing || py > y + h + spacing) continue;
      const t = tone((px - x) / w, (py - y) / h);
      if (t <= .02) continue;
      ctx.beginPath();
      ctx.arc(px, py, r0 * Math.sqrt(Math.min(1, t)), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function dotGrid(ctx, x, y, w, h, step, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (let gy = y + step / 2; gy < y + h; gy += step) for (let gx = x + step / 2; gx < x + w; gx += step) { ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function lineGrid(ctx, x, y, w, h, step, lw, color, alpha = 1) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let gx = x; gx <= x + w + .5; gx += step) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
  for (let gy = y; gy <= y + h + .5; gy += step) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
  ctx.stroke();
  ctx.restore();
}

function diagStripes(ctx, x, y, w, h, step, lw, color, angle = -.62, alpha = 1) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle);
  ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  const d = Math.hypot(w, h);
  for (let s = -d; s < d; s += step) ctx.fillRect(s, -d, lw, d * 2);
  ctx.restore();
}

function regMark(ctx, x, y, r, color, lw = 2) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r * .55, 0, TAU); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.restore();
}

function barcode(ctx, x, y, w, h, color, seed = 3) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let cx = x; cx < x + w;) {
    const bw = [1.4, 2.4, 3.6, 1.4, 2.4][Math.floor(rand() * 5)] * (h / 36);
    if (cx + bw > x + w) break;
    ctx.fillRect(cx, y, bw, h);
    cx += bw + [1.4, 2.4, 3.2][Math.floor(rand() * 3)] * (h / 36);
  }
}

function circlePath(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); }

// ---------------------------------------------------------------------------------------------
// finish: a clean modern print — soft coated-paper sheen, crisp edges, only a hint of shelf wear
// ---------------------------------------------------------------------------------------------
export function applyWear(canvas, seed = 5, strength = 1) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const rand = rng(seed);
  // coated-stock sheen
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, `rgba(255,255,255,${.1 * strength})`);
  sheen.addColorStop(.34, "rgba(255,255,255,0)");
  sheen.addColorStop(.5, `rgba(255,255,255,${.045 * strength})`);
  sheen.addColorStop(.6, "rgba(255,255,255,0)");
  sheen.addColorStop(1, `rgba(20,16,60,${.07 * strength})`);
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
  // faint shelf ring where the disc presses against the board
  const rg = ctx.createRadialGradient(w / 2, h / 2, w * .38, w / 2, h / 2, w * .46);
  rg.addColorStop(0, "rgba(255,255,255,0)");
  rg.addColorStop(.5, `rgba(255,252,244,${.05 * strength})`);
  rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // crisp edge highlight
  ctx.strokeStyle = `rgba(255,255,255,${.28 * strength})`; ctx.lineWidth = Math.max(1, w * .0016);
  ctx.strokeRect(w * .0012, h * .0012, w * .9976, h * .9976);
  // a few light corner scuffs
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    if (rand() < .6) continue;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * rand.range(.025, .05));
    g.addColorStop(0, `rgba(255,250,240,${.4 * strength})`);
    g.addColorStop(1, "rgba(255,250,240,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // hinge shading for sleeve volume
  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(0,0,0,.11)"); shade.addColorStop(.05, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  addGrain(canvas, .016 * strength, seed + 9);
  return canvas;
}

// ---------------------------------------------------------------------------------------------
// PROJECT THEMES — [main, accent, dark] per sleeve, drawn from the day palette
// ---------------------------------------------------------------------------------------------
const THEMES = {
  rapmap: [CORAL, SUN, "#1B1233"],
  "winehouse-promo": [VIOLET, SUN, "#1D1247"],
  wero: [SUN, CYAN, INK],
  "student-housing": [MINT, CORAL, "#0E2B2E"],
  "winehouse-amy": [CORAL, SUN, "#14122B"],
  smac: [VIOLET, CYAN, INK],
  "jugar-si-quieres": [SUN, CORAL, "#0F1C3A"],
  "swim-sync": [CYAN, MINT, "#08233A"],
  expodata: [SKY, SUN, INK],
  "portfolio-v1": [CORAL, SUN, INK]
};
const DEFAULT_THEME = [CORAL, SUN, INK];

// The v2 [main, accent, dark] palette of a project (records.js may use it for the disc label).
export function projectTheme(project) {
  if (THEMES[project.id]) return THEMES[project.id];
  if (Array.isArray(project.artwork) && project.artwork.length === 3) return project.artwork.map(vividHex);
  return DEFAULT_THEME;
}

const pick = (obj, lang) => (obj && (obj[lang] ?? obj.fr)) || "";
function splitTitle(title) {
  const parts = String(title).split(/\s[—–]\s/);
  return parts.length > 1 ? [parts[0], parts.slice(1).join(" — ")] : [String(title), ""];
}

// ---------------------------------------------------------------------------------------------
// PROJECT SLEEVES — one distinct composition per project (square, 1024 reference grid)
// ---------------------------------------------------------------------------------------------
function bigTitle(ctx, lines, x, baseY, maxW, maxPx, color, shadow, { family = "display", weight = 900, align = "left", lead = 1.0, track = -.01 } = {}) {
  const lineSizes = lines.map((l) => fitPx(ctx, l, family, weight, maxW, maxPx, 8, track));
  const px = Math.min(...lineSizes);
  lines.forEach((l, i) => put(ctx, l, x, baseY - (lines.length - 1 - i) * px * lead, { family, weight, px, color, align, track, shadow: shadow ? { color: shadow, dx: px * .055, dy: px * .055 } : null }));
  return px;
}

const COVER = {
  rapmap(ctx, S, t) {
    const [coral, sun, ink] = t;
    ctx.fillStyle = coral; ctx.fillRect(0, 0, S, S);
    const cx = S * .5, cy = S * .4, R = S * .29;
    // sunburst
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = shadeHex(coral, .11);
    for (let k = 0; k < 24; k += 2) {
      const a0 = k * TAU / 24, a1 = a0 + TAU / 24;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * S * 1.3, Math.sin(a0) * S * 1.3); ctx.lineTo(Math.cos(a1) * S * 1.3, Math.sin(a1) * S * 1.3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // sound rings
    ctx.lineCap = "round";
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = PAPER; ctx.globalAlpha = .95 - i * .17; ctx.lineWidth = S * .011;
      for (const [a, b] of [[-.85, .85], [Math.PI - .85, Math.PI + .85]]) { ctx.beginPath(); ctx.arc(cx, cy, R * (1.1 + i * .12), a, b); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    // globe
    circlePath(ctx, cx + S * .018, cy + S * .018, R); ctx.fillStyle = ink; ctx.fill();
    circlePath(ctx, cx, cy, R); ctx.fillStyle = sun; ctx.fill();
    ctx.save(); circlePath(ctx, cx, cy, R); ctx.clip();
    halftone(ctx, cx - R, cy - R, R * 2, R * 2, (u, v) => clamp(((u - .26) + (v - .2)) * .95 - .12, 0, 1), { spacing: S * .021, color: ink, angle: .5 });
    ctx.strokeStyle = rgba(ink, .5); ctx.lineWidth = S * .0042;
    for (const f of [.3, .62, .9]) { ctx.beginPath(); ctx.ellipse(cx, cy, R * f, R, 0, 0, TAU); ctx.stroke(); }
    for (const f of [-.55, -.18, .18, .55]) { ctx.beginPath(); ctx.moveTo(cx - R, cy + R * f); ctx.lineTo(cx + R, cy + R * f); ctx.stroke(); }
    ctx.restore();
    circlePath(ctx, cx, cy, R); ctx.lineWidth = S * .009; ctx.strokeStyle = ink; ctx.stroke();
    // pins
    [[-.42, -.2, CYAN], [.14, -.5, PAPER], [.46, .08, CYAN], [-.52, .24, PAPER], [.3, -.28, SUN]].forEach(([dx, dy, c]) => pin(ctx, cx + dx * R, cy + dy * R, S * .021, c, ink, S * .006));
    // mic
    const mw = S * .11, mh = S * .21, mx = cx - mw / 2, my = cy - S * .15;
    const stand = () => { ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(cx, my + mh * .62, S * .088, .12, Math.PI - .12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, my + mh * .62 + S * .088); ctx.lineTo(cx, my + mh + S * .105); ctx.stroke(); };
    ctx.strokeStyle = ink; ctx.lineWidth = S * .026; stand();
    ctx.strokeStyle = PAPER; ctx.lineWidth = S * .012; stand();
    fillRR(ctx, cx - S * .065, my + mh + S * .097, S * .13, S * .024, S * .012, ink);
    fillRR(ctx, cx - S * .055, my + mh + S * .102, S * .11, S * .014, S * .007, PAPER);
    fillRR(ctx, mx + S * .012, my + S * .012, mw, mh, mw / 2, ink);
    fillRR(ctx, mx, my, mw, mh, mw / 2, PAPER, ink, S * .008);
    ctx.save(); roundRectPath(ctx, mx, my, mw, mh, mw / 2); ctx.clip();
    ctx.fillStyle = rgba(ink, .85);
    for (let i = 1; i < 8; i++) ctx.fillRect(mx, my + i * mh / 8 - S * .002, mw, S * .005);
    ctx.fillStyle = rgba(ink, .12); ctx.fillRect(mx + mw * .62, my, mw * .38, mh);
    ctx.restore();
    // title
    const px = bigTitle(ctx, ["RAPMAP"], S * .06, S * .875, S * .88, S * .24, PAPER, ink);
    void px;
    chip(ctx, S * .06, S * .905, "EL NUEVO PODCAST", { bg: SUN, fg: ink, px: S * .027, border: ink, lw: S * .004 });
    return "EP.00 · PILOT";
  },

  "winehouse-promo"(ctx, S, t) {
    const [violet, gold, deep] = t;
    ctx.fillStyle = violet; ctx.fillRect(0, 0, S, S);
    const cx = S * .5, cy = S * .39;
    ctx.strokeStyle = rgba(PAPER, .17); ctx.lineWidth = S * .007;
    for (let i = 1; i <= 7; i++) { circlePath(ctx, cx, cy, S * (.2 + i * .075)); ctx.stroke(); }
    // gold sun + house
    circlePath(ctx, cx + S * .016, cy + S * .016, S * .27); ctx.fillStyle = deep; ctx.fill();
    circlePath(ctx, cx, cy, S * .27); ctx.fillStyle = gold; ctx.fill();
    const hx0 = S * .2, hx1 = S * .8, wy = S * .47, by = S * .67;
    ctx.fillStyle = deep;
    ctx.beginPath(); ctx.moveTo(hx0 - S * .03, wy + S * .02); ctx.lineTo(cx, S * .22); ctx.lineTo(hx1 + S * .03, wy + S * .02); ctx.lineTo(hx1, wy + S * .02); ctx.lineTo(hx1, by); ctx.lineTo(hx0, by); ctx.lineTo(hx0, wy + S * .02); ctx.closePath(); ctx.fill();
    fillRR(ctx, S * .66, S * .26, S * .05, S * .1, S * .006, deep);
    // window with a wine glass
    fillRR(ctx, cx - S * .12, S * .45, S * .24, S * .24, S * .03, PAPER, deep, S * .008);
    const gx = cx, gy = S * .475;
    ctx.beginPath(); ctx.moveTo(gx - S * .06, gy); ctx.quadraticCurveTo(gx - S * .07, gy + S * .085, gx, gy + S * .085); ctx.quadraticCurveTo(gx + S * .07, gy + S * .085, gx + S * .06, gy); ctx.closePath();
    ctx.fillStyle = rgba(INK, .08); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = CORAL; ctx.fillRect(gx - S * .08, gy + S * .028, S * .16, S * .07);
    ctx.restore();
    ctx.strokeStyle = deep; ctx.lineWidth = S * .007; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(gx - S * .06, gy); ctx.quadraticCurveTo(gx - S * .07, gy + S * .085, gx, gy + S * .085); ctx.quadraticCurveTo(gx + S * .07, gy + S * .085, gx + S * .06, gy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy + S * .085); ctx.lineTo(gx, gy + S * .15); ctx.moveTo(gx - S * .035, gy + S * .15); ctx.lineTo(gx + S * .035, gy + S * .15); ctx.stroke();
    [[.12, .18, .022], [.88, .3, .03], [.16, .56, .016], [.84, .58, .02]].forEach(([x, y, r]) => sparkle(ctx, S * x, S * y, S * r * 1.6, gold));
    // ground + type
    ctx.fillStyle = deep; ctx.fillRect(0, by, S, S - by);
    ctx.fillStyle = gold; ctx.fillRect(0, by, S, S * .012);
    bigTitle(ctx, ["WINEHOUSE"], S * .06, S * .855, S * .88, S * .2, PAPER, violet);
    chip(ctx, S * .06, S * .895, "THE ALBUM · OUT NOW", { bg: gold, fg: deep, px: S * .027 });
    put(ctx, "PROMO POST · SQUARE EDITION", S * .94, S * .952, { family: "mono", weight: 500, px: S * .02, color: rgba(PAPER, .75), align: "right", track: .08 });
    return "ADAM SOPPELSA";
  },

  wero(ctx, S, t) {
    const [sun, cyan, ink] = t;
    ctx.fillStyle = sun; ctx.fillRect(0, 0, S, S);
    diagStripes(ctx, 0, 0, S, S, S * .1, S * .045, shadeHex(sun, -.06), -.7);
    // two rounded tiles trading arrows
    const rA = [S * .09, S * .12, S * .4, S * .4], rB = [S * .43, S * .26, S * .4, S * .4];
    card(ctx, rA[0], rA[1], rA[2], rA[3], S * .075, cyan, { line: ink, lw: S * .008, off: S * .014, shadow: ink });
    card(ctx, rB[0], rB[1], rB[2], rB[3], S * .075, PAPER, { line: ink, lw: S * .008, off: S * .014, shadow: ink });
    ctx.strokeStyle = ink; ctx.lineWidth = S * .028; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(S * .16, S * .32); ctx.lineTo(S * .44, S * .32); ctx.moveTo(S * .37, S * .25); ctx.lineTo(S * .44, S * .32); ctx.lineTo(S * .37, S * .39); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(S * .79, S * .52); ctx.lineTo(S * .5, S * .52); ctx.moveTo(S * .57, S * .45); ctx.lineTo(S * .5, S * .52); ctx.lineTo(S * .57, S * .59); ctx.stroke();
    // coin
    circlePath(ctx, S * .8, S * .17, S * .07); ctx.fillStyle = ink; ctx.fill();
    circlePath(ctx, S * .8, S * .17, S * .052); ctx.fillStyle = sun; ctx.fill();
    put(ctx, "€", S * .8, S * .175, { family: "display", weight: 900, px: S * .06, color: ink, align: "center", base: "middle" });
    sparkle(ctx, S * .1, S * .66, S * .035, ink); sparkle(ctx, S * .92, S * .4, S * .022, ink);
    bigTitle(ctx, ["WERO"], S * .06, S * .875, S * .88, S * .26, ink, PAPER);
    chip(ctx, S * .06, S * .905, "ARRIVÉE EN FRANCE", { bg: ink, fg: sun, px: S * .027 });
    put(ctx, "CAMPAGNE MULTICANALE", S * .94, S * .952, { family: "mono", weight: 700, px: S * .021, color: ink, align: "right", track: .08 });
    return "PAYLIB › WERO";
  },

  "student-housing"(ctx, S, t, title) {
    const [mint, coral, dark] = t;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, S, S);
    // heat grid of Bordeaux
    const cols = 12, rows = 7, gx0 = S * .05, gy0 = S * .11, gw = S * .9, gh = S * .44, gap = S * .008;
    const cw = (gw - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
    const rand = rng(14);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const d = Math.hypot((c + .5) / cols - .42, (r + .5) / rows - .5);
      const heat = clamp(1 - d * 1.5 + (rand() - .5) * .5, 0, 1);
      const col = heat > .5 ? mixHex(SUN, coral, (heat - .5) * 2) : mixHex(mint, SUN, heat * 2);
      fillRR(ctx, gx0 + c * (cw + gap), gy0 + r * (ch + gap), cw, ch, S * .008, mixHex(PAPER, col, .35 + heat * .65));
    }
    // river
    const river = () => { ctx.beginPath(); ctx.moveTo(S * .02, S * .42); ctx.bezierCurveTo(S * .3, S * .1, S * .55, S * .6, S * .98, S * .22); };
    ctx.lineCap = "round"; ctx.lineWidth = S * .046; ctx.strokeStyle = dark; river(); ctx.stroke();
    ctx.lineWidth = S * .03; ctx.strokeStyle = CYAN; river(); ctx.stroke();
    [[.3, .3], [.6, .43], [.74, .25]].forEach(([x, y], i) => pin(ctx, S * x, S * y, S * .024, [CORAL, PAPER, SUN][i], dark, S * .006));
    ctx.strokeStyle = dark; ctx.lineWidth = S * .007; ctx.strokeRect(gx0 - S * .004, gy0 - S * .004, gw + S * .008, gh + S * .008);
    // legend
    const lg = ctx.createLinearGradient(S * .05, 0, S * .4, 0); lg.addColorStop(0, mint); lg.addColorStop(.5, SUN); lg.addColorStop(1, coral);
    fillRR(ctx, S * .05, S * .575, S * .35, S * .016, S * .008, lg);
    put(ctx, "SATISFACTION × LOCALISATION", S * .95, S * .59, { family: "mono", weight: 700, px: S * .02, color: dark, align: "right", track: .08 });
    // title band
    ctx.fillStyle = dark; ctx.fillRect(0, S * .625, S, S * .375);
    ctx.fillStyle = mint; ctx.fillRect(0, S * .625, S, S * .012);
    const text = splitTitle(title)[0].toUpperCase();
    const { lines, px } = wrapFit(ctx, text, { maxW: S * .88, maxPx: S * .088, minPx: S * .05, maxLines: 3, track: -.01 });
    const lead = px * 1.06, baseY = S * .94;
    lines.forEach((l, i) => put(ctx, l, S * .06, baseY - (lines.length - 1 - i) * lead, { family: "display", weight: 900, px, color: i === lines.length - 1 ? mint : PAPER, track: -.01 }));
    return "DATA · BORDEAUX";
  },

  "winehouse-amy"(ctx, S, t) {
    const [coral, sun, dark] = t;
    ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S);
    const vp = [S * .5, S * .36];
    for (let i = 0; i < 15; i++) {
      const k = Math.pow(1 - i / 15, 1.85), w = S * 1.04 * k + S * .03;
      const tt = i / 14;
      ctx.fillStyle = tt < .72 ? mixHex(dark, coral, .1 + tt * .85) : mixHex(coral, sun, (tt - .72) / .28);
      ctx.fillRect(vp[0] - w / 2, vp[1] - w / 2, w, w);
      ctx.strokeStyle = rgba(dark, .55); ctx.lineWidth = S * .004; ctx.strokeRect(vp[0] - w / 2, vp[1] - w / 2, w, w);
    }
    // light spilling from the door
    const g = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], S * .26);
    g.addColorStop(0, "rgba(255,244,200,.95)"); g.addColorStop(.35, rgba(SUN, .5)); g.addColorStop(1, rgba(SUN, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    // stairs
    for (let i = 0; i < 7; i++) {
      const y = S * (.47 + i * .055), w = S * (.12 + i * .1);
      ctx.fillStyle = mixHex(dark, coral, .2 + i * .06); ctx.fillRect(vp[0] - w / 2, y, w, S * .03);
      ctx.fillStyle = rgba(PAPER, .15); ctx.fillRect(vp[0] - w / 2, y, w, S * .004);
    }
    // the silhouette
    ctx.fillStyle = "#07060f";
    ctx.beginPath(); ctx.ellipse(vp[0], vp[1] + S * .13, S * .028, S * .068, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(vp[0], vp[1] + S * .045, S * .022, 0, TAU); ctx.fill();
    // type
    bigTitle(ctx, ["WINEHOUSE"], S * .06, S * .74, S * .88, S * .15, sun, null);
    put(ctx, "AMY", S * .06, S * .935, { family: "display", weight: 900, px: S * .2, color: coral, track: -.01, shadow: { color: PAPER, dx: S * .01, dy: S * .01 } });
    chip(ctx, S * .94, S * .84, "THE REISSUE", { bg: sun, fg: dark, px: S * .026, align: "right" });
    put(ctx, "TRAILER › TEASER", S * .94, S * .925, { family: "mono", weight: 700, px: S * .021, color: rgba(PAPER, .85), align: "right", track: .08 });
    return "STORYTELLING";
  },

  smac(ctx, S, t, title) {
    const [violet, cyan, ink] = t;
    ctx.fillStyle = ink; ctx.fillRect(0, 0, S, S);
    dotGrid(ctx, 0, 0, S, S * .66, S * .035, S * .0035, PAPER, .22);
    // equaliser = diffusion data
    const bars = 13, bw = S * .88 / bars, base = S * .56, rand = rng(8), seg = S * .03, gap = S * .008;
    for (let i = 0; i < bars; i++) {
      const hgt = S * (.1 + .36 * Math.abs(Math.sin(i * .62 + .8)) * (.55 + rand() * .45));
      const n = Math.floor(hgt / (seg + gap)), x = S * .06 + i * bw;
      for (let k = 0; k < n; k++) {
        const f = k / Math.max(1, n - 1);
        ctx.fillStyle = f < .5 ? mixHex(cyan, violet, f * 2) : mixHex(violet, CORAL, (f - .5) * 2);
        fillRR(ctx, x, base - (k + 1) * (seg + gap) + gap, bw * .78, seg, S * .006, ctx.fillStyle);
      }
      fillRR(ctx, x, base - (n + 1) * (seg + gap) + gap, bw * .78, seg * .55, S * .004, SUN);
      ctx.globalAlpha = .18;
      for (let k = 0; k < Math.min(n, 4); k++) fillRR(ctx, x, base + gap + k * (seg + gap), bw * .78, seg, S * .006, cyan);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = rgba(PAPER, .5); ctx.fillRect(S * .06, base + S * .001, S * .88, S * .004);
    // title
    bigTitle(ctx, ["SMAC"], S * .06, S * .82, S * .88, S * .24, PAPER, violet);
    const sub = splitTitle(title)[1] || "Diffuser & aides à la création";
    const { lines, px } = wrapFit(ctx, sub.toUpperCase(), { family: "displayBold", weight: 800, maxW: S * .88, maxPx: S * .05, minPx: S * .03, maxLines: 2, track: 0 });
    lines.forEach((l, i) => put(ctx, l, S * .06, S * .885 + i * px * 1.25, { family: "displayBold", weight: 800, px, color: SUN }));
    return "DATAVIZ · BORDEAUX";
  },

  "jugar-si-quieres"(ctx, S, t, title) {
    const [yellow, red, navy] = t;
    ctx.fillStyle = navy; ctx.fillRect(0, 0, S, S);
    dotGrid(ctx, 0, 0, S, S, S * .04, S * .004, PAPER, .12);
    const stripes = [CORAL, ORANGE, SUN, MINT, CYAN, VIOLET];
    ctx.save(); ctx.translate(S * .5, S * .38); ctx.rotate(-.3);
    const sh = S * .085;
    stripes.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-S * .8, -sh * 3 + i * sh, S * 1.6, sh); });
    ctx.fillStyle = rgba(navy, .4);
    ctx.fillRect(-S * .8, sh * 3 + S * .01, S * 1.6, S * .012);
    ctx.restore();
    // football
    const bx = S * .5, by = S * .38, br = S * .18;
    circlePath(ctx, bx + S * .018, by + S * .02, br); ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fill();
    circlePath(ctx, bx, by, br); ctx.fillStyle = PAPER; ctx.fill();
    ctx.save(); circlePath(ctx, bx, by, br); ctx.clip();
    const poly = (cx, cy, r, rot) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); };
    ctx.strokeStyle = navy; ctx.lineWidth = br * .035; ctx.lineJoin = "round";
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * br * .28, by + Math.sin(a) * br * .28); ctx.lineTo(bx + Math.cos(a) * br * .62, by + Math.sin(a) * br * .62); ctx.stroke();
      const b2 = a + TAU / 10;
      ctx.fillStyle = navy; poly(bx + Math.cos(b2) * br * 1.02, by + Math.sin(b2) * br * 1.02, br * .3, b2 + Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * br * .62, by + Math.sin(a) * br * .62); ctx.lineTo(bx + Math.cos(b2 - TAU / 20) * br * .8, by + Math.sin(b2 - TAU / 20) * br * .8); ctx.moveTo(bx + Math.cos(a) * br * .62, by + Math.sin(a) * br * .62); ctx.lineTo(bx + Math.cos(b2 + TAU / 20 - TAU / 5) * br * .8, by + Math.sin(b2 + TAU / 20 - TAU / 5) * br * .8); ctx.stroke();
    }
    ctx.fillStyle = navy; poly(bx, by, br * .3, -Math.PI / 2); ctx.fill();
    const shine = ctx.createRadialGradient(bx - br * .35, by - br * .4, br * .1, bx, by, br * 1.05); shine.addColorStop(0, "rgba(255,255,255,0)"); shine.addColorStop(1, "rgba(18,22,60,.28)");
    ctx.fillStyle = shine; ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    ctx.restore();
    circlePath(ctx, bx, by, br); ctx.lineWidth = S * .009; ctx.strokeStyle = navy; ctx.stroke();
    sparkle(ctx, S * .14, S * .2, S * .03, SUN); sparkle(ctx, S * .92, S * .56, S * .03, PAPER);
    // title (the hashtag, broken into two big lines)
    const words = splitTitle(title)[0].replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
    const { lines, px } = wrapFit(ctx, words, { maxW: S * .88, maxPx: S * .15, minPx: S * .06, maxLines: 2, track: -.01 });
    const lead = px * 1.02;
    lines.forEach((l, i) => put(ctx, l, S * .06, S * .875 - (lines.length - 1 - i) * lead, { family: "display", weight: 900, px, color: i ? yellow : PAPER, track: -.01, shadow: { color: red, dx: px * .05, dy: px * .05 } }));
    chip(ctx, S * .06, S * .91, "SPORT SANS DISCRIMINATION", { bg: PAPER, fg: navy, px: S * .025 });
    return "CAMPAGNE · MUSIQUE";
  },

  "swim-sync"(ctx, S, t) {
    const [cyan, mint, deep] = t;
    ctx.fillStyle = deep; ctx.fillRect(0, 0, S, S);
    const lanes = 7, top = S * .1, laneH = S * .082, x0 = S * .05, w = S * .9;
    fillRR(ctx, x0 - S * .012, top - S * .012, w + S * .024, lanes * laneH + S * .024, S * .02, shadeHex(deep, .12));
    const rand = rng(21);
    for (let i = 0; i < lanes; i++) {
      const y = top + i * laneH;
      const g = ctx.createLinearGradient(0, y, 0, y + laneH);
      g.addColorStop(0, mixHex(cyan, "#ffffff", .1)); g.addColorStop(1, shadeHex(cyan, -.12));
      ctx.fillStyle = g; ctx.fillRect(x0, y, w, laneH - S * .004);
      ctx.fillStyle = rgba(PAPER, .13);
      for (let k = 0; k < 10; k++) ctx.fillRect(x0 + rand() * w, y + rand() * laneH * .85, rand() * S * .09 + S * .02, S * .0035);
      // lane rope beads
      for (let x = x0 + S * .01; x < x0 + w; x += S * .022) { ctx.fillStyle = Math.floor((x - x0) / (S * .022)) % 2 ? CORAL : PAPER; ctx.beginPath(); ctx.arc(x, y + laneH - S * .004, S * .006, 0, TAU); ctx.fill(); }
      // swimmer = occupancy
      const prog = .12 + rand() * .7, sx = x0 + w * prog * .88, sy = y + laneH * .46;
      const wake = ctx.createLinearGradient(sx - S * .22, 0, sx, 0); wake.addColorStop(0, rgba(PAPER, 0)); wake.addColorStop(1, rgba(PAPER, .6));
      ctx.fillStyle = wake; ctx.fillRect(sx - S * .22, sy - S * .005, S * .22, S * .01);
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(sx, sy, S * .02, S * .012, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = deep; ctx.beginPath(); ctx.arc(sx + S * .016, sy, S * .007, 0, TAU); ctx.fill();
      put(ctx, `L${i + 1} · ${String(Math.round(prog * 100)).padStart(2, "0")}%`, x0 + w - S * .012, y + laneH * .54, { family: "mono", weight: 700, px: S * .0185, color: deep, align: "right", base: "middle", track: .04 });
    }
    // lane end wall
    ctx.fillStyle = mint; ctx.fillRect(x0, top - S * .006, w, S * .006);
    bigTitle(ctx, ["SWIM SYNC"], S * .06, S * .875, S * .88, S * .17, mint, mixHex(deep, cyan, .3));
    chip(ctx, S * .06, S * .905, "LA PISCINE INTERACTIVE", { bg: PAPER, fg: deep, px: S * .027 });
    return "HACKATHON POCL 2025";
  },

  expodata(ctx, S, t) {
    const [sky, sun, ink] = t;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S * .62);
    lineGrid(ctx, 0, 0, S, S * .62, S * .05, S * .0025, PAPER, .5);
    // spotlight cones
    for (const [x, c] of [[.2, sun], [.5, CORAL], [.8, VIOLET]]) {
      const g = ctx.createLinearGradient(0, 0, 0, S * .6); g.addColorStop(0, rgba(c, .32)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(S * (x - .02), 0); ctx.lineTo(S * (x + .02), 0); ctx.lineTo(S * (x + .17), S * .6); ctx.lineTo(S * (x - .17), S * .6); ctx.closePath(); ctx.fill();
    }
    const rand = rng(33);
    const frames = [[.07, .1, .28, .34, SUN], [.4, .08, .2, .24, CORAL], [.65, .1, .28, .34, VIOLET], [.09, .5, .17, .1, MINT], [.33, .4, .34, .17, PAPER], [.72, .5, .2, .1, CYAN]];
    frames.forEach(([x, y, w, h, c], i) => {
      card(ctx, S * x, S * y, S * w, S * h, S * .008, PAPER, { line: ink, lw: S * .0065, off: S * .008, shadow: ink });
      const ix = S * x + S * w * .1, iy = S * y + S * h * .12, iw = S * w * .8, ih = S * h * .76;
      ctx.fillStyle = c === PAPER ? CORAL : c;
      if (i % 3 === 0) { for (let k = 0; k < 6; k++) { const bh = ih * (.25 + rand() * .7); ctx.fillRect(ix + iw * k * .17, iy + ih - bh, iw * .12, bh); } }
      else if (i % 3 === 1) { ctx.beginPath(); ctx.moveTo(S * (x + w / 2), S * (y + h / 2)); ctx.arc(S * (x + w / 2), S * (y + h / 2), Math.min(iw, ih) * .5, 0, TAU * .72); ctx.closePath(); ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(S * (x + w / 2), S * (y + h / 2)); ctx.arc(S * (x + w / 2), S * (y + h / 2), Math.min(iw, ih) * .5, TAU * .72, TAU); ctx.closePath(); ctx.fill(); }
      else { ctx.strokeStyle = c === PAPER ? ink : c; ctx.lineWidth = S * .009; ctx.lineJoin = "round"; ctx.beginPath(); for (let k = 0; k <= 7; k++) { const px = ix + iw * k / 7, py = iy + ih * (.85 - rand() * .65); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    });
    ctx.fillStyle = ink; ctx.fillRect(0, S * .66, S, S * .34);
    ctx.fillStyle = sun; ctx.fillRect(0, S * .66, S, S * .012);
    bigTitle(ctx, ["EXPODATA"], S * .06, S * .83, S * .88, S * .17, PAPER, VIOLET);
    chip(ctx, S * .06, S * .855, "2025", { bg: sun, fg: ink, px: S * .04, family: "display", weight: 900 });
    put(ctx, "DATAVISUALISATION & INCLUSIVITÉ NUMÉRIQUE", S * .06, S * .955, { family: "mono", weight: 700, px: S * .022, color: sun, track: .06, max: S * .88 });
    return "EXPOSITION · BUT INFO-COM";
  },

  "portfolio-v1"(ctx, S, t) {
    const [red, sun, ink] = t;
    ctx.fillStyle = red; ctx.fillRect(0, 0, S, S);
    dotGrid(ctx, 0, 0, S, S, S * .04, S * .004, ink, .18);
    bigTitle(ctx, ["SOPP"], S * .06, S * .3, S * .88, S * .3, ink, PAPER);
    // a code window showing the v1 stack
    const wx = S * .06, wy = S * .38, ww = S * .88, wh = S * .43;
    card(ctx, wx, wy, ww, wh, S * .025, PAPER, { line: ink, lw: S * .007, off: S * .016, shadow: ink });
    ctx.save(); roundRectPath(ctx, wx, wy, ww, wh, S * .025); ctx.clip();
    ctx.fillStyle = ink; ctx.fillRect(wx, wy, ww, S * .06);
    ctx.restore();
    [CORAL, SUN, MINT].forEach((c, i) => { circlePath(ctx, wx + S * .04 + i * S * .035, wy + S * .03, S * .01); ctx.fillStyle = c; ctx.fill(); });
    put(ctx, "portfolio-v1/index.html", wx + ww - S * .03, wy + S * .031, { family: "mono", weight: 500, px: S * .021, color: rgba(PAPER, .8), align: "right", base: "middle" });
    const code = [
      [["<", red], ["html", ink], [" lang", VIOLET], ["=", ink], ["\"fr\"", "#16A874"], [">", red]],
      [["  /* ", "#8B8FA8"], ["HTML / CSS / JS", ink], [" */", "#8B8FA8"]],
      [["  DA", VIOLET], [" = ", ink], ["\"rouge & noir\"", "#16A874"], [";", ink]],
      [["  langues", VIOLET], [" = ", ink], ["[", ink], ["\"fr\"", "#16A874"], [", ", ink], ["\"en\"", "#16A874"], ["]", ink], [";", ink]],
      [["  pages", VIOLET], [" = ", ink], ["[", ink], ["travaux", CORAL], [", ", ink], ["à propos", CORAL], [", ", ink], ["contact", CORAL], ["]", ink]]
    ];
    const cpx = S * .03;
    code.forEach((row, r) => {
      let x = wx + S * .035; const y = wy + S * .125 + r * S * .063;
      put(ctx, String(r + 1), wx + S * .025, y, { family: "mono", weight: 500, px: cpx * .8, color: rgba(INK, .35), align: "right" });
      row.forEach(([txt, col]) => { put(ctx, txt, x + S * .02, y, { family: "mono", weight: 700, px: cpx, color: col }); x += measure(ctx, txt, "mono", 700, cpx); });
    });
    chip(ctx, S * .06, S * .87, "PORTFOLIO — VERSION 1", { bg: ink, fg: sun, px: S * .03 });
    put(ctx, "BILINGUE FR / EN", S * .94, S * .915, { family: "mono", weight: 700, px: S * .022, color: ink, align: "right", track: .08 });
    sparkle(ctx, S * .93, S * .335, S * .025, sun);
    return "V1 · ARCHIVE";
  }
};

function genericCover(ctx, S, t, title) {
  const [a, b, c] = t;
  ctx.fillStyle = a; ctx.fillRect(0, 0, S, S);
  dotGrid(ctx, 0, 0, S, S, S * .04, S * .004, c, .2);
  circlePath(ctx, S * .68, S * .36, S * .26); ctx.fillStyle = b; ctx.fill();
  circlePath(ctx, S * .68, S * .36, S * .26); ctx.lineWidth = S * .008; ctx.strokeStyle = c; ctx.stroke();
  ctx.fillStyle = c; ctx.fillRect(0, S * .62, S, S * .38);
  const { lines, px } = wrapFit(ctx, splitTitle(title)[0].toUpperCase(), { maxW: S * .88, maxPx: S * .12, minPx: S * .05, maxLines: 3, track: -.01 });
  lines.forEach((l, i) => put(ctx, l, S * .06, S * .72 + i * px * 1.02, { family: "display", weight: 900, px, color: i % 2 ? b : PAPER, base: "top", track: -.01 }));
  return "";
}

function coverChrome(ctx, S, index, tag, theme) {
  const pad = S * .04, px = S * .0205;
  chip(ctx, pad, pad, `SIDE A · ${String(index + 1).padStart(3, "0")}`, { bg: INK, fg: PAPER, px, track: .1, border: rgba(PAPER, .6), lw: S * .0026 });
  if (tag) chip(ctx, S - pad, pad, tag, { bg: PAPER, fg: INK, px, align: "right", border: INK, lw: S * .0028, track: .08 });
  void theme;
}

export function drawProjectCover(project, index, size = 1024) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const theme = projectTheme(project);
  const painter = COVER[project.id];
  const title = project.title?.fr || project.id;
  ctx.textBaseline = "alphabetic";
  const tag = painter ? painter(ctx, size, theme, title) : genericCover(ctx, size, theme, title);
  coverChrome(ctx, size, index, tag, theme);
  addGrain(canvas, .02, index + 3);
  return applyWear(canvas, index * 13 + 5, 1);
}

// ---------------------------------------------------------------------------------------------
// LINER NOTES (back) and INNER SPREAD (inside) — language aware, auto-fitting
// ---------------------------------------------------------------------------------------------
const LABELS = {
  fr: { summary: "RÉSUMÉ", context: "CONTEXTE", challenge: "PROBLÉMATIQUE", role: "MON RÔLE", skills: "COMPÉTENCES", outcome: "RÉSULTAT", work: "TRAVAIL RÉALISÉ", team: "AVEC", tracklist: "TRACKLIST", credits: "CRÉDITS", notes: "LINER NOTES", prov: "VISUEL PROVISOIRE", flip: "SIDE B", yearTbc: "ANNÉE À CONFIRMER" },
  en: { summary: "SUMMARY", context: "CONTEXT", challenge: "CHALLENGE", role: "MY ROLE", skills: "SKILLS", outcome: "OUTCOME", work: "WHAT I DID", team: "WITH", tracklist: "TRACKLIST", credits: "CREDITS", notes: "LINER NOTES", prov: "PROVISIONAL ARTWORK", flip: "SIDE B", yearTbc: "YEAR TO CONFIRM" }
};
const BODY = "#1D2140";

// section label: coloured square bullet + tracked mono caps
function sectionLabel(ctx, text, x, y, S, color) {
  fillRR(ctx, x, y - 13 * S, 14 * S, 14 * S, 3 * S, color, INK, 2 * S);
  put(ctx, text, x + 26 * S, y, { family: "mono", weight: 700, px: 15 * S, color: INK, track: .16 });
}

function skillChips(ctx, skills, left, width, S, { bg = INK, fg = PAPER, px = 17, rowH = 38, gap = 10, dry = false } = {}) {
  ctx.font = fontStr("ui", 600, px * S);
  const rows = [[]];
  let x = 0;
  for (const skill of skills) {
    const w = ctx.measureText(skill).width + px * 1.5 * S;
    if (x + w > width && rows[rows.length - 1].length) { rows.push([]); x = 0; }
    rows[rows.length - 1].push({ skill, w, x });
    x += w + gap * S;
  }
  if (dry) return rows.length * rowH * S;
  return (top) => {
    rows.forEach((row, r) => row.forEach(({ skill, w, x: dx }, i) => {
      const y = top + r * rowH * S;
      fillRR(ctx, left + dx, y, w, (rowH - 8) * S, (rowH - 8) * S / 2, i % 2 ? bg : bg);
      put(ctx, skill, left + dx + w / 2, y + (rowH - 8) * S / 2 + px * S * .02, { family: "ui", weight: 600, px: px * S, color: fg, align: "center", base: "middle" });
    }));
    return rows.length * rowH * S;
  };
}

function backdrop(ctx, size, S, main, dark, accent) {
  ctx.fillStyle = main; ctx.fillRect(0, 0, size, size);
  diagStripes(ctx, 0, 0, size, size, 64 * S, 24 * S, shadeHex(main, -.09), -.62);
  halftone(ctx, size * .55, size * .55, size * .45, size * .45, (u, v) => Math.max(0, (u + v - 1) * .9), { spacing: 18 * S, color: rgba(dark, .35), angle: .5 });
  void accent;
}

export function drawProjectBack(project, lang = "fr", index = 0, size = 1024) {
  const L = LABELS[lang] || LABELS.fr;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const [c0, c1, c2] = projectTheme(project);
  const S = size / 1024;
  backdrop(ctx, size, S, c0, c2, c1);
  // the card
  const cx = 26 * S, cy = 26 * S, cw = size - 52 * S, ch = size - 52 * S;
  card(ctx, cx, cy, cw, ch, 30 * S, "#FFFBF0", { line: INK, lw: 3.5 * S, off: 12 * S, shadow: rgba(INK, .28) });
  ctx.save();
  roundRectPath(ctx, cx, cy, cw, ch, 30 * S); ctx.clip();
  // header
  const [main, sub] = splitTitle(pick(project.title, lang));
  const left = 62 * S, width = size - 124 * S;
  const fit = wrapFit(ctx, main.toUpperCase(), { maxW: width - 20 * S, maxPx: 64 * S, minPx: 26 * S, maxLines: 2, track: -.01 });
  const headH = 58 * S + fit.lines.length * fit.px * 1.08 + (sub ? 44 * S : 14 * S) + 30 * S;
  ctx.fillStyle = c2; ctx.fillRect(cx, cy, cw, headH);
  halftone(ctx, cx + cw * .62, cy, cw * .38, headH, (u, v) => Math.max(0, u * .9 - v * .15 - .15), { spacing: 14 * S, color: rgba(c0, .55), angle: .6 });
  ctx.fillStyle = c1; ctx.fillRect(cx, cy + headH, cw, 8 * S);
  ctx.fillStyle = c0; ctx.fillRect(cx, cy + headH, cw * .32, 8 * S);
  const year = project.year ? String(project.year) : L.yearTbc;
  put(ctx, `${L.flip} · ${L.notes} · ${year}`, left, cy + 42 * S, { family: "mono", weight: 700, px: 16 * S, color: c1, track: .14 });
  fit.lines.forEach((l, i) => put(ctx, l, left, cy + 58 * S + fit.px * 1.0 + i * fit.px * 1.08, { family: "display", weight: 900, px: fit.px, color: PAPER, track: -.01 }));
  if (sub) put(ctx, sub, left, cy + headH - 22 * S, { family: "ui", weight: 600, px: 25 * S, color: mixHex(c1, "#ffffff", .35), max: width });

  const sections = [
    [L.summary, pick(project.short, lang)], [L.context, pick(project.context, lang)], [L.challenge, pick(project.challenge, lang)],
    [L.role, pick(project.role, lang)], [L.outcome, pick(project.outcome, lang)]
  ].filter(([, text]) => text);

  const skills = (lang === "en" ? project.skillsEn : project.skills) || project.skills || [];
  const skillsH = skills.length ? skillChips(ctx, skills, left, width, S, { dry: true }) + 8 * S : 0;
  const footH = 58 * S;
  const top = cy + headH + 40 * S, bottom = cy + ch - footH - skillsH - 18 * S;
  const avail = bottom - top;
  const caps = sections.map(() => 99);
  const lineCount = (text, px) => { ctx.font = fontStr("ui", 500, px); return paragraphHeight(ctx, text, width, 1); };
  const used = (px) => sections.reduce((sum, [, text], i) => sum + 30 * S + px * .95 + Math.min(caps[i], lineCount(text, px)) * px * 1.38 + 16 * S, 0) - px * 1.1;
  let body = 26 * S;
  while (body > 15 * S && used(body) > avail) body -= .5 * S;
  while (used(body) > avail) { // still too long at the minimum size: trim the longest section
    let k = -1, most = 2;
    sections.forEach(([, text], i) => { const n = Math.min(caps[i], lineCount(text, body)); if (n > most) { most = n; k = i; } });
    if (k < 0) break;
    caps[k] = most - 1;
  }
  let y = top;
  sections.forEach(([heading, text], i) => {
    sectionLabel(ctx, heading, left, y + 6 * S, S, c0);
    ctx.fillStyle = BODY; ctx.font = fontStr("ui", 500, body); ctx.textBaseline = "alphabetic";
    y = paragraph(ctx, text, left, y + 30 * S + body * .95, width, body * 1.38, caps[i]) + 16 * S;
  });
  if (skills.length) skillChips(ctx, skills, left, width, S)(cy + ch - footH - skillsH);
  // footer: barcode + catalogue line
  const fy = cy + ch - footH;
  ctx.fillStyle = INK; ctx.fillRect(cx, fy, cw, 2.5 * S);
  barcode(ctx, left + width - 190 * S, fy + 14 * S, 190 * S, 30 * S, INK, index + 4);
  put(ctx, `SIDE A RECORDS · CAT. ${String(index + 1).padStart(3, "0")}`, left, fy + 24 * S, { family: "mono", weight: 700, px: 14 * S, color: INK, track: .1 });
  if (project.visualStatus === "provisional") put(ctx, L.prov, left, fy + 44 * S, { family: "mono", weight: 500, px: 12 * S, color: rgba(INK, .62), track: .1 });
  ctx.restore();
  addGrain(canvas, .014, index + 31);
  return applyWear(canvas, index * 7 + 2, .6);
}

// 2048 x 1024 spread: left half = inside of the front cover, right half = inside of the back.
export function drawProjectInner(project, lang = "fr", index = 0, size = 1024) {
  const L = LABELS[lang] || LABELS.fr;
  const canvas = createCanvas(size * 2, size);
  const ctx = canvas.getContext("2d");
  const [c0, c1, c2] = projectTheme(project);
  const S = size / 1024;

  // LEFT: tracklist on the colour field
  ctx.fillStyle = c2; ctx.fillRect(0, 0, size, size);
  dotGrid(ctx, 0, 0, size, size, 34 * S, 2.2 * S, PAPER, .08);
  ctx.fillStyle = c0; ctx.fillRect(0, 0, size, 14 * S);
  ctx.fillStyle = c1; ctx.fillRect(0, 14 * S, size * .24, 6 * S);
  const [main, sub] = splitTitle(pick(project.title, lang));
  const tfit = wrapFit(ctx, main.toUpperCase(), { maxW: size - 112 * S, maxPx: 54 * S, minPx: 24 * S, maxLines: 2, track: -.01 });
  tfit.lines.forEach((l, i) => put(ctx, l, 56 * S, 96 * S + i * tfit.px * 1.08, { family: "display", weight: 900, px: tfit.px, color: PAPER, track: -.01 }));
  let ty = 96 * S + (tfit.lines.length - 1) * tfit.px * 1.08;
  if (sub) { ty += 34 * S; put(ctx, sub, 56 * S, ty, { family: "ui", weight: 600, px: 22 * S, color: mixHex(c1, "#ffffff", .3), max: size - 112 * S }); }
  ty += 52 * S;
  chip(ctx, 56 * S, ty - 18 * S, L.tracklist, { bg: c1, fg: c2, px: 15 * S, track: .16 });
  const work = (project.work && (project.work[lang] || project.work.fr)) || [];
  // oversized ghost number + halftone orb fill the lower part of the panel
  put(ctx, String(index + 1).padStart(2, "0"), size - 20 * S, size - 10 * S, { family: "display", weight: 900, px: 380 * S, color: rgba(c0, .12), align: "right", track: -.04 });
  halftone(ctx, 0, size * .62, size * .5, size * .38, (u, v) => Math.max(0, 1 - Math.hypot(u - .1, v - .95) * 1.6), { spacing: 16 * S, color: rgba(c1, .35), angle: .5 });
  let body = 34 * S;
  const textX = 150 * S, textW = size - 206 * S, y0 = ty + 48 * S;
  const need = (px) => { ctx.font = fontStr("ui", 500, px); return work.reduce((s, t) => s + paragraphHeight(ctx, t, textW, px * 1.36) + 34 * S, 0); };
  while (body > 16 * S && need(body) > size - y0 - 70 * S) body -= .5 * S;
  let y = y0;
  work.forEach((item, i) => {
    fillRR(ctx, 56 * S, y - 4 * S, 74 * S, 40 * S, 12 * S, c0, null);
    put(ctx, `A${i + 1}`, 56 * S + 37 * S, y + 16 * S, { family: "mono", weight: 700, px: 21 * S, color: onColor(c0, PAPER, c2), align: "center", base: "middle", track: .04 });
    ctx.fillStyle = PAPER; ctx.font = fontStr("ui", 500, body); ctx.textBaseline = "alphabetic";
    y = paragraph(ctx, item, textX, y + body * .8, textW, body * 1.36) + 34 * S;
  });

  // RIGHT: credits, collaborators, skills, outcome (panel starts at x = size)
  ctx.fillStyle = "#FFFBF0"; ctx.fillRect(size, 0, size, size);
  ctx.fillStyle = c0; ctx.fillRect(size, 0, size, 14 * S);
  diagStripes(ctx, size, size - 90 * S, size, 90 * S, 40 * S, 14 * S, rgba(c0, .22), -.62);
  const rx = size + 56 * S, rw = size - 112 * S;
  sectionLabel(ctx, L.credits, rx, 70 * S, S, c0);
  ctx.fillStyle = INK; ctx.font = fontStr("ui", 700, 36 * S);
  let ry = paragraph(ctx, pick(project.role, lang), rx, 132 * S, rw, 50 * S, 5) + 30 * S;
  const collaborators = project.collaborators || [];
  if (collaborators.length) {
    sectionLabel(ctx, L.team, rx, ry + 8 * S, S, c1);
    ctx.fillStyle = BODY; ctx.font = fontStr("ui", 500, 30 * S);
    ry = paragraph(ctx, collaborators.join("  ·  "), rx, ry + 56 * S, rw, 40 * S) + 28 * S;
  }
  const skills = (lang === "en" ? project.skillsEn : project.skills) || project.skills || [];
  if (skills.length) {
    sectionLabel(ctx, L.skills, rx, ry + 8 * S, S, c0);
    ry += 30 * S + skillChips(ctx, skills, rx, rw, S, { px: 20, rowH: 46, gap: 12 })(ry + 30 * S) + 20 * S;
  }
  const outcome = pick(project.outcome, lang);
  if (outcome) {
    ctx.font = fontStr("ui", 600, 31 * S);
    const room = size - 110 * S - ry, lh = 44 * S;
    const textH = paragraphHeight(ctx, outcome, rw - 64 * S, lh);
    const oh = Math.min(room, 112 * S + textH);
    if (oh > 150 * S) {
      ry = Math.max(ry, size - 118 * S - oh); // anchor the result card to the foot of the page
      fillRR(ctx, rx + 10 * S, ry + 10 * S, rw, oh, 22 * S, rgba(INK, .85));
      fillRR(ctx, rx, ry, rw, oh, 22 * S, c2, INK, 3 * S);
      put(ctx, L.outcome, rx + 32 * S, ry + 48 * S, { family: "mono", weight: 700, px: 16 * S, color: c1, track: .16 });
      put(ctx, "“", rx + rw - 28 * S, ry + 104 * S, { family: "display", weight: 900, px: 120 * S, color: rgba(c0, .85), align: "right" });
      ctx.fillStyle = PAPER; ctx.font = fontStr("ui", 600, 31 * S); ctx.textBaseline = "alphabetic";
      paragraph(ctx, outcome, rx + 32 * S, ry + 100 * S, rw - 64 * S, lh, Math.max(2, Math.floor((oh - 110 * S) / lh)));
    }
  }
  put(ctx, "SIDE A RECORDS · ADAM SOPPELSA — PROJECTS STORE", rx, size - 26 * S, { family: "mono", weight: 700, px: 13 * S, color: rgba(INK, .55), track: .1 });
  // fold shading across the spine
  const g = ctx.createLinearGradient(0, 0, size * 2, 0);
  g.addColorStop(0, "rgba(0,0,0,.08)"); g.addColorStop(.46, "rgba(0,0,0,0)"); g.addColorStop(.5, "rgba(0,0,0,.26)"); g.addColorStop(.54, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.08)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size * 2, size);
  addGrain(canvas, .014, index + 71);
  return canvas;
}

// ---------------------------------------------------------------------------------------------
// DECORATIVE COVERS — fictional bands (clearly decoration, not deliverables)
// ---------------------------------------------------------------------------------------------
export const DECOR_BANDS = [
  ["THE LOW TIDES", "Salt & Static"], ["NEON PARASOL", "Midnight Arcade"], ["MAISON DUCRET", "Lundi Bleu"], ["SUNDAY CHOIR", "Quiet Machines"],
  ["PLASTIC HEARTS", "No Signal"], ["KOMETA 9", "Orbit Tapes"], ["LES VOISINS", "Étage 4"], ["BLUE GRAVEL", "Dust Roads"],
  ["TOKYO PICNIC", "Soft Reset"], ["OLD TV GHOST", "Channel Zero"], ["SALON ROUGE", "Velours"], ["DELTA ROOM", "Night Shift"],
  ["PAPER ANIMALS", "Field Notes"], ["VHS CHURCH", "Tracking Error"], ["MIDI MOTEL", "Sunset Fees"], ["GREEN LINE", "Last Metro"]
];
// [field, shape, accent] — three tokens per cover, never more
const DECOR_PALETTES = [
  [SUN, INK, CORAL], [CYAN, INK, PAPER], [CORAL, PAPER, INK], [VIOLET, SUN, PAPER],
  [MINT, INK, VIOLET], [PAPER, CORAL, INK], [INK, CYAN, SUN], [SKY, VIOLET, PAPER],
  [SUN, VIOLET, INK], [CORAL, INK, SUN], [CYAN, CORAL, PAPER], [INK, SUN, CORAL],
  [MINT, CORAL, INK], [VIOLET, CYAN, INK], [PAPER, VIOLET, SUN], [SKY, CORAL, INK]
];

function decorCover(ctx, S, i, seed) {
  const rand = rng(seed);
  const [a, b, c] = DECOR_PALETTES[i % DECOR_PALETTES.length];
  const [band, album] = DECOR_BANDS[i % DECOR_BANDS.length];
  const style = i % 8;
  const bandH = S * .24;                       // label strip at the bottom
  const art = S - bandH;
  ctx.fillStyle = a; ctx.fillRect(0, 0, S, S);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S, art); ctx.clip();
  if (style === 0) { // bullseye
    for (let k = 7; k > 0; k--) { ctx.fillStyle = k % 2 ? b : (k % 4 === 0 ? c : a); circlePath(ctx, S * .5, art * .5, S * k * .058); ctx.fill(); }
    circlePath(ctx, S * .5, art * .5, S * .055); ctx.fillStyle = c; ctx.fill();
  } else if (style === 1) { // halftone orb
    halftone(ctx, 0, 0, S, art, (u, v) => { const d = Math.hypot(u - .5, (v - .5) * (art / S) * 1.9) * 2.1; return d > 1 ? 0 : Math.max(.1, 1 - d * .8 - (u - .5) * .25 + (v - .5) * .3); }, { spacing: S * .026, color: b, angle: .55 });
    circlePath(ctx, S * .78, art * .2, S * .09); ctx.fillStyle = c; ctx.fill();
  } else if (style === 2) { // bauhaus blocks
    ctx.fillStyle = b; ctx.fillRect(S * .08, art * .1, S * .42, art * .8);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(S * .5, art * .1, S * .3, 0, Math.PI); ctx.fill();
    ctx.fillStyle = PAPER; circlePath(ctx, S * .72, art * .66, S * .17); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(S * .55, art * .95); ctx.lineTo(S * .95, art * .95); ctx.lineTo(S * .95, art * .5); ctx.closePath(); ctx.fill();
  } else if (style === 3) { // sunset stripes
    ctx.fillStyle = b; circlePath(ctx, S * .5, art * .46, S * .3); ctx.fill();
    ctx.fillStyle = a;
    for (let k = 0; k < 6; k++) ctx.fillRect(S * .15, art * (.5 + k * .07), S * .7, art * (.008 + k * .0075));
    ctx.fillStyle = c; ctx.fillRect(0, art * .88, S, art * .12);
  } else if (style === 4) { // horizon grid
    const g = ctx.createLinearGradient(0, 0, 0, art * .62); g.addColorStop(0, b); g.addColorStop(1, c); ctx.fillStyle = g; ctx.fillRect(0, 0, S, art * .62);
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(S * .5, art * .62, S * .2, Math.PI, 0); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(0, art * .62, S, art * .38);
    ctx.strokeStyle = rgba(c === INK ? PAPER : c, .9); ctx.lineWidth = S * .005;
    for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(S * .5 + k * S * .02, art * .62); ctx.lineTo(S * .5 + k * S * .17, art); ctx.stroke(); }
    for (let k = 1; k < 6; k++) { const y = art * (.62 + .38 * Math.pow(k / 6, 1.8)); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  } else if (style === 5) { // dot matrix wave
    for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) {
      const r = S * .034 * (.25 + .75 * Math.abs(Math.sin(gx * .7 + gy * .5 + rand() * .3)));
      ctx.fillStyle = (gx + gy) % 4 === 0 ? c : b; circlePath(ctx, S * (.1 + gx * .1), art * (.1 + gy * .1), r); ctx.fill();
    }
  } else if (style === 6) { // giant letter
    ctx.fillStyle = b; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    put(ctx, band[0], S * .5, art * 1.0, { family: "display", weight: 900, px: S * 1.0, color: b, align: "center" });
    circlePath(ctx, S * .8, art * .22, S * .08); ctx.fillStyle = c; ctx.fill();
  } else { // waves
    for (let k = 0; k < 9; k++) {
      ctx.strokeStyle = k % 3 === 2 ? c : b; ctx.lineWidth = S * .028; ctx.lineCap = "round"; ctx.beginPath();
      for (let x = 0; x <= S; x += 6) { const y = art * (.1 + k * .098) + Math.sin(x / S * 8 + k * .7) * S * .035; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.restore();
  // label strip
  const stripBg = lum(b) < .35 ? b : (lum(a) < .35 ? a : INK);
  const strip = style === 4 ? INK : stripBg === a ? INK : stripBg;
  ctx.fillStyle = strip; ctx.fillRect(0, art, S, bandH);
  ctx.fillStyle = c === strip ? SUN : c; ctx.fillRect(0, art, S, S * .012);
  const fg = onColor(strip);
  put(ctx, band, S * .06, art + bandH * .5, { family: "display", weight: 900, px: S * .13, color: fg, max: S * .88, minPx: S * .05, track: -.01, base: "alphabetic" });
  put(ctx, album.toUpperCase(), S * .06, art + bandH * .83, { family: "mono", weight: 700, px: S * .036, color: c === strip ? SUN : (lum(c) > .3 ? c : fg), track: .12, max: S * .88 });
  put(ctx, String(i + 1).padStart(2, "0"), S * .94, art + bandH * .83, { family: "mono", weight: 700, px: S * .036, color: rgba(fg, .6), align: "right", track: .06 });
}

// 4 x 4 atlas of fictional covers. Returns { canvas, cells, columns, rows }
export function drawDecorAtlas(cell = 512, columns = 4, rows = 4) {
  const canvas = createCanvas(cell * columns, cell * rows);
  const ctx = canvas.getContext("2d");
  const piece = createCanvas(cell);
  const pctx = piece.getContext("2d");
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c;
    pctx.clearRect(0, 0, cell, cell);
    decorCover(pctx, cell, i, 100 + i * 17);
    applyWear(piece, 40 + i, .55);
    ctx.drawImage(piece, c * cell, r * cell);
    cells.push({ index: i, u0: c / columns, v0: 1 - (r + 1) / rows, u1: (c + 1) / columns, v1: 1 - r / rows });
  }
  return { canvas, cells, columns, rows };
}

// ---------------------------------------------------------------------------------------------
// GIG POSTERS (fictional) — 4 x 2 atlas of 512 x 720 (drawn on a 512 x 720 logical grid, scaled to the cell)
// ---------------------------------------------------------------------------------------------
export const POSTER_DEFS = [
  { id: "basement", title: "LIVE AT THE BASEMENT", lines: ["THE LOW TIDES", "+ VHS CHURCH", "SAT 12.12 · 21:00"], c: [SUN, INK, CORAL], style: "xerox", layout: "stack" },
  { id: "nightshift", title: "NIGHT SHIFT", lines: ["DELTA ROOM", "FREE ENTRY BEFORE 22:00"], c: [INK, CORAL, SUN], style: "stripes", layout: "vertical" },
  { id: "garage", title: "GARAGE SALE", lines: ["VINYL · TAPES · ZINES", "SUN 12:00–18:00"], c: [PAPER, INK, CYAN], style: "blocks", layout: "stack" },
  { id: "winehouse", title: "WINEHOUSE", lines: ["LISTENING PARTY", "DÉCOR — FICTIONAL EVENT"], c: [VIOLET, SUN, PAPER], style: "sun", layout: "center" },
  { id: "static", title: "STATIC", lines: ["PLASTIC HEARTS", "NO SIGNAL TOUR"], c: [INK, CYAN, PAPER], style: "xerox", layout: "center" },
  { id: "sunday", title: "SUNDAY CHOIR", lines: ["QUIET MACHINES", "ONE NIGHT ONLY"], c: [MINT, INK, CORAL], style: "stripes", layout: "stack" },
  { id: "story", title: "STORY.", lines: ["SIDE PROJECT SESSION", "DÉCOR — FICTIONAL EVENT"], c: [CORAL, INK, SUN], style: "blocks", layout: "vertical" },
  { id: "kometa", title: "KOMETA 9", lines: ["ORBIT TAPES RELEASE", "DOORS 20:00"], c: [SKY, VIOLET, INK], style: "sun", layout: "vertical" }
];

function drawPoster(ctx, def, i, W, H) {
  const [bg, fg, accent] = def.c;
  const rand = rng(200 + i);
  const dark = lum(bg) < .4;
  const text = onColor(bg);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // --- artwork field
  if (def.style === "xerox") {
    halftone(ctx, 0, H * .1, W, H * .56, (u, v) => Math.max(0, .98 - Math.hypot(u - .5, (v - .48) * 1.15) * 1.75 + (rand() - .5) * .1), { spacing: 12, color: fg === bg ? accent : (dark ? accent : fg), angle: .8 });
    circlePath(ctx, W * .5, H * .36, W * .11); ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(0, H * .66, W, 10);
  } else if (def.style === "stripes") {
    diagStripes(ctx, 0, 0, W, H * .66, 44, 22, accent, -.5);
    diagStripes(ctx, 0, 0, W, H * .66, 44, 10, fg, -.5, .0);
    circlePath(ctx, W * .62, H * .3, W * .2); ctx.fillStyle = fg; ctx.fill();
    circlePath(ctx, W * .62, H * .3, W * .2); ctx.lineWidth = 6; ctx.strokeStyle = text; ctx.stroke();
  } else if (def.style === "blocks") {
    const cols = [fg, accent, PAPER, bg === PAPER ? SUN : bg];
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = cols[k % 4]; const w = rand.range(90, 210), h = rand.range(80, 190), x = 20 + rand() * (W - w - 60), y = H * .08 + rand() * (H * .48 - h);
      if (k % 3 === 1) { circlePath(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2); ctx.fill(); } else ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.strokeRect(10, H * .06, W - 20, H * .5);
  } else { // sun
    const sx = def.layout === "vertical" ? W * .38 : W * .5;
    for (let k = 6; k > 0; k--) { circlePath(ctx, sx, H * .31, W * (.07 + k * .048)); ctx.fillStyle = k % 2 ? accent : fg; ctx.fill(); }
    circlePath(ctx, sx, H * .31, W * .06); ctx.fillStyle = bg; ctx.fill();
  }

  // --- top bar
  ctx.fillStyle = fg === bg ? text : fg; ctx.fillRect(0, 0, W, 34);
  put(ctx, "SIDE A RECORDS PRESENTS", 18, 22, { family: "mono", weight: 700, px: 13, color: onColor(fg === bg ? text : fg), track: .14 });
  put(ctx, `NO. ${String(i + 1).padStart(2, "0")}/08`, W - 18, 22, { family: "mono", weight: 700, px: 13, color: accent === (fg === bg ? text : fg) ? SUN : accent, align: "right", track: .1 });

  // --- title
  const titleColor = def.style === "xerox" && !dark ? fg : text;
  if (def.layout === "vertical") {
    ctx.save(); ctx.translate(W - 34, H * .67); ctx.rotate(-Math.PI / 2);
    const px = fitPx(ctx, def.title, "display", 900, H * .6, 112, 30, -.02);
    put(ctx, def.title, 0, 0, { family: "display", weight: 900, px, color: titleColor, track: -.02, shadow: { color: accent, dx: px * .05, dy: px * .05 } });
    ctx.restore();
  } else if (def.layout === "center") {
    const { lines, px } = wrapFit(ctx, def.title, { maxW: W * .86, maxPx: 98, minPx: 34, maxLines: 2, track: -.02 });
    lines.forEach((l, k) => put(ctx, l, W / 2, H * .79 - (lines.length - 1 - k) * px * 1.0, { family: "display", weight: 900, px, color: titleColor, align: "center", track: -.02, shadow: { color: accent, dx: px * .05, dy: px * .05 } }));
  } else {
    const { lines, px } = wrapFit(ctx, def.title, { maxW: W * .88, maxPx: 112, minPx: 34, maxLines: 3, track: -.02 });
    lines.forEach((l, k) => put(ctx, l, 26, H * .795 - (lines.length - 1 - k) * px * .98, { family: "display", weight: 900, px, color: titleColor, track: -.02, shadow: { color: accent, dx: px * .05, dy: px * .05 } }));
  }

  // --- info block
  const centered = def.layout === "center";
  const ix = centered ? W / 2 : 26;
  def.lines.forEach((line, k) => {
    const emph = k === def.lines.length - 1;
    put(ctx, line, ix, H * .865 + k * 27, { family: emph ? "mono" : "ui", weight: emph ? 700 : 700, px: emph ? 20 : 22, color: emph ? (dark ? accent : fg) : text, align: centered ? "center" : "left", track: emph ? .06 : 0, max: W * (def.layout === "vertical" ? .64 : .62) });
  });
  if (!centered) barcode(ctx, W - 130, H - 76, 104, 40, text, 20 + i);
  put(ctx, "TICKETS ON THE DOOR", centered ? W / 2 : W - 26, H - 22, { family: "mono", weight: 700, px: 12, color: rgba(text, .75), align: centered ? "center" : "right", track: .14 });
  // print marks
  regMark(ctx, 20, H - 26, 8, rgba(text, .55), 1.5);
  ctx.fillStyle = accent; ctx.fillRect(0, H - 8, W, 8);
}

export function drawPosterAtlas(width = 512, height = 720, columns = 4, rows = 2) {
  const canvas = createCanvas(width * columns, height * rows);
  const ctx = canvas.getContext("2d");
  const cells = [];
  const k = width / 512, H = height / k;
  POSTER_DEFS.forEach((def, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    ctx.save();
    ctx.translate(col * width, row * height);
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    ctx.scale(k, k);
    drawPoster(ctx, def, i, 512, H);
    ctx.restore();
    cells.push({ id: def.id, index: i, u0: col / columns, v0: 1 - (row + 1) / rows, u1: (col + 1) / columns, v1: 1 - row / rows, def });
  });
  addGrain(canvas, .035, 44);
  return { canvas, cells, columns, rows, cellWidth: width, cellHeight: height };
}

// ---------------------------------------------------------------------------------------------
// STICKERS / PRICE TAGS — 4 x 4 atlas of 256 (opaque die-cut shapes on a transparent field: the shop material alpha-tests them)
// ---------------------------------------------------------------------------------------------
const STICKERS = [
  ["VINYL IS NOT DEAD", INK, SUN, "round"], ["SIDE A", PAPER, INK, "rect"], ["PLAY LOUD", CORAL, PAPER, "round"], ["GOOD VIBES ONLY", MINT, INK, "rect"],
  ["12 €", PAPER, INK, "tag"], ["8,50", SUN, INK, "tag"], ["15 €", PAPER, CORAL, "tag"], ["5 €", MINT, INK, "tag"],
  ["WINE\nHOUSE", VIOLET, PAPER, "round"], ["STORY.", INK, SUN, "rect"], ["SOLD OUT", CYAN, INK, "round"], ["SOPP24", CORAL, PAPER, "rect"],
  ["NEW ARRIVAL", PAPER, CORAL, "rect"], ["STAFF PICK", INK, PAPER, "round"], ["PROMO", VIOLET, PAPER, "rect"], ["LISTEN", SUN, INK, "round"]
];

export function drawStickerAtlas(cell = 256, columns = 4, rows = 4) {
  const canvas = createCanvas(cell * columns, cell * rows);
  const ctx = canvas.getContext("2d");
  const cells = [];
  const k = cell / 256;
  STICKERS.forEach(([text, bg, fg, shape], i) => {
    const col = i % columns, row = Math.floor(i / columns);
    ctx.save();
    ctx.translate(col * cell + cell / 2, row * cell + cell / 2);
    ctx.scale(k, k);
    ctx.rotate((((i * 37) % 11) - 5) * .012);
    const edge = lum(bg) > .6 ? INK : PAPER;
    if (shape === "round") {
      circlePath(ctx, 8, 8, 110); ctx.fillStyle = INK; ctx.fill();               // hard offset shadow
      circlePath(ctx, 0, 0, 110); ctx.fillStyle = PAPER; ctx.fill();              // die-cut border
      circlePath(ctx, 0, 0, 110); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      circlePath(ctx, 0, 0, 92); ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = "round"; circlePath(ctx, 0, 0, 80); ctx.stroke(); ctx.setLineDash([]);
    } else if (shape === "tag") {
      ctx.save(); ctx.translate(-4, 0);
      fillRR(ctx, -92 + 8, -60 + 8, 190, 120, 18, INK);
      fillRR(ctx, -92, -60, 190, 120, 18, bg, INK, 5);
      circlePath(ctx, -66, 0, 11); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    } else {
      fillRR(ctx, -112 + 8, -78 + 8, 224, 156, 24, INK);
      fillRR(ctx, -112, -78, 224, 156, 24, PAPER, INK, 5);
      fillRR(ctx, -98, -64, 196, 128, 16, bg);
      ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = "round"; roundRectPath(ctx, -88, -54, 176, 108, 10); ctx.stroke(); ctx.setLineDash([]);
    }
    if (shape === "tag") {
      const px = fitPx(ctx, text, "mono", 700, 120, 64, 28, -.02);
      put(ctx, text, 22, 3, { family: "mono", weight: 700, px, color: fg, align: "center", base: "middle", track: -.02 });
    } else {
      const maxW = shape === "round" ? 138 : 176, maxPx = shape === "round" ? 56 : 62, maxLines = shape === "round" ? 3 : 2;
      let lines, px;
      if (text.includes("\n")) { lines = text.split("\n"); px = Math.min(maxPx, ...lines.map((l) => fitPx(ctx, l, "display", 900, maxW, maxPx, 16, -.01))); }
      else {
        const one = wrapFit(ctx, text, { maxW, maxPx, minPx: 14, maxLines: 1, track: -.01 }), many = wrapFit(ctx, text, { maxW, maxPx, minPx: 14, maxLines, track: -.01 });
        ({ lines, px } = one.px >= many.px * .5 ? one : many);
      }
      const lead = px * 1.02;
      lines.forEach((l, n) => put(ctx, l, 0, (n - (lines.length - 1) / 2) * lead + px * .02, { family: "display", weight: 900, px, color: fg, align: "center", base: "middle", track: -.01 }));
    }
    void edge;
    ctx.restore();
    cells.push({ index: i, u0: col / columns, v0: 1 - (row + 1) / rows, u1: (col + 1) / columns, v1: 1 - row / rows, shape });
  });
  return { canvas, cells, columns, rows };
}

// ---------------------------------------------------------------------------------------------
// APPLICATION CASES — game-case box art, each app gets its own colourway and pattern
// ---------------------------------------------------------------------------------------------
const APP_THEMES = [
  [SUN, "#1A1636", "dots"], [MINT, "#0E2B2E", "grid"], [CORAL, "#2A1230", "arcs"], [SKY, "#101A3A", "lines"],
  [CYAN, "#0B2438", "dots"], [VIOLET, "#12162B", "grid"], [ORANGE, "#2B1420", "arcs"], ["#C4F25B", "#14261C", "lines"]
];
export function drawAppCase(app, index, lang = "fr", size = 512) {
  const [accent, dark, pattern] = APP_THEMES[index % APP_THEMES.length];
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const S = size / 512;
  const fg = onColor(accent), shade = fg === INK ? PAPER : INK;
  // bold colour field, like box art on a games shelf
  ctx.fillStyle = accent; ctx.fillRect(0, 0, size, size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, rgba(PAPER, .16)); g.addColorStop(.5, rgba(PAPER, 0)); g.addColorStop(1, rgba(dark, .22));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // pattern
  ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 2 * S;
  ctx.globalAlpha = .16;
  if (pattern === "dots") for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { ctx.beginPath(); ctx.arc((24 + x * 40) * S, (24 + y * 40) * S, (2.4 + ((x * y) % 4)) * S, 0, TAU); ctx.fill(); }
  if (pattern === "grid") for (let i = 0; i <= 13; i++) { ctx.beginPath(); ctx.moveTo(i * 40 * S, 0); ctx.lineTo(i * 40 * S, size); ctx.moveTo(0, i * 40 * S); ctx.lineTo(size, i * 40 * S); ctx.stroke(); }
  if (pattern === "arcs") for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.arc(size, 0, i * 60 * S, Math.PI * .5, Math.PI); ctx.stroke(); }
  if (pattern === "lines") for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(0, (i * 27 + 14) * S); ctx.lineTo(size * (.3 + ((i * 37) % 70) / 100), (i * 27 + 14) * S); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // hero initial, oversized and cropped
  put(ctx, (app.name || "?")[0].toUpperCase(), size * .98, size * .98, { family: "display", weight: 900, px: size * .82, color: dark, alpha: .2, align: "right" });
  // spine
  ctx.fillStyle = dark; ctx.fillRect(0, 0, 40 * S, size);
  ctx.save(); ctx.translate(26 * S, size - 22 * S); ctx.rotate(-Math.PI / 2);
  put(ctx, "SOPP AGENTS · WEB APP", 0, 0, { family: "mono", weight: 700, px: 15 * S, color: accent, track: .16 });
  ctx.restore();
  chip(ctx, size - 22 * S, 22 * S, "WEB APP", { bg: dark, fg: accent, px: 15 * S, align: "right", track: .12 });
  put(ctx, `${String(index + 1).padStart(2, "0")} / 08`, 64 * S, 40 * S, { family: "mono", weight: 700, px: 16 * S, color: dark, track: .12 });
  // title
  const name = String(app.name || "").toUpperCase();
  const { lines, px } = wrapFit(ctx, name, { maxW: size - 100 * S, maxPx: 70 * S, minPx: 22 * S, maxLines: 3, track: -.01 });
  const lead = px * 1.04, blockH = lines.length * lead;
  const startY = size * .54 - blockH / 2 + px * .9;
  lines.forEach((l, i) => put(ctx, l, 64 * S, startY + i * lead, { family: "display", weight: 900, px, color: fg, track: -.01, shadow: { color: shade === INK ? dark : PAPER, dx: px * .055, dy: px * .055 } }));
  // category
  const catText = pick(app.category, lang).toUpperCase();
  if (catText) chip(ctx, 64 * S, size - 70 * S, catText, { bg: dark, fg: PAPER, px: 16 * S, track: .1 });
  ctx.fillStyle = dark; ctx.fillRect(0, size - 12 * S, size, 12 * S);
  addGrain(canvas, .02, index + 4);
  return canvas;
}

// ---------------------------------------------------------------------------------------------
// SIGN BOARDS — modern plates (hard offset type shadow, tri-colour end caps, hairline frame, mono sub line)
// ---------------------------------------------------------------------------------------------
// v1 board colours are remapped onto the v2 tokens so every existing call site is re-skinned.
const LEGACY_COLORS = { "#24332d": INK, "#ecd9a8": PAPER, "#ead8b2": PAPER, "#e9cf8b": SUN, "#f1d9a0": PAPER, "#c9b07a": SUN, "#c9a050": SUN, "#3c2a1d": VIOLET, "#f1e7cf": PAPER, "#1f2a26": INK, "#c9a77a": SUN };
const modern = (hex) => (hex && LEGACY_COLORS[String(hex).toLowerCase()]) || hex;

function drawFascia(ctx, text, width, height, sub, bg, fg) {
  const W = width, H = height;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // tri-colour rails
  const rail = H * .045;
  [[CORAL, 0], [SUN, .34], [CYAN, .67]].forEach(([c, f]) => { ctx.fillStyle = c; ctx.fillRect(W * f, 0, W * .34, rail); ctx.fillRect(W * (1 - f - .34), H - rail, W * .34, rail); });
  dotGrid(ctx, 0, rail, W, H - rail * 2, H * .09, H * .006, PAPER, .07);
  // vinyl glyph
  const vx = H * .62, vy = H / 2, vr = H * .34;
  circlePath(ctx, vx + H * .02, vy + H * .02, vr); ctx.fillStyle = "#000"; ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = 1;
  circlePath(ctx, vx, vy, vr); ctx.fillStyle = "#0b0d1d"; ctx.fill();
  ctx.strokeStyle = rgba(PAPER, .13); ctx.lineWidth = H * .004;
  for (let r = vr * .4; r < vr * .96; r += vr * .07) { circlePath(ctx, vx, vy, r); ctx.stroke(); }
  circlePath(ctx, vx, vy, vr); ctx.lineWidth = H * .008; ctx.strokeStyle = PAPER; ctx.stroke();
  circlePath(ctx, vx, vy, vr * .34); ctx.fillStyle = CORAL; ctx.fill();
  put(ctx, "A", vx, vy + vr * .02, { family: "display", weight: 900, px: vr * .36, color: PAPER, align: "center", base: "middle" });
  circlePath(ctx, vx, vy, vr * .035); ctx.fillStyle = "#0b0d1d"; ctx.fill();
  ctx.strokeStyle = rgba(PAPER, .5); ctx.lineWidth = H * .012; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(vx, vy, vr * .78, -.95, -.35); ctx.stroke();
  // title: "SIDE A" in sun, rest in paper
  const m = text.match(/^(SIDE A)\s+(.+)$/i);
  const parts = m ? [[m[1], SUN], [m[2], PAPER]] : [[text, fg]];
  const tx = H * 1.12, maxW = W * .6;
  const full = parts.map((p) => p[0]).join(" ");
  const px = fitPx(ctx, full, "display", 900, maxW, H * (sub ? .46 : .54), 20, -.02);
  const baseY = H * (sub ? .56 : .62);
  let x = tx;
  parts.forEach(([t, c], i) => {
    put(ctx, t, x, baseY, { family: "display", weight: 900, px, color: c, track: -.02, shadow: { color: CORAL, dx: px * .045, dy: px * .045 } });
    x += measure(ctx, t + " ", "display", 900, px, -.02);
    void i;
  });
  if (sub) put(ctx, sub, tx + px * .02, H * .83, { family: "mono", weight: 700, px: H * .062, color: rgba(PAPER, .92), track: .14, max: maxW });
  // audio-level bars on the right
  const bars = [.5, .8, .35, .95, .6, .75, .4], bw = H * .07;
  bars.forEach((v, i) => {
    const bx = W - H * .22 - (bars.length - i) * bw * 1.55, bh = H * .6 * v;
    ctx.fillStyle = [CYAN, SUN, CORAL][i % 3];
    fillRR(ctx, bx, H * .8 - bh, bw, bh, bw * .3, ctx.fillStyle);
  });
}

// Generic sign face (shop signage painted on boards): returns a canvas.
export function drawSignBoard(text, { width = 1024, height = 256, bg = INK, fg = PAPER, border = SUN, font = FONT.display, sub = null } = {}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  bg = modern(bg); fg = modern(fg); border = modern(border);
  const label = String(text);
  if (width >= 1800 && height / width < .25 && sub) {
    drawFascia(ctx, label, width, height, sub, lum(bg) < .5 ? bg : INK, lum(bg) < .5 ? fg : PAPER);
    addGrain(canvas, .018, label.length + 3);
    return canvas;
  }
  const dark = lum(bg) < .5;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  const wide = width / height > 2.6;
  const squareish = width / height < 1.6 && sub;
  const inset = height * .085;
  // tri-colour end caps on long boards; thin top/bottom rail on square-ish ones
  let capW = 0;
  if (wide) {
    capW = height * .26;
    const sw = capW / 3;
    [CORAL, SUN, CYAN].forEach((c, i) => {
      ctx.fillStyle = c; ctx.fillRect(i * sw, 0, sw + 1, height); ctx.fillRect(width - capW + i * sw, 0, sw + 1, height);
    });
    ctx.fillStyle = bg; ctx.fillRect(capW, 0, height * .03, height); ctx.fillRect(width - capW - height * .03, 0, height * .03, height);
  } else {
    ctx.fillStyle = CORAL; ctx.fillRect(0, 0, width, height * .05); ctx.fillStyle = SUN; ctx.fillRect(0, height - height * .05, width, height * .05);
  }
  // hairline frame
  ctx.strokeStyle = rgba(wide || dark ? (lum(border) > .45 ? border : fg) : border, dark ? .75 : .9); ctx.lineWidth = Math.max(2, height * .014);
  roundRectPath(ctx, capW + inset, inset, width - capW * 2 - inset * 2, height - inset * 2, height * .1); ctx.stroke();
  // type
  const area = width - capW * 2 - inset * 4;
  const shadowColor = dark ? (bg === VIOLET ? INK : CORAL) : SUN;
  if (squareish) { // bag / badge: vinyl glyph above the wordmark
    const vx = width / 2, vy = height * .3, vr = height * .15;
    circlePath(ctx, vx, vy, vr); ctx.fillStyle = INK; ctx.fill();
    ctx.strokeStyle = rgba(PAPER, .18); ctx.lineWidth = Math.max(1, height * .004);
    for (let r = vr * .45; r < vr * .95; r += vr * .12) { circlePath(ctx, vx, vy, r); ctx.stroke(); }
    circlePath(ctx, vx, vy, vr * .36); ctx.fillStyle = CORAL; ctx.fill();
    circlePath(ctx, vx, vy, vr * .06); ctx.fillStyle = INK; ctx.fill();
  }
  const size = fitFont(ctx, label, font, 900, area, height * (squareish ? .26 : sub ? .5 : .62), 16, -.02);
  const cy = height * (squareish ? .62 : sub ? .46 : .525);
  put(ctx, label, width / 2, cy, { family: font, weight: 900, px: size, color: fg, align: "center", base: "middle", track: -.02, shadow: { color: shadowColor, dx: size * .045, dy: size * .045 } });
  if (sub) put(ctx, sub, width / 2, height * (squareish ? .82 : .8), { family: "mono", weight: 700, px: Math.min(size * .3, height * .1), color: fg, align: "center", base: "middle", track: .16, max: area, alpha: .9 });
  addGrain(canvas, .018, label.length + 3);
  return canvas;
}

function fitFont(ctx, text, family, weight, maxWidth, startPx, minPx = 12, track = 0) {
  return fitPx(ctx, text, family, weight, maxWidth, startPx, minPx, track);
}

// ---------------------------------------------------------------------------------------------
// NEON — tube lettering that stays vivid in daylight. Optional helpers for the lighting builder.
// ---------------------------------------------------------------------------------------------
export function drawNeonBoard(lines = [["SIDE A", "#ff7ea8", "#ff2f7d"], ["RECORDS", "#7fffe6", "#16d9b3"]], { width = 2048, height = 512, bg = "#090b1c" } = {}) {
  const canvas = createCanvas(width, height);
  const g = canvas.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, width, height);
  const n = lines.length;
  lines.forEach(([text, color, glow], i) => {
    const maxPx = height * (n === 1 ? .8 : i === 0 ? .56 : .32);
    const y = n === 1 ? height / 2 : height * (i === 0 ? .32 : .79);
    const px = fitPx(g, text, "displayBold", 800, width * .88, maxPx, 20, .02);
    const setup = (c) => { c.font = fontStr("displayBold", 800, px); c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; if (HAS_LS) c.letterSpacing = `${(.02 * px).toFixed(1)}px`; };
    // a clean tube = the dilated glyph minus the glyph itself (hides the overlapping contours of the variable font)
    const tube = (lw, col) => {
      const c = createCanvas(width, height), t = c.getContext("2d");
      setup(t); t.strokeStyle = col; t.fillStyle = col; t.lineWidth = lw * 2;
      t.strokeText(text, width / 2, y); t.fillText(text, width / 2, y);
      t.globalCompositeOperation = "destination-out"; t.fillText(text, width / 2, y);
      return c;
    };
    // faint glass body
    g.save(); setup(g); g.fillStyle = rgba(glow, .16); g.fillText(text, width / 2, y); g.restore();
    g.save(); g.shadowColor = glow; g.shadowBlur = px * .3; g.globalAlpha = .75; g.drawImage(tube(px * .07, glow), 0, 0); g.restore();
    g.save(); g.shadowColor = glow; g.shadowBlur = px * .1; g.drawImage(tube(px * .045, color), 0, 0); g.restore();
    g.save(); g.globalAlpha = .95; g.drawImage(tube(px * .014, "#ffffff"), 0, 0); g.restore();
  });
  return canvas;
}

export function drawOpenNeon(text = "OPEN", { width = 512, height = 256, color = "#6dffc8", glow = "#16d9a0", bg = "#090b1c" } = {}) {
  return drawNeonBoard([[text, color, glow]], { width, height, bg });
}

export function tex(canvas, options = {}) {
  return textureFrom(canvas, { srgb: true, repeat: false, anisotropy: 8, ...options });
}

export { THREE, mixHex, shadeHex };
