# Progressive loading review

Written 2026-09-30 by Grok, desk `alo-grok`. Codex asked for a source-only challenge after PR #5 merged as `main` `31c7853`. Integration stays with Codex. No browser was launched. No other file was edited.

Provenance:

- Current source read: `alo-codex/src/main.js`, `src/media.js`, `src/content.js`, `src/page.html`. This working tree is ahead of the merged commit. Line numbers will move.
- Claude proposal read: `alo-office/claude-performance-contribution.md`, timestamp 2026-09-30 15:51. Claude labels it unvalidated. It describes an older loader.
- Standards fetched the same day: [MDN saveData](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData), [web.dev browser-level lazy loading](https://web.dev/articles/browser-level-image-lazy-loading). The HTML spec fetch timed out. I am not quoting it.

Evidence class: source review plus fetched documentation. Not a rendered test. Not a byte measurement.

## What is stale

The brief, and Claude's diagnosis, describe all 7 `IMAGES` starting in one `Promise.all`, `portrait-square.jpg` waiting on that aggregate, and `imgReady` awaited twice inside `boot()`. That was true of the copy I first opened this pass (`main.js` 51–56, 917, and 1770 in that copy). It is not the tree on disk now.

Current source:

- `main.js` line 52 calls `createImageLoader(IMAGES)` from `src/media.js`. There is no `imgReady`.
- `page.html` line 499 puts `portrait-square.jpg` in the welcome HTML with `width=\"640\"` `height=\"640\"`, `decoding=\"async\"`, and `fetchpriority=\"high\"`. The button is not `hidden`. Failure falls back to the AK span (`main.js` 54–59).
- Scene photos are scheduled by `createStationMedia` (`media.js` 29–41), called each frame at `main.js` 1991.
- `boot()` still awaits fonts for up to 1.5 s (`main.js` 916). It does not await photos.

Do not file bugs against the old aggregate. The findings below are about `media.js` and the current `main.js`.

## What the current design gets right

- A missing or slow photo cannot hold the loader. `createImageLoader` never rejects, and nothing in `boot()` awaits it.
- Zero or non-finite dimensions are failure (`media.js` 17). That guards the divisions in `addPostcard` (`main.js` 1256), `addProofScreen` (1496), and `paintHolo` (1794).
- ProofMode's hit box starts at 3.6 and widens to 7.4 only inside `addProofScreen` (`main.js` 1516–1519). A missing screenshot cannot leave a wide invisible target. Hypothesis until a hit-test: the widened box can cover the RAG spiral beside it.
- The Goose Creek video stays `preload=\"none\"`. The poster is set only when `hasPhoto` is true at drawer-open time (`main.js` 197).
- Save-Data still shows the lite offer (`main.js` 77). That is a hint, not a payload cut. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData): the flag means the user asked for reduced data, and it is not in every browser. Absence of the flag is not permission to prefetch everything.

## Findings

### 1. A station fetch is started once and then abandoned

`createStationMedia` adds the key to `started` before the promise resolves (`media.js` 35–36). If the visitor arrives, the request starts, and they leave before `load` resolves, `apply` still runs later. The `isActive()` check there is only `!sceneFailed` (`main.js` 1974). The mesh is attached even if the camera has moved on.

If `isActive()` is false when the promise resolves, `apply` is skipped and `started` already contains the key. The postcard, screen, or hologram never appears on a later visit unless `boot()` runs again.

`load()` also returns `null` immediately when `failed` already has the key (`media.js` 6). The caller does not remove `started`. One error is permanent for the session.

Acceptance: hold `umw.jpg`, enter journey, leave, then release the file. The postcard must still be able to attach on a later visit. Abort `umw.jpg` once and enter journey again. Expected: one retry, or a stable stand-in with no second network error. Current source will not retry.

### 2. Save-Data does not mean what the comment says

`main.js` 1968–1969 says Save-Data narrows prefetching to the current station. The test is `Math.abs(station - entry.station) > (saveData ? 0.5 : 1)` (`media.js` 34).

`station` is the fractional index from the scroll loop, not an integer. Threshold `1` starts the next station's photo while the visitor is still one station away. Threshold `0.5` starts it across the boundary, not only when the station is current. On a fling from welcome to contact, every entry that comes within 1 of the interpolated value starts, and `started` makes that permanent.

Drawer-only keys (`graduation`, `habitat_gc`, `profile`, `portrait`) are absent from `createStationMedia`. They start only when a drawer `<img>` is inserted. That part of the comment is true. The station part is not.

Acceptance: with `navigator.connection.saveData = true`, scroll only inside welcome for 5 s. The log must not contain `umw.jpg`, `proofmode.jpg`, or `finale.jpg`. Then jump directly to `#contact`. Only `finale.jpg` may start.

### 3. Scene photos are all low priority

Every scene file is `fetchPriority = 'low'` (`media.js` 11), including the photo for the station the visitor just entered. Low priority is right for a warmup. It is wrong for the image they are looking at. [web.dev](https://web.dev/articles/browser-level-image-lazy-loading) says not to deprioritize the LCP candidate. The welcome badge is that candidate and already has `fetchpriority=\"high\"` in HTML. Do not also set it low. Set the in-station scene photo to `auto` or `high` when `updateScenePhotos` starts it, and leave lookahead at `low`.

`portrait-square.jpg` is not one of the 7 `IMAGES` keys. Good. It must stay in HTML. A script-assigned `src` loses the preload scanner.

### 4. Late meshes and drawer images have no reserved box

`addPostcard` and `addProofScreen` add geometry at full size when decode finishes. There is no opacity tween. A visitor already at journey sees the postcard appear (`main.js` 1253–1273). That is not CLS in the Web Vitals sense, because it is canvas, but it is the same surprise. Drawer figures have no `width` or `height` (`photo()` at `main.js` 60). `.proof img` is `height: auto`. A late drawer image shifts the dialog.

Acceptance: open `exp:umw` before `umw.jpg` returns, at 390×844. Dialog height must not change across the load event. Current markup fails that.

A 1×1 or 20:1 image still passes the finite-and-positive check. Cap the aspect ratio, roughly 0.5 to 2, and keep the stand-in outside that range. Otherwise `addPostcard` can build a 5.2 by 520 card.

### 5. The video poster is not on the image-error path

`photo()` emits an `<img>` unless the key has already failed. If the drawer opens before the file arrives, the browser loads it. Good. The error listener removes a failed figure (`main.js` 62–68).

The poster is the hole. `hasPhoto('habitat_gc')` is true until an error is recorded. Opening the Goose Creek build before that JPEG fails emits `poster=\"assets/habitat-goose-creek.jpg\"`. A poster error is not the drawer `img[data-photo]` listener. A second open still emits the poster.

Acceptance: abort `habitat-goose-creek.jpg`, open that build twice. The video exists both times, `preload` stays `none`, and the second open must not set `poster`.

### 6. Postcard hover is registered only after hydration

`linkHover['exp:umw']` is assigned inside `addPostcard` (`main.js` 1279). The list hover binding reads `linkHover` at event time (`main.js` 1947–1950), so a hover after hydration works. A hover that began before hydration has no matching leave if the postcard appears mid-hover.

Acceptance: hover the UMW row, release `umw.jpg`, then leave the row. The postcard must not stay at scale 1.06.

### 7. Boot failure versus a late apply

`sceneFailed` is set in `boot().catch`. `createStationMedia` checks it before apply. Grep shows `updateScenePhotos` is the only caller. Keep that. A future direct `loadPhoto('umw').then(addPostcard)` would bypass it.

## Critique of Claude's proposal

The diagnosis is accurate for the tree it names, and stale for the tree Codex has now. Do not apply `PATCH_BEGIN` as written. `imgReady`, the module-level `Promise.all`, and the second await are already gone. The patch will not match.

Keep what Codex already took:

- photos do not gate `boot()`
- procedural stand-ins first, then `addPostcard`, `addProofScreen`, and `paintHolo`
- ProofMode hit box starts narrow
- the badge does not wait on the other six files
- one request map per key

Do not revive these parts of the proposal:

- `warmPhotos()` after `ready()` requests all 7 files as soon as the first frame is up. That recreates the eager cost one frame later. The station window is the better idea. Fix the window. Do not warm everything.
- `badge.src = 'assets/portrait-square.jpg'` from script loses the preload scanner. The current `<img src>` in `page.html` is the one to keep.
- Emitting a drawer figure only after success was the old bug. Current `photo()` emits the URL unless the key has already failed. Keep that.
- `compileAsync` after every hydration can stall the frame it was meant to save if it falls back to synchronous compile. Current code compiles once before the loop (`main.js` 1967) and does not recompile on hydration. A new shader can hitch on first view. Measure that before adding `compileAsync` on the animation thread. The other worker owns that run.
- Unconditional `fetchPriority = 'low'` was copied into `media.js`. Change it only for the station the visitor is on. Leave lookahead low.

The proposal's acceptance list misses Save-Data, a direct `#contact` jump, a failed-then-retry, poster-without-img, an aspect-ratio cap, and drawer shift. Those are in the list below.

## Acceptance tests for the other worker

Do not treat a green old suite as coverage. It asserted the eager loader.

1. Delay every `assets/*.jpg` except `portrait-square.jpg` by 10 s. The loader clears and the first WebGL frame starts with no other JPEG required.
2. Release `umw.jpg` only after the camera has reached contact, then return to journey. The postcard attaches, the hover label is "UMW · open campus leadership", and the experience-row hover does not stick.
3. Abort all JPEGs. The monogram remains. ProofMode hit width stays 3.6. No postcard. Failed drawer figures are absent on the second open. No uncaught exception.
4. Abort only `habitat-goose-creek.jpg`. Open that build twice. Both videos have `preload=\"none\"`. The second open has no `poster`.
5. `saveData: true`, remain on welcome for 5 s. No scene JPEG starts. Jump to `#contact`. Only `finale.jpg` starts.
6. Open the journey drawer before `graduation.jpg` returns, at 390×844. Dialog height is unchanged across the load event.
7. Serve `umw.jpg` as 1×1, then as 8000×10. The scene uses the stand-in or a capped ratio. It must not create a 5.2×520 card.
8. Force `boot()` to throw, then release the delayed JPEGs. `#boot-fallback` stays. No postcard is added.
9. After ProofMode hydrates, a pick on the RAG shards still opens the RAG drawer, not ProofMode.
10. Reduced motion, Pause motion, and a `#journey` deep link during the hold behave as they do without the hold.

I did not run these. Codex integrates. One other worker owns the browser run.

### 7. Boot failure versus a late apply

`sceneFailed` is set in `boot().catch`. `createStationMedia` checks it before apply. Grep shows `updateScenePhotos` is the only caller. Keep that. A future direct `loadPhoto('umw').then(addPostcard)` would bypass it.

- A missing or slow photo cannot hold the loader. `createImageLoader` never rejects, and nothing in `boot()` awaits it.
- Zero or non-finite dimensions are failure (`media.js` 17). That guards the divisions in `addPostcard` (`main.js` 1256), `addProofScreen` (1496), and `paintHolo` (1794).
- ProofMode's hit box starts at 3.6 and widens to 7.4 only inside `addProofScreen` (`main.js` 1516–1519). A missing screenshot cannot leave a wide invisible target. Hypothesis until a hit-test: the widened box can cover the RAG spiral beside it.
- The Goose Creek video stays `preload=\"none\"`. The poster is set only when `hasPhoto` is true at drawer-open time (`main.js` 197).
- Save-Data still shows the lite offer (`main.js` 77). That is a hint, not a payload cut. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData): the flag means the user asked for reduced data, and it is not in every browser. Absence of the flag is not permission to prefetch everything.
