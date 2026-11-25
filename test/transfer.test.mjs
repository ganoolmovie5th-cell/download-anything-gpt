import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadParts, MEMORY_LIMIT } from '../public/transfer.js';
const meta = { url: 'https://example.com/file.mp3', size: 7, chunkSize: 3, name: 'file.mp3', validator: { type: 'etag', value: '"v1"' } };
const binary = Buffer.from([0, 255, 128, 1, 2, 0, 99]);
function upstream({ changed = false, truncated = false, oversized = false, onChunk = () => {} } = {}) {
  const ranges = [];
  const fetcher = async (path, options) => {
    if (path === '/api/transfer') return Response.json({ ...meta, ...(oversized ? { size: MEMORY_LIMIT + 1 } : {}) });
    const request = JSON.parse(options.body); ranges.push([request.start, request.end]); onChunk();
    assert.deepEqual(request.validator, meta.validator);
    return new Response(binary.subarray(request.start, truncated ? request.end : request.end + 1), { status: 206, headers: { 'Content-Range': `bytes ${changed ? 99 : request.start}-${request.end}/${meta.size}` } });
  };
  return { fetcher, ranges };
}
test('browser assembles all chunks including last partial chunk byte-for-byte', async () => {
  const mock = upstream(); const progress = [];
  const result = await downloadParts({ url: meta.url, fetcher: mock.fetcher, onProgress: update => progress.push(update.received) });
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), binary);
  assert.deepEqual(mock.ranges, [[0, 2], [3, 5], [6, 6]]); assert.deepEqual(progress, [0, 3, 6, 7]);
});
test('streaming disk writer writes in order and closes only on complete transfer', async () => {
  const writes = []; let closed = false;
  const writer = { write: async bytes => writes.push(Buffer.from(bytes)), close: async () => { closed = true; }, abort: async () => assert.fail('Must not abort') };
  const result = await downloadParts({ url: meta.url, handle: { createWritable: async () => writer }, fetcher: upstream().fetcher });
  assert.equal(result.saved, true); assert.equal(result.blob, undefined); assert.equal(closed, true); assert.deepEqual(Buffer.concat(writes), binary);
});
test('wrong range or truncated chunk aborts disk transaction, never commits', async () => {
  for (const options of [{ changed: true }, { truncated: true }]) {
    let aborted = false;
    const writer = { write: async () => assert.fail('Invalid bytes must not be written'), close: async () => assert.fail('Must not commit'), abort: async () => { aborted = true; } };
    await assert.rejects(downloadParts({ url: meta.url, handle: { createWritable: async () => writer }, fetcher: upstream(options).fetcher }));
    assert.equal(aborted, true);
  }
});
test('cancel stops further chunks and aborts disk writer', async () => {
  const controller = new AbortController(); let aborted = false;
  const mock = upstream({ onChunk: () => controller.abort() });
  const writer = { write: async () => assert.fail('Cancelled bytes must not be written'), close: async () => assert.fail('Must not commit'), abort: async () => { aborted = true; } };
  await assert.rejects(downloadParts({ url: meta.url, signal: controller.signal, handle: { createWritable: async () => writer }, fetcher: mock.fetcher }), { name: 'AbortError' });
  assert.equal(aborted, true); assert.equal(mock.ranges.length, 1);
});
test('memory fallback rejects oversized files before downloading any chunks', async () => {
  const mock = upstream({ oversized: true });
  await assert.rejects(downloadParts({ url: meta.url, fetcher: mock.fetcher }), /128 MiB/); assert.equal(mock.ranges.length, 0);
});
test('rate-limit wait can be cancelled without starting another request', async () => {
  const controller = new AbortController(); let requests = 0;
  await assert.rejects(downloadParts({ url: meta.url, signal: controller.signal, fetcher: async () => { requests++; return Response.json({ error: 'Too many' }, { status: 429, headers: { 'Retry-After': '60' } }); }, onProgress: () => controller.abort() }), { name: 'AbortError' });
  assert.equal(requests, 1);
});
test('temporary chunk failure retries the same offset without duplicate bytes', async () => {
  const mock = upstream(); const starts = []; let failed = false;
  const fetcher = async (path, options) => {
    if (path === '/api/chunk') {
      starts.push(JSON.parse(options.body).start);
      if (!failed) { failed = true; return Response.json({ error: 'Temporary upstream failure' }, { status: 503 }); }
    }
    return mock.fetcher(path, options);
  };
  const result = await downloadParts({ url: meta.url, fetcher });
  assert.deepEqual(starts, [0, 0, 3, 6]);
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), binary);
});
