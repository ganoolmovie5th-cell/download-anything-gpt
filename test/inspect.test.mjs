import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectUrl, sourceType } from '../lib/inspect.mjs';
import { extract, fileInfo, isHtml } from '../lib/extract.mjs';
const response = (url, mime, body, extra = {}) => ({ url, headers: { 'content-type': mime, ...extra }, body: Buffer.from(body) });
test('YouTube produces an explicit limitation, no false download or fetch', async () => {
  const result = await inspectUrl('https://www.youtube.com/watch?v=UdrVgxD4Ixs', { fetcher: () => { throw Error('Must not fetch'); } });
  assert.equal(result.files.length, 0); assert.match(result.note, /Vercel-only/);
  assert.equal(sourceType('https://youtube.com.evil.example').type, 'generic');
});
test('Instagram uses public embed variants and excludes profile and cropped OG images', async () => {
  const calls = [];
  const result = await inspectUrl('https://www.instagram.com/p/DgG8D3KzHDv/', { fetcher: async (url, options) => {
    calls.push(url); assert.equal(options.probe, true);
    if (url.includes('/embed/')) return response(url, 'text/html', '<img src="https://cdn.example/profile.jpg"><meta property="og:image" content="https://cdn.example/crop.jpg"><img class="EmbeddedMediaImage" src="https://cdn.example/full.heic" srcset="https://cdn.example/full.heic 1440w, https://cdn.example/small.heic 640w, https://cdn.example/crop.heic?stp=c0.180.1440.1440a_dst-jpg 1080w">');
    return response(url, 'image/jpeg', 'jpeg bytes', { 'content-length': '200000' });
  }});
  assert.match(calls[0], /\/embed\/captioned\/$/); assert.equal(result.files.length, 2);
  assert.ok(result.files.every(file => file.verified && file.ext === 'jpg' && file.name.endsWith('.jpg')));
  assert.deepEqual(result.files.map(file => file.rank), [1440, 640]);
});
test('GET probe inspects large audio and preserves size for direct-source action', async () => {
  const result = await inspectUrl('https://example.com/music', { fetcher: async (url, options) => {
    assert.notEqual(options.method, 'HEAD');
    return response(url, 'audio/mpeg', 'ID3', { 'content-length': '22693138' });
  }});
  assert.equal(result.files[0].size, 22693138); assert.equal(result.files[0].type, 'audio');
});
test('HTML masquerading as doc is not offered as a verified document', async () => {
  const result = await inspectUrl('https://example.com/list', { fetcher: async url => url.endsWith('/list') ? response(url, 'text/html', '<a href="/file.doc">Download</a>') : response(url, 'application/msword', '<!doctype html><html>Wait for redirect</html>') });
  assert.equal(result.files[0].verified, false); assert.match(result.files[0].problem, /HTML/);
});
test('anti-bot and individual unavailable files have specific outcomes', async () => {
  await assert.rejects(inspectUrl('https://example.com', { fetcher: async url => response(url, 'text/html', '<title>Just a moment...</title>') }), /anti-bot/);
  const result = await inspectUrl('https://example.com/list', { fetcher: async url => {
    if (url.endsWith('/list')) return response(url, 'text/html', '<a href="/file.pdf">PDF</a>');
    throw Error('Unavailable');
  }});
  assert.equal(result.files[0].verified, false); assert.match(result.note, /1 tautan/);
});
test('verification bounded to 12 candidates and four concurrent connections', async () => {
  let running = 0, max = 0, calls = 0;
  const result = await inspectUrl('https://example.com/list', { fetcher: async url => {
    if (url.endsWith('/list')) return response(url, 'text/html', Array.from({length: 15}, (_,i) => `<a href="/${i}.pdf">PDF</a>`).join(''));
    calls++; running++; max = Math.max(max, running); await new Promise(resolve => setTimeout(resolve, 5)); running--;
    return response(url, 'application/pdf', '%PDF');
  }});
  assert.equal(calls, 12); assert.equal(max, 4); assert.equal(result.files.filter(file => file.verified).length, 12);
});
test('MIME corrects HEIC filename when Instagram serves JPEG; OG players excluded', () => {
  assert.equal(fileInfo('https://cdn.example/photo.heic', { 'content-type': 'image/jpeg' }).name, 'photo.jpg');
  assert.equal(fileInfo('https://example.com/export', { 'content-type': 'application/msword' }).type, 'document');
  assert.equal(extract('<meta property="og:video" content="https://youtube.com/embed/x">', 'https://example.com').files.length, 0);
  assert.ok(isHtml({}, Buffer.from('<!DOCTYPE html><html>')));
});
