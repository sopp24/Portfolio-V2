// Project checks: `npm run check`. Plain Node ESM, no dependencies.
//  (a) syntax of every JS module  (b) data integrity  (c) static paths in index.html (GitHub Pages sub-path safe)
//  (d) secret scan                (e) payload sizes
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const section = (title) => console.log("\n== " + title);

async function walk(dir, { skip = [] } = {}) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, { skip }));
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- (a) syntax
section("(a) JavaScript syntax (node --check)");
{
  let count = 0;
  const files = [];
  for (const dir of ["src", "worker", "scripts", "tests"]) {
    for (const file of await walk(path.join(root, dir))) if (/\.(m?js)$/.test(file)) files.push(file);
  }
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    count++;
    if (result.status !== 0) fail(`syntax error in ${rel(file)}:\n${(result.stderr || "").trim().split("\n").slice(0, 6).join("\n")}`);
  }
  console.log(`${count} files checked`);
}

// ---------------------------------------------------------------- (b) data integrity
section("(b) Data integrity");
try {
  const load = (p) => import(pathToFileURL(path.join(root, p)).href);
  const { PROJECTS, CATEGORIES } = await load("src/data/projects.js");
  const { APPLICATIONS } = await load("src/data/applications.js");
  const { PROFILE, PROFILE_PENDING } = await load("src/data/profile.js");

  const dupes = (list, key) => list.map((x) => x[key]).filter((v, i, a) => a.indexOf(v) !== i);
  for (const key of ["id", "slug"]) {
    const d = dupes(PROJECTS, key);
    if (d.length) fail(`duplicate project ${key}: ${[...new Set(d)].join(", ")}`);
  }
  const dc = dupes(CATEGORIES, "id");
  if (dc.length) fail(`duplicate category id: ${dc.join(", ")}`);
  const da = dupes(APPLICATIONS, "id");
  if (da.length) fail(`duplicate application id: ${da.join(", ")}`);

  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  for (const c of CATEGORIES) if (!c.fr || !c.en) fail(`category ${c.id}: missing fr/en label`);
  const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
  for (const p of PROJECTS) {
    const where = `project "${p.id}"`;
    if (!nonEmpty(p.id) || !nonEmpty(p.slug)) fail(`${where}: id and slug are required`);
    for (const field of ["title", "short"]) {
      if (!p[field] || !nonEmpty(p[field].fr) || !nonEmpty(p[field].en)) fail(`${where}: ${field} needs non-empty fr and en`);
    }
    if (!Array.isArray(p.categories) || p.categories.length === 0) fail(`${where}: categories must be a non-empty array`);
    else for (const id of p.categories) if (!categoryIds.has(id)) fail(`${where}: unknown category "${id}"`);
    if (p.year !== null && p.year !== undefined && !Number.isInteger(p.year)) fail(`${where}: year must be an integer or null`);
    if (p.artwork && (!Array.isArray(p.artwork) || p.artwork.length !== 3 || !p.artwork.every((c) => /^#[0-9a-f]{6}$/i.test(c)))) fail(`${where}: artwork must be 3 hex colours`);
    for (const field of ["context", "challenge", "role", "outcome"]) {
      const v = p[field];
      if (v && (typeof v !== "object" || (v.fr && !v.en) || (v.en && !v.fr))) fail(`${where}: ${field} must provide both fr and en`);
    }
    if (p.work) for (const lang of ["fr", "en"]) if (!Array.isArray(p.work[lang])) fail(`${where}: work.${lang} must be an array`);
  }
  const used = new Set(PROJECTS.map((p) => p.categories?.[0]));
  for (const c of CATEGORIES) if (!used.has(c.id)) warn(`category "${c.id}" has no project (its bin is empty of featured records)`);

  const isHttp = (u) => typeof u === "string" && /^https?:\/\/[^\s]+$/.test(u);
  for (const a of APPLICATIONS) {
    if (!nonEmpty(a.name)) fail(`application ${a.id}: name required`);
    if (!isHttp(a.url)) fail(`application ${a.id}: url must be http(s)`);
    if (!isHttp(a.repository)) fail(`application ${a.id}: repository must be http(s)`);
    if (!a.description || !nonEmpty(a.description.fr) || !nonEmpty(a.description.en)) fail(`application ${a.id}: description needs fr and en`);
    if (!a.category || !nonEmpty(a.category.fr) || !nonEmpty(a.category.en)) fail(`application ${a.id}: category needs fr and en`);
  }
  if (APPLICATIONS.length > 8) warn(`${APPLICATIONS.length} applications: the SOPP Agents rack lays out 2 rows of 4 (see docs/CONTENT.md)`);

  if (!nonEmpty(PROFILE.name)) fail("profile.name required");
  for (const link of PROFILE.contact?.links || []) {
    if (!nonEmpty(link.id) || !nonEmpty(link.label)) fail("profile.contact.links: id and label required");
    if (link.url !== null && !/^https:\/\/[^\s]+$/.test(link.url)) fail(`profile link "${link.id}": url must be https or null`);
  }
  if (PROFILE.contact?.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(PROFILE.contact.email)) fail("profile.contact.email must be null or a valid address");
  if (PROFILE.cv?.url !== null && !nonEmpty(PROFILE.cv.url)) fail("profile.cv.url must be null or a path/URL");
  if (PROFILE.cv?.url && !/^https?:/.test(PROFILE.cv.url) && !existsSync(path.join(root, PROFILE.cv.url))) fail(`profile.cv.url points to a missing file: ${PROFILE.cv.url}`);

  console.log(`${PROJECTS.length} projects, ${CATEGORIES.length} categories, ${APPLICATIONS.length} applications`);
  section("Pending information (to be supplied by the owner)");
  const pending = PROFILE_PENDING || [];
  const width = Math.max(...pending.map((x) => x.length), 10);
  console.log("  " + "FIELD".padEnd(width) + "  STATE");
  for (const item of pending) console.log("  " + item.padEnd(width) + "  pending");
  const nullYears = PROJECTS.filter((p) => p.year == null).map((p) => p.id);
  if (nullYears.length) console.log(`  project years not provided: ${nullYears.join(", ")}`);
  const provisional = PROJECTS.filter((p) => p.visualStatus === "provisional").length;
  console.log(`  provisional sleeve artwork: ${provisional}/${PROJECTS.length}`);
} catch (error) {
  fail("data modules could not be imported: " + (error && error.message));
}

// ---------------------------------------------------------------- (c) static paths
section("(c) index.html paths");
{
  const indexPath = path.join(root, "index.html");
  if (!existsSync(indexPath)) warn("index.html not found: static path check skipped");
  else {
    const html = await readFile(indexPath, "utf8");
    const targets = new Set();
    for (const m of html.matchAll(/\b(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi)) targets.add(m[1]);
    const importMap = html.match(/<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
    if (importMap) {
      try {
        const map = JSON.parse(importMap[1]);
        for (const v of Object.values(map.imports || {})) targets.add(v);
        for (const scope of Object.values(map.scopes || {})) for (const v of Object.values(scope)) targets.add(v);
      } catch { fail("import map in index.html is not valid JSON"); }
    }
    let checked = 0;
    for (const target of targets) {
      if (/^(https?:|mailto:|tel:|data:|blob:|#|javascript:)/i.test(target) || target.startsWith("//")) continue;
      if (target.startsWith("/")) { fail(`root-relative path "${target}" breaks GitHub Pages sub-path hosting: use a relative path`); continue; }
      const file = path.join(root, target.split(/[?#]/)[0]);
      checked++;
      if (!existsSync(file)) fail(`index.html references a missing file: ${target}`);
    }
    // CSS url(...) in the stylesheets we ship
    for (const dir of ["styles", "assets"]) {
      for (const file of await walk(path.join(root, dir))) {
        if (!file.endsWith(".css")) continue;
        const css = await readFile(file, "utf8");
        for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
          const u = m[1];
          if (/^(https?:|data:|#)/i.test(u)) continue;
          if (u.startsWith("/")) { fail(`${rel(file)}: root-relative url(${u})`); continue; }
          checked++;
          if (!existsSync(path.resolve(path.dirname(file), u.split(/[?#]/)[0]))) fail(`${rel(file)}: missing file for url(${u})`);
        }
      }
    }
    // absolute "/..." paths inside JS modules that fetch local resources
    for (const file of await walk(path.join(root, "src"))) {
      if (!file.endsWith(".js")) continue;
      const code = await readFile(file, "utf8");
      for (const m of code.matchAll(/\b(?:fetch|import)\(\s*["'`](\/[^"'`/][^"'`]*)["'`]/g)) fail(`${rel(file)}: root-relative path "${m[1]}"`);
    }
    console.log(`${checked} local references verified`);
  }
}

// ---------------------------------------------------------------- (d) secrets
section("(d) Secret scan");
{
  const patterns = [
    [/\bsk-[A-Za-z0-9_-]{20,}/, "provider-style secret key (sk-...)"],
    [/\bsk-ant-[A-Za-z0-9_-]{10,}/, "Anthropic-style key"],
    [/(?:api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{24,}["']/i, "long literal assigned to a key/secret/token/password"],
    [/Bearer\s+ey[A-Za-z0-9_-]{10,}/, "JWT bearer token"],
    [/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, "private key block"],
    [/\bghp_[A-Za-z0-9]{30,}/, "GitHub token"],
    [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"]
  ];
  const skipDirs = ["node_modules", "vendor", ".git", ".wrangler"];
  const textExt = /\.(m?js|json|jsonc|html|css|md|txt|yml|yaml|xml|toml|example)$|^\.(env|dev\.vars)/;
  let scanned = 0;
  for (const file of await walk(root, { skip: skipDirs })) {
    const base = path.basename(file);
    if (!textExt.test(base) && !/^\.(env|dev\.vars)/.test(base)) continue;
    if (base === "package-lock.json" || base === "check.mjs") continue;
    const info = await stat(file);
    if (info.size > 2_000_000) continue;
    const text = await readFile(file, "utf8");
    scanned++;
    for (const [re, label] of patterns) {
      const m = text.match(re);
      if (m) fail(`possible secret in ${rel(file)}: ${label}`);
    }
  }
  // real env files must never be committed
  for (const name of [".env", ".dev.vars"]) if (existsSync(path.join(root, name))) warn(`${name} exists locally: make sure it stays untracked`);
  console.log(`${scanned} text files scanned`);
}

// ---------------------------------------------------------------- (e) sizes
section("(e) Payload sizes");
{
  const fmt = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + " MB" : (n / 1024).toFixed(1) + " KB");
  for (const dir of ["vendor", "assets", "src", "styles"]) {
    const files = await walk(path.join(root, dir));
    let total = 0;
    const rows = [];
    for (const f of files) { const s = (await stat(f)).size; total += s; rows.push([rel(f), s]); }
    console.log(`${dir.padEnd(8)} ${String(files.length).padStart(3)} files  ${fmt(total)}`);
    if (dir === "vendor" || dir === "assets") rows.sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([f, s]) => console.log(`           ${f}  ${fmt(s)}`));
    if (dir === "assets" && total > 3 * 1048576) warn(`assets/ is ${fmt(total)}: consider optimising`);
  }
}

console.log("");
for (const w of warnings) console.log("warning: " + w);
if (errors.length) {
  for (const e of errors) console.error("ERROR: " + e);
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`OK (${warnings.length} warning${warnings.length === 1 ? "" : "s"}).`);
