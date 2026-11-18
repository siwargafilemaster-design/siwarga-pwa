/* =================================================================
   MODUL ARISAN WARGA (Tahap 7E-1 · Fondasi)
   Tiga wajah: pengunjung (depan, peraturan, daftar), peserta (sesi NIK + tgl lahir),
   admin (ADMIN_ARISAN_RT / ADMIN_ARISAN_PKK / Developer).
   Token peserta disimpan TERPISAH dari token pengurus.
   ================================================================= */

const Ar = { depan: null, mode: '', kAturan: 'RT', aturanDari: 'depan', langkah: 1,
             daftar: {}, saya: null, kSaya: '', admin: null, kAdmin: '', tabAdmin: 'BARU', detail: null, sibuk: false };
const AR_TOKEN = 'siwarga_arisan_token';
const AR_ADMIN_PERAN = { ADMIN_ARISAN_RT: 'RT', ADMIN_ARISAN_PKK: 'PKK' };
const AR_CHIP = { DAFTAR: 'biru', MENUNGGU_DEPOSIT: '', AKTIF: 'hijau', ANTRE: 'biru', MINTA_KELUAR: '', KELUAR: 'abu', DITOLAK: 'merah', BLACKLIST: 'merah' };

async function init_arisan(){
  Ar.sibuk = false; Ar.detail = null;
  const aksi = App.aksi || '';
  if (AR_ADMIN_PERAN[App.peran]) {
    Ar.kAdmin = AR_ADMIN_PERAN[App.peran];
    if (aksi === 'aturan') { Ar.kAturan = Ar.kAdmin; Ar.aturanDari = 'admin'; arTampil('aturan'); return arMuatDepan(); }
    Ar.tabAdmin = aksi === 'peserta' ? 'SEMUA' : 'BARU';
    return arBukaAdmin(Ar.kAdmin);
  }
  if (aksi === 'aturan') { Ar.aturanDari = 'depan'; arTampil('aturan'); return arMuatDepan(); }
  if (localStorageAman(AR_TOKEN)) return arMuatSaya('');
  arTampil('depan');
  await arMuatDepan();
}

function localStorageAman(k, v){
  try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  catch (e) { return null; }
}

/** Panggil server dengan token PESERTA (bukan token pengurus). */
async function arPanggil(action, ...args){
  const res = await fetch(URL_API, { method: 'POST',
    body: JSON.stringify({ action: action, token: localStorageAman(AR_TOKEN), args: args }) });
  const json = await res.json();
  if (json.status === 'error') {
    if (/sesi/i.test(json.message || '')) localStorageAman(AR_TOKEN, null);
    throw new Error(json.message || 'Terjadi kesalahan.');
  }
  return json.data;
}

/* ---------- TAMPILAN ---------- */
function arTampil(mode){
  Ar.mode = mode;
  const peta = { depan: 'arDepan', aturan: 'arAturan', daftar: 'arDaftar', peserta: 'arPeserta', admin: 'arAdmin' };
  Object.keys(peta).forEach(function(m){ document.getElementById(peta[m]).classList.toggle('ar-sembunyi', m !== mode); });
  document.getElementById('ar').classList.toggle('ar-teal', mode === 'peserta');
  const kanan = document.getElementById('arTombolKanan');
  const ikon = { depan: '', aturan: 'i-chev', daftar: 'i-tutup', peserta: 'i-tutup', admin: 'i-book' }[mode];
  kanan.classList.toggle('ar-sembunyi', !ikon);
  if (ikon) document.getElementById('arIkonKanan').setAttribute('href', '#' + ikon);
  if (mode === 'aturan') arGambarAturan();
  window.scrollTo(0, 0);
}

function arAksiKanan(){
  if (Ar.mode === 'aturan' || Ar.mode === 'daftar') {
    if (Ar.mode === 'aturan' && Ar.aturanDari === 'peserta') return arTampil('peserta');
    if (Ar.mode === 'aturan' && Ar.aturanDari === 'admin') return arBukaAdmin(Ar.kAdmin);
    arTampil('depan'); return arMuatDepan();
  }
  if (Ar.mode === 'peserta') return arKeluarPeserta();
  if (Ar.mode === 'admin') { Ar.kAturan = Ar.kAdmin; Ar.aturanDari = 'admin'; arTampil('aturan'); if (!Ar.depan) arMuatDepan(); }
}

function arSub(t){ const el = document.getElementById('arSub'); if (el) el.textContent = t; }
function arJudul(t){ const el = document.getElementById('arJudul'); if (el) el.textContent = t; }

/* ---------- PENGUNJUNG ---------- */
async function arMuatDepan(){
  if (Ar.mode === 'depan') { arJudul('ARISAN WARGA'); arSub(Ar.depan ? Ar.depan.identitas.lingkungan : 'Memuat…'); }
  if (Ar.depan) arGambarDepan();
  try {
    Ar.depan = await panggilAPI('arisanDepan');
    if (!document.getElementById('ar')) return;
    arGambarDepan();
    if (Ar.mode === 'aturan') arGambarAturan();
  } catch (e) { toast(e.message); }
}

function arGambarDepan(){
  const d = Ar.depan;
  document.getElementById('arLingkungan').textContent = d.identitas.lingkungan.toUpperCase();
  if (Ar.mode === 'depan') arSub(d.identitas.lingkungan);
  if (d.pemenang && d.pemenang.length) {
    document.getElementById('arTicker').textContent = d.pemenang.map(function(p){ return '🏆 ' + p.nama + ' (' + p.kelompok + ', putaran ' + p.putaran + ')'; }).join('   •   ');
  }
  document.getElementById('arDevAdmin').classList.toggle('ar-sembunyi', App.peran !== 'DEVELOPER');
  document.getElementById('arKelompokDepan').innerHTML = d.kelompok.map(function(k){
    const per = k.periode ? arAman(k.periode.label) + ' · ' + arRp(k.periode.nominal) + '/bulan'
                          : 'Belum ada periode berjalan. Pendaftaran tetap dibuka.';
    return '<div class="ar-kartu"><div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<h3 style="margin:0;">' + arAman(k.label) + '</h3><span class="ar-chip">' + k.peserta + ' peserta aktif</span></div>' +
      '<p style="margin-top:6px;">' + per + '</p>' +
      '<div class="ar-dua"><button class="ar-btn ar-btn-garis" onclick="arBukaAturan(\'' + k.kode + '\')">Peraturan</button>' +
      '<button class="ar-btn ar-btn-emas" onclick="arMulaiDaftar(\'' + k.kode + '\')">Daftar</button></div></div>';
  }).join('');
}

function arBukaAturan(k){ Ar.kAturan = k; Ar.aturanDari = Ar.mode === 'peserta' ? 'peserta' : 'depan'; arTampil('aturan'); }

function arPilihAturan(k){ Ar.kAturan = k; arGambarAturan(); }

function arHtmlAturan(a){
  return '<div class="ar-aturan">' + a.bagian.map(function(b){
    return '<h4>' + arAman(b.judul.toUpperCase()) + '</h4><ol>' + b.butir.map(function(t){ return '<li>' + arAman(t) + '</li>'; }).join('') + '</ol>';
  }).join('') + '<p class="ar-ket" style="margin-top:12px;">Peraturan versi ' + arAman(a.versi) + '.</p></div>';
}

function arGambarAturan(){
  arJudul('PERATURAN ARISAN');
  arSub('Berlaku untuk seluruh peserta');
  document.querySelectorAll('#arSegAturan button').forEach(function(b){ b.classList.toggle('on', b.dataset.k === Ar.kAturan); });
  const wadah = document.getElementById('arIsiAturan');
  const k = Ar.depan && Ar.depan.kelompok.filter(function(x){ return x.kode === Ar.kAturan; })[0];
  const a = k ? k.aturan : (Ar.saya && Ar.saya.aturan.kelompok === Ar.kAturan ? Ar.saya.aturan : null);
  if (!a) { wadah.innerHTML = '<p class="ar-ket">Memuat…</p>'; return; }
  const adaAngka = /\d/.test(a.ringkas.nominal + a.ringkas.deposit);
  wadah.innerHTML = (adaAngka
    ? '<div class="ar-angka"><div><b style="font-size:.9rem;">' + arAman(a.ringkas.nominal) + '</b><small>IURAN / BULAN</small></div>' +
      '<div><b style="font-size:.9rem;">' + arAman(a.ringkas.deposit) + '</b><small>DEPOSIT</small></div></div>'
    : '<div class="ar-peringatan">Besar iuran dan deposit ditetapkan saat periode dibuka dan diumumkan Admin Arisan.</div>') +
    '<div class="ar-kartu">' + arHtmlAturan(a) + '</div>';
}

/* ---------- PENDAFTARAN ---------- */
function arMulaiDaftar(k){
  Ar.daftar = {};
  ['adNik', 'adTgl', 'adHp', 'adRumahPj'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('adSetuju').checked = false;
  document.getElementById('adCalon').innerHTML = '';
  Ar.langkah = 1;
  arJudul('DAFTAR ARISAN'); arSub('Pendaftaran peserta baru');
  arTampil('daftar');
  if (k) arDaftarKelompok(k); else arGambarLangkah();
}

function arDaftarKelompok(k){ Ar.daftar.kelompok = k; Ar.langkah = 2; arGambarLangkah(); }

function arGambarLangkah(){
  const n = Ar.langkah;
  [1, 2, 3, 4].forEach(function(i){ document.getElementById('adL' + i).classList.toggle('ar-sembunyi', i !== n); });
  document.getElementById('adLangkah').textContent = 'LANGKAH ' + n + ' DARI 4' + (Ar.daftar.kelompok ? ' · ARISAN ' + Ar.daftar.kelompok : '');
  document.getElementById('adLanjut').classList.toggle('ar-sembunyi', n === 1);
  document.getElementById('adLanjut').textContent = n === 4 ? 'Kirim pendaftaran' : 'Lanjut';
  document.getElementById('adKembali').textContent = n === 1 ? 'Batal' : 'Kembali';
  window.scrollTo(0, 0);
}

async function arLangkah(arah){
  if (Ar.sibuk) return;
  if (arah < 0) {
    if (Ar.langkah <= 1) { arTampil('depan'); return arMuatDepan(); }
    Ar.langkah--; return arGambarLangkah();
  }
  const d = Ar.daftar;
  if (Ar.langkah === 2) {
    d.nik = document.getElementById('adNik').value.replace(/\D/g, '');
    d.tgl = document.getElementById('adTgl').value;
    if (d.nik.length !== 16) return toast('NIK harus 16 angka.');
    if (!d.tgl) return toast('Isi tanggal lahir.');
    Ar.sibuk = true; tunggu('Mencocokkan data…');
    try {
      const h = await panggilAPI('arisanCekDaftar', { kelompok: d.kelompok, nik: d.nik, tglLahir: d.tgl });
      d.cek = h;
      document.getElementById('adHalo').textContent = 'Halo, ' + h.nama + ' (' + h.rumah + ')';
      document.getElementById('adHp').value = h.hp ? (h.hp.indexOf('62') === 0 ? '0' + h.hp.slice(2) : h.hp) : '';
      document.getElementById('adAreaPenjamin').classList.toggle('ar-sembunyi', !h.perluPenjamin);
      document.getElementById('adAturPj').textContent = d.kelompok === 'RT'
        ? 'harus pemilik rumah atau Kepala Keluarga yang tinggal di rumah milik sendiri'
        : 'harus pemilik rumah atau anggota PKK aktif/pasif';
      document.getElementById('adAturan').innerHTML = arHtmlAturan(h.aturan);
      document.getElementById('adKSetuju').textContent = d.kelompok;
      Ar.langkah = 3; arGambarLangkah();
    } catch (e) { toast(e.message); }
    finally { selesaiTunggu(); Ar.sibuk = false; }
    return;
  }
  if (Ar.langkah === 3) {
    d.hp = document.getElementById('adHp').value.replace(/\D/g, '');
    if (!/^(0|62)\d{8,13}$/.test(d.hp)) return toast('Nomor WhatsApp belum benar (awali 08).');
    if (d.cek.perluPenjamin) {
      const pilih = document.querySelector('input[name="adPj"]:checked');
      if (!pilih) return toast('Cari dan pilih penjamin dulu.');
      d.penjamin = pilih.value;
    }
    Ar.langkah = 4; return arGambarLangkah();
  }
  if (Ar.langkah === 4) {
    if (!document.getElementById('adSetuju').checked) return toast('Centang persetujuan peraturan dulu.');
    Ar.sibuk = true; tunggu('Mengirim pendaftaran…');
    try {
      const h = await panggilAPI('arisanDaftar', { kelompok: d.kelompok, nik: d.nik, tglLahir: d.tgl, hp: d.hp,
        rumahPenjamin: d.rumahPj || '', penjamin: d.penjamin || '', setuju: true });
      selesaiTunggu();
      toast(h.message);
      arTampil('depan'); arMuatDepan();
    } catch (e) { selesaiTunggu(); toast(e.message); }
    finally { Ar.sibuk = false; }
  }
}

async function arCariPenjamin(){
  const d = Ar.daftar;
  d.rumahPj = document.getElementById('adRumahPj').value.trim().toUpperCase();
  if (!d.rumahPj) return toast('Isi nomor rumah penjamin.');
  const w = document.getElementById('adCalon');
  w.innerHTML = '<p class="ar-ket">Mencari…</p>';
  try {
    const h = await panggilAPI('arisanCariPenjamin', { kelompok: d.kelompok, nik: d.nik, tglLahir: d.tgl, rumah: d.rumahPj });
    w.innerHTML = h.calon.length ? h.calon.map(function(c){
      return '<label class="ar-radio' + (c.penuh ? ' mati' : '') + '"><input type="radio" name="adPj" value="' + arAman(c.kode) + '"' +
        (c.penuh ? ' disabled' : '') + '><span><b>' + arAman(c.nama) + '</b><small>' + arAman(c.ket) +
        (c.penuh ? ' · sudah menjamin 2 peserta' : '') + '</small></span></label>';
    }).join('') : '<p class="ar-ket">Tidak ada calon penjamin yang memenuhi syarat di rumah ' + arAman(d.rumahPj) + '.</p>';
  } catch (e) { w.innerHTML = ''; toast(e.message); }
}

/* ---------- PESERTA ---------- */
function arBukaMasuk(){
  document.getElementById('amNik').value = '';
  document.getElementById('amTgl').value = '';
  bukaLembar('lembarMasukAr');
}

async function arMasuk(){
  if (Ar.sibuk) return;
  const nik = document.getElementById('amNik').value.replace(/\D/g, ''), tgl = document.getElementById('amTgl').value;
  if (nik.length !== 16 || !tgl) return toast('Isi NIK 16 angka dan tanggal lahir.');
  Ar.sibuk = true; tunggu('Memeriksa…');
  try {
    const h = await panggilAPI('arisanMasuk', { nik: nik, tglLahir: tgl });
    localStorageAman(AR_TOKEN, h.token);
    selesaiTunggu();
    tutupLembar('lembarMasukAr');
    await arMuatSaya(h.akun[0].kelompok);
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arMuatSaya(kelompok){
  arTampil('peserta');
  arJudul('ARISAN WARGA'); arSub(Ar.saya ? Ar.saya.saya.nama : 'Memuat…');
  if (Ar.saya && (!kelompok || Ar.saya.saya.kelompok === kelompok)) arGambarSaya();
  try {
    Ar.saya = await arPanggil('arisanSaya', { kelompok: kelompok || Ar.kSaya || '' });
    Ar.kSaya = Ar.saya.saya.kelompok;
    if (document.getElementById('ar')) arGambarSaya();
  } catch (e) {
    toast(e.message);
    if (!localStorageAman(AR_TOKEN)) { Ar.saya = null; arTampil('depan'); arMuatDepan(); }
  }
}

function arGambarSaya(){
  const h = Ar.saya, s = h.saya;
  arSub(s.nama + ' · Arisan ' + s.kelompok);
  const g = document.getElementById('apGanti');
  g.classList.toggle('ar-sembunyi', h.akun.length < 2);
  g.innerHTML = h.akun.map(function(a){
    return '<button class="' + (a.kelompok === s.kelompok ? 'on' : '') + '" onclick="arMuatSaya(\'' + a.kelompok + '\')">Arisan ' + a.kelompok + '</button>';
  }).join('');
  document.getElementById('apKartu').classList.toggle('pkk', s.kelompok === 'PKK');
  document.getElementById('apKel').textContent = s.kelompok;
  const st = document.getElementById('apStatus');
  st.textContent = s.statusLabel.toUpperCase(); st.className = 'ar-chip ' + (AR_CHIP[s.status] || '');
  document.getElementById('apNama').textContent = s.nama;
  document.getElementById('apRumah').textContent = 'RUMAH ' + s.rumah;
  document.getElementById('apId').textContent = s.id;
  document.getElementById('apNik').textContent = '•••• ' + s.nikAkhir;
  document.getElementById('apDeposit').textContent = arRp(s.deposit);
  document.getElementById('apIuran').textContent = h.periode ? arRp(h.periode.nominal) : '-';
  document.getElementById('apPeriode').textContent = h.periode
    ? h.periode.label + (h.periode.status === 'PERSIAPAN' ? ' (persiapan)' : ' (berjalan)')
    : 'Belum ada periode berjalan. Admin Arisan akan mengumumkan jadwal periode berikutnya.';
  document.getElementById('apHp').textContent = s.hp ? arHpTampil(s.hp) : '-';
  document.getElementById('apPj').textContent = s.penjamin || 'Tidak perlu (pemilik rumah)';
  document.getElementById('apTgl').textContent = arTgl(s.tglDaftar);
}

function arBukaHp(){ document.getElementById('ahHp').value = Ar.saya ? arHpTampil(Ar.saya.saya.hp) : ''; bukaLembar('lembarHpAr'); }

async function arSimpanHp(){
  const hp = document.getElementById('ahHp').value.replace(/\D/g, '');
  if (!/^(0|62)\d{8,13}$/.test(hp)) return toast('Nomor WhatsApp belum benar (awali 08).');
  tunggu('Menyimpan…');
  try {
    const h = await arPanggil('arisanUbahHp', { kelompok: Ar.kSaya, hp: hp });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarHpAr'); arMuatSaya(Ar.kSaya);
  } catch (e) { selesaiTunggu(); toast(e.message); }
}

async function arKeluarPeserta(){
  if (!confirm('Keluar dari akun peserta di HP ini?')) return;
  try { await arPanggil('arisanKeluarSesi'); } catch (e) {}
  localStorageAman(AR_TOKEN, null);
  Ar.saya = null; Ar.kSaya = '';
  arTampil('depan'); arMuatDepan();
}

/* ---------- ADMIN ---------- */
async function arBukaAdmin(k){
  Ar.kAdmin = k;
  arTampil('admin');
  arJudul('ADMIN ARISAN ' + k); arSub('Memuat…');
  if (Ar.admin && Ar.admin.kelompok === k) arGambarAdminSemua();
  await arMuatAdmin();
}

async function arMuatAdmin(){
  try {
    Ar.admin = await panggilAPI('arisanAdmin', { kelompok: Ar.kAdmin });
    if (document.getElementById('ar') && Ar.mode === 'admin') arGambarAdminSemua();
  } catch (e) { toast(e.message); arSub('Gagal memuat'); }
}

function arGambarAdminSemua(){
  const a = Ar.admin, n = a.hitung;
  arSub((a.identitas.lingkungan || '') + (a.periode ? ' · ' + a.periode.label : ' · belum ada periode'));
  document.getElementById('aaN1').textContent = n.DAFTAR || 0;
  document.getElementById('aaN2').textContent = n.MENUNGGU_DEPOSIT || 0;
  document.getElementById('aaN3').textContent = n.AKTIF || 0;
  const pr = document.getElementById('aaPeringatan');
  pr.innerHTML = a.adaHpAdmin ? '' : 'No. WA Admin Arisan ' + a.kelompok + ' belum diisi di <b>Pengaturan</b>. Pemberitahuan pendaftaran baru tidak akan sampai ke HP Anda.';
  pr.classList.toggle('ar-sembunyi', a.adaHpAdmin);
  arTabAdmin(Ar.tabAdmin);
}

function arTabAdmin(t){
  Ar.tabAdmin = t;
  document.querySelectorAll('#aaSeg button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === t); });
  document.getElementById('aaCariWadah').classList.toggle('ar-sembunyi', t !== 'SEMUA');
  arGambarAdmin();
}

function arGambarAdmin(){
  if (!Ar.admin) return;
  const q = document.getElementById('aaCari').value.trim().toLowerCase();
  const baru = ['DAFTAR', 'MENUNGGU_DEPOSIT'];
  const d = Ar.admin.peserta.filter(function(p){
    if (Ar.tabAdmin === 'BARU') return baru.indexOf(p.status) !== -1;
    return !q || (p.nama + ' ' + p.rumah + ' ' + p.id).toLowerCase().indexOf(q) !== -1;
  });
  document.getElementById('aaDaftar').innerHTML = d.length ? d.map(function(p){
    return '<button class="ar-item" onclick="arDetail(\'' + arAman(p.id) + '\')"><span class="ar-no">' + arAman(p.rumah) + '</span>' +
      '<span class="isi"><b>' + arAman(p.nama) + '</b><small>' + arAman(p.id) + ' · daftar ' + arTgl(p.tglDaftar) + '</small></span>' +
      '<span class="ar-chip ' + (AR_CHIP[p.status] || '') + '">' + arAman(p.statusLabel) + '</span></button>';
  }).join('') : '<div class="ar-kartu"><p>' + (Ar.tabAdmin === 'BARU' ? 'Tidak ada pendaftar yang menunggu.' : 'Belum ada peserta.') + '</p></div>';
}

function arBaris(l, v){ return '<div class="ar-baris"><span>' + l + '</span><b>' + v + '</b></div>'; }

function arDetail(id){
  const p = Ar.admin.peserta.filter(function(x){ return x.id === id; })[0];
  if (!p) return;
  Ar.detail = p;
  document.getElementById('adtJudul').textContent = p.nama;
  let h = arBaris('Status', '<span class="ar-chip ' + (AR_CHIP[p.status] || '') + '">' + arAman(p.statusLabel) + '</span>') +
    arBaris('ID', arAman(p.id)) + arBaris('Rumah', arAman(p.rumah)) + arBaris('NIK', arAman(p.nik)) +
    arBaris('No. WA', arAman(arHpTampil(p.hp))) + arBaris('Penjamin', arAman(p.penjamin || 'Tidak perlu')) +
    arBaris('Terdaftar', arTgl(p.tglDaftar)) + (p.tglAktif ? arBaris('Aktif sejak', arTgl(p.tglAktif)) : '') +
    arBaris('Hak deposit', arRp(p.deposit)) + (p.catatan ? arBaris('Catatan', arAman(p.catatan)) : '');
  h += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">';
  if (p.status === 'DAFTAR') {
    h += '<div class="field"><label for="adtDepo">Deposit yang ditagihkan</label><input id="adtDepo" inputmode="numeric" value="' + (Ar.admin.depositSaran || '') + '" placeholder="100000"></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arVerifikasi(\'VALID\')">Data valid, kirim tagihan deposit</button>' +
      '<div class="field"><label for="adtAlasan">Alasan bila ditolak</label><textarea id="adtAlasan" rows="2" maxlength="200"></textarea></div>' +
      '<button class="ar-btn ar-btn-merah" onclick="arVerifikasi(\'TOLAK\')">Tolak pendaftaran</button>';
  } else if (p.status === 'MENUNGGU_DEPOSIT') {
    h += '<div class="field"><label for="adtNominal">Deposit yang diterima</label><input id="adtNominal" inputmode="numeric" value="' + (Ar.admin.depositSaran || '') + '"></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arTerimaDeposit()">Deposit diterima, aktifkan</button>';
  }
  if (p.hp) h += '<a class="ar-btn ar-btn-wa" href="https://wa.me/' + encodeURIComponent(p.hp) + '" target="_blank" rel="noopener">Chat WhatsApp</a>';
  h += '</div>';
  document.getElementById('adtIsi').innerHTML = h;
  bukaLembar('lembarDetailAr');
}

async function arVerifikasi(aksi){
  if (Ar.sibuk || !Ar.detail) return;
  const p = Ar.detail;
  const form = { kelompok: Ar.kAdmin, id: p.id, aksi: aksi };
  if (aksi === 'VALID') {
    form.deposit = document.getElementById('adtDepo').value.replace(/\D/g, '');
    if (!(Number(form.deposit) > 0)) return toast('Isi nominal deposit.');
    if (!confirm('Data ' + p.nama + ' valid?\nTagihan deposit ' + arRp(form.deposit) + ' dikirim lewat WA.')) return;
  } else {
    form.alasan = document.getElementById('adtAlasan').value.trim();
    if (!form.alasan) return toast('Tuliskan alasan penolakan.');
    if (!confirm('Tolak pendaftaran ' + p.nama + '?')) return;
  }
  Ar.sibuk = true; tunggu('Memproses…');
  try {
    const h = await panggilAPI('arisanVerifikasi', form);
    selesaiTunggu(); toast(h.message); tutupLembar('lembarDetailAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arTerimaDeposit(){
  if (Ar.sibuk || !Ar.detail) return;
  const p = Ar.detail, nominal = document.getElementById('adtNominal').value.replace(/\D/g, '');
  if (!(Number(nominal) > 0)) return toast('Isi nominal deposit.');
  if (!confirm('Deposit ' + arRp(nominal) + ' dari ' + p.nama + ' sudah diterima?')) return;
  Ar.sibuk = true; tunggu('Mencatat deposit…');
  try {
    const h = await panggilAPI('arisanTerimaDeposit', { kelompok: Ar.kAdmin, id: p.id, nominal: nominal });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarDetailAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

/* ---------- ALAT KECIL ---------- */
function arAman(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function arRp(n){ return 'Rp ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function arHpTampil(hp){ hp = String(hp || ''); return hp.indexOf('62') === 0 ? '0' + hp.slice(2) : hp; }
function arTgl(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '-';
  return Number(m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m[2]) - 1] + ' ' + m[1];
}