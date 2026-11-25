import { guard, failure } from '../lib/api.mjs';
import { fetchPublic, validateUrl, PublicError } from '../lib/network.mjs';
import { extract, fileInfo, isHtml, isManifest } from '../lib/extract.mjs';
export default async function handler(req, res) {
  try {
    const url = validateUrl(guard(req, res)).href;
    const signal = AbortSignal.timeout(20000);
    let head;
    try { head = await fetchPublic(url, { method: 'HEAD', signal }); } catch (error) { if (error.status !== 422) throw error; }
    if (head && isManifest(head.url, head.headers['content-type'])) throw new PublicError('URL ini adalah manifest streaming HLS/DASH. Versi Vercel tidak menggabungkan segmen video.', 422);
    if (head && !isHtml(head.headers) && head.headers['content-type']) {
      return res.status(200).json({ title: fileInfo(head.url, head.headers).name, source: head.url, files: [fileInfo(head.url, head.headers)], note: 'File langsung. Kualitas asli; tidak dikonversi atau ditingkatkan.' });
    }
    const page = await fetchPublic(url, { signal });
    if (isManifest(page.url, page.headers['content-type'])) throw new PublicError('Manifest streaming tidak didukung.', 422);
    res.status(200).json(isHtml(page.headers) ? extract(page.body.toString('utf8'), page.url) : { title: fileInfo(page.url).name, source: page.url, files: [fileInfo(page.url, page.headers)], note: 'File langsung dalam format asli.' });
  } catch (error) { failure(res, error); }
}
