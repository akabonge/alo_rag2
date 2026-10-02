# Shared Ask attempt limit

Owner: Codex. Branch: `codex/mobile-audio-release-safety`.

`api/ask.js` now consumes one shared Redis-backed attempt after method/body validation and before cache lookup, retrieval or provider access. `lib/ask-rate-limit.js` uses an atomic sorted-set script, Redis server time and an HMAC-derived visitor key. Eight valid attempts are allowed in a rolling minute. Cached replies and provider failures count; invalid methods and malformed JSON do not. A ninth attempt returns 429 with `Retry-After` derived from the oldest retained attempt.

Missing, incomplete or malformed Redis configuration fails closed with 503, and Redis transport/script errors fail closed without leaking implementation or credential details. The browser retains its local extracted answer when the server path is unavailable. The limiter reuses the existing Redis service and token, so no new package, service or secret is required.

Mocked tests cover cold handler instances, cache paths, provider failures, malformed Redis replies, precise retry timing and failure behavior. The dependency-free loopback suite executes the production Lua against disposable Redis, including concurrent attempts and multiple fresh handler instances; it is skipped only when the local test port is absent and is required in CI through the Redis service.

The limit is an operational abuse and cost guard, not identity verification. Shared networks can pool unrelated visitors, and an attacker can rotate source IPs. Redis availability is required for Ask requests; the intentional fail-closed behavior favors bounded provider use over model availability.
