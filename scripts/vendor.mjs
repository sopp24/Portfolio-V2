// Rebuilds the vendored runtime files (three.js, add-ons, fonts) from node_modules.
// The site itself needs no build step: these outputs are committed so GitHub Pages can serve them as-is.
import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(root, ...parts);

await mkdir(p("vendor"), { recursive: true });
await mkdir(p("assets/fonts"), { recursive: true });

await build({
  entryPoints: [p("node_modules/three/build/three.module.js")],
  outfile: p("vendor/three.module.min.js"),
  bundle: true, minify: true, format: "esm", target: "es2020", legalComments: "none"
});

await build({
  entryPoints: [p("scripts/addons-entry.js")],
  outfile: p("vendor/three-addons.min.js"),
  bundle: true, minify: true, format: "esm", target: "es2020", legalComments: "none",
  external: ["three"]
});

const fonts = [
  ["poppins", "poppins-latin-400-normal"], ["poppins", "poppins-latin-500-normal"],
  ["poppins", "poppins-latin-600-normal"], ["poppins", "poppins-latin-700-normal"],
  ["anton", "anton-latin-400-normal"], ["caveat", "caveat-latin-600-normal"],
  ["permanent-marker", "permanent-marker-latin-400-normal"],
  ["special-elite", "special-elite-latin-400-normal"],
  ["playfair-display", "playfair-display-latin-700-normal"],
  ["playfair-display", "playfair-display-latin-700-italic"],
  // modern set (art direction v2): wide display, grotesque UI, mono HUD
  ["unbounded", "unbounded-latin-400-normal"], ["unbounded", "unbounded-latin-600-normal"],
  ["unbounded", "unbounded-latin-800-normal"], ["unbounded", "unbounded-latin-900-normal"],
  ["space-grotesk", "space-grotesk-latin-400-normal"], ["space-grotesk", "space-grotesk-latin-500-normal"],
  ["space-grotesk", "space-grotesk-latin-600-normal"], ["space-grotesk", "space-grotesk-latin-700-normal"],
  ["jetbrains-mono", "jetbrains-mono-latin-400-normal"], ["jetbrains-mono", "jetbrains-mono-latin-500-normal"],
  ["jetbrains-mono", "jetbrains-mono-latin-700-normal"]
];
for (const [pkg, file] of fonts) {
  await copyFile(p("node_modules/@fontsource", pkg, "files", file + ".woff2"), p("assets/fonts", file + ".woff2"));
}
console.log("Vendored three.js", "and", fonts.length, "fonts.");
