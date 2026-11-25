// Procedural artwork: project sleeves, liner notes, decorative covers, gig posters, stickers, app cases.
// All pieces are ORIGINAL, generated at runtime. Project sleeves are PROVISIONAL placeholders:
// swap them for final art by setting `project.cover.front` / `project.cover.back` (image URLs) in the data.
import * as THREE from "three";
import { rng, createCanvas, textureFrom, wrapText, addGrain, roundRectPath, mixHex, shadeHex, hexToRgb } from "./util.js";

export const FONT = {
  display: '"Anton", "Impact", "Arial Narrow", sans-serif',
  grunge: '"Dirtyline", "Anton", "Impact", sans-serif',
  serif: '"Playfair Display", Georgia, serif',
  type: '"Special Elite", "Courier New", monospace',
  marker: '"Permanent Marker", "Marker Felt", cursive',
  hand: '"Caveat", "Bradley Hand", cursive',
  sans: '"Poppins", "Helvetica Neue", Arial, sans-serif'
};

const FONT_REQUESTS = [
  '400 40px "Anton"', '700 40px "Playfair Display"', 'italic 700 40px "Playfair Display"', '400 24px "Special Elite"',
  '400 40px "Permanent Marker"', '600 40px "Caveat"', '400 24px "Poppins"', '500 24px "Poppins"', '600 24px "Poppins"',
  '700 24px "Poppins"', '400 40px "Dirtyline"'
];
export async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all(FONT_REQUESTS.map((f) => document.fonts.load(f, "AaÉé0123"))),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  } catch { /* fonts are a nicety, never a blocker */ }
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// drawing helpers
// ---------------------------------------------------------------------------------------------
function fitFont(ctx, text, family, weight, maxWidth, startPx, minPx = 12, style = "") {
  let size = startPx;
  while (size > minPx) {
    ctx.font = `${style} ${weight} ${size}px ${family}`.trim();
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${style} ${weight} ${size}px ${family}`.trim();
  return size;
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

function paperTexture(ctx, size, base = "#e8dcc3", seed = 1, grain = .05) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = rng(seed);
  for (let i = 0; i < size * 3; i++) {
    ctx.fillStyle = rand() < .5 ? "rgba(255,255,255,.05)" : "rgba(60,40,20,.045)";
    ctx.fillRect(rand() * size, rand() * size, rand.range(1, 14), rand.range(.5, 1.5));
  }
  void grain;
}

// Everyday wear: whitened edges, bent corners, shelf-ring, faint creases, dust. Applied last.
export function applyWear(canvas, seed = 5, strength = 1) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const rand = rng(seed);
  // ring wear where the disc presses against the board
  const rg = ctx.createRadialGradient(w / 2, h / 2, w * .38, w / 2, h / 2, w * .46);
  rg.addColorStop(0, "rgba(255,255,255,0)");
  rg.addColorStop(.5, `rgba(255,252,244,${.1 * strength})`);
  rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // edge whitening
  const edge = Math.max(2, w * .006);
  for (let n = 0; n < w / 3; n++) {
    ctx.fillStyle = `rgba(245,240,228,${rand.range(.05, .28) * strength})`;
    const side = rand.int(0, 3), t = rand() * w;
    if (side === 0) ctx.fillRect(t, 0, rand.range(3, 22), edge * rand.range(.4, 1.6));
    if (side === 1) ctx.fillRect(t, h - edge, rand.range(3, 22), edge * rand.range(.4, 1.6));
    if (side === 2) ctx.fillRect(0, t, edge * rand.range(.4, 1.6), rand.range(3, 22));
    if (side === 3) ctx.fillRect(w - edge, t, edge * rand.range(.4, 1.6), rand.range(3, 22));
  }
  // corner dings
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    if (rand() < .55) continue;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * rand.range(.03, .07));
    g.addColorStop(0, `rgba(250,246,236,${.55 * strength})`);
    g.addColorStop(1, "rgba(250,246,236,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // creases and scuffs
  ctx.lineCap = "round";
  for (let n = 0; n < 5 * strength; n++) {
    ctx.strokeStyle = `rgba(255,255,255,${rand.range(.03, .09)})`;
    ctx.lineWidth = rand.range(.6, 1.6);
    ctx.beginPath();
    const x = rand() * w, y = rand() * h;
    ctx.moveTo(x, y); ctx.lineTo(x + rand.range(-w * .25, w * .25), y + rand.range(-w * .25, w * .25));
    ctx.stroke();
  }
  // soft shading toward the hinge edge for sleeve volume
  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(0,0,0,.13)"); shade.addColorStop(.06, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  addGrain(canvas, .035 * strength, seed + 9);
  return canvas;
}

function labelStrip(ctx, size, text, color = "#f4ead2", bg = "rgba(0,0,0,.55)") {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size * .06);
  ctx.fillStyle = color;
  ctx.font = `500 ${size * .02}px ${FONT.sans}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, size * .035, size * .03);
}

// ---------------------------------------------------------------------------------------------
// PROJECT SLEEVES — one distinct composition per project
// ---------------------------------------------------------------------------------------------
const COVER = {
  rapmap(ctx, S, p, t) {
    const [c0, c1, c2] = p;
    ctx.fillStyle = c2; ctx.fillRect(0, 0, S, S);
    // globe of halftone dots
    const cx = S * .5, cy = S * .43, R = S * .33;
    halftone(ctx, cx - R, cy - R, R * 2, R * 2, (u, v) => {
      const dx = u - .5, dy = v - .5; const d = Math.hypot(dx, dy) * 2;
      if (d > 1) return 0;
      const light = 1 - Math.hypot(u - .36, v - .3) * 1.1;
      return Math.max(.12, light) * (1 - d * .25);
    }, { spacing: S * .019, color: c0, angle: .3 });
    // sound rings
    ctx.strokeStyle = c1; ctx.lineWidth = S * .006;
    for (let i = 1; i <= 5; i++) { ctx.globalAlpha = .75 - i * .12; ctx.beginPath(); ctx.arc(cx, cy, R * (1.08 + i * .13), -.9, .9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * (1.08 + i * .13), Math.PI - .9, Math.PI + .9); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // mic capsule
    ctx.fillStyle = c1;
    roundRectPath(ctx, cx - S * .045, cy - S * .15, S * .09, S * .2, S * .045); ctx.fill();
    ctx.fillStyle = c2; for (let i = 0; i < 6; i++) ctx.fillRect(cx - S * .04, cy - S * .13 + i * S * .028, S * .08, S * .006);
    ctx.fillStyle = c1; ctx.fillRect(cx - S * .006, cy + S * .05, S * .012, S * .09);
    // type
    ctx.fillStyle = c1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    fitFont(ctx, "RAPMAP", FONT.display, 400, S * .88, S * .2); ctx.fillText("RAPMAP", S * .06, S * .87);
    ctx.fillStyle = c0; ctx.font = `600 ${S * .032}px ${FONT.sans}`; ctx.fillText("EL NUEVO PODCAST", S * .065, S * .93);
    ctx.textAlign = "right"; ctx.fillStyle = c1; ctx.font = `${S * .03}px ${FONT.type}`; ctx.fillText("EP. 00 — PILOT", S * .94, S * .075);
  },
  "winehouse-promo"(ctx, S, p) {
    const [gold, wine, cream] = p;
    ctx.fillStyle = cream; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = wine; ctx.fillRect(0, S * .62, S, S * .38);
    // house + wine glass window
    const hx = S * .5, hy = S * .42;
    ctx.fillStyle = shadeHex(wine, -.2);
    ctx.beginPath(); ctx.moveTo(hx - S * .3, hy + S * .2); ctx.lineTo(hx - S * .3, hy - S * .02); ctx.lineTo(hx, hy - S * .28); ctx.lineTo(hx + S * .3, hy - S * .02); ctx.lineTo(hx + S * .3, hy + S * .2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cream; // glass bowl
    ctx.beginPath(); ctx.moveTo(hx - S * .1, hy - S * .06); ctx.quadraticCurveTo(hx - S * .11, hy + S * .1, hx, hy + S * .1); ctx.quadraticCurveTo(hx + S * .11, hy + S * .1, hx + S * .1, hy - S * .06); ctx.closePath(); ctx.fill();
    ctx.fillRect(hx - S * .006, hy + S * .1, S * .012, S * .075); ctx.fillRect(hx - S * .05, hy + S * .175, S * .1, S * .008);
    ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(hx - S * .098, hy); ctx.quadraticCurveTo(hx - S * .105, hy + S * .095, hx, hy + S * .095); ctx.quadraticCurveTo(hx + S * .105, hy + S * .095, hx + S * .098, hy); ctx.closePath(); ctx.fill();
    // type
    ctx.textAlign = "center"; ctx.fillStyle = gold;
    fitFont(ctx, "Winehouse", FONT.serif, 700, S * .86, S * .17, 20, "italic"); ctx.fillText("Winehouse", S / 2, S * .8);
    ctx.fillStyle = cream; ctx.font = `600 ${S * .028}px ${FONT.sans}`; ctx.fillText("THE ALBUM  ·  OUT NOW", S / 2, S * .875);
    ctx.fillStyle = gold; ctx.fillRect(S * .36, S * .9, S * .28, 2);
    ctx.fillStyle = cream; ctx.font = `${S * .026}px ${FONT.type}`; ctx.fillText("PROMO POST · SQUARE EDITION", S / 2, S * .945);
    ctx.fillStyle = wine; ctx.font = `700 ${S * .035}px ${FONT.sans}`; ctx.fillText("ADAM SOPPELSA", S / 2, S * .1);
  },
  wero(ctx, S, p) {
    const [teal, yellow, cream] = p;
    ctx.fillStyle = yellow; ctx.fillRect(0, 0, S, S);
    // two overlapping rounded tiles with transfer arrows
    ctx.fillStyle = teal; roundRectPath(ctx, S * .1, S * .16, S * .46, S * .46, S * .07); ctx.fill();
    ctx.fillStyle = cream; roundRectPath(ctx, S * .4, S * .3, S * .46, S * .46, S * .07); ctx.fill();
    ctx.strokeStyle = yellow; ctx.lineWidth = S * .02; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(S * .2, S * .39); ctx.lineTo(S * .46, S * .39); ctx.moveTo(S * .4, S * .33); ctx.lineTo(S * .46, S * .39); ctx.lineTo(S * .4, S * .45); ctx.stroke();
    ctx.strokeStyle = teal; ctx.beginPath(); ctx.moveTo(S * .76, S * .53); ctx.lineTo(S * .5, S * .53); ctx.moveTo(S * .56, S * .47); ctx.lineTo(S * .5, S * .53); ctx.lineTo(S * .56, S * .59); ctx.stroke();
    ctx.fillStyle = teal; ctx.textAlign = "left";
    fitFont(ctx, "WERO", FONT.display, 400, S * .86, S * .24); ctx.fillText("WERO", S * .07, S * .93);
    ctx.font = `600 ${S * .03}px ${FONT.sans}`; ctx.fillText("ARRIVÉE EN FRANCE  ·  CAMPAGNE MULTICANALE", S * .075, S * .97);
    ctx.fillStyle = shadeHex(teal, .3); ctx.font = `${S * .026}px ${FONT.type}`; ctx.textAlign = "right"; ctx.fillText("PAYLIB → WERO", S * .93, S * .08);
  },
  "student-housing"(ctx, S, p) {
    const [green, sand, dark] = p;
    ctx.fillStyle = sand; ctx.fillRect(0, 0, S, S);
    // grid map with heat blobs
    ctx.strokeStyle = shadeHex(sand, -.16); ctx.lineWidth = 2;
    for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * S / 12, 0); ctx.lineTo(i * S / 12, S * .7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * S * .7 / 12); ctx.lineTo(S, i * S * .7 / 12); ctx.stroke(); }
    ctx.strokeStyle = green; ctx.lineWidth = S * .014; ctx.beginPath(); ctx.moveTo(0, S * .5); ctx.bezierCurveTo(S * .3, S * .2, S * .6, S * .6, S, S * .25); ctx.stroke();
    const rand = rng(14);
    for (let i = 0; i < 46; i++) {
      const x = rand() * S, y = rand() * S * .7;
      const sat = Math.hypot(x / S - .45, y / (S * .7) - .5);
      ctx.fillStyle = mixHex("#c4472f", green, Math.min(1, sat * 1.5)); ctx.globalAlpha = .85;
      const w = S * rand.range(.03, .06);
      ctx.fillRect(x, y, w, w * rand.range(.7, 1.4));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark; ctx.fillRect(0, S * .7, S, S * .3);
    ctx.fillStyle = sand; ctx.textAlign = "left";
    ctx.font = `400 ${S * .105}px ${FONT.display}`; ctx.fillText("LOGEMENT", S * .06, S * .83); ctx.fillText("ÉTUDIANT BORDELAIS", S * .06, S * .93);
    ctx.font = `${S * .025}px ${FONT.type}`; ctx.fillStyle = green; ctx.fillStyle = mixHex(green, "#ffffff", .5); ctx.fillText("SATISFACTION ↔ LOCALISATION", S * .06, S * .975);
  },
  "winehouse-amy"(ctx, S, p) {
    const [red, amber, dark] = p;
    ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S);
    // stairwell perspective
    const vp = [S * .5, S * .36];
    for (let i = 0; i < 14; i++) {
      const t = i / 14, k = Math.pow(1 - t, 1.9);
      const w = S * .95 * k + S * .04, h = S * .95 * k + S * .04;
      ctx.fillStyle = mixHex(dark, red, .05 + t * .5); ctx.globalAlpha = .9;
      ctx.fillRect(vp[0] - w / 2, vp[1] - h / 2, w, h);
      ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 3; ctx.strokeRect(vp[0] - w / 2, vp[1] - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    // light from the door at the top
    const g = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], S * .24);
    g.addColorStop(0, amber); g.addColorStop(.35, "rgba(220,150,70,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    // shadow figure on the stairs
    ctx.fillStyle = "#050505";
    ctx.beginPath(); ctx.ellipse(vp[0], vp[1] + S * .12, S * .03, S * .075, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(vp[0], vp[1] + S * .02, S * .024, 0, TAU); ctx.fill();
    ctx.fillStyle = amber; ctx.textAlign = "center";
    fitFont(ctx, "WINEHOUSE", FONT.display, 400, S * .86, S * .13); ctx.fillText("WINEHOUSE", S / 2, S * .86);
    ctx.fillStyle = red; fitFont(ctx, "AMY", FONT.serif, 700, S * .5, S * .15, 20, "italic"); ctx.fillText("Amy", S / 2, S * .965);
    ctx.fillStyle = amber; ctx.globalAlpha = .7; ctx.font = `${S * .026}px ${FONT.type}`; ctx.fillText("THE REISSUE  ·  AN ANTIDOTE", S / 2, S * .075); ctx.globalAlpha = 1;
  },
  smac(ctx, S, p) {
    const [violet, sand, navy] = p;
    ctx.fillStyle = navy; ctx.fillRect(0, 0, S, S);
    // equalizer bars = diffusion data
    const bars = 14, w = S / (bars + 1);
    const rand = rng(8);
    for (let i = 0; i < bars; i++) {
      const hgt = S * (.18 + .5 * Math.abs(Math.sin(i * .62 + .8)) * (.6 + rand() * .4));
      const x = w * .5 + i * w;
      const grad = ctx.createLinearGradient(0, S * .72 - hgt, 0, S * .72);
      grad.addColorStop(0, sand); grad.addColorStop(1, violet);
      ctx.fillStyle = grad; ctx.fillRect(x, S * .72 - hgt, w * .74, hgt);
      ctx.fillStyle = "rgba(0,0,0,.35)"; for (let y = S * .72 - hgt; y < S * .72; y += S * .026) ctx.fillRect(x, y, w * .74, S * .006);
    }
    ctx.fillStyle = sand; ctx.textAlign = "left";
    ctx.font = `400 ${S * .115}px ${FONT.display}`; ctx.fillText("DIFFUSER ET", S * .06, S * .83); ctx.fillText("AIDES À LA CRÉATION", S * .06, S * .93);
    ctx.font = `${S * .025}px ${FONT.type}`; ctx.fillStyle = violet; ctx.fillStyle = mixHex(violet, "#ffffff", .5); ctx.fillText("SCÈNES DE MUSIQUES ACTUELLES · BORDEAUX", S * .06, S * .975);
    ctx.textAlign = "right"; ctx.fillStyle = sand; ctx.font = `600 ${S * .03}px ${FONT.sans}`; ctx.fillText("DATA VOL. 1", S * .94, S * .08);
  },
  "jugar-si-quieres"(ctx, S, p) {
    const [yellow, red, navy] = p;
    ctx.fillStyle = navy; ctx.fillRect(0, 0, S, S);
    const stripes = ["#e4372d", "#f08a24", "#f6d12e", "#2f9e57", "#2e6fd0", "#7b4cc2"];
    ctx.save(); ctx.translate(S * .5, S * .42); ctx.rotate(-.32);
    stripes.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-S * .75, -S * .3 + i * S * .1, S * 1.5, S * .1); });
    ctx.restore();
    // ball
    ctx.fillStyle = "#f6efe0"; ctx.beginPath(); ctx.arc(S * .5, S * .42, S * .19, 0, TAU); ctx.fill();
    ctx.fillStyle = navy; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; ctx.beginPath(); ctx.arc(S * .5 + Math.cos(a) * S * .125, S * .42 + Math.sin(a) * S * .125, S * .04, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(S * .5, S * .42, S * .045, 0, TAU); ctx.fill();
    ctx.fillStyle = yellow; ctx.textAlign = "center";
    fitFont(ctx, "#JUGARSIQUIERES", FONT.display, 400, S * .9, S * .13); ctx.fillText("#JUGARSIQUIERES", S / 2, S * .84);
    ctx.fillStyle = "#f6efe0"; ctx.font = `600 ${S * .029}px ${FONT.sans}`; ctx.fillText("SPORT SANS DISCRIMINATION  ·  L’ALBUM", S / 2, S * .91);
    ctx.fillStyle = red; ctx.font = `${S * .026}px ${FONT.type}`; ctx.fillStyle = yellow; ctx.fillText("CAMPAGNE · ÉMISSION · MUSIQUE", S / 2, S * .955);
  },
  "swim-sync"(ctx, S, p) {
    const [teal, mint, deep] = p;
    ctx.fillStyle = deep; ctx.fillRect(0, 0, S, S);
    // pool lanes
    const lanes = 7, top = S * .08, laneH = S * .1;
    const rand = rng(21);
    for (let i = 0; i < lanes; i++) {
      const y = top + i * laneH;
      const g = ctx.createLinearGradient(0, y, 0, y + laneH);
      g.addColorStop(0, mixHex(teal, "#ffffff", .08)); g.addColorStop(1, teal);
      ctx.fillStyle = g; ctx.fillRect(0, y, S, laneH - 2);
      ctx.fillStyle = "rgba(255,255,255,.07)"; for (let k = 0; k < 24; k++) ctx.fillRect(rand() * S, y + rand() * laneH, rand() * 70, 1.5);
      ctx.fillStyle = mint; for (let x = 6; x < S; x += 16) ctx.fillRect(x, y + laneH - 5, 8, 3);
      // swimmer progress = occupancy
      const progress = .12 + rand() * .76;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(S * progress, y + laneH * .45, S * .018, S * .012, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = mint; ctx.globalAlpha = .5; ctx.fillRect(S * .04, y + laneH * .44, S * progress - S * .04, 4); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = mint; ctx.textAlign = "left";
    ctx.font = `400 ${S * .15}px ${FONT.display}`; ctx.fillText("SWIM SYNC", S * .06, S * .93);
    ctx.font = `600 ${S * .03}px ${FONT.sans}`; ctx.fillStyle = "#fff"; ctx.fillText("LA PISCINE INTERACTIVE  ·  HACKATHON POCL 2025", S * .065, S * .975);
  },
  expodata(ctx, S, p) {
    const [slate, sand, dark] = p;
    ctx.fillStyle = "#ece6d8"; ctx.fillRect(0, 0, S, S);
    // gallery wall with framed mini-charts
    const rand = rng(33);
    const frames = [[.08, .1, .3, .36], [.42, .1, .22, .26], [.68, .1, .24, .36], [.08, .52, .2, .2], [.32, .42, .36, .3], [.72, .52, .2, .2]];
    frames.forEach(([x, y, w, h], i) => {
      ctx.fillStyle = dark; ctx.fillRect(S * x - 6, S * y - 6, S * w + 12, S * h + 12);
      ctx.fillStyle = "#faf6ec"; ctx.fillRect(S * x, S * y, S * w, S * h);
      ctx.fillStyle = i % 2 ? slate : sand;
      if (i % 3 === 0) { for (let k = 0; k < 6; k++) { const bh = S * h * (.2 + rand() * .65); ctx.fillRect(S * x + S * w * (.08 + k * .15), S * (y + h) - bh - S * .02, S * w * .1, bh); } }
      else if (i % 3 === 1) { ctx.beginPath(); ctx.arc(S * (x + w / 2), S * (y + h / 2), Math.min(S * w, S * h) * .34, 0, TAU * .72); ctx.lineWidth = S * .035; ctx.strokeStyle = i % 2 ? slate : sand; ctx.stroke(); ctx.lineWidth = 1; }
      else { ctx.strokeStyle = slate; ctx.lineWidth = S * .008; ctx.beginPath(); for (let k = 0; k <= 8; k++) { const px = S * (x + w * (.06 + k * .11)), py = S * (y + h * (.8 - rand() * .55)); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    });
    ctx.fillStyle = dark; ctx.fillRect(0, S * .8, S, S * .2);
    ctx.fillStyle = sand; ctx.textAlign = "left"; ctx.font = `400 ${S * .12}px ${FONT.display}`; ctx.fillText("EXPODATA 2025", S * .05, S * .905);
    ctx.fillStyle = "#e9e1d0"; ctx.font = `600 ${S * .028}px ${FONT.sans}`; ctx.fillText("DATAVISUALISATION ET INCLUSIVITÉ NUMÉRIQUE", S * .055, S * .95);
  },
  "davis-miles"(ctx, S, p) {
    // Hard-bop-style typographic sleeve (provisional placeholder for Adam's own release)
    const [blue, amber, dark] = ["#1f4e79", "#f1b35a", "#0e1c2b"];
    ctx.fillStyle = blue; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = dark; ctx.fillRect(0, 0, S * .16, S);
    ctx.fillStyle = amber; ctx.font = `400 ${S * .31}px ${FONT.display}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("DAVIS", S * .21, S * .42); ctx.fillStyle = "#f6ecd8"; ctx.fillText("MILES", S * .21, S * .72);
    halftone(ctx, S * .21, S * .76, S * .7, S * .16, (u, v) => .55 + .4 * Math.sin(u * 14), { spacing: S * .014, color: dark });
    ctx.fillStyle = "#f6ecd8"; ctx.font = `${S * .028}px ${FONT.type}`; ctx.fillText("A PERSONAL RELEASE · SIDE A RECORDS", S * .21, S * .965);
    ctx.save(); ctx.translate(S * .08, S * .94); ctx.rotate(-Math.PI / 2); ctx.fillStyle = amber; ctx.font = `600 ${S * .03}px ${FONT.sans}`; ctx.fillText("ADAM SOPPELSA", 0, 0); ctx.restore();
  },
  story(ctx, S, p) {
    const bg = "#f1ece0", ink = "#161412", accent = "#d1452c";
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(S * .5, S * .44, S * .27, 0, TAU); ctx.fill();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(S * .5, S * .44, S * .27, Math.PI * .1, Math.PI * 1.1); ctx.lineTo(S * .5, S * .44); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(S * .5, S * .44, S * .09, 0, TAU); ctx.fill();
    ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    fitFont(ctx, "STORY.", FONT.display, 400, S * .88, S * .2); ctx.fillText("STORY.", S * .06, S * .93);
    ctx.font = `600 ${S * .028}px ${FONT.sans}`; ctx.fillText("ADAM SOPPELSA", S * .065, S * .08);
  },
  "portfolio-v1"(ctx, S, p) {
    const [red, skin, black] = p;
    ctx.fillStyle = red; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = black; ctx.font = `400 ${S * .58}px ${FONT.display}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("SO", S * .02, S * .6); ctx.fillText("PP", S * .02, S * 1.05);
    ctx.fillStyle = skin; ctx.font = `600 ${S * .03}px ${FONT.sans}`; ctx.fillText("PORTFOLIO — VERSION 1", S * .05, S * .08);
    ctx.fillRect(S * .05, S * .1, S * .35, 3);
    ctx.fillStyle = black; ctx.textAlign = "right"; ctx.font = `${S * .026}px ${FONT.type}`;
    ["HTML / CSS / JS", "BILINGUE FR / EN", "HEADER BURGER", "PERANDORY + POPPINS"].forEach((line, i) => ctx.fillText(line, S * .94, S * .64 + i * S * .04));
  }
};

function genericCover(ctx, S, p, title) {
  const [a, b, c] = p;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, a); g.addColorStop(.55, b); g.addColorStop(1, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#f6ecd7"; ctx.textAlign = "center"; fitFont(ctx, title.toUpperCase(), FONT.display, 400, S * .84, S * .16);
  ctx.fillText(title.toUpperCase(), S / 2, S * .55);
}

export function drawProjectCover(project, index, size = 1024) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const palette = project.artwork || ["#b45a3a", "#e0b474", "#182e38"];
  const painter = COVER[project.id];
  const title = project.title?.fr || project.id;
  if (painter) painter(ctx, size, palette, title); else genericCover(ctx, size, palette, title);
  // catalogue marking (tiny, consistent across the shop's pressings)
  ctx.save();
  ctx.globalAlpha = .75;
  ctx.fillStyle = "#f3e9d1"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = `600 ${size * .018}px ${FONT.sans}`;
  ctx.restore();
  addGrain(canvas, .05, index + 3);
  return applyWear(canvas, index * 13 + 5, 1);
}

// ---------------------------------------------------------------------------------------------
// LINER NOTES (back) and INNER SPREAD (inside) — language aware, auto-fitting
// ---------------------------------------------------------------------------------------------
const LABELS = {
  fr: { summary: "RÉSUMÉ", context: "CONTEXTE", challenge: "PROBLÉMATIQUE", role: "MON RÔLE", skills: "COMPÉTENCES", outcome: "RÉSULTAT", work: "TRAVAIL RÉALISÉ", team: "AVEC", tracklist: "TRACKLIST", credits: "CRÉDITS", notes: "LINER NOTES", prov: "VISUEL PROVISOIRE", flip: "SIDE B", yearTbc: "ANNÉE À CONFIRMER" },
  en: { summary: "SUMMARY", context: "CONTEXT", challenge: "CHALLENGE", role: "MY ROLE", skills: "SKILLS", outcome: "OUTCOME", work: "WHAT I DID", team: "WITH", tracklist: "TRACKLIST", credits: "CREDITS", notes: "LINER NOTES", prov: "PROVISIONAL ARTWORK", flip: "SIDE B", yearTbc: "YEAR TO CONFIRM" }
};
const pick = (obj, lang) => (obj && (obj[lang] ?? obj.fr)) || "";

function paragraph(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const lines = wrapText(ctx, text, maxWidth);
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function measureParagraph(ctx, text, maxWidth, lineHeight) {
  return wrapText(ctx, text, maxWidth).length * lineHeight;
}

export function drawProjectBack(project, lang = "fr", index = 0, size = 1024) {
  const L = LABELS[lang] || LABELS.fr;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const [c0, c1, c2] = project.artwork || ["#b45a3a", "#e0b474", "#182e38"];
  paperTexture(ctx, size, "#ebe1cb", index + 2);
  const S = size / 1024;
  // header band
  ctx.fillStyle = c2; ctx.fillRect(0, 0, size, 150 * S);
  ctx.fillStyle = c0; ctx.fillRect(0, 150 * S, size, 8 * S);
  ctx.fillStyle = "#f3e9d1"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = pick(project.title, lang).toUpperCase();
  fitFont(ctx, title, FONT.display, 400, size - 120 * S, 78 * S, 30 * S);
  ctx.fillText(title, 48 * S, 100 * S);
  ctx.font = `500 ${19 * S}px ${FONT.sans}`; ctx.fillStyle = mixHex(c1, "#ffffff", .25);
  const year = project.year ? String(project.year) : L.yearTbc;
  ctx.fillText(`${L.flip} · ${L.notes} · ${year}`, 48 * S, 134 * S);

  const sections = [
    [L.summary, pick(project.short, lang)],
    [L.context, pick(project.context, lang)],
    [L.challenge, pick(project.challenge, lang)],
    [L.role, pick(project.role, lang)],
    [L.outcome, pick(project.outcome, lang)]
  ].filter(([, text]) => text);

  // fit the whole column by shrinking the body size
  const left = 48 * S, width = size - 96 * S, top = 196 * S, bottom = size - 150 * S;
  let body = 27 * S;
  const need = (px) => {
    ctx.font = `400 ${px}px ${FONT.sans}`;
    return sections.reduce((sum, [, text]) => sum + 28 * S + measureParagraph(ctx, text, width, px * 1.36) + 22 * S, 0);
  };
  while (body > 15 * S && need(body) > bottom - top) body -= 1 * S;
  let y = top;
  for (const [heading, text] of sections) {
    ctx.fillStyle = c0; ctx.font = `700 ${15 * S}px ${FONT.sans}`; ctx.fillText(heading.split("").join(" "), left, y + 14 * S);
    ctx.fillStyle = c0; ctx.fillRect(left, y + 20 * S, 34 * S, 3 * S);
    ctx.fillStyle = "#2c2820"; ctx.font = `400 ${body}px ${FONT.sans}`;
    y = paragraph(ctx, text, left, y + 28 * S + body * 1.05, width, body * 1.36) + 14 * S;
  }
  // skills chips
  const skills = (lang === "en" ? project.skillsEn : project.skills) || project.skills || [];
  if (skills.length) {
    let x = left, cy = size - 118 * S;
    ctx.font = `600 ${16 * S}px ${FONT.sans}`;
    for (const skill of skills) {
      const w = ctx.measureText(skill).width + 26 * S;
      if (x + w > left + width) { x = left; cy += 36 * S; }
      ctx.fillStyle = c2; roundRectPath(ctx, x, cy - 20 * S, w, 30 * S, 15 * S); ctx.fill();
      ctx.fillStyle = "#f3e9d1"; ctx.fillText(skill, x + 13 * S, cy);
      x += w + 10 * S;
    }
  }
  // barcode + catalogue footer
  ctx.fillStyle = "#2c2820";
  for (let i = 0; i < 38; i++) ctx.fillRect(size - 230 * S + i * 4.4 * S, size - 62 * S, (i % 3 + 1) * 1.6 * S, 36 * S);
  ctx.font = `${15 * S}px ${FONT.type}`; ctx.textAlign = "left";
  ctx.fillText(`SIDE A RECORDS · CAT. ${String(index + 1).padStart(3, "0")}`, left, size - 36 * S);
  if (project.visualStatus === "provisional") { ctx.fillStyle = "#8a7b60"; ctx.font = `${13 * S}px ${FONT.type}`; ctx.fillText(L.prov, left, size - 16 * S); }
  addGrain(canvas, .03, index + 31);
  return applyWear(canvas, index * 7 + 2, .8);
}

// 2048 x 1024 spread: left half = inside of the front cover, right half = inside of the back.
export function drawProjectInner(project, lang = "fr", index = 0, size = 1024) {
  const L = LABELS[lang] || LABELS.fr;
  const canvas = createCanvas(size * 2, size);
  const ctx = canvas.getContext("2d");
  const [c0, c1, c2] = project.artwork || ["#b45a3a", "#e0b474", "#182e38"];
  const S = size / 1024;
  // two panels
  ctx.fillStyle = c2; ctx.fillRect(0, 0, size, size);
  paperTexture(ctx, size, "#ece2cc", index + 9);
  ctx.save(); ctx.translate(size, 0); ctx.fillStyle = "#ece2cc"; ctx.fillRect(0, 0, size, size); ctx.restore();
  const g = ctx.createLinearGradient(0, 0, size * 2, 0);
  g.addColorStop(0, "rgba(0,0,0,.1)"); g.addColorStop(.46, "rgba(0,0,0,0)"); g.addColorStop(.5, "rgba(0,0,0,.28)"); g.addColorStop(.54, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.1)");

  // LEFT: tracklist (work items) on the colour field
  ctx.fillStyle = c2; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c0; ctx.fillRect(0, 0, size, 12 * S);
  ctx.fillStyle = "#f3e9d1"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = pick(project.title, lang).toUpperCase();
  fitFont(ctx, title, FONT.display, 400, size - 110 * S, 66 * S, 28 * S); ctx.fillText(title, 54 * S, 110 * S);
  ctx.fillStyle = c1; ctx.font = `700 ${17 * S}px ${FONT.sans}`; ctx.fillText(L.tracklist.split("").join(" "), 54 * S, 164 * S);
  const work = (project.work && (project.work[lang] || project.work.fr)) || [];
  let body = 26 * S;
  const need = (px) => { ctx.font = `400 ${px}px ${FONT.sans}`; return work.reduce((s, t) => s + measureParagraph(ctx, t, size - 220 * S, px * 1.34) + 20 * S, 0); };
  while (body > 15 * S && need(body) > size - 330 * S) body -= 1 * S;
  let y = 214 * S;
  work.forEach((item, i) => {
    ctx.fillStyle = c1; ctx.font = `${22 * S}px ${FONT.type}`; ctx.fillText(`A${i + 1}`, 54 * S, y + body * .9);
    ctx.fillStyle = "#f3e9d1"; ctx.font = `400 ${body}px ${FONT.sans}`;
    y = paragraph(ctx, item, 128 * S, y + body * .9, size - 190 * S, body * 1.34) + 20 * S;
  });

  // RIGHT: credits, collaborators and skills (panel starts at x = size)
  const rx = size + 54 * S, rw = size - 108 * S;
  ctx.fillStyle = c0; ctx.fillRect(size, 0, size, 12 * S);
  ctx.fillStyle = c0; ctx.font = `700 ${17 * S}px ${FONT.sans}`; ctx.fillText(L.credits.split("").join(" "), rx, 80 * S);
  ctx.fillStyle = "#2c2820"; ctx.font = `600 ${30 * S}px ${FONT.sans}`;
  let ry = paragraph(ctx, pick(project.role, lang), rx, 128 * S, rw, 42 * S, 5) + 26 * S;
  const collaborators = project.collaborators || [];
  if (collaborators.length) {
    ctx.fillStyle = c0; ctx.font = `700 ${15 * S}px ${FONT.sans}`; ctx.fillText(L.team.split("").join(" "), rx, ry + 8 * S);
    ctx.fillStyle = "#2c2820"; ctx.font = `500 ${26 * S}px ${FONT.sans}`;
    ry = paragraph(ctx, collaborators.join("  ·  "), rx, ry + 44 * S, rw, 36 * S) + 26 * S;
  }
  const skills = (lang === "en" ? project.skillsEn : project.skills) || project.skills || [];
  if (skills.length) {
    ctx.fillStyle = c0; ctx.font = `700 ${15 * S}px ${FONT.sans}`; ctx.fillText(L.skills.split("").join(" "), rx, ry + 8 * S);
    let x = rx, cy = ry + 52 * S;
    ctx.font = `600 ${20 * S}px ${FONT.sans}`;
    for (const skill of skills) {
      const w = ctx.measureText(skill).width + 30 * S;
      if (x + w > rx + rw) { x = rx; cy += 46 * S; }
      ctx.fillStyle = c2; roundRectPath(ctx, x, cy - 26 * S, w, 38 * S, 19 * S); ctx.fill();
      ctx.fillStyle = "#f3e9d1"; ctx.fillText(skill, x + 15 * S, cy);
      x += w + 12 * S;
    }
    ry = cy + 40 * S;
  }
  const outcome = pick(project.outcome, lang);
  if (outcome) {
    ctx.fillStyle = c0; ctx.fillRect(rx, ry + 8 * S, rw, 3 * S);
    ctx.fillStyle = c0; ctx.font = `700 ${15 * S}px ${FONT.sans}`; ctx.fillText(L.outcome.split("").join(" "), rx, ry + 44 * S);
    ctx.fillStyle = "#2c2820"; ctx.font = `italic 600 ${28 * S}px ${FONT.serif}`;
    paragraph(ctx, outcome, rx, ry + 88 * S, rw, 40 * S, 6);
  }
  ctx.fillStyle = "rgba(60,50,36,.55)"; ctx.font = `${14 * S}px ${FONT.type}`;
  ctx.fillText("SIDE A RECORDS · ADAM SOPPELSA — PROJECTS STORE", rx, size - 28 * S);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size * 2, size);
  addGrain(canvas, .03, index + 71);
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
const DECOR_PALETTES = [
  ["#f2d16b", "#1d3b4a", "#e4572e"], ["#e8e1d0", "#2b2a29", "#c3402f"], ["#1f4e5f", "#f1b35a", "#ece3cf"], ["#2c1b3a", "#ff7a59", "#f7d06b"],
  ["#d6e5d1", "#34553f", "#d9822b"], ["#f4ead2", "#7d2a2a", "#1b1b1b"], ["#4a7f9d", "#f5efe1", "#101820"], ["#e84a5f", "#fbe9c8", "#2a363b"],
  ["#2d6a4f", "#f6e7b4", "#d8572a"], ["#f7ede0", "#272727", "#3b6ea5"], ["#c9a227", "#1b1b2f", "#ece1c8"], ["#2f3e46", "#cad2c5", "#e29578"]
];

function decorCover(ctx, S, i, seed) {
  const rand = rng(seed);
  const [a, b, c] = DECOR_PALETTES[i % DECOR_PALETTES.length];
  const [band, album] = DECOR_BANDS[i % DECOR_BANDS.length];
  const style = i % 8;
  ctx.fillStyle = a; ctx.fillRect(0, 0, S, S);
  if (style === 0) { // concentric sun
    for (let k = 7; k > 0; k--) { ctx.fillStyle = k % 2 ? b : c; ctx.beginPath(); ctx.arc(S * .5, S * .46, S * k * .052, 0, TAU); ctx.fill(); }
  } else if (style === 1) { // big photo-copy portrait blob via halftone
    halftone(ctx, 0, 0, S, S * .75, (u, v) => Math.max(0, 1 - Math.hypot(u - .5, (v - .45) * 1.2) * 2.2), { spacing: S * .022, color: b });
  } else if (style === 2) { // geometric blocks
    for (let k = 0; k < 7; k++) { ctx.fillStyle = [b, c, "#f4ead2"][k % 3]; ctx.fillRect(rand() * S * .7, rand() * S * .7, S * rand.range(.15, .35), S * rand.range(.15, .35)); }
  } else if (style === 3) { // stripes
    for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? b : c; ctx.fillRect(0, S * (.04 + k * .09), S, S * .06); }
  } else if (style === 4) { // horizon
    const g = ctx.createLinearGradient(0, 0, 0, S * .7); g.addColorStop(0, b); g.addColorStop(1, c); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S * .7);
    ctx.fillStyle = a; ctx.beginPath(); ctx.arc(S * .5, S * .52, S * .16, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#101010"; ctx.fillRect(0, S * .66, S, S * .34);
  } else if (style === 5) { // grid of dots
    for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) { ctx.fillStyle = (gx + gy) % 3 ? b : c; ctx.beginPath(); ctx.arc(S * (.1 + gx * .1), S * (.1 + gy * .075), S * .028 * (.4 + rand()), 0, TAU); ctx.fill(); }
  } else if (style === 6) { // big letter
    ctx.fillStyle = b; ctx.font = `400 ${S * .95}px ${FONT.display}`; ctx.textAlign = "center"; ctx.fillText(band[0], S * .5, S * .95);
  } else { // waves
    for (let k = 0; k < 10; k++) { ctx.strokeStyle = k % 2 ? b : c; ctx.lineWidth = S * .018; ctx.beginPath(); for (let x = 0; x <= S; x += 8) { const y = S * (.1 + k * .075) + Math.sin(x / S * 9 + k) * S * .03; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  }
  // type block
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const dark = (hexToRgb(a)[0] + hexToRgb(a)[1] + hexToRgb(a)[2]) / 3 < 110;
  ctx.fillStyle = style === 6 ? c : dark ? "#f6ecd8" : "#161412";
  ctx.globalAlpha = .95;
  fitFont(ctx, band, FONT.display, 400, S * .86, S * .12); ctx.fillText(band, S * .06, S * .93);
  ctx.font = `500 ${S * .032}px ${FONT.sans}`; ctx.fillText(album.toUpperCase(), S * .065, S * .97 - S * .005 + S * .0);
  ctx.globalAlpha = 1;
  addGrain(ctx.canvas, .05, seed + 1);
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
    applyWear(piece, 40 + i, .9);
    ctx.drawImage(piece, c * cell, r * cell);
    cells.push({ index: i, u0: c / columns, v0: 1 - (r + 1) / rows, u1: (c + 1) / columns, v1: 1 - r / rows });
  }
  return { canvas, cells, columns, rows };
}

// ---------------------------------------------------------------------------------------------
// GIG POSTERS (fictional) — 4 x 2 atlas of 512 x 720
// ---------------------------------------------------------------------------------------------
export const POSTER_DEFS = [
  { id: "basement", title: "LIVE AT THE BASEMENT", lines: ["THE LOW TIDES", "+ VHS CHURCH", "SAT 14.11.96 · 21H"], c: ["#f2d16b", "#161412", "#d6402a"], style: "xerox" },
  { id: "nightshift", title: "NIGHT SHIFT", lines: ["DELTA ROOM", "FREE ENTRY BEFORE 22H"], c: ["#1b1b2f", "#ff7a59", "#f7d06b"], style: "stripes" },
  { id: "garage", title: "GARAGE SALE", lines: ["VINYL · TAPES · ZINES", "SUN 12H–18H"], c: ["#e8e1d0", "#2b2a29", "#3b6ea5"], style: "blocks" },
  { id: "winehouse", title: "WINEHOUSE", lines: ["LISTENING PARTY", "DÉCOR — FICTIONAL EVENT"], c: ["#e9d7b9", "#643c35", "#d1a04f"], style: "serif" },
  { id: "static", title: "STATIC", lines: ["PLASTIC HEARTS", "NO SIGNAL TOUR"], c: ["#101820", "#f5efe1", "#4a7f9d"], style: "xerox" },
  { id: "sunday", title: "SUNDAY CHOIR", lines: ["QUIET MACHINES", "ONE NIGHT ONLY"], c: ["#d6e5d1", "#34553f", "#d9822b"], style: "stripes" },
  { id: "story", title: "STORY.", lines: ["SIDE PROJECT SESSION", "DÉCOR — FICTIONAL EVENT"], c: ["#2c1b3a", "#f7d06b", "#ff7a59"], style: "blocks" },
  { id: "kometa", title: "KOMETA 9", lines: ["ORBIT TAPES RELEASE", "DOORS 20H"], c: ["#f4ead2", "#7d2a2a", "#1b1b1b"], style: "serif" }
];

export function drawPosterAtlas(width = 512, height = 720, columns = 4, rows = 2) {
  const canvas = createCanvas(width * columns, height * rows);
  const ctx = canvas.getContext("2d");
  const cells = [];
  POSTER_DEFS.forEach((def, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const [bg, fg, accent] = def.c;
    const rand = rng(200 + i);
    ctx.save();
    ctx.translate(col * width, row * height);
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    if (def.style === "xerox") {
      halftone(ctx, 0, height * .12, width, height * .55, (u, v) => Math.max(0, .95 - Math.hypot(u - .5, v - .5) * 1.7 + (rand() - .5) * .12), { spacing: 11, color: fg, angle: .8 });
      ctx.fillStyle = accent; ctx.fillRect(0, height * .7, width, 10);
    } else if (def.style === "stripes") {
      for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? fg : accent; ctx.globalAlpha = .85; ctx.fillRect(-20, height * (.03 + k * .052), width + 40, height * .028); }
      ctx.globalAlpha = 1;
    } else if (def.style === "blocks") {
      for (let k = 0; k < 8; k++) { ctx.fillStyle = [fg, accent, "#f4ead2"][k % 3]; ctx.fillRect(rand() * width * .6, rand() * height * .55, rand.range(80, 220), rand.range(80, 240)); }
    } else {
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(width * .5, height * .38, width * .33, 0, TAU); ctx.fill();
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(width * .5, height * .38, width * .16, 0, TAU); ctx.fill();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const dark = (hexToRgb(bg)[0] + hexToRgb(bg)[1] + hexToRgb(bg)[2]) / 3 < 110;
    ctx.fillStyle = def.style === "serif" ? fg : (dark ? "#f6ecd8" : fg);
    if (def.style === "serif") { fitFont(ctx, def.title, FONT.serif, 700, width * .86, 84, 20, "italic"); }
    else fitFont(ctx, def.title, FONT.display, 400, width * .9, 112, 30);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 0; ctx.fillText(def.title, width / 2, height * .82); ctx.restore();
    ctx.font = `${22}px ${FONT.type}`; ctx.fillStyle = dark ? "#f6ecd8" : fg;
    def.lines.forEach((line, k) => ctx.fillText(line, width / 2, height * .87 + k * 28));
    ctx.fillStyle = accent; ctx.fillRect(width * .08, height * .045, width * .84, 4);
    ctx.font = `600 18px ${FONT.sans}`; ctx.fillStyle = dark ? "#f6ecd8" : fg; ctx.textAlign = "left"; ctx.fillText("SIDE A RECORDS PRESENTS", width * .08, height * .035);
    ctx.restore();
    cells.push({ id: def.id, index: i, u0: col / columns, v0: 1 - (row + 1) / rows, u1: (col + 1) / columns, v1: 1 - row / rows, def });
  });
  addGrain(canvas, .07, 44);
  // faded, taped look
  const wear = createCanvas(width * columns, height * rows);
  void wear;
  return { canvas, cells, columns, rows, cellWidth: width, cellHeight: height };
}

// ---------------------------------------------------------------------------------------------
// STICKERS / HAND-WRITTEN PRICE TAGS — 4 x 4 atlas of 256
// ---------------------------------------------------------------------------------------------
export function drawStickerAtlas(cell = 256, columns = 4, rows = 4) {
  const canvas = createCanvas(cell * columns, cell * rows);
  const ctx = canvas.getContext("2d");
  const items = [
    ["VINYL IS NOT DEAD", "#161412", "#f2d16b", "round"], ["SIDE A", "#f4ead2", "#1d3b4a", "rect"], ["PLAY LOUD", "#e4572e", "#f4ead2", "round"], ["GOOD VIBES ONLY", "#2f9e57", "#f4ead2", "rect"],
    ["12 €", "#f4ead2", "#161412", "tag"], ["8,50", "#f2d16b", "#161412", "tag"], ["15 €", "#f4ead2", "#c3402f", "tag"], ["5 €", "#ffe9a8", "#161412", "tag"],
    ["WINEHOUSE", "#643c35", "#e9d7b9", "round"], ["STORY.", "#2c1b3a", "#f7d06b", "rect"], ["DAVIS MILES", "#1f4e5f", "#f1b35a", "round"], ["SOPP24", "#ad342e", "#f4ead2", "rect"],
    ["NEW ARRIVAL", "#f4ead2", "#c3402f", "rect"], ["STAFF PICK", "#161412", "#f6ecd8", "round"], ["PROMO", "#3b6ea5", "#f6ecd8", "rect"], ["LISTEN", "#f2d16b", "#161412", "round"]
  ];
  const cells = [];
  items.forEach(([text, bg, fg, shape], i) => {
    const col = i % columns, row = Math.floor(i / columns);
    ctx.save();
    ctx.translate(col * cell + cell / 2, row * cell + cell / 2);
    ctx.rotate((((i * 37) % 11) - 5) * .012);
    ctx.fillStyle = bg;
    if (shape === "round") { ctx.beginPath(); ctx.arc(0, 0, cell * .43, 0, TAU); ctx.fill(); ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, cell * .38, 0, TAU); ctx.stroke(); }
    else if (shape === "tag") { roundRectPath(ctx, -cell * .4, -cell * .26, cell * .8, cell * .52, 12); ctx.fill(); ctx.fillStyle = "#c9c0a8"; ctx.beginPath(); ctx.arc(-cell * .32, 0, 8, 0, TAU); ctx.fill(); }
    else { roundRectPath(ctx, -cell * .44, -cell * .3, cell * .88, cell * .6, 10); ctx.fill(); ctx.strokeStyle = fg; ctx.lineWidth = 3; roundRectPath(ctx, -cell * .4, -cell * .26, cell * .8, cell * .52, 6); ctx.stroke(); }
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (shape === "tag") { fitFont(ctx, text, FONT.marker, 400, cell * .52, cell * .3); ctx.fillText(text, cell * .04, 4); }
    else {
      const parts = text.length > 8 ? wrapText((() => { ctx.font = `400 ${cell * .16}px ${FONT.display}`; return ctx; })(), text, cell * .62) : [text];
      const px = parts.length > 1 ? cell * .17 : fitFont(ctx, text, FONT.display, 400, cell * .66, cell * .26);
      ctx.font = `400 ${px}px ${FONT.display}`;
      parts.forEach((part, k) => ctx.fillText(part, 0, (k - (parts.length - 1) / 2) * px * 1.05));
    }
    ctx.restore();
    cells.push({ index: i, u0: col / columns, v0: 1 - (row + 1) / rows, u1: (col + 1) / columns, v1: 1 - row / rows, shape });
  });
  return { canvas, cells, columns, rows };
}

// ---------------------------------------------------------------------------------------------
// APPLICATION CASES (CD-ROM jewel-case look) — each app gets its own accent and pattern
// ---------------------------------------------------------------------------------------------
const APP_THEMES = [
  ["#f2b84b", "#1b2a34", "dots"], ["#7fd1b9", "#17302d", "grid"], ["#e87d7d", "#2c1a26", "arcs"], ["#8ab4f8", "#14202e", "lines"],
  ["#b9d66b", "#212b14", "dots"], ["#f08a5d", "#2b1b14", "grid"], ["#d6a2e8", "#241830", "arcs"], ["#6ad0e0", "#12262b", "lines"]
];
export function drawAppCase(app, index, lang = "fr", size = 512) {
  const [accent, dark, pattern] = APP_THEMES[index % APP_THEMES.length];
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = dark; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.globalAlpha = .22; ctx.lineWidth = 2;
  if (pattern === "dots") for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { ctx.beginPath(); ctx.arc(20 + x * 42, 20 + y * 42, 3 + ((x * y) % 4), 0, TAU); ctx.fill(); }
  if (pattern === "grid") for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * 42, 0); ctx.lineTo(i * 42, size); ctx.moveTo(0, i * 42); ctx.lineTo(size, i * 42); ctx.stroke(); }
  if (pattern === "arcs") for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.arc(size, 0, i * 62, Math.PI * .5, Math.PI); ctx.stroke(); }
  if (pattern === "lines") for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(0, i * 28 + 14); ctx.lineTo(size * (.3 + ((i * 37) % 70) / 100), i * 28 + 14); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent; ctx.fillRect(0, 0, size, 14);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${size * .034}px ${FONT.sans}`; ctx.fillStyle = accent;
  ctx.fillText("SOPP AGENTS · WEB APP", size * .06, size * .1);
  ctx.fillStyle = "#f6ecd8";
  const name = app.name.toUpperCase();
  const lines = wrapText((() => { ctx.font = `400 ${size * .13}px ${FONT.display}`; return ctx; })(), name, size * .86);
  const px = lines.length > 2 ? size * .1 : lines.length > 1 ? size * .115 : size * .15;
  ctx.font = `400 ${px}px ${FONT.display}`;
  const startY = size * .5 - (lines.length - 1) * px * .5;
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, size * .06, startY + i * px * 1.02));
  ctx.fillStyle = accent; ctx.font = `500 ${size * .04}px ${FONT.sans}`;
  ctx.fillText(pick(app.category, lang).toUpperCase(), size * .06, size * .88);
  ctx.fillStyle = "rgba(246,236,216,.7)"; ctx.font = `${size * .032}px ${FONT.type}`;
  ctx.fillText("CD-ROM · " + String(index + 1).padStart(2, "0") + " / 08", size * .06, size * .945);
  addGrain(canvas, .04, index + 4);
  return canvas;
}

// Generic sign face (shop signage painted on boards): returns a canvas.
export function drawSignBoard(text, { width = 1024, height = 256, bg = "#24332d", fg = "#ead8b2", border = "#c9b07a", font = FONT.display, sub = null } = {}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = border; ctx.lineWidth = Math.max(3, height * .02);
  ctx.strokeRect(height * .07, height * .07, width - height * .14, height - height * .14);
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const size = fitFont(ctx, text, font, 400, width * .84, height * (sub ? .52 : .64), 20);
  ctx.fillText(text, width / 2, height * (sub ? .43 : .52));
  if (sub) { ctx.font = `500 ${size * .26}px ${FONT.sans}`; ctx.globalAlpha = .85; ctx.fillText(sub, width / 2, height * .8); ctx.globalAlpha = 1; }
  addGrain(canvas, .045, text.length + 3);
  return canvas;
}

export function tex(canvas, options = {}) {
  return textureFrom(canvas, { srgb: true, repeat: false, anisotropy: 8, ...options });
}

export { THREE, mixHex, shadeHex };
