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
