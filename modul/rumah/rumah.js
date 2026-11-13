/* =================================================================
   MODUL DATABASE RUMAH (Tahap 5A)
   Data sudah disaring server sesuai peran: field yang tidak dikirim
   memang tidak boleh dilihat peran ini.
   ================================================================= */

const Rmh = { data: [], tingkat: 0, bolehUbah: false, filter: 'semua', cari: '',
              detail: null, mode: 'BARU', sibuk: false };

const RM_KELAS_STATUS = {
  'MILIK SENDIRI': 'st-milik', 'PENGONTRAK': 'st-kontrak', 'MENUMPANG': 'st-numpang',
  'DISEWAKAN': 'st-sewa', 'KOSONG': 'st-kosong', 'BELUM DIHUNI': 'st-kosong'
};
const RM_STATUS_KOSONG = ['KOSONG', 'BELUM DIHUNI', 'DISEWAKAN'];

async function init_rumah(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Rmh.data = []; Rmh.tingkat = 0; Rmh.bolehUbah = false;
  Rmh.filter = 'semua'; Rmh.cari = ''; Rmh.detail = null; Rmh.sibuk = false;
  await muatRumah();
}

/* ---------- DAFTAR ---------- */
async function muatRumah(){
  const kotak = document.getElementById('rmDaftar');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Memuat daftar rumah…</div>';

  try {
    const h = await panggilAPI('daftarRumah');
    Rmh.data = h.data || [];
    Rmh.tingkat = h.tingkat || 0;
    Rmh.bolehUbah = !!h.bolehUbah;
    document.getElementById('rmTambah').classList.toggle('rm-sembunyi', !Rmh.bolehUbah);
    gambarRumah();
  } catch (e) {
    document.getElementById('rmSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + rmAman(e.message) + '</p></div>';
  }
}

function setFilterRumah(f){
  Rmh.filter = f;
  document.querySelectorAll('.rm-chip').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-f') === f);
  });
  gambarRumah();
}

function gambarRumah(){
  const kotak = document.getElementById('rmDaftar');
  if (!kotak) return;

  const total = Rmh.data.length;
  const dihuni = Rmh.data.filter(function(r){ return r.dihuni; }).length;
  document.getElementById('rmSub').textContent = total + ' rumah · ' + dihuni + ' dihuni';

  const q = Rmh.cari.trim().toLowerCase();
  const tampil = [];
  Rmh.data.forEach(function(r, i){
    if (Rmh.filter === 'dihuni' && !r.dihuni) return;
    if (Rmh.filter === 'kosong' && r.dihuni) return;
    if (q){
      const teks = (r.no + ' ' + (r.penghuni || '') + ' ' + (r.pemilik || '')).toLowerCase();
      if (teks.indexOf(q) === -1) return;
    }
    tampil.push(i);
  });

  if (!tampil.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada rumah</h2><p>' +
      (total ? 'Tidak ada yang cocok dengan pencarian atau filter.' : 'Database rumah masih kosong.') + '</p></div>';
    return;
  }

  kotak.innerHTML = tampil.map(function(i){
    const r = Rmh.data[i];
    const nama = r.dihuni && r.penghuni
      ? '<b>' + rmAman(r.penghuni) + '</b>'
      : '<b class="kosong">Tidak dihuni</b>';
    let ket = '';
    if (r.pemilik && r.pemilik !== r.penghuni) ket = 'Pemilik: ' + r.pemilik;
    if (r.dihuni && r.jml) ket = (ket ? ket + ' · ' : '') + r.jml + ' jiwa';

    return '<button class="rm-kartu" onclick="bukaRumah(' + i + ')">' +
      '<div class="rm-no">' + rmAman(r.no) + '</div>' +
      '<div class="rm-isi">' + nama + (ket ? '<small>' + rmAman(ket) + '</small>' : '') + '</div>' +
      '<span class="rm-st ' + (RM_KELAS_STATUS[r.status] || 'st-kosong') + '">' + rmAman(r.status || '-') + '</span>' +
    '</button>';
  }).join('');
}

/* ---------- DETAIL ---------- */
async function bukaRumah(i){
  const r = Rmh.data[i];
  if (!r) return;
  Rmh.detail = null;

  document.getElementById('rdJudul').textContent = 'Rumah ' + r.no;
  document.getElementById('rdIsi').innerHTML = '<div class="memuat">Memuat detail…</div>';
  document.getElementById('rdBawah').classList.add('rm-sembunyi');
  bukaLembar('lembarRumah');

  try {
    const d = await panggilAPI('detailRumah', r.no);
    // Pengguna sudah membuka rumah lain selama menunggu → abaikan
    if (document.getElementById('rdJudul').textContent !== 'Rumah ' + r.no) return;
    Rmh.detail = d;
    gambarDetail(d);
  } catch (e) {
    document.getElementById('rdIsi').innerHTML =
      '<div class="kosong"><h2>Gagal memuat</h2><p>' + rmAman(e.message) + '</p></div>';
  }
}

function gambarDetail(d){
  const r = d.rumah;
  let h = '<div class="rm-info">';
  h += rmBaris('Status', r.status || '-');
  h += rmBaris('Pemilik', r.pemilik || '-');
  if ('hpPemilik' in r)  h += rmBaris('HP pemilik', r.hpPemilik || '-');
  if ('nikPemilik' in r) h += rmBaris('NIK pemilik', r.nikPemilik || '-');

  if (r.dihuni){
    h += rmBaris('Kepala Keluarga', r.penghuni || '-');
    if ('hpPenghuni' in r)  h += rmBaris('HP penghuni', r.hpPenghuni || '-');
    if ('noKK' in r)        h += rmBaris('No KK', r.noKK || '-');
    if ('nikPenghuni' in r) h += rmBaris('NIK Kepala Keluarga', r.nikPenghuni || '-');
    h += rmBaris('Jumlah anggota', (r.jml || 0) + ' jiwa');
  }

  if (d.penerima){
    const p = d.penerima;
    const label = p.sumber === 'KEPALA_KELUARGA' ? 'Kepala Keluarga' : 'Pemilik';
    h += rmBaris('Penerima tagihan', (p.nama || '-') + ' (' + label + ')' + (p.hp ? ' · ' + p.hp : ''));
  }

  if (r.dokumen){
    h += '<div class="rm-baris"><span>Dokumen KK/KTP</span>' +
         '<a href="' + rmAman(r.dokumen) + '" target="_blank" rel="noopener">Buka</a></div>';
  }
  h += '</div>';

  h += '<div class="rm-judul">ANGGOTA KELUARGA (DATA POKOK)</div>';
  if (!d.anggota.length){
    h += '<div style="font-size:.78rem;color:var(--muted);padding:6px 0 4px;">Belum ada anggota yang diinput di Data Pokok.</div>';
  } else {
    h += d.anggota.map(function(a){
      const sub = [a.hubungan, a.jk].filter(Boolean).join(' · ');
      return '<div class="rm-anggota' + (a.aktif ? '' : ' mati') + '">' +
        '<div><b>' + rmAman(a.nama) + '</b><small>' + rmAman(sub || '-') + '</small></div>' +
        (a.aktif ? '' : '<span class="rm-st st-kosong">NON AKTIF</span>') +
      '</div>';
    }).join('');
  }

  document.getElementById('rdIsi').innerHTML = h;
  document.getElementById('rdBawah').classList.toggle('rm-sembunyi', !Rmh.bolehUbah);
}

/* ---------- FORM ---------- */
function ubahRumahIni(){
  if (!Rmh.detail) return;
  tutupLembar('lembarRumah');
  bukaFormRumah('UBAH', Rmh.detail.rumah);
}

function bukaFormRumah(mode, r){
  Rmh.mode = mode;
  r = r || {};
  const isi = function(id, v){ document.getElementById(id).value = v == null ? '' : v; };

  document.getElementById('rfJudul').textContent = mode === 'BARU' ? 'Tambah Rumah' : 'Ubah Rumah ' + r.no;
  isi('rfNo', r.no);
  document.getElementById('rfNo').readOnly = (mode === 'UBAH');
  isi('rfPemilik', r.pemilik);
  isi('rfHpPemilik', rmDigit(r.hpPemilik));
  isi('rfNikPemilik', rmDigit(r.nikPemilik));
  isi('rfStatus', r.status || 'MILIK SENDIRI');
  isi('rfPenghuni', r.penghuni);
  isi('rfKK', rmDigit(r.noKK));
  isi('rfNik', rmDigit(r.nikPenghuni));
  isi('rfHp', rmDigit(r.hpPenghuni));
  isi('rfJml', r.jml || 1);
  document.getElementById('rfGalat').textContent = '';

  aturAreaPenghuni();
  bukaLembar('lembarFormRumah');
}

function aturAreaPenghuni(){
  const kosong = RM_STATUS_KOSONG.indexOf(document.getElementById('rfStatus').value) !== -1;
  document.getElementById('rfAreaPenghuni').classList.toggle('rm-sembunyi', kosong);
  document.getElementById('rfCatatanKosong').classList.toggle('rm-sembunyi', !kosong);
}

async function simpanRumah(){
  if (Rmh.sibuk) return;
  const ambil = function(id){ return document.getElementById(id).value.trim(); };
  const galat = document.getElementById('rfGalat');
  galat.textContent = '';

  const form = {
    mode: Rmh.mode,
    no: ambil('rfNo').toUpperCase(),
    pemilik: ambil('rfPemilik'),
    hpPemilik: ambil('rfHpPemilik'),
    nikPemilik: ambil('rfNikPemilik'),
    status: ambil('rfStatus'),
    penghuni: ambil('rfPenghuni'),
    noKK: ambil('rfKK'),
    nikPenghuni: ambil('rfNik'),
    hpPenghuni: ambil('rfHp'),
    jml: ambil('rfJml')
  };
  const dihuni = RM_STATUS_KOSONG.indexOf(form.status) === -1;

  // Cek ringan di HP (server tetap memeriksa ulang)
  if (!form.no) return (galat.textContent = 'Nomor rumah wajib diisi.');
  if (dihuni && !form.penghuni) return (galat.textContent = 'Nama Kepala Keluarga wajib diisi untuk rumah yang dihuni.');
  const cek16 = [['NIK pemilik', form.nikPemilik]];
  if (dihuni) cek16.push(['No KK', form.noKK], ['NIK Kepala Keluarga', form.nikPenghuni]);
  for (let i = 0; i < cek16.length; i++){
    const v = cek16[i][1];
    if (v && v.length !== 16) return (galat.textContent = cek16[i][0] + ' harus 16 digit (sekarang ' + v.length + ').');
  }

  Rmh.sibuk = true;
  tunggu('Menyimpan data rumah…', 'Mengurutkan database dan menyiapkan buku besar.');
  try {
    const h = await panggilAPI('simpanRumah', form);
    selesaiTunggu();
    tutupLembar('lembarFormRumah');
    toast(h.message || 'Tersimpan');
    await muatRumah();
  } catch (e) {
    selesaiTunggu();
    galat.textContent = e.message;
  } finally {
    Rmh.sibuk = false;
  }
}

/* ---------- ALAT ---------- */
function rmAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}
function rmBaris(label, nilai){
  return '<div class="rm-baris"><span>' + rmAman(label) + '</span><b>' + rmAman(nilai) + '</b></div>';
}
function rmDigit(v){ return String(v == null ? '' : v).replace(/\D/g, ''); }