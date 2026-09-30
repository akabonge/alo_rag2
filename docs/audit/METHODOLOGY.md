# Responsive audit methodology

This supplements the browser smoke tests with repeatable layout measurements and screenshots. It adapts useful ideas from the reviewed roadmap archive against the current site. It does not establish a numerical design score or replace manual review.

## Run

Use the repository's locked dependencies (`npm ci`) and installed Playwright Chromium. An existing installation can also be selected with `PLAYWRIGHT_PACKAGE_PATH`, matching the smoke harness; record its version when comparing results. Start the site separately (`npm run dev`), then run:

```powershell
node scripts/audit/site-audit.mjs --quick
node scripts/audit/site-audit.mjs --devices iphone-se,laptop --url https://your-preview.example/
node scripts/audit/site-audit.mjs --devices iphone-se --enforce
node --test scripts/audit/audit-tools.test.mjs
```

The default mode writes a report without failing for budget findings. `--enforce` exits 1 for budget findings. Operational failures exit 2 in both modes. Reports and station screenshots go into `audit-output/<timestamp>/`; `--out` must remain under that directory. No form submissions, reservations, guestbook writes or paid Ask requests occur. Opening Ask measures its layout only.

Profiles emulate viewport, DPR, touch and CPU throttling in Chromium. An `iphone-15` profile is not Safari or a physical iPhone. Software WebGL is unsuitable for claiming phone FPS, battery use or thermal behavior. Physical iOS/Android, real keyboards, screen readers, browser zoom, canvas/glass contrast and visual quality remain separate checks.

## Network measurements

The initial request set is selected after content readiness (or its finite deadline) and a short settling interval. Accounting for those requests is awaited for up to three additional seconds, and the result is frozen **before scrolling, screenshots and opening Ask**. A separate later snapshot includes resources requested while visiting stations.

Playwright [`request.sizes().responseBodySize`](https://playwright.dev/docs/api/class-request#request-sizes) supplies encoded response payload bytes. Response headers are reported separately. Their sum is `transferBytes`; it excludes request/TLS overhead and is not a packet-capture total. `response.body().byteLength` supplies decoded resource bytes and never substitutes for missing encoded measurements. Redirects, interrupted streams and unavailable bodies can make accounting incomplete; pending/unavailable request counts are visible and an enforcing run cannot claim the transfer budget passed in that state. The harness disables browser cache in a fresh context.

`--cdn-dir node_modules` explicitly substitutes installed Three.js, GSAP and Lenis files for jsDelivr requests. URL decoding, package allowlisting, path containment and realpath checks prevent requests from escaping that directory. Reports identify this as **local mirror mode**. Its uncompressed/local transport is not evidence about production CDN transfer sizes. The default 4.5 MiB budget is an initial observation threshold, not a validated release target; tighten it only after repeatable measurements on the intended deployment.

## Readiness and recovery

The probe measures content visibility, loader dismissal and a usable text-version escape separately, against navigation time. DOMContentLoaded/load timing is recorded independently; waiting for unrelated resources does not define visible readiness.

The third-party-blocked run examines the page at a finite 10-second navigation deadline. A usable text-version link may be in the **loader or the recovery message**. Ancestor visibility/opacity, viewport geometry and hit testing must agree. The report separately records whether the loader is still covering the page at that moment; it does not infer that an overlay remains forever. Headless sampling of a usable link is not a full keyboard/screen-reader recovery test.

## Layout findings

- **Touch targets:** 44px is this project's ergonomic target, not a blanket claim about WCAG AA. Inline links can have applicable exceptions. The audit reports small reachable controls; an intentional `data-audit-tap-exception="reason"` is listed separately and must be justified in review.
- **Counting:** failed budget conditions, target occurrences across states, unique DOM target keys and unique target/device pairs are distinct numbers. Repeated floating buttons do not become new unique controls on every station.
- **Overlap:** fixed controls are deduplicated. Bounding-box intersections need hit-test samples, and text occlusion uses text-range samples and the actual element at each point. Transparent wrapper intersections alone are not evidence that text is covered. These samples are candidates, not exhaustive optical analysis; review screenshots, translucent paint and pointer-events-none decoration manually.
- **Typography/overflow:** the report records sampled visible text size and document horizontal overflow. It does not force all hero content into one screen or penalize necessary vertical scrolling at large text sizes.

Screenshots, per-state findings, element keys and hit-test coordinates are retained in the JSON report. Contexts and browsers close in `finally` blocks, including failed profiles. Invalid or empty device selections fail before launch.

## Reconcile roadmap tasks without duplicate issues

The roadmap importer links stable task IDs to existing quality issues #6–#11 using `scripts/roadmap/task-map.json`. It does not create 32 tickets, change labels, overwrite titles or reopen completed issues. O1/O2 remain deferred product/data-collection decisions.

```powershell
node scripts/roadmap/issues.mjs --offline
node scripts/roadmap/issues.mjs
node scripts/roadmap/issues.mjs --only M1,M4
# Only after reviewing the proposed additions and obtaining appropriate publication authorization:
node scripts/roadmap/issues.mjs --only M1,M4 --apply
```

Every command is dry-run unless `--apply` is supplied. Default dry runs read all open/closed GitHub issues; `--offline` shows explicitly unverified local mappings, and `--snapshot` accepts a saved issue array. Apply requires fresh GitHub reads and explicit IDs. Stable `<!-- alo-roadmap:M1 -->` markers avoid duplicates after title changes; conflicting markers or legacy ID-prefixed titles stop the import. Body additions live in a managed block while existing prose and checkbox state remain. Existing labels are never created or overwritten. Separate issue splits require a deliberate map update rather than automatic bulk creation.

On Windows the importer uses PowerShell 7 (`pwsh.exe` on PATH) and the office GitHub authentication wrapper. It does not alter execution policies. Other systems use the authenticated `gh` CLI directly.

Integration validation covers CLI subprocess startup, report generation, exit codes, cleanup and offline write guards, as well as accounting/path/reconciliation helpers. `npm run test:audit-browser` exercises real DOM visibility, wrapped-link hit testing and associated checkbox labels without app or API traffic. Closed details contents are excluded; a sufficiently large visible associated label is recorded as an explicit effective-target exception.

A rendered small-phone run was completed locally on 2026-09-30 with network dependencies, separately measuring encoded and decoded data. Its initial output exposed real small-control fixes and audit false positives that were corrected. Per-state occlusion candidates still require scrolling/screenshot review: content passing behind a fixed bar during ordinary scrolling is not evidence that the content is permanently inaccessible. See the release handoff and PR for final evidence; source checks alone do not validate visual results.
