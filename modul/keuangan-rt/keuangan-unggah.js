/* =================================================================
   keuangan-unggah.js — Unggah bukti bayar oleh warga (Tahap 4B)
   Dimuat malas, SEKALI per sesi, oleh muatSkripUnggah().
   Karena keuangan-rt.html diambil ulang tiap kunjungan, semua
   pendengar elemen dipasang ulang di bukaUnggah(), bukan di sini.
   ================================================================= */

const Unggah = { rumah: '', gambar: '', sibuk: false, sesi: 0 };

// Urutan percobaan: [sisi terpanjang px, mutu JPEG]. Berhenti di yang pertama muat.
const UKURAN_COBA = [[1600, 0.82], [1280, 0.70], [1024, 0.60]];
const BATAS_KARAKTER_GAMBAR = 1200000;   // harus di bawah batas server (1.500.000)

function uel(id){ return document.getElementById(id); }

/* ---------- BUKA / TUTUP ---------- */

function bukaUnggah(noRumah){
  Unggah.rumah  = String(noRumah || '');
  Unggah.gambar = '';
  Unggah.sibuk  = false;
  Unggah.sesi++;

  uel('ungRumah').textContent = Unggah.rumah;
  uel('ungBerkas').value = '';
  uel('ungBerkas').onchange = tanganiBerkas;                 // dipasang ulang tiap buka
  uel('ungNominal').oninput = function(){
    const d = digitSaja(this.value);
    this.value = d ? Number(d).toLocaleString('id-ID') : '';
  };

  galat1('');
  galat('');
  uel('ungPratinjau').removeAttribute('src');
  uel('ungPilih').classList.remove('ung-sembunyi');
  uel('ungHasil').classList.add('ung-sembunyi');
  uel('ungBawah').classList.add('ung-sembunyi');
  uel('ungForm').classList.remove('ung-sembunyi');

  bukaLembar('lembarUnggah');
}

function tutupUnggah(){
  if (Unggah.sibuk && !confirm('Proses masih berjalan. Tutup juga?')) return;
  Unggah.sesi++;                                             // abaikan hasil yang terlambat
  Unggah.sibuk = false;
  tutupLembar('lembarUnggah');
}

function ulangiPilih(){
  if (Unggah.sibuk) return;
  Unggah.gambar = '';
  uel('ungBerkas').value = '';
  uel('ungHasil').classList.add('ung-sembunyi');
  uel('ungBawah').classList.add('ung-sembunyi');
  uel('ungPilih').classList.remove('ung-sembunyi');
  galat('');
  uel('ungBerkas').click();
}

/* ---------- ALAT KECIL ---------- */

function galat1(t){ const e = uel('ungGalat1'); e.textContent = t || ''; e.classList.toggle('on', !!t); }
function galat(t){  const e = uel('ungGalat');  e.textContent = t || ''; e.classList.toggle('on', !!t); }

function setStatus(teks, jenis){
  const e = uel('ungStatus');
  e.textContent = teks;
  e.className = 'ung-status ' + jenis;
}

/** Untuk ketikan warga: hanya angka. */
function digitSaja(s){ return String(s == null ? '' : s).replace(/\D/g, ''); }

/** Untuk nilai dari AI: bisa 50000, "50.000", "Rp 50.000,00", atau "50000.00". */
function angkaNominal(v){
  if (typeof v === 'number') return Math.round(v) || 0;
  let s = String(v == null ? '' : v).replace(/[^\d.,]/g, '');
  s = s.replace(/[.,]\d{1,2}$/, '');          // buang sen di ujung (1–2 digit saja)
  return Number(s.replace(/\D/g, '')) || 0;
}

function hariIniISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* ---------- FOTO → JPEG KECIL ---------- */

async function bacaGambar(berkas){
  // imageOrientation menghormati arah foto dari kamera HP
  if (window.createImageBitmap){
    try { return await createImageBitmap(berkas, { imageOrientation: 'from-image' }); }
    catch (e) { /* lanjut ke cara lama */ }
  }
  return new Promise(function(ok, gagal){
    const url = URL.createObjectURL(berkas);
    const im = new Image();
    im.onload  = function(){ URL.revokeObjectURL(url); ok(im); };
    im.onerror = function(){ URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibuka. Coba foto lain.')); };
    im.src = url;
  });
}

function keJpeg(sumber, w0, h0, maks, mutu){
  const skala = Math.min(1, maks / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * skala));
  const h = Math.max(1, Math.round(h0 * skala));
  const kanvas = document.createElement('canvas');
  kanvas.width = w; kanvas.height = h;
  const ctx = kanvas.getContext('2d');
  ctx.fillStyle = '#fff';                     // PNG transparan jadi putih, bukan hitam
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sumber, 0, 0, w, h);
  return kanvas.toDataURL('image/jpeg', mutu);
}

async function perkecilFoto(berkas){
  const sumber = await bacaGambar(berkas);
  const w0 = sumber.width  || sumber.naturalWidth;
  const h0 = sumber.height || sumber.naturalHeight;
  if (!w0 || !h0) throw new Error('Foto tidak bisa dibaca. Coba foto lain.');

  for (let i = 0; i < UKURAN_COBA.length; i++){
    const hasil = keJpeg(sumber, w0, h0, UKURAN_COBA[i][0], UKURAN_COBA[i][1]);
    if (hasil.length <= BATAS_KARAKTER_GAMBAR){
      if (sumber.close) sumber.close();
      return hasil;
    }
  }
  if (sumber.close) sumber.close();
  throw new Error('Foto terlalu besar untuk dikirim. Coba foto ulang dari jarak sedikit lebih jauh.');
}

/* ---------- PILIH FOTO → PERKECIL → BACA STRUK ---------- */

async function tanganiBerkas(ev){
  const berkas = ev.target.files && ev.target.files[0];
  if (!berkas) return;

  galat1('');
  if (!/^image\//.test(berkas.type)){
    galat1('Pilih berkas gambar (foto struk).');
    return;
  }
  if (berkas.size > 30 * 1024 * 1024){
    galat1('Foto terlalu besar (lebih dari 30 MB).');
    return;
  }

  const sesi = Unggah.sesi;
  Unggah.sibuk = true;

  // Tampilkan area hasil dulu, form dan tombol kirim disembunyikan sampai scan selesai
  uel('ungPilih').classList.add('ung-sembunyi');
  uel('ungHasil').classList.remove('ung-sembunyi');
  uel('ungForm').classList.add('ung-sembunyi');
  uel('ungBawah').classList.add('ung-sembunyi');
  galat('');
  setStatus('Menyiapkan foto…', 'proses');

  try {
    const jpeg = await perkecilFoto(berkas);
    if (sesi !== Unggah.sesi) return;
    Unggah.gambar = jpeg;
    uel('ungPratinjau').src = jpeg;

    setStatus('Membaca struk dengan AI… bisa sampai 20 detik.', 'proses');
    const d = await panggilAPI('scanBukti', Unggah.rumah, jpeg);
    if (sesi !== Unggah.sesi) return;

    tampilkanHasilScan(d);
  } catch (e) {
    if (sesi !== Unggah.sesi) return;
    Unggah.gambar = '';
    uel('ungHasil').classList.add('ung-sembunyi');
    uel('ungPilih').classList.remove('ung-sembunyi');
    galat1(e.message);
  } finally {
    if (sesi === Unggah.sesi) Unggah.sibuk = false;
  }
}

function tampilkanHasilScan(d){
  d = d || {};

  const tgl = /^\d{4}-\d{2}-\d{2}$/.test(d.tgl || '') ? d.tgl : hariIniISO();
  const nom = angkaNominal(d.nominal);

  uel('ungTgl').value = tgl;
  uel('ungNominal').value = nom ? nom.toLocaleString('id-ID') : '';
  uel('ungKet').value = String(d.catatan || '').substring(0, 200);
  uel('ungRef').value = String(d.ref_id || '-').substring(0, 60);

  if (d.is_valid_dest === false){
    // Rekening salah: form dan tombol kirim TIDAK ditampilkan
    setStatus(d.warning_message || 'Rekening tujuan tidak cocok dengan rekening RT.', 'salah');
    uel('ungForm').classList.add('ung-sembunyi');
    uel('ungBawah').classList.add('ung-sembunyi');
    return;
  }

  if (d.is_valid_dest === true){
    setStatus('Tujuan transfer sesuai rekening RT. Periksa isian di bawah, perbaiki bila salah baca.', 'ok');
  } else {
    setStatus('Tujuan transfer belum bisa dipastikan oleh AI. Bendahara akan memeriksanya. Periksa isian di bawah.', 'ragu');
  }

  uel('ungForm').classList.remove('ung-sembunyi');
  uel('ungBawah').classList.remove('ung-sembunyi');
}

/* ---------- KIRIM ---------- */

async function kirimBukti(){
  if (Unggah.sibuk) return;
  galat('');

  const tgl = uel('ungTgl').value;
  const nominal = Number(digitSaja(uel('ungNominal').value));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return galat('Tanggal transfer belum diisi.');
  if (!nominal || nominal <= 0)          return galat('Nominal belum diisi.');
  if (!Unggah.gambar)                    return galat('Foto belum ada. Pilih foto struk dulu.');

  const sesi = Unggah.sesi;
  Unggah.sibuk = true;
  tunggu('Mengirim bukti…', 'Jangan tutup halaman ini.');

  try {
    await panggilAPI('kirimBukti', {
      noRumah:     Unggah.rumah,
      tgl:         tgl,
      nominal:     nominal,
      keterangan:  uel('ungKet').value,
      refId:       uel('ungRef').value,
      imageBase64: Unggah.gambar
    });

    selesaiTunggu();
    if (sesi === Unggah.sesi){
      Unggah.sibuk = false;
      tutupLembar('lembarUnggah');
    }
    toast('Bukti terkirim. Menunggu verifikasi Bendahara.');
  } catch (e) {
    selesaiTunggu();
    if (sesi === Unggah.sesi){
      Unggah.sibuk = false;
      galat(e.message);
    }
  }
}