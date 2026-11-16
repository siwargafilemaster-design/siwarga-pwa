/* =================================================================
   MODUL PENGATURAN (Tahap 7A)
   Server yang menentukan apa yang boleh dilihat & diubah tiap peran.
   ================================================================= */

const St = { data: null, item: null, logo: '', sibuk: false };
const ST_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ST_IDENTITAS = { RT_RW_TITLE: 'namaRT', APP_DESC: 'desc', THEME_COLOR: 'theme' };

async function init_setting(){
  St.data = null; St.item = null; St.logo = ''; St.sibuk = false;
  const tamu = App.peran === 'GUEST';
  document.getElementById('stTamu').classList.toggle('st-sembunyi', !tamu);
  document.getElementById('stPinBtn').classList.toggle('st-sembunyi', tamu);
  if (tamu){ stTeks('stSub', 'Mode Tamu'); return; }
  await muatSetting();
}

async function muatSetting(){
  if (App.peran === 'GUEST') return;
  stTeks('stSub', 'Memuat…');
  try {
    St.data = await panggilAPI('pengaturan');
    stTeks('stSub', St.data.label);
    stTeks('stPinPeran', 'Peran: ' + St.data.label);
    gambarTarifSe();
    gambarSetting();
  } catch (e) {
    stTeks('stSub', 'Gagal memuat');
    document.getElementById('stIsi').innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + stAman(e.message) + '</p></div>';
  }
}

/* ---------- DAFTAR ---------- */
function gambarSetting(){
  const kotak = document.getElementById('stIsi');
  if (!St.data.grup.length){
    kotak.innerHTML = '<p class="se-ket" style="margin:0 2px;">Peran Anda tidak mengelola pengaturan lingkungan. ' +
      'Yang bisa diubah di sini hanya PIN Anda sendiri.</p>';
    return;
  }
  kotak.innerHTML = St.data.grup.map(function(g, gi){
    return '<div class="st-grup"><h2>' + stAman(g.nama) + '</h2>' + (g.ket ? '<p>' + stAman(g.ket) + '</p>' : '') +
      '<div class="st-kartu">' + g.isi.map(function(it, ii){
        return '<button class="st-baris"' + (it.bisaUbah ? ' onclick="bukaSe(' + gi + ',' + ii + ')"' : ' disabled') + '>' +
          '<span class="lbl">' + stAman(it.label) + (it.sensitif && it.bisaUbah ? ' <span class="st-gembok">🔒</span>' : '') + '</span>' +
          '<span class="val">' + stTampil(it) + '</span>' +
          (it.bisaUbah ? '<span class="chev">›</span>' : '') + '</button>';
      }).join('') + '</div></div>';
  }).join('');
}

function stTampil(it){
  if (it.jenis === 'rahasia' || it.jenis === 'pin') return it.terisi ? '•••••• terisi' : '<i>kosong</i>';
  if (it.jenis === 'gambar') return it.terisi ? '✓ terisi' : '<i>belum diunggah</i>';
  if (!it.nilai) return '<i>belum diisi</i>';
  if (it.jenis === 'rupiah') return 'Rp ' + Number(it.nilai).toLocaleString('id-ID');
  if (it.jenis === 'warna') return '<span class="st-titik" style="background:' + stAman(it.nilai) + '"></span>' + stAman(it.nilai);
  if (it.jenis === 'logo') return '<img src="' + stAman(it.nilai) + '" alt="logo">';
  if (it.jenis === 'bulan') return stAman(ST_BULAN[Number(it.nilai) - 1] || it.nilai);
  return stAman(it.nilai);
}

/* ---------- UBAH SATU PENGATURAN ---------- */
function bukaSe(gi, ii){
  const g = St.data.grup[gi], it = g.isi[ii];
  St.item = it; St.logo = '';
  stTeks('seJudul', it.label);
  stTeks('seGalat', '');
  document.getElementById('sePin').value = '';
  document.getElementById('seAreaPin').classList.toggle('st-sembunyi', !it.sensitif);
  ['seAreaTeks', 'seAreaWarna', 'seAreaLogo'].forEach(function(id){ document.getElementById(id).classList.add('st-sembunyi'); });

  const ket = {
    rahasia: 'Nilai lama tidak ditampilkan demi keamanan. Isi nilai baru untuk menggantinya.',
    pin: 'Isi PIN baru (4–8 angka). Semua HP yang login dengan peran itu akan dikeluarkan.',
    hp: 'Awali dengan 08 atau 62.', tanggal: 'Angka 1–28.', bulan: 'Angka 1–12.', url: 'Diawali https://'
    }[it.jenis] || (it.jenis === 'gambar' ? stKetGambar(it.k) : '');
  stTeks('seKet', ket);

  if (it.jenis === 'warna'){
    document.getElementById('seWarna').value = /^#[0-9a-f]{6}$/i.test(it.nilai) ? it.nilai : '#22303F';
    document.getElementById('seAreaWarna').classList.remove('st-sembunyi');
  } else if (it.jenis === 'logo' || it.jenis === 'gambar'){
    const img = document.getElementById('seLogoPratinjau');
    document.getElementById('seLogoFile').value = '';
    img.classList.toggle('st-sembunyi', !it.nilai);
    if (it.nilai) img.src = it.nilai;
    document.getElementById('seAreaLogo').classList.remove('st-sembunyi');
    document.getElementById('seLogoKet').classList.toggle('st-sembunyi', it.jenis !== 'logo');
  } else {
    const inp = document.getElementById('seNilai');
    const angka = ['rupiah', 'angka', 'tanggal', 'bulan', 'tahun', 'pin'].indexOf(it.jenis) !== -1;
    inp.type = it.jenis === 'pin' || it.jenis === 'rahasia' ? 'password' : 'text';
    inp.inputMode = angka || it.jenis === 'hp' || it.jenis === 'rekening' ? 'numeric' : 'text';
    inp.value = (it.jenis === 'rahasia' || it.jenis === 'pin') ? '' : (it.nilai || '');
    stTeks('seLabel', it.jenis === 'rupiah' ? 'Nominal (Rp, tanpa titik)' : 'Nilai baru');
    document.getElementById('seAreaTeks').classList.remove('st-sembunyi');
  }
  bukaLembar('lembarSet');
}

function pilihWarnaSe(h){ document.getElementById('seWarna').value = h; }

/** Rapikan logo ke lebar maks 600 px; PNG tetap PNG (transparan), JPG tetap JPG. */
/** Rapikan gambar sebelum diunggah.
 *  Logo: lebar maks 600 px. TTD & stempel: 900 px, PNG tetap PNG (transparan).
 *  Kop: 1800 px dan selalu JPG (satu halaman penuh, tidak perlu transparan, ukurannya jadi kecil). */
function siapkanLogoSe(input){
  const f = input.files && input.files[0];
  if (!f) return;
  const it = St.item || {};
  const kop = it.k === 'KOP_SURAT';
  const maks = it.jenis === 'gambar' ? (kop ? 1800 : 900) : 600;
  if (f.size > 15 * 1024 * 1024) return stTeks('seGalat', 'File terlalu besar (maks 15 MB sebelum dirapikan).');
  const png = f.type === 'image/png' && !kop;
  const baca = new FileReader();
  baca.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const skala = Math.min(1, maks / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * skala);
      c.height = Math.round(img.height * skala);
      const g = c.getContext('2d');
      if (!png){ g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      St.logo = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      const p = document.getElementById('seLogoPratinjau');
      p.src = St.logo;
      p.classList.remove('st-sembunyi');
      stTeks('seGalat', '');
    };
    img.src = e.target.result;
  };
  baca.readAsDataURL(f);
}

function stKetGambar(k){
  return ({
    KOP_SURAT: 'Gambar kop satu halaman penuh (A4 tegak), termasuk garis atau hiasan bawah bila ada. Isi surat mulai ditulis sekitar 3,5 cm dari atas.',
    TTD_DIGITAL: 'Hanya coretan tanda tangan, PNG berlatar transparan, dipotong rapat. Jabatan dan nama ditulis otomatis.',
    STEMPEL_DIGITAL: 'Stempel RT, PNG berlatar transparan, dipotong rapat di sekeliling stempel.'
  }[k] || '') + ' Disimpan privat di Google Drive.';
}

async function simpanSe(){
  const it = St.item;
  if (!it || St.sibuk) return;
  stTeks('seGalat', '');
  let aksi, data;
    if (it.jenis === 'logo'){
    if (!St.logo) return stTeks('seGalat', 'Pilih gambar logo dulu.');
    aksi = 'unggahLogo'; data = { data: St.logo };
  } else if (it.jenis === 'gambar'){
    const pin = document.getElementById('sePin').value.trim();
    if (!St.logo) return stTeks('seGalat', 'Pilih gambarnya dulu.');
    if (!pin) return stTeks('seGalat', 'Masukkan PIN Anda untuk mengganti gambar ini.');
    aksi = 'unggahGambarSurat'; data = { k: it.k, data: St.logo, pin: pin };
  } else {
    const nilai = it.jenis === 'warna' ? document.getElementById('seWarna').value : document.getElementById('seNilai').value.trim();
    const pin = document.getElementById('sePin').value.trim();
    if (it.sensitif && !pin) return stTeks('seGalat', 'Masukkan PIN Anda untuk perubahan sensitif.');
    aksi = 'simpanPengaturan'; data = { k: it.k, nilai: nilai, pin: pin };
  }

  St.sibuk = true;
    tunggu(it.jenis === 'logo' || it.jenis === 'gambar' ? 'Mengunggah gambar…' : 'Menyimpan…', it.label);
  try {
    const h = await panggilAPI(aksi, data);
    selesaiTunggu();
    toast(h.message || 'Tersimpan');
    tutupLembar('lembarSet');
    if (h.keluarSendiri) return prosesLogout();
    stTerapkanIdentitas(it, data, h);
    if (it.jenis === 'gambar' && typeof Sr !== 'undefined') Sr.aset = null;
    await muatSetting();
  } catch (e) {
    selesaiTunggu();
    stTeks('seGalat', e.message);
  } finally {
    St.sibuk = false;
  }
}

/** Nama, deskripsi, warna, dan logo langsung tampil tanpa menunggu aplikasi dibuka ulang. */
function stTerapkanIdentitas(it, data, h){
  if (!App.identitas) return;
  const baru = Object.assign({}, App.identitas);
  if (ST_IDENTITAS[it.k]) baru[ST_IDENTITAS[it.k]] = data.nilai;
  else if (it.jenis === 'logo' && h.url) baru.logo = h.url;
  else return;
  terapkanIdentitas(baru);
  hapusSemuaIngatan();   // pembuka berikutnya mengambil identitas terbaru dari server
}

/* ---------- TARIF PKK ---------- */
function stTarifKini(){
  const t = St.data.tarifPKK;
  let x = t.daftar[0];
  t.daftar.forEach(function(r){ if (r.mulai <= t.kini) x = r; });
  return x;
}

function gambarTarifSe(){
  const kotak = document.getElementById('stTarif');
  const t = St.data.tarifPKK;
  if (!t || !t.daftar.length){ kotak.innerHTML = ''; return; }
  const x = stTarifKini();
  const total = x.kas + x.sosial + x.konsumsi;
  kotak.innerHTML = '<div class="st-grup"><h2>Tarif Iuran PKK</h2><div class="st-kartu">' +
    '<div class="st-tarif-isi">Berlaku sekarang: <b>Rp ' + total.toLocaleString('id-ID') + '</b> per bulan<br>' +
    'Kas Rp ' + x.kas.toLocaleString('id-ID') + ' · Sosial Rp ' + x.sosial.toLocaleString('id-ID') +
    ' · Konsumsi Rp ' + x.konsumsi.toLocaleString('id-ID') + '</div>' +
    '<div class="st-riwayat">' + t.daftar.slice().reverse().map(function(r){
      const awal = r.mulai === '2000-01' ? 'sejak awal' : 'mulai ' + stPeriode(r.mulai);
      return (r.mulai > t.kini ? '⏳ ' : '') + awal + ': Rp ' + (r.kas + r.sosial + r.konsumsi).toLocaleString('id-ID');
    }).join('<br>') + '</div>' +
    '<button class="st-tombol" onclick="bukaTarifSe()">Ubah tarif</button></div></div>';
}

function bukaTarifSe(){
  const t = St.data.tarifPKK, x = stTarifKini();
  const sel = document.getElementById('tpMulai');
  let h = '';
  for (let i = 0; i <= 12; i++){
    const p = stGeser(t.kini, i);
    h += '<option value="' + p + '"' + (i === 1 ? ' selected' : '') + '>' + stPeriode(p) + (i === 0 ? ' (bulan ini)' : '') + '</option>';
  }
  sel.innerHTML = h;
  document.getElementById('tpKas').value = x.kas;
  document.getElementById('tpSosial').value = x.sosial;
  document.getElementById('tpKonsumsi').value = x.konsumsi;
  stTeks('tpGalat', '');
  hitungTarifSe();
  bukaLembar('lembarTarifPKK');
}

function hitungTarifSe(){
  const n = ['tpKas', 'tpSosial', 'tpKonsumsi'].reduce(function(s, id){ return s + (Number(document.getElementById(id).value) || 0); }, 0);
  stTeks('tpTotal', 'Total iuran: Rp ' + n.toLocaleString('id-ID') + ' per bulan');
}

async function simpanTarifSe(){
  if (St.sibuk) return;
  const data = {
    mulai: document.getElementById('tpMulai').value,
    kas: Number(document.getElementById('tpKas').value),
    sosial: Number(document.getElementById('tpSosial').value),
    konsumsi: Number(document.getElementById('tpKonsumsi').value)
  };
  St.sibuk = true;
  tunggu('Menyimpan tarif…', stPeriode(data.mulai));
  try {
    const h = await panggilAPI('tarifPKK', data);
    selesaiTunggu();
    toast(h.message);
    tutupLembar('lembarTarifPKK');
    await muatSetting();
  } catch (e) {
    selesaiTunggu();
    stTeks('tpGalat', e.message);
  } finally {
    St.sibuk = false;
  }
}

/* ---------- GANTI PIN SAYA ---------- */
function bukaGantiPin(){
  ['gpLama', 'gpBaru', 'gpUlang'].forEach(function(id){ document.getElementById(id).value = ''; });
  stTeks('gpGalat', '');
  bukaLembar('lembarGantiPin');
}

async function simpanGantiPin(){
  if (St.sibuk) return;
  const lama = document.getElementById('gpLama').value.trim();
  const baru = document.getElementById('gpBaru').value.trim();
  if (!lama || !baru) return stTeks('gpGalat', 'Isi PIN lama dan PIN baru.');
  if (baru !== document.getElementById('gpUlang').value.trim()) return stTeks('gpGalat', 'Ulangan PIN baru tidak sama.');
  St.sibuk = true;
  tunggu('Mengganti PIN…', '');
  try {
    const h = await panggilAPI('gantiPin', { lama: lama, baru: baru });
    selesaiTunggu();
    tutupLembar('lembarGantiPin');
    toast(h.message);
    setTimeout(prosesLogout, 1500);
  } catch (e) {
    selesaiTunggu();
    stTeks('gpGalat', e.message);
  } finally {
    St.sibuk = false;
  }
}

/* ---------- ALAT ---------- */
function stGeser(p, n){
  const t = Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1 + n;
  return Math.floor(t / 12) + '-' + ('0' + (t % 12 + 1)).slice(-2);
}
function stPeriode(p){ return ST_BULAN[Number(p.slice(5, 7)) - 1] + ' ' + p.slice(0, 4); }
function stTeks(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }
function stAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}