/* =================================================================
   MODUL ARISAN WARGA (Tahap 7E-1 · Fondasi)
   Tiga wajah: pengunjung (depan, peraturan, daftar), peserta (sesi NIK + tgl lahir),
   admin (ADMIN_ARISAN_RT / ADMIN_ARISAN_PKK / Developer).
   Token peserta disimpan TERPISAH dari token pengurus.
   ================================================================= */

const Ar = { depan: null, mode: '', kAturan: 'RT', aturanDari: 'depan', langkah: 1,
             daftar: {}, saya: null, kSaya: '', admin: null, kAdmin: '', tabAdmin: 'BARU', halAdmin: 'BERANDA',
             detail: null, sel: null, sibuk: false };
const AR_TOKEN = 'siwarga_arisan_token';
const AR_ADMIN_PERAN = { ADMIN_ARISAN_RT: 'RT', ADMIN_ARISAN_PKK: 'PKK' };
const AR_CHIP = { DAFTAR: 'biru', MENUNGGU_DEPOSIT: '', AKTIF: 'hijau', ANTRE: 'biru', MINTA_KELUAR: '', KELUAR: 'abu', DITOLAK: 'merah', BLACKLIST: 'merah' };

async function init_arisan(){
  Ar.sibuk = false; Ar.detail = null;
  const aksi = App.aksi || '';
  if (AR_ADMIN_PERAN[App.peran]) {
    Ar.kAdmin = AR_ADMIN_PERAN[App.peran];
    if (aksi === 'aturan') { Ar.kAturan = Ar.kAdmin; Ar.aturanDari = 'admin'; arTampil('aturan'); return arMuatDepan(); }
    Ar.halAdmin = { peserta: 'PESERTA', iuran: 'IURAN', kocok: 'KOCOK' }[aksi] || 'BERANDA';
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
  arGambarTagihan(h);
  arGambarKocokSaya(h);
  arGambarKeluarSaya(h);
  arPantauLive();
  document.getElementById('apHp').textContent = s.hp ? arHpTampil(s.hp) : '-';
  document.getElementById('apPj').textContent = s.penjamin || 'Tidak perlu (pemilik rumah)';
  document.getElementById('apTgl').textContent = arTgl(s.tglDaftar);
}

const AR_JENIS = { DEPOSIT: 'Deposit', IURAN: 'Iuran', SUSULAN: 'Susulan', BAGI_SUSULAN: 'Bagian susulan', PENCAIRAN: 'Pencairan pot',
                  PEMBALIK: 'Pembatalan', TALANGAN: 'Talangan iuran (utang ke kas deposit)', TALANGAN_KEMBALI: 'Talangan lunas',
                  POTONGAN: 'Iuran belum masuk, pot pemenang terpotong', BAGI_PEMULIHAN: 'Pemulihan pot', HANGUS: 'Deposit hangus', DEPOSIT_KEMBALI: 'Deposit kembali' };

function arGambarTagihan(h){
  const t = h.tagihan, s = h.saya, w = document.getElementById('apTagihan');
  let x = '';
  if (s.status === 'ANTRE') x = '<div class="ar-peringatan" style="margin:10px 0 0;">Anda terdaftar di antrean dan otomatis ikut periode berikutnya. Bila ingin ikut periode sekarang, hubungi Admin Arisan.</div>';
  else if (t && t.ikut) {
    x = '<div class="ar-angka" style="margin:10px 0 6px;"><div><b>' + t.putaranKini + '/' + t.n + '</b><small>PUTARAN · ' + arAman(t.bulanKini).toUpperCase() + '</small></div>' +
      '<div><b>' + arRp(t.pot) + '</b><small>POT PER PUTARAN</small></div></div>';
    if (t.menang) x += '<div class="ar-peringatan" style="background:rgba(37,211,102,.12);color:#8ff0b8;border-color:rgba(37,211,102,.3);">🏆 Anda menang di putaran ' + t.menang.putaran +
      '. Tetap bayar iuran sampai periode selesai ya.</div>';
    if (t.belum) x += '<div class="ar-peringatan">Ada ' + t.belum + ' iuran yang belum lunas. Peserta yang belum lunas tidak ikut diundi.</div>';
    x += t.daftar.map(function(d){
      const chip = { LUNAS: '<span class="ar-chip hijau">Lunas</span>', SUSULAN: '<span class="ar-chip biru">Susulan</span>',
                     BELUM: '<span class="ar-chip merah">Belum</span>', NANTI: '<span class="ar-chip abu">Nanti</span>',
                     DITALANGI: '<span class="ar-chip">Ditalangi deposit</span>', MEMOTONG: '<span class="ar-chip merah">Memotong pot</span>' }[d.status];
      return '<div class="ar-tagih"><span class="isi">Putaran ' + d.putaran + '<small>' + arAman(d.bulan) + '</small></span>' + chip + '</div>';
    }).join('');
  }
  w.innerHTML = x;
  const r = h.riwayat || [];
  document.getElementById('apRiwayatKartu').classList.toggle('ar-sembunyi', !r.length);
  // Dari sisi peserta: nominal kas positif = uang yang ia bayarkan, negatif = uang yang ia terima
  document.getElementById('apRiwayat').innerHTML = r.map(function(x){
    if (x.jenis === 'TALANGAN' || x.jenis === 'TALANGAN_KEMBALI' || x.jenis === 'POTONGAN') {
      if (x.jenis === 'POTONGAN') return '<div class="ar-tagih"><span class="isi">' + arAman(AR_JENIS.POTONGAN) + ' · putaran ' + x.putaran + '<small>' +
        arTgl(x.waktu) + '</small></span><b style="color:#ff9a9d;">utang ' + arRp(Math.abs(x.nominal)) + '</b></div>';
      return '<div class="ar-tagih"><span class="isi">' + arAman(AR_JENIS[x.jenis]) + ' · putaran ' + x.putaran + '<small>' + arTgl(x.waktu) +
        '</small></span><b style="color:' + (x.nominal < 0 ? '#fbbf24' : '#5ee29a') + ';">deposit ' + (x.nominal < 0 ? '− ' : '+ ') + arRp(Math.abs(x.nominal)) + '</b></div>';
    }
    return '<div class="ar-tagih"><span class="isi">' + arAman(AR_JENIS[x.jenis] || x.jenis) + (x.putaran ? ' · putaran ' + x.putaran : '') +
      '<small>' + arTgl(x.waktu) + '</small></span><b style="color:' + (x.nominal < 0 ? '#5ee29a' : '#fff') + ';">' +
      (x.nominal < 0 ? 'terima ' : 'bayar ') + arRp(Math.abs(x.nominal)) + '</b></div>';
  }).join('');
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
  if (Ar.tabAdmin === 'BARU' && !(n.DAFTAR || n.MENUNGGU_DEPOSIT) && Ar.halAdmin === 'PESERTA') Ar.tabAdmin = 'SEMUA';
  arTabAdmin(Ar.tabAdmin);
  arGambarBeranda();
  arGambarIuran();
  if (Ar.halAdmin === 'KOCOK') Ar.kocok = null;
  arHalAdmin(Ar.halAdmin);
}

function arHalAdmin(h){
  Ar.halAdmin = h;
  document.querySelectorAll('#aaHal button').forEach(function(b){ b.classList.toggle('on', b.dataset.h === h); });
  document.getElementById('aaBeranda').classList.toggle('ar-sembunyi', h !== 'BERANDA');
  document.getElementById('aaPeserta').classList.toggle('ar-sembunyi', h !== 'PESERTA');
  document.getElementById('aaIuran').classList.toggle('ar-sembunyi', h !== 'IURAN');
  document.getElementById('aaKocok').classList.toggle('ar-sembunyi', h !== 'KOCOK');
  if (h === 'KOCOK') arMuatKocok();
}

/* ---------- ADMIN: BERANDA & PERIODE ---------- */
function arGambarBeranda(){
  const a = Ar.admin, per = a.periode, w = document.getElementById('aaBeranda');
  const baru = (a.hitung.DAFTAR || 0) + (a.hitung.MENUNGGU_DEPOSIT || 0);
  let h = '';
  if (baru) h += '<button class="ar-item" onclick="Ar.tabAdmin=\'BARU\';arTabAdmin(\'BARU\');arHalAdmin(\'PESERTA\')"><span class="ar-no">' + baru +
    '</span><span class="isi"><b>Pendaftar menunggu</b><small>Verifikasi data atau terima deposit</small></span><span class="ar-chip biru">Buka</span></button>';
  if (!per) {
    h += '<div class="ar-kartu"><h3>Belum ada periode</h3><p>Buat periode untuk menetapkan iuran, deposit, dan bulan mulai. Peserta aktif (' +
      a.calonIkut + ' orang) otomatis ikut saat periode dimulai.</p><div class="ar-dua"><button class="ar-btn ar-btn-emas" onclick="arBukaPeriode()">Buat periode</button></div></div>';
  } else if (per.status === 'PERSIAPAN') {
    h += '<div class="ar-kartu"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;">' + arAman(per.label) +
      '</h3><span class="ar-chip">PERSIAPAN</span></div>' +
      arBaris('Putaran pertama', arBulanDari(per.mulai)) + arBaris('Iuran', arRp(per.nominal) + ' / bulan') + arBaris('Deposit', arRp(per.deposit)) +
      arBaris('Batas tunggakan', per.batas + ' bulan') + arBaris('Akan ikut', a.calonIkut + ' peserta (' + a.calonIkut + ' putaran)') +
      arBaris('Pot per putaran', arRp(per.nominal * a.calonIkut)) +
      '<div class="ar-dua"><button class="ar-btn ar-btn-garis" onclick="arBukaPeriode()">Ubah</button>' +
      '<button class="ar-btn ar-btn-emas" onclick="arMulaiPeriode()">Mulai periode</button></div></div>' +
      ((a.tertahan || []).length ? '<div class="ar-kartu"><h3>Tertahan (' + a.tertahan.length + ')</h3>' + a.tertahan.map(function(t){
        return '<button class="ar-item" onclick="arDetail(\'' + arAman(t.id) + '\')"><span class="isi"><b>' + arAman(t.nama) + '</b><small>' + arAman(t.alasan) + '</small></span></button>';
      }).join('') + '<p class="ar-ket">Peserta tertahan tidak ikut saat periode dimulai. Setelah urusannya selesai, mereka bisa ikut dengan susulan.</p></div>' : '') +
      '<p class="ar-ket">Pendaftar yang depositnya diterima sebelum periode dimulai otomatis ikut. Setelah dimulai, peserta baru masuk antrean atau ikut dengan susulan.</p>';
  } else {
    const iu = a.iuran, pot = iu.pot, persen = pot.target ? Math.round(pot.terkumpul / pot.target * 100) : 0;
    h += '<div class="ar-kartu"><div style="display:flex;justify-content:space-between;align-items:center;"><span class="ar-kecil">' + arAman(per.label) +
      '</span><span class="ar-chip hijau">BERJALAN</span></div>' +
      (iu.selesai ? '<div class="ar-besar" style="margin-top:6px;">Semua putaran sudah dikocok</div>' +
          (a.bisaTutup ? '<p>Periode bisa ditutup. Peserta otomatis ikut periode berikutnya; yang tunggakannya belum lunas akan tertahan.</p>' +
            '<div class="ar-dua"><button class="ar-btn ar-btn-emas" onclick="arTutupPeriode()">Tutup periode</button></div>'
            : '<p>Selesaikan pencairan pot terakhir di tab Kocok sebelum menutup periode.</p>')
        : '<div class="ar-besar" style="margin-top:6px;">Putaran ' + iu.putaranKini + ' <span class="ar-kecil">dari ' + iu.n + ' · ' + arAman(iu.bulan[iu.putaranKini - 1]) + '</span></div>' +
          '<div class="ar-bar"><i style="width:' + persen + '%"></i></div>' +
          '<div style="display:flex;justify-content:space-between;" class="ar-kecil"><span>Pot terkumpul <b style="color:#fff;">' + arRp(pot.terkumpul) +
          '</b></span><span>' + pot.lunas + '/' + iu.n + ' lunas · target ' + arRp(pot.target) + '</span></div>') +
      '</div>';
    const piutang = (a.piutang || []).reduce(function(t, p){ return t + p.total; }, 0);
    h += '<div class="ar-angka"><div><b>' + arRp(a.saldoDeposit) + '</b><small>DEPOSIT TUNAI</small></div>' +
      '<div><b>' + arRp(piutang) + '</b><small>PIUTANG TALANGAN</small></div>' +
      '<div><b>' + iu.tunggakan + '</b><small>BELUM LUNAS</small></div></div>';
    if (a.piutang && a.piutang.length) h += '<div class="ar-kartu"><h3>Piutang talangan</h3>' + a.piutang.map(function(p){
      return '<button class="ar-item" onclick="arBukaLunasi(\'' + arAman(p.id) + '\')"><span class="isi"><b>' + arAman(p.nama) + '</b><small>' + arRp(p.total) + ' · ' + p.kali +
        '× ditalangi</small></span>' + (p.kali >= 3 ? '<span class="ar-chip merah">batas habis</span>' : '<span class="ar-chip">Lunasi</span>') + '</button>';
    }).join('') + '<p class="ar-ket">Talangan tercatat sebagai utang. Peserta paling banyak ditalangi 3 kali; setelah itu, iuran yang tidak masuk memotong pot dan penunggak serta penjaminnya ditagih lewat WA.</p></div>';
    if (!iu.selesai) {
      h += '<div class="ar-kartu"><h3>Belum bayar putaran ' + iu.putaranKini + ' (' + iu.belumKini.length + ')</h3>' +
        (iu.belumKini.length ? iu.belumKini.map(function(b){
          return '<div class="ar-baris"><span>' + arAman(b.rumah) + '</span><b>' + arAman(b.nama) + (b.adaHp ? '' : ' <span class="ar-chip abu">tanpa WA</span>') + '</b></div>';
        }).join('') + '<div class="ar-dua"><button class="ar-btn ar-btn-garis" onclick="arHalAdmin(\'IURAN\')">Catat iuran</button>' +
          '<button class="ar-btn ar-btn-emas" onclick="arIngatkan()">Ingatkan lewat WA</button></div>'
        : '<p>Semua peserta sudah lunas. 🎉</p>') + '</div>';
    }
    h += '<div class="ar-kartu">' + arBaris('Iuran', arRp(per.nominal) + ' / bulan') + arBaris('Deposit peserta baru', arRp(per.deposit)) +
      arBaris('Batas tunggakan', per.batas + ' bulan') + arBaris('Mulai', arTgl(per.dibuka)) +
      '<div class="ar-dua"><button class="ar-btn ar-btn-garis" onclick="arBukaPeriode()">Ubah nama / batas</button></div></div>';
  }
  h += arKartuTindakLanjut(a, per);
  w.innerHTML = h;
}

function arBulanDari(m){
  const x = String(m || '').match(/^(\d{4})-(\d{2})$/);
  return x ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(x[2]) - 1] + ' ' + x[1] : '-';
}

function arBukaPeriode(){
  const per = Ar.admin.periode, jalan = per && per.status === 'BERJALAN';
  const isi = { apdLabel: per ? per.label : '', apdMulai: per ? per.mulai : '', apdNominal: per ? per.nominal : '',
                apdDeposit: per ? per.deposit : (Ar.admin.depositSaran || ''), apdBatas: per ? per.batas : 2 };
  Object.keys(isi).forEach(function(id){ document.getElementById(id).value = isi[id]; });
  ['apdMulai', 'apdNominal', 'apdDeposit'].forEach(function(id){ document.getElementById(id).disabled = jalan; });
  document.getElementById('apdJudul').textContent = per ? 'Ubah periode' : 'Periode baru';
  document.getElementById('apdKet').textContent = jalan
    ? 'Selama periode berjalan, iuran, deposit, dan bulan mulai dikunci supaya hitungan pot tidak berubah di tengah jalan.'
    : 'Batas tunggakan: peserta yang menunggak iuran lingkungan sebanyak ini atau lebih tidak ikut diundi saat kocokan.';
  bukaLembar('lembarPeriodeAr');
}

async function arSimpanPeriode(){
  if (Ar.sibuk) return;
  const v = function(id){ return document.getElementById(id).value; };
  const form = { kelompok: Ar.kAdmin, label: v('apdLabel').trim(), mulai: v('apdMulai'), nominal: v('apdNominal').replace(/\D/g, ''),
                 deposit: v('apdDeposit').replace(/\D/g, ''), batas: v('apdBatas').replace(/\D/g, '') };
  if (!form.label) return toast('Isi nama periode.');
  Ar.sibuk = true; tunggu('Menyimpan periode…');
  try {
    const h = await panggilAPI('arisanSimpanPeriode', form);
    selesaiTunggu(); toast(h.message); tutupLembar('lembarPeriodeAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arMulaiPeriode(){
  const a = Ar.admin, per = a.periode;
  if (!confirm('Mulai ' + per.label + '?\n\n' + a.calonIkut + ' peserta · ' + a.calonIkut + ' putaran\nIuran ' + arRp(per.nominal) +
      ' · pot ' + arRp(per.nominal * a.calonIkut) + '\n\nSetelah dimulai, iuran dan bulan mulai tidak bisa diubah. Pengumuman dikirim lewat WA.')) return;
  Ar.sibuk = true; tunggu('Memulai periode & mengirim WA…');
  try {
    const h = await panggilAPI('arisanMulaiPeriode', { kelompok: Ar.kAdmin });
    selesaiTunggu(); toast(h.message); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arIngatkan(){
  const iu = Ar.admin.iuran;
  if (!confirm('Kirim pengingat WA ke ' + iu.belumKini.length + ' peserta yang belum bayar putaran ' + iu.putaranKini + '?')) return;
  Ar.sibuk = true; tunggu('Mengirim pengingat…');
  try { const h = await panggilAPI('arisanIngatkan', { kelompok: Ar.kAdmin }); selesaiTunggu(); toast(h.message); }
  catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

/* ---------- ADMIN: MATRIKS IURAN ---------- */
function arGambarIuran(){
  const a = Ar.admin, iu = a.iuran, w = document.getElementById('aaIuran');
  if (!iu) {
    w.innerHTML = '<div class="ar-kartu"><p>' + (a.periode ? 'Iuran bisa dicatat setelah periode dimulai.' : 'Belum ada periode. Buat periode di Beranda.') + '</p></div>';
    return;
  }
  let h = '<div class="ar-dua" style="margin:0 0 10px;"><button class="ar-btn ar-btn-emas" onclick="arBukaMassal()">Bayar massal</button></div>';
  h += '<div class="ar-matriks"><table><thead><tr><th>Peserta</th>';
  iu.bulan.forEach(function(b, i){
    h += '<th class="' + (i + 1 === iu.putaranKini && !iu.selesai ? 'kini' : '') + '">' + (i + 1) + '<small>' + arAman(b.split(' ')[0]) + '</small></th>';
  });
  h += '</tr></thead><tbody>';
  iu.baris.forEach(function(r, ri){
    h += '<tr><th>' + arAman(r.nama) + '<small>' + arAman(r.rumah) + (r.menang ? ' · 🏆 ' + r.menang : '') + (r.cara === 'SUSULAN' ? ' · susulan' : '') + '</small></th>';
    r.sel.forEach(function(c, ci){
      const t = { L: '✓', S: 'S', B: '✗', D: '·', T: '!', P: '−' }[c.s];
      h += '<td><button class="ar-sel ' + c.s + (r.menang === ci + 1 ? ' W' : '') + '" onclick="arSel(' + ri + ',' + ci + ')" aria-label="Putaran ' + (ci + 1) + '">' + t + '</button></td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="ar-legenda"><span><i class="ar-sel L">✓</i>lunas</span><span><i class="ar-sel S">S</i>susulan</span>' +
    '<span><i class="ar-sel B">✗</i>belum</span><span><i class="ar-sel T">!</i>ditalangi deposit</span><span><i class="ar-sel P">−</i>memotong pot</span><span><i class="ar-sel D">·</i>belum jatuh tempo</span><span><i class="ar-sel D W"></i>putaran menang</span></div>';
  h += '<p class="ar-ket">Ketuk sel untuk mencatat atau melihat pembayaran. Pembayaran yang salah catat bisa dibatalkan selama putarannya belum dikocok.</p>';
  w.innerHTML = h;
}

function arSel(ri, ci){
  const iu = Ar.admin.iuran, r = iu.baris[ri], c = r.sel[ci], k = ci + 1, per = Ar.admin.periode;
  Ar.sel = { id: r.id, nama: r.nama, putaran: k, kas: c.kas, adaHp: r.adaHp };
  document.getElementById('aiJudul').textContent = r.nama + ' · putaran ' + k;
  let isi = arBaris('Bulan', arAman(iu.bulan[ci])) + arBaris('Iuran', arRp(per.nominal));
  let bawah = '';
  if (c.s === 'T' || c.s === 'P') {
    isi += arBaris('Status', c.s === 'T' ? '<span class="ar-chip">Ditalangi deposit, belum dibayar</span>' : '<span class="ar-chip merah">Memotong pot, belum dibayar</span>') +
      '<p class="ar-ket">' + (c.s === 'T' ? 'Setelah dicatat, talangan otomatis kembali ke kas deposit.'
        : 'Setelah dicatat, uang ini menjadi pemulihan pot untuk pemenang putaran ' + k + (iu.pemenang[ci] ? ' (' + arAman(iu.pemenang[ci]) + ')' : '') + '. Serahkan kepadanya.') + '</p>' +
      '<label class="ar-setuju"><input type="checkbox" id="aiWa"' + (r.adaHp ? ' checked' : ' disabled') + '><span>Kirim tanda terima lewat WA</span></label>';
    bawah = '<button class="ar-btn ar-btn-emas" onclick="arCatatIuran()">Catat iuran ' + arRp(per.nominal) + '</button>';
  } else if (c.s === 'L' || c.s === 'S') {
    isi += arBaris('Status', c.s === 'S' ? '<span class="ar-chip biru">Dibayar lewat susulan</span>' : '<span class="ar-chip hijau">Lunas</span>') +
      arBaris('Dicatat', arTglJam(c.waktu) + (c.petugas ? ' · ' + arAman(c.petugas) : ''));
    if (c.s === 'L' && k > iu.dikocok) {
      isi += '<div class="field" style="margin-top:12px;"><label for="aiAlasan">Batalkan karena salah catat? Tulis alasannya</label><textarea id="aiAlasan" rows="2" maxlength="150"></textarea></div>';
      bawah = '<button class="ar-btn ar-btn-merah" onclick="arBatalIuran()">Batalkan pembayaran</button>';
    } else if (c.s === 'L') {
      isi += '<p class="ar-ket">Putaran ini sudah dikocok, pembayarannya tidak bisa dibatalkan.</p>';
    }
  } else {
    isi += arBaris('Status', c.s === 'B' ? '<span class="ar-chip merah">Belum bayar</span>' : '<span class="ar-chip abu">Belum jatuh tempo (bayar di muka)</span>') +
      '<label class="ar-setuju"><input type="checkbox" id="aiWa"' + (r.adaHp ? ' checked' : ' disabled') + '><span>Kirim tanda terima lewat WA' +
      (r.adaHp ? '' : ' (tidak ada No. WA)') + '</span></label>';
    bawah = '<button class="ar-btn ar-btn-emas" onclick="arCatatIuran()">Catat iuran ' + arRp(per.nominal) + '</button>';
  }
  document.getElementById('aiIsi').innerHTML = isi;
  document.getElementById('aiBawah').innerHTML = bawah;
  bukaLembar('lembarIuranAr');
}

async function arKirimBayar(putaran, ids, wa){
  Ar.sibuk = true; tunggu(wa ? 'Mencatat & mengirim tanda terima…' : 'Mencatat iuran…');
  try {
    const h = await panggilAPI('arisanBayar', { kelompok: Ar.kAdmin, putaran: putaran, ids: ids, wa: wa });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarIuranAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

function arCatatIuran(){
  if (Ar.sibuk || !Ar.sel) return;
  const wa = document.getElementById('aiWa');
  arKirimBayar(Ar.sel.putaran, [Ar.sel.id], !!(wa && wa.checked));
}

async function arBatalIuran(){
  if (Ar.sibuk || !Ar.sel) return;
  const alasan = document.getElementById('aiAlasan').value.trim();
  if (!alasan) return toast('Tuliskan alasan pembatalan.');
  if (!confirm('Batalkan iuran ' + Ar.sel.nama + ' putaran ' + Ar.sel.putaran + '?\nCatatan asli tetap tersimpan, ditambah baris pembatalan.')) return;
  Ar.sibuk = true; tunggu('Membatalkan…');
  try {
    const h = await panggilAPI('arisanPembalik', { kelompok: Ar.kAdmin, kas: Ar.sel.kas, alasan: alasan });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarIuranAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

function arBukaMassal(k){
  const iu = Ar.admin.iuran, per = Ar.admin.periode;
  k = k || (iu.selesai ? iu.n : iu.putaranKini);
  Ar.sel = { massal: k };
  document.getElementById('aiJudul').textContent = 'Bayar massal';
  const belum = iu.baris.filter(function(r){ const s = r.sel[k - 1].s; return s === 'B' || s === 'D' || s === 'T' || s === 'P'; });
  let isi = '<div class="field"><label for="aiPutaran">Putaran</label><select id="aiPutaran" onchange="arBukaMassal(Number(this.value))">' +
    iu.bulan.map(function(b, i){ return '<option value="' + (i + 1) + '"' + (i + 1 === k ? ' selected' : '') + '>Putaran ' + (i + 1) + ' · ' + arAman(b) + '</option>'; }).join('') +
    '</select></div>';
  if (!belum.length) isi += '<p class="ar-ket">Semua peserta sudah lunas putaran ini.</p>';
  else {
    isi += '<label class="ar-cek" style="border-style:dashed;"><input type="checkbox" onchange="arPilihSemua(this.checked)"><span><b>Pilih semua</b></span></label>' +
      belum.map(function(r){
        return '<label class="ar-cek"><input type="checkbox" class="aiPilih" value="' + arAman(r.id) + '" onchange="arHitungMassal()"><span><b>' + arAman(r.nama) +
          '</b><small>' + arAman(r.rumah) + (r.adaHp ? '' : ' · tanpa WA') + '</small></span></label>';
      }).join('') +
      '<label class="ar-setuju"><input type="checkbox" id="aiWa" checked><span>Kirim tanda terima lewat WA</span></label>';
  }
  document.getElementById('aiIsi').innerHTML = isi;
  document.getElementById('aiBawah').innerHTML = belum.length ? '<button class="ar-btn ar-btn-emas" id="aiTombolMassal" onclick="arKirimMassal()">Pilih peserta</button>' : '';
  bukaLembar('lembarIuranAr');
}

function arPilihSemua(v){ document.querySelectorAll('.aiPilih').forEach(function(c){ c.checked = v; }); arHitungMassal(); }

function arHitungMassal(){
  const n = document.querySelectorAll('.aiPilih:checked').length, t = document.getElementById('aiTombolMassal');
  if (t) t.textContent = n ? 'Catat ' + n + ' iuran · ' + arRp(n * Ar.admin.periode.nominal) : 'Pilih peserta';
}

function arKirimMassal(){
  if (Ar.sibuk) return;
  const ids = Array.prototype.map.call(document.querySelectorAll('.aiPilih:checked'), function(c){ return c.value; });
  if (!ids.length) return toast('Pilih peserta yang membayar.');
  const k = Ar.sel.massal;
  if (!confirm('Catat ' + ids.length + ' iuran putaran ' + k + ' (total ' + arRp(ids.length * Ar.admin.periode.nominal) + ')?')) return;
  arKirimBayar(k, ids, document.getElementById('aiWa').checked);
}

/* ---------- ADMIN: SUSULAN ---------- */
async function arPratinjauSusulan(){
  if (Ar.sibuk || !Ar.detail) return;
  Ar.sibuk = true; tunggu('Menghitung susulan…');
  try {
    const h = await panggilAPI('arisanIkutkan', { kelompok: Ar.kAdmin, id: Ar.detail.id });
    selesaiTunggu();
    const w = document.getElementById('adtSusulan');
    w.innerHTML = '<div class="ar-rincian">' +
      (h.terlewat ? '<p class="ar-ket" style="margin:0 0 6px;">Putaran yang terlewat: <b>' + h.terlewat + '</b></p>' +
        '<div class="ar-besar" style="font-size:1.1rem;">Bayar susulan ' + h.terlewat + ' × ' + arRp(h.nominal) + ' = ' + arRp(h.total) + '</div>' +
        '<p class="ar-ket">Dibagikan ke:</p>' + h.bagi.map(function(b){ return arBaris('Putaran ' + b.putaran + ' · ' + arAman(b.bulan), arAman(b.pemenang) + ' · ' + arRp(b.nominal)); }).join('')
        : '<p class="ar-ket" style="margin:0;">Belum ada putaran yang dikocok, jadi tidak ada susulan.</p>') +
      '<p class="ar-ket">Jumlah putaran periode menjadi <b>' + h.nBaru + '</b>.</p></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arKonfirmasiSusulan(' + h.total + ')">' + (h.total ? 'Uang susulan ' + arRp(h.total) + ' sudah diterima' : 'Ikutkan sekarang') + '</button>';
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arKonfirmasiSusulan(total){
  if (Ar.sibuk || !Ar.detail) return;
  if (!confirm(Ar.detail.nama + ' ikut periode berjalan' + (total ? ' dengan susulan ' + arRp(total) : '') + '?')) return;
  Ar.sibuk = true; tunggu('Mencatat…');
  try {
    const h = await panggilAPI('arisanIkutkan', { kelompok: Ar.kAdmin, id: Ar.detail.id, konfirmasi: true });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarDetailAr'); await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
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
    arBaris('Hak deposit', arRp(p.deposit)) + (p.utang ? arBaris('Tunggakan', '<span style="color:#ff9a9d;">' + arRp(p.utang) + '</span> (' + p.talangan + '× ditalangi)') : '') +
    (p.menang ? arBaris('Menang', 'Putaran ' + p.menang) : '') + (p.catatan ? arBaris('Catatan', arAman(p.catatan)) : '');
  if (p.pindah) h += '<div class="ar-peringatan" style="margin-top:10px;">🏠 Terdeteksi pindah: ' + arAman(p.pindah) + '. Pilih jalur lewat tombol <b>Pindah rumah</b>.</div>';
  if (p.blacklistLain) h += '<div class="ar-peringatan" style="margin-top:10px;">⚠️ NIK ini pernah di-blacklist di arisan lain. Pertimbangkan sebelum memverifikasi.</div>';
  if (p.saranBlacklist) h += '<div class="ar-peringatan" style="margin-top:10px;background:rgba(229,72,77,.12);color:#ffb3b5;border-color:rgba(229,72,77,.35);">Batas talangan habis dan iurannya sudah memotong pot. Sesuai peraturan, peserta ini dapat di-blacklist.</div>';
  h += '<div id="adtAksi" style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">';
  if (p.status === 'DAFTAR') {
    h += '<div class="field"><label for="adtDepo">Deposit yang ditagihkan</label><input id="adtDepo" inputmode="numeric" value="' + (Ar.admin.depositSaran || '') + '" placeholder="100000"></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arVerifikasi(\'VALID\')">Data valid, kirim tagihan deposit</button>' +
      '<div class="field"><label for="adtAlasan">Alasan bila ditolak</label><textarea id="adtAlasan" rows="2" maxlength="200"></textarea></div>' +
      '<button class="ar-btn ar-btn-merah" onclick="arVerifikasi(\'TOLAK\')">Tolak pendaftaran</button>';
  } else if (p.status === 'MENUNGGU_DEPOSIT') {
    h += '<div class="field"><label for="adtNominal">Deposit yang diterima</label><input id="adtNominal" inputmode="numeric" value="' + (Ar.admin.depositSaran || '') + '"></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arTerimaDeposit()">Deposit diterima, aktifkan</button>';
  } else if (p.status === 'ANTRE' && Ar.admin.iuran && !Ar.admin.iuran.selesai) {
    h += '<p class="ar-ket">Peserta ini menunggu periode berikutnya. Bisa juga ikut periode sekarang dengan membayar putaran yang sudah dikocok (susulan).</p>' +
      '<div id="adtSusulan"><button class="ar-btn ar-btn-garis" onclick="arPratinjauSusulan()">Ikut sekarang (susulan)</button></div>';
  }
  if (p.status === 'MINTA_KELUAR') {
    h += '<p class="ar-ket">Mengajukan keluar. Hak deposit ' + arRp(Math.max(0, p.deposit)) + ' dikembalikan sesuai antrean.</p>' +
      '<button class="ar-btn ar-btn-emas" onclick="arProsesKeluar(\'SETUJU\')">Setujui &amp; kembalikan deposit</button>' +
      '<button class="ar-btn ar-btn-garis" onclick="arProsesKeluar(\'TOLAK\')">Batalkan pengajuan (tetap jadi peserta)</button>';
  }
  if (['AKTIF', 'ANTRE', 'MINTA_KELUAR'].indexOf(p.status) !== -1) {
    if (p.utang) h += '<button class="ar-btn ar-btn-emas" onclick="arBukaLunasi(\'' + arAman(p.id) + '\')">Lunasi tunggakan ' + arRp(p.utang) + '</button>';
    h += '<div style="display:flex;gap:8px;"><input id="adtTambah" inputmode="numeric" placeholder="Tambah deposit (Rp)" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font:inherit;">' +
      '<button class="ar-btn ar-btn-garis" style="width:auto;" onclick="arTambahDeposit()">Terima</button></div>' +
      '<button class="ar-btn ar-btn-garis" onclick="arMulaiPindah()">Pindah rumah…</button>' +
      '<button class="ar-btn ar-btn-garis" style="color:#ff9a9d;border-color:rgba(229,72,77,.45);" onclick="arMulaiBlacklist()">Blacklist…</button>';
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
function arTglJam(iso){
  const m = String(iso || '').match(/T(\d{2}:\d{2})/);
  return arTgl(iso) + (m ? ' ' + m[1] : '');
}
function arTgl(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '-';
  return Number(m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m[2]) - 1] + ' ' + m[1];
}

/* =================================================================
   7E-3 · KOCOK (ADMIN)
   ================================================================= */
async function arMuatKocok(){
  const w = document.getElementById('aaKocok');
  if (!Ar.admin || !Ar.admin.iuran) {
    w.innerHTML = '<div class="ar-kartu"><p>Kocokan bisa dilakukan setelah periode dimulai.</p></div>';
    return;
  }
  if (!Ar.kocok) w.innerHTML = '<div class="ar-kartu"><p>Memeriksa kelayakan peserta…</p></div>';
  try {
    Ar.kocok = await panggilAPI('arisanKelayakan', { kelompok: Ar.kAdmin });
    if (document.getElementById('aaKocok')) arGambarKocok();
  } catch (e) { w.innerHTML = '<div class="ar-kartu"><p>' + arAman(e.message) + '</p></div>'; }
}

function arGambarKocok(){
  const d = Ar.kocok, w = document.getElementById('aaKocok');
  let h = '';
  if (d.tertunda) {
    const t = d.tertunda;
    h += '<div class="ar-kartu" style="border-color:rgba(37,211,102,.4);"><span class="ar-chip hijau">PEMENANG PUTARAN ' + t.putaran + '</span>' +
      '<div class="ar-besar" style="margin:8px 0 2px;">' + arAman(t.nama) + '</div><p>Pot ' + arRp(t.nominal) + ' belum diserahkan. ' +
      'Pemenang menandatangani surat pernyataan di HP ini, lalu pot diserahkan.</p>' +
      (d.talangan.peserta.length ? '<p style="margin-top:6px;">Akan ditalangi deposit: ' + d.talangan.peserta.map(function(p){ return arAman(p.nama); }).join(', ') +
        ' (' + arRp(d.talangan.total) + ').</p>' : '') +
      (d.talangan.potong.length ? '<p style="margin-top:6px;color:#ffb3b5;">Pot berkurang ' + arRp(d.talangan.totalPotong) + ' karena: ' +
        d.talangan.potong.map(function(p){ return arAman(p.nama); }).join(', ') + '. Bila mereka membayar sebelum pencairan, pot kembali penuh.</p>' : '') +
      '<div class="ar-dua"><button class="ar-btn ar-btn-emas" onclick="arBukaSurat(\'' + arAman(t.id) + '\')">Surat pernyataan &amp; serahkan pot</button></div></div>';
  } else if (d.selesai) {
    h += '<div class="ar-kartu"><h3>Semua putaran sudah dikocok</h3><p>Tutup periode dari Beranda.</p></div>';
  } else {
    h += '<div class="ar-kartu"><span class="ar-kecil">' + arAman(d.periode.label) + '</span>' +
      '<div class="ar-besar" style="margin-top:4px;">Putaran ' + d.putaran + ' <span class="ar-kecil">dari ' + d.n + ' · ' + arAman(d.bulan) + '</span></div>' +
      '<p style="margin-top:4px;">Pot <b style="color:#fff;">' + arRp(d.pot) + '</b> · ' + d.layak.length + ' gulungan di dalam gelas</p>' +
      '<div class="ar-dua"><button class="ar-btn ar-btn-emas" onclick="arBukaLayar()"' + (d.layak.length ? '' : ' disabled') + '>Buka layar kocokan</button></div></div>';
    h += '<div class="ar-kartu"><h3>Layak diundi (' + d.layak.length + ')</h3>' +
      (d.layak.length ? '<div class="ar-daftar-chip">' + d.layak.map(function(p){ return '<span class="ok">' + arAman(p.nama) + '</span>'; }).join('') + '</div>'
        : '<p>Belum ada. Pastikan iuran putaran ini sudah dicatat.</p>') +
      d.layak.filter(function(p){ return p.catat; }).map(function(p){ return '<p class="ar-ket">⚠️ ' + arAman(p.nama) + ': ' + arAman(p.catat) + '</p>'; }).join('') + '</div>';
    if (d.tidak.length) h += '<div class="ar-kartu"><h3>Belum memenuhi syarat (' + d.tidak.length + ')</h3>' +
      d.tidak.map(function(p){ return arBaris(arAman(p.nama), arAman(p.alasan.join('; '))); }).join('') +
      '<p class="ar-ket">Alasan hanya terlihat oleh Admin dan peserta yang bersangkutan. Peserta lain hanya melihat "belum memenuhi syarat".</p></div>';
    if (d.talangan.peserta.length) h += '<div class="ar-peringatan">Saat pot dicairkan, ' + d.talangan.peserta.length + ' iuran yang belum masuk (' +
      arRp(d.talangan.total) + ') ditalangi kas deposit (tunai ' + arRp(d.talangan.kasDeposit) + '): ' +
      d.talangan.peserta.map(function(p){ return arAman(p.nama); }).join(', ') + '.</div>';
    if (d.talangan.potong.length) h += '<div class="ar-peringatan" style="background:rgba(229,72,77,.12);color:#ffb3b5;border-color:rgba(229,72,77,.35);">' +
      'Tidak bisa ditalangi, pot berkurang ' + arRp(d.talangan.totalPotong) + ': ' +
      d.talangan.potong.map(function(p){ return arAman(p.nama) + ' (' + arAman(p.sebab.toLowerCase()) + ')'; }).join(', ') +
      '. Tagih sebelum pencairan supaya pemenang menerima pot penuh.</div>';
    if (d.menang.length) h += '<div class="ar-kartu"><h3>Sudah menang</h3>' +
      d.menang.map(function(p){ return arBaris('Putaran ' + p.putaran, arAman(p.nama)); }).join('') + '</div>';
  }
  if (d.riwayat.length) {
    const akhirSah = d.riwayat.filter(function(r){ return r.status === 'SAH'; })[0];
    h += '<div class="ar-kartu"><h3>Riwayat kocokan</h3>' + d.riwayat.map(function(r){
      const aksi = r.status === 'SAH'
        ? (r.adaSurat ? '<button class="ar-chip hijau" style="border:none;" onclick="arBukaSurat(\'' + arAman(r.id) + '\')">Surat</button>' : '') +
          (akhirSah && akhirSah.id === r.id ? ' <button class="ar-chip merah" style="border:none;" onclick="arBukaBatalKocok(\'' + arAman(r.id) + '\')">Batalkan</button>' : '')
        : '<span class="ar-chip abu">BATAL</span>';
      return '<div class="ar-tagih"><span class="isi">Putaran ' + r.putaran + ' · ' + arAman(r.nama) + '<small>' + arAman(r.bulan) + ' · ' + arRp(r.nominal) +
        (r.status === 'BATAL' ? ' · ' + arAman(r.catatan) : '') + '</small></span>' + aksi + '</div>';
    }).join('') + '</div>';
  }
  h += '<button class="ar-btn ar-btn-garis" onclick="Ar.kocok=null;arMuatKocok()">Periksa ulang kelayakan</button>';
  w.innerHTML = h;
}

async function arBukaLayar(){
  if (Ar.sibuk) return;
  arSiapkanAudio();                 // dibuat saat jari menekan tombol, supaya suara diizinkan browser
  Ar.sibuk = true; tunggu('Membuka layar kocokan…');
  try {
    const h = await panggilAPI('arisanBukaLayar', { kelompok: Ar.kAdmin });
    selesaiTunggu();
    arBukaPanggung('ADMIN', Ar.kAdmin, h.live, h.now);
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

async function arKocokSekarang(){
  if (Ar.sibuk) return;
  Ar.sibuk = true;
  const tb = document.getElementById('pgTombolKocok');
  if (tb) { tb.disabled = true; tb.textContent = 'Mengundi…'; }
  try {
    const h = await panggilAPI('arisanKocok', { kelompok: Ar.kAdmin });
    arTerimaLive(h.live, h.now);
  } catch (e) {
    toast(e.message);
    if (tb) { tb.disabled = false; tb.textContent = 'KOCOK!'; }
  } finally { Ar.sibuk = false; }
}

function arBukaBatalKocok(id){
  const r = Ar.kocok.riwayat.filter(function(x){ return x.id === id; })[0];
  Ar.sel = { kocok: id };
  document.getElementById('aiJudul').textContent = 'Batalkan kocokan putaran ' + r.putaran;
  document.getElementById('aiIsi').innerHTML = arBaris('Pemenang', arAman(r.nama)) + arBaris('Pot', arRp(r.nominal)) +
    '<p class="ar-ket">Pencairan dan talangan putaran ini dibalik dengan baris pembatalan. Kocokan tetap tercatat sebagai BATAL, lalu putaran ini bisa dikocok ulang.</p>' +
    '<div class="field"><label for="aiAlasan">Alasan pembatalan</label><textarea id="aiAlasan" rows="2" maxlength="150"></textarea></div>';
  document.getElementById('aiBawah').innerHTML = '<button class="ar-btn ar-btn-merah" onclick="arBatalKocok()">Batalkan kocokan</button>';
  bukaLembar('lembarIuranAr');
}

async function arBatalKocok(){
  if (Ar.sibuk) return;
  const alasan = document.getElementById('aiAlasan').value.trim();
  if (!alasan) return toast('Tuliskan alasan pembatalan.');
  if (!confirm('Yakin membatalkan kocokan ini?')) return;
  Ar.sibuk = true; tunggu('Membatalkan…');
  try {
    const h = await panggilAPI('arisanBatalKocok', { kelompok: Ar.kAdmin, kocok: Ar.sel.kocok, alasan: alasan });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarIuranAr'); Ar.kocok = null; await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

/* ---------- SURAT PERNYATAAN ---------- */
async function arBukaSurat(id){
  if (Ar.sibuk) return;
  Ar.sibuk = true; tunggu('Menyiapkan surat…');
  try {
    const h = await panggilAPI('arisanSurat', { kelompok: Ar.kAdmin, kocok: id });
    selesaiTunggu();
    Ar.surat = { id: id, data: h, coret: false };
    document.getElementById('asJudul').textContent = h.dicairkan ? 'Surat pernyataan' : 'Tanda tangan pemenang';
    let isi = arHtmlSurat(h);
    let bawah = '';
    if (!h.dicairkan) {
      isi += '<p class="ar-ket" style="margin-top:12px;">Pemenang membaca surat di atas, lalu tanda tangan dengan jari:</p>' +
        '<div class="ar-ttd"><canvas id="asTtd"></canvas><div class="garis"></div><button type="button" onclick="arHapusTtd()">Hapus</button></div>' +
        (h.talangan && h.talangan.length ? '<p class="ar-ket">Ditalangi deposit saat dicairkan: ' + h.talangan.map(arAman).join(', ') + '.</p>' : '') +
        (h.potong && h.potong.length ? '<p class="ar-ket" style="color:#ffb3b5;">Memotong pot: ' + h.potong.map(arAman).join(', ') + '.</p>' : '') +
        '<label class="ar-setuju"><input type="checkbox" id="asSerah"><span>Pot <b>' + arRp(h.nominal) +
        '</b> sudah diserahkan kepada pemenang.</span></label>';
      bawah = '<button class="ar-btn ar-btn-emas" onclick="arCairkan()">Simpan tanda tangan &amp; cairkan</button>';
    }
    document.getElementById('asIsi').innerHTML = isi;
    document.getElementById('asBawah').innerHTML = bawah;
    bukaLembar('lembarSuratAr');
    if (!h.dicairkan) setTimeout(arSiapkanTtd, 350);
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

function arHtmlSurat(h){
  const s = h.surat;
  const tgl = h.waktu ? arTgl(h.waktu) : arTgl(new Date().toISOString().slice(0, 10));
  return '<div class="ar-surat"><h4>' + arAman(s.judul) + '</h4><div class="sub">' + arAman(s.lingkungan) + '</div>' +
    '<p style="margin:0;">Yang bertanda tangan di bawah ini:</p><table>' +
    '<tr><td>Nama</td><td>: <b>' + arAman(s.nama) + '</b></td></tr><tr><td>NIK</td><td>: ' + arAman(s.nik) + '</td></tr>' +
    '<tr><td>Rumah</td><td>: ' + arAman(s.rumah) + '</td></tr><tr><td>ID peserta</td><td>: ' + arAman(s.idPeserta) + '</td></tr>' +
    (s.penjamin ? '<tr><td>Penjamin</td><td>: ' + arAman(s.penjamin) + '</td></tr>' : '') + '</table>' +
    '<p style="margin:0;">dengan ini menyatakan:</p><ol>' + s.butir.map(function(b){ return '<li>' + arAman(b) + '</li>'; }).join('') + '</ol>' +
    '<div style="text-align:right;font-size:.76rem;">' + arAman(s.tempat) + ', ' + tgl + '</div>' +
    '<div class="tt"><div>Admin Arisan,<div class="kosong"></div><b>' + arAman(h.petugas || '') + '</b></div>' +
    '<div>Yang menyatakan,' + (h.ttd ? '<img src="' + h.ttd + '" alt="Tanda tangan">' : '<div class="kosong"></div>') + '<b>' + arAman(s.nama) + '</b></div></div></div>';
}

function arSiapkanTtd(){
  const c = document.getElementById('asTtd');
  if (!c) return;
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#14213d';
  let gores = false;
  const titik = function(e){ const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.addEventListener('pointerdown', function(e){
    gores = true; c.setPointerCapture(e.pointerId);
    const p = titik(e); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + 0.1, p[1] + 0.1); g.stroke();
    Ar.surat.coret = true;
  });
  c.addEventListener('pointermove', function(e){ if (!gores) return; const p = titik(e); g.lineTo(p[0], p[1]); g.stroke(); });
  c.addEventListener('pointerup', function(){ gores = false; });
  c.addEventListener('pointercancel', function(){ gores = false; });
}

function arHapusTtd(){
  const c = document.getElementById('asTtd');
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  if (Ar.surat) Ar.surat.coret = false;
}

async function arCairkan(){
  if (Ar.sibuk || !Ar.surat) return;
  if (!Ar.surat.coret) return toast('Pemenang belum tanda tangan.');
  if (!document.getElementById('asSerah').checked) return toast('Centang bahwa pot sudah diserahkan.');
  const c = document.getElementById('asTtd');
  // Perkecil supaya ringan disimpan
  const k = document.createElement('canvas');
  k.width = 600; k.height = Math.round(600 * c.height / c.width);
  k.getContext('2d').drawImage(c, 0, 0, k.width, k.height);
  Ar.sibuk = true; tunggu('Menyimpan surat & mencatat pencairan…');
  try {
    const h = await panggilAPI('arisanCairkan', { kelompok: Ar.kAdmin, kocok: Ar.surat.id, ttd: k.toDataURL('image/png') });
    selesaiTunggu(); toast(h.message); tutupLembar('lembarSuratAr'); Ar.kocok = null; await arMuatAdmin();
  } catch (e) { selesaiTunggu(); toast(e.message); }
  finally { Ar.sibuk = false; }
}

/* =================================================================
   7E-3 · PANGGUNG KOCOKAN (admin & penonton)
   Server menentukan pemenang dan jam mulai. Setiap HP memutar animasi yang sama,
   dihitung dari waktu berjalan (bisa bergabung di tengah).
   ================================================================= */
const AR_PG = { DURASI: 13, KOCOK: 8.5, CEPAT: 2.4 };

function arBukaPanggung(peran, kelompok, live, now){
  arHentikanPanggung();
  Ar.pg = { peran: peran, k: kelompok, live: null, offset: 0, raf: 0, timer: 0, idAnim: '', suara: Ar.pg ? Ar.pg.suara !== false : true, kunci: null };
  const el = document.getElementById('arPanggung');
  el.classList.add('on');
  try { if (el.requestFullscreen) el.requestFullscreen().catch(function(){}); } catch (e) {}
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function(k){ if (Ar.pg) Ar.pg.kunci = k; }).catch(function(){}); } catch (e) {}
  document.getElementById('pgSuara').textContent = Ar.pg.suara ? '🔊' : '🔇';
  arTerimaLive(live, now);
  Ar.pg.timer = setInterval(arTanyaLive, peran === 'ADMIN' ? 4000 : 2000);
}

async function arTanyaLive(){
  if (!Ar.pg || document.hidden) return;
  try {
    const h = await panggilAPI('arisanLive', { kelompok: Ar.pg.k });
    if (Ar.pg) arTerimaLive(h.live, h.now);
  } catch (e) {}
}

function arTerimaLive(live, now){
  const pg = Ar.pg;
  if (!pg) return;
  if (now) pg.offset = now - Date.now();
  if (!live) {
    // Layar ditutup admin. Penonton yang sudah melihat hasil tetap melihatnya.
    if (pg.peran !== 'ADMIN' && pg.live && pg.live.s === 'KOCOK') { clearInterval(pg.timer); arAksiPanggung('SELESAI'); return; }
    if (pg.peran !== 'ADMIN') { document.getElementById('pgInfo').innerHTML = '<div class="besar">Kocokan sudah ditutup</div>'; arAksiPanggung('TUTUP'); clearInterval(pg.timer); }
    return;
  }
  const lama = pg.live;
  pg.live = live;
  document.getElementById('pgJudul').textContent = 'KOCOKAN PUTARAN ' + live.putaran;
  document.getElementById('pgSub').textContent = (live.periode || '') + ' · ' + (live.bulan || '') + ' · pot ' + arRp(live.pot);
  if (live.s === 'SIAP') {
    if (!lama || lama.s !== 'SIAP' || lama.gulungan !== live.gulungan) {
      arBangunPanggung(live.gulungan, 'SIAP' + live.putaran);
      arGambarAdegan(-1);
    }
    document.getElementById('pgInfo').innerHTML = '<div class="besar">' + live.gulungan + ' gulungan nama di dalam gelas</div><div class="kecil">' +
      (live.daftar || []).map(function(d){ return arAman(d.nama) + (d.layak ? '' : ' (belum memenuhi syarat)'); }).join(' · ') + '</div>';
    arAksiPanggung('SIAP');
    return;
  }
  if (live.s === 'KOCOK' && pg.idAnim !== live.id) {
    pg.idAnim = live.id;
    arBangunPanggung(live.gulungan, live.id);
    arMulaiAnimasi();
  }
}

function arAksiPanggung(tahap){
  const a = document.getElementById('pgAksi'), pg = Ar.pg;
  if (pg.peran === 'ADMIN') {
    if (tahap === 'SIAP') a.innerHTML = '<button class="ar-btn ar-btn-emas ar-pg-kocok" id="pgTombolKocok" onclick="arKocokSekarang()">KOCOK!</button>';
    else if (tahap === 'SELESAI') a.innerHTML = '<button class="ar-btn ar-btn-emas" onclick="arLanjutSurat()">Lanjut: surat pernyataan pemenang</button>' +
      '<button class="ar-btn ar-btn-garis" onclick="arTutupPanggung()">Tutup layar</button>';
    else a.innerHTML = '';
  } else {
    if (tahap === 'SIAP') a.innerHTML = '<p class="ar-ket" style="text-align:center;">Menunggu Admin menekan tombol kocok…</p>';
    else if (tahap === 'SELESAI' || tahap === 'TUTUP') a.innerHTML = '<button class="ar-btn ar-btn-garis" onclick="arTutupPanggung()">Tutup</button>';
    else a.innerHTML = '';
  }
}

async function arLanjutSurat(){
  const id = Ar.pg && Ar.pg.live && Ar.pg.live.id;
  await arTutupPanggung();
  Ar.kocok = null;
  await arMuatAdmin();
  if (id) arBukaSurat(id);
}

async function arTutupPanggung(){
  const pg = Ar.pg;
  if (pg && pg.peran === 'ADMIN') {
    try { await panggilAPI('arisanBukaLayar', { kelompok: pg.k, tutup: true }); } catch (e) {}
  }
  arHentikanPanggung();
  document.getElementById('arPanggung').classList.remove('on');
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  if (pg && pg.peran === 'ADMIN' && Ar.mode === 'admin') { Ar.kocok = null; arMuatKocok(); }
  if (pg && pg.peran !== 'ADMIN' && Ar.mode === 'peserta') arMuatSaya(Ar.kSaya);
}

function arHentikanPanggung(){
  const pg = Ar.pg;
  if (!pg) return;
  clearInterval(pg.timer); cancelAnimationFrame(pg.raf);
  try { if (pg.kunci) pg.kunci.release(); } catch (e) {}
  pg.timer = 0; pg.raf = 0;
}

function arTombolSuara(){
  if (!Ar.pg) return;
  Ar.pg.suara = !Ar.pg.suara;
  arSiapkanAudio();
  document.getElementById('pgSuara').textContent = Ar.pg.suara ? '🔊' : '🔇';
}

/* ---------- ANIMASI GELAS ---------- */
function arAcak(seed){
  let h = 2166136261;
  String(seed).split('').forEach(function(c){ h = Math.imul(h ^ c.charCodeAt(0), 16777619); });
  return function(){ h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

function arBangunPanggung(n, seed){
  const r = arAcak(seed), pg = Ar.pg;
  n = Math.max(1, Math.min(Number(n) || 1, 40));
  const gul = [];
  for (let i = 0; i < n; i++) {
    const y = 342 - (i / Math.max(n - 1, 1)) * 92 * Math.min(1, n / 12) - r() * 10;
    const lebar = 82 + (352 - y) * 0.43;                    // gelas melebar ke atas
    const x = 125 + (r() - 0.5) * (lebar - 20);
    gul.push({ x: x, y: y, rot: (r() - 0.5) * 60, fase: r() * 6.28, warna: ['#c0392b', '#cca43b', '#2e86de', '#27ae60', '#8e44ad'][i % 5] });
  }
  pg.gul = gul;
  pg.pilih = Math.floor(r() * n);
  const gulSvg = function(g, id){
    return '<g id="' + id + '"><rect x="-6" y="-21" width="12" height="42" rx="3" fill="#f6ecd2" stroke="#d9c79b" stroke-width=".8"/>' +
      '<ellipse cx="0" cy="-21" rx="6" ry="2.2" fill="#e6d6ad"/><ellipse cx="0" cy="21" rx="6" ry="2.2" fill="#e6d6ad"/>' +
      '<rect x="-6" y="-3.5" width="12" height="7" fill="' + g.warna + '"/></g>';
  };
  document.getElementById('pgSvg').innerHTML =
    '<svg viewBox="0 0 380 440" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><clipPath id="pgKlip"><path d="M68 146 L82 352 Q84 362 94 362 L156 362 Q166 362 168 352 L182 146 Z"/></clipPath>' +
    '<linearGradient id="pgKaca" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/>' +
    '<stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient></defs>' +
    '<ellipse cx="125" cy="378" rx="70" ry="7" fill="#000" opacity=".35"/>' +
    '<g id="pgGelas"><path d="M61 140 L76 356 Q78 370 92 370 L158 370 Q172 370 174 356 L189 140 Z" fill="url(#pgKaca)" stroke="rgba(255,255,255,.55)" stroke-width="2"/>' +
    '<g clip-path="url(#pgKlip)">' + gul.map(function(g, i){ return gulSvg(g, 'pgG' + i); }).join('') + '</g>' +
    '<path d="M74 160 L86 340" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>' +
    '<ellipse cx="125" cy="140" rx="64" ry="5" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/></g>' +
    '<g id="pgKeluar" style="display:none">' + gulSvg(gul[pg.pilih], 'pgKeluarIsi') + '</g>' +
    '<g id="pgKertas" style="display:none">' +
      '<rect id="pgKertasBadan" x="202" y="207" width="136" height="0" fill="#fbf4e2" stroke="#d9c79b"/>' +
      '<g id="pgKertasTeks" opacity="0"><text id="pgT1" x="270" y="236" text-anchor="middle" font-size="9" fill="#8a6d1d" letter-spacing="2">PEMENANG</text>' +
      '<text id="pgT2" x="270" y="268" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="700" fill="#14213d"></text>' +
      '<text id="pgT3" x="270" y="292" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="700" fill="#14213d"></text>' +
      '<text id="pgT4" x="270" y="352" text-anchor="middle" font-size="10" fill="#555"></text>' +
      '<text id="pgT5" x="270" y="370" text-anchor="middle" font-size="12" font-weight="700" fill="#8a6d1d"></text></g>' +
      '<rect id="pgGulAtas" x="196" y="200" width="148" height="14" rx="7" fill="#e6d6ad" stroke="#cbb27a"/>' +
      '<rect id="pgGulBawah" x="196" y="200" width="148" height="14" rx="7" fill="#e6d6ad" stroke="#cbb27a"/></g>' +
    '<g id="pgKonfeti"></g></svg>';
  pg.konfeti = Array.from({ length: 46 }, function(){ return { x: 120 + r() * 260, v: 60 + r() * 90, a: r() * 6.28, w: ['#e6b422', '#e5484d', '#25d366', '#5aa9ff', '#fff'][Math.floor(r() * 5)] }; });
  document.getElementById('pgKonfeti').innerHTML = pg.konfeti.map(function(k, i){
    return '<rect id="pgK' + i + '" width="5" height="9" fill="' + k.w + '" opacity="0"/>';
  }).join('');
  pg.ekstrem = null; pg.tLalu = -99;
}

/** Fase ayunan (radian) dan amplitudo pada detik t. 7 Hz lalu melambat ke 1,4 Hz. */
function arAyun(t){
  const C = AR_PG.CEPAT, L = AR_PG.KOCOK - C;
  let siklus;
  if (t < C) siklus = 7 * t;
  else { const u = Math.min(t, AR_PG.KOCOK) - C; siklus = 7 * C + 7 * u - 5.6 * u * u / (2 * L); }
  const q = t < C ? 0 : Math.min(1, (t - C) / L);
  return { fase: 2 * Math.PI * siklus, amp: Math.pow(1 - q, 1.4) };
}

function arMudah(x){ x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

/** Menggambar keadaan pada detik t (t < 0 = diam, menunggu). */
function arGambarAdegan(t){
  const pg = Ar.pg;
  if (!pg || !pg.gul) return;
  const live = pg.live || {};
  const ay = t >= 0 && t < AR_PG.KOCOK ? arAyun(t) : { fase: 0, amp: 0 };
  const sudut = 15 * Math.sin(ay.fase) * ay.amp;
  const gelas = document.getElementById('pgGelas');
  gelas.setAttribute('transform', 'rotate(' + sudut.toFixed(2) + ' 125 370)');
  gelas.setAttribute('opacity', t > 10 ? (1 - 0.7 * arMudah((t - 10) / 0.5)).toFixed(2) : '1');
  pg.gul.forEach(function(g, i){
    const el = document.getElementById('pgG' + i);
    if (i === pg.pilih && t >= AR_PG.KOCOK) { el.setAttribute('display', 'none'); return; }
    el.removeAttribute('display');
    const s = Math.sin(ay.fase * 1.0 + g.fase);
    const dx = s * ay.amp * 7, dy = -Math.abs(Math.sin(ay.fase + g.fase)) * ay.amp * (18 + (i % 5) * 6);
    const rot = g.rot + Math.sin(ay.fase * 1.3 + g.fase) * ay.amp * 35;
    el.setAttribute('transform', 'translate(' + (g.x + dx).toFixed(1) + ' ' + (g.y + dy).toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
  });
  // Gulungan terpilih keluar dari mulut gelas, melengkung ke samping
  const kel = document.getElementById('pgKeluar'), isi = document.getElementById('pgKeluarIsi');
  if (t >= AR_PG.KOCOK && t < 10.35) {
    const g = pg.gul[pg.pilih];
    let x, y, rot, op = 1;
    if (t < 9.3) { const u = arMudah((t - AR_PG.KOCOK) / 0.8); x = g.x + (125 - g.x) * u; y = g.y + (95 - g.y) * u; rot = g.rot * (1 - u); }
    else if (t < 10) { const u = (t - 9.3) / 0.7; x = 125 + 175 * arMudah(u); y = 95 + 235 * u * u - 120 * u * (1 - u); rot = 90 * u; }
    else { const u = (t - 10) / 0.35; x = 300 - 30 * u; y = 330 - 130 * u; rot = 90; op = 1 - u; }
    kel.style.display = '';
    isi.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
    isi.setAttribute('opacity', op.toFixed(2));
  } else kel.style.display = 'none';
  // Kertas dibuka
  const ker = document.getElementById('pgKertas');
  if (t >= 10.0) {
    ker.style.display = '';
    ker.setAttribute('opacity', arMudah((t - 10) / 0.35).toFixed(2));
    const tinggi = 180 * arMudah((t - 10.35) / 1.15);
    document.getElementById('pgKertasBadan').setAttribute('height', tinggi.toFixed(1));
    document.getElementById('pgGulBawah').setAttribute('y', (200 + tinggi).toFixed(1));
    const nm = String(live.nama || '');
    let b1 = nm, b2 = '';
    if (nm.length > 12) { const sp = nm.lastIndexOf(' ', 13) > 0 ? nm.lastIndexOf(' ', 13) : nm.indexOf(' '); if (sp > 0) { b1 = nm.slice(0, sp); b2 = nm.slice(sp + 1); } }
    document.getElementById('pgT2').textContent = b1;
    document.getElementById('pgT3').textContent = b2;
    document.getElementById('pgT2').setAttribute('y', b2 ? '268' : '282');
    document.getElementById('pgT4').textContent = 'Putaran ' + (live.putaran || '') + ' · ' + (live.bulan || '');
    document.getElementById('pgT5').textContent = arRp(live.pot);
    document.getElementById('pgKertasTeks').setAttribute('opacity', arMudah((t - 11.4) / 0.5).toFixed(2));
  } else ker.style.display = 'none';
  // Konfeti
  (pg.konfeti || []).forEach(function(k, i){
    const el = document.getElementById('pgK' + i), u = t - 11.5;
    if (u < 0 || u > 2.6) { el.setAttribute('opacity', '0'); return; }
    el.setAttribute('opacity', (1 - u / 2.6).toFixed(2));
    el.setAttribute('transform', 'translate(' + (k.x + Math.sin(u * 3 + k.a) * 14).toFixed(1) + ' ' + (130 + k.v * u + 40 * u * u).toFixed(1) +
      ') rotate(' + ((k.a + u * 4) * 57).toFixed(0) + ')');
  });
}

function arMulaiAnimasi(){
  const pg = Ar.pg;
  cancelAnimationFrame(pg.raf);
  arAksiPanggung('JALAN');
  const langkah = function(){
    if (!Ar.pg || Ar.pg !== pg) return;
    const t = (Date.now() + pg.offset - pg.live.mulai) / 1000;
    const info = document.getElementById('pgInfo');
    if (t < 0) {
      info.innerHTML = '<div class="ar-pg-hitung">' + Math.ceil(-t) + '</div><div class="kecil">Kocokan dimulai…</div>';
      arGambarAdegan(-1);
    } else {
      arBunyiPada(t);
      arGambarAdegan(Math.min(t, AR_PG.DURASI));
      if (t < AR_PG.KOCOK) info.innerHTML = '<div class="besar">Mengocok ' + pg.live.gulungan + ' gulungan…</div>';
      else if (t < 11.5) info.innerHTML = '<div class="besar">Satu gulungan keluar!</div>';
      else info.innerHTML = '<div class="besar">🎉 Selamat, ' + arAman(pg.live.nama) + '!</div><div class="kecil">Pemenang putaran ' + pg.live.putaran + ' · ' + arRp(pg.live.pot) + '</div>';
    }
    if (t >= AR_PG.DURASI) { arAksiPanggung('SELESAI'); if (pg.peran !== 'ADMIN') { clearInterval(pg.timer); pg.timer = setInterval(arTanyaLive, 8000); } return; }
    pg.raf = requestAnimationFrame(langkah);
  };
  langkah();
}

/* ---------- SUARA (WebAudio, tanpa berkas) ---------- */
function arSiapkanAudio(){
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!Ar.audio) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      Ar.audio = { ctx: ctx, noise: buf };
    }
    if (Ar.audio.ctx.state === 'suspended') Ar.audio.ctx.resume();
  } catch (e) {}
}

function arNada(f, mulai, lama, vol, tipe){
  const A = Ar.audio, c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = tipe || 'sine'; o.frequency.setValueAtTime(f, mulai);
  g.gain.setValueAtTime(vol, mulai); g.gain.exponentialRampToValueAtTime(0.0001, mulai + lama);
  o.connect(g).connect(c.destination); o.start(mulai); o.stop(mulai + lama + 0.05);
  return o;
}

function arDesis(mulai, lama, vol, f1, f2, q){
  const A = Ar.audio, c = A.ctx, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise; bp.type = 'bandpass'; bp.Q.value = q || 1.2;
  bp.frequency.setValueAtTime(f1, mulai); bp.frequency.exponentialRampToValueAtTime(f2 || f1, mulai + lama);
  g.gain.setValueAtTime(vol, mulai); g.gain.exponentialRampToValueAtTime(0.0001, mulai + lama);
  s.connect(bp).connect(g).connect(c.destination); s.start(mulai); s.stop(mulai + lama + 0.05);
}

function arBunyi(jenis, kuat){
  const pg = Ar.pg;
  if (!pg || !pg.suara || !Ar.audio || Ar.audio.ctx.state !== 'running') return;
  try {
    const t = Ar.audio.ctx.currentTime + 0.01;
    if (jenis === 'kocok') {
      arDesis(t, 0.07, 0.35 * kuat, 2200 + Math.random() * 2000, 0, 2.5);
      arNada(2000 + Math.random() * 1200, t, 0.08, 0.06 * kuat, 'triangle');
    } else if (jenis === 'pop') {
      const o = arNada(620, t, 0.12, 0.25); o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    } else if (jenis === 'duk') {
      arNada(120, t, 0.18, 0.4); arDesis(t, 0.08, 0.2, 400, 0, 0.8);
    } else if (jenis === 'srek') {
      arDesis(t, 1.1, 0.18, 800, 3000, 0.9);
    } else if (jenis === 'ting') {
      [1047, 1319, 1568, 2093].forEach(function(f, i){ arNada(f, t + i * 0.12, 0.9, 0.18); });
    }
  } catch (e) {}
}

/** Memicu bunyi untuk kejadian yang terlewati sejak bingkai sebelumnya. */
function arBunyiPada(t){
  const pg = Ar.pg, lalu = pg.tLalu;
  pg.tLalu = t;
  if (t - lalu > 0.5) { pg.ekstrem = null; return; }     // baru bergabung / tab tertidur: jangan memborong bunyi
  if (t < AR_PG.KOCOK) {
    const ay = arAyun(t), idx = Math.floor((ay.fase - Math.PI / 2) / Math.PI);
    if (pg.ekstrem !== null && idx !== pg.ekstrem && ay.amp > 0.04) arBunyi('kocok', Math.max(0.2, ay.amp));
    pg.ekstrem = idx;
  }
  [[9.0, 'pop'], [10.0, 'duk'], [10.35, 'srek'], [11.5, 'ting']].forEach(function(e){ if (lalu < e[0] && t >= e[0]) arBunyi(e[1], 1); });
}

/* =================================================================
   7E-3 · PESERTA: kocokan & siaran langsung
   ================================================================= */
function arGambarKocokSaya(h){
  const k = h.kocok, kartu = document.getElementById('apKocokKartu');
  kartu.classList.toggle('ar-sembunyi', !k);
  if (!k) return;
  let x = '';
  if (k.saya) {
    if (k.saya.status === 'LAYAK') x += '<div class="ar-peringatan" style="background:rgba(37,211,102,.12);color:#8ff0b8;border-color:rgba(37,211,102,.3);">✅ Anda ikut diundi di putaran ' + k.putaran + ' (' + arAman(k.bulan) + ').</div>';
    else if (k.saya.status === 'TIDAK') x += '<div class="ar-peringatan">Anda belum memenuhi syarat putaran ' + k.putaran + ':<br>• ' + k.saya.alasan.map(arAman).join('<br>• ') + '</div>';
  }
  x += k.riwayat.length ? k.riwayat.map(function(r){
    return '<div class="ar-tagih"><span class="isi">Putaran ' + r.putaran + '<small>' + arAman(r.bulan) + '</small></span><b>' + (r.saya ? '🏆 ' : '') + arAman(r.nama) + '</b></div>';
  }).join('') : '<p>Belum ada pemenang di periode ini.</p>';
  document.getElementById('apKocok').innerHTML = x;
}

function arPantauLive(){
  clearTimeout(Ar.pantau);
  const jalan = async function(){
    if (Ar.mode !== 'peserta' || !document.getElementById('apLive') || !Ar.saya) return;
    if (!document.hidden && !(Ar.pg && document.getElementById('arPanggung').classList.contains('on'))) {
      try {
        const h = await panggilAPI('arisanLive', { kelompok: Ar.kSaya });
        arTampilBanner(h.live, h.now);
      } catch (e) {}
    }
    Ar.pantau = setTimeout(jalan, 12000);
  };
  jalan();
}

function arTampilBanner(live, now){
  const b = document.getElementById('apLive');
  if (!b) return;
  if (!live) { b.classList.add('ar-sembunyi'); return; }
  Ar.liveTerakhir = { live: live, now: now };
  b.classList.remove('ar-sembunyi');
  b.innerHTML = '<span class="titik"></span><span class="isi"><b>Kocokan putaran ' + live.putaran + ' ' + (live.s === 'KOCOK' ? 'sedang berlangsung' : 'akan dimulai') +
    '</b>' + arAman(live.bulan || '') + ' · pot ' + arRp(live.pot) + '</span><button class="ar-btn ar-btn-emas" onclick="arTonton()">Tonton</button>';
}

function arTonton(){
  arSiapkanAudio();
  const L = Ar.liveTerakhir;
  if (!L) return;
  arBukaPanggung('PENONTON', Ar.kSaya, L.live, L.now);
}

/* =================================================================
   7E-4 · KELUAR, PINDAH, BLACKLIST, TUTUP PERIODE (admin)
   ================================================================= */
function arKartuTindakLanjut(a, per){
  let h = '';
  const pindah = a.peserta.filter(function(p){ return p.pindah; });
  if (pindah.length) h += '<div class="ar-kartu"><h3>🏠 Terdeteksi pindah (' + pindah.length + ')</h3>' + pindah.map(function(p){
    return '<button class="ar-item" onclick="arDetail(\'' + arAman(p.id) + '\')"><span class="isi"><b>' + arAman(p.nama) + '</b><small>' + arAman(p.pindah) + '</small></span><span class="ar-chip">Proses</span></button>';
  }).join('') + '</div>';
  if ((a.antreKeluar || []).length) h += '<div class="ar-kartu"><h3>Antrean keluar (' + a.antreKeluar.length + ')</h3>' + a.antreKeluar.map(function(p, i){
    return '<button class="ar-item" onclick="arDetail(\'' + arAman(p.id) + '\')"><span class="ar-no">' + (i + 1) + '</span><span class="isi"><b>' + arAman(p.nama) +
      '</b><small>Diajukan ' + arTglJam(p.waktu) + '</small></span><span class="ar-chip">Proses</span></button>';
  }).join('') + '<p class="ar-ket">Pengembalian deposit dilayani sesuai urutan pengajuan.</p></div>';
  if ((a.kewajiban || []).length) h += '<div class="ar-kartu"><h3>Pengembalian iuran peserta keluar</h3>' + a.kewajiban.map(function(w){
    return '<div class="ar-tagih"><span class="isi">' + arAman(w.pemenang) + ' → ' + arAman(w.untuk) + '<small>putaran ' + w.putaran + ' · ' + arRp(w.nominal) + '</small></span>' +
      '<button class="ar-chip hijau" style="border:none;" onclick="arKewajibanLunas(\'' + arAman(w.kas) + '\',\'' + arAman(w.pemenang) + '\',\'' + arAman(w.untuk) + '\',' + w.nominal + ')">Sudah</button></div>';
  }).join('') + '<p class="ar-ket">Pemenang yang potnya berisi iuran peserta yang keluar mengembalikan bagian itu. Tekan <b>Sudah</b> setelah uangnya diterima, lalu serahkan kepada yang berhak.</p></div>';
  if (a.cadangan) h += '<div class="ar-kartu">' + arBaris('Cadangan kas', arRp(a.cadangan)) + '<p class="ar-ket">Dari deposit dan iuran yang hangus karena blacklist. Ikut menambah kas tunai untuk talangan.</p></div>';
  return h;
}

async function arAksiAdmin(api, form, pesanTunggu, tutup){
  if (Ar.sibuk) return null;
  Ar.sibuk = true; tunggu(pesanTunggu || 'Memproses…');
  try {
    const h = await panggilAPI(api, Object.assign({ kelompok: Ar.kAdmin }, form));
    selesaiTunggu();
    if (h && h.message) toast(h.message);
    if (tutup) { tutupLembar(tutup); Ar.kocok = null; await arMuatAdmin(); }
    return h;
  } catch (e) { selesaiTunggu(); toast(e.message); return null; }
  finally { Ar.sibuk = false; }
}

function arTutupPeriode(){
  if (!confirm('Tutup ' + Ar.admin.periode.label + '?\nPeserta menerima WA terima kasih dan otomatis ikut periode berikutnya.')) return;
  arAksiAdmin('arisanTutupPeriode', {}, 'Menutup periode…').then(function(h){ if (h) arMuatAdmin(); });
}

function arKewajibanLunas(kas, dari, untuk, nominal){
  if (!confirm(dari + ' sudah mengembalikan ' + arRp(nominal) + ' untuk ' + untuk + '?')) return;
  arAksiAdmin('arisanKewajibanLunas', { kas: kas }, 'Mencatat…').then(function(h){ if (h) arMuatAdmin(); });
}

async function arBukaLunasi(id){
  const h = await arAksiAdmin('arisanLunasi', { id: id }, 'Menghitung tunggakan…');
  if (!h) return;
  Ar.sel = { lunasi: id };
  document.getElementById('aiJudul').textContent = 'Lunasi tunggakan ' + h.nama;
  document.getElementById('aiIsi').innerHTML = h.item.map(function(i){
    return arBaris(arAman(i.label) + ' · putaran ' + i.putaran, arAman(i.jenis) + ' · ' + arRp(i.nominal));
  }).join('') + arBaris('<b>Total</b>', '<b>' + arRp(h.total) + '</b>') +
    '<p class="ar-ket">Talangan kembali ke kas deposit. Iuran yang dulu memotong pot diserahkan kepada pemenangnya.</p>';
  document.getElementById('aiBawah').innerHTML = '<button class="ar-btn ar-btn-emas" onclick="arKonfirmasiLunasi()">Uang ' + arRp(h.total) + ' sudah diterima</button>';
  tutupLembar('lembarDetailAr');
  bukaLembar('lembarIuranAr');
}

function arKonfirmasiLunasi(){
  arAksiAdmin('arisanLunasi', { id: Ar.sel.lunasi, konfirmasi: true }, 'Mencatat pelunasan…', 'lembarIuranAr');
}

function arTambahDeposit(){
  const n = document.getElementById('adtTambah').value.replace(/\D/g, '');
  if (!(Number(n) > 0)) return toast('Isi nominal tambahan deposit.');
  if (!confirm('Terima tambahan deposit ' + arRp(n) + ' dari ' + Ar.detail.nama + '?')) return;
  arAksiAdmin('arisanTambahDeposit', { id: Ar.detail.id, nominal: n }, 'Mencatat deposit…', 'lembarDetailAr');
}

function arProsesKeluar(aksi){
  const p = Ar.detail;
  if (!confirm(aksi === 'SETUJU' ? 'Setujui ' + p.nama + ' keluar dan kembalikan deposit ' + arRp(Math.max(0, p.deposit)) + '?' : 'Batalkan pengajuan keluar ' + p.nama + '?')) return;
  arAksiAdmin('arisanProsesKeluar', { id: p.id, aksi: aksi }, 'Memproses…', 'lembarDetailAr');
}

/* ---------- Pindah rumah ---------- */
function arMulaiPindah(){
  const p = Ar.detail;
  Ar.pindah = { id: p.id, jalur: '' };
  const pilihan = [['LANJUT', 'Lanjut dari jauh', 'Tetap ikut, iuran dibayar seperti biasa (mis. transfer).'],
                   ['OPER', 'Oper ke warga lain', 'Kursi beserta status & kewajibannya diteruskan. Tunggakan wajib lunas dulu.']];
  if (p.menang) pilihan.push(['LUNASI', 'Lunasi lalu keluar', 'Bayar seluruh sisa iuran sekaligus, lalu deposit dikembalikan.']);
  else pilihan.push(['KELUAR', 'Keluar (belum menang)', 'Putaran berkurang 1. Iurannya dikembalikan oleh pemenang yang menerimanya.']);
  document.getElementById('adtAksi').innerHTML = '<p class="ar-langkah">PINDAH RUMAH · PILIH JALUR</p>' + pilihan.map(function(x){
    return '<button class="ar-item" onclick="arJalurPindah(\'' + x[0] + '\')"><span class="isi"><b>' + x[1] + '</b><small>' + x[2] + '</small></span></button>';
  }).join('') + '<button class="ar-btn ar-btn-garis" onclick="arDetail(\'' + arAman(p.id) + '\')">Batal</button>';
}

function arJalurPindah(j){ Ar.pindah = { id: Ar.detail.id, jalur: j }; arLangkahPindah(false); }

async function arLangkahPindah(konfirmasi){
  const P = Ar.pindah, form = { id: P.id, jalur: P.jalur, konfirmasi: !!konfirmasi };
  const el = function(id){ const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  if (P.jalur === 'OPER') {
    P.nik = el('apNik') || P.nik || ''; P.rumahPj = el('apRumahPj') || P.rumahPj || '';
    const pj = document.querySelector('input[name="apPj"]:checked');
    if (pj) P.penjamin = pj.value;
    form.nik = P.nik; form.rumahPenjamin = P.rumahPj; form.penjamin = P.penjamin || '';
  }
  const h = await arAksiAdmin('arisanPindah', form, konfirmasi ? 'Memproses pindah…' : 'Memeriksa…', konfirmasi ? 'lembarDetailAr' : '');
  if (!h || konfirmasi) return;
  const w = document.getElementById('adtAksi');
  let x = '<p class="ar-langkah">PINDAH RUMAH · ' + { LANJUT: 'LANJUT DARI JAUH', OPER: 'OPER', LUNASI: 'LUNASI LALU KELUAR', KELUAR: 'KELUAR' }[P.jalur] + '</p>';
  if (h.tahap === 'NIK') {
    x += '<div class="field"><label for="apNik">NIK warga penerima oper</label><input id="apNik" inputmode="numeric" maxlength="16" value="' + arAman(P.nik || '') + '"></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="arLangkahPindah(false)">Periksa</button>';
  } else if (h.tahap === 'PENJAMIN') {
    x += '<p class="ar-ket">' + arAman(h.ringkas) + '</p><div class="field"><label for="apRumahPj">Nomor rumah penjamin</label><input id="apRumahPj" value="' + arAman(P.rumahPj || '') + '"></div>' +
      (h.calon ? (h.calon.length ? h.calon.map(function(c){
        return '<label class="ar-radio' + (c.penuh ? ' mati' : '') + '"><input type="radio" name="apPj" value="' + arAman(c.kode) + '"' + (c.penuh ? ' disabled' : '') +
          '><span><b>' + arAman(c.nama) + '</b><small>' + arAman(c.ket) + (c.penuh ? ' · sudah menjamin 2 peserta' : '') + '</small></span></label>';
      }).join('') : '<p class="ar-ket">Tidak ada calon penjamin di rumah itu.</p>') : '') +
      '<button class="ar-btn ar-btn-emas" onclick="arLangkahPindah(false)">' + (h.calon ? 'Lanjut' : 'Cari penjamin') + '</button>';
  } else {
    x += '<div class="ar-rincian"><p class="ar-ket" style="margin:0;color:#e6f1ff;">' + arAman(h.ringkas) + '</p></div>' +
      '<button class="ar-btn ar-btn-emas" onclick="if(confirm(\'Proses sekarang?\'))arLangkahPindah(true)">Proses</button>';
  }
  x += '<button class="ar-btn ar-btn-garis" onclick="arDetail(\'' + arAman(P.id) + '\')">Batal</button>';
  w.innerHTML = x;
}

/* ---------- Blacklist ---------- */
async function arMulaiBlacklist(){
  const h = await arAksiAdmin('arisanBlacklist', { id: Ar.detail.id }, 'Menghitung akibat…');
  if (!h) return;
  document.getElementById('adtAksi').innerHTML = '<p class="ar-langkah" style="color:#ff9a9d;">BLACKLIST · ' + arAman(h.nama.toUpperCase()) + '</p>' +
    '<div class="ar-rincian">' + arBaris('Hak deposit', arRp(h.hak)) + arBaris('Tunggakan', arRp(h.piutang)) +
    (h.menang ? arBaris('Sisa iuran', arRp(h.sisaIuran)) : '') + arBaris('Penjamin', arAman(h.penjamin || '-')) +
    '<p class="ar-ket" style="color:#e6f1ff;">' + arAman(h.akibat) + '</p></div>' +
    '<div class="field"><label for="abAlasan">Alasan (wajib, tercatat)</label><textarea id="abAlasan" rows="2" maxlength="150"></textarea></div>' +
    '<button class="ar-btn ar-btn-merah" onclick="arKonfirmasiBlacklist()">Blacklist ' + arAman(h.nama) + '</button>' +
    '<button class="ar-btn ar-btn-garis" onclick="arDetail(\'' + arAman(Ar.detail.id) + '\')">Batal</button>';
}

function arKonfirmasiBlacklist(){
  const alasan = document.getElementById('abAlasan').value.trim();
  if (!alasan) return toast('Tuliskan alasan blacklist.');
  if (!confirm('Yakin mem-blacklist ' + Ar.detail.nama + '? Tindakan ini tidak bisa dibatalkan dari aplikasi.')) return;
  arAksiAdmin('arisanBlacklist', { id: Ar.detail.id, alasan: alasan, konfirmasi: true }, 'Memproses…', 'lembarDetailAr');
}

/* =================================================================
   7E-4 · PESERTA: ajukan keluar, kewajiban
   ================================================================= */
function arGambarKeluarSaya(h){
  const w = document.getElementById('apKeluar');
  if (!w) return;
  let x = '';
  if (h.utang) x += '<div class="ar-peringatan">Tunggakan Anda: <b>' + arRp(h.utang) + '</b>. Selama belum lunas, Anda tidak ikut diundi dan tertahan di periode berikutnya.</div>';
  (h.kewajiban || []).forEach(function(k){
    x += '<div class="ar-peringatan">Mohon kembalikan <b>' + arRp(k.nominal) + '</b> (iuran ' + arAman(k.untuk) + ' di pot putaran ' + k.putaran + ' yang Anda terima) melalui Admin Arisan.</div>';
  });
  if (h.saya.status === 'MINTA_KELUAR') x += '<div class="ar-peringatan">Pengajuan keluar Anda sedang diproses Admin Arisan. Deposit dikembalikan sesuai antrean.</div>';
  else if (h.bisaKeluar) x += '<button class="ar-btn ar-btn-garis" style="color:#ff9a9d;border-color:rgba(229,72,77,.4);" onclick="arAjukanKeluar()">Ajukan keluar dari arisan</button>';
  w.innerHTML = x;
}

async function arAjukanKeluar(){
  const alasan = prompt('Ajukan keluar dari Arisan ' + Ar.kSaya + '?\nDeposit Anda dikembalikan sesuai antrean.\n\nAlasan (boleh dikosongkan):', '');
  if (alasan === null) return;
  tunggu('Mengirim pengajuan…');
  try { const h = await arPanggil('arisanAjukanKeluar', { kelompok: Ar.kSaya, alasan: alasan }); selesaiTunggu(); toast(h.message); arMuatSaya(Ar.kSaya); }
  catch (e) { selesaiTunggu(); toast(e.message); }
}