/* =================================================================
   MODUL BANK PKK (Tahap 6D)
   Teller & Developer → layar teller. Lainnya → cek saldo (NIK + tgl lahir).
   ================================================================= */

const Tb = { mode: '', data: null, cari: '', aktif: -1, jenis: '', mutasi: [], sibuk: false, nik: '', lahir: '' };
const TB_PERAN = ['DEVELOPER', 'TELLER'];
const TB_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

async function init_tabungan(){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Tb.data = null; Tb.cari = ''; Tb.aktif = -1; Tb.jenis = ''; Tb.mutasi = [];
  Tb.sibuk = false; Tb.nik = ''; Tb.lahir = '';
  Tb.mode = TB_PERAN.indexOf(App.peran) !== -1 ? 'teller' : 'nasabah';
  document.getElementById('tbTeller').classList.toggle('tb-sembunyi', Tb.mode !== 'teller');
  document.getElementById('tbNasabah').classList.toggle('tb-sembunyi', Tb.mode !== 'nasabah');

  if (Tb.mode === 'teller'){
    tbTeks('tbSub', 'Layar Teller');
    await muatTellerTb();
  } else {
    tbTeks('tbSub', 'Cek saldo tabungan');
    document.getElementById('tbLahir').max = tbHariIni();
  }
}

function segarkanTb(){
  if (Tb.mode === 'teller') return muatTellerTb();
  if (Tb.nik) return masukTb(true);
}

/* ======================= TELLER ======================= */

async function muatTellerTb(){
  const kotak = document.getElementById('tbDaftar');
  if (!kotak) return;
  try {
    Tb.data = await panggilAPI('daftarNasabahTab');
    gambarTotalTb();
    gambarNasabahTb();
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + tbAman(e.message) + '</p></div>';
  }
}

function gambarTotalTb(){
  const d = Tb.data;
  const bersaldo = d.nasabah.filter(function(n){ return n.saldo > 0; }).length;
  tbTeks('tbTotal', tbRp(d.total));
  tbTeks('tbTotalKet', d.nasabah.length + ' nasabah · ' + bersaldo + ' bersaldo');
}

function gambarNasabahTb(){
  const kotak = document.getElementById('tbDaftar');
  if (!kotak || !Tb.data) return;
  const q = Tb.cari.trim().toLowerCase();
  const idx = [];
  Tb.data.nasabah.forEach(function(n, i){
    if (q && (n.nama + ' ' + n.rumah + ' ' + n.rekening).toLowerCase().indexOf(q) === -1) return;
    idx.push(i);
  });
  if (!idx.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada nasabah</h2><p>' +
      (Tb.data.nasabah.length ? 'Tidak ada yang cocok.' : 'Belum ada anggota PKK Aktif/Pasif di Database PKK.') + '</p></div>';
    return;
  }
  kotak.innerHTML = '<div class="tb-daftar">' + idx.map(function(i){
    const n = Tb.data.nasabah[i];
    const tag = n.boleh ? '' : '<span class="tb-tag">BUKAN ANGGOTA</span>';
    return '<button class="tb-orang" onclick="bukaNasabahTb(' + i + ')"><div class="isi"><b>' + tbAman(n.nama) + tag +
      '</b><small>' + tbAman(n.rekening + ' · Rumah ' + n.rumah) + '</small></div>' +
      '<span class="uang">' + tbRp(n.saldo) + '</span></button>';
  }).join('') + '</div>';
}

function bukaNasabahTb(i){
  const n = Tb.data.nasabah[i];
  if (!n) return;
  Tb.aktif = i;
  tbTeks('tnJudul', n.nama);
  tbIsiKartuTeller();
  document.getElementById('tnTombolSetor').disabled = !n.boleh;
  tutupFormTb();
  document.getElementById('tnBadan').scrollTop = 0;
  bukaLembar('lembarNasabahTb');
  muatMutasiTb();
}

function tbIsiKartuTeller(){
  const n = Tb.data.nasabah[Tb.aktif];
  tbTeks('tnRumah', 'Rumah ' + n.rumah + (n.adaHp ? '' : ' · tanpa nomor HP'));
  tbTeks('tnRek', n.rekening);
  tbTeks('tnSaldo', tbRp(n.saldo));
  tbTeks('tnKet', n.boleh ? 'Saldo terkini' : 'Bukan anggota PKK lagi: hanya bisa tarik');
}

async function muatMutasiTb(){
  const n = Tb.data.nasabah[Tb.aktif];
  const kotak = document.getElementById('tnMutasi');
  kotak.innerHTML = '<div class="memuat">Memuat…</div>';
  try {
    const h = await panggilAPI('mutasiTab', n.id);
    Tb.mutasi = h.mutasi;
    kotak.innerHTML = tbDaftarMutasi(h.mutasi, true);
  } catch (e) {
    kotak.innerHTML = '<div class="tb-galat">' + tbAman(e.message) + '</div>';
  }
}

function bukaFormTb(jenis){
  const n = Tb.data.nasabah[Tb.aktif];
  if (jenis === 'SETOR' && !n.boleh) return toast('Setoran baru hanya untuk anggota PKK Aktif/Pasif.');
  Tb.jenis = jenis;
  tbTeks('tnFormJudul', jenis === 'SETOR' ? 'Setor tunai' : 'Tarik tunai · saldo ' + tbRp(n.saldo));
  document.getElementById('tnNominal').value = '';
  document.getElementById('tnKetInput').value = '';
  document.getElementById('tnStruk').checked = true;
  tbTeks('tnGalat', '');
  document.getElementById('tnSimpan').textContent = jenis === 'SETOR' ? 'Simpan Setoran' : 'Simpan Penarikan';
  document.getElementById('tnForm').classList.remove('tb-sembunyi');
  document.getElementById('tnNominal').focus();
}

function tutupFormTb(){
  Tb.jenis = '';
  document.getElementById('tnForm').classList.add('tb-sembunyi');
}

function isiCepatTb(v){ document.getElementById('tnNominal').value = v; }

async function simpanTrxTb(){
  if (Tb.sibuk || !Tb.jenis) return;
  const n = Tb.data.nasabah[Tb.aktif];
  const nominal = Number(document.getElementById('tnNominal').value);
  tbTeks('tnGalat', '');
  if (!Number.isInteger(nominal) || nominal <= 0) return tbTeks('tnGalat', 'Isi nominal (angka bulat, tanpa titik).');
  if (Tb.jenis === 'TARIK' && nominal > n.saldo) return tbTeks('tnGalat', 'Saldo tidak cukup (' + tbRp(n.saldo) + ').');
  const kata = Tb.jenis === 'SETOR' ? 'Setor ' + tbRp(nominal) + ' ke ' : 'Tarik ' + tbRp(nominal) + ' dari ';
  if (!confirm(kata + n.nama + '?')) return;

  Tb.sibuk = true;
  tunggu('Menyimpan…', kata + n.nama);
  try {
    const h = await panggilAPI('transaksiTab', {
      id: n.id, jenis: Tb.jenis, nominal: nominal,
      ket: document.getElementById('tnKetInput').value.trim(),
      struk: document.getElementById('tnStruk').checked
    });
    selesaiTunggu();
    toast(h.message + tbTeksStruk(h.struk));
    tbPerbaruiSaldo(n, h.saldo);
    tutupFormTb();
    muatMutasiTb();
  } catch (e) {
    selesaiTunggu();
    tbTeks('tnGalat', e.message);
  } finally {
    Tb.sibuk = false;
  }
}

async function koreksiTb(i){
  const m = Tb.mutasi[i];
  const n = Tb.data.nasabah[Tb.aktif];
  if (!m || Tb.sibuk) return;
  const alasan = prompt('Batalkan ' + m.jenis.toLowerCase() + ' ' + tbRp(Math.abs(m.nominal)) + ' (' + m.waktu + ')?\n\n' +
                        'Tulis alasan koreksi:');
  if (alasan === null) return;
  if (alasan.trim().length < 3) return toast('Alasan koreksi wajib diisi.');

  Tb.sibuk = true;
  tunggu('Mencatat koreksi…', n.nama);
  try {
    const h = await panggilAPI('koreksiTab', { idTrx: m.id, alasan: alasan.trim(), struk: true });
    selesaiTunggu();
    toast(h.message + tbTeksStruk(h.struk));
    tbPerbaruiSaldo(n, h.saldo);
    muatMutasiTb();
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Tb.sibuk = false;
  }
}

function tbPerbaruiSaldo(n, saldoBaru){
  Tb.data.total += saldoBaru - n.saldo;
  n.saldo = saldoBaru;
  tbIsiKartuTeller();
  gambarTotalTb();
  gambarNasabahTb();
}

function tbTeksStruk(s){
  return { 'terkirim': ' · struk WA terkirim', 'tanpa-hp': ' · tanpa nomor HP, struk tidak dikirim',
           'gagal': ' · struk WA gagal', 'nonaktif': ' · token WA PKK kosong' }[s] || '';
}

/* ======================= NASABAH ======================= */

async function masukTb(ulang){
  if (Tb.sibuk) return;
  const galat = document.getElementById('tbGalatMasuk');
  galat.textContent = '';
  if (!ulang){
    Tb.nik = document.getElementById('tbNik').value.replace(/\D/g, '');
    Tb.lahir = document.getElementById('tbLahir').value;
  }
  if (Tb.nik.length !== 16) return (galat.textContent = 'NIK harus 16 angka.');
  if (!Tb.lahir) return (galat.textContent = 'Isi tanggal lahir.');

  Tb.sibuk = true;
  tunggu('Membuka rekening…', '');
  try {
    const h = await panggilAPI('saldoTabungan', Tb.nik, Tb.lahir);
    selesaiTunggu();
    tbTeks('tbAkunNama', h.nama + ' · Rumah ' + h.rumah);
    tbTeks('tbAkunRek', h.rekening);
    tbTeks('tbAkunSaldo', tbRp(h.saldo));
    tbTeks('tbAkunKet', 'Saldo per ' + tbSekarang());
    document.getElementById('tbAkunMutasi').innerHTML = tbDaftarMutasi(h.mutasi, false);
    document.getElementById('tbMasuk').classList.add('tb-sembunyi');
    document.getElementById('tbAkun').classList.remove('tb-sembunyi');
  } catch (e) {
    selesaiTunggu();
    if (ulang) keluarTb();
    galat.textContent = e.message;
  } finally {
    Tb.sibuk = false;
  }
}

function keluarTb(){
  Tb.nik = ''; Tb.lahir = '';
  document.getElementById('tbNik').value = '';
  document.getElementById('tbLahir').value = '';
  document.getElementById('tbAkunMutasi').innerHTML = '';
  document.getElementById('tbAkun').classList.add('tb-sembunyi');
  document.getElementById('tbMasuk').classList.remove('tb-sembunyi');
}

/* ======================= BERSAMA ======================= */

function tbDaftarMutasi(list, bolehKoreksi){
  if (!list.length) return '<div class="kosong" style="padding:20px 0;"><p>Belum ada transaksi.</p></div>';
  return list.map(function(m, i){
    const plus = m.nominal >= 0;
    const judul = { SETOR: 'Setor', TARIK: 'Tarik', KOREKSI: 'Koreksi' }[m.jenis] || m.jenis;
    const sub = [m.waktu, m.petugas].filter(Boolean).join(' · ') + (m.ket ? '\n' + m.ket : '');
    const bisa = bolehKoreksi && !m.dikoreksi && (m.jenis === 'SETOR' || m.jenis === 'TARIK');
    return '<div class="tb-mut' + (m.dikoreksi ? ' tb-coret' : '') + '"><div class="isi"><b>' + judul +
      (m.dikoreksi ? ' (dibatalkan)' : '') + '</b><small>' + tbAman(sub).replace(/\n/g, '<br>') + '</small></div>' +
      '<div class="kanan"><span class="' + (plus ? 'tb-plus' : 'tb-minus') + '">' + (plus ? '+' : '−') +
      tbRp(Math.abs(m.nominal)) + '</span>' +
      (bisa ? '<button class="tb-koreksi" onclick="koreksiTb(' + i + ')">Koreksi</button>' : '') +
      '</div></div>';
  }).join('');
}

function tbRp(n){
  n = Number(n) || 0;
  return (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
function tbHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function tbSekarang(){
  const d = new Date();
  return d.getDate() + ' ' + TB_BULAN[d.getMonth()] + ' ' + d.getFullYear() + ', ' +
         ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function tbTeks(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }
function tbAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}