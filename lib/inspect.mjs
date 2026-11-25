import { fetchPublic, PublicError, validateUrl } from './network.mjs';
import { extract, fileInfo, isHtml, isManifest } from './extract.mjs';

export function sourceType(value) {
  const url = validateUrl(value), host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return { type: 'youtube', url };
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const post = url.pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)\/?$/);
    if (post) return { type: 'instagram', url, embed: `https://www.instagram.com/p/${post[1]}/embed/captioned/` };
  }
  return { type: 'generic', url };
}

export async function inspectUrl(value, { fetcher = fetchPublic, signal = AbortSignal.timeout(22000) } = {}) {
  const source = sourceType(value);
  if (source.type === 'youtube') return {
    title: 'YouTube belum didukung', source: source.url.href, files: [],
    note: 'YouTube tidak menyediakan URL file langsung melalui halaman ini. Versi Vercel-only tidak mengekstrak atau menggabungkan stream YouTube. Tautan pemutar dan thumbnail tidak ditampilkan sebagai video unduhan.'
  };
  // GET probes avoid servers that return 404/405 for HEAD despite a working file.
  const page = await fetcher(source.embed || source.url.href, { signal, probe: true });
  if (isManifest(page.url, page.headers['content-type'])) throw new PublicError('Manifest HLS/DASH memerlukan penggabungan stream; belum didukung versi Vercel-only.', 422);
  if (!isHtml(page.headers, page.body)) return { title: fileInfo(page.url, page.headers).name, source: source.url.href, files: [{ ...fileInfo(page.url, page.headers), verified: true }], note: 'File langsung terverifikasi. Format mengikuti respons sumber; tanpa konversi.' };
  const html = page.body.toString('utf8');
  if (/cf-chl-|challenge-platform|<title>Just a moment/i.test(html)) throw new PublicError('Sumber meminta verifikasi browser (anti-bot). File tidak dapat diambil dari server ini. Buka situs sumber secara langsung.', 422);
  const result = extract(html, page.url, { instagramEmbed: source.type === 'instagram' });
  result.source = source.url.href;
  if (source.type === 'instagram') {
    result.title = 'Foto postingan Instagram';
    result.note = 'Varian foto dari embed publik, bukan thumbnail kotak. Hanya media yang tersedia di embed; kelengkapan carousel tidak dijamin.';
  }
  // shortcut: verify the first 12 candidates; use queued verification if pages regularly need more.
  const candidates = result.files.slice(0, 12);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const file = candidates[cursor++];
      try {
        const response = await fetcher(file.url, { probe: true, signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
        if (isHtml(response.headers, response.body)) {
          file.verified = false; file.problem = 'Tautan membuka halaman HTML/perantara, bukan file. Buka sumber untuk melanjutkan.';
        } else if (isManifest(response.url, response.headers['content-type'])) {
          file.verified = false; file.problem = 'Manifest streaming belum didukung.';
        } else {
          const { quality, rank } = file;
          Object.assign(file, fileInfo(response.url, response.headers), { quality, rank, verified: true });
        }
      } catch (error) { file.verified = false; file.problem = error instanceof PublicError ? error.message : 'File tidak dapat diverifikasi. Buka sumber untuk memeriksa akses.'; }
    }
  }));
  for (const file of result.files.slice(12)) { file.verified = false; file.problem = 'Belum diverifikasi; maksimum 12 file diperiksa per pencarian.'; }
  if (source.type === 'instagram') for (const file of result.files) file.displayName = `Foto Instagram (${file.quality})`;
  const unavailable = result.files.filter(file => !file.verified).length;
  if (unavailable) result.note += ` ${unavailable} tautan belum dapat diunduh langsung; alasannya ditampilkan per file.`;
  return result;
}
