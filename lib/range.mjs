import { PublicError } from './errors.mjs';
export const CHUNK_BYTES = 2 * 1024 * 1024;
export function contentRange(value) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value || '');
  if (!match) throw new PublicError('Sumber tidak mengirim rentang byte yang valid. Gunakan Buka sumber.', 422);
  const [start, end, total] = match.slice(1).map(Number);
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) throw new PublicError('Ukuran atau rentang file tidak valid.', 422);
  return { start, end, total };
}
export function validValidator(validator) {
  if (!validator || typeof validator.value !== 'string' || validator.value.length > 1024) return false;
  if (validator.type === 'etag') return /^"[\x21\x23-\x7e]*"$/.test(validator.value);
  return validator.type === 'last-modified' && /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(validator.value) && Number.isFinite(Date.parse(validator.value));
}
export function sourceValidator(headers) {
  for (const type of ['etag', 'last-modified']) {
    const validator = { type, value: headers[type] };
    if (validValidator(validator)) return validator;
  }
  throw new PublicError('Sumber tidak memberi penanda versi file. Unduhan bertahap tidak dapat dijamin utuh; gunakan Buka sumber.', 422);
}
export function validateChunk(body) {
  const { start, end, total, validator } = body || {};
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || end >= total || end - start + 1 > CHUNK_BYTES || !validValidator(validator)) throw new PublicError('Permintaan bagian file tidak valid.');
  return { start, end, total, validator };
}
export function verifyRangeHeaders(status, headers, range) {
  if (status !== 206) throw new PublicError('Sumber tidak mendukung unduh bertahap atau file telah berubah. Cari ulang tautan atau gunakan Buka sumber.', 422);
  const actual = contentRange(headers['content-range']);
  if (actual.start !== range.start || actual.end !== range.end || (range.total !== undefined && actual.total !== range.total)) throw new PublicError('Urutan atau ukuran bagian file berubah. Unduhan dihentikan agar file tidak rusak.', 409);
  if (range.validator && headers[range.validator.type] !== range.validator.value) throw new PublicError('Versi file berubah selama unduhan. Cari ulang tautan dan mulai lagi.', 409);
  return actual;
}
