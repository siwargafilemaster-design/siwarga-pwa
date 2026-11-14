/* =================================================================
   MODUL KEUANGAN PKK (Tahap 6A — baca)
   Satu panggilan: posisi kas, alokasi, kartu iuran, jurnal bulan.
   ================================================================= */

const Kp = { data: null, bulan: '', tab: 'anggota', filter: 'semua', cari: '', kartu: -1, tahun: 0, pilih: '' };

const KP_BULAN  = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                   'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KP_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

async function init_keuangan_pkk(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Kp.data = null; Kp.bulan = ''; Kp.tab = 'anggota'; Kp.filter = 'semua'; Kp.cari = '';
  Kp.kartu = -1; Kp.tahun = 0; Kp.pilih = '';
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
    kpRp(t.sosial) + ' · Konsumsi ' + kpRp(t.konsumsi) + '). Jatuh tempo tanggal 1.');

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
    let pil;
    if (a.nunggak > 0) pil = '<span class="kp-pil merah">Nunggak ' + a.nunggak + ' bln</span>';
    else if (a.mulai > Kp.data.kini) pil = '<span class="kp-pil">Mulai ' + kpPeriode(a.mulai, true) + '</span>';
    else pil = '<span class="kp-pil hijau">Lunas s.d. ' + kpPeriode(a.lunasSampai, true) + '</span>';
    const sub = 'Rumah ' + a.rumah + (a.wajib ? '' : ' · sudah tidak aktif');
    return '<button class="kp-orang" onclick="bukaKartuKp(' + i + ')"><div class="isi"><b>' + kpAman(a.nama) +
      '</b><small>' + kpAman(sub) + '</small></div>' + pil + '</button>';
  }).join('') + '</div>';
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
  } else if (a.mulai > Kp.data.kini){
    info += 'Belum ada tagihan. Iuran pertama jatuh tempo 1 ' + kpPeriode(a.mulai) + '.';
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
  return p <= Kp.data.kini ? 'nunggak' : 'belum';
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
  const st = kpStatus(a, p);
  const nama = kpPeriode(p);
  const teks = {
    lunas:   nama + ': dibayar pada ' + kpTgl(a.bayar[p]) + '.',
    nunggak: nama + ': belum dibayar (jatuh tempo 1 ' + nama + ').',
    belum:   nama + ': belum jatuh tempo.',
    luar:    nama + ': di luar masa keanggotaan.'
  }[st];
  kpTeks('kkDetail', teks);
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

  kotak.innerHTML = h.jurnal.map(function(k){
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
    return '<div class="kp-trx"><div class="atas"><b>' + kpAman(k.uraian || k.kategori || '-') + '</b>' +
      '<span class="' + kelas + '">' + nominal + '</span></div><div class="meta">' + kpAman(meta) + '</div></div>';
  }).join('');
  kpTeks('kpMasuk', kpRp(masuk));
  kpTeks('kpKeluar', kpRp(keluar));
}

/* ---------- ALAT ---------- */
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