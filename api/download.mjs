import { guard, failure } from '../lib/api.mjs';
import { fetchPublic, PublicError } from '../lib/network.mjs';
import { filename, isHtml, isManifest } from '../lib/extract.mjs';
export default async function handler(req, res) {
  try {
    const file = await fetchPublic(guard(req, res), { limit: 3 * 1024 * 1024 });
    if (isHtml(file.headers) || isManifest(file.url, file.headers['content-type'])) throw new PublicError('Sumber tidak mengirim file yang dapat diunduh. Buka sumber untuk memeriksa akses.', 422);
    const name = filename(file.url);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`);
    res.status(200).send(file.body);
  } catch (error) { failure(res, error); }
}
