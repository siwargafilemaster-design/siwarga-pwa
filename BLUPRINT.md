# BLUEPRINT — Migrasi SiWARGA ke PWA

**Status:** Perencanaan selesai · Eksekusi ditunda sampai siap
**Disusun:** Agustus 2026
**Pemilik:** Edi Susilo — Griya Gamersi Lalung RT 05 / RW 13, Karanganyar

---

## 1. Tujuan

Memindahkan **frontend** SiWARGA dari Google AppScript HtmlService ke aplikasi web statis (PWA) di Vercel, dengan pola yang sama seperti Aplikasi Zakat Masjid Al Ikhlas.

**Yang TIDAK berubah:**

- AppScript tetap jadi backend
- Google Spreadsheet tetap jadi database
- Seluruh logika `.gs` tetap dipakai (dibungkus router, bukan ditulis ulang)
- Struktur menu tetap sama (boleh rename, tidak boleh dirombak)

**Yang berubah:**

- Halaman tidak lagi dirender server (`include()` + `HtmlService`), tapi file statis di Vercel
- `google.script.run` diganti panggilan HTTP ke API
- Keamanan role dipindah dari sisi HP ke sisi server

---

## 2. Arsitektur Tujuan

```
[ HP Warga / Pengurus ]
         │
         │  PWA statis (HTML/CSS/JS)
         ▼
[ Vercel — siwarga.vercel.app ]
         │
         │  fetch POST { action, token, args }
         ▼
[ AppScript Web App — doPost ]
         │
         ├─ cek token & izin role
         ├─ dispatch ke fungsi Helper*.gs
         ▼
[ Google Spreadsheet ]
```

---

## 3. Keputusan Yang Sudah Dikunci

| Topik | Keputusan |
|---|---|
| Repo | **Repo baru terpisah** di akun GitHub yang sama. Kode AppScript lama tetap utuh & jalan selama migrasi |
| Struktur folder | **Colocation per modul** — satu folder per modul berisi js + html modul itu |
| Chatbot WA | **Dihapus.** `doPost` bebas dipakai penuh untuk API |
| Kirim WA | **Tetap ada** — `kirimPesanWA()` masih dipakai untuk notifikasi keluar |
| Navigasi | Bottom nav **cerdas per role** + tombol Menu (drawer menu lengkap) |
| Landing | Halaman pembuka **mengikuti role** setelah login |
| Tombol SOS | **Hanya muncul di Beranda**, tombol bulat merah kecil, berdenyut |
| Sesi | **Sesi geser** (diperpanjang tiap aktivitas), token di server |
| Kesadaran info | **Penanda titik merah** di tombol Beranda, bukan memaksa logout |
| Gaya visual | Ditentukan **belakangan**, semua warna lewat variabel CSS |

---

## 4. Struktur Repo

```
/
├── index.html            ← satu-satunya halaman (shell SPA)
├── manifest.json
├── sw.js                 ← service worker
│
├── /inti
│   ├── api.js            ← panggilAPI(), penanganan token & error
│   ├── app.js            ← nav(), login, applyRole, bottom nav
│   ├── base.css          ← VARIABEL warna, font, radius, spasi
│   └── components.css    ← kartu, chip, baris transaksi, tombol
│
├── /aset
│   └── logo, ikon PWA
│
└── /modul
    ├── /dashboard
    │   ├── dashboard.html
    │   └── dashboard.js
    ├── /keuangan-rt
    │   ├── keuangan-rt.html
    │   ├── keuangan-rt.js
    │   └── form-transaksi.html
    ├── /rumah
    ├── /data-pokok
    ├── /verifikasi
    ├── /dokumen-rt
    ├── /pkk
    │   ├── pkk.html / pkk.js
    │   ├── form-edit-pkk.html
    │   └── form-dasa-wisma.html
    ├── /keuangan-pkk
    ├── /dokumen-pkk
    ├── /laporan-pkk
    ├── /peta
    ├── /pengurus
    ├── /surat
    ├── /setting
    ├── /humas
    ├── /tabungan
    └── /arisan
```

**Aturan penamaan:** nama file mengandung nama modul (bukan `index.js` semua) — supaya tab di Codespaces mudah dibedakan di layar HP.

---

## 5. Kontrak API

Mengikuti pola **FONDASI Project Baru** yang sudah terbukti di aplikasi Zakat, ditambah satu field: `token`.

### Format permintaan

```json
{
  "action": "getDaftarRumahKeuangan",
  "token": "abc123...",
  "args": []
}
```

`args` berupa **array**, bukan objek — supaya bisa langsung diteruskan dengan `.apply(null, args)` seperti di fondasi zakat. Urutannya mengikuti parameter fungsi `.gs`-nya.

### Format jawaban

```json
{
  "status": "success",
  "data": { }
}
```

```json
{
  "status": "error",
  "code": "SESI_HABIS",
  "message": "Sesi sudah tidak berlaku, silakan login lagi."
}
```

Bedanya dengan fondasi zakat: ada `code` untuk error yang perlu ditangani khusus oleh frontend (terutama `SESI_HABIS`, supaya bisa memunculkan login ulang tanpa kehilangan data yang sedang diisi).

### Router

`doPost` berisi **dispatch table** — daftar action yang diizinkan, beserta role mana yang boleh memanggilnya. Fungsi `.gs` yang tidak terdaftar **tidak bisa** dipanggil dari luar.

```
DAFTAR_ACTION = {
  getDaftarRumahKeuangan : { fn: ..., role: ['BENDAHARA','DEVELOPER'] },
  simpanTransaksiRT      : { fn: ..., role: ['BENDAHARA','DEVELOPER'] },
  getDashboard           : { fn: ..., role: 'SEMUA' },
  ...
}
```

**Catatan CORS:** sudah **terbukti berhasil** di aplikasi Zakat. Kuncinya: `fetch` dikirim **tanpa header `Content-Type`**, sehingga dianggap permintaan sederhana dan browser tidak mengirim preflight `OPTIONS` — yang memang tidak bisa dijawab AppScript. Jangan pernah menambahkan header itu "supaya lebih rapi"; justru itu yang merusaknya.

---

## 6. Sesi & Izin

### Kenapa wajib

Sekarang role hanya disimpan di `localStorage` HP. Menu tersembunyi = gembok visual, bukan gembok data. Begitu backend jadi API terbuka, siapa pun bisa memanggil endpoint langsung tanpa PIN.

### Cara kerja

1. Login → server cek Role + PIN (logika `loginSystem` yang sudah ada)
2. Server buat **token acak**, simpan bersama: role, waktu aktivitas terakhir
3. HP menyimpan token saja (bukan role sebagai izin)
4. Tiap panggilan API membawa token → server cek berlaku + role berhak
5. **Sesi geser:** tiap panggilan memperpanjang waktu berlaku

### Aturan

| Hal | Nilai |
|---|---|
| Jenis kedaluwarsa | Geser (dihitung dari aktivitas terakhir) |
| Batas diam | 24 jam (mudah diubah, satu konstanta) |
| Penyimpanan | `PropertiesService` |
| Logout | Hapus token di server |

**Penting — jebakan teknis:** `CacheService` di AppScript batas maksimalnya **6 jam**, jadi tidak bisa dipakai untuk sesi 24 jam. Harus `PropertiesService`, dengan stempel waktu disimpan manual.

**Sesi habis saat mengisi form:** jangan sampai data hilang. Munculkan permintaan login ulang, lalu lanjutkan simpanan yang tertunda.

### Grup izin (dari `applyRole()` yang sudah ada)

| Grup | Anggota |
|---|---|
| Admin Lingkungan | DEVELOPER, RT, SEKRETARIS |
| Keuangan | DEVELOPER, BENDAHARA |
| PKK | DEVELOPER, PKK |
| Humas | DEVELOPER, HUMAS, RT, SEKRETARIS |
| Bank / Teller | DEVELOPER, TELLER |
| Surat | RT, SEKRETARIS, DEVELOPER |
| Verifikasi | BENDAHARA, DEVELOPER |

Grup ini harus ada **salinannya di server**, bukan hanya di frontend.

---

## 7. Pemisahan Konfigurasi

`getKonfigurasi()` saat ini mengembalikan **seluruh** isi `CONF_Developer` — termasuk semua PIN dan token Fonnte. Ini harus dipecah:

**Boleh keluar ke frontend:**
- Nama aplikasi, nama RT, deskripsi
- Logo, warna tema
- Kop surat, tanda tangan digital

**TIDAK PERNAH keluar dari server:**
- `PIN_SUPER_ADMIN`, `PIN_RT`, `PIN_PKK`, dan semua PIN lain
- `WHATSAPP_TOKEN` / `FONNTE_TOKEN`

---

## 8. Navigasi

### Bottom nav per role

4 pintasan + tombol Menu. Diturunkan dari grup izin di atas.

| Role | Pintasan |
|---|---|
| Mode Tamu | Beranda · Rumah · Denah · Arisan |
| Admin RT | Beranda · Rumah · Surat · Dokumen RT |
| Sekretaris | Beranda · Data Pokok · Surat · Dokumen RT |
| Bendahara RT | Beranda · Kas RT · Verifikasi · Rumah |
| Admin PKK | Beranda · Anggota PKK · Kas PKK · Laporan |
| Admin Bank PKK | Beranda · Bank PKK · Kas PKK · Anggota PKK |
| Admin Humas | Beranda · Hunian · Rumah · Denah |
| Super Admin | Beranda · Kas RT · Rumah · Setelan |

Daftar ini satu tabel di kode — gampang ditukar kapan saja.

### Drawer

Berisi **seluruh menu** dengan grup yang sama seperti sekarang: Menu RT, Menu PKK, Administrasi, Management Property, Fitur Extra. Tidak ada menu yang hilang.

### Landing per role

Setelah **login**, langsung mendarat di halaman kerja utamanya (Teller → Bank PKK, Bendahara → Kas RT). Membuka aplikasi tanpa login tetap dari Beranda.

### Penanda notifikasi

Titik merah di tombol Beranda saat ada pengumuman baru atau agenda hari ini. Ini pengganti ide "paksa logout supaya lihat Beranda" yang sudah dibatalkan.

---

## 9. Gaya Visual

**Prinsip: struktur dikunci sekarang, rasa visual dipoles belakangan.**

- Pola navigasi, kerangka halaman, dan komponen → sudah final (mockup v3)
- Warna, font, bayangan, kelengkungan → ditentukan setelah lihat data asli

**Syarat mutlak:** tidak boleh ada warna ditulis langsung di kode modul. Semua lewat variabel CSS di `base.css`. Ini satu-satunya hal yang membuat "poles belakangan" jadi mungkin tanpa membongkar 14 modul.

**Acuan bentuk:** `siwarga-pwa-mockup-v3.html` — hero melengkung, kartu identitas menimpa hero, widget ronda gelap, kalender berbentuk kartu bertanggal, font Poppins.

---

## 10. Roadmap Eksekusi

### Tahap 0 — Persiapan
- Buat repo publik baru
- Siapkan kerangka folder (Bagian 15)
- Salin pola `panggilAPI()` dari dokumen **FONDASI Project Baru**
- Uji sambungan sekadar memastikan setelan deploy script SiWARGA benar — **bukan lagi taruhan**, polanya sudah terbukti di aplikasi Zakat

### Tahap 1 — Fondasi Backend
- Hapus `doPost` chatbot, `getInfoTagihanBot`, `replyWA`
- Bangun router `doPost` + dispatch table
- Bangun sesi geser (token + `PropertiesService`)
- Pisahkan config publik vs rahasia
- Salin grup izin ke server

### Tahap 2 — Shell Frontend
- `index.html`, manifest, service worker
- `api.js` — `panggilAPI()` + penanganan sesi habis
- `app.js` — nav, login, applyRole, bottom nav per role
- `base.css` + `components.css`
- Modul Dashboard sebagai halaman pertama

### Tahap 3 — Modul Pilot: Keuangan RT
Membuktikan pola dari hulu ke hilir, termasuk mengubah form dari `getHtmlContent(file)` jadi template sisi klien.

**File yang dibutuhkan:** `HelperKeuanganRT.gs`, `PageKeuanganRT.html`, `FormTransaksi.html`, kemungkinan `HelperForm.gs` & `HelperPageTransaksi.gs`

### Tahap 4 — Sisa Modul
Ulangi pola pilot, satu per satu. SiWARGA lama tetap jalan sampai semua siap.

### Tahap 5 — Poles Visual
Buat 2–3 alternatif tema, pilih satu, terapkan lewat variabel.

---

## 11. Inventaris Modul

| Modul | Backend | Frontend |
|---|---|---|
| Inti | `Code.gs`, `HelperConfig.gs`, `AdminReset.gs` | `Index.html`, `GlobalCSS`, `GlobalJS`, `Asset`, `ModalPengumuman` |
| Dashboard | `HelperDashboard.gs` | `PageDashboard.html` |
| Data Pokok | `HelperDataPokok.gs` | `PageDataPokok`, `FormEditPokok` |
| Rumah | `HelperRumah.gs` | `PageRumah` |
| Peta | `HelperPeta.gs` | `PagePeta` |
| Keuangan RT | `HelperKeuanganRT.gs` | `PageKeuanganRT`, `FormTransaksi` |
| Verifikasi | `HelperPageTransaksi.gs` | `PageVerifikasi` |
| PKK | `HelperPKK.gs` | `PagePKK`, `FormEditPKK`, `FormDasaWisma` |
| Keuangan PKK | `HelperKeuanganPKK.gs` | `PageKeuanganPKK`, `FormTransaksiPKK` |
| Tabungan PKK | `HelperTabunganPKK.gs` | `PageTabunganPKK` |
| Laporan PKK | `HelperSetupRekapPKK.gs` | `PageLaporanPKK`, `DialogLaporanPKK` |
| Arisan | `HelperArisan.gs`, `HelperArisanAdmin.gs`, `HelperArisanPeserta.gs` | `PageArisan`, `PageAdminArisan`, `PagePesertaArisan` |
| Humas | `HelperHumas.gs` | `PageHumas` |
| Surat | `HelperSurat.gs` | `PageSurat` |
| Dokumen | `HelperDokumen.gs` | `PageDokumenRapatRT`, `PageDokumenRapatPKK` |
| Setting | `HelperPageSetting.gs` | `PageSetting` |
| Ronda | `HelperRonda.gs` | *(tidak punya halaman — hanya widget di Dashboard, ikut folder `/modul/dashboard`)* |
| Pengurus | *(perlu dicek)* | `PagePengurus` |

---

## 12. Hasil Verifikasi File

### Sudah jelas

| File | Hasil | Dampak ke struktur |
|---|---|---|
| `HelperRonda.gs` | Hanya dipakai Dashboard, tidak punya halaman sendiri | Masuk `/modul/dashboard` |
| `PageVerifikasi.html` | Dilayani `HelperPageTransaksi.gs` | Masuk `/modul/verifikasi` |
| `Asset.html` | Isinya gambar yang diubah jadi base64 | Bukan halaman — gambar dipindah jadi **file statis biasa** di `/aset`, tidak perlu base64 lagi |
| `HelperForm.gs` | Mengisi dropdown nama warga di **Google Form eksternal** *(perlu konfirmasi ulang)* | **Bukan modul UI.** Tidak ikut migrasi — tetap murni di sisi `.gs` |

**Catatan penamaan:** `HelperPageTransaksi.gs` ternyata melayani Verifikasi, bukan Keuangan RT. Namanya menyesatkan. Saat migrasi, pertimbangkan rename jadi `verifikasi.js` supaya tidak membingungkan nanti.

**Keuntungan tak terduga dari `Asset.html`:** di PWA, gambar tidak perlu lagi dikonversi base64 dan disisipkan ke HTML. Cukup taruh sebagai file di `/aset`, dipanggil biasa. Ini bikin aplikasi lebih ringan dan bisa di-cache service worker — salah satu keuntungan nyata pindah ke Vercel.

### Masih terbuka

- **`PagePengurus.html`** — helper-nya belum diketahui. Dugaan: `HelperDataPokok.gs` atau `HelperConfig.gs`. Cek dengan mencari `google.script.run` di dalam `PagePengurus.html`, lalu cari nama fungsinya di file `.gs`. Tidak mendesak — modul ini baru digarap di Tahap 4.

### Catatan khusus: Google Form eksternal

`HelperForm.gs` ternyata **bukan** bagian dari antarmuka aplikasi. Fungsinya mengisi dropdown nama warga di sebuah **Google Form terpisah**, yang jawabannya masuk ke sheet `DB_Respon` (lihat `SHEET_NAME.FORM_RESPON`).

Artinya:

- **Tidak ada folder `/modul/form`.** File ini tetap tinggal di AppScript apa adanya.
- Alur Google Form → `DB_Respon` **tidak tersentuh migrasi** dan tetap jalan seperti biasa.
- Tidak perlu masuk dispatch table `doPost` — dia tidak dipanggil dari frontend.
- Kemungkinan dijalankan lewat trigger atau saat data warga berubah. Perlu dicek supaya tidak tak sengaja dihapus saat merapikan `Code.gs`.

**Jangan sampai terlewat:** karena file ini tidak muncul di mana pun dalam struktur PWA, mudah terlupa dan ikut terhapus. Padahal kalau dropdown Google Form berhenti terisi, warga tidak bisa mengisi form dengan benar.

---

## 13. Catatan Penting

**Ini proyek berbulan-bulan, bukan satu-dua sesi.** Zakat ~6 file; SiWARGA ~50 file, 18 modul. Tapi setelah fondasi berdiri, tiap modul jadi pekerjaan berulang yang polanya sama.

**Tidak ada tekanan waktu.** SiWARGA versi AppScript tetap dipakai warga selama migrasi berjalan. Migrasi gagal di tengah jalan pun, yang lama tidak terganggu.

**Sebagian temuan bisa dikerjakan sekarang tanpa menunggu PWA** — misalnya memisahkan `getKonfigurasi()` supaya PIN tidak ikut terkirim ke frontend.

---

## 14. Saat Mulai Nanti

Kirimkan versi terbaru:

1. `Code.gs`
2. `HelperConfig.gs`
3. Dokumen **FONDASI Project Baru** (pola AppScript-API dari aplikasi Zakat) — sebagai acuan pola yang sudah terbukti

Lalu mulai dari **Tahap 0**.

---

## 15. Perintah Setup Repo (Tahap 0)

Semua perintah di bawah dijalankan di **terminal Codespaces**. Urut dari atas ke bawah, sekali salin-tempel per blok.

### 15.1 Masuk ke folder kerja

Codespaces biasanya membuka repo di `/workspaces/<nama-repo>`. Pastikan posisi sudah benar:

```bash
pwd
```

Kalau belum di akar repo, pindah dulu — jangan sampai folder terbentuk di tempat yang salah.

### 15.2 Buat semua folder sekaligus

```bash
mkdir -p inti aset modul/{dashboard,keuangan-rt,rumah,data-pokok,verifikasi,dokumen-rt,pkk,keuangan-pkk,dokumen-pkk,laporan-pkk,peta,pengurus,surat,setting,humas,tabungan,arisan}
```

### 15.3 Buat file tiap modul

```bash
for m in dashboard keuangan-rt rumah data-pokok verifikasi dokumen-rt pkk keuangan-pkk dokumen-pkk laporan-pkk peta pengurus surat setting humas tabungan arisan; do
  touch "modul/$m/$m.html" "modul/$m/$m.js"
done
```

### 15.4 Buat file form tambahan

Form yang ikut modulnya:

```bash
touch modul/keuangan-rt/form-transaksi.html
touch modul/keuangan-pkk/form-transaksi-pkk.html
touch modul/pkk/form-edit-pkk.html
touch modul/pkk/form-dasa-wisma.html
touch modul/data-pokok/form-edit-pokok.html
touch modul/laporan-pkk/dialog-laporan-pkk.html
touch modul/arisan/arisan-admin.html
touch modul/arisan/arisan-peserta.html
```

### 15.5 Buat file inti & akar

```bash
touch index.html manifest.json sw.js
touch inti/{api.js,app.js,base.css,components.css}
```

### 15.6 Isi file penunjang

**`.gitignore`**

```bash
cat > .gitignore << 'EOF'
node_modules/
.DS_Store
.vercel
*.log
.env
.env.local
EOF
```

**`README.md`**

```bash
cat > README.md << 'EOF'
# SiWARGA PWA

Frontend PWA untuk Sistem Integrasi Warga — Griya Gamersi Lalung RT 05 / RW 13, Karanganyar.
Backend tetap Google AppScript + Google Spreadsheet.

Baca `BLUEPRINT.md` sebelum mulai kerja.

## Struktur
- `/inti`  — api, router, tema, komponen bersama
- `/modul` — satu folder per modul
- `/aset`  — logo & ikon

## Aturan
- Jangan tulis warna langsung di kode modul. Semua lewat variabel di `inti/base.css`.
- Nama file mengandung nama modul (bukan `index.js` semua).
EOF
```

**`manifest.json`**

```bash
cat > manifest.json << 'EOF'
{
  "name": "SiWARGA — Sistem Integrasi Warga",
  "short_name": "SiWARGA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#22303F",
  "theme_color": "#22303F",
  "orientation": "portrait",
  "icons": [
    { "src": "/aset/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/aset/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
EOF
```

### 15.7 Salin blueprint ke repo

Unggah file `BLUEPRINT-SiWARGA-PWA.md` ke akar repo, lalu:

```bash
mv BLUEPRINT-SiWARGA-PWA.md BLUEPRINT.md
```

### 15.8 Periksa hasilnya

```bash
find . -not -path './.git/*' -not -path './node_modules/*' | sort
```

Kalau `tree` tersedia, lebih enak dibaca:

```bash
tree -a -I '.git|node_modules'
```

### 15.9 Simpan ke GitHub

```bash
git add -A
git commit -m "Kerangka awal repo SiWARGA PWA"
git push
```

---

### 15.10 Uji Sambungan — dua lapis

**CORS bukan lagi risiko.** Polanya sudah terbukti di aplikasi Zakat dan terdokumentasi di **FONDASI Project Baru**. Yang diuji di sini hanya memastikan setelan deploy script SiWARGA sudah benar.

Uji **dua lapis** — dua hal yang berbeda, jangan dicampur:

#### Lapis 1 — fungsi hidup? (belum menguji CORS)

Tambahkan cabang tes sementara di `doGet`, lalu buka di browser HP:

```
URL_EXEC?page=test
```

Kalau muncul JSON, berarti fungsi & keluaran JSON sehat.

> **Peringatan khusus SiWARGA — lebih keras dari catatan di fondasi.**
> Repo ini publik dan datanya data warga. Cabang `?page=test` **jangan pernah** memanggil fungsi yang mengembalikan data sungguhan atau isi config. Pakai fungsi dummy seperti `{ok:true, waktu:...}` saja. Lalu **hapus cabangnya dan deploy ulang** setelah selesai.

#### Lapis 2 — CORS lolos? (uji yang sebenarnya)

Dari halaman di Vercel, panggil `panggilAPI('ping')` dan tampilkan hasilnya. Data muncul = seluruh rantai bekerja: Vercel → fetch → `doPost` → fungsi → JSON balik.

#### Setelan deploy — sumber masalah paling sering

- Deploy → **New deployment** → Web app
- **Execute as:** `Me`
- **Who has access:** `Anyone` (bukan "Anyone with Google account")
- URL yang dipakai berakhiran `/exec`, bukan `/dev`
- **Tiap kali kode `.gs` diubah, deploy versi baru.** Kode sudah benar tapi yang jalan versi lama — ini penyebab kebingungan nomor satu.

#### Catatan penting saat mengerjakan SiWARGA

Script SiWARGA **sudah punya `doPost`** (bekas chatbot WhatsApp) dan **`doGet` yang melayani aplikasi lama**. Jangan asal timpa:

- Kerjakan uji coba di **project AppScript baru yang kosong**, jangan di script SiWARGA yang sedang dipakai warga.
- Saat nanti benar-benar mengganti `doPost` di SiWARGA, aplikasi lama tetap jalan karena dia memakai `doGet` — dua pintu yang berbeda.

## 16. Aturan Repo Publik

**Keputusan: repo dibuat publik.** Alamat dan nama RT dianggap bukan informasi sensitif — tidak masalah terbaca umum.

Tapi ada konsekuensi teknis yang harus dijaga ketat:

### Yang ikut terbaca publik

- Seluruh kode frontend, termasuk `inti/api.js`
- **URL Web App AppScript** — siapa pun bisa melihat dan memanggilnya

Ini **bukan alasan untuk menyembunyikan URL**, karena URL memang harus ada di frontend agar aplikasi jalan — repo privat pun URL-nya tetap terbaca dari browser. Yang benar: anggap URL itu memang publik, dan **pastikan servernya yang menjaga diri.**

### Konsekuensi: penjagaan server jadi wajib, bukan opsional

Karena endpoint terbuka dan URL-nya diketahui umum, seluruh rencana di Bagian 6 (sesi + izin per action) **tidak boleh dilewati atau ditunda**. Tanpa itu, siapa pun bisa memanggil action apa pun.

### Pantangan mutlak — jangan pernah masuk repo

| Item | Tempat yang benar |
|---|---|
| Semua `PIN_*` | Sheet `CONF_Developer`, dibaca server saja |
| `WHATSAPP_TOKEN` / `FONNTE_TOKEN` | Sheet `CONF_Developer`, dibaca server saja |
| API key Gemini (OCR struk) | Sheet config, **dipanggil dari server**, jangan dari frontend |
| Data warga sungguhan | Spreadsheet — jangan pernah jadi file contoh di repo |

**Aturan praktis:** kalau sebuah nilai membuat orang bisa melakukan sesuatu atas nama kita, dia tinggal di Spreadsheet dan hanya disentuh `.gs`. Tidak pernah ditulis di file mana pun dalam repo.

### Kalau sudah terlanjur ter-commit

Menghapus barisnya di commit berikutnya **tidak cukup** — riwayat Git masih menyimpannya dan tetap terbaca. Yang benar: **ganti nilainya** (PIN baru, token baru). Anggap yang lama sudah bocor.

### Sebelum push pertama

Periksa cepat:

```bash
git grep -nEi "PIN_|TOKEN|API_KEY|AIza" -- . || echo "Bersih."
```
