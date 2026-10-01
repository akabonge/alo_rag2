import { createHash } from 'node:crypto';

export const GUESTBOOK_KEY = 'aialo:guestbook';
export const GUESTBOOK_MAX = 300;
export const RECEIPT_TTL = 24 * 60 * 60;
export const validSubmissionId = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// One Redis operation prevents concurrent retries and lost HTTP acknowledgements
// from creating another note. Receipts are private and expire after 24 hours.
// Redis scripts do not roll back runtime errors: check all existing key types and
// values before writing. This is bounded retry protection, not durable exactly-once delivery.
export const SAVE_NOTE_SCRIPT = `
local receiptKey = KEYS[3]
if receiptKey then
  local kind = redis.call('TYPE', receiptKey).ok
  if kind ~= 'none' and kind ~= 'string' then return redis.error_reply('Invalid receipt type') end
  local existing = redis.call('GET', receiptKey)
  if existing then
    local ok, receipt = pcall(cjson.decode, existing)
    if not ok or type(receipt) ~= 'table' or type(receipt[1]) ~= 'string' or type(receipt[2]) ~= 'string' then
      return redis.error_reply('Invalid receipt')
    end
    if receipt[1] ~= ARGV[2] then return {'conflict'} end
    return {'replayed', receipt[2]}
  end
end

local listType = redis.call('TYPE', KEYS[1]).ok
local rateType = redis.call('TYPE', KEYS[2]).ok
if listType ~= 'none' and listType ~= 'list' then return redis.error_reply('Invalid guestbook type') end
if rateType ~= 'none' and rateType ~= 'string' then return redis.error_reply('Invalid rate type') end
local rawCount = redis.call('GET', KEYS[2])
local count = tonumber(rawCount or '0')
if not count or count < 0 or count > 1000000000 or (rawCount and rawCount ~= '0' and not string.match(rawCount, '^[1-9]%d*$')) then
  return redis.error_reply('Invalid rate count')
end
local remaining = redis.call('TTL', KEYS[2])
if rawCount and remaining < 0 then return redis.error_reply('Invalid rate expiry') end
if count >= 3 then return {'rate_limited', tostring(math.max(1, remaining))} end

redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[3]) - 1)
redis.call('INCR', KEYS[2])
if not rawCount then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
if receiptKey then
  redis.call('SET', receiptKey, cjson.encode({ARGV[2], ARGV[1]}), 'EX', ARGV[5])
end
return {'saved', ARGV[1]}
`;

export function saveNoteCommand(note, ip, submissionId) {
  const keys = [GUESTBOOK_KEY, `aialo:gb-rate:${ip}`];
  if (submissionId) keys.push(`aialo:gb-receipt:${submissionId.toLowerCase()}`);
  const fingerprint = createHash('sha256').update(JSON.stringify([note.name, note.city, note.msg])).digest('hex');
  return ['EVAL', SAVE_NOTE_SCRIPT, keys.length, ...keys, JSON.stringify(note), fingerprint, GUESTBOOK_MAX, 3600, RECEIPT_TTL];
}
