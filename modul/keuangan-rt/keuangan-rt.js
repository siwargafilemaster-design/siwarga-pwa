/* =================================================================
   MODUL KEUANGAN RT — baca + tulis
   ================================================================= */

const Keu = {
  summary: null,
  rumah: [],
  terpilih: null,
  jurnal: null,
  tab: 'buku',
  formDimuat: false,
  mode: 'CREATE',
  rowId: null,
  tertunda: null          // transaksi yang menunggu konfirmasi satpam
};

const OPSI_B1 = ['Pemasukan: Hibah','Pemasukan: Dana Bantuan','Pemasukan: Lainnya',
  'Pengeluaran: Infrastruktur','Pengeluaran: Konsumsi Rapat/Kegiatan',
  'Pengeluaran: ATK & Fotokopi','Pengeluaran: Dana Sosial Keluar',
  'Pengeluaran: Lainnya (Kas RT)','Internal: Setor Tunai ke Bank (B1)',
  'Internal: Tarik Tunai dari Bank (B1)','Transfer Internal: Kas B1 ke Jimpitan B2'];

const OPSI_B2 = ['Pemasukan: Jimpitan (Lainnya)','Pengeluaran: Lampu Jalan',
  'Pengeluaran: Perawatan CCTV','Pengeluaran: Token Listrik Fasum',
  'Pengeluaran: Lainnya (Jimpitan)','Internal: Setor Tunai ke Bank (B2)',
  'Internal: Tarik Tunai dari Bank (B2)','Transfer Internal: Jimpitan B2 ke Kas B1'];

const OPSI_WARGA = ['Pembayaran Iuran'];

const BENDAHARA = ['Bendahara 1 (Kas RT)', 'Bendahara 2 (Jimpitan)'];

function bolehCatat(){
  return ['DEVELOPER','BENDAHARA'].indexOf(App.peran) !== -1;
}

/* ---------- MULAI ---------- */
async function init_keuangan_rt(){
  // HTML halaman diambil baru tiap kunjungan, jadi keadaan lama dibuang
  Keu.formDimuat = false;
  Keu.terpilih   = null;
  Keu.jurnal     = null;
  Keu.tab        = 'buku';
  Keu.tertunda   = null;
  pasangPencarian();

  const bolehAksi = bolehCatat() ||
                    ['DEVELOPER','RT','SEKRETARIS'].indexOf(App.peran) !== -1;

  if (bolehCatat()) document.getElementById('btnCatat').classList.remove('sembunyi');
  if (bolehAksi){
    document.getElementById('btnAksiKeu').classList.remove('sembunyi');
    muatSkripAksi();
  }

  const lama = ambilIngatan('keuangan');
  if (lama){
    Keu.summary = lama.summary;
    Keu.rumah   = lama.rumah || [];
    gambarSaldo(Keu.summary);
    gambarDaftarRumah();
  }

  try {
    const d = await panggilAPI('keuanganAwal');
    Keu.summary = d.summary;
    Keu.rumah   = d.rumah || [];
    simpanIngatan('keuangan', d);
    gambarSaldo(Keu.summary);
    gambarDaftarRumah();
  } catch (e) {
    if (!lama){
      document.getElementById('keuSub').textContent = 'Gagal memuat';
      document.getElementById('hasilBuku').innerHTML =
        '<div class="kosong"><h2>Gagal memuat data</h2><p>' + aman(e.message) + '</p></div>';
    }
  }
}

/* ---------- TAB ---------- */
function gantiTab(nama){
  Keu.tab = nama;
  document.getElementById('tabBuku').classList.toggle('on', nama === 'buku');
  document.getElementById('tabJurnal').classList.toggle('on', nama === 'jurnal');
  document.getElementById('viewBuku').classList.toggle('sembunyi', nama !== 'buku');
  document.getElementById('viewJurnal').classList.toggle('sembunyi', nama !== 'jurnal');

  if (nama === 'jurnal' && !Keu.jurnal) muatJurnal();
}

/* ---------- SALDO ---------- */
function gambarSaldo(s){
  if (!s) return;
  document.getElementById('keuTotal').textContent   = rupiah(s.total);
  document.getElementById('keuTunai').textContent   = rupiah(s.tunai);
  document.getElementById('keuBank').textContent    = rupiah(s.bank);
  document.getElementById('keuB1').textContent      = rupiah(s.b1_total);
  document.getElementById('keuB2').textContent      = rupiah(s.b2_total);
  document.getElementById('keuTitipan').textContent = rupiah(s.titipan);
  document.getElementById('keuSub').textContent     = 'Total kas ' + rupiah(s.total);

  const n = new Date();
  document.getElementById('keuUpdate').textContent =
    'Diperbarui ' + String(n.getHours()).padStart(2,'0') + ':' +
    String(n.getMinutes()).padStart(2,'0');
}

async function segarkanSaldo(){
  try {
    const d = await panggilAPI('keuanganAwal');
    Keu.summary = d.summary;
    Keu.rumah   = d.rumah || [];
    simpanIngatan('keuangan', d);
    gambarSaldo(Keu.summary);
  } catch (e) {}
}

/* ---------- DAFTAR RUMAH ---------- */
function gambarDaftarRumah(saring){
  const kotak = document.getElementById('rumahGrid');
  if (!kotak) return;

  let daftar = Keu.rumah;
  if (saring){
    const q = saring.trim().toUpperCase();
    daftar = daftar.filter(function(r){ return String(r).toUpperCase().indexOf(q) !== -1; });
  }

  const dipotong = !saring && daftar.length > 24;
  if (dipotong) daftar = daftar.slice(0, 24);

  if (!daftar.length){
    kotak.innerHTML = '<div style="font-size:.78rem;color:var(--muted);padding:8px 2px;">Tidak ada rumah yang cocok.</div>';
    return;
  }

  kotak.innerHTML = daftar.map(function(r){
    const aktif = (r === Keu.terpilih) ? ' on' : '';
    return '<button class="rumah-pil' + aktif + '" onclick="pilihRumah(\'' +
           String(r).replace(/'/g, "\\'") + '\')">' + aman(r) + '</button>';
  }).join('') + (dipotong
    ? '<div style="font-size:.7rem;color:var(--muted);width:100%;padding:6px 2px;">…dan ' +
      (Keu.rumah.length - 24) + ' lagi. Ketik di kotak pencarian.</div>'
    : '');
}

function pasangPencarian(){
  const input = document.getElementById('cariRumah');
  if (input) input.addEventListener('input', function(){ gambarDaftarRumah(this.value); });
}

/* ---------- BUKU BESAR ---------- */
async function pilihRumah(no){
  Keu.terpilih = no;
  gambarDaftarRumah(document.getElementById('cariRumah').value);

  const kotak = document.getElementById('hasilBuku');
  kotak.innerHTML = '<div class="memuat">Menyiapkan kartu tagihan…</div>';

  try {
    const d = await panggilAPI('getBukuBesar', no);
    if (!d || d.status === 'error'){
      kotak.innerHTML = '<div class="kosong"><h2>Gagal</h2><p>' +
                        aman(d && d.message ? d.message : 'Data tidak terbaca.') + '</p></div>';
      return;
    }
    gambarBukuBesar(d, no);
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + aman(e.message) + '</p></div>';
  }
}

function gambarBukuBesar(d, no){
  const kotak = document.getElementById('hasilBuku');
  let html = '<div class="sec-head" style="margin-top:4px;"><h3>Rumah ' + aman(no) + '</h3></div>';

  const saldo = (d.info && d.info.saldo) ? d.info.saldo : 0;
  html += '<div class="keu-saldo-titipan"><span>Saldo titipan rumah</span><b>' + rupiah(saldo) + '</b></div>';

  if (!d.cards || !d.cards.length){
    kotak.innerHTML = html + '<div class="kosong"><h2>Belum ada data</h2><p>Rumah ini belum punya kartu tagihan.</p></div>';
    return;
  }

  d.cards.forEach(function(c){
    let gaya = 'pemilik';
    if (c.type === 'ACTIVE') gaya = 'aktif';
    else if (c.type === 'PAST') gaya = 'lama';

    let label = '';
    if (c.statusDetail) label += '<span class="kw-label">' + aman(c.statusDetail) + '</span>';
    label += '<span class="kw-label">' + aman(c.statusLabel || '') + '</span>';

    let baris;
    if (c.rows && c.rows.length){
      baris = c.rows.map(function(h){
        return '<tr><td style="font-weight:600;white-space:nowrap;">' + aman(h.bulan) + '</td>' +
               '<td class="num">' + aman(h.tagihan) + '</td>' +
               '<td><span class="st ' + kelasStatus(h.status) + '">' + aman(h.status) + '</span></td>' +
               '<td class="num" style="color:var(--muted);font-size:.72rem;">' + aman(h.tglBayar || '-') + '</td></tr>';
      }).join('');
    } else {
      baris = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">Tidak ada tagihan pada periode ini.</td></tr>';
    }

    // Tombol kirim tagihan — hanya untuk pengurus keuangan
    let tombolKirim = '';
    if (bolehCatat()){
      const lingkup = (c.type === 'PAST') ? 'PAST' : 'CURRENT';
      const perlu = (c.type !== 'PAST') || (c.totalHutang > 0);
      if (perlu){
        tombolKirim =
          '<div class="kw-kirim"><button onclick="kirimTagihanSatu(\'' +
            String(no).replace(/'/g, "\\'") + '\',\'' + lingkup + '\',this)">' +
            '<svg class="ic ic-sm"><use href="#i-wa"/></svg>' +
            (c.type === 'PAST' ? 'Tagih Hutang Lama' : 'Kirim Tagihan') +
          '</button></div>';
      }
    }

    html +=
      '<div class="kartu-warga">' +
        '<div class="kw-atas ' + gaya + '">' +
          '<div class="kw-nama">' + aman(c.nama) + '</div>' +
          '<div>' + label + '</div>' +
          '<div class="kw-hutang"><small>Tunggakan</small><b>' + rupiah(c.totalHutang) + '</b></div>' +
        '</div>' +
        '<div class="kw-gulir"><table class="kw-tabel">' +
          '<thead><tr><th>Bulan</th><th class="num">Tagihan</th><th>Status</th><th class="num">Bayar</th></tr></thead>' +
          '<tbody>' + baris + '</tbody>' +
        '</table></div>' +
      '</table></div>' + tombolKirim +
      '</div>';
      '</div>';
  });

  kotak.innerHTML = html;
}

/* ---------- JURNAL ---------- */
async function muatJurnal(){
  const kotak = document.getElementById('kotakJurnal');
  kotak.innerHTML = '<div class="memuat">Memuat jurnal…</div>';

  try {
    const d = await panggilAPI('getJurnal');
    Keu.jurnal = (d && d.data) ? d.data : [];
    gambarJurnal();
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + aman(e.message) + '</p></div>';
  }
}

function gambarJurnal(){
  const kotak = document.getElementById('kotakJurnal');

  if (!Keu.jurnal || !Keu.jurnal.length){
    kotak.innerHTML = '<div class="kosong"><h2>Jurnal kosong</h2><p>Belum ada transaksi tercatat.</p></div>';
    return;
  }

  kotak.innerHTML = Keu.jurnal.map(function(d, i){
    const masuk = (d.tipe === 'MASUK');

    const aksi = bolehCatat()
      ? '<div class="jur-aksi">' +
          '<button class="ubah" onclick="bukaFormTransaksi(\'EDIT\',' + i + ')">' +
            '<svg class="ic" style="width:13px;height:13px"><use href="#i-pensil"/></svg></button>' +
          '<button class="buang" onclick="hapusTransaksi(' + i + ')">' +
            '<svg class="ic" style="width:13px;height:13px"><use href="#i-hapus"/></svg></button>' +
        '</div>'
      : '';

    return '<div class="jur">' +
      '<div class="jur-ic ' + (masuk ? 'masuk' : 'keluar') + '">' +
        '<svg class="ic ic-sm"><use href="#' + (masuk ? 'i-plus' : 'i-tutup') + '"/></svg></div>' +
      '<div class="jur-isi"><b>' + aman(d.ket) + '</b>' +
        '<small>' + aman(d.tgl) + ' · ' + aman(d.sumber) + ' · ' + aman(d.metode) + '</small></div>' +
      '<div class="jur-kanan"><b class="' + (masuk ? 'masuk' : 'keluar') + '">' +
        (masuk ? '+' : '−') + aman(d.nominal) + '</b>' + aksi + '</div>' +
    '</div>';
  }).join('');
}

/* =================================================================
   FORM TRANSAKSI
   Pola baru: markup di-fetch dari file, logikanya ada di sini.
   ================================================================= */

async function bukaFormTransaksi(mode, indeks){
  Keu.mode  = mode;
  Keu.rowId = null;

  document.getElementById('trxJudul').textContent =
    (mode === 'EDIT') ? 'Ubah Transaksi' : 'Catat Transaksi';

  bukaLembar('lembarTrx');

  // Ambil markup form sekali saja, lalu simpan di DOM
  if (!Keu.formDimuat){
    try {
      const html = await fetch('/modul/keuangan-rt/form-transaksi.html')
                          .then(function(r){ return r.text(); });
      document.getElementById('isiFormTrx').innerHTML = html;
      Keu.formDimuat = true;
      pasangPendengarForm();
    } catch (e) {
      document.getElementById('isiFormTrx').innerHTML =
        '<div class="kosong"><p>Gagal memuat form.</p></div>';
      return;
    }
  }

  isiDatalistSumber();
  resetForm();

  if (mode === 'EDIT' && typeof indeks === 'number'){
    isiFormDariJurnal(Keu.jurnal[indeks]);
  }
}

function pasangPendengarForm(){
  const sumber = document.getElementById('trxSumber');
  const ket    = document.getElementById('trxKet');
  const nominal= document.getElementById('trxNominal');

  if (sumber) sumber.addEventListener('input',  perbaruiOpsiKeterangan);
  if (sumber) sumber.addEventListener('change', perbaruiOpsiKeterangan);
  if (ket)    ket.addEventListener('change',    cekRincianTambahan);
  if (nominal) nominal.addEventListener('input', function(){
    const angka = this.value.replace(/[^0-9]/g, '');
    this.value = angka ? Number(angka).toLocaleString('id-ID') : '';
  });
}

function isiDatalistSumber(){
  const dl = document.getElementById('dlSumber');
  if (!dl) return;
  dl.innerHTML = BENDAHARA.concat(Keu.rumah).map(function(v){
    return '<option value="' + aman(v) + '"></option>';
  }).join('');
}

function resetForm(){
  const n = new Date();
  document.getElementById('trxTgl').value =
    n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' +
    String(n.getDate()).padStart(2,'0');

  document.getElementById('trxMetode').value = 'Cash';
  document.getElementById('trxSumber').value = '';
  document.getElementById('trxNominal').value = '';
  document.getElementById('trxExtra').value = '';
  document.getElementById('trxExtraBox').classList.add('sembunyi');
  document.getElementById('trxGalat').classList.remove('on');
  perbaruiOpsiKeterangan();
}

function perbaruiOpsiKeterangan(){
  const nilai = String(document.getElementById('trxSumber').value || '').toUpperCase();
  const pilih = document.getElementById('trxKet');
  if (!pilih) return;

  let opsi = [];
  if (nilai.indexOf('BENDAHARA 1') !== -1 || nilai.indexOf('KAS RT') !== -1)        opsi = OPSI_B1;
  else if (nilai.indexOf('BENDAHARA 2') !== -1 || nilai.indexOf('JIMPITAN') !== -1) opsi = OPSI_B2;
  else if (nilai.trim() !== '')                                                      opsi = OPSI_WARGA;

  if (!opsi.length){
    pilih.innerHTML = '<option value="">— pilih sumber dulu —</option>';
    return;
  }

  pilih.innerHTML = '<option value="">— pilih keterangan —</option>' +
    opsi.map(function(t){ return '<option value="' + aman(t) + '">' + aman(t) + '</option>'; }).join('');

  cekRincianTambahan();
}

function cekRincianTambahan(){
  const ket = document.getElementById('trxKet').value;
  document.getElementById('trxExtraBox')
          .classList.toggle('sembunyi', ket.indexOf('Lainnya') === -1);
}

function isiFormDariJurnal(d){
  if (!d) return;
  Keu.rowId = d.rowId;

  document.getElementById('trxTgl').value    = d.rawTglISO || '';
  document.getElementById('trxMetode').value = d.rawMetode || 'Cash';
  document.getElementById('trxSumber').value = d.sumber || '';
  perbaruiOpsiKeterangan();

  const nom = Number(d.rawNominal) || 0;
  document.getElementById('trxNominal').value = nom ? nom.toLocaleString('id-ID') : '';

  // Keterangan asli bisa mengandung " - rincian"
  const pisah = String(d.ket || '').split(' - ');
  const pilih = document.getElementById('trxKet');
  pilih.value = pisah[0];
  if (pisah.length > 1){
    document.getElementById('trxExtraBox').classList.remove('sembunyi');
    document.getElementById('trxExtra').value = pisah.slice(1).join(' - ');
  }
}

function rakitFormTransaksi(){
  const tgl    = document.getElementById('trxTgl').value;
  const sumber = document.getElementById('trxSumber').value.trim();
  const nominal= document.getElementById('trxNominal').value.replace(/[^0-9]/g, '');
  const metode = document.getElementById('trxMetode').value;
  const ket    = document.getElementById('trxKet').value;
  const extra  = document.getElementById('trxExtra').value.trim();

  if (!tgl)     return { galat: 'Tanggal belum diisi.' };
  if (!sumber)  return { galat: 'Sumber / tujuan belum diisi.' };
  if (!nominal || Number(nominal) <= 0) return { galat: 'Nominal belum diisi.' };
  if (!ket)     return { galat: 'Keterangan belum dipilih.' };
  if (ket.indexOf('Lainnya') !== -1 && !extra) return { galat: 'Rincian tambahan wajib diisi.' };

  const ketFinal = extra ? (ket + ' - ' + extra) : ket;

  return {
    form: {
      rowId: Keu.rowId,
      tgl: tgl,
      sumber: sumber,
      nominal: nominal,
      metode: metode,
      keterangan: ketFinal,
      tipe: (ketFinal.indexOf('Pemasukan') !== -1 || ketFinal.indexOf('Iuran') !== -1) ? 'MASUK' : 'KELUAR'
    }
  };
}

async function simpanTransaksi(){
  const galat = document.getElementById('trxGalat');
  const hasil = rakitFormTransaksi();

  if (hasil.galat){
    galat.textContent = hasil.galat;
    galat.classList.add('on');
    return;
  }
  galat.classList.remove('on');

  // Satpam hanya untuk transaksi baru
  if (Keu.mode === 'CREATE'){
    const tombol = document.getElementById('btnSimpanTrx');
    tombol.disabled = true; tombol.textContent = 'Memeriksa…';

    try {
      const cek = await panggilAPI('cekAmanTransaksi', hasil.form.sumber, hasil.form.nominal);
      tombol.disabled = false; tombol.textContent = 'Simpan';

      if (cek && cek.status !== 'safe'){
        Keu.tertunda = hasil.form;
        document.getElementById('isiPeringatan').innerHTML = cek.message || 'Periksa kembali data ini.';
        bukaLembar('lembarPeringatan');
        return;
      }
    } catch (e) {
      tombol.disabled = false; tombol.textContent = 'Simpan';
      // Satpam gagal bukan alasan membatalkan — lanjut saja
    }
  }

  kirimTransaksi(hasil.form);
}

function lanjutkanSimpan(){
  tutupLembar('lembarPeringatan');
  if (Keu.tertunda){
    const f = Keu.tertunda;
    Keu.tertunda = null;
    kirimTransaksi(f);
  }
}

async function kirimTransaksi(form){
  const tombol = document.getElementById('btnSimpanTrx');
  tombol.disabled = true; tombol.textContent = 'Menyimpan…';

  try {
    const r = await panggilAPI('simpanTransaksi', Keu.mode, form);

    tutupLembar('lembarTrx');
    toast(r && r.message ? r.message : 'Transaksi tersimpan');

    Keu.jurnal = null;
    await segarkanSaldo();
    if (Keu.tab === 'jurnal') muatJurnal();

    // Segarkan kartu rumah yang bersangkutan (perbaikan bug B-7)
    if (form.sumber && form.sumber.indexOf('Bendahara') !== 0){
      if (Keu.terpilih === form.sumber) pilihRumah(form.sumber);
    }

  } catch (e) {
    const galat = document.getElementById('trxGalat');
    galat.textContent = e.message;
    galat.classList.add('on');
  } finally {
    tombol.disabled = false; tombol.textContent = 'Simpan';
  }
}

async function hapusTransaksi(indeks){
  const d = Keu.jurnal[indeks];
  if (!d) return;

  if (!confirm('Hapus transaksi ini?\n\n' + d.ket + '\n' + d.nominal +
               '\n\nSaldo ' + d.sumber + ' akan dihitung ulang.')) return;

  try {
    await panggilAPI('simpanTransaksi', 'DELETE', {
      rowId: d.rowId, sumber: d.sumber, nominal: 0
    });

    toast('Transaksi dihapus');
    Keu.jurnal = null;
    await segarkanSaldo();
    muatJurnal();

    if (Keu.terpilih === d.sumber) pilihRumah(d.sumber);

  } catch (e) {
    toast('Gagal: ' + e.message);
  }
}

/* ---------- ALAT ---------- */
function bukaLembar(id){ document.getElementById(id).classList.add('on'); }
function tutupLembar(id){ document.getElementById(id).classList.remove('on'); }

function kelasStatus(s){
  const t = String(s || '').toUpperCase();
  if (t === 'LUNAS') return 'lunas';
  if (t === 'BELUM BAYAR') return 'belum';
  return 'tidak';
}

function rupiah(n){
  if (!n) return 'Rp 0';
  if (typeof n === 'string' && n.indexOf('Rp') !== -1) return n;
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function rupiahPendek(n){
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return 'Rp ' + (v/1000000).toFixed(1).replace('.', ',') + 'jt';
  if (Math.abs(v) >= 1000)    return 'Rp ' + Math.round(v/1000) + 'rb';
  return 'Rp ' + v.toLocaleString('id-ID');
}

function aman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}

function muatSkripAksi(){
  // Berkas dimuat sekali per sesi, tapi menu harus disaring ulang
  // setiap halaman dibuka, karena HTML-nya diambil baru tiap kunjungan.
  if (typeof siapkanMenuAksi === 'function'){
    siapkanMenuAksi();
    return;
  }
  if (window.__aksiKeuDimuat) return;   // masih proses memuat
  window.__aksiKeuDimuat = true;

  const s = document.createElement('script');
  s.src = '/modul/keuangan-rt/keuangan-aksi.js';
  s.onload = function(){ siapkanMenuAksi(); };
  document.body.appendChild(s);
}