import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class PublicError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function validateUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) throw new PublicError('URL tidak valid atau terlalu panjang.');
  let url;
  try { url = new URL(value); } catch { throw new PublicError('Masukkan URL lengkap dengan https:// atau http://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new PublicError('Gunakan URL HTTP/HTTPS publik tanpa login dan port khusus.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (ipaddr.isValid(host) && !publicAddress(host))) {
    throw new PublicError('Alamat lokal atau jaringan private tidak diizinkan.');
  }
  url.hash = '';
  return url;
}

export async function resolvePublic(hostname, resolver = lookup) {
  const host = hostname.replace(/^\[|\]$/g, '');
  let records;
  try { records = await resolver(host, { all: true }); } catch { throw new PublicError('Domain tidak dapat ditemukan.', 422); }
  if (!records.length || records.some(record => !publicAddress(record.address))) throw new PublicError('Alamat jaringan ini tidak diizinkan.');
  return records[0];
}

export async function fetchPublic(value, { method = 'GET', limit = 2 * 1024 * 1024, signal = AbortSignal.timeout(18000), probe = false } = {}, redirects = 0) {
  const url = validateUrl(value);
  // Pin the validated address to the connection to prevent DNS rebinding.
  const record = await Promise.race([
    resolvePublic(url.hostname),
    new Promise((_, reject) => {
      if (signal.aborted) return reject(new PublicError('Waktu akses sumber habis.', 504));
      signal.addEventListener('abort', () => reject(new PublicError('Waktu akses sumber habis.', 504)), { once: true });
    })
  ]);
  if (signal.aborted) throw new PublicError('Waktu akses sumber habis.', 504);
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method, signal, agent: false,
      lookup: (_host, options, callback) => options.all ? callback(null, [record]) : callback(null, record.address, record.family),
      headers: { 'User-Agent': 'DownloadAnything/1.0 (+https://download-anything.web.id)', Accept: '*/*', 'Accept-Encoding': 'identity' }
    }, response => {
      const status = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (!response.headers.location || redirects >= 4) return reject(new PublicError('Terlalu banyak redirect atau redirect tidak valid.', 422));
        let next;
        try { next = new URL(response.headers.location, url).href; } catch { return reject(new PublicError('Redirect tidak valid.', 422)); }
        resolve(fetchPublic(next, { method, limit, signal, probe }, redirects + 1));
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        return reject(new PublicError([401, 403].includes(status) ? 'Sumber menolak akses (HTTP ' + status + '). Situs mungkin meminta login atau verifikasi anti-bot. Buka situs sumber secara langsung.' : `Sumber mengembalikan HTTP ${status}. Coba URL lain.`, 422));
      }
      const meta = { url: url.href, headers: response.headers, status };
      const binaryProbe = probe && !/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers['content-type'] || '');
      if (method === 'HEAD') { response.destroy(); resolve({ ...meta, body: Buffer.alloc(0) }); return; }
      if (!binaryProbe && Number(response.headers['content-length']) > limit) { response.destroy(); reject(new PublicError('File melebihi batas unduh server 3 MB. Gunakan tombol Buka sumber.', 413)); return; }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') { response.destroy(); reject(new PublicError('Sumber memakai kompresi yang tidak didukung. Gunakan tautan file langsung.', 422)); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        if (binaryProbe) {
          const remaining = 8192 - size; chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining);
          if (size === 8192) { resolve({ ...meta, body: Buffer.concat(chunks), partial: true }); response.destroy(); }
          return;
        }
        size += chunk.length;
        if (size > limit) { response.destroy(); reject(new PublicError('Respons terlalu besar. Gunakan tombol Buka sumber.', 413)); }
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ ...meta, body: Buffer.concat(chunks) }));
      response.on('error', () => reject(new PublicError('Koneksi sumber terputus. Coba lagi.', 502)));
    });
    request.on('error', () => reject(new PublicError(signal.aborted ? 'Waktu akses sumber habis. Coba lagi.' : 'Sumber tidak dapat diakses. Periksa URL atau coba lagi.', signal.aborted ? 504 : 502)));
    request.end();
  });
}
