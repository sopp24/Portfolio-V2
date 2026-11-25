// Regenerates the crawlable summary block in index.html (between STATIC markers) from src/data.
// Usage: `npm run sync` (write) or `node scripts/sync-static.mjs --check` (fails if out of date).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => import(pathToFileURL(path.join(root, p)).href);
const { PROJECTS, CATEGORIES } = await load("src/data/projects.js");
const { APPLICATIONS } = await load("src/data/applications.js");
const { PROFILE } = await load("src/data/profile.js");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lines = [];
lines.push('  <section id="seo-content" class="visually-hidden" aria-label="Adam Soppelsa — summary">');
lines.push("    <h2>Adam Soppelsa — Projects Store</h2>");
lines.push(`    <p lang="en">${esc(PROFILE.headline.en)} ${esc(PROFILE.availabilityLine.en)}</p>`);
lines.push(`    <p lang="fr">${esc(PROFILE.headline.fr)} ${esc(PROFILE.availabilityLine.fr)}</p>`);
for (const cat of CATEGORIES) {
  const items = PROJECTS.filter((p) => p.categories[0] === cat.id);
  if (!items.length) continue;
  lines.push(`    <h3>${esc(cat.en)} / ${esc(cat.fr)}</h3>`);
  lines.push("    <ul>");
  for (const p of items) lines.push(`      <li><strong>${esc(p.title.en)}</strong> — ${esc(p.short.en)}</li>`);
  lines.push("    </ul>");
}
lines.push("    <h3>SOPP Agents — web applications</h3>");
lines.push("    <ul>");
for (const a of APPLICATIONS) lines.push(`      <li><a href="${esc(a.url)}">${esc(a.name)}</a> — ${esc(a.description.en)}</li>`);
lines.push("    </ul>");
const links = PROFILE.contact.links.filter((l) => l.url).map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`);
links.push(`<a href="${esc(PROFILE.portfolioV1)}">Previous portfolio</a>`);
lines.push(`    <p>${links.join(" · ")}</p>`);
lines.push("  </section>");
const block = lines.join("\n");

const file = path.join(root, "index.html");
const html = await readFile(file, "utf8");
const next = html.replace(/(<!-- STATIC:BEGIN -->\n)[\s\S]*?(\n  <!-- STATIC:END -->)/, `$1${block}$2`);
if (process.argv.includes("--check")) {
  if (next !== html) { console.error("index.html static block is out of date. Run `npm run sync`."); process.exit(1); }
  console.log("static block up to date");
} else { await writeFile(file, next); console.log("static block regenerated"); }
