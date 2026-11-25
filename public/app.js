import { inject } from '/analytics.js';

if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) inject();

const $ = id => document.getElementById(id);
const labels = { image: 'Foto', video: 'Video', audio: 'Audio', document: 'Dokumen', other: 'File' };
let files = [], filter = 'all', controller, generation = 0;
$('year').textContent = new Date().getFullYear();
function status(message, error = false) { $('status').hidden = false; $('status').textContent = message; $('status').className = `status${error ? ' error' : ''}`; }
function sizeLabel(size) { return size ? size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB` : 'Ukuran belum diketahui'; }
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
    detail.textContent = file.problem || (file.size > 3 * 1024 * 1024 ? 'Lebih dari 3 MB. Simpan melalui sumber langsung.' : 'File terverifikasi'); info.append(detail);
    const actions = document.createElement('div'); actions.className = 'file-actions';
    const link = document.createElement('a'); link.className = 'source-link'; link.href = file.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Buka sumber'; link.setAttribute('aria-label', `Buka sumber ${file.name}`);
    if (file.verified && (!file.size || file.size <= 3 * 1024 * 1024)) {
      const button = document.createElement('button'); button.className = 'download'; button.textContent = 'Unduh'; button.setAttribute('aria-label', `Unduh ${file.name}, ${file.quality}`);
      button.addEventListener('click', async () => {
        button.disabled = true; button.textContent = 'Mengambil…'; status(`Mengambil ${file.name}…`);
        try {
          const response = await request('/api/download', file.url, AbortSignal.timeout(25000));
          const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a'); anchor.href = objectUrl; const disposition = response.headers.get('content-disposition') || '';
          const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
          let downloadName = file.name; try { if (encodedName) downloadName = decodeURIComponent(encodedName); } catch {}
          anchor.download = downloadName; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
          status(`File ${file.name} diterima. Penyimpanan diserahkan ke browser; periksa daftar unduhan.`);
        } catch (error) { status(error.name === 'TimeoutError' ? 'Unduhan terlalu lama. Coba lagi atau buka sumber.' : error.message, true); }
        finally { button.disabled = false; button.textContent = 'Unduh'; }
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
