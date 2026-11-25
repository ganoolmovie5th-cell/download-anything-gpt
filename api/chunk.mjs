import { guard, failure } from '../lib/api.mjs';
import { fetchPublic } from '../lib/network.mjs';
import { validateChunk } from '../lib/range.mjs';
export default async function handler(req, res) {
  try {
    const url = guard(req, res), range = validateChunk(req.body);
    const file = await fetchPublic(url, { range, limit: range.end - range.start + 1 });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Range', file.headers['content-range']);
    res.status(206).send(file.body);
  } catch (error) { failure(res, error); }
}
