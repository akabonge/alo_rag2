# Progressive-loading validation — 2026-09-30

The reliable change is structural: the initial welcome view requests one image instead of eight, and its portrait no longer waits for unrelated photos. All six measured after starts reached 3D without JavaScript errors or fallback. The focused browser suite passed 26/26 checks for delayed/failed photos, reserved drawer geometry, video poster failure, no WebGL and actual context loss.

After the decorative project-label cleanup, a scoped rerun passed 15/15 checks at 390×844 and 1440×900. Screenshots confirm the two overlapping labels are gone; both HTML project names and badges remain. Real pointer hits open the correct ProofMode and Emergency Alerting RAG dialogs. This adds two checks to the earlier suite, for 28 distinct tested assertions; it is not a claim that all 28 were rerun in one local invocation.

## Source and method

- Before: `41cf856a930dc35bb3d5f1f3e6dc904d9798211e`, source-equivalent to merge `31c7853` (`git diff 41cf856 31c7853 -- src` is empty).
- After: frozen clean application source at `e1284899ed9abe9437f7dba1820ebacbcccee2f4`, including corrected 540×960 video ratio. The timing snapshot predates removal of two overlapping decorative project-label sprites. That later visual cleanup has separate viewport checks; its timing was not measured.
- Chromium 151.0.7922.34, headless SwiftShader, 375×667 CSS pixels, DPR2, mobile/touch emulation, no reduced-motion preference, 6× CPU slowdown. One browser, three sequential fresh-context/cleared-HTTP-cache starts, each followed by a warm same-page navigation. Browser/GPU process state persists across pairs.
- Static localhost source, HTML uncached and other files cached for one hour, real CDN modules/fonts, no bandwidth throttle, mocked read-only guestbook. These are software-emulated laptop measurements, not physical-phone FPS or production field percentiles.
- Heading visibility means loader computed visibility is hidden, heading opacity exceeds 0.05, and its midpoint receives a real hit test. It measures first visibility, not full intro-animation completion. Startup marks are injected into served responses only.

Source snapshots, SHA-256 manifests, unchanged measurement script, raw JSON and screenshots are retained locally in `../alo-office/qa/performance-2/` (`before/`, `after/`, `before-src/`, `after-src/`). The commands used there were `node measure-startup.cjs before 3` and `node measure-startup.cjs after 3`. Raw artifacts are not published by this document.

## Every measured navigation

Seconds from navigation start. All twelve runs initialized WebGL without fallback or JavaScript errors; no sample is discarded.

| Pair / cache | Before first draw | After first draw | Before loader hidden | After loader hidden | Before heading visible | After heading visible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 cold | 10.77 | 7.78 | 11.96 | 8.47 | 13.09 | 9.08 |
| 1 warm | 4.51 | 3.32 | 5.55 | 4.03 | 6.54 | 4.62 |
| 2 cold | 8.50 | 4.73 | 9.29 | 5.61 | 9.93 | 6.17 |
| 2 warm | 3.53 | 3.55 | 4.41 | 4.45 | 4.88 | 4.75 |
| 3 cold | 21.38 | 6.04 | 22.64 | 6.85 | 23.81 | 7.26 |
| 3 warm | 7.23 | 5.66 | 8.34 | 6.74 | 9.27 | 7.03 |

Observed heading medians were before/after 13.09/7.26s cold and 6.54/4.75s warm. **These are descriptive samples, not a percentage-speedup claim.** The before host had 144–619MiB free after navigations; after had 637–1029MiB. Baseline cold pair 3 also had a 7.26s Google Fonts CSS request, versus 0.177–0.199s in the after cold runs. Host contention and CDN variation confound causal attribution.

## Request and dependency evidence

| Initial-view metric | Before | After |
| --- | ---: | ---: |
| Image requests, every run | 8 | 1 |
| Combined cold image-response bytes, every pair | 1,514,896 | 55,529 |
| Total requests | 43 | 37 |
| Warm cached requests | 41 | 35 |

The new helper adds a module request while seven initial image requests are deferred. The image-response difference is 1,459,367 bytes (about 1.39MiB), measured by CDP on local HTTP responses including response overhead. It is not a production-compression or lifetime-download claim: station and drawer photos still load on demand.

After cold portrait requests begin at 0.079–0.132s, before main evaluation; before the square portrait started at 4.89–16.16s after the eager image batch. Both old `imgReady` waits are absent in the final source, and measurement hooks correctly report their timings as absent rather than zero. Separate controlled-network tests establish readiness while full-size photos remain held, successful enhancements after more than five seconds, and no repeated requests on revisiting stations.

## Remaining work

Initial full-scene construction and shader work remain material. After scene-build intervals are 1.52–2.14s cold and 1.08–2.55s warm; longest tasks are still 0.63–1.36s. Local main download finishes at 0.087–0.141s cold while main evaluation starts at 2.07–3.90s. These are wall intervals, not exclusive function CPU times. A subsequent trace should investigate module discovery/main-thread work, offscreen geometry, shader/first-frame scheduling and loader/intro timing on a stable device.

The media test command is `node test/media-browser.cjs http://127.0.0.1:5174 <artifact-directory>` with a local server serving `src`. `MEDIA_VIEWS_ONLY=1` limits it to phone/desktop sequences. It mocks APIs and exposes scene observations only in the locally served test module. Physical-device testing and production field measurements remain separate validation tasks.
