/* =================================================================
   MODUL KEUANGAN PKK (Tahap 6A baca + 6B transaksi)
   ================================================================= */

const Kp = {
  data: null, bulan: '', tab: 'anggota', filter: 'semua', cari: '', kartu: -1, tahun: 0, pilih: '',
  kelola: false, sibuk: false,
  catat: { tab: 'iuran', metode: 'Tunai', pilih: {}, cari: '' },
  lain:  { jenis: 'Masuk', metode: 'Tunai' }
};

const KP_PERAN_TULIS = ['DEVELOPER', 'PKK'];
const KP_BULAN  = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                   'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KP_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const KP_KATEGORI = {
  Masuk:  ['Donasi/Sumbangan', 'Penjualan Barang', 'Pemasukan Lainnya'],
  Keluar: { 'Konsumsi': 'KONSUMSI', 'Sosial': 'SOSIAL', 'ATK & Admin': 'KAS',
            'Inventaris': 'KAS', 'Operasional': 'KAS', 'Pengeluaran Lainnya': 'KAS' },
  Mutasi: { 'Tarik Tunai': 'Tarik tunai (Bank → Tunai)', 'Setor Tunai': 'Setor tunai (Tunai → Bank)' }
};
const KP_NAMA_POS = { KAS: 'Kas', SOSIAL: 'Sosial', KONSUMSI: 'Konsumsi' };

async function init_keuangan_pkk(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Kp.data = null; Kp.bulan = ''; Kp.tab = 'anggota'; Kp.filter = 'semua'; Kp.cari = '';
  Kp.kartu = -1; Kp.tahun = 0; Kp.pilih = ''; Kp.sibuk = false;
  Kp.catat = { tab: 'iuran', metode: 'Tunai', pilih: {}, cari: '' };
  Kp.lain = { jenis: 'Masuk', metode: 'Tunai' };
  Kp.kelola = KP_PERAN_TULIS.indexOf(App.peran) !== -1;
  document.getElementById('kpCatat').classList.toggle('kp-sembunyi', !Kp.kelola);
  ['kpTagihSemua', 'kpLaporan', 'kkKirim'].forEach(function(id){
  document.getElementById(id).classList.toggle('kp-sembunyi', !Kp.kelola);
  });
  if (Kp.kelola) document.getElementById('kpSegar').style.marginLeft = '0';
  pilihTabKp('anggota');
  await muatKeuPKK();
}

async function muatKeuPKK(bulan){
  const sub = document.getElementById('kpSub');
  if (!sub) return;
  if (bulan !== undefined) Kp.bulan = bulan;
  sub.textContent = 'Memuat…';
  try {
    const h = await panggilAPI('keuanganPKK', Kp.bulan);
    Kp.data = h;
    Kp.bulan = h.bulan;
    gambarRingkasKp();
    gambarAnggotaKp();
    gambarJurnalKp();
  } catch (e) {
    sub.textContent = 'Gagal memuat';
    document.getElementById('kpAnggota').innerHTML =
      '<div class="kosong"><h2>Gagal memuat</h2><p>' + kpAman(e.message) + '</p></div>';
  }
}

function pilihTabKp(t){
  Kp.tab = t;
  document.getElementById('kpTabAnggota').classList.toggle('on', t === 'anggota');
  document.getElementById('kpTabJurnal').classList.toggle('on', t === 'jurnal');
  document.getElementById('kpPanelAnggota').classList.toggle('kp-sembunyi', t !== 'anggota');
  document.getElementById('kpPanelJurnal').classList.toggle('kp-sembunyi', t !== 'jurnal');
}

/* ---------- RINGKASAN ---------- */
function gambarRingkasKp(){
  const h = Kp.data, f = h.ringkas.fisik, a = h.ringkas.alokasi, t = h.tarif;
  kpTeks('kpTunai', kpRp(f.tunai)); kpTeks('kpBank', kpRp(f.bank)); kpTeks('kpTotal', kpRp(f.total));
  kpTeks('kpKas', kpRp(a.kas)); kpTeks('kpSosial', kpRp(a.sosial)); kpTeks('kpKonsumsi', kpRp(a.konsumsi));

  const cek = document.getElementById('kpCek');
  cek.classList.remove('kp-sembunyi');
  if (!h.ringkas.masalah.length){
    cek.className = 'kp-cek ok';
    cek.textContent = '✓ Pembukuan seimbang: Kas + Sosial + Konsumsi = uang fisik';
  } else {
    cek.className = 'kp-cek';
    cek.innerHTML = '<b>Perlu dicek di sheet:</b><br>' + h.ringkas.masalah.map(kpAman).join('<br>');
  }

  kpTeks('kpTarif', 'Iuran per bulan ' + kpRp(t.total) + ' (Kas ' + kpRp(t.kas) + ' · Sosial ' +
   kpRp(t.sosial) + ' · Konsumsi ' + kpRp(t.konsumsi) + '). Jatuh tempo tanggal ' + h.tglTempo + ' setiap bulan.');

  const wajib = h.anggota.filter(function(x){ return x.wajib; }).length;
  const nunggak = h.anggota.filter(function(x){ return x.nunggak > 0; }).length;
  kpTeks('kpSub', wajib + ' anggota wajib iuran · ' + nunggak + ' menunggak');
}

/* ---------- KARTU IURAN: DAFTAR ---------- */
const KP_FILTER = [
  ['semua',   'Semua',    function(){ return true; }],
  ['nunggak', 'Nunggak',  function(a){ return a.nunggak > 0; }],
  ['lancar',  'Lancar',   function(a){ return a.wajib && a.nunggak === 0; }]
];

function setFilterKp(f){ Kp.filter = f; gambarAnggotaKp(); }

function gambarAnggotaKp(){
  const kotak = document.getElementById('kpAnggota');
  if (!kotak || !Kp.data) return;
  const semua = Kp.data.anggota;

  document.getElementById('kpChips').innerHTML = KP_FILTER.map(function(f){
    return '<button class="kp-chip' + (Kp.filter === f[0] ? ' on' : '') + '" onclick="setFilterKp(\'' + f[0] + '\')">' +
      f[1] + '<i>' + semua.filter(f[2]).length + '</i></button>';
  }).join('');

  const uji = (KP_FILTER.filter(function(f){ return f[0] === Kp.filter; })[0] || KP_FILTER[0])[2];
  const q = Kp.cari.trim().toLowerCase();
  const idx = [];
  semua.forEach(function(a, i){
    if (!uji(a)) return;
    if (q && (a.rumah + ' ' + a.nama).toLowerCase().indexOf(q) === -1) return;
    idx.push(i);
  });

  if (!idx.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada data</h2><p>' +
      (semua.length ? 'Tidak ada yang cocok.' : 'Belum ada anggota berstatus Aktif di Database PKK.') + '</p></div>';
    return;
  }

  kotak.innerHTML = '<div class="kp-daftar">' + idx.map(function(i){
    const a = semua[i];
    return '<button class="kp-orang" onclick="bukaKartuKp(' + i + ')"><div class="isi"><b>' + kpAman(a.nama) +
      '</b><small>' + kpAman('Rumah ' + a.rumah + (a.wajib ? '' : ' · sudah tidak aktif')) + '</small></div>' +
      kpPilStatus(a) + '</button>';
  }).join('') + '</div>';
}

/** [kelas, teks] status singkat satu anggota — dipakai di daftar kartu & lembar bayar. */
function kpStatusSingkat(a){
  if (a.nunggak > 0) return ['merah', 'Nunggak ' + a.nunggak + ' bln'];
  if (a.mulai > Kp.data.kini) return ['', 'Mulai ' + kpPeriode(a.mulai, true)];
  if (!a.lunasSampai) return ['', 'Belum jatuh tempo'];
  return ['hijau', 'Lunas s.d. ' + kpPeriode(a.lunasSampai, true)];
}

function kpJatuhTempo(p){ return Kp.data.tglTempo + ' ' + kpPeriode(p); }

function kpPilStatus(a){
  const s = kpStatusSingkat(a);
  return '<span class="kp-pil ' + s[0] + '">' + s[1] + '</span>';
}

/* ---------- KARTU IURAN: DETAIL ---------- */
function bukaKartuKp(i){
  const a = Kp.data.anggota[i];
  if (!a) return;
  Kp.kartu = i; Kp.pilih = '';
  Kp.tahun = Number(Kp.data.kini.slice(0, 4));
  const r = kpRentangTahun(a);
  if (Kp.tahun > r[1]) Kp.tahun = r[1];
  if (Kp.tahun < r[0]) Kp.tahun = r[0];

  document.getElementById('kkJudul').textContent = a.nama;
  let info = 'Rumah <b>' + kpAman(a.rumah) + '</b> · ditagih sejak <b>' + kpPeriode(a.mulai) + '</b>' +
             (a.akhir ? ' sampai <b>' + kpPeriode(a.akhir) + '</b>' : '') + '<br>';
  if (a.nunggak > 0){
    info += '<span class="kp-minus"><b>Nunggak ' + a.nunggak + ' bulan · ' + kpRp(a.nunggakRp) + '</b></span><br>' +
      a.bulanNunggak.map(function(p){ return kpPeriode(p, true); }).join(', ') + (a.nunggak > a.bulanNunggak.length ? ', …' : '');
  } else if (a.mulai > Kp.data.kini || !a.lunasSampai){
    info += 'Belum ada tunggakan. Iuran pertama jatuh tempo <b>' + kpJatuhTempo(a.mulai) + '</b>.';
  } else {
    info += '<span class="kp-plus"><b>Lancar</b></span> · lunas sampai ' + kpPeriode(a.lunasSampai);
  }
  document.getElementById('kkInfo').innerHTML = info;
  gambarGridKp();
  bukaLembar('lembarKartuKp');
}

function kpRentangTahun(a){
  const ys = [Number(a.mulai.slice(0, 4)), Number(Kp.data.kini.slice(0, 4))];
  Object.keys(a.bayar).forEach(function(p){ ys.push(Number(p.slice(0, 4))); });
  return [Math.min.apply(null, ys), Math.max.apply(null, ys)];
}

function geserTahunKp(n){
  const a = Kp.data.anggota[Kp.kartu];
  const r = kpRentangTahun(a);
  const t = Kp.tahun + n;
  if (t < r[0] || t > r[1]) return;
  Kp.tahun = t; Kp.pilih = '';
  gambarGridKp();
}

function kpStatus(a, p){
  if (a.bayar[p]) return 'lunas';
  if (p < a.mulai || (a.akhir && p > a.akhir)) return 'luar';
  return p <= Kp.data.tempo ? 'nunggak' : 'belum';
}

function gambarGridKp(){
  const a = Kp.data.anggota[Kp.kartu];
  const r = kpRentangTahun(a);
  kpTeks('kkTahun', String(Kp.tahun));
  document.getElementById('kkKiri').disabled = Kp.tahun <= r[0];
  document.getElementById('kkKanan').disabled = Kp.tahun >= r[1];

  let h = '';
  for (let m = 1; m <= 12; m++){
    const p = Kp.tahun + '-' + ('0' + m).slice(-2);
    h += '<button class="kk-kotak ' + kpStatus(a, p) + (Kp.pilih === p ? ' pilih' : '') +
         '" onclick="detailKotakKp(\'' + p + '\')">' + KP_PENDEK[m - 1] + '</button>';
  }
  document.getElementById('kkGrid').innerHTML = h;
  if (!Kp.pilih) kpTeks('kkDetail', 'Ketuk bulan untuk melihat rincian.');
}

function detailKotakKp(p){
  const a = Kp.data.anggota[Kp.kartu];
  Kp.pilih = p;
  gambarGridKp();
  const nama = kpPeriode(p);
  kpTeks('kkDetail', {
    lunas:   nama + ': dibayar pada ' + kpTgl(a.bayar[p]) + '.',
    nunggak: nama + ': belum dibayar (jatuh tempo ' + kpJatuhTempo(p) + ').',
    belum:   nama + ': belum jatuh tempo (' + kpJatuhTempo(p) + ').',
    luar:    nama + ': di luar masa keanggotaan.'
  }[kpStatus(a, p)]);
}

/* ---------- JURNAL ---------- */
function gambarJurnalKp(){
  const h = Kp.data;
  document.getElementById('kpBulan').innerHTML = h.daftarBulan.map(function(p){
    return '<option value="' + p + '"' + (p === h.bulan ? ' selected' : '') + '>' + kpPeriode(p) + '</option>';
  }).join('');

  let masuk = 0, keluar = 0;
  const kotak = document.getElementById('kpJurnal');
  if (!h.jurnal.length){
    kpTeks('kpMasuk', kpRp(0)); kpTeks('kpKeluar', kpRp(0));
    kotak.innerHTML = '<div class="kosong"><h2>Belum ada transaksi</h2><p>Tidak ada transaksi di ' +
      kpAman(kpPeriode(h.bulan)) + '.</p></div>';
    return;
  }

  kotak.innerHTML = h.jurnal.map(function(k, i){
    const n = k.tunai + k.bank;
    let nominal, kelas, cara;
    if (k.pos === 'MUTASI'){
      nominal = kpRp(Math.abs(k.tunai)); kelas = ''; cara = k.tunai > 0 ? 'Bank → Tunai' : 'Tunai → Bank';
    } else {
      if (n >= 0) masuk += n; else keluar += -n;
      nominal = (n >= 0 ? '+' : '−') + kpRp(Math.abs(n));
      kelas = n >= 0 ? 'kp-plus' : 'kp-minus';
      cara = k.tunai !== 0 ? 'Tunai' : 'Bank';
    }
    const meta = [kpTgl(k.tgl), k.pos, k.kategori, cara].filter(Boolean).join(' · ');
    const buang = Kp.kelola
      ? '<button class="kp-buang" onclick="hapusTrxKp(' + i + ')" aria-label="Hapus"><svg class="ic"><use href="#i-hapus"/></svg></button>'
      : '';
    return '<div class="kp-trx"><div class="atas"><b>' + kpAman(k.uraian || k.kategori || '-') + '</b>' +
      '<span class="' + kelas + '">' + nominal + '</span></div>' +
      '<div class="bawah"><div class="meta">' + kpAman(meta) + '</div>' + buang + '</div></div>';
  }).join('');
  kpTeks('kpMasuk', kpRp(masuk));
  kpTeks('kpKeluar', kpRp(keluar));
}

async function hapusTrxKp(i){
  const k = Kp.data.jurnal[i];
  if (!k || Kp.sibuk) return;
  const n = Math.abs(k.pos === 'MUTASI' ? k.tunai : k.tunai + k.bank);
  const tambahan = k.pos === 'IURAN' ? '\n\nRincian bulan iurannya ikut terhapus. Struk WA yang sudah terkirim tidak bisa ditarik.' : '';
  if (!confirm('Hapus transaksi ini?\n\n' + (k.uraian || k.kategori) + '\n' + kpRp(n) + tambahan)) return;

  Kp.sibuk = true;
  tunggu('Menghapus…', k.uraian || k.kategori);
  try {
    const h = await panggilAPI('hapusKasPKK', k.id);
    selesaiTunggu();
    toast(h.message || 'Dihapus');
    await muatKeuPKK();
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Kp.sibuk = false;
  }
}

/* ---------- CATAT: UMUM ---------- */
function bukaCatatKp(){
  if (!Kp.data) return toast('Tunggu data selesai dimuat.');
  Kp.catat = { tab: Kp.catat.tab || 'iuran', metode: 'Tunai', pilih: {}, cari: '' };
  Kp.lain = { jenis: 'Masuk', metode: 'Tunai' };
  document.getElementById('kcTanggal').value = kpHariIni();
  document.getElementById('kcTanggal').max = kpHariIni();
  document.getElementById('kbStruk').checked = true;
  document.querySelector('#kcPanelIuran .kp-cari').value = '';
  document.getElementById('ktNominal').value = '';
  document.getElementById('ktUraian').value = '';
  kpIsiPil('kbMetode', ['Tunai', 'Bank'], 'Tunai', function(v){ Kp.catat.metode = v; });
  kpIsiPil('ktJenis', ['Masuk', 'Keluar', 'Mutasi'], 'Masuk', function(v){ Kp.lain.jenis = v; siapkanLain(); });
  kpIsiPil('ktMetode', ['Tunai', 'Bank'], 'Tunai', function(v){ Kp.lain.metode = v; });
  siapkanLain();
  gambarDaftarBayar();
  pilihTabCatat(Kp.catat.tab);
  bukaLembar('lembarCatatKp');
}

function pilihTabCatat(t){
  Kp.catat.tab = t;
  document.getElementById('kcTabIuran').classList.toggle('on', t === 'iuran');
  document.getElementById('kcTabLain').classList.toggle('on', t === 'lain');
  document.getElementById('kcPanelIuran').classList.toggle('kp-sembunyi', t !== 'iuran');
  document.getElementById('kcPanelLain').classList.toggle('kp-sembunyi', t !== 'lain');
  document.getElementById('kcGalat').textContent = '';
  perbaruiTombolCatat();
}

function perbaruiTombolCatat(){
  const b = document.getElementById('kcSimpan');
  if (Kp.catat.tab === 'lain'){ b.textContent = 'Simpan Transaksi'; b.disabled = false; return; }
  const r = kpRingkasPilihan();
  b.disabled = !r.orang;
  b.textContent = r.orang ? 'Simpan ' + r.orang + ' anggota · ' + kpRp(r.total) : 'Pilih anggota dulu';
}

async function simpanCatatKp(){
  if (Kp.sibuk) return;
  const galat = document.getElementById('kcGalat');
  galat.textContent = '';
  const tanggal = document.getElementById('kcTanggal').value;
  if (!tanggal) return (galat.textContent = 'Tanggal wajib diisi.');

  let aksi, data, judul;
  if (Kp.catat.tab === 'iuran'){
    const item = Object.keys(Kp.catat.pilih).filter(function(id){ return Kp.catat.pilih[id] > 0; })
      .map(function(id){ return { id: id, bulan: Kp.catat.pilih[id] }; });
    if (!item.length) return (galat.textContent = 'Pilih minimal satu anggota.');
    aksi = 'bayarIuranPKK'; judul = 'Mencatat iuran…';
    data = { tanggal: tanggal, metode: Kp.catat.metode, item: item, struk: document.getElementById('kbStruk').checked };
  } else {
    const nominal = Number(document.getElementById('ktNominal').value);
    if (!(nominal > 0)) return (galat.textContent = 'Nominal wajib diisi.');
    const uraian = document.getElementById('ktUraian').value.trim();
    if (Kp.lain.jenis === 'Keluar' && !uraian) return (galat.textContent = 'Uraian pengeluaran wajib diisi.');
    aksi = 'simpanKasPKK'; judul = 'Menyimpan transaksi…';
    data = { tanggal: tanggal, jenis: Kp.lain.jenis, kategori: document.getElementById('ktKategori').value,
             pos: document.getElementById('ktPos').value, metode: Kp.lain.metode, nominal: nominal, uraian: uraian };
  }

  Kp.sibuk = true;
  tunggu(judul, aksi === 'bayarIuranPKK' && data.struk ? 'Struk WA dikirim sesudah tersimpan' : '');
  try {
    const h = await panggilAPI(aksi, data);
    selesaiTunggu();
    let pesan = h.message || 'Tersimpan';
    if (h.struk) pesan += ' · struk WA ' + h.struk.terkirim + '/' + h.struk.dari;
    toast(pesan);
    tutupLembar('lembarCatatKp');
    await muatKeuPKK();
  } catch (e) {
    selesaiTunggu();
    galat.textContent = e.message;
  } finally {
    Kp.sibuk = false;
  }
}

/* ---------- CATAT: BAYAR IURAN ---------- */
function kpWajib(){ return Kp.data.anggota.filter(function(a){ return a.wajib; }); }

function kpTarifUntuk(p){
  let t = Kp.data.daftarTarif[0];
  Kp.data.daftarTarif.forEach(function(x){ if (x.mulai <= p) t = x; });
  return t.kas + t.sosial + t.konsumsi;
}

/** Sama dengan _periodeBayar di server: tunggakan tertua dulu, lalu ke depan. */
function kpPeriodeBayar(a, n){
  const hasil = [];
  let p = a.mulai;
  for (let i = 0; hasil.length < n && i < 600; i++){
    if (a.akhir && p > a.akhir) break;
    if (!a.bayar[p]) hasil.push(p);
    p = kpGeser(p, 1);
  }
  return hasil;
}

function kpRingkasPilihan(){
  let orang = 0, total = 0;
  kpWajib().forEach(function(a){
    const n = Kp.catat.pilih[a.id] || 0;
    if (!n) return;
    orang++;
    kpPeriodeBayar(a, n).forEach(function(p){ total += kpTarifUntuk(p); });
  });
  return { orang: orang, total: total };
}

function gambarDaftarBayar(){
  const kotak = document.getElementById('kbDaftar');
  const q = Kp.catat.cari.trim().toLowerCase();
  const list = kpWajib().filter(function(a){
    return !q || (a.rumah + ' ' + a.nama).toLowerCase().indexOf(q) !== -1;
  });
  if (!list.length){
    kotak.innerHTML = '<div style="padding:16px;font-size:.78rem;color:var(--muted);text-align:center;">' +
      (kpWajib().length ? 'Tidak ada yang cocok.' : 'Belum ada anggota wajib iuran.') + '</div>';
    perbaruiTombolCatat();
    return;
  }
  kotak.innerHTML = list.map(function(a){
    const n = Kp.catat.pilih[a.id] || 0;
    const status = kpStatusSingkat(a)[1];
    return '<div class="kb-baris' + (n ? ' on' : '') + '" id="kbB_' + a.id + '"><div class="isi">' +
      '<b>' + kpAman(a.nama) + '</b><small>' + kpAman('Rumah ' + a.rumah + ' · ' + status) + '</small>' +
      '<small class="pra" id="kbP_' + a.id + '">' + kpPratinjau(a, n) + '</small></div>' +
      '<div class="kb-step"><button type="button" onclick="ubahBulanKb(\'' + a.id + '\',-1)">−</button>' +
      '<span id="kbN_' + a.id + '">' + n + '</span>' +
      '<button type="button" onclick="ubahBulanKb(\'' + a.id + '\',1)">＋</button></div></div>';
  }).join('');
  perbaruiTombolCatat();
}

function kpPratinjau(a, n){
  if (!n) return '';
  const per = kpPeriodeBayar(a, n);
  let total = 0;
  per.forEach(function(p){ total += kpTarifUntuk(p); });
  const rentang = per.length === 1 ? kpPeriode(per[0], true)
                : kpPeriode(per[0], true) + ' – ' + kpPeriode(per[per.length - 1], true);
  return kpAman(rentang + ' · ' + kpRp(total));
}

function ubahBulanKb(id, d){
  const a = kpWajib().filter(function(x){ return x.id === id; })[0];
  if (!a) return;
  const n = Math.max(0, Math.min(12, (Kp.catat.pilih[id] || 0) + d));
  Kp.catat.pilih[id] = n;
  kpTeks('kbN_' + id, String(n));
  document.getElementById('kbP_' + id).innerHTML = kpPratinjau(a, n);
  document.getElementById('kbB_' + id).classList.toggle('on', n > 0);
  perbaruiTombolCatat();
}

/* ---------- CATAT: TRANSAKSI LAIN ---------- */
function siapkanLain(){
  const j = Kp.lain.jenis;
  const sel = document.getElementById('ktKategori');
  if (j === 'Masuk'){
    sel.innerHTML = KP_KATEGORI.Masuk.map(function(k){ return '<option value="' + k + '">' + k + '</option>'; }).join('');
  } else if (j === 'Keluar'){
    sel.innerHTML = Object.keys(KP_KATEGORI.Keluar).map(function(k){ return '<option value="' + k + '">' + k + '</option>'; }).join('');
  } else {
    sel.innerHTML = Object.keys(KP_KATEGORI.Mutasi).map(function(k){
      return '<option value="' + k + '">' + KP_KATEGORI.Mutasi[k] + '</option>';
    }).join('');
  }
  kpTeks('ktLabelKategori', j === 'Mutasi' ? 'Arah mutasi' : 'Kategori');
  kpTeks('ktLabelUraian', j === 'Keluar' ? 'Uraian (wajib)' : 'Uraian (boleh kosong)');
  document.getElementById('ktAreaPos').classList.toggle('kp-sembunyi', j !== 'Masuk');
  document.getElementById('ktAreaMetode').classList.toggle('kp-sembunyi', j === 'Mutasi');
  cekKategoriLain();
}

function cekKategoriLain(){
  const info = document.getElementById('ktInfoPos');
  if (Kp.lain.jenis !== 'Keluar'){ info.classList.add('kp-sembunyi'); return; }
  const pos = KP_KATEGORI.Keluar[document.getElementById('ktKategori').value];
  const sisa = Kp.data.ringkas.alokasi[pos.toLowerCase()];
  info.innerHTML = 'Diambil dari dana <b>' + KP_NAMA_POS[pos] + '</b> · sisa ' + kpRp(sisa);
  info.classList.remove('kp-sembunyi');
}

/* ---------- ALAT ---------- */
function kpIsiPil(id, daftar, awal, saatPilih){
  const box = document.getElementById(id);
  box.innerHTML = daftar.map(function(v){
    return '<button type="button" data-v="' + v + '"' + (v === awal ? ' class="on"' : '') + '>' + v + '</button>';
  }).join('');
  box.querySelectorAll('button').forEach(function(b){
    b.onclick = function(){
      box.querySelectorAll('button').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      saatPilih(b.getAttribute('data-v'));
    };
  });
}
function kpGeser(p, n){
  const t = Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1 + n;
  return Math.floor(t / 12) + '-' + ('0' + (t % 12 + 1)).slice(-2);
}
function kpHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function kpRp(n){
  n = Number(n) || 0;
  return (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
function kpPeriode(p, pendek){
  if (!p) return '-';
  const m = Number(p.slice(5, 7)) - 1;
  return (pendek ? KP_PENDEK[m] : KP_BULAN[m]) + ' ' + p.slice(0, 4);
}
function kpTgl(s){
  if (!s) return '-';
  const b = s.split('-');
  return Number(b[2]) + ' ' + KP_BULAN[Number(b[1]) - 1] + ' ' + b[0];
}
function kpTeks(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }
function kpAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}

/* =================================================================
   6C — LAPORAN & WA (PKK + Developer)
   ================================================================= */

async function laporanKp(){
  if (Kp.sibuk || !Kp.data) return;
  Kp.sibuk = true;
  tunggu('Membuat laporan PDF…', kpPeriode(Kp.bulan));
  try {
    const h = await panggilAPI('laporanKeuPKK', Kp.bulan);
    selesaiTunggu();
    kpUnduhPdf(h.pdf, h.nama);
    toast('Laporan ' + kpPeriode(Kp.bulan) + ' diunduh');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Kp.sibuk = false;
  }
}

async function kirimStatusKp(){
  const a = Kp.data && Kp.data.anggota[Kp.kartu];
  if (!a || Kp.sibuk) return;
  if (!confirm('Kirim status iuran via WA ke ' + a.nama + '?')) return;
  Kp.sibuk = true;
  tunggu('Mengirim WA…', a.nama);
  try {
    const h = await panggilAPI('kirimStatusPKK', a.id);
    selesaiTunggu();
    toast(h.message || 'Terkirim');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Kp.sibuk = false;
  }
}

async function tagihSemuaKp(){
  if (Kp.sibuk || !Kp.data) return;
  const n = Kp.data.anggota.filter(function(a){ return a.nunggak > 0; }).length;
  if (!n) return toast('Tidak ada anggota yang menunggak.');
  if (!confirm('Kirim tagihan WA ke ' + n + ' anggota yang menunggak?\n\nHanya bisa dilakukan sekali per jam.')) return;
  Kp.sibuk = true;
  tunggu('Mengirim tagihan…', n + ' anggota · mohon tunggu, jangan tutup aplikasi');
  try {
    const h = await panggilAPI('tagihPKK');
    selesaiTunggu();
    toast(h.message || 'Selesai');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Kp.sibuk = false;
  }
}

/** Unduh langsung lewat <a download> (window.open sering diblokir browser HP). */
function kpUnduhPdf(base64, namaBerkas){
  const biner = atob(base64);
  const angka = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) angka[i] = biner.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([angka], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}