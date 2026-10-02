# Local Phi and Llama desks (Claude)

Requested by Alo on 2026-10-01: add the two installed Ollama models to the office so five models share the work, alongside Claude, Codex and Grok.

## What changed

- `scripts/office/local.ps1`: sends a small `proofread`, `plain`, `summarize` or `commit` job to `phi4-mini` or `llama3.1:8b-instruct-q4_K_M` through local Ollama. Input is capped at 6,000 characters. Each draft is saved with model digest, input hash and timing under `alo-office/local/`. Proofreading adds a script-based em dash check.
- `docs/OFFICE.md`: desk table, diagram and a "Local desks" section with commands, measured limits and what not to use them for.
- `docs/HANDOFF.md`, `AGENTS.md`: list the local desks as draft helpers that the requesting desk verifies.

## Checks actually run

- Ollama benchmark on this laptop: llama3.1 8B 4.7 tokens/s (25 s cold load), phi4-mini 7.8 tokens/s.
- `proofread` on a planted sentence: Phi found the misspelling and both repeated words, missed the em dash; the script check reported it. 12-20 s.
- `commit` on this change's diff stat: Llama returned a usable draft subject in 56 s.
- `plain` on `src/main.js` (156,779 characters) was refused by the input cap before any model call.
- `git diff --check` clean.

## Remaining

- No site code changed; nothing to deploy from this branch.
- The Codex desk's model setting (`.codex/config.toml`) is unchanged. Alo plans to use a smaller ChatGPT model; update the desk table once chosen.
- Local desks are unsuitable for agent loops (Cline) at these speeds.
