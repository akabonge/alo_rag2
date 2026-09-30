# Office handoff board

The team works in separate Git worktrees. This file is a checked-in index; it does **not** synchronize uncommitted changes across windows. Use the repository's GitHub issues and pull requests for shared task status.

## Start here

1. Read [OFFICE.md](OFFICE.md) and `AGENTS.md`.
2. Choose one assigned issue; check whether somebody already owns its files.
3. Create a task branch in your worktree, implement or review the acceptance criteria, and record evidence.
4. Add a handoff using [the template](handoffs/TEMPLATE.md) and link it in the PR.

## Team desks

| Desk | Worktree | Default responsibility |
| --- | --- | --- |
| Claude | `../alo-claude` | UX, architecture, review |
| Codex | `../alo-codex` | Implementation, validation, assigned integration |
| Grok / Cline | `../alo-grok` | Research, critique, edge cases |

## Initial queue

The initial office installation created these labeled GitHub issues. They are assignments, not a claim that an external model has already completed them. The reusable workspace script does not create issues.

- [Claude #1](https://github.com/akabonge/alo_rag2/issues/1): review the portfolio's mobile reading/navigation flow and propose a small ranked list of improvements.
- [Codex #2](https://github.com/akabonge/alo_rag2/issues/2): make the ProofMode architecture understandable on narrow phones, with a readable text equivalent and focused verification.
- [Grok #3](https://github.com/akabonge/alo_rag2/issues/3): independently review the AI explanation and case-study claims against source code and primary sources.

## Latest baseline

The active quality program is [QUALITY-PLAN.md](QUALITY-PLAN.md), with role-assigned issues #6–#11. The first responsive release and independent review evidence are in [handoffs/6-codex.md](handoffs/6-codex.md). PR #5 now includes the earlier diagram task and the first quality release.

The portfolio already has grounded retrieval, current Flatter employment wording, a ProofMode case study, uptime checks and an accessible 2D-to-3D link. Preserve these while improving the office or site.
