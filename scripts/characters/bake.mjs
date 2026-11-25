// Bakes all characters: node scripts/characters/bake.mjs [id ...] [--lod hi|lo|both]
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildCharacter } from "./character-builder.js";
import { bakePart, packParts } from "./bake-lib.js";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/characters");
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const lodArg = args.includes("--lod") ? args[args.indexOf("--lod") + 1] : "both";
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--lod");
const all = ["visitor-a", "shopkeeper", "visitor-b"];
const lods = lodArg === "both" ? ["hi", "lo"] : [lodArg];
const only = process.env.PARTS ? process.env.PARTS.split(",") : null;

for (const id of ids.length ? ids : all) {
  const def = (await import(`./defs/${id}.js`)).default;
  for (const lod of lods) {
    console.log(`\n== ${id} (${lod}) ==`);
    const built = buildCharacter(def, lod);
    const parts = [];
    for (const spec of built.parts) { if (only && !only.includes(spec.name)) continue; parts.push(bakePart(spec)); }
    const { bin, manifest } = packParts(parts, built.manifest);
    writeFileSync(path.join(out, `${id}.${lod}.bin`), bin);
    writeFileSync(path.join(out, `${id}.${lod}.json`), JSON.stringify(manifest));
    console.log(`  -> ${id}.${lod}: ${(bin.length / 1024).toFixed(0)} KB, ${parts.reduce((s, p) => s + p.indexCount / 3, 0)} tris`);
  }
}
