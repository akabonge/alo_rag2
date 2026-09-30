// GET -> { notes }; POST { name, city, msg } -> { saved, note, notes, refreshPending? }
// Storage: Upstash Redis (free tier). Add it in Vercel → Storage → Upstash (Redis); Vercel sets the env vars.
// Accepts either KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'aialo:guestbook', MAX = 300, REQUEST_TIMEOUT = 7000;
const BAD = /\b(fuck|shit|bitch|cunt|nigg|fag|slut|whore|dick|pussy|rape|kill yourself|kys)\w*/i;
const clean = (v, n) => String(v || '').replace(/https?:\/\/\S+|www\.\S+|<[^>]*>/gi, '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

async function redis(signal, ...cmds) {
  const r = await fetch(`${URL_}/pipeline`, { method: 'POST', signal, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const results = await r.json();
  if (!Array.isArray(results) || results.length !== cmds.length || results.some((x) => !x || x.error || !Object.hasOwn(x, 'result'))) throw new Error('Invalid Redis result');
  return results.map((x) => x.result);
}
const records = async (signal) => {
  const [values] = await redis(signal, ['LRANGE', KEY, 0, MAX - 1]);
  if (!Array.isArray(values)) throw new Error('Invalid guestbook list');
  return values.map((raw) => { try { return { raw, note: JSON.parse(raw) }; } catch { return null; } }).filter((record) => {
    const n = record?.note;
    return n && typeof n.name === 'string' && typeof n.city === 'string' && typeof n.msg === 'string' && Number.isFinite(n.t);
  });
};
const list = async (signal) => (await records(signal)).map((record) => record.note);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Guestbook storage is not connected yet.' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const signal = controller.signal;
    if (req.method === 'GET') return res.json({ notes: await list(signal) });
    if (req.method === 'DELETE') { // remove a note: curl -X DELETE -H "x-admin-key: $KEY" "https://3d.aialo.io/api/guestbook?t=1790000000000"
      if (!process.env.GUESTBOOK_ADMIN_KEY || req.headers['x-admin-key'] !== process.env.GUESTBOOK_ADMIN_KEY) return res.status(403).json({ error: 'Not allowed' });
      const t = Number(req.query?.t);
      if (!req.query?.t || !Number.isFinite(t) || t < 0) return res.status(400).json({ error: 'Select a valid note timestamp' });
      const matches = [...new Set((await records(signal)).filter((record) => record.note.t === t).map((record) => record.raw))];
      // Remove exact stored values atomically, preserving notes posted during moderation.
      if (matches.length) {
        const removed = await redis(signal, ...matches.map((raw) => ['LREM', KEY, 0, raw]));
        if (removed.some((count) => !Number.isInteger(count) || count < 0)) throw new Error('Invalid deletion result');
      }
      return res.json({ notes: await list(signal) });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Use GET or POST' });
    }
    let b;
    try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; }
    catch { return res.status(400).json({ error: 'Send a valid JSON note' }); }
    if (!b || Array.isArray(b) || typeof b.name !== 'string' || typeof b.msg !== 'string' || (b.city !== undefined && typeof b.city !== 'string')) return res.status(400).json({ error: 'Add your first name and a short note.' });
    const note = { name: clean(b.name, 30), city: clean(b.city, 30), msg: clean(b.msg, 90), t: Date.now() };
    if (!note.name || !note.msg) return res.status(400).json({ error: 'Add your first name and a short note.' });
    if (BAD.test(`${note.name} ${note.city} ${note.msg}`)) return res.status(400).json({ error: 'Please keep it kind. Try rewording your note.' });
    const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
    const [count, expiry] = await redis(signal, ['INCR', `aialo:gb-rate:${ip}`], ['EXPIRE', `aialo:gb-rate:${ip}`, 3600]);
    if (!Number.isInteger(count) || count < 1 || expiry !== 1) throw new Error('Invalid rate-limit result');
    if (count > 3) return res.status(429).json({ error: 'You have already left a few stars this hour. Thank you!' });
    const [length, trimmed] = await redis(signal, ['LPUSH', KEY, JSON.stringify(note)], ['LTRIM', KEY, 0, MAX - 1]);
    if (!Number.isInteger(length) || length < 1 || trimmed !== 'OK') throw new Error('Invalid save result');
    try {
      return res.json({ saved: true, note, notes: await list(signal) });
    } catch {
      // Storage confirmed the write. A failed refresh must not invite a duplicate submission.
      return res.json({ saved: true, note, notes: null, refreshPending: true });
    }
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: 'Could not reach the guestbook right now. Please try again later.' });
  } finally {
    clearTimeout(timer);
  }
}
