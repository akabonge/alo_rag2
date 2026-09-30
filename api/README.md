# AI Alo 3D (test site)

Standalone 3D version of aialo.io. Separate from the live 2D site.

## Run it locally
```bash
cd ai-alo-3d
npm run dev          # or: cd src && python3 -m http.server 5173
# open http://localhost:5173
```
It must be served over http (not opened as a file) because it uses ES modules.
Libraries load from jsDelivr via the import map in `src/index.html`, so no build step is needed.

## Files
- `src/index.html` – page, styles, import map (generated from `src/page.html` by `npm run build:page`)
- `src/main.js` – the 3D world: scene, 7 stations, camera path, interactions, sound
- `src/content.js` – all text, links, demo URLs and photo slots. Edit copy here.
- `src/ask.js` – "Ask about Alo": on-device BM25 retrieval over the site content
- `src/flags.js` – Uganda and US flags drawn in code
- `src/assets/` – drop your photos here (see IMAGES in content.js)

## Deploy + turn on the real RAG answers (Vercel, free tier)
1. Push this folder to a GitHub repo (or run `npx vercel` in it).
2. On vercel.com: New Project → import the repo. `vercel.json` already serves `src/` and deploys `api/ask.js`.
3. Project → Settings → Environment Variables: add `ANTHROPIC_API_KEY` (from console.anthropic.com). Optional: `ANTHROPIC_MODEL`.
4. Redeploy (Deployments → ⋯ → Redeploy) so the function picks up the key. `ASK_ENDPOINT` in content.js is already '/api/ask'.
5. Optional custom domain: Vercel → Domains → add `3d.aialo.io`, then add the CNAME it shows at your DNS provider.

How it works: the question goes to /api/ask → BM25 retrieval over the site content (src/ask.js) → top 4 chunks are
sent to Claude Haiku with a "use only these sources, cite [n]" prompt → answer + sources come back.
Cost is roughly $0.002 per question. The function rate-limits to 8 questions/minute per visitor.
Without an endpoint, the claude.ai-hosted copy uses the viewer's own Claude, and anything else shows the best-matching sentences.

## Guestbook (stars in the sky) — free
1. Vercel → your project → Storage → Create → Upstash for Redis (free plan) → connect to the project. Vercel adds the env vars.
2. Optional moderation key: add `GUESTBOOK_ADMIN_KEY` (any long random string). Remove a note with
   `curl -X DELETE -H "x-admin-key: YOUR_KEY" "https://3d.aialo.io/api/guestbook?t=<note t value>"`
3. Redeploy. Notes are cleaned (no links/HTML), filtered for abuse, capped at 90 characters, and limited to 3 per visitor per hour.

## Luganda voice
The "Hear it" button plays `src/assets/oli-otya.mp3` if it exists. Record yourself saying "Oli otya?" (phone voice memo,
export as mp3) and drop it in. Without it, the browser reads a phonetic version.

## Share card
`src/og.jpg` is the preview image. The og: tags in `src/page.html` point to https://3d.aialo.io/ — change them if your URL differs.

## Hidden surprises
Click the crane 5 times · type "habitat" · type "oli otya".

## Sound
The Sound button plays a generative score (no files): brown-noise bed, slow organ-like chords per station, bell "stars",
and Kiganda drums + amadinda over the Uganda globe and during the flight.
To add a music loop: put a file you have the rights to in `src/assets/` and set `SOUNDTRACK` in content.js.

## Costs
Free: Vercel Hobby, Upstash Redis free tier (10k commands/day), browser voice + speech input, all 3D/audio.
Paid (usage only): Anthropic API for Ask about Alo, about $0.001-0.002 per new question; set a monthly cap in console.anthropic.com.

## Packages
three 0.186.1 · gsap 3.15.0 · lenis 1.3.26

## Keeping it fresh
- **Deep links**: every stop has its own link, e.g. `https://3d.aialo.io/#community`, `#stars`, `#experience`. The address bar follows the visitor.
- **Text version**: `src/text.html` is generated from `content.js` by `npm run build:page` (fast, accessible, crawlable). Linked from the page head, the skip link and the no-3D fallback.
- **Analytics**: turn on Vercel → project → Analytics. The script only loads on `*.vercel.app` and `aialo.io` hosts.
