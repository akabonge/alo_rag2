// Vercel serverless guestbook: GET -> { notes }, POST { name, city, msg } -> { notes }
// Storage: Upstash Redis (free tier). Add it in Vercel → Storage → Upstash (Redis); Vercel sets the env vars.
// Accepts either KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'aialo:guestbook', MAX = 300;
const BAD = /\b(fuck|shit|bitch|cunt|nigg|fag|slut|whore|dick|pussy|rape|kill yourself|kys)\w*/i;
const clean = (v, n) => String(v || '').replace(/https?:\/\/\S+|www\.\S+|<[^>]*>/gi, '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

async function redis(...cmds) {
  const r = await fetch(`${URL_}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map((x) => x.result);
}
const list = async () => (await redis(['LRANGE', KEY, 0, MAX - 1]))[0].map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Guestbook storage is not connected yet.' });
  try {
    if (req.method === 'GET') return res.json({ notes: await list() });
    if (req.method === 'DELETE') { // remove a note: curl -X DELETE -H "x-admin-key: $KEY" "https://3d.aialo.io/api/guestbook?t=1790000000000"
      if (!process.env.GUESTBOOK_ADMIN_KEY || req.headers['x-admin-key'] !== process.env.GUESTBOOK_ADMIN_KEY) return res.status(403).json({ error: 'Not allowed' });
      const t = Number(req.query?.t), keep = (await list()).filter((n) => n.t !== t);
      await redis(['DEL', KEY], ...(keep.length ? [['RPUSH', KEY, ...keep.map((n) => JSON.stringify(n))]] : []));
      return res.json({ notes: keep });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const note = { name: clean(b.name, 30), city: clean(b.city, 30), msg: clean(b.msg, 90), t: Date.now() };
    if (!note.name || !note.msg) return res.status(400).json({ error: 'Add your first name and a short note.' });
    if (BAD.test(`${note.name} ${note.city} ${note.msg}`)) return res.status(400).json({ error: 'Please keep it kind. Try rewording your note.' });
    const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
    const [count] = await redis(['INCR', `aialo:gb-rate:${ip}`], ['EXPIRE', `aialo:gb-rate:${ip}`, 3600]);
    if (count > 3) return res.status(429).json({ error: 'You have already left a few stars this hour. Thank you!' });
    await redis(['LPUSH', KEY, JSON.stringify(note)], ['LTRIM', KEY, 0, MAX - 1]);
    return res.json({ notes: await list() });
  } catch {
    return res.status(502).json({ error: 'Could not reach the guestbook right now. Please try again later.' });
  }
}
