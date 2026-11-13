/* =================================================================
   MODUL DATA POKOK WARGA (Tahap 5B)
   Data disaring server sesuai peran. Field yang tidak dikirim
   memang tidak boleh dilihat peran ini.
   ================================================================= */

const Pk = {
  data: [], tingkat: 0, bolehUbah: false, filter: 'aktif', cari: '',
  aktif: null,            // warga yang sedang dibuka
  mode: 'TAMBAH',         // TAMBAH | UBAH
  rantai: null,           // { rumah, total, ke, adaKK, namaKK, bawa:{...} }
  formTerakhir: null,     // form UBAH yang menunggu keputusan
  pilihan: '',            // kunci KK baru, atau 'SEMUA'
  sibuk: false
};

const PK_PILIHAN = {
  pfHub: ['Kepala Keluarga', 'Istri', 'Suami', 'Anak', 'Orang Tua', 'Mertua', 'Famili Lain'],
  pfJk: ['Laki-laki', 'Perempuan'],
  pfAgama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
  pfKawin: ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'],
  pfTinggal: ['Milik Sendiri', 'Sewa/Kontrak', 'Numpang', 'Dinas'],
  pfDomisili: ['Warga Tetap', 'Warga Tidak Tetap']
};

// Alamat bawaan untuk input baru (nanti dipindah ke Pengaturan)
const PK_ALAMAT_BAWAAN = { rt: '05', rw: '13', kel: 'Lalung', kec: 'Karanganyar', kab: 'Karanganyar' };

async function init_data_pokok(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Pk.data = []; Pk.tingkat = 0; Pk.bolehUbah = false; Pk.filter = 'aktif'; Pk.cari = '';
  Pk.aktif = null; Pk.rantai = null; Pk.formTerakhir = null; Pk.pilihan = ''; Pk.sibuk = false;
  isiSemuaPilihan();
  await muatPokok();
}

/* ---------- DAFTAR ---------- */
async function muatPokok(){
  const kotak = document.getElementById('pkDaftar');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Memuat data warga…</div>';
  try {
    const h = await panggilAPI('daftarPokok');
    Pk.data = h.data || [];
    Pk.tingkat = h.tingkat || 0;
    Pk.bolehUbah = !!h.bolehUbah;
    document.getElementById('pkTambah').classList.toggle('pk-sembunyi', !Pk.bolehUbah);
    gambarPokok();
  } catch (e) {
    document.getElementById('pkSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + pkAman(e.message) + '</p></div>';
  }
}

function setFilterPokok(f){
  Pk.filter = f;
  document.querySelectorAll('.pk-chip').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-f') === f);
  });
  gambarPokok();
}

function pkIsKK(o){ return String(o.hub || '').toLowerCase().indexOf('kepala') !== -1; }

function gambarPokok(){
  const kotak = document.getElementById('pkDaftar');
  if (!kotak) return;

  const aktif = Pk.data.filter(function(o){ return o.aktif; });
  const kk = aktif.filter(pkIsKK).length;
  document.getElementById('pkSub').textContent = aktif.length + ' jiwa aktif · ' + kk + ' kepala keluarga';

  const q = Pk.cari.trim().toLowerCase();
  const grup = [];       // [{ rumah, idx: [] }]
  const posisi = {};

  Pk.data.forEach(function(o, i){
    if (Pk.filter === 'aktif' && !o.aktif) return;
    if (Pk.filter === 'non' && o.aktif) return;
    if (q){
      const teks = (o.rumah + ' ' + o.nama + ' ' + (o.nik || '')).toLowerCase();
      if (teks.indexOf(q) === -1) return;
    }
    if (!(o.rumah in posisi)){ posisi[o.rumah] = grup.length; grup.push({ rumah: o.rumah, idx: [] }); }
    grup[posisi[o.rumah]].idx.push(i);
  });

  if (!grup.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada data</h2><p>' +
      (Pk.data.length ? 'Tidak ada yang cocok dengan pencarian atau filter.' : 'Data pokok masih kosong.') + '</p></div>';
    return;
  }

  kotak.innerHTML = grup.map(function(g){
    const orang = g.idx.map(function(i){
      const o = Pk.data[i];
      const sub = [o.hub, o.jk].filter(Boolean).join(' · ');
      const tag = !o.aktif ? '<span class="pk-tag">NON AKTIF</span>'
                : pkIsKK(o) ? '<span class="pk-tag kk">KK</span>' : '';
      return '<button class="pk-orang' + (o.aktif ? '' : ' mati') + '" onclick="bukaWarga(' + i + ')">' +
        '<div class="isi"><b>' + pkAman(o.nama) + '</b><small>' + pkAman(sub || '-') + '</small></div>' + tag +
      '</button>';
    }).join('');
    return '<div class="pk-grup"><div class="pk-grup-kepala"><b>' + pkAman(g.rumah) + '</b>' +
      g.idx.length + ' orang</div>' + orang + '</div>';
  }).join('');
}

/* ---------- DETAIL ---------- */
function bukaWarga(i){
  const o = Pk.data[i];
  if (!o) return;
  Pk.aktif = o;

  document.getElementById('pdJudul').textContent = o.nama;
  let h = '<div class="pk-info">';
  h += pkBaris('Rumah', o.rumah);
  h += pkBaris('Hubungan', o.hub || '-');
  h += pkBaris('Jenis kelamin', o.jk || '-');
  h += pkBaris('Status', o.aktif ? 'Aktif' : 'Non aktif');
  if ('hp' in o) h += pkBaris('HP', o.hp || '-');
  if (Pk.tingkat >= 2){
    h += pkBaris('NIK', o.nik || '-');
    h += pkBaris('No KK', o.kk || '-');
    h += pkBaris('Tempat, tgl lahir', [o.tempatLahir, pkTgl(o.tglLahir)].filter(Boolean).join(', ') || '-');
    h += pkBaris('Agama', o.agama || '-');
    h += pkBaris('Perkawinan', o.kawin || '-');
    h += pkBaris('Nama KK', o.namaKK || '-');
    h += pkBaris('Alamat', [o.alamat, o.rt && ('RT ' + o.rt), o.rw && ('RW ' + o.rw)].filter(Boolean).join(', ') || '-');
    h += pkBaris('Kelurahan', [o.kel, o.kec, o.kab].filter(Boolean).join(', ') || '-');
    h += pkBaris('Tempat tinggal', o.statusTinggal || '-');
    h += pkBaris('Domisili', o.domisili || '-');
    h += pkBaris('Mulai tinggal', pkTgl(o.tglMasuk) || '-');
    if (o.tglPindah) h += pkBaris('Pindah / meninggal', pkTgl(o.tglPindah));
    if (o.ket) h += pkBaris('Keterangan', o.ket);
  }
  h += '</div>';

  document.getElementById('pdIsi').innerHTML = h;
  document.getElementById('pdBawah').classList.toggle('pk-sembunyi', !(Pk.bolehUbah && o.kunci));
  bukaLembar('lembarWarga');
}

/* ---------- INPUT KELUARGA (BERANTAI) ---------- */
async function mulaiInputKeluarga(){
  const sel = document.getElementById('psRumah');
  sel.innerHTML = '<option value="">Memuat daftar rumah…</option>';
  document.getElementById('psInfo').classList.add('pk-sembunyi');
  document.getElementById('psGalat').textContent = '';
  document.getElementById('psJumlah').value = 1;
  bukaLembar('lembarSiapInput');

  try {
    const h = await panggilAPI('daftarRumah');
    sel.innerHTML = '<option value="">— Pilih rumah —</option>' + (h.data || []).map(function(r){
      const nama = r.dihuni && r.penghuni ? r.penghuni : 'tidak dihuni';
      return '<option value="' + pkAman(r.no) + '">' + pkAman(r.no + ' — ' + nama) + '</option>';
    }).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Gagal memuat</option>';
    document.getElementById('psGalat').textContent = e.message;
  }
}

async function cekRumahInput(){
  const no = document.getElementById('psRumah').value;
  const info = document.getElementById('psInfo');
  Pk.rantai = null;
  info.classList.add('pk-sembunyi');
  if (!no) return;

  info.textContent = 'Memeriksa rumah ' + no + '…';
  info.classList.remove('pk-sembunyi');
  try {
    const s = await panggilAPI('siapkanInputPokok', no);
    if (document.getElementById('psRumah').value !== no) return;
    Pk.rantai = { siap: s };

    if (s.kkAktif){
      info.innerHTML = 'Rumah ini sudah punya <b>' + s.jmlAktif + ' anggota aktif</b> dengan Kepala Keluarga <b>' +
        pkAman(s.kkAktif.nama) + '</b>. Input berikut akan ditambahkan sebagai anggota keluarganya.';
    } else {
      info.innerHTML = 'Belum ada Kepala Keluarga aktif. Isian pertama adalah <b>Kepala Keluarga</b>' +
        (s.prefill.nama ? ', terisi dari Database Rumah (<b>' + pkAman(s.prefill.nama) + '</b>).' : '.');
    }
    const sisa = Math.max(1, (s.jmlRumah || 1) - s.jmlAktif);
    document.getElementById('psJumlah').value = sisa;
  } catch (e) {
    info.textContent = e.message;
  }
}

function lanjutInputKeluarga(){
  const galat = document.getElementById('psGalat');
  galat.textContent = '';
  const no = document.getElementById('psRumah').value;
  const total = parseInt(document.getElementById('psJumlah').value, 10);
  if (!no) return (galat.textContent = 'Pilih rumah dulu.');
  if (!Pk.rantai || !Pk.rantai.siap || Pk.rantai.siap.no !== no) return (galat.textContent = 'Tunggu pemeriksaan rumah selesai.');
  if (!total || total < 1 || total > 15) return (galat.textContent = 'Jumlah anggota 1–15.');

  const s = Pk.rantai.siap;
  Pk.rantai = {
    siap: s, rumah: no, total: total, ke: 1,
    adaKK: !!s.kkAktif,        // berubah jadi true setelah KK disimpan
    awalKK: !!s.kkAktif,       // tetap: apakah rumah SUDAH punya KK sebelum input ini
    namaKK: s.kkAktif ? s.kkAktif.nama : (s.prefill.nama || ''),
    bawa: {   // nilai yang terbawa ke anggota berikutnya
      kk: s.kkAktif ? s.kkAktif.kk : (s.prefill.kk || ''),
      alamat: s.kkAktif ? (s.kkAktif.alamat || '') : '',
      statusTinggal: s.kkAktif ? (s.kkAktif.statusTinggal || 'Milik Sendiri') : 'Milik Sendiri',
      domisili: 'Warga Tetap', tglMasuk: pkHariIni()
    }
  };
  Pk.mode = 'TAMBAH';
  tutupLembar('lembarSiapInput');
  siapkanFormRantai();
  bukaLembar('lembarAnggota');
}

function siapkanFormRantai(){
  const R = Pk.rantai;
  const pertamaKK = !R.adaKK && R.ke === 1;
  const s = R.siap;

  pkKosongkanForm();
  document.getElementById('pfJudul').textContent = 'Input Keluarga · Rumah ' + R.rumah;
  document.getElementById('pfProgres').textContent = 'Anggota ' + R.ke + ' dari ' + R.total;
  document.getElementById('pfAreaMutasi').classList.add('pk-sembunyi');
  document.getElementById('btnSimpanAnggota').textContent = R.ke < R.total ? 'Simpan & Lanjut' : 'Simpan & Selesai';

  // Hubungan: anggota pertama tanpa KK = Kepala Keluarga (dikunci)
  const hub = document.getElementById('pfHub');
  hub.disabled = pertamaKK;
  Array.prototype.forEach.call(hub.options, function(op){
    op.disabled = !pertamaKK && op.value === 'Kepala Keluarga';
  });
  if (pertamaKK) hub.value = 'Kepala Keluarga';
  else if (R.awalKK) hub.value = (R.ke === 1) ? 'Istri' : 'Anak';
  else hub.value = (R.ke === 2) ? 'Istri' : 'Anak';

  if (pertamaKK){
    pkIsi('pfNama', s.prefill.nama);
    pkIsi('pfNik', s.prefill.nik);
    pkIsi('pfHp', s.prefill.hp);
  }
  pkIsi('pfKK', R.bawa.kk);
  pkIsi('pfNamaKK', R.namaKK);
  pkIsi('pfAlamat', R.bawa.alamat);
  pkIsi('pfRt', PK_ALAMAT_BAWAAN.rt);  pkIsi('pfRw', PK_ALAMAT_BAWAAN.rw);
  pkIsi('pfKel', PK_ALAMAT_BAWAAN.kel); pkIsi('pfKec', PK_ALAMAT_BAWAAN.kec); pkIsi('pfKab', PK_ALAMAT_BAWAAN.kab);
  pkPilih('pfTinggal', R.bawa.statusTinggal);
  pkPilih('pfDomisili', R.bawa.domisili);
  pkIsi('pfTglMasuk', R.bawa.tglMasuk);
}

/** Saat mengisi Kepala Keluarga, kolom "Nama KK" mengikuti nama. */
function cerminNamaKK(){
  if (document.getElementById('pfHub').value === 'Kepala Keluarga' && Pk.mode === 'TAMBAH'){
    pkIsi('pfNamaKK', document.getElementById('pfNama').value);
  }
}

/* ---------- UBAH ---------- */
function ubahWargaIni(){
  const o = Pk.aktif;
  if (!o || !o.kunci) return;
  Pk.mode = 'UBAH';
  Pk.rantai = null;
  tutupLembar('lembarWarga');

  pkKosongkanForm();
  document.getElementById('pfJudul').textContent = 'Ubah · ' + o.nama;
  document.getElementById('pfProgres').textContent = 'Rumah ' + o.rumah;
  document.getElementById('pfAreaMutasi').classList.remove('pk-sembunyi');
  document.getElementById('btnSimpanAnggota').textContent = 'Simpan Perubahan';

  const hub = document.getElementById('pfHub');
  hub.disabled = false;
  Array.prototype.forEach.call(hub.options, function(op){ op.disabled = false; });

  pkIsi('pfNama', o.nama); pkIsi('pfNik', o.nik); pkIsi('pfKK', o.kk);
  pkPilih('pfHub', o.hub); pkPilih('pfJk', o.jk); pkPilih('pfAgama', o.agama); pkPilih('pfKawin', o.kawin);
  pkIsi('pfTempat', o.tempatLahir); pkIsi('pfTglLahir', o.tglLahir); pkIsi('pfHp', o.hp);
  pkIsi('pfNamaKK', o.namaKK); pkIsi('pfAlamat', o.alamat); pkIsi('pfRt', o.rt); pkIsi('pfRw', o.rw);
  pkIsi('pfKel', o.kel); pkIsi('pfKec', o.kec); pkIsi('pfKab', o.kab);
  pkPilih('pfTinggal', o.statusTinggal); pkPilih('pfDomisili', o.domisili);
  pkIsi('pfTglMasuk', o.tglMasuk); pkIsi('pfTglPindah', o.tglPindah); pkIsi('pfKet', o.ket);

  bukaLembar('lembarAnggota');
}

/* ---------- SIMPAN ---------- */
function kumpulkanForm(){
  const v = function(id){ return document.getElementById(id).value.trim(); };
  return {
    nama: v('pfNama'), nik: v('pfNik'), kk: v('pfKK'), hub: v('pfHub'),
    jk: v('pfJk'), agama: v('pfAgama'), kawin: v('pfKawin'),
    tempatLahir: v('pfTempat'), tglLahir: v('pfTglLahir'), hp: v('pfHp'), namaKK: v('pfNamaKK'),
    alamat: v('pfAlamat'), rt: v('pfRt'), rw: v('pfRw'), kel: v('pfKel'), kec: v('pfKec'), kab: v('pfKab'),
    statusTinggal: v('pfTinggal'), domisili: v('pfDomisili'), tglMasuk: v('pfTglMasuk'),
    tglPindah: v('pfTglPindah'), ket: v('pfKet')
  };
}

async function simpanAnggota(){
  if (Pk.sibuk) return;
  const galat = document.getElementById('pfGalat');
  galat.textContent = '';
  const f = kumpulkanForm();

  if (!f.nama) return (galat.textContent = 'Nama lengkap wajib diisi.');
  if (f.nik.length !== 16) return (galat.textContent = 'NIK harus 16 digit (sekarang ' + f.nik.length + ').');
  if (f.kk.length !== 16) return (galat.textContent = 'No KK harus 16 digit (sekarang ' + f.kk.length + ').');
  if (f.tglPindah && !f.ket) return (galat.textContent = 'Isi keterangan pindah / meninggal.');

  if (Pk.mode === 'TAMBAH') return simpanTambah(f);
  f.kunci = Pk.aktif.kunci;
  Pk.formTerakhir = f;
  return simpanUbah(f);
}

async function simpanTambah(f){
  const R = Pk.rantai;
  f.rumah = R.rumah;
  Pk.sibuk = true;
  tunggu('Menyimpan ' + f.nama + '…', 'Anggota ' + R.ke + ' dari ' + R.total);
  try {
    await panggilAPI('tambahAnggota', f);
    selesaiTunggu();

    if (f.hub === 'Kepala Keluarga'){ R.adaKK = true; R.namaKK = f.nama; }
    R.bawa = { kk: f.kk, alamat: f.alamat, statusTinggal: f.statusTinggal,
               domisili: f.domisili, tglMasuk: f.tglMasuk };

    if (R.ke < R.total){
      R.ke++;
      toast(f.nama + ' tersimpan');
      siapkanFormRantai();
      document.querySelector('#lembarAnggota .lembar-badan').scrollTop = 0;
    } else {
      tutupLembar('lembarAnggota');
      toast('Seluruh anggota rumah ' + R.rumah + ' tersimpan');
      Pk.rantai = null;
      await muatPokok();
    }
  } catch (e) {
    selesaiTunggu();
    document.getElementById('pfGalat').textContent = e.message;
  } finally {
    Pk.sibuk = false;
  }
}

async function simpanUbah(f){
  Pk.sibuk = true;
  tunggu('Menyimpan perubahan…', f.nama);
  try {
    const h = await panggilAPI('ubahAnggota', f);
    selesaiTunggu();

    if (h && h.perluKeputusan){
      tampilkanKeputusan(h);
      return;
    }
    tutupLembar('lembarAnggota');
    tutupLembar('lembarKeputusan');
    toast(h.message || 'Tersimpan');
    Pk.formTerakhir = null;
    await muatPokok();
  } catch (e) {
    selesaiTunggu();
    const kotak = document.getElementById('lembarKeputusan').classList.contains('on') ? 'kpGalat' : 'pfGalat';
    document.getElementById(kotak).textContent = e.message;
  } finally {
    Pk.sibuk = false;
  }
}

/* ---------- KEPUTUSAN SAAT KK KELUAR ---------- */
function tampilkanKeputusan(h){
  Pk.pilihan = h.calon.length ? (h.saran || h.calon[0].kunci) : 'SEMUA';
  document.getElementById('kpGalat').textContent = '';

  document.getElementById('kpTeks').innerHTML = h.calon.length
    ? '<b>' + pkAman(h.nama) + '</b> adalah Kepala Keluarga. Masih ada <b>' + h.calon.length +
      ' anggota aktif</b> di rumah ini. Siapa Kepala Keluarga berikutnya?'
    : '<b>' + pkAman(h.nama) + '</b> adalah anggota aktif terakhir. Rumah akan dikosongkan.';

  let html = h.calon.map(function(c){
    return '<button class="pk-pil" data-k="' + pkAman(c.kunci) + '" onclick="pilihKeputusan(this)">' +
      '<span><b>' + pkAman(c.nama) + '</b><small>' + pkAman(c.hub || '-') +
      (c.kunci === h.saran ? ' · disarankan' : '') + '</small></span></button>';
  }).join('');
  if (h.calon.length){
    html += '<button class="pk-pil" data-k="SEMUA" onclick="pilihKeputusan(this)">' +
      '<span><b>Seluruh keluarga ikut pindah</b><small>Semua anggota aktif diberi tanggal & keterangan yang sama</small></span></button>';
  }
  document.getElementById('kpPilihan').innerHTML = html;
  segarkanPilihan();
  bukaLembar('lembarKeputusan');
}

function pilihKeputusan(el){
  Pk.pilihan = el.getAttribute('data-k');
  segarkanPilihan();
}

function segarkanPilihan(){
  document.querySelectorAll('#kpPilihan .pk-pil').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-k') === Pk.pilihan);
  });
  document.getElementById('kpAreaStatus').classList.toggle('pk-sembunyi', Pk.pilihan !== 'SEMUA');
}

function kirimKeputusan(){
  const f = Pk.formTerakhir;
  if (!f || Pk.sibuk) return;
  f.keputusan = (Pk.pilihan === 'SEMUA')
    ? { semuaPindah: true, statusRumah: document.getElementById('kpStatus').value }
    : { kkBaru: Pk.pilihan };
  simpanUbah(f);
}

function batalFormAnggota(){
  if (Pk.mode === 'TAMBAH' && Pk.rantai && Pk.rantai.ke > 1){
    if (!confirm('Anggota yang sudah tersimpan tetap ada. Hentikan pengisian?')) return;
    muatPokok();
  }
  tutupLembar('lembarAnggota');
}

/* ---------- ALAT ---------- */
function isiSemuaPilihan(){
  Object.keys(PK_PILIHAN).forEach(function(id){
    const el = document.getElementById(id);
    if (el) el.innerHTML = PK_PILIHAN[id].map(function(v){
      return '<option value="' + pkAman(v) + '">' + pkAman(v) + '</option>';
    }).join('');
  });
}

/** Pilih nilai di <select>; nilai lama yang tidak ada di daftar ditambahkan apa adanya. */
function pkPilih(id, nilai){
  const el = document.getElementById(id);
  if (!nilai) { el.selectedIndex = 0; return; }
  const ada = Array.prototype.some.call(el.options, function(op){ return op.value === nilai; });
  if (!ada){
    const op = document.createElement('option');
    op.value = nilai; op.textContent = nilai;
    el.appendChild(op);
  }
  el.value = nilai;
}

function pkIsi(id, v){ document.getElementById(id).value = v == null ? '' : v; }

function pkKosongkanForm(){
  ['pfNama','pfNik','pfKK','pfTempat','pfTglLahir','pfHp','pfNamaKK','pfAlamat','pfRt','pfRw',
   'pfKel','pfKec','pfKab','pfTglMasuk','pfTglPindah','pfKet'].forEach(function(id){ pkIsi(id, ''); });
  ['pfJk','pfAgama','pfKawin','pfTinggal','pfDomisili'].forEach(function(id){
    document.getElementById(id).selectedIndex = 0;
  });
  document.getElementById('pfGalat').textContent = '';
}

function pkAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}
function pkBaris(label, nilai){
  return '<div class="pk-baris"><span>' + pkAman(label) + '</span><b>' + pkAman(nilai) + '</b></div>';
}
function pkTgl(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
function pkHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}