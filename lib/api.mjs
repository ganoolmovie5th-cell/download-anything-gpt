import { PublicError } from './network.mjs';
const buckets = new Map();
export function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new PublicError('Gunakan POST.', 405); }
  if (!req.headers['content-type']?.startsWith('application/json')) throw new PublicError('Gunakan JSON.', 415);
  const origin = req.headers.origin;
  if (origin) {
    let host; try { host = new URL(origin).host; } catch { throw new PublicError('Origin tidak valid.', 403); }
    if (host !== req.headers.host) throw new PublicError('Permintaan lintas situs tidak diizinkan.', 403);
  }
  if (Number(req.headers['content-length']) > 8192 || JSON.stringify(req.body || {}).length > 8192) throw new PublicError('Permintaan terlalu besar.', 413);
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
  const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  // shortcut: per-instance limiter; configure Vercel WAF rate limiting before high-traffic public launch.
  const bucket = buckets.get(ip) || { count: 0, reset: now + 60000 };
  if (buckets.size >= 10000 && !buckets.has(ip)) throw new PublicError('Server sibuk. Coba lagi sebentar.', 429);
  buckets.set(ip, bucket);
  if (++bucket.count > 30) { res.setHeader('Retry-After', '60'); throw new PublicError('Terlalu banyak permintaan. Coba lagi dalam satu menit.', 429); }
  return req.body?.url;
}
export function failure(res, error) {
  res.status(error instanceof PublicError ? error.status : 500).json({ error: error instanceof PublicError ? error.message : 'Terjadi kesalahan server. Coba lagi.' });
}
