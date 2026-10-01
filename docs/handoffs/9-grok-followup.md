# Grok findings: current disposition

Owner/integrator: Codex. Branch: `codex/grok-reliability-followup`, based on main `73826f5`. This reconciles [Grok's experience review, PR #12](https://github.com/akabonge/alo_rag2/pull/12) and the [progressive-media review](7-grok-loading-review.md). The historical review is preserved; it is not silently rewritten as a current audit.

## Findings acted on in this increment

- **Guestbook retry duplication:** confirmed from the old non-atomic write/acknowledgement path. Stable client UUIDs and private server receipts prevent an unchanged same-page retry from inserting the note again. The Redis quota now expires one hour after the first accepted note; retries/rejections do not extend it. [Implementation and limits](9-codex-guestbook.md).
- **Employment availability retrieval:** “Is he open to work?” previously missed Contact's explicit current Flatter/not-seeking statement. Normalizing common availability phrases now retrieves that statement without changing the facts.
- **Unrelated president question:** generic “Who is the president?” matched campus vice-president text. Qualified vice-president roles are now indexed distinctly; relevant campus questions still work.
- **Paused motion:** the preference listener already existed, but postcard Y was incremented every rendered frame using frozen time. A bounded offset from its original Y fixes continued drift. The crane celebration now uses the same pausable clock and cannot start while reduced motion is active.
- **Demo claim:** local source lists differ in length, so the uniform “23 prompt-injection patterns” claim is replaced by a description of pattern-based input checks. This does not claim that those checks prove prompt-injection resistance.

## Earlier findings reconciled against current source

| Grok finding | Current disposition |
| --- | --- |
| Duplicate compact Tour/Sound | Header controls are hidden when the dock is active; shared state keeps their two DOM instances synchronized. |
| Missing landscape dock width variable | The implemented compact dock is a horizontal bottom grid, so its measured height is the relevant space reservation. |
| Hidden sky phase | Separate phase text is visible in portrait. The whole chip is intentionally hidden below 600px height to reserve space; lighting still uses the visitor's local clock. |
| Tiny world-scaled skill names | Individual canvas labels are hidden at compact widths. Every skill is available through readable HTML category controls; selected names use collision-aware DOM labels. Supplementary canvas annotations remain. |
| Reduced-motion change needs reload | The change listener, clock freeze and navigation behavior were already present. The remaining per-object drift is fixed above. |
| Flight turns sound on | It does not opt into sound; pings respect existing consent. |
| Hero readability and small text | Main reading surfaces and primary controls improved in PR #5. Some utility/diagram labels remain below a universal 12px target; rendered contrast and real-device review remain open. |
| Loader “forever”, 4.09 MB startup, 153 tiny controls | Those were overstatements of the incoming harness. Current measurement separates timeout observations, startup/session bytes, encoded/decoded sizes and repeated failures/distinct controls. |
| 44px is the WCAG AA floor | Documentation uses 44px as the product target and distinguishes AA's 24px criterion and exceptions. |
| Photo priority, drawer shifts, failed poster, extreme ratios | Implemented and tested in merged PR #13. Late off-station photos attach while the graphics scene remains healthy; failed optional images intentionally keep stable stand-ins. |

## Evidence and boundaries

The new Ask tests exercise real local retrieval and API contracts with mocked provider responses. They do not establish factual quality or injection resistance of a live model. Grok's original 20-case table had no observed runs; the follow-up observation record distinguishes deterministic results from those still requiring model or device evaluation.

Local Node validation passed 80 tests, with the real Redis suite explicitly skipped because no local Redis server is running. CI must run that suite against its disposable Redis service before merge. Browser checks exercise explicit retry after a lost/invalid acknowledgement, unique IDs after confirmation, moderated replay messaging and actual object transforms while paused. Final run results and independent review are recorded on the integration PR.

Shared Ask abuse/cost limits remain open in [issue #9](https://github.com/akabonge/alo_rag2/issues/9); scene startup performance in [#7](https://github.com/akabonge/alo_rag2/issues/7); physical devices/assistive technology in [#8](https://github.com/akabonge/alo_rag2/issues/8); claims and typography/contrast in [#10](https://github.com/akabonge/alo_rag2/issues/10) and [#11](https://github.com/akabonge/alo_rag2/issues/11). This pass does not close those broader tasks.
