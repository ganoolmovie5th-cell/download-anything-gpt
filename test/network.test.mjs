import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fetchPublic } from '../lib/network.mjs';
function upstream(t, status, headers, chunks = []) {
  t.mock.method(http, 'request', (url, options, callback) => {
    options.lookup(url.hostname, { all: true }, (error, records) => {
      assert.equal(error, null); assert.equal(records[0].address, '8.8.8.8');
    });
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => {
      const res = new PassThrough(); res.statusCode = status; res.headers = headers;
      callback(res);
      for (const chunk of chunks) if (!res.destroyed) res.write(chunk);
      if (!res.destroyed) res.end();
    });
    return req;
  });
}
test('pins public address and returns exact file bytes', async t => {
  upstream(t, 200, { 'content-type': 'application/pdf' }, [Buffer.from('%PDF-test')]);
  const result = await fetchPublic('http://8.8.8.8/file.pdf');
  assert.equal(result.body.toString(), '%PDF-test');
});
test('revalidates redirect destination before opening a connection', async t => {
  upstream(t, 302, { location: 'http://127.0.0.1/private' });
  await assert.rejects(fetchPublic('http://8.8.8.8/redirect'), /private/);
  assert.equal(http.request.mock.callCount(), 1);
});
test('enforces declared and chunked size limits', async t => {
  upstream(t, 200, { 'content-length': '1000' });
  await assert.rejects(fetchPublic('http://8.8.8.8/big', { limit: 10 }), { status: 413 });
  t.mock.restoreAll();
  upstream(t, 200, {}, [Buffer.alloc(6), Buffer.alloc(6)]);
  await assert.rejects(fetchPublic('http://8.8.8.8/chunked', { limit: 10 }), { status: 413 });
});
test('rejects redirect loops, blocked sources and unsupported compression', async t => {
  upstream(t, 302, { location: '/loop' });
  await assert.rejects(fetchPublic('http://8.8.8.8/loop'), /redirect/);
  assert.equal(http.request.mock.callCount(), 5);
  t.mock.restoreAll(); upstream(t, 403, {});
  await assert.rejects(fetchPublic('http://8.8.8.8/private'), /login/);
  t.mock.restoreAll(); upstream(t, 200, { 'content-encoding': 'gzip' });
  await assert.rejects(fetchPublic('http://8.8.8.8/gzip'), /kompresi/);
});
test('binary GET probe stops after 8 KiB without buffering a large file', async t => {
  upstream(t, 200, { 'content-type': 'audio/mpeg', 'content-length': '22693138' }, [Buffer.alloc(10000)]);
  const result = await fetchPublic('http://8.8.8.8/song.mp3', { probe: true });
  assert.equal(result.body.length, 8192); assert.equal(result.partial, true);
});
test('probe still enforces HTML size limits', async t => {
  upstream(t, 200, { 'content-type': 'text/html', 'content-length': '1000' });
  await assert.rejects(fetchPublic('http://8.8.8.8/page', { probe: true, limit: 10 }), { status: 413 });
});
test('range fetch sends Range/If-Range and returns exactly requested bytes', async t => {
  upstream(t, 206, { 'content-range': 'bytes 0-3/10', etag: '"v1"' }, [Buffer.from('abcd')]);
  const result = await fetchPublic('http://8.8.8.8/file', { limit: 4, range: { start: 0, end: 3, total: 10, validator: { type: 'etag', value: '"v1"' } } });
  assert.equal(result.body.toString(), 'abcd');
  assert.equal(http.request.mock.calls[0].arguments[1].headers.Range, 'bytes=0-3');
  assert.equal(http.request.mock.calls[0].arguments[1].headers['If-Range'], '"v1"');
});
test('server ignoring Range is rejected before reading the body', async t => {
  upstream(t, 200, { 'content-length': '22693138' }, []);
  await assert.rejects(fetchPublic('http://8.8.8.8/file', { range: { start: 0, end: 0 }, limit: 1 }), /bertahap/);
});
test('truncated chunk cannot be returned as successful bytes', async t => {
  upstream(t, 206, { 'content-range': 'bytes 0-3/10' }, [Buffer.from('ab')]);
  await assert.rejects(fetchPublic('http://8.8.8.8/file', { range: { start: 0, end: 3 }, limit: 4 }), /tidak lengkap/);
});
