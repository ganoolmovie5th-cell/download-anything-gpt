import { guard, failure } from '../lib/api.mjs';
import { fetchPublic, PublicError } from '../lib/network.mjs';
import { contentRange, sourceValidator, CHUNK_BYTES } from '../lib/range.mjs';
import { fileInfo, isHtml, isManifest } from '../lib/extract.mjs';
export default async function handler(req, res) {
  try {
    const file = await fetchPublic(guard(req, res), { range: { start: 0, end: 0 }, limit: 1 });
    if (isHtml(file.headers, file.body) || isManifest(file.url, file.headers['content-type'])) throw new PublicError('Sumber bukan file langsung yang dapat diunduh bertahap.', 422);
    const { total } = contentRange(file.headers['content-range']);
    res.status(200).json({ ...fileInfo(file.url, file.headers), size: total, chunkSize: CHUNK_BYTES, validator: sourceValidator(file.headers) });
  } catch (error) { failure(res, error); }
}
