# Download Anything

Website berbahasa Indonesia untuk menemukan dan mengunduh file publik dari URL. Dibuat untuk **Vercel saja**, tanpa backend VPS, database, atau API key. Nama domain yang disiapkan: **download-anything.web.id**.

## Fitur

- Tempel URL untuk otomatis mencari file; tombol submit tetap tersedia.
- URL file langsung: gambar, video, audio, dokumen, arsip, dan tipe biner lain.
- Halaman HTML: `img`, lazy `data-src`, `srcset`, `picture`, `video`, `audio`, `source`, poster, metadata Open Graph, dan link file/download.
- Filter tipe, label format, ukuran jika tersedia, serta urutan kualitas rendah/tinggi berdasarkan label numerik sumber.
- Unduh melalui server sampai **3 MiB (3.145.728 byte)**. File lebih besar menggunakan **Buka sumber**, tanpa diproxy Vercel.
- Logo SVG, favicon, layout responsif, keyboard focus, live status, pembatalan pencarian, serta pesan error yang jelas.

## Batasan yang disengaja

Ini bukan downloader universal. Tidak menjalankan JavaScript halaman, tidak login, tidak mengirim cookie pengguna, tidak melewati DRM, tidak mengekstrak playlist, tidak menggabungkan HLS/DASH atau audio/video terpisah. YouTube, TikTok, Instagram dan situs sejenis tidak dijamin bekerja. Gunakan URL file publik langsung jika tersedia.

Format/kualitas hanya berasal dari sumber, tanpa konversi atau upscale. `Asli` berarti tidak ada label kualitas dari sumber. Angka `w`, `x`, dan `p` mengikuti informasi sumber dan bukan perbandingan kualitas visual universal. Parser srcset mendukung bentuk standar sederhana; URL yang mengandung koma belum didukung. Maksimum 150 hasil, HTML maksimal 2 MiB, maksimum 4 redirect, waktu ekstraksi 20 detik. Link HTML belum diverifikasi satu per satu; file dapat hilang, kedaluwarsa, atau menolak akses ketika diunduh. Server yang mengabaikan `Accept-Encoding: identity` ditolak.

Browser dapat menampilkan/memutar file saat memilih Buka sumber. Pengguna dapat memakai menu simpan browser; aplikasi tidak dapat memaksa unduhan lintas domain. Keberhasilan API unduh berarti byte diterima browser, bukan bukti file telah tersimpan di disk.

## Lokal

Gunakan Node.js 24 dan npm.

```sh
npm ci
npm run dev
```

Buka http://127.0.0.1:3000. Server dev hanya mendengarkan loopback dan meniru endpoint Vercel.

```sh
npm test
npm run build
npm run test:live
```

`test:live` membutuhkan server dev aktif dan jaringan. Menguji PNG, MP4, MP3, PDF, ekstraksi HTML nyata, halaman kosong dan penolakan IP private. SHA-256 byte unduhan dibandingkan dengan sumber. Kegagalan sumber pihak ketiga tidak otomatis berarti regresi aplikasi. CI menjalankan unit test dan build tanpa bergantung sumber eksternal.

## Deploy Vercel

1. Import repo `ganoolmovie5th-cell/download-anything-gpt`, branch **main**.
2. Framework preset **Other**, root directory tetap root repo.
3. Node.js **24.x**, install `npm ci`, build `npm run build`, output `dist`.
4. Deploy. `vercel.json` mengatur fungsi di `api/`, durasi 30 detik, dan header keamanan. Tidak perlu environment variable.
5. Di **Settings → Domains**, tambahkan `download-anything.web.id`.
6. Salin record DNS yang ditampilkan Vercel ke penyedia domain. Gunakan nilai dari dashboard, bukan nilai IP tebakan. Tunggu verifikasi dan sertifikat HTTPS.
7. Uji ulang lewat domain produksi. Untuk smoke test: `TEST_BASE_URL=https://download-anything.web.id npm run test:live`.

Push ke GitHub bukan deployment Vercel. Domain dan produksi belum dikonfigurasi atau diuji oleh proyek ini.

Referensi resmi: [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [batas Functions](https://vercel.com/docs/functions/limitations), [domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## Keamanan dan operasi

HTTP/HTTPS saja, tanpa kredensial URL dan tanpa port khusus. Semua hasil DNS harus merupakan alamat publik; koneksi dipin ke IP yang divalidasi untuk menutup DNS rebinding. Redirect divalidasi ulang. Batas byte berlaku juga pada transfer chunked. Tidak meneruskan cookie/Authorization. File dikirim sebagai attachment `application/octet-stream` dan `nosniff`; konten HTML sumber tidak dieksekusi di frontend. CSP ketat dan penolakan origin lintas situs diterapkan.

Rate limit 30 permintaan/menit/IP **per instance** adalah perlindungan dasar, bukan pembatas global. Sebelum menerima trafik publik besar, tambahkan rate limit Vercel WAF untuk `/api/*` dan batas pengeluaran. Instance terpisah memiliki penghitung sendiri; layanan publik dapat menimbulkan biaya bandwidth. Tidak ada akun atau penyimpanan tautan di aplikasi; penyedia hosting/sumber tetap dapat mencatat request.

## Struktur

- `public/`: UI dan logo SVG asli proyek.
- `api/inspect.mjs`, `api/download.mjs`: endpoint Vercel.
- `lib/`: jaringan aman, parser, validasi API.
- `test/`: pengujian deterministik jaringan dan ekstraksi.
- `scripts/smoke.mjs`: tes integrasi terhadap sumber publik.
- `TESTING.md`: hasil pengujian dan hal yang belum diperiksa.

Unduh hanya konten yang dimiliki atau diizinkan pemiliknya.
