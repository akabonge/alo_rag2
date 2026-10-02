import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export const ASK_LIMIT = 8;
export const ASK_WINDOW_MS = 60_000;
export const ASK_LIMIT_TIMEOUT_MS = 2_000;

// Redis TIME gives all instances one clock. The sorted set holds at most eight
// admitted attempts; denied requests never extend expiry. Validate existing
// state before mutating it because Lua errors do not roll back earlier writes.
export const ASK_LIMIT_SCRIPT = `
local key = KEYS[1]
local kind = redis.call('TYPE', key).ok
if kind ~= 'none' and kind ~= 'zset' then return redis.error_reply('Invalid Ask rate type') end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if kind == 'zset' then
  local ttl = redis.call('PTTL', key)
  local count = redis.call('ZCARD', key)
  if ttl < 0 or ttl > 60000 or count > 8 then return redis.error_reply('Invalid Ask rate state') end
  local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
  for i = 2, #entries, 2 do
    local score = tonumber(entries[i])
    if not score or score < 0 or score > now or score ~= math.floor(score) then
      return redis.error_reply('Invalid Ask rate score')
    end
  end
end
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - 60000)
if redis.call('ZCARD', key) >= 8 then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {'limited', math.max(1, math.ceil((tonumber(oldest[2]) + 60000 - now) / 1000))}
end
if redis.call('ZADD', key, 'NX', now, ARGV[1]) ~= 1 then return redis.error_reply('Invalid Ask attempt ID') end
redis.call('PEXPIRE', key, 60000)
return {'allowed', 0}
`;

function clientIP(value) {
  // Vercel owns x-forwarded-for in production. Other reverse proxies must
  // replace that header rather than trusting a visitor-supplied value.
  const first = String(value || '').slice(0, 256).split(',')[0].trim();
  const family = isIP(first);
  if (family === 4) return first;
  if (family === 6) return new URL(`http://[${first}]/`).hostname.slice(1, -1);
  return 'anonymous';
}

export function askRateCommand(forwardedFor, token) {
  if (typeof token !== 'string' || !token) throw new Error('Ask rate configuration unavailable');
  // A keyed digest protects small IPv4 spaces from plain-hash reversal. All
  // instances use the same existing Redis token; rotating it resets this limit.
  const digest = createHmac('sha256', token).update(`ask-ip-v1:${clientIP(forwardedFor)}`).digest('hex');
  return ['EVAL', ASK_LIMIT_SCRIPT, 1, `aialo:ask-rate:v1:${digest}`, randomUUID()];
}

export async function consumeAskAttempt(forwardedFor) {
  const env = process.env;
  const pair = env.KV_REST_API_URL && env.KV_REST_API_TOKEN
    ? [env.KV_REST_API_URL, env.KV_REST_API_TOKEN]
    : [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN];
  const [url, token] = pair;
  if (!url || !token) throw new Error('Ask rate configuration unavailable');
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Ask rate timeout')); }, ASK_LIMIT_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([deadline, (async () => {
      const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([askRateCommand(forwardedFor, token)]),
      });
      if (!response.ok) throw new Error('Ask rate storage unavailable');
      const data = await response.json();
      if (!Array.isArray(data) || data.length !== 1 || !data[0] || data[0].error) throw new Error('Invalid Ask rate response');
      return data[0].result;
    })()]);
    if (!Array.isArray(result) || result.length !== 2) throw new Error('Invalid Ask rate response');
    if (result[0] === 'allowed' && result[1] === 0) return { allowed: true, retryAfter: 0 };
    if (result[0] === 'limited' && Number.isInteger(result[1]) && result[1] >= 1 && result[1] <= ASK_WINDOW_MS / 1000) {
      return { allowed: false, retryAfter: result[1] };
    }
    throw new Error('Invalid Ask rate response');
  } finally {
    clearTimeout(timer);
  }
}
