import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const samples = [
  ['image', 'https://www.w3.org/Icons/w3c_home.png'],
  ['video', 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'],
  ['audio', 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3'],
  ['document', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf']
];
const post = (route, url) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(30000) });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [type, url] of samples) {
  const response = await post('inspect', url); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.files[0].type, type);
  const download = await post('download', data.files[0].url); assert.equal(download.status, 200);
  assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));
  const bytes = Buffer.from(await download.arrayBuffer());
  const original = await fetch(data.files[0].url, { signal: AbortSignal.timeout(30000) }); assert.equal(original.status, 200);
  assert.equal(hash(bytes), hash(Buffer.from(await original.arrayBuffer())));
  console.log(`${type}: ${bytes.length} bytes, SHA-256 matches source`);
}
const empty = await (await post('inspect', 'https://example.com')).json(); assert.equal(empty.files.length, 0);
assert.equal((await post('inspect', 'http://127.0.0.1/')).status, 400);
const page = await (await post('inspect', 'https://www.w3.org/WAI/tutorials/images/')).json(); assert.ok(page.files.some(file => file.type === 'image'));
console.log('Empty HTML, real HTML extraction, and private-address rejection passed.');
