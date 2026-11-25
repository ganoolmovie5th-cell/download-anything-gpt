import { load } from 'cheerio';
import { validateUrl } from './network.mjs';

const groups = {
  image: 'jpg jpeg png gif webp avif svg bmp ico tif tiff heic heif',
  video: 'mp4 webm mov mkv avi m4v mpg mpeg ogv 3gp',
  audio: 'mp3 m4a aac wav flac ogg opus aiff wma',
  document: 'pdf doc docx xls xlsx ppt pptx txt csv rtf odt ods odp epub json xml md',
  other: 'zip rar 7z tar gz bz2 xz iso apk exe dmg torrent woff woff2 ttf'
};
const extensions = Object.fromEntries(Object.entries(groups).flatMap(([type, values]) => values.split(' ').map(ext => [ext, type])));
export function extension(value) {
  try { return new URL(value).pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1].toLowerCase() || ''; } catch { return ''; }
}
export function kind(url, mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/') && !mime.includes('mpegurl')) return 'audio';
  return extensions[extension(url)] || 'other';
}
export function filename(url) {
  let name;
  try { name = decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch { name = 'download'; }
  return (name || 'download').replace(/[\x00-\x1f\x7f/\\"<>:|?*]/g, '_').slice(0, 180);
}
const mimeExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
export function fileInfo(url, headers = {}) {
  const mime = (headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = mimeExtensions[mime] || extension(url) || 'file';
  let name = filename(url);
  if (mimeExtensions[mime] && extension(url) !== ext) name = name.replace(/\.[a-z0-9]{1,8}$/i, '') + '.' + ext;
  return { url, name, type: extensions[ext] || kind(url, mime), ext, quality: 'Asli', rank: 0, size: Number(headers['content-length']) || null };
}
export function isHtml(headers, body) {
  return /(?:text\/html|application\/xhtml\+xml)/i.test(headers['content-type'] || '') || !!body && /^\s*(?:<!doctype html|<html|<head|<script|<body)/i.test(body.toString('utf8', 0, 512));
}
export function isManifest(url, mime = '') { return /\.(m3u8|mpd)(?:\?|$)/i.test(url) || /mpegurl|dash\+xml/i.test(mime); }
export function extract(html, pageUrl, { instagramEmbed = false } = {}) {
  const $ = load(html); const assets = new Map(); let skipped = 0;
  let base = pageUrl;
  try { if ($('base[href]').attr('href')) base = validateUrl(new URL($('base[href]').attr('href'), pageUrl).href).href; } catch {}
  function add(raw, type, quality = 'Asli', rank = 0, name = '') {
    if (!raw || assets.size >= 150) return;
    let url;
    try { url = validateUrl(new URL(raw, base).href).href; } catch { return; }
    if (isManifest(url)) { skipped++; return; }
    // Keep the signed URL intact; discard explicitly cropped Instagram variants.
    if (instagramEmbed && /(?:^|_)c\d+(?:\.\d+){3}a(?:_|$)/.test(new URL(url).searchParams.get('stp') || '')) return;
    const existing = assets.get(url);
    if (!existing || rank > existing.rank) assets.set(url, { ...fileInfo(url), type: type || kind(url), quality, rank, name: name.trim().slice(0, 180) || filename(url) });
  }
  $(instagramEmbed ? 'img.EmbeddedMediaImage, video, video source' : 'img, video, audio, source').each((_, element) => {
    const el = $(element), tag = element.tagName;
    const type = tag === 'img' || el.closest('picture').length ? 'image' : tag === 'audio' || el.closest('audio').length ? 'audio' : 'video';
    const label = el.attr('label') || el.attr('data-quality') || (el.attr('height') ? `${el.attr('height')}p` : 'Asli');
    add(el.attr('src') || el.attr('data-src'), type, label, parseInt(label) || 0);
    if (el.attr('poster')) add(el.attr('poster'), 'image', 'Poster');
    // shortcut: standard comma-separated srcset only; use a full parser if sources require comma-containing URLs.
    (el.attr('srcset') || el.attr('data-srcset') || '').split(',').forEach(candidate => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      if (url) add(url, 'image', descriptor || 'Asli', parseFloat(descriptor) || 0);
    });
  });
  $(instagramEmbed ? '__unused__' : 'a[href]').each((_, element) => {
    const el = $(element); let url;
    try { url = new URL(el.attr('href'), base).href; } catch { return; }
    if (extensions[extension(url)] || el.attr('download') !== undefined) add(url, null, 'Asli', 0, el.attr('download'));
  });
  $(instagramEmbed ? '__unused__' : 'meta[property], meta[name]').each((_, element) => {
    const el = $(element), key = el.attr('property') || el.attr('name');
    if (/^(og:(image|video|audio)(:url|:secure_url)?|twitter:image)$/.test(key)) {
      const raw = el.attr('content');
      // An Open Graph video can point to an HTML player, not a downloadable file.
      if (key.includes('video') && !extensions[extension(raw)]) return;
      add(raw, key.includes('video') ? 'video' : key.includes('audio') ? 'audio' : 'image', key.includes('image') ? 'Pratinjau halaman' : 'Asli');
    }
  });
  return {
    title: $('title').text().trim().slice(0, 200) || new URL(pageUrl).hostname,
    source: pageUrl, files: [...assets.values()],
    note: `Hanya file publik yang tercantum di HTML. Konten yang dimuat JavaScript, login, dan DRM tidak diekstrak.${skipped ? ' Streaming HLS/DASH ditemukan; penggabungan segmen tidak tersedia.' : ''}${assets.size >= 150 ? ' Hasil dibatasi 150 file.' : ''}`
  };
}
