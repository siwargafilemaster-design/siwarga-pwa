/* =================================================================
   MESIN DOKUMEN RAPAT — dipakai RT (Tahap 5C) & PKK (Tahap 5E)
   Arsip terbuka untuk umum; membuat notulen hanya pengurus berhak.

   Berkas ini dimuat SEKALI per sesi. Modul PKK (dokumen-pkk.js)
   memuat berkas ini juga, lalu memanggil mulaiDokumen('PKK').
   ================================================================= */

const Dk = {
  org: 'RT', arsip: [], bolehBuat: false, aktif: null, urlPdf: '',
  topik: [], edIdx: -1,
  hadir: [], pilih: {}, cariHadir: '', hadirDimuat: false,
  sibuk: false
};

// Pengaturan per organisasi
const DK_ORG = {
  RT: {
    judul: 'Dokumen Rapat RT', judulBuat: 'Notulen Rapat RT',
    judulHadir: 'C. DAFTAR HADIR (KEPALA KELUARGA)', aksiHadir: 'daftarHadirRT',
    aksiSimpan: 'simpanNotulen', kosongHadir: 'Belum ada Kepala Keluarga aktif.',
    muatHadir: 'Memuat daftar Kepala Keluarga…',
    bawaan: { waktu: '19.30 WIB - Selesai', tempat: 'Balai Pertemuan Warga',
              pemimpin: 'Ketua RT', notulis: 'Sekretaris RT' }
  },
  PKK: {
    judul: 'Dokumen Rapat PKK', judulBuat: 'Notulen Rapat PKK',
    judulHadir: 'C. DAFTAR HADIR (ANGGOTA PKK)', aksiHadir: 'daftarHadirPKK',
    aksiSimpan: 'simpanNotulenPKK', kosongHadir: 'Belum ada anggota PKK aktif.',
    muatHadir: 'Memuat daftar anggota PKK…',
    bawaan: { waktu: '16.00 WIB - Selesai', tempat: 'Balai Pertemuan Warga',
              pemimpin: 'Ketua PKK', notulis: 'Sekretaris PKK' }
  }
};

async function init_dokumen_rt(){ await mulaiDokumen('RT'); }

async function mulaiDokumen(org){
  // HTML diambil baru tiap kunjungan → buang keadaan lama
  Dk.org = DK_ORG[org] ? org : 'RT';
  const cfg = DK_ORG[Dk.org];
  document.getElementById('dkJudulHalaman').textContent = cfg.judul;
  document.getElementById('nbJudul').textContent = cfg.judulBuat;
  document.getElementById('nbJudulHadir').textContent = cfg.judulHadir;
  dkBuangPdf();
  Dk.arsip = []; Dk.bolehBuat = false; Dk.aktif = null;
  Dk.topik = []; Dk.edIdx = -1;
  Dk.hadir = []; Dk.pilih = {}; Dk.cariHadir = ''; Dk.hadirDimuat = false;
  Dk.sibuk = false;
  await muatArsip();
}

/* ---------- ARSIP ---------- */
async function muatArsip(){
  const kotak = document.getElementById('dkDaftar');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Memuat arsip notulen…</div>';
  try {
    const h = await panggilAPI('arsipNotulen', Dk.org);
    Dk.arsip = h.data || [];
    Dk.bolehBuat = !!h.bolehBuat;
    document.getElementById('dkBuat').classList.toggle('dk-sembunyi', !Dk.bolehBuat);
    gambarArsip();
  } catch (e) {
    document.getElementById('dkSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + dkAman(e.message) + '</p></div>';
  }
}

function gambarArsip(){
  const kotak = document.getElementById('dkDaftar');
  document.getElementById('dkSub').textContent = Dk.arsip.length + ' notulen';

  if (!Dk.arsip.length){
    kotak.innerHTML = '<div class="kosong"><h2>Belum ada notulen</h2><p>Notulen rapat ' + Dk.org + ' yang disimpan akan muncul di sini.</p></div>';
    return;
  }

  kotak.innerHTML = Dk.arsip.map(function(d, i){
    const judul = (d.tanggal || '').replace(/^'/, '') || d.nama;
    return '<button class="dk-kartu" onclick="bukaNotulen(' + i + ')">' +
      '<div class="dk-ikon"><svg class="ic"><use href="#i-folder"/></svg></div>' +
      '<div class="isi"><b>' + dkAman(judul) + '</b><small>' + dkAman(d.nama) + '</small></div>' +
    '</button>';
  }).join('');
}

/* ---------- BACA NOTULEN ---------- */
async function bukaNotulen(i){
  const d = Dk.arsip[i];
  if (!d) return;
  Dk.aktif = d;
  dkBuangPdf();

  document.getElementById('dkJudul').textContent = 'Notulen Rapat';
  document.getElementById('dkIsi').innerHTML = '<div class="memuat">Membuka notulen…</div>';
  bukaLembar('lembarNotulen');

  try {
    const n = await panggilAPI('detailNotulen', Dk.org, d.gid);
    if (!Dk.aktif || Dk.aktif.gid !== d.gid) return;   // sudah membuka yang lain
    gambarNotulen(n);
  } catch (e) {
    document.getElementById('dkIsi').innerHTML =
      '<div class="kosong"><h2>Gagal membuka</h2><p>' + dkAman(e.message) + '</p></div>';
  }
}

function gambarNotulen(n){
  const f = n.info;
  let h = '<div class="dk-info">' +
    dkBaris('Tanggal', f.tanggal) + dkBaris('Waktu', f.waktu) + dkBaris('Tempat', f.tempat) +
    dkBaris('Pemimpin', f.pemimpin) + dkBaris('Notulis', f.notulis) +
    dkBaris('Kehadiran', f.hadir || (n.hadir.length + ' orang')) +
  '</div>';

  h += '<div class="dk-judul">TOPIK PEMBAHASAN</div>';
  h += n.topik.length ? n.topik.map(function(t){
    const st = t.status && t.status !== '-'
      ? '<span class="dk-st ' + dkAman(t.status) + '">' + dkAman(t.status.toUpperCase()) + '</span>' : '';
    const tenggat = [t.tgl, t.jam].filter(function(x){ return x && x !== '-'; }).join(' ');
    return '<div class="dk-topik">' +
      '<div class="dk-topik-atas"><span class="dk-no">' + dkAman(t.no) + '</span><b>' + dkAman(t.topik) + '</b>' + st + '</div>' +
      dkSub('Ringkasan', t.ringkasan) + dkSub('Keputusan', t.keputusan) + dkSub('Tindak lanjut', t.tindak) +
      dkSub('PIC', [t.pic, tenggat].filter(function(x){ return x && x !== '-'; }).join(' · ')) +
    '</div>';
  }).join('') : '<div style="font-size:.78rem;color:var(--muted);">Tidak ada topik.</div>';

  h += '<div class="dk-judul">DAFTAR HADIR <span class="dk-hitung">' + n.hadir.length + ' orang</span></div>';
  h += n.hadir.length ? '<div>' + n.hadir.map(function(a){
    return '<span class="dk-hadir-chip"><b>' + dkAman(a.blok) + '</b>' + dkAman(a.nama) + '</span>';
  }).join('') + '</div>' : '<div style="font-size:.78rem;color:var(--muted);">Daftar hadir kosong.</div>';

  document.getElementById('dkIsi').innerHTML = h;
}

/* ---------- PDF ---------- */
async function siapkanPdf(){
  const d = Dk.aktif;
  const btn = document.getElementById('dkBtnPdf');
  if (!d || btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Menyiapkan PDF…';
  try {
    const r = await panggilAPI('pdfNotulen', Dk.org, d.gid);
    if (!Dk.aktif || Dk.aktif.gid !== d.gid) return;

    const bin = atob(r.pdfData);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    Dk.urlPdf = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));

    const a = document.getElementById('dkLinkPdf');
    a.href = Dk.urlPdf;
    a.download = r.filename || (d.nama + '.pdf');
    a.classList.remove('dk-sembunyi');
    btn.classList.add('dk-sembunyi');
    toast('PDF siap. Ketuk "Simpan PDF".');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Siapkan PDF';
  }
}

/** Buang PDF lama dan kembalikan tombol ke keadaan awal. */
function dkBuangPdf(){
  if (Dk.urlPdf){ try { URL.revokeObjectURL(Dk.urlPdf); } catch (e) {} }
  Dk.urlPdf = '';
  const a = document.getElementById('dkLinkPdf');
  const b = document.getElementById('dkBtnPdf');
  if (a) a.classList.add('dk-sembunyi');
  if (b) b.classList.remove('dk-sembunyi');
}

/* ---------- BUAT NOTULEN ---------- */
function mulaiBuatNotulen(){
  document.getElementById('nbTgl').value = dkHariIni();
  document.getElementById('nbWaktu').value = DK_ORG[Dk.org].bawaan.waktu;
  document.getElementById('nbTempat').value = DK_ORG[Dk.org].bawaan.tempat;
  document.getElementById('nbPemimpin').value = DK_ORG[Dk.org].bawaan.pemimpin;
  document.getElementById('nbNotulis').value = DK_ORG[Dk.org].bawaan.notulis;
  document.getElementById('nbGalat').textContent = '';
  document.getElementById('nbCariHadir').value = '';
  Dk.topik = []; Dk.pilih = {}; Dk.cariHadir = '';
  gambarTopik();
  bukaLembar('lembarBuatNotulen');
  muatHadir();
}

function tutupBuatNotulen(){
  if ((Dk.topik.length || Object.keys(Dk.pilih).length) &&
      !confirm('Notulen belum disimpan. Tutup dan buang isiannya?')) return;
  tutupLembar('lembarBuatNotulen');
}

/* --- Topik --- */
function gambarTopik(){
  document.getElementById('nbJmlTopik').textContent = Dk.topik.length + ' topik';
  document.getElementById('nbTopik').innerHTML = Dk.topik.map(function(t, i){
    const tenggat = [t.tgl, t.jam].filter(Boolean).join(' ');
    const pic = [t.pic !== '-' ? t.pic : '', tenggat].filter(Boolean).join(' · ');
    return '<div class="dk-topik">' +
      '<div class="dk-topik-atas"><span class="dk-no">' + (i + 1) + '</span><b>' + dkAman(t.topik) + '</b>' +
        (t.isKalender ? '<span class="dk-st Selesai">KALENDER</span>' : '') + '</div>' +
      dkSub('Ringkasan', t.ringkasan) +
      dkSub('Keputusan', t.keputusan) +
      dkSub('Tindak lanjut', t.tindak) +
      dkSub('PIC / Tenggat', pic) +
      '<div class="dk-aksi"><button class="ubah" onclick="bukaTopik(' + i + ')">Ubah</button>' +
      '<button class="hapus" onclick="hapusTopik(' + i + ')">Hapus</button></div>' +
    '</div>';
  }).join('');
}

function bukaTopik(i){
  Dk.edIdx = i;
  const t = i >= 0 ? Dk.topik[i] : {};
  const isi = function(id, v){ document.getElementById(id).value = (v && v !== '-') ? v : ''; };
  document.getElementById('tpJudulLembar').textContent = i >= 0 ? 'Ubah Topik ' + (i + 1) : 'Tambah Topik';
  isi('tpTopik', t.topik); isi('tpRingkasan', t.ringkasan); isi('tpKeputusan', t.keputusan);
  isi('tpTindak', t.tindak); isi('tpPic', t.pic); isi('tpTgl', t.tgl); isi('tpJam', t.jam);
  document.getElementById('tpKalender').checked = !!t.isKalender;
  document.getElementById('tpGalat').textContent = '';
  bukaLembar('lembarTopik');

  // Tinggi kotak menyesuaikan isi (setelah lembar tampil, supaya ukurannya terbaca)
  setTimeout(function(){
    ['tpRingkasan', 'tpKeputusan', 'tpTindak'].forEach(function(id){ dkTumbuh(document.getElementById(id)); });
  }, 60);
}

function simpanTopik(){
  const v = function(id){ return document.getElementById(id).value.trim(); };
  const galat = document.getElementById('tpGalat');
  const t = {
    topik: v('tpTopik'), ringkasan: v('tpRingkasan') || '-', keputusan: v('tpKeputusan') || '-',
    tindak: v('tpTindak') || '-', pic: v('tpPic') || '-', tgl: v('tpTgl'), jam: v('tpJam'),
    isKalender: document.getElementById('tpKalender').checked
  };
  if (!t.topik) return (galat.textContent = 'Judul topik wajib diisi.');
  if (t.isKalender && !t.tgl) return (galat.textContent = 'Masuk kalender butuh tanggal tenggat.');

  if (Dk.edIdx >= 0) Dk.topik[Dk.edIdx] = t; else Dk.topik.push(t);
  tutupLembar('lembarTopik');
  gambarTopik();
}

function hapusTopik(i){
  if (!confirm('Hapus topik "' + Dk.topik[i].topik + '"?')) return;
  Dk.topik.splice(i, 1);
  gambarTopik();
}

/* --- Daftar hadir --- */
async function muatHadir(){
  const kotak = document.getElementById('nbHadir');
  if (Dk.hadirDimuat){ gambarHadir(); return; }
  kotak.innerHTML = '<div class="memuat">' + DK_ORG[Dk.org].muatHadir + '</div>';
  try {
    Dk.hadir = (await panggilAPI(DK_ORG[Dk.org].aksiHadir)) || [];
    Dk.hadirDimuat = true;
    gambarHadir();
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><p>' + dkAman(e.message) + '</p></div>';
  }
}

function gambarHadir(){
  const q = Dk.cariHadir.trim().toLowerCase();
  const kotak = document.getElementById('nbHadir');
  const baris = [];
  Dk.hadir.forEach(function(a, i){
    if (q && (a.blok + ' ' + a.nama).toLowerCase().indexOf(q) === -1) return;
    baris.push('<label class="dk-orang"><input type="checkbox" ' + (Dk.pilih[i] ? 'checked ' : '') +
      'onchange="pilihHadir(' + i + ', this.checked)"><span class="blok">' + dkAman(a.blok) + '</span>' +
      dkAman(a.nama) + '</label>');
  });
  kotak.innerHTML = baris.length ? baris.join('') :
    '<div class="kosong"><p>' + (Dk.hadir.length ? 'Tidak ada yang cocok.' : DK_ORG[Dk.org].kosongHadir) + '</p></div>';
  document.getElementById('nbJmlHadir').textContent = Object.keys(Dk.pilih).length + ' orang';
}

function pilihHadir(i, ya){
  if (ya) Dk.pilih[i] = true; else delete Dk.pilih[i];
  document.getElementById('nbJmlHadir').textContent = Object.keys(Dk.pilih).length + ' orang';
}

/* --- Simpan --- */
async function simpanNotulen(){
  if (Dk.sibuk) return;
  const v = function(id){ return document.getElementById(id).value.trim(); };
  const galat = document.getElementById('nbGalat');
  galat.textContent = '';

  if (!v('nbTgl')) return (galat.textContent = 'Tanggal rapat belum diisi.');
  if (!Dk.topik.length) return (galat.textContent = 'Tambahkan minimal satu topik.');

  const hadir = Object.keys(Dk.pilih).map(function(i){ return Dk.hadir[i]; });
  if (!confirm('Simpan notulen rapat ' + v('nbTgl') + ' dengan ' + Dk.topik.length + ' topik dan ' +
               hadir.length + ' orang hadir?')) return;

  Dk.sibuk = true;
  tunggu('Menyimpan notulen…', 'Membuat dokumen dari template dan mencatat ke kalender.');
  try {
    const h = await panggilAPI(DK_ORG[Dk.org].aksiSimpan, {
      tgl: v('nbTgl'), waktu: v('nbWaktu'), tempat: v('nbTempat'),
      pemimpin: v('nbPemimpin'), notulis: v('nbNotulis'),
      topik: Dk.topik, hadir: hadir
    });
    selesaiTunggu();
    Dk.topik = []; Dk.pilih = {};
    tutupLembar('lembarBuatNotulen');
    toast(h.message || 'Notulen tersimpan');
    await muatArsip();
  } catch (e) {
    selesaiTunggu();
    galat.textContent = e.message;
  } finally {
    Dk.sibuk = false;
  }
}

/* ---------- ALAT ---------- */
/** Kotak tulisan memanjang mengikuti isi, sehingga semua tulisan selalu terlihat. */
function dkTumbuh(el){
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(88, el.scrollHeight + 2) + 'px';
}

function dkAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}
function dkBaris(label, nilai){
  return '<div class="dk-baris"><span>' + dkAman(label) + '</span><b>' +
         dkAman(String(nilai || '-').replace(/^'/, '')) + '</b></div>';
}
function dkSub(label, nilai){
  if (!nilai || nilai === '-') return '';
  return '<div class="dk-sub"><span>' + dkAman(label.toUpperCase()) + '</span>' + dkAman(nilai) + '</div>';
}
function dkHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}