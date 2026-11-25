import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl, publicAddress, resolvePublic } from '../lib/network.mjs';
import { extract, filename, isManifest, fileInfo } from '../lib/extract.mjs';
import { guard } from '../lib/api.mjs';

test('rejects local, private, metadata, obfuscated IP and unsafe schemes', () => {
  for (const url of ['http://localhost/a', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://10.0.0.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'ftp://example.com', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com:8080', 'https://host.local', 'not a URL']) assert.throws(() => validateUrl(url), undefined, url);
  assert.equal(validateUrl('https://example.com/file.pdf#fragment').href, 'https://example.com/file.pdf');
});
test('public address policy and mixed DNS records', async () => {
  for (const ip of ['0.0.0.0', '127.0.0.1', '192.168.1.1', '100.64.0.1', '169.254.1.1', '224.0.0.1', '::', 'fc00::1', 'fe80::1', '2001:db8::1']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  await assert.rejects(resolvePublic('example.com', async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]));
  assert.equal((await resolvePublic('example.com', async () => [{ address: '8.8.8.8', family: 4 }])).address, '8.8.8.8');
});
test('extracts all categories, relative URLs, srcset quality and deduplicates', () => {
  const result = extract(`<title>My files</title><base href="https://example.com/assets/"><img src="a.jpg" srcset="a.jpg 400w, b.jpg 1200w"><picture><source srcset="c.avif 2x"></picture><video poster="poster.png"><source src="low.mp4" label="360p"><source src="high.mp4" label="1080p"><source src="live.m3u8"></video><audio src="song.mp3"></audio><a href="report.pdf">PDF</a><a href="archive.zip">ZIP</a><a download="Custom.bin" href="/export?id=1">File</a><meta property="og:image" content="a.jpg"><img src="http://127.0.0.1/private"><img src="data:image/png;base64,test">`, 'https://example.com/page');
  assert.equal(result.title, 'My files'); assert.equal(result.files.length, 10);
  assert.equal(result.files.find(file => file.url.endsWith('a.jpg')).quality, '400w');
  assert.equal(result.files.find(file => file.url.endsWith('high.mp4')).rank, 1080);
  assert.equal(result.files.find(file => file.url.endsWith('song.mp3')).type, 'audio');
  assert.equal(result.files.find(file => file.url.endsWith('report.pdf')).type, 'document');
  assert.ok(result.note.includes('HLS/DASH'));
  assert.ok(result.files.every(file => file.url.startsWith('https://example.com/')));
});
test('handles empty HTML, caps output, and sanitizes filenames', () => {
  assert.equal(extract('<p>No files</p>', 'https://example.com').files.length, 0);
  assert.equal(extract(Array.from({ length: 200 }, (_, i) => `<img src="/${i}.jpg">`).join(''), 'https://example.com').files.length, 150);
  assert.equal(filename('https://example.com/a%0D%0A%22.pdf'), 'a___.pdf');
  assert.equal(fileInfo('https://example.com/export', { 'content-type': 'image/png', 'content-length': '42' }).type, 'image');
  assert.equal(isManifest('https://example.com/stream.mpd'), true);
});
test('API rejects wrong methods, origins, content types and large bodies', () => {
  const res = { setHeader() {} };
  const req = { method: 'POST', headers: { host: 'example.com', 'content-type': 'application/json' }, body: { url: 'https://example.org' }, socket: { remoteAddress: 'test' } };
  assert.equal(guard(req, res), 'https://example.org');
  assert.throws(() => guard({ ...req, method: 'GET' }, res), { status: 405 });
  assert.throws(() => guard({ ...req, headers: { ...req.headers, origin: 'https://evil.example' } }, res), { status: 403 });
  assert.throws(() => guard({ ...req, headers: { host: 'example.com' } }, res), { status: 415 });
  assert.throws(() => guard({ ...req, body: { url: 'x'.repeat(9000) } }, res), { status: 413 });
});
test('API throttles repeated requests', () => {
  const req = { method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: 'rate-limit-test' }, body: {} };
  for (let i = 0; i < 30; i++) guard(req, { setHeader() {} });
  assert.throws(() => guard(req, { setHeader() {} }), { status: 429 });
});
