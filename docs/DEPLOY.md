# Run, check and deploy

## Local

```bash
npm install          # dev dependencies only (three, esbuild, fonts): the site itself has no build step
npm run dev          # static server on http://localhost:8080/ (PORT=9000 npm run dev to change)
npm run check        # syntax, data, paths, secrets, sizes
npm test             # node:test (shopkeeper knowledge, local FAQ, Worker, client)
```

`npm run vendor` regenerates `vendor/three.module.min.js`, `vendor/three-addons.min.js` and `assets/fonts/*.woff2` from `node_modules`. Run it **only** when upgrading `three` or the fonts (edit `package.json` first), then re-test visually. Commit the regenerated files.

URL parameters: `?quality=high|medium|low` forces a tier (also stored as `store.quality` in localStorage when the governor steps down). Use `tests/visual/harness.html?quality=medium&lang=fr` for the bare world.

Opening `index.html` through `file://` does not work (ES modules + import map); use `npm run dev`.

## GitHub Pages

The repository is `sopp24/Portfolio-V2`; the site URL is **https://sopp24.github.io/Portfolio-V2/**.

1. GitHub → Settings → Pages → **Build and deployment → Source: "GitHub Actions"** (one-time).
2. Merge/push to `main`. `.github/workflows/pages.yml` runs `npm ci`, `npm run check`, `npm test`, then publishes only the runtime files (`index.html`, `styles/`, `src/`, `vendor/`, `assets/`, `robots.txt`, `sitemap.xml`, `.nojekyll`, `404.html` if present). Docs, tests, worker and scripts are not published.
3. Other branches and pull requests run `.github/workflows/ci.yml` (same checks, no deploy).

**Sub-path safety.** The site is served from `/Portfolio-V2/`, so every local reference is relative (`./src/main.js`, `../fonts/...`). `npm run check` fails on a root-relative `/…` path in `index.html`, CSS `url()` or `fetch()`/`import()` calls. Keep it that way when adding files.

## AI backend (optional but required for a real AI)

GitHub Pages cannot hold a provider key. Deploy the Cloudflare Worker following `docs/BACKEND.md`, then put its URL in `index.html`:

```html
<meta name="assistant-endpoint" content="https://side-a-shopkeeper.<your-subdomain>.workers.dev">
```

and keep `ALLOWED_ORIGINS` in `wrangler.jsonc` limited to `https://sopp24.github.io`. Until then the site runs in catalogue mode and says so. Never commit a key; `.dev.vars` / `.env` are git-ignored and `npm run check` scans for common key patterns.

## Music (YouTube)

The soundtrack uses the official IFrame player and the video id `DEFAULT_VIDEO_ID` in `src/audio/youtube-music.js` (`RSXMwOvUui4`; `createAudioEngine({ youtubeVideoId })` can override it). Things to know: sound starts only after the visitor chooses "enter with sound"; the player must remain visible (≥ 200×200) per YouTube's policy; the random start only works if the stream exposes a DVR window; if embedding is disabled by the owner of the video the UI shows an error state. Details and limits: `src/audio/README.md`. None of this could be tested from the build sandbox.

## Custom domain later

Add a `CNAME` file containing the domain at the repository root *and* copy it in the workflow's "Assemble runtime files" step (or configure the domain in Settings → Pages), set DNS, then update the URLs in `robots.txt`, `sitemap.xml`, the Open Graph/canonical tags in `index.html` and `ALLOWED_ORIGINS` in `wrangler.jsonc`. No code change is needed: all paths are relative.

## Rollback

- Deployment: Actions → "Deploy to GitHub Pages" → re-run the workflow on a previous green commit, or `git revert` the bad commit on `main` and push.
- Worker: `npx wrangler rollback` (or redeploy a previous commit). Disabling the AI instantly is possible by removing the `assistant-endpoint` content (the site falls back to catalogue mode) — and/or deleting the `AI_API_KEY` secret.
- Vendor upgrade gone wrong: `git checkout <previous-commit> -- vendor package.json package-lock.json`.
