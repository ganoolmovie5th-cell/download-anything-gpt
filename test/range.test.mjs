import test from 'node:test';
import assert from 'node:assert/strict';
import { contentRange, sourceValidator, validateChunk, verifyRangeHeaders, CHUNK_BYTES } from '../lib/range.mjs';
const validator = { type: 'etag', value: '"version-one"' };
test('range parsing rejects wildcards, unsafe integers, reversed and impossible ranges', () => {
  assert.deepEqual(contentRange('bytes 0-99/100'), { start: 0, end: 99, total: 100 });
  for (const value of ['bytes 0-1/*', 'bytes */10', 'bytes 5-2/10', 'bytes 0-10/10', 'bytes 0-1/9007199254740992', 'items 0-1/5']) assert.throws(() => contentRange(value));
});
test('chunk request validates every numeric boundary and header value', () => {
  const body = { start: 0, end: 9, total: 10, validator };
  assert.deepEqual(validateChunk(body), body);
  for (const patch of [{ start: -1 }, { start: 0.5 }, { end: 10 }, { total: 0 }, { start: '0' }, { end: CHUNK_BYTES, total: CHUNK_BYTES + 1 }, { validator: { type: 'etag', value: '"x"\r\nHost: localhost' } }, { validator: { type: 'etag', value: 'W/"weak"' } }]) assert.throws(() => validateChunk({ ...body, ...patch }));
});
test('requires a strong ETag or Last-Modified rather than an unversioned transfer', () => {
  assert.deepEqual(sourceValidator({ etag: '"v1"' }), { type: 'etag', value: '"v1"' });
  const date = 'Mon, 27 Feb 2023 12:45:38 GMT';
  assert.deepEqual(sourceValidator({ etag: 'W/"v1"', 'last-modified': date }), { type: 'last-modified', value: date });
  assert.throws(() => sourceValidator({ etag: 'W/"v1"' }));
});
test('range response must match offset, length, total and validator', () => {
  const headers = { 'content-range': 'bytes 0-9/100', etag: validator.value };
  const range = { start: 0, end: 9, total: 100, validator };
  assert.equal(verifyRangeHeaders(206, headers, range).total, 100);
  assert.throws(() => verifyRangeHeaders(200, headers, range));
  for (const patch of [{ 'content-range': 'bytes 10-19/100' }, { 'content-range': 'bytes 0-9/101' }, { etag: '"v2"' }, { etag: undefined }]) assert.throws(() => verifyRangeHeaders(206, { ...headers, ...patch }, range), { status: 409 });
});
