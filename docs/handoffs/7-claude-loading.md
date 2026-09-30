# Claude contribution: progressive photo loading

## Provenance and scope

This contribution came from an actual installed Claude Code invocation, not a Codex agent renamed Claude. Codex coordinated the request and prepared this handoff; Claude authored the design and the separate [patch proposal](7-claude-loading-proposal.patch).

- CLI: Claude Code 2.1.285, existing first-party authentication.
- Requested and runtime-reported canonical model: `claude-opus-5-5`.
- Invocation: `--model claude-opus-5-5 --effort high --tools '' --strict-mcp-config --safe-mode --disable-slash-commands --no-chrome --no-session-persistence --output-format json --print`.
- Runtime result: successful, one turn, 278,927 ms. No tools, browser session, file edits, or tests were performed by Claude.
- Source snapshot: `31c7853a0884df0408e192e468daa72d7896deb6`, read from the integration worktree before these changes. Supplied public-source excerpts covered all image consumers, boot recovery, relevant template markup, image metadata, and package/deployment configuration.
- Snapshot `src/main.js` SHA-256: `a12d82038f6f8772b6632401b0700dc1c6a104b0e17fb12ac07fd9cc5a8c5e0b`.
- The original stdout and request provenance are retained in the local `alo-office/claude-performance-*` artifacts. Private account and session identifiers are deliberately omitted from this tracked record.

## Claude's concrete contribution

Claude identified the eager seven-image aggregate, both image waits in boot, the square portrait's dependency on an unrelated image promise, and one-time `loaded` checks that permanently omitted late media. The authored proposal separates scene startup from media enhancement, replaces those one-time checks with late hydration functions (`addPostcard`, `addProofScreen`, `paintHolo`), and preserves procedural stand-ins while images are pending or fail. It also addresses detail photos, video posters, and the ProofMode raycast target width.

The attached proposal contains Claude's authored patch with context-only blank lines whitespace-normalized for the tracked archive. It is not byte-verbatim; the exact raw response and extracted patch remain in the local `alo-office/claude-performance-contribution.md` and `alo-office/claude-performance-proposal.patch` artifacts. It is an **unvalidated proposal**, not a claim about the final integrated code. It has not been applied wholesale. Codex owns integration, regression fixes, test execution, and deployment verification; final implementation and test results belong in the integration handoff/PR.

Parser check: the original diff has inaccurate hunk counts (`git apply --stat` reports a corrupt patch at line 125); `git apply --recount --stat` parses it. The archive is retained for transparent review and must not be presented as a directly applicable, tested patch.

## Integration refinements identified during review

The integrator is adapting the proposal in three explicit ways:

1. Request scene photos by station proximity and detail photos on demand, rather than warming every photograph immediately after startup.
2. Put the small square portrait directly in the template with reserved layout and failure handling, so it can start independently of the JavaScript image queue.
3. Avoid calling `renderer.compileAsync(scene, camera)` after every photo. The installed Three.js implementation calls `compile` first; repeatedly traversing the entire scene is not a guaranteed nonblocking optimization.

These refinements are Codex integration decisions, not claims that Claude's original patch contained them. A follow-up actual Claude review of the integrated source is recorded in [7-claude-loading-review.md](7-claude-loading-review.md).

## Acceptance criteria supplied by Claude

- Hold all portfolio JPEG responses: useful DOM and the 3D scene must become available without waiting for them.
- Release photos late: the UMW postcard, ProofMode image and widened hit target, and finale hologram must appear without duplicate objects or callback errors.
- Abort images: preserve the monogram/document fallbacks, omit broken drawer figures, and avoid console errors.
- Open a drawer before its media finishes: photos and the Habitat video poster must still appear when available.
- Allow only the square portrait: it appears independently; its failure preserves a usable profile entry/fallback.
- Disable WebGL: reading mode, details, and portrait behavior remain usable.
- Fail boot or lose the graphics context before a response arrives: late callbacks must not mutate a failed scene or throw.
- Preserve reduced motion, Pause motion, tour cancellation, deep links, and list-to-scene hover behavior.

Review additionally called out callback timing around `proofHit` and `holoTex`, idempotent hydration, broken profile-photo fallback, and any remaining `loaded`/`imgReady` consumers. The integrator must verify these against the actual final source and browser behavior.
