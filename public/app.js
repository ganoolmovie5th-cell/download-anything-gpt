import { downloadParts } from '/transfer.js';
import { inject } from '/analytics.js';

if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) inject();

const $ = id => document.getElementById(id);
const labels = { image: 'Foto', video: 'Video', audio: 'Audio', document: 'Dokumen', other: 'File' };
let activeDownload;
let files = [], filter = 'all', controller, generation = 0;
$('year').textContent = new Date().getFullYear();
function status(message, error = false) { $('status').hidden = false; $('status').textContent = message; $('status').className = `status${error ? ' error' : ''}`; }
function sizeLabel(size) { return size === 0 ? '0 KB' : size ? size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB` : 'Ukuran belum diketahui'; }
async function request(path, url, signal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}). Coba lagi.`);
  }
  return response;
}
function render() {
  const list = files.filter(file => filter === 'all' || file.type === filter).sort((a, b) => (document.querySelector('[data-sort][aria-pressed="true"]').dataset.sort === 'asc' ? 1 : -1) * (a.rank - b.rank));
  $('files').replaceChildren();
  $('count').textContent = `${list.length} file`;
  if (!list.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = files.length ? 'Tidak ada file untuk filter ini. Pilih jenis lain.' : 'Belum ada file publik yang terdeteksi. Coba URL file langsung atau halaman lain.';
    $('files').append(empty); return;
  }
  for (const file of list) {
    const row = document.createElement('article'); row.className = 'file';
    const icon = document.createElement('span'); icon.className = 'file-icon'; icon.textContent = file.ext.toUpperCase().slice(0, 6); icon.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div'); info.className = 'file-info';
    const title = document.createElement('h3'); title.className = 'file-name'; title.textContent = file.displayName || file.name;
    const meta = document.createElement('p'); meta.className = 'file-meta'; meta.textContent = `${labels[file.type] || 'File'} · ${file.quality} · ${sizeLabel(file.size)}`;
    info.append(title, meta);
    const detail = document.createElement('p'); detail.className = 'file-detail';
    detail.textContent = file.problem || (file.size > 3 * 1024 * 1024 ? 'Diunduh bertahap, lalu disimpan sebagai satu file. Sumber harus mendukung byte-range.' : 'File terverifikasi'); info.append(detail);
    const actions = document.createElement('div'); actions.className = 'file-actions';
    const link = document.createElement('a'); link.className = 'source-link'; link.href = file.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Buka sumber'; link.setAttribute('aria-label', `Buka sumber ${file.name}`);
    if (file.verified) {
      const button = document.createElement('button'); button.className = 'download'; button.textContent = 'Unduh'; button.setAttribute('aria-label', `Unduh ${file.name}, ${file.quality}`);
      button.disabled = Boolean(activeDownload);
      button.addEventListener('click', async () => {
        if (activeDownload) return;
        const job = new AbortController(); activeDownload = job;
        document.querySelectorAll('.download').forEach(item => { item.disabled = true; });
        $('transfer').hidden = false; $('transfer-name').textContent = file.displayName || file.name;
        $('transfer-state').textContent = 'Menyiapkan unduhan…'; $('transfer-progress').removeAttribute('value');
        $('transfer-bytes').textContent = ''; $('transfer-cancel').hidden = false;
        try {
          let result;
          if (file.size > 3 * 1024 * 1024) {
            // Ask during the click gesture; waiting for network first loses browser activation.
            const handle = typeof window.showSaveFilePicker === 'function' ? await window.showSaveFilePicker({ suggestedName: file.name }) : undefined;
            job.signal.throwIfAborted();
            result = await downloadParts({ url: file.url, handle, signal: job.signal, onProgress: ({ received, total, message }) => {
              if (total) { $('transfer-progress').max = total; $('transfer-progress').value = received; $('transfer-bytes').textContent = `${sizeLabel(received)} / ${sizeLabel(total)} (${Math.floor(received / total * 100)}%)`; }
              if (message) $('transfer-state').textContent = message;
            } });
          } else {
            const response = await request('/api/download', file.url, AbortSignal.any([job.signal, AbortSignal.timeout(25000)]));
            const blob = await response.blob(); job.signal.throwIfAborted();
            const encodedName = (response.headers.get('content-disposition') || '').match(/filename\*=UTF-8''([^;]+)/i)?.[1];
            let name = file.name; try { if (encodedName) name = decodeURIComponent(encodedName); } catch {}
            result = { blob, name, saved: false };
          }
          if (result.blob) {
            const objectUrl = URL.createObjectURL(result.blob), anchor = document.createElement('a');
            anchor.href = objectUrl; anchor.download = result.name; document.body.append(anchor); anchor.click(); anchor.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
          }
          $('transfer-progress').max = 1; $('transfer-progress').value = 1;
          $('transfer-state').textContent = result.saved ? 'Selesai. File utuh tersimpan di lokasi pilihanmu.' : 'File utuh diterima browser. Periksa daftar unduhan untuk memastikan penyimpanan.';
        } catch (error) {
          $('transfer-progress').max = 1; $('transfer-progress').value = 0;
          $('transfer-state').textContent = job.signal.aborted || error.name === 'AbortError' ? 'Unduhan dibatalkan. File parsial tidak disimpan oleh aplikasi.' : error.name === 'TimeoutError' ? 'Sumber terlalu lama merespons. Coba lagi atau Buka sumber.' : error.message;
        } finally {
          activeDownload = undefined; $('transfer-cancel').hidden = true;
          document.querySelectorAll('.download').forEach(item => { item.disabled = false; });
        }
      }); actions.append(button);
    }
    actions.append(link); row.append(icon, info, actions); $('files').append(row);
  }
}
async function inspect() {
  if (!$('form').reportValidity()) return;
  controller?.abort(); controller = new AbortController(); const current = ++generation;
  $('submit').disabled = true; $('submit').textContent = 'Mencari file…'; $('cancel').hidden = false; $('results').hidden = true;
  status('Memeriksa tautan dan mencari file yang tersedia…');
  const active = controller;
  const timer = setTimeout(() => active.abort('timeout'), 25000);
  try {
    const data = await (await request('/api/inspect', $('url').value.trim(), active.signal)).json();
    if (current !== generation) return;
    files = data.files; filter = 'all';
    document.querySelectorAll('[data-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === 'all')));
    $('results-title').textContent = data.title; $('source').textContent = new URL(data.source).hostname; $('source').href = data.source;
    $('result-note').textContent = data.note; $('results').hidden = false; render();
    const verifiedCount = files.filter(file => file.verified).length;
    status(files.length ? `${files.length} varian ditemukan; ${verifiedCount} terverifikasi. Periksa keterangan setiap file.` : data.title === 'YouTube belum didukung' ? 'Video YouTube belum dapat diunduh pada versi ini.' : 'Halaman terbaca, tetapi tidak ada file publik yang terdeteksi.');
  } catch (error) {
    if (current !== generation) return;
    status(active.signal.aborted ? active.signal.reason === 'timeout' ? 'Pencarian terlalu lama. Coba lagi.' : 'Pencarian dibatalkan. Kamu bisa mencoba URL lain.' : error.message, !active.signal.aborted || active.signal.reason === 'timeout');
  } finally {
    clearTimeout(timer);
    if (current === generation) { $('submit').disabled = false; $('submit').replaceChildren(document.createTextNode('Temukan file')); $('cancel').hidden = true; }
  }
}
$('form').addEventListener('submit', event => { event.preventDefault(); inspect(); });
$('cancel').addEventListener('click', () => controller?.abort());
$('paste').addEventListener('click', async () => {
  try { $('url').value = (await navigator.clipboard.readText()).trim(); if ($('url').value) inspect(); else status('Clipboard kosong. Salin tautan terlebih dahulu.', true); }
  catch { status('Izin clipboard tidak tersedia. Tempel dengan Ctrl+V atau ⌘V pada kolom URL.', true); $('url').focus(); }
});
$('url').addEventListener('paste', () => setTimeout(() => { if ($('url').validity.valid && $('url').value) inspect(); }, 0));
$('filters').addEventListener('click', event => { const button = event.target.closest('[data-type]'); if (!button) return; filter = button.dataset.type; document.querySelectorAll('[data-type]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); render(); });
$('sort').addEventListener('click', event => { const button = event.target.closest('[data-sort]'); if (!button) return; document.querySelectorAll('[data-sort]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); render(); });

$('transfer-cancel').addEventListener('click', () => activeDownload?.abort());
