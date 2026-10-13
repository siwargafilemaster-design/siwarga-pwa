/* =================================================================
   app.js — kerangka aplikasi
   ================================================================= */

const MENU = [
  { key:'home',        folder:'dashboard',    label:'Beranda',              ikon:'i-home' },

  { grup:'Menu RT' },
  { key:'rumah',       folder:'rumah',        label:'Database Rumah',       ikon:'i-house' },
  { key:'datapokok',   folder:'data-pokok',   label:'Data Pokok',           ikon:'i-idcard' },
  { key:'keuangan',    folder:'keuangan-rt',  label:'Keuangan RT',          ikon:'i-wallet' },
  { key:'verifikasi',  folder:'verifikasi',   label:'Verifikasi Setoran',   ikon:'i-shieldcheck', izin:'VERIFIKASI' },
  { key:'dokumen-rt',  folder:'dokumen-rt',   label:'Dokumen Rapat RT',     ikon:'i-folder' },

  { grup:'Menu PKK' },
  { key:'pkk',         folder:'pkk',          label:'Database PKK',         ikon:'i-users' },
  { key:'keuangan-pkk',folder:'keuangan-pkk', label:'Keuangan PKK',         ikon:'i-coin' },
  { key:'dokumen-pkk', folder:'dokumen-pkk',  label:'Dokumen Rapat PKK',    ikon:'i-book' },
  { key:'laporan-pkk', folder:'laporan-pkk',  label:'Laporan Kinerja PKK',  ikon:'i-clip' },

  { grup:'Administrasi' },
  { key:'peta',        folder:'peta',         label:'Denah Lingkungan',     ikon:'i-map' },
  { key:'pengurus',    folder:'pengurus',     label:'Daftar Pengurus',      ikon:'i-tree' },
  { key:'surat',       folder:'surat',        label:'Layanan Surat',        ikon:'i-mail', izin:'SURAT' },
  { key:'setting',     folder:'setting',      label:'Pengaturan',           ikon:'i-gear' },

  { grup:'Management Property' },
  { key:'humas',       folder:'humas',        label:'Layanan Hunian',       ikon:'i-shield' },

  { grup:'Fitur Extra', extra:true },
  { key:'arisan',      folder:'arisan',       label:'Arisan Warga',         ikon:'i-gift', extra:true },
  { key:'tabungan',    folder:'tabungan',     label:'Bank PKK',             ikon:'i-bank', extra:true }
];

const GRUP_UI = {
  VERIFIKASI: ['DEVELOPER','BENDAHARA'],
  SURAT:      ['DEVELOPER','RT','SEKRETARIS']
};

const NAV_PERAN = {
  GUEST:      ['home','rumah','peta','arisan'],
  RT:         ['home','rumah','surat','dokumen-rt'],
  SEKRETARIS: ['home','datapokok','surat','dokumen-rt'],
  BENDAHARA:  ['home','keuangan','verifikasi','rumah'],
  PKK:        ['home','pkk','keuangan-pkk','laporan-pkk'],
  HUMAS:      ['home','humas','rumah','peta'],
  TELLER:     ['home','tabungan','keuangan-pkk','pkk'],
  DEVELOPER:  ['home','keuangan','rumah','setting']
};

const LABEL_PERAN = {
  GUEST:'Mode Tamu', RT:'Admin RT', SEKRETARIS:'Sekretaris',
  BENDAHARA:'Bendahara RT', PKK:'Admin PKK', HUMAS:'Admin Humas',
  TELLER:'Admin Bank PKK', DEVELOPER:'Super Admin'
};

const LABEL_PENDEK = {
  home:'Beranda', rumah:'Rumah', datapokok:'Data Pokok', keuangan:'Kas RT',
  verifikasi:'Verifikasi', 'dokumen-rt':'Dokumen', pkk:'Anggota',
  'keuangan-pkk':'Kas PKK', 'dokumen-pkk':'Dokumen', 'laporan-pkk':'Laporan',
  peta:'Denah', pengurus:'Pengurus', surat:'Surat', setting:'Setelan',
  humas:'Hunian', arisan:'Arisan', tabungan:'Bank PKK'
};

const App = {
  peran: 'GUEST',
  halaman: 'home',
  identitas: null,
  dataBeranda: null,     // diisi saat pembuka, dipakai modul dashboard
  modulTerpasang: {}
};

const $ = (id) => document.getElementById(id);

/* ---------- ALAT ---------- */
function cariMenu(key){ return MENU.find(m => m.key === key); }

function bolehLihat(item){
  if (!item.izin) return true;
  return (GRUP_UI[item.izin] || []).indexOf(App.peran) !== -1;
}

function toast(pesan){
  const t = $('toast');
  t.textContent = pesan;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}

function terapkanIdentitas(cfg){
  if (!cfg) return;
  App.identitas = cfg;
  document.title = cfg.appName || 'SiWARGA';
  $('drNama').textContent = cfg.appName || 'SiWARGA';
  $('drSub').textContent  = cfg.namaRT  || '';
  if (cfg.theme) document.documentElement.style.setProperty('--hero-1', cfg.theme);
}

/* ---------- DRAWER ---------- */
function bukaDrawer(){ $('drawer').classList.add('on'); $('scrim').classList.add('on'); }
function tutupDrawer(){ $('drawer').classList.remove('on'); $('scrim').classList.remove('on'); }

function gambarDrawer(){
  const kotak = $('drMenu');
  kotak.innerHTML = '';

  MENU.forEach(item => {
    if (item.grup){
      const h = document.createElement('div');
      h.className = 'dr-grp' + (item.extra ? ' dr-grp--x' : '');
      h.textContent = item.grup;
      kotak.appendChild(h);
      return;
    }
    if (!bolehLihat(item)) return;

    const a = document.createElement('div');
    a.className = 'dr-item' + (item.extra ? ' dr-item--x' : '') +
                  (item.key === App.halaman ? ' on' : '');
    a.innerHTML = '<svg class="ic"><use href="#' + item.ikon + '"/></svg>' + item.label;
    a.onclick = () => { pergiKe(item.key); tutupDrawer(); };
    kotak.appendChild(a);
  });

  $('drRole').textContent = LABEL_PERAN[App.peran] || App.peran;
  $('btnAkun').textContent = (App.peran === 'GUEST') ? 'Login' : 'Logout';
}

/* ---------- BOTTOM NAV ---------- */
function gambarBnav(){
  const nav = $('bnav');
  nav.innerHTML = '';

  (NAV_PERAN[App.peran] || NAV_PERAN.GUEST).forEach(key => {
    const item = cariMenu(key);
    if (!item) return;

    const b = document.createElement('button');
    b.dataset.key = key;
    if (key === App.halaman) b.classList.add('on');
    b.innerHTML = '<svg class="ic"><use href="#' + item.ikon + '"/></svg>' +
                  '<span>' + (LABEL_PENDEK[key] || item.label) + '</span>';
    b.onclick = () => pergiKe(key);
    nav.appendChild(b);
  });

  const m = document.createElement('button');
  m.innerHTML = '<svg class="ic"><use href="#i-grid"/></svg><span>Menu</span>';
  m.onclick = bukaDrawer;
  nav.appendChild(m);
}

/* ---------- PERPINDAHAN HALAMAN ---------- */
async function pergiKe(key){
  const item = cariMenu(key);
  if (!item) return;

  if (!bolehLihat(item)){
    toast('Menu ini khusus pengurus tertentu.');
    return;
  }

  App.halaman = key;
  $('btnSos').classList.toggle('sembunyi', key !== 'home');
  gambarBnav();
  gambarDrawer();

  const konten = $('konten');
  konten.innerHTML = '<div class="memuat">Memuat…</div>';

  try {
    const html = await fetch('/modul/' + item.folder + '/' + item.folder + '.html')
                        .then(r => { if(!r.ok) throw new Error('404'); return r.text(); });
    konten.innerHTML = html;
  } catch (e) {
    konten.innerHTML =
      '<div class="plain-head"><button class="hero-btn" onclick="bukaDrawer()">' +
      '<svg class="ic"><use href="#i-menu"/></svg></button>' +
      '<div><h1>' + item.label + '</h1><small>Belum dibangun</small></div></div>' +
      '<div class="kosong"><h2>Modul ini menyusul</h2>' +
      '<p>Halaman ' + item.label + ' belum dipindahkan ke aplikasi baru. ' +
      'Sementara masih bisa diakses lewat SiWARGA yang lama.</p></div>' +
      '<div class="pad-bot"></div>';
    return;
  }

  if (!App.modulTerpasang[item.folder]){
    try {
      await new Promise((selesai, gagal) => {
        const s = document.createElement('script');
        s.src = '/modul/' + item.folder + '/' + item.folder + '.js';
        s.onload = selesai; s.onerror = gagal;
        document.body.appendChild(s);
      });
      App.modulTerpasang[item.folder] = true;
    } catch (e) { /* modul tanpa js */ }
  }

  const namaInit = 'init_' + item.folder.replace(/-/g, '_');
  if (typeof window[namaInit] === 'function'){
    try { window[namaInit](); } catch (e) { console.error(namaInit, e); }
  }
}

/* ---------- LOGIN ---------- */
function bukaLogin(){
  $('galatLogin').classList.remove('on');
  $('inPin').value = '';
  $('sheetLogin').classList.add('on');
  setTimeout(() => $('inPin').focus(), 200);
}
function tutupLogin(){ $('sheetLogin').classList.remove('on'); }

async function prosesLogin(){
  const peran = $('inRole').value;
  const pin   = $('inPin').value.trim();
  const galat = $('galatLogin');

  if (!pin){ galat.textContent = 'PIN belum diisi.'; galat.classList.add('on'); return; }

  const tombol = $('btnMasuk');
  tombol.disabled = true; tombol.textContent = 'Memeriksa…';

  try {
    const hasil = await panggilAPI('login', peran, pin);
    simpanToken(hasil.token);
    App.peran = hasil.role;
    localStorage.setItem('siwarga_peran', hasil.role);

    tutupLogin();
    tutupDrawer();
    toast('Masuk sebagai ' + (LABEL_PERAN[hasil.role] || hasil.role));
    pergiKe(hasil.landing || 'home');

  } catch (e) {
    galat.textContent = e.message;
    galat.classList.add('on');
  } finally {
    tombol.disabled = false; tombol.textContent = 'Masuk';
  }
}

async function prosesLogout(){
  try { await panggilAPI('logout'); } catch (e) {}
  buangToken();
  localStorage.removeItem('siwarga_peran');
  hapusSemuaIngatan();
  App.peran = 'GUEST';
  tutupDrawer();
  toast('Sudah keluar');
  pergiKe('home');
}

/* ---------- SOS ---------- */
async function kirimSinyal(jenis, lokasi){
  try {
    const hasil = await panggilAPI('kirimSOS', jenis, lokasi, '');
    toast(hasil && hasil.message ? hasil.message : 'Sinyal terkirim');
  } catch (e) {
    toast('Gagal mengirim: ' + e.message);
  }
}

/* =================================================================
   MULAI — inilah bagian yang membuat aplikasi terasa cepat
   ================================================================= */
async function mulai(){

  // --- LANGKAH 1: tampilkan dari ingatan HP, SEKETIKA ---
  // Tidak menunggu server sama sekali. Layar langsung terisi.
  const peranTersimpan = localStorage.getItem('siwarga_peran');
  if (peranTersimpan) App.peran = peranTersimpan;

  const cfgLama = ambilIngatan('config');
  if (cfgLama) terapkanIdentitas(cfgLama);

  const berandaLama = ambilIngatan('beranda');
  if (berandaLama) App.dataBeranda = berandaLama;

  gambarBnav();
  gambarDrawer();
  pergiKe('home');

  // --- LANGKAH 2: satu panggilan ke server, di belakang layar ---
  try {
    const d = await panggilAPI('pembuka');

    if (d.config){
      terapkanIdentitas(d.config);
      simpanIngatan('config', d.config);
    }

    // Peran dari server yang menentukan, bukan yang tersimpan di HP
    const peranBaru = (d.sesi && d.sesi.login) ? d.sesi.role : 'GUEST';
    const peranBerubah = (peranBaru !== App.peran);

    App.peran = peranBaru;
    if (peranBaru === 'GUEST') localStorage.removeItem('siwarga_peran');
    else localStorage.setItem('siwarga_peran', peranBaru);

    if (peranBerubah){ gambarBnav(); gambarDrawer(); }

    if (d.beranda){
      App.dataBeranda = d.beranda;
      simpanIngatan('beranda', d.beranda);

      // Kalau modul Beranda sedang terbuka, segarkan isinya
      if (App.halaman === 'home' && typeof segarkan_dashboard === 'function'){
        segarkan_dashboard(d.beranda);
      }
    }

  } catch (e) {
    console.error('Pembuka gagal:', e);
    if (!berandaLama) toast('Gagal menghubungi server');
  }
}

/* ---------- PASANG PENDENGAR ---------- */
$('scrim').onclick    = tutupDrawer;
$('btnBatal').onclick = tutupLogin;
$('btnMasuk').onclick = prosesLogin;
$('inPin').addEventListener('keydown', e => { if (e.key === 'Enter') prosesLogin(); });

$('btnAkun').onclick = () => {
  if (App.peran === 'GUEST') bukaLogin(); else prosesLogout();
};

$('btnSos').onclick = () => {
  if (typeof bukaKentongan === 'function') bukaKentongan();
};

window.addEventListener('sesi-habis', () => {
  App.peran = 'GUEST';
  localStorage.removeItem('siwarga_peran');
  gambarBnav(); gambarDrawer();
  toast('Sesi berakhir, silakan login lagi');
  bukaLogin();
});

mulai();