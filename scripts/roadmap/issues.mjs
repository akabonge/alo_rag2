#!/usr/bin/env node
// Reconcile stable roadmap IDs with existing quality issues. Never bulk-create tickets or alter labels.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseTickets, planLinks, linkedBody } from './issue-core.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const REPO = 'akabonge/alo_rag2';
try { main(); }
catch (error) { console.error(error.message); process.exitCode = 2; }

function gh(args) {
  const options = { cwd: repoRoot, encoding: 'utf8', timeout: 60_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true };
  if (process.platform !== 'win32') return execFileSync('gh', args, options);
  // Use the office's PowerShell 7 runtime; do not change Windows execution policies.
  const shell = 'pwsh.exe';
  return execFileSync(shell, ['-NoProfile', '-File', path.join(repoRoot, 'scripts', 'office', 'github.ps1'), ...args], options);
}

function main() {
  const { values } = parseArgs({ strict: true, allowPositionals: false, options: {
    apply: { type: 'boolean' }, only: { type: 'string' }, offline: { type: 'boolean' },
    roadmap: { type: 'string', default: 'docs/ROADMAP.md' }, snapshot: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(`Roadmap issue reconciliation (dry-run by default)
  node scripts/roadmap/issues.mjs                  # Read all issues; print proposed body additions
  node scripts/roadmap/issues.mjs --offline        # Local mapping only; explicitly unverified
  node scripts/roadmap/issues.mjs --snapshot file.json  # Read an offline issue snapshot
  node scripts/roadmap/issues.mjs --only M1,M4 --apply   # Explicitly link selected IDs to existing issues
  --roadmap docs/ROADMAP.md                        # Relative to this repository, not the shell's cwd
No issue creation, label mutation, title mutation, closing or reopening. O1/O2 stay deferred.
Stable markers and the map include existing issues #6–#11; title changes do not cause duplicates.
Dry-run output is a proposal, not authorization to apply.`);
    return;
  }
  if (!values.roadmap.trim() || (values.snapshot !== undefined && !values.snapshot.trim())) throw new Error('Paths must not be empty.');
  if (values.apply && (values.offline || values.snapshot)) throw new Error('Apply requires fresh GitHub reads; offline snapshots cannot authorize writes.');
  if (values.apply && values.only === undefined) throw new Error('Apply requires an explicit --only ID,ID selection.');
  let tickets = parseTickets(fs.readFileSync(path.resolve(repoRoot, values.roadmap), 'utf8'));
  if (values.only !== undefined) {
    const ids = values.only.split(',').map((id) => id.trim());
    if (ids.some((id) => !id || !tickets.some((ticket) => ticket.id === id))) throw new Error('The --only selection contains an empty or unknown task ID.');
    tickets = tickets.filter((ticket) => ids.includes(ticket.id));
  }
  const mapping = JSON.parse(fs.readFileSync(new URL('./task-map.json', import.meta.url), 'utf8'));
  let issues = [];
  if (values.snapshot) issues = JSON.parse(fs.readFileSync(path.resolve(repoRoot, values.snapshot), 'utf8'));
  else if (!values.offline) issues = JSON.parse(gh(['api', `repos/${REPO}/issues?state=all&per_page=100`, '--paginate', '--slurp'])).flat();
  if (!Array.isArray(issues) || issues.some((issue) => !Number.isInteger(issue.number))) throw new Error('Issue snapshot must be an array of GitHub issue objects with numbers.');
  issues = issues.filter((issue) => !issue.pull_request);
  const verified = !values.offline;
  const plan = planLinks(tickets, mapping, issues, verified);
  console.log(`${values.apply ? 'APPLY selected links' : 'DRY RUN; no writes'} — ${verified ? values.snapshot ? 'offline snapshot; may be stale' : 'all open/closed GitHub issues checked' : 'local map UNVERIFIED against GitHub'}`);
  for (const item of plan) console.log(`${item.id.padEnd(5)} ${item.action.padEnd(14)} ${item.issue ? `#${item.issue} (${item.state})` : item.reason} · ${item.title}`);
  const groups = new Map();
  for (const item of plan.filter((item) => item.action === 'link-existing')) {
    if (!groups.has(item.issue)) groups.set(item.issue, []);
    groups.get(item.issue).push(item);
  }
  for (const [number, tasks] of groups) {
    const issue = issues.find((item) => item.number === number);
    const proposed = linkedBody(issue?.body || '', tasks, REPO);
    console.log(`\n#${number} proposed additions (existing content preserved):`);
    for (const line of proposed.split('\n').filter((line) => tasks.some((task) => line.includes(`<!-- alo-roadmap:${task.id} -->`)))) console.log(`+ ${line}`);
    if (!values.apply) continue;
    // Re-read before mutation: another desk's edits remain part of the current body.
    const current = JSON.parse(gh(['api', `repos/${REPO}/issues/${number}`]));
    const body = linkedBody(current.body || '', tasks, REPO);
    if (body === (current.body || '')) continue;
    const file = path.join(os.tmpdir(), `alo-roadmap-${randomUUID()}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify({ body }), { flag: 'wx' });
      gh(['api', `repos/${REPO}/issues/${number}`, '--method', 'PATCH', '--input', file]);
      console.log(`Updated roadmap links on #${number}; labels and issue state unchanged.`);
    } finally { if (fs.existsSync(file)) fs.unlinkSync(file); }
  }
}
