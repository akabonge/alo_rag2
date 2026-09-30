# Office bootstrap — Codex

- Owner / branch: Codex, `codex/office-setup`
- Status: ready for integration after runtime checks
- Starting commit: `5ab6e07`

## Result

Added shared agent instructions, project model settings, desk setup/open/status scripts, a GitHub credential wrapper, issue/PR templates, and the office runbook. Initial GitHub tasks are Claude #1, Codex #2 and Grok #3.

## Verification

PowerShell parser and setup dry-run checks passed. The script author checked workspace JSON, invalid refs, branch ownership and detached/wrong-repository rejection. An independent review caught GitHub-account precedence and inaccurate profile-isolation wording; both were corrected. The GitHub helper was then verified against the intended account without displaying credentials.

## Runtime boundary

Claude Code and Codex sign-in were verified during installation. Cline was installed; OpenRouter account/key connection is still a user-owned credential step. The current Codex CLI does not expose the older pasted MCP server command. This setup does not start an automatic paid background team or change production application code.
