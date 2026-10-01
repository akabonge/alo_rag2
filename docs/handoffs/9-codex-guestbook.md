# 9 — Codex — Guestbook retry reliability

- Owner / branch: Codex API reviewer, `codex/grok-reliability-followup`.
- Issue / PR: [quality issue #9](https://github.com/akabonge/alo_rag2/issues/9); integration PR pending.
- Starting commit: `73826f5`.
- Status: ready for integration review; actual Redis execution pending CI.

## Result

Grok's timeout/retry concern is valid: the old write pipeline could commit a note and lose its HTTP acknowledgement. Retrying then created a second note with a new timestamp. Confirmed writes followed by failed list refreshes were already handled; this change closes the earlier, uncertain-write gap.

`api/guestbook.js` accepts an optional UUID `submissionId`. `lib/guestbook-store.js` submits one parameterized Redis Lua operation for receipt lookup, quota checking, insertion, trimming and receipt creation. Identical canonical name/city/message fields replay the original note and timestamp without another insertion or quota charge, including after a mobile IP change. Reusing an ID with different content returns 409. Receipts remain private for 24 hours; public notes retain their existing fields. Legacy clients without IDs remain accepted.

The shared guestbook quota is three accepted notes per IP in a fixed one-hour window beginning with the first accepted note. Rejected requests and replays do not extend it. Rate-limited responses include `Retry-After`. Existing key types, canonical integer counters and expiry are checked before mutation because Redis Lua errors do not roll back earlier writes. Malformed storage responses fail closed. A confirmed save or replay still returns `saved: true` if the subsequent list refresh fails. Replaying a moderated note never reinserts it.

The root agent owns `src/guestbook.js` and its form integration: one in-memory UUID follows an unchanged uncertain draft; successful confirmation clears it, another draft gets a new ID, and retries stop after 23 hours. There are no automatic retries or persisted private drafts. Independent source review found the ID lifecycle sound and requested replay-specific confirmation text so a historical receipt does not imply current public visibility after moderation.

## Verification

- `node --test test/api.test.mjs test/guestbook-redis.test.mjs`: **17 passed, 0 failed, 1 skipped** locally. The skipped item is the actual Redis suite.
- API mocks cover a committed write with a lost acknowledgement, stable retry identity despite changed timestamps, canonical-equivalent content, conflicts, invalid IDs/results, quota headers, refresh failure and existing exact-record moderation behavior. No external API calls or production writes were made.
- `node --check api/guestbook.js`, `node --check lib/guestbook-store.js`, `node --check test/guestbook-redis.test.mjs` and `git diff --check`: passed.
- Local `redis-server`/`redis-cli` are absent; Docker's daemon is not running. No local Redis execution is claimed.
- `test/guestbook-redis.test.mjs` uses a dependency-free RESP client restricted to loopback, random test key prefixes and deletion of only its own keys. With `GUESTBOOK_REDIS_TEST_PORT` set, six subtests exercise the actual Lua script: 24 concurrent same-ID saves; conflict; fixed quota/expiry/reset; legacy writes and the 300-note cap; corrupt types/counters/expiry (including leading zeros); and replay after moderation. The root added a disposable Redis 7 service and the required environment variable to CI. **Its first passing run remains a merge gate.**
- `node --test test/guestbook-client.test.mjs`: **4 passed**. Browser retry fixtures were source-reviewed here; their execution belongs to the root's integration validation.

## Limits and follow-up

Retry protection is bounded by the receipt lifetime and the same unchanged form in the same page. Reloads, other tabs, intentionally changed drafts, clients without IDs, expired/evicted receipts and storage data loss are outside that guarantee. Redis atomic execution prevents interleaving; it is not general rollback or durable exactly-once delivery. Invalid persistent counters without expiry fail closed instead of silently permitting writes.

Ask's limit remains best effort per warm serverless instance, including cache hits; shared Ask rate limiting is still open. Mocked adversarial tests can verify retrieval/prompt boundaries and transport behavior, but cannot establish live-model resistance to every injection case. The separate Ask reviewer owns the 20-case evidence.

Grok's header concern is deployment-dependent, not a confirmed spoofing defect: [Vercel documents overwriting external `X-Forwarded-For` values](https://vercel.com/docs/headers/request-headers#x-forwarded-for); trusted-proxy configuration needs separate verification. [Upstash documents Lua atomic operations over HTTP](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http), and [its pipeline documentation](https://upstash.com/docs/redis/features/restapi#pipelining) explicitly distinguishes non-atomic pipelines. No production provider configuration was probed.

Next step: pass actual Redis and browser integration checks in CI, record the PR and results in the root handoff, then merge after independent review.
