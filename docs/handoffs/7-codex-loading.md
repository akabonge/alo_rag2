# Progressive loading integration — issue #7

Branch: `codex/progressive-loading`. PR: https://github.com/akabonge/alo_rag2/pull/13. Based on main `31c7853`.

## Who contributed

- **Claude Code, actual `claude-opus-5-5`:** authored the late-photo design and the `addPostcard`, `addProofScreen`, and `paintHolo` proposal; reviewed the integrated source in a second invocation. [Design/provenance](7-claude-loading.md), [source review](7-claude-loading-review.md).
- **Grok, actual Cline/OpenRouter `x-ai/grok-4.7`:** read the changing integration source, challenged failure behavior and proposed acceptance tests. [Archived review](7-grok-loading-review.md). Its source-only findings are evaluated below; they are not browser results.
- **Codex:** integrated the authored design, demand scheduling, markup and error handling; independently reviewed races/resource ownership; wrote and ran Node/browser checks and before/after measurements. Codex helper agents remain identified as Codex.

## Changes

The welcome portrait is a native HTML request with reserved square geometry and an AK fallback. Seven unrelated full photos no longer start at page evaluation or gate boot. Three scene photos load near their section and enhance existing procedural content once; drawer images and the video poster load only when requested. Late responses are ignored after boot failure or context loss. A failed optional scene photo keeps its stand-in for that page session, without an automatic retry loop.

Known local photo dimensions reserve drawer geometry; switching a failed profile image to its alternate retains the original frame. Video posters share the bounded image loader's failure state and keep native controls with `preload="none"`. Current-station requests start at normal priority; lookahead requests start at low priority. Extreme aspect ratios are rejected before sizing scene geometry/canvases.

Refreshing visitor stars now unregisters old raycast targets, clears any removed hover, cancels their scale tweens and disposes owned materials, textures and geometry. Shared Sprite geometry and the glow texture are preserved.

## Review decisions

| Finding | Decision and evidence |
| --- | --- |
| Claude: warm all photos after readiness | Adapted to station proximity and drawer demand, avoiding the same eager cost one frame later. |
| Claude: compile the whole scene after every arrival | Omitted; the installed `compileAsync` still initiates a `compile` traversal. Further shader work needs separate measurement. |
| Claude: stale hover after visitor refresh | Added a cleanup hook after pointer bindings exist, called before resources are disposed. |
| Claude: late UMW anchor might follow a rotated globe | Checked full source: the globe quaternion is set once; flight updates do not rotate it. No reproduced defect. |
| Grok: late media is abandoned when leaving a station | Not supported by current code: `isActive` means the graphics scene has not failed, not that the station is visible. A late image still attaches after navigation. |
| Grok: failed media never retries | Intentional stable fallback for this page session. Avoid repeated failed requests; a fresh navigation can try again. Graphics context loss is terminal in the current recovery design. |
| Grok: Save-Data comment overstates behavior | Corrected to a half-station window. Smooth travel can pass intermediate windows; this is not a promise that every jump downloads only the destination photo. |
| Grok: current-station media should not start low priority | Accepted for newly started requests; earlier lookahead remains low priority. The welcome badge remains high priority. |
| Grok/Claude: drawer content shifts on photo arrival | Added verified dimensions and a reserved aspect ratio, including the profile alternate frame. |
| Grok: failed video poster bypasses image failure handling | Accepted; poster is set only after the tracked loader succeeds, tied to the original connected video. |
| Grok: extreme replacement image can create enormous geometry | Added finite positive dimensions and a generous 0.25–4 aspect-ratio bound. A valid 1×1 image is safe and is not rejected merely for being small. |
| Grok: UMW hover before hydration can stick | Event-time lookup already handles leave after hydration; attachment starts at the neutral scale. Browser/Node checks cover late attachment and repeat scheduling. |

## Validation and remaining work

The initial 20-check browser suite passed for delayed/failed media, phone/desktop views, deep links, no-WebGL and actual graphics-context loss. The expanded suite, final CI and after measurements are recorded below when complete. Tests mock API writes and never create production guestbook notes.

The baseline contains three cold/warm pairs, with per-phase marks, response sizes, cache evidence and screenshots. Local 6× CPU throttling and SwiftShader are not a physical-phone benchmark. Severe host memory pressure and variable Google Fonts requests mean timing differences cannot establish a universal percentage speedup. Module discovery, full scene construction, shader compilation and intro/render work remain separate performance tasks.
