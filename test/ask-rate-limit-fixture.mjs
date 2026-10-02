import assert from 'node:assert/strict';

// Service fixture for API routing tests, not proof of Lua correctness. The
// separate loopback Redis suite executes the real script atomically.
export function mockAskFetch(t, provider) {
  const state = { clients: new Map(), redisCalls: [], providerCalls: [] };
  state.fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://redis.invalid/pipeline') {
      const commands = JSON.parse(options.body);
      assert.equal(commands.length, 1);
      const command = commands[0];
      assert.equal(command[0], 'EVAL');
      assert.equal(command[2], 1);
      assert.match(command[3], /^aialo:ask-rate:v1:[a-f0-9]{64}$/);
      state.redisCalls.push(command);
      const now = Date.now(), times = (state.clients.get(command[3]) || []).filter(time => now - time < 60_000);
      let result;
      if (times.length >= 8) result = ['limited', Math.max(1, Math.ceil((times[0] + 60_000 - now) / 1000))];
      else { times.push(now); state.clients.set(command[3], times); result = ['allowed', 0]; }
      return { ok: true, json: async () => [{ result }] };
    }
    assert.equal(url, 'https://api.anthropic.com/v1/messages', 'No unrecognized external service may be contacted');
    state.providerCalls.push([url, options]);
    return provider(url, options);
  });
  return state;
}
