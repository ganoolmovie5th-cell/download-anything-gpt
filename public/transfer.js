// A bounded fallback for browsers without streaming writes to a user-selected file.
export const MEMORY_LIMIT = 128 * 1024 * 1024;
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
async function post(path, body, signal, fetcher, onProgress) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    let response;
    try { response = await fetcher(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) }); }
    catch (error) {
      signal?.throwIfAborted();
      if (attempt >= 2) throw error;
      onProgress({ message: 'Koneksi terputus. Mencoba kembali bagian yang sama…' });
      await abortableDelay(1000 * (attempt + 1), signal); continue;
    }
    if (response.ok) return response;
    const error = await response.json().catch(() => ({}));
    if (attempt < 2 && [429, 502, 503, 504].includes(response.status)) {
      const seconds = response.status === 429 ? Math.max(1, Math.min(60, Number(response.headers.get('retry-after')) || 60)) : attempt + 1;
      onProgress({ message: `Menunggu ${seconds} detik sebelum mencoba bagian yang sama…` });
      await abortableDelay(seconds * 1000, signal); continue;
    }
    throw new Error(error.error || `Unduhan gagal (HTTP ${response.status}).`);
  }
}
export async function downloadParts({ url, handle, signal, onProgress = () => {}, fetcher = fetch }) {
  let writer;
  try {
    const meta = await (await post('/api/transfer', { url }, signal, fetcher, onProgress)).json();
    if (!Number.isSafeInteger(meta.size) || meta.size <= 0 || !Number.isSafeInteger(meta.chunkSize) || meta.chunkSize <= 0 || meta.chunkSize > 2 * 1024 * 1024) throw new Error('Metadata unduhan tidak valid.');
    if (!handle && meta.size > MEMORY_LIMIT) throw new Error('Browser ini mendukung penggabungan hingga 128 MiB. Gunakan Chrome/Edge desktop untuk menyimpan file lebih besar langsung ke disk, atau Buka sumber.');
    signal?.throwIfAborted();
    if (handle) writer = await handle.createWritable();
    const chunks = [];
    onProgress({ received: 0, total: meta.size, message: 'Mengunduh bagian pertama…' });
    for (let start = 0; start < meta.size; start += meta.chunkSize) {
      signal?.throwIfAborted();
      const end = Math.min(start + meta.chunkSize, meta.size) - 1;
      const response = await post('/api/chunk', { url: meta.url, start, end, total: meta.size, validator: meta.validator }, signal, fetcher, onProgress);
      if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${meta.size}`) throw new Error('Urutan bagian tidak sesuai. File tidak disimpan.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== end - start + 1) throw new Error('Bagian file tidak lengkap. File tidak disimpan.');
      signal?.throwIfAborted();
      if (writer) await writer.write(bytes); else chunks.push(bytes);
      onProgress({ received: end + 1, total: meta.size, message: `Mengunduh bagian ${Math.floor(start / meta.chunkSize) + 1} dari ${Math.ceil(meta.size / meta.chunkSize)}…` });
    }
    signal?.throwIfAborted();
    if (writer) { await writer.close(); writer = undefined; return { name: meta.name, saved: true }; }
    return { name: meta.name, blob: new Blob(chunks, { type: 'application/octet-stream' }), saved: false };
  } catch (error) {
    if (writer) await writer.abort().catch(() => {});
    throw error;
  }
}
