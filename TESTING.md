# Regresi dan revamp — 25 November 2026 (Asia/Jakarta)

## Empat URL pengguna

- Instagram `https://www.instagram.com/p/DgG8D3KzHDv/`: tujuh varian non-crop terverifikasi, 240w–1440w. JPEG tertinggi berhasil diunduh, 306.267 byte, 1440 × 1800. Gambar diperiksa visual dan utuh. URL signed sumber tidak dimodifikasi; varian crop dibuang.
- YouTube `https://www.youtube.com/watch?v=UdrVgxD4Ixs&list=RDUdrVgxD4Ixs&start_radio=1`: metadata format tanpa URL file langsung. Sesuai keputusan Vercel-only, UI menampilkan batasan khusus; bukan klaim video berhasil diunduh.
- MP3 `https://20001-guns-n-roses.mp3.pm/song/84095811-estranged/`: halaman dan kandidat MP3 berhasil diprobe, 22.693.138 byte. Melebihi batas server, sehingga hanya Buka sumber. GET probe menggantikan ketergantungan HEAD. File 22 MB tidak diunduh penuh melalui proxy.
- Dokumen `https://file-examples.com/index.php/sample-documents-download/sample-doc-download/`: HTTP 403; browser menampilkan verifikasi Cloudflare. Unduhan sumber ini tidak lulus. Fixture memastikan HTML dengan URL/MIME dokumen tidak diberi tombol Unduh. Tidak melewati anti-bot.

## Verifikasi

- 19 unit/regression/security tests lulus: crop Instagram, MIME JPEG/HEIC, batasan YouTube, dokumen HTML palsu, anti-bot, probe file besar, batas 12 kandidat/empat koneksi, SSRF/redirect/DNS pinning, pembatas ukuran.
- Smoke test PNG, MP4, MP3, PDF lulus; SHA-256 sama dengan sumber. HTML W3C dan halaman kosong tetap bekerja.
- 17 interaksi browser fixture lulus: tombol hanya untuk file terverifikasi/kecil, kualitas naik/turun, filter, empty, error, limit YouTube, loading, cancel, clipboard denied, auto-paste, fokus keyboard, nama panjang/mobile, tanpa simbol panah.
- Layout diperiksa pada 390×844 dan 1440×900. Dropdown diganti segmented buttons; logo dan kontrol tanpa panah.
- Ketujuh varian Instagram diunduh dan diperiksa dimensinya: 240×300, 320×400, 480×600, 640×800, 720×900, 1080×1350, 1440×1800. Semua berasio 4:5.
- DOCX Calibre `https://calibre-ebook.com/downloads/demos/demo.docx`: HTTP 200, 1.311.881 byte, signature ZIP DOCX valid, attachment filename benar.
- Audit akhir setelah perbaikan kontras: Accessibility 100, Best Practices 100, SEO 100, 34 passed/0 failed. PDF juga berhasil melalui tombol Unduh di browser.
- Perubahan remote Vercel Analytics dipertahankan. Import browser kini memakai `/analytics.js`, disalin dari paket saat build dan disajikan server dev; bare package import sebelumnya tidak dapat di-resolve browser tanpa bundler. Tracking dilewati pada localhost.
- Audit dependensi: 0 vulnerability.

Produksi Vercel, Safari/Firefox, dan trafik serentak belum diuji. Sumber eksternal dapat berubah berdasarkan IP, anti-bot, atau kedaluwarsa URL. Tidak ada klaim seluruh internet didukung.

---

# Hasil verifikasi — 25 November 2026 (Asia/Jakarta)

- 10 unit/security tests lulus: validasi URL, IP private/metadata/IPv6, DNS campuran, DNS pinning, redirect private/loop, batas byte content-length dan chunked, penolakan 403/kompresi, ekstraksi dan deduplikasi, kategori/label kualitas, batas hasil, nama file, method/origin/body dan rate limit.
- Build statis lulus; npm audit: 0 vulnerability.
- Integrasi nyata: PNG W3C 1.848 byte, MP4 MDN 1.128.375 byte, MP3 MDN 39.868 byte, PDF W3C 13.264 byte. SHA-256 hasil download sama dengan sumber.
- Halaman W3C menghasilkan daftar gambar nyata; example.com menghasilkan empty state; IP loopback ditolak.
- Browser Chrome: PDF diambil melalui tombol Unduh; status penerimaan byte terlihat.
- Viewport 390×844 dan 1440×900: tidak ada overflow horizontal; screenshot diperiksa. Nama sangat panjang diperiksa dengan fixture.
- 14 pemeriksaan interaksi browser lulus: hasil parsial, sort naik/turun, file besar hanya tautan sumber, filter, filter kosong, empty, error, loading, cancel, clipboard denied, auto-paste, focus, layout mobile. Respons fixture dipakai untuk keadaan terkontrol, bukan bukti dukungan platform eksternal.
- Lighthouse snapshot desktop setelah perbaikan label: Accessibility 100, Best Practices 100, SEO 100; 30 checks passed, 0 failed. Bukan audit performa jaringan produksi.

## Belum diuji / batas bukti

Vercel production, DNS, HTTPS domain, perilaku browser Safari/Firefox, perangkat fisik, kondisi trafik serentak, serta seluruh situs/ekstensi di internet belum diuji. Pengujian lokal memakai Node 26.7; CI disetel Node 24 sesuai deployment. Clipboard sukses diuji lewat event paste; dialog izin clipboard sistem tidak disetujui otomatis. Kondisi clipboard ditolak diuji dengan fixture. Streaming HLS/DASH, login, DRM, konversi dan ekstraktor platform memang tidak diimplementasikan sesuai pilihan Vercel-only. Penyimpanan file ke disk pengguna tidak dapat disimpulkan dari respons download browser.
