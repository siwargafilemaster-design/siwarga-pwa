/* =================================================================
   MODUL DATABASE PKK / DASA WISMA (Tahap 5G)
   Statistik publik. Daftar & simpan hanya grup PKK (disaring server).
   ================================================================= */

const Pkk = { data: [], url: '', bisaKelola: false, filter: 'semua', cari: '', idx: -1, sibuk: false, berubah: false };

const PKK_PERAN_KELOLA = ['DEVELOPER', 'PKK'];
const PKK_OPSI = {
  kondisi:  ['Ibu Hamil', 'Ibu Menyusui', 'Disabilitas', 'Buta Huruf'],
  jenisKB:  ['Pil', 'Suntik', 'IUD', 'Implan', 'Kondom', 'MOW/MOP'],
  rth:      ['TOGA', 'Lumbung Hidup', 'Warung Hidup', 'Tanaman Keras', 'Perikanan', 'Peternakan'],
  usaha:    ['Pangan', 'Sandang', 'Jasa'],
  kegiatan: ['Aktif', 'Pasif', 'Non Aktif'],
  bansos:   ['BPJS', 'KIS', 'PKH', 'BPNT', 'KIP', 'BLT']
};
const PKK_LABEL = {
  'IUD': 'IUD / Spiral', 'Implan': 'Implan / Susuk', 'MOW/MOP': 'Steril (MOW/MOP)',
  'Jasa': 'Jasa / Lainnya', 'BPJS': 'BPJS Mandiri', 'KIS': 'KIS (gratis)',
  'BPNT': 'BPNT (sembako)', 'KIP': 'KIP (sekolah)', 'BLT': 'BLT Desa'
};

const PKK_FILTER = [
  ['semua',   'Semua',       function(){ return true; }],
  ['kosong',  'Belum diisi', function(o){ return o.kosong; }],
  ['hamil',   'Bumil',       function(o){ return o.kondisi.indexOf('Ibu Hamil') !== -1; }],
  ['balita',  'Balita',      function(o){ return o.balita; }],
  ['lansia',  'Lansia',      function(o){ return o.lansia; }],
  ['kb',      'KB',          function(o){ return o.kb; }],
  ['bansos',  'Bansos',      function(o){ return o.bansos.length > 0; }],
  ['aktif',   'PKK aktif',   function(o){ return o.kegiatan === 'Aktif'; }],
  ['pasif',   'PKK pasif',   function(o){ return o.kegiatan === 'Pasif'; }]
];

async function init_pkk(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Pkk.data = []; Pkk.url = ''; Pkk.filter = 'semua'; Pkk.cari = ''; Pkk.idx = -1; Pkk.sibuk = false; Pkk.berubah = false;
  Pkk.bisaKelola = PKK_PERAN_KELOLA.indexOf(App.peran) !== -1;
  document.getElementById('pkkKelola').classList.toggle('pkk-sembunyi', !Pkk.bisaKelola);
  siapkanFormDawis();
  await muatPKK();
}

async function muatPKK(){
  const tugas = [muatStatistikPKK()];
  if (Pkk.bisaKelola) tugas.push(muatDaftarPKK());
  await Promise.all(tugas);
}

/* ---------- STATISTIK ---------- */
async function muatStatistikPKK(){
  const kotak = document.getElementById('pkkStat');
  if (!kotak) return;
  try {
    const s = await panggilAPI('statistikPKK');
    const isi = [
      ['warga', 'Warga aktif'], ['anggota', 'Anggota PKK aktif'],
      ['hamil', 'Ibu hamil'], ['menyusui', 'Ibu menyusui'],
      ['balita', 'Balita (< 5 th)'], ['lansia', 'Lansia (≥ 60 th)'],
      ['kb', 'Akseptor KB'], ['sampah', 'Rumah nasabah bank sampah'],
      ['usaha', 'Rumah punya usaha'], ['toga', 'Rumah punya TOGA']
    ];
    kotak.innerHTML = isi.map(function(x){
      return '<div class="pkk-kotak"><b>' + (Number(s[x[0]]) || 0) + '</b><small>' + x[1] + '</small></div>';
    }).join('');
    document.getElementById('pkkSub').textContent = (s.warga || 0) + ' warga aktif';
    document.getElementById('pkkKet').textContent = (Pkk.bisaKelola && s.tanpaLahir)
      ? s.tanpaLahir + ' warga belum punya tanggal lahir di Data Pokok, sehingga Balita/Lansia mereka belum terhitung otomatis.'
      : '';
  } catch (e) {
    document.getElementById('pkkSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong" style="grid-column:span 2;"><h2>Gagal memuat</h2><p>' + pkkAman(e.message) + '</p></div>';
  }
}

/* ---------- DAFTAR ---------- */
async function muatDaftarPKK(){
  const kotak = document.getElementById('pkkDaftar');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Memuat data Dasa Wisma…</div>';
  try {
    const h = await panggilAPI('daftarPKK');
    Pkk.data = h.data || [];
    Pkk.url = h.url || '';
    const a = document.getElementById('pkkSheet');
    if (/^https:\/\//.test(Pkk.url)){ a.href = Pkk.url; a.classList.remove('pkk-sembunyi'); }
    gambarPKK();
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + pkkAman(e.message) + '</p></div>';
  }
}

function setFilterPKK(f){ Pkk.filter = f; gambarPKK(); }

function gambarPKK(){
  const kotak = document.getElementById('pkkDaftar');
  if (!kotak) return;

  // Chip + jumlahnya
  document.getElementById('pkkChips').innerHTML = PKK_FILTER.map(function(f){
    const n = f[0] === 'semua' ? Pkk.data.length : Pkk.data.filter(f[2]).length;
    return '<button class="pkk-chip' + (Pkk.filter === f[0] ? ' on' : '') + '" onclick="setFilterPKK(\'' + f[0] + '\')">' +
      f[1] + '<i>' + n + '</i></button>';
  }).join('');

  const uji = (PKK_FILTER.filter(function(f){ return f[0] === Pkk.filter; })[0] || PKK_FILTER[0])[2];
  const q = Pkk.cari.trim().toLowerCase();
  const grup = [], posisi = {};

  Pkk.data.forEach(function(o, i){
    if (!uji(o)) return;
    if (q && (o.rumah + ' ' + o.nama).toLowerCase().indexOf(q) === -1) return;
    if (!(o.rumah in posisi)){ posisi[o.rumah] = grup.length; grup.push({ rumah: o.rumah, idx: [] }); }
    grup[posisi[o.rumah]].idx.push(i);
  });

  if (!grup.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada data</h2><p>' +
      (Pkk.data.length ? 'Tidak ada yang cocok dengan pencarian atau saringan.' : 'Belum ada warga aktif.') + '</p></div>';
    return;
  }

  kotak.innerHTML = grup.map(function(g){
    const orang = g.idx.map(function(i){
      const o = Pkk.data[i];
      const sub = [o.hub, o.umur != null ? o.umur + ' th' : ''].filter(Boolean).join(' · ');
      return '<button class="pkk-orang" onclick="bukaDawis(' + i + ')"><b>' + pkkAman(o.nama) + '</b>' +
        '<small>' + pkkAman(sub || '-') + '</small>' + pkkTags(o) + '</button>';
    }).join('');
    return '<div class="pkk-grup"><div class="pkk-grup-kepala"><b>' + pkkAman(g.rumah) + '</b>' +
      g.idx.length + ' orang</div>' + orang + '</div>';
  }).join('');
}

function pkkTags(o){
  const t = [];
  if (o.kosong) t.push(['BELUM DIISI', 'merah']);
  if (o.kondisi.indexOf('Ibu Hamil') !== -1) t.push(['BUMIL', 'emas']);
  if (o.kondisi.indexOf('Ibu Menyusui') !== -1) t.push(['BUSUI', 'emas']);
  if (o.balita) t.push(['BALITA', '']);
  if (o.lansia) t.push(['LANSIA', '']);
  if (o.kb) t.push(['KB', 'hijau']);
  if (o.kegiatan) t.push(['PKK ' + o.kegiatan.toUpperCase(), o.kegiatan === 'Aktif' ? 'hijau' : '']);
  o.bansos.slice(0, 3).forEach(function(b){ t.push([b.toUpperCase(), '']); });
  if (!t.length) return '';
  return '<div class="pkk-tags">' + t.map(function(x){
    return '<span class="pkk-tag ' + x[1] + '">' + pkkAman(x[0]) + '</span>';
  }).join('') + '</div>';
}

/* ---------- FORM DASA WISMA ---------- */
function siapkanFormDawis(){
  pkkIsiPil('dwKondisi', PKK_OPSI.kondisi);
  pkkIsiPil('dwKB', ['Ya', 'Tidak']);
  pkkIsiPil('dwPosyandu', ['Ya', 'Tidak']);
  pkkIsiPil('dwRth', PKK_OPSI.rth);
  pkkIsiPil('dwSampah', ['Ya', 'Tidak']);
  pkkIsiPil('dwKegiatan', PKK_OPSI.kegiatan);
  pkkIsiPil('dwBansos', PKK_OPSI.bansos);
  document.getElementById('dwUsaha').innerHTML = '<option value="-">Tidak ada</option>' +
    PKK_OPSI.usaha.map(function(v){ return '<option value="' + v + '">' + pkkAman(PKK_LABEL[v] || v) + '</option>'; }).join('');
}

function pkkSelect(id, daftar, nilai, kosong){
  const sel = document.getElementById(id);
  const ops = daftar.slice();
  if (nilai && ops.indexOf(nilai) === -1) ops.push(nilai);      // isian lama di luar daftar tetap tampil
  sel.innerHTML = '<option value="">' + kosong + '</option>' + ops.map(function(v){
    return '<option value="' + pkkAman(v) + '">' + pkkAman(PKK_LABEL[v] || v) + '</option>';
  }).join('');
  sel.value = nilai || '';
}

function bukaDawis(i){
  const o = Pkk.data[i];
  if (!o) return;
  Pkk.idx = i;
  Pkk.diingatkan = false;
  document.getElementById('dwGalat').textContent = '';
  document.getElementById('dwJudul').textContent = o.nama;

  // Info + kategori otomatis
  let info = '<b>Rumah ' + pkkAman(o.rumah) + '</b> · ' + pkkAman(o.hub || 'Anggota') +
             (o.umur != null ? ' · ' + o.umur + ' tahun' : '');
  const oto = [o.balita ? 'Balita' : '', o.lansia ? 'Lansia' : ''].filter(Boolean).join(', ');
  if (o.umur == null) info += '<br>Tanggal lahir belum diisi di Data Pokok.' +
    (oto ? ' Kategori <b>' + oto + '</b> diambil dari isian lama.' : '');
  else if (oto) info += '<br>Otomatis terhitung <b>' + oto + '</b> dari tanggal lahir.';
  document.getElementById('dwInfo').innerHTML = info;

  pkkPilih('dwKondisi', o.kondisi);
  pkkPilih('dwKB', [o.kb ? 'Ya' : 'Tidak']);
  pkkSelect('dwJenisKB', PKK_OPSI.jenisKB, o.jenisKB, '— Pilih metode —');
  pkkPilih('dwPosyandu', [o.posyandu ? 'Ya' : 'Tidak']);
  cekKBDawis();

  document.getElementById('dwBlokRT').classList.toggle('pkk-sembunyi', !o.kk);
  pkkPilih('dwRth', o.rth);
  const usaha = document.getElementById('dwUsaha');
  if (o.usaha && !Array.prototype.some.call(usaha.options, function(op){ return op.value === o.usaha; })){
    usaha.insertAdjacentHTML('beforeend', '<option value="' + pkkAman(o.usaha) + '">' + pkkAman(o.usaha) + '</option>');
  }
  usaha.value = o.usaha || '-';
  document.getElementById('dwDetail').value = o.detailUsaha || '';
  cekUsahaDawis();
  pkkPilih('dwSampah', [o.sampah ? 'Ya' : 'Tidak']);

  // Status PKK: nilai di luar daftar (mis. "Pengurus") → catatan, tidak terpilih
  const baku = PKK_OPSI.kegiatan.indexOf(o.kegiatan) !== -1;
  pkkPilih('dwKegiatan', baku ? [o.kegiatan] : []);
  const cat = document.getElementById('dwCatatanAG');
  cat.innerHTML = (!baku && o.kegiatan)
    ? 'Isian lama: <b>' + pkkAman(o.kegiatan) + '</b>. Pilih Aktif, Pasif, atau Non Aktif sebelum menyimpan, atau biarkan kosong.'
    : '';
  cat.classList.toggle('pkk-sembunyi', baku || !o.kegiatan);

  const bakuB = [], lain = [];
  o.bansos.forEach(function(b){
    const cocok = PKK_OPSI.bansos.filter(function(x){ return x.toLowerCase() === b.toLowerCase(); })[0];
    if (cocok) bakuB.push(cocok); else lain.push(b);
  });
  pkkPilih('dwBansos', bakuB);
  document.getElementById('dwBansosLain').value = lain.join(', ');

  // Tombol: lanjut ke anggota berikutnya di rumah yang sama
  const j = pkkBerikut(i);
  document.getElementById('dwBawah').innerHTML = j >= 0
    ? '<div class="pkk-bawah2"><button class="btn btn-halus" onclick="simpanDawis(false)">Simpan</button>' +
      '<button class="btn btn-utama" onclick="simpanDawis(true)">Simpan & lanjut ke ' +
      pkkAman(Pkk.data[j].nama.split(' ')[0]) + '</button></div>'
    : '<button class="btn btn-utama" onclick="simpanDawis(false)">Simpan</button>';

  document.getElementById('dwBadan').scrollTop = 0;
  bukaLembar('lembarDawis');
}

function pkkBerikut(i){
  const o = Pkk.data[i];
  for (let j = i + 1; j < Pkk.data.length; j++){
    if (Pkk.data[j].rumah === o.rumah) return j;
  }
  return -1;
}

function cekKBDawis(){
  document.getElementById('dwAreaJenisKB').classList.toggle('pkk-sembunyi', pkkAmbil('dwKB')[0] !== 'Ya');
}
function cekUsahaDawis(){
  document.getElementById('dwAreaDetail').classList.toggle('pkk-sembunyi', document.getElementById('dwUsaha').value === '-');
}

async function simpanDawis(lanjut){
  if (Pkk.sibuk) return;
  const o = Pkk.data[Pkk.idx];
  if (!o) return;
  const galat = document.getElementById('dwGalat');
  galat.textContent = '';

  const kb = pkkAmbil('dwKB')[0] === 'Ya';
  const f = {
    kunci: o.kunci,
    kondisi: pkkAmbil('dwKondisi'),
    kb: kb,
    jenisKB: kb ? document.getElementById('dwJenisKB').value : '',
    posyandu: pkkAmbil('dwPosyandu')[0] === 'Ya',
    rth: pkkAmbil('dwRth'),
    usaha: document.getElementById('dwUsaha').value,
    detailUsaha: document.getElementById('dwDetail').value.trim(),
    sampah: pkkAmbil('dwSampah')[0] === 'Ya',
    kegiatan: pkkAmbil('dwKegiatan')[0] || '',
    bansos: pkkAmbil('dwBansos'),
    bansosLain: document.getElementById('dwBansosLain').value
  };
  if (!f.kegiatan && o.kegiatan && PKK_OPSI.kegiatan.indexOf(o.kegiatan) === -1 && !Pkk.diingatkan){
    Pkk.diingatkan = true;
    galat.textContent = 'Status PKK lama "' + o.kegiatan + '" sudah tidak dipakai. Pilih salah satu status, atau ketuk Simpan lagi untuk mengosongkannya.';
    return;
  }

  Pkk.sibuk = true;
  tunggu('Menyimpan…', o.nama);
  try {
    const h = await panggilAPI('simpanPKK', f);
    selesaiTunggu();
    toast(h.message || 'Tersimpan');
    pkkPerbaruiLokal(o, f);
    Pkk.berubah = true;
    gambarPKK();
    const j = pkkBerikut(Pkk.idx);
    if (lanjut && j >= 0) bukaDawis(j);
    else tutupDawis();
  } catch (e) {
    selesaiTunggu();
    galat.textContent = e.message;
  } finally {
    Pkk.sibuk = false;
  }
}

/** Samakan data di layar dengan yang baru disimpan, tanpa memuat ulang semua. */
function pkkPerbaruiLokal(o, f){
  o.kondisi = f.kondisi.slice();
  o.kb = f.kb; o.jenisKB = f.jenisKB; o.posyandu = f.posyandu;
  o.rth = o.kk ? f.rth.slice() : [];
  o.usaha = (o.kk && f.usaha !== '-') ? f.usaha : '';
  o.detailUsaha = o.usaha ? f.detailUsaha : '';
  o.sampah = o.kk && f.sampah;
  o.kegiatan = f.kegiatan;
  const lain = f.bansosLain.split(',').map(function(x){ return x.trim(); }).filter(Boolean).slice(0, 5);
  o.bansos = f.bansos.concat(lain);
  o.kosong = false;
}

function tutupDawis(){
  tutupLembar('lembarDawis');
  if (Pkk.berubah){ Pkk.berubah = false; muatStatistikPKK(); }
}

/* ---------- PILIHAN CHIP ---------- */
function pkkIsiPil(id, daftar){
  document.getElementById(id).innerHTML = daftar.map(function(v){
    return '<button type="button" data-v="' + pkkAman(v) + '" onclick="pkkKetuk(this)">' + pkkAman(PKK_LABEL[v] || v) + '</button>';
  }).join('');
}

function pkkKetuk(b){
  const box = b.parentElement;
  const mode = box.getAttribute('data-mode');
  if (mode === 'multi'){
    b.classList.toggle('on');
  } else {
    const tadi = b.classList.contains('on');
    box.querySelectorAll('button').forEach(function(x){ x.classList.remove('on'); });
    if (!(tadi && mode === 'single')) b.classList.add('on');   // 'single' boleh dikosongkan
  }
  // Hamil dan menyusui tidak bersamaan
  if (box.id === 'dwKondisi' && b.classList.contains('on')){
    const lawan = { 'Ibu Hamil': 'Ibu Menyusui', 'Ibu Menyusui': 'Ibu Hamil' }[b.dataset.v];
    if (lawan) box.querySelectorAll('button').forEach(function(x){ if (x.dataset.v === lawan) x.classList.remove('on'); });
  }
  if (box.id === 'dwKB') cekKBDawis();
  if (box.id === 'dwKegiatan') document.getElementById('dwCatatanAG').classList.add('pkk-sembunyi');
}

function pkkPilih(id, nilai){
  document.getElementById(id).querySelectorAll('button').forEach(function(x){
    x.classList.toggle('on', nilai.indexOf(x.dataset.v) !== -1);
  });
}

function pkkAmbil(id){
  return Array.prototype.map.call(document.getElementById(id).querySelectorAll('button.on'),
    function(x){ return x.dataset.v; });
}

/* ---------- ALAT ---------- */
function pkkAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}