/* =================================================================
   MODUL BERANDA — v3 (dengan Kalender Kegiatan)
   ================================================================= */

const HARI_ID  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const HARI_CAP = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];

// Server mengirim bulan dalam singkatan Inggris; diterjemahkan di sini
const BULAN_SINGKAT = {
  JAN:'Jan', FEB:'Feb', MAR:'Mar', APR:'Apr', MAY:'Mei', JUN:'Jun',
  JUL:'Jul', AUG:'Agu', SEP:'Sep', OCT:'Okt', NOV:'Nov', DEC:'Des'
};

const STATUS_PILIHAN = [
  { nilai:'Belum',   label:'Belum Dikerjakan', warna:'var(--muted)',    kelas:'belum'   },
  { nilai:'Proses',  label:'Sedang Berjalan',  warna:'var(--gold)',     kelas:'proses'  },
  { nilai:'Selesai', label:'Selesai',          warna:'var(--sage)',     kelas:'selesai' },
  { nilai:'Batal',   label:'Dibatalkan',       warna:'var(--red)',      kelas:'batal'   }
];

const Beranda = {
  pengumuman: [],
  rondaFull:  [],
  hariAktif:  '',
  petugas:    [],
  wargaDimuat:false,
  kalender:   [],
  kegAktif:   null
};

/* ---------- MULAI ---------- */
async function init_dashboard(){
  tanggalBeranda();

  const labelPeran = LABEL_PERAN[App.peran] || App.peran;
  document.getElementById('dashPeran').textContent   = labelPeran;
  document.getElementById('dashRoleTag').textContent = labelPeran;

  if (bolehKelola()){
    document.getElementById('btnKelolaUmum').classList.remove('sembunyi');
    document.getElementById('btnKelolaRonda').classList.remove('sembunyi');
  }

  try {
    const d = await panggilAPI('getBeranda');
    isiIdentitas(d.info);
    Beranda.pengumuman = d.pengumuman || [];
    Beranda.kalender   = d.kalender   || [];
    isiPengumuman();
    isiKalender();
    isiStatistik(d.statistik);
    isiRonda(d.ronda);
  } catch (e) {
    document.getElementById('boxPengumuman').innerHTML =
      '<div class="card ann"><div class="ann-body">Gagal memuat data: ' +
      amanTeks(e.message) + '</div></div>';
  }
}

function bolehKelola(){
  return ['DEVELOPER','RT','SEKRETARIS'].indexOf(App.peran) !== -1;
}

/** Boleh ubah status kegiatan ini? Cerminan aturan di server. */
function bolehUbahStatus(org){
  const jenis = String(org || 'RT').toUpperCase();
  if (jenis === 'PKK') return ['DEVELOPER','PKK','RT'].indexOf(App.peran) !== -1;
  return ['DEVELOPER','RT','SEKRETARIS'].indexOf(App.peran) !== -1;
}

function tanggalBeranda(){
  const n = new Date();
  document.getElementById('dashHari').textContent = HARI_ID[n.getDay()];
  document.getElementById('dashTgl').textContent  = tglIndo(n);
}

function tglIndo(d){
  return d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear();
}

/* ---------- IDENTITAS ---------- */
function isiIdentitas(info){
  if (!info) return;

  const nama = info.nama || '';
  const desc = info.desc || '';

  document.getElementById('dashNamaRT').textContent   = nama ? ('Warga ' + nama) : 'Beranda';
  document.getElementById('dashDesc').textContent     = desc;
  document.getElementById('dashJudul').textContent    = nama;
  document.getElementById('dashSubJudul').textContent = desc;

  const kotak = document.getElementById('dashLogo');
  if (info.logo && String(info.logo).length > 20){
    kotak.classList.add('id-mark--polos');
    kotak.innerHTML = '<img src="' + info.logo + '" alt="Logo">';
  } else {
    kotak.classList.remove('id-mark--polos');
    kotak.textContent = inisialLembaga(nama);
  }
}

function inisialLembaga(nama){
  const kata = String(nama || '').trim().split(/\s+/).filter(Boolean);
  if (!kata.length) return '•';
  return kata.slice(0,2).map(function(k){ return k[0]; }).join('').toUpperCase();
}

/* ---------- PENGUMUMAN ---------- */
function isiPengumuman(){
  const kotak = document.getElementById('boxPengumuman');
  const daftar = Beranda.pengumuman;

  if (!daftar || !daftar.length){
    kotak.innerHTML = '<div class="card ann"><div class="ann-ic">' +
      '<svg class="ic ic-sm"><use href="#i-mega"/></svg></div>' +
      '<div class="ann-body">Belum ada pengumuman.</div></div>';
    return;
  }

  kotak.innerHTML = daftar.map(function(teks){
    return '<div class="card ann"><div class="ann-ic">' +
           '<svg class="ic ic-sm"><use href="#i-mega"/></svg></div>' +
           '<div class="ann-body">' + amanTeks(teks) + '</div></div>';
  }).join('');
}

function bukaEditorPengumuman(){
  const kotak = document.getElementById('daftarEditUmum');
  kotak.innerHTML = '';
  Beranda.pengumuman.forEach(function(t){ tambahBarisUmum(t); });
  bukaLembar('lembarUmum');
}

function tambahBarisUmum(isi){
  const kotak = document.getElementById('daftarEditUmum');
  const baris = document.createElement('div');
  baris.className = 'baris-umum';

  const ta = document.createElement('textarea');
  ta.value = isi || '';
  ta.placeholder = 'Tulis pengumuman…';

  const btn = document.createElement('button');
  btn.className = 'btn-buang';
  btn.innerHTML = '<svg class="ic ic-sm"><use href="#i-hapus"/></svg>';
  btn.onclick = function(){ baris.remove(); };

  baris.appendChild(ta);
  baris.appendChild(btn);
  kotak.appendChild(baris);
  ta.focus();
}

async function simpanPengumuman(){
  const kotak = document.getElementById('daftarEditUmum');
  const isi = Array.prototype.map.call(kotak.querySelectorAll('textarea'), function(t){
    return t.value.trim();
  }).filter(Boolean);

  const btn = document.getElementById('btnSimpanUmum');
  btn.disabled = true; btn.textContent = 'Menyimpan…';

  try {
    await panggilAPI('simpanPengumuman', isi);
    Beranda.pengumuman = isi;
    isiPengumuman();
    tutupLembar('lembarUmum');
    toast('Pengumuman tersimpan');
  } catch (e) {
    toast('Gagal: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

/* ---------- KALENDER KEGIATAN ---------- */
function isiKalender(){
  const kotak = document.getElementById('boxKalender');
  const jml   = document.getElementById('lblJmlKegiatan');
  const daftar = Beranda.kalender;

  if (!daftar || !daftar.length){
    jml.textContent = '';
    kotak.innerHTML = '<div class="kosong" style="padding:34px 20px;">' +
      '<p>Belum ada kegiatan terjadwal.<br>Kegiatan muncul otomatis dari notulen rapat.</p></div>';
    return;
  }

  jml.textContent = daftar.length + ' kegiatan';

  kotak.innerHTML = daftar.map(function(k, i){
    const tgl   = pecahTanggal(k.tgl);
    const org   = String(k.org || 'RT').toUpperCase();
    const stat  = rapikanStatus(k.status);
    const klik  = bolehUbahStatus(org);

    let meta = '';
    if (k.jam) meta += '<span><svg class="ic ic-xs"><use href="#i-jam"/></svg>' + amanTeks(k.jam) + '</span>';
    if (k.pic) meta += '<span><svg class="ic ic-xs"><use href="#i-orang"/></svg>' + amanTeks(k.pic) + '</span>';

    return '<div class="agenda">' +
      '<div class="agenda-tgl"><b>' + tgl.hari + '</b><span>' + tgl.bulan + '</span></div>' +
      '<div class="agenda-isi"><b>' + amanTeks(k.acara) + '</b>' +
        '<div class="agenda-meta">' + meta + '</div></div>' +
      '<div class="agenda-kanan">' +
        '<span class="tag-org' + (org === 'PKK' ? ' pkk' : '') + '">' + amanTeks(org) + '</span>' +
        '<button class="chip-status ' + stat.kelas + (klik ? ' bisa-klik' : '') + '"' +
          (klik ? ' onclick="bukaUbahStatus(' + i + ')"' : ' disabled') + '>' +
          stat.label + '</button>' +
      '</div></div>';
  }).join('');
}

/** "28 Aug" → { hari:'28', bulan:'Agu' } */
function pecahTanggal(teks){
  const t = String(teks || '').trim();
  const bagian = t.split(/\s+/);

  if (bagian.length >= 2){
    const kunci = bagian[1].toUpperCase().slice(0,3);
    return { hari: bagian[0], bulan: BULAN_SINGKAT[kunci] || bagian[1] };
  }
  return { hari: t || '?', bulan: '' };
}

function rapikanStatus(nilai){
  const t = String(nilai || '').trim().toLowerCase();
  if (t === 'selesai') return { kelas:'selesai', label:'Selesai' };
  if (t === 'proses')  return { kelas:'proses',  label:'Proses'  };
  if (t === 'batal')   return { kelas:'batal',   label:'Batal'   };
  if (t === 'belum')   return { kelas:'belum',   label:'Belum'   };
  return { kelas:'belum', label: nilai && nilai !== '-' ? amanTeks(nilai) : '—' };
}

function bukaUbahStatus(indeks){
  const k = Beranda.kalender[indeks];
  if (!k) return;

  Beranda.kegAktif = { indeks: indeks, data: k };

  document.getElementById('statAcara').textContent = k.acara || '—';
  document.getElementById('statInfo').textContent =
    [k.tgl, k.jam, k.pic].filter(Boolean).join(' · ');

  const sekarang = String(k.status || '').trim().toLowerCase();
  const kotak = document.getElementById('statDaftar');
  kotak.innerHTML = '';

  STATUS_PILIHAN.forEach(function(s){
    const b = document.createElement('button');
    b.className = 'status-opsi' + (s.nilai.toLowerCase() === sekarang ? ' on' : '');
    b.innerHTML = '<i style="background:' + s.warna + '"></i>' + s.label;
    b.onclick = function(){ simpanStatus(s.nilai); };
    kotak.appendChild(b);
  });

  bukaLembar('lembarStatus');
}

async function simpanStatus(statusBaru){
  const aktif = Beranda.kegAktif;
  if (!aktif) return;

  const k = aktif.data;
  const tombolSemua = document.querySelectorAll('#statDaftar .status-opsi');
  tombolSemua.forEach(function(b){ b.disabled = true; });

  try {
    await panggilAPI('ubahStatusKeg', k.id, statusBaru, String(k.org || 'RT').toUpperCase());

    // Perbarui salinan di HP supaya tampilan langsung berubah
    Beranda.kalender[aktif.indeks].status = statusBaru;
    isiKalender();

    tutupLembar('lembarStatus');
    toast('Status jadi "' + statusBaru + '" — notulen ikut diperbarui');

  } catch (e) {
    toast('Gagal: ' + e.message);
  } finally {
    tombolSemua.forEach(function(b){ b.disabled = false; });
  }
}

/* ---------- STATISTIK ---------- */
function isiStatistik(s){
  const kotak = document.getElementById('boxStatistik');
  if (!s){ kotak.innerHTML = ''; return; }

  const totalRumah = (s.milik||0) + (s.kontrak||0) + (s.numpang||0);
  const totalJiwa  = (s.pria||0)  + (s.wanita||0);

  kotak.innerHTML =
    kartuDonat(totalRumah, 'rumah', s.milik, totalRumah, 'var(--sage)', 'Status Hunian',
      [['var(--sage)','Milik ' + (s.milik||0)],
       ['#EDF0F4','Kontrak ' + (s.kontrak||0)],
       ['var(--gold)','Numpang ' + (s.numpang||0)]]) +
    kartuDonat(totalJiwa, 'jiwa', s.pria, totalJiwa, 'var(--hero-2)', 'Gender',
      [['var(--hero-2)','Laki ' + (s.pria||0)],
       ['var(--pink)','Perempuan ' + (s.wanita||0)]]);
}

function kartuDonat(angka, satuan, bagian, total, warna, nama, legenda){
  const keliling = 239;
  const isi = total ? (bagian / total) * keliling : 0;

  return '<div class="card stat">' +
    '<div class="donut"><svg width="96" height="96" viewBox="0 0 96 96">' +
      '<circle cx="48" cy="48" r="38" stroke="#EDF0F4" stroke-width="13" fill="none"/>' +
      '<circle cx="48" cy="48" r="38" stroke="' + warna + '" stroke-width="13" fill="none" ' +
        'stroke-linecap="round" stroke-dasharray="' + isi.toFixed(0) + ' ' + keliling + '"/>' +
    '</svg><div class="donut-mid"><b>' + angka + '</b><span>' + satuan + '</span></div></div>' +
    '<div class="stat-name">' + nama + '</div><div class="legend">' +
      legenda.map(function(l){
        return '<span><i style="background:' + l[0] + '"></i>' + l[1] + '</span>';
      }).join('') +
    '</div></div>';
}

/* ---------- RONDA ---------- */
function isiRonda(r){
  const lbl  = document.getElementById('rondaHari');
  const list = document.getElementById('rondaList');

  if (!r || r.status !== 'success'){
    lbl.textContent = 'Jadwal belum tersedia';
    list.innerHTML = '';
    return;
  }

  Beranda.rondaFull = r.dataFull || [];
  Beranda.hariAktif = r.hariIni || HARI_CAP[new Date().getDay()];

  const n = new Date();
  lbl.textContent = HARI_ID[n.getDay()] + ' · ' + tglIndo(n);

  list.innerHTML = gambarPetugas(pecahPetugas(r.petugas));
}

function pecahPetugas(teks){
  return String(teks || '')
    .split(/[,;\n]/)
    .map(function(x){ return x.trim(); })
    .filter(function(x){ return x && x !== '-'; });
}

function gambarPetugas(daftar){
  if (!daftar.length) return '<div class="guard"><span>Belum ada petugas</span></div>';
  return daftar.map(function(nama){
    return '<div class="guard"><i>' + inisial(nama) + '</i><span>' +
           amanTeks(nama) + '</span></div>';
  }).join('');
}

function inisial(teks){
  const bersih = String(teks).replace(/^[A-Z0-9]+\s*-\s*/i, '').trim();
  const kata = bersih.split(/\s+/);
  return ((kata[0] || '?')[0] + (kata[1] ? kata[1][0] : '')).toUpperCase();
}

/* ---------- EDITOR RONDA ---------- */
async function bukaEditorRonda(){
  gambarTabHari();
  pilihHari(Beranda.hariAktif);
  bukaLembar('lembarRonda');

  if (!Beranda.wargaDimuat){
    try {
      const hasil = await panggilAPI('getWargaRonda');
      if (hasil && hasil.status === 'success'){
        document.getElementById('dlWarga').innerHTML =
          hasil.data.map(function(w){
            return '<option value="' + amanTeks(w) + '"></option>';
          }).join('');
        Beranda.wargaDimuat = true;
      }
    } catch (e) { toast('Daftar warga gagal dimuat'); }
  }
}

function gambarTabHari(){
  const baris = document.getElementById('hariBaris');
  baris.innerHTML = '';

  HARI_CAP.forEach(function(h, i){
    const b = document.createElement('button');
    b.className = 'hari-pil';
    b.dataset.hari = h;
    b.textContent = HARI_ID[i];
    b.onclick = function(){ pilihHari(h); };
    baris.appendChild(b);
  });
}

function pilihHari(hari){
  Beranda.hariAktif = hari;

  document.querySelectorAll('.hari-pil').forEach(function(b){
    b.classList.toggle('on', b.dataset.hari === hari);
  });

  const data = Beranda.rondaFull.find(function(x){ return x.hari === hari; });
  Beranda.petugas = pecahPetugas(data ? data.petugas : '');
  gambarEditorPetugas();

  const nomor = HARI_CAP.indexOf(hari);
  document.getElementById('btnSimpanRonda').textContent =
    'Simpan Jadwal ' + (nomor >= 0 ? HARI_ID[nomor] : '');
}

function gambarEditorPetugas(){
  const kotak = document.getElementById('petugasKotak');

  if (!Beranda.petugas.length){
    kotak.innerHTML = '<div class="kosong-kecil">Belum ada petugas untuk hari ini.</div>';
    return;
  }

  kotak.innerHTML = '';
  Beranda.petugas.forEach(function(nama, i){
    const pil = document.createElement('span');
    pil.className = 'petugas-pil';
    pil.innerHTML = amanTeks(nama);

    const btn = document.createElement('button');
    btn.innerHTML = '<svg class="ic" style="width:12px;height:12px"><use href="#i-tutup"/></svg>';
    btn.onclick = function(){
      Beranda.petugas.splice(i, 1);
      gambarEditorPetugas();
    };

    pil.appendChild(btn);
    kotak.appendChild(pil);
  });
}

function tambahPetugas(){
  const input = document.getElementById('cariPetugas');
  const nilai = input.value.trim();
  if (!nilai) return;

  if (Beranda.petugas.indexOf(nilai) !== -1){
    toast('Sudah ada di daftar');
    return;
  }

  Beranda.petugas.push(nilai);
  input.value = '';
  gambarEditorPetugas();
}

async function simpanRonda(){
  const btn = document.getElementById('btnSimpanRonda');
  const teksAsli = btn.textContent;
  btn.disabled = true; btn.textContent = 'Menyimpan…';

  const gabung = Beranda.petugas.join(', ');

  try {
    const hasil = await panggilAPI('simpanRonda', Beranda.hariAktif, gabung);
    if (hasil && hasil.status === 'error') throw new Error(hasil.message);

    const item = Beranda.rondaFull.find(function(x){ return x.hari === Beranda.hariAktif; });
    if (item) item.petugas = gabung;
    else Beranda.rondaFull.push({ hari: Beranda.hariAktif, petugas: gabung });

    if (Beranda.hariAktif === HARI_CAP[new Date().getDay()]){
      document.getElementById('rondaList').innerHTML = gambarPetugas(Beranda.petugas);
    }

    tutupLembar('lembarRonda');
    toast('Jadwal ronda tersimpan');
  } catch (e) {
    toast('Gagal: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = teksAsli;
  }
}

/* ---------- SOS ---------- */
function bukaKentongan(){
  document.getElementById('sosLokasi').value = '';
  bukaLembar('lembarSos');
  setTimeout(function(){ document.getElementById('sosLokasi').focus(); }, 200);
}

function pilihSos(jenis){
  const lokasi = document.getElementById('sosLokasi').value.trim();

  if (!lokasi){
    toast('Isi lokasi kejadian dulu');
    document.getElementById('sosLokasi').focus();
    return;
  }

  if (!confirm('Kirim sinyal ' + jenis + ' di ' + lokasi +
               '?\n\nPesan akan dikirim ke petugas keamanan.')) return;

  tutupLembar('lembarSos');
  kirimSinyal(jenis, lokasi);
}

/* ---------- ALAT ---------- */
function bukaLembar(id){ document.getElementById(id).classList.add('on'); }
function tutupLembar(id){ document.getElementById(id).classList.remove('on'); }

function amanTeks(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}