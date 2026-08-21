# SiWARGA PWA

Frontend PWA untuk Sistem Integrasi Warga — RT 05 / RW 13, Karanganyar.
Backend tetap Google AppScript + Google Spreadsheet.

Baca `BLUEPRINT.md` sebelum mulai kerja.

## Struktur
- `/inti`  — api, router, tema, komponen bersama
- `/modul` — satu folder per modul
- `/aset`  — logo & ikon

## Aturan
- Jangan tulis warna langsung di kode modul. Semua lewat variabel di `inti/base.css`.
- Nama file mengandung nama modul (bukan `index.js` semua).
- PIN, token, dan API key TIDAK PERNAH masuk repo ini. Repo bersifat publik.
