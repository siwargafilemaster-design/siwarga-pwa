/* =================================================================
   MODUL DENAH LINGKUNGAN (Tahap 7B)
   Gambar dasar /aset/peta-dasar.jpg (lebar 1000 px) + titik dari sheet PETA_Titik.
   Zoom & geser: Panzoom 4.5.1 (dimuat sekali saat halaman ini pertama dibuka).
   ================================================================= */

const Pt = { data: null, rumah: {}, pz: null, atur: false, pilih: '', tekan: null, sibuk: false };
const PT_PANZOOM = 'https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js';
const PT_LEBAR = 1000;
const PT_WARNA = { 'pt-milik': '#22c55e', 'pt-kontrak': '#facc15', 'pt-numpang': '#22d3ee',
                   'pt-kosong': '#9ca3af', 'pt-lain': '#ec4899', 'pt-tanpa': '#9ca3af' };

async function init_peta(){
  Pt.data = null; Pt.rumah = {}; Pt.pz = null; Pt.atur = false; Pt.pilih = ''; Pt.tekan = null; Pt.sibuk = false;
  document.getElementById('ptPanel').classList.add('pt-sembunyi');
  ptAturTinggi();
  window.removeEventListener('resize', ptAturTinggi);
  window.addEventListener('resize', ptAturTinggi);

  const jendela = document.getElementById('ptJendela');
  jendela.addEventListener('pointerdown', ptPointerTurun, true);
  jendela.addEventListener('pointerup', ptPointerNaik, true);

  const muat = muatPeta();
  try { await Promise.all([ptMuatPanzoom(), ptGambarSiap()]); }
  catch (e) { toast(e.message); }
  ptPasangZoom();
  await muat;
}

/* ---------- PERSIAPAN ---------- */
function ptAturTinggi(){
  const j = document.getElementById('ptJendela');
  if (!j) return;
  const atas = j.getBoundingClientRect().top;
  const nav = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navh')) || 64;
  j.style.height = Math.max(320, window.innerHeight - atas - nav - 16) + 'px';
}

function ptMuatPanzoom(){
  if (window.Panzoom) return Promise.resolve();
  return new Promise(function(ok, gagal){
    const s = document.createElement('script');
    s.src = PT_PANZOOM;
    s.onload = ok;
    s.onerror = function(){ gagal(new Error('Alat zoom gagal dimuat. Peta tetap bisa digeser.')); };
    document.head.appendChild(s);
  });
}

function ptGambarSiap(){
  const img = document.getElementById('ptGambar');
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise(function(ok, gagal){
    img.onload = ok;
    img.onerror = function(){ gagal(new Error('Gambar peta tidak ditemukan (aset/peta-dasar.jpg).')); };
  });
}

function ptPasangZoom(){
  const peta = document.getElementById('ptPeta');
  const jendela = document.getElementById('ptJendela');
  const w = jendela.clientWidth;
  // Peta selebar jendela. Huruf label & fasilitas diskalakan dari lebar rancangan 1000 px.
  peta.style.width = w + 'px';
  peta.style.fontSize = (16 * w / PT_LEBAR) + 'px';
  if (!window.Panzoom) return;
  Pt.pz = Panzoom(peta, { minScale: 1, maxScale: 8, contain: 'outside', cursor: 'grab' });
  jendela.addEventListener('wheel', Pt.pz.zoomWithWheel, { passive: false });
  peta.addEventListener('panzoomchange', function(e){ ptSkalaPin(e.detail.scale); });
  ptSkalaPin(1);
}

function pasPeta(){
  if (Pt.pz) Pt.pz.reset({ animate: true });
}

/** Pin & nomor rumah tetap seukuran di layar, berapa pun zoom-nya. */
function ptSkalaPin(skala){
  document.getElementById('ptRumah').style.setProperty('--inv', String(1 / (skala || 1)));
}

/* ---------- DATA ---------- */
async function muatPeta(){
  if (!document.getElementById('ptSub')) return;
  const kunci = 'peta_' + App.peran;            // isi berbeda per peran (mis. tombol Atur pin)
  const lama = ambilIngatan(kunci);
  if (lama && !Pt.data) ptPakaiData(lama);      // langsung tampil dari ingatan HP
  else if (!Pt.data) tbTeksPt('ptSub', 'Memuat…');

  try {
    const h = await panggilAPI('peta');
    simpanIngatan(kunci, h);
    if (!document.getElementById('ptSub')) return;   // pengguna sudah pindah halaman
    ptPakaiData(h);
  } catch (e) {
    if (!Pt.data) tbTeksPt('ptSub', 'Gagal memuat');
    toast(e.message);
  }
}

function ptPakaiData(h){
  Pt.data = h;
  Pt.rumah = {};
  h.rumah.forEach(function(r){ Pt.rumah[r.no.replace(/\s/g, '')] = r; });
  document.getElementById('ptTombolAtur').classList.toggle('pt-sembunyi', !h.bolehUbah);
  gambarPeta();
}

function ptKelas(r){
  if (!r) return 'pt-tanpa';
  if (!r.dihuni) return 'pt-kosong';
  const s = String(r.status || '').toUpperCase();
  if (/MILIK|TETAP/.test(s)) return 'pt-milik';
  if (/KONTRAK|SEWA|PENGONTRAK/.test(s)) return 'pt-kontrak';
  if (/NUMPANG/.test(s)) return 'pt-numpang';
  return 'pt-lain';
}

function gambarPeta(){
  const t = Pt.data.titik;
  const n = { 'pt-milik': 0, 'pt-kontrak': 0, 'pt-numpang': 0, 'pt-kosong': 0 };
  let jmlRumah = 0, jmlFasum = 0;

  document.getElementById('ptRumah').innerHTML = t.filter(function(p){ return p.jenis === 'RUMAH'; }).map(function(p){
    jmlRumah++;
    const r = Pt.rumah[p.kode.replace(/\s/g, '').toUpperCase()];
    const k = ptKelas(r);
    if (n[k] !== undefined) n[k]++;
    return '<div class="pt-pin ' + k + (Pt.pilih === p.kode.toUpperCase() ? ' pilih' : '') + '" data-no="' + ptAman(p.kode) +
      '" style="left:' + p.x + '%;top:' + p.y + '%"><span class="pt-no">' + ptAman(p.kode) + '</span><span class="pt-tetes"></span></div>';
  }).join('');

  document.getElementById('ptLabel').innerHTML = t.filter(function(p){ return p.jenis === 'LABEL'; }).map(function(p){
    return '<div class="pt-label" style="left:' + p.x + '%;top:' + p.y + '%;--r:' + p.putar + 'deg;font-size:' +
      (p.ukuran || 1.2) + 'em">' + ptAman(p.kode) + '</div>';
  }).join('');

  document.getElementById('ptFasum').innerHTML = t.filter(function(p){ return p.jenis === 'FASUM'; }).map(function(p){
    jmlFasum++;
    return '<div class="pt-fasum" data-fasum="' + ptAman(p.kode) + '" style="left:' + p.x + '%;top:' + p.y + '%">' +
      '<span style="font-size:' + (p.ukuran || 2) + 'em;--r:' + p.putar + 'deg">' + ptAman(p.ikon || '📍') + '</span><i></i></div>';
  }).join('');

  tbTeksPt('ptNMilik', n['pt-milik']); tbTeksPt('ptNKontrak', n['pt-kontrak']);
  tbTeksPt('ptNNumpang', n['pt-numpang']); tbTeksPt('ptNKosong', n['pt-kosong']);
  tbTeksPt('ptSub', jmlRumah + ' rumah · ' + jmlFasum + ' penanda');
  if (Pt.atur) isiPilihanPeta();
}

/* ---------- KETUK (dibedakan dari geser/cubit) ---------- */
function ptPointerTurun(e){
  if (!e.isPrimary) { Pt.tekan = null; return; }
  Pt.tekan = { x: e.clientX, y: e.clientY, t: Date.now() };
}
function ptPointerNaik(e){
  const a = Pt.tekan;
  Pt.tekan = null;
  if (!a || !e.isPrimary) return;
  if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8 || Date.now() - a.t > 600) return;   // itu geser, bukan ketuk
  ptKetuk(e);
}

function ptKetuk(e){
  if (!Pt.data || e.target.closest('.pt-zoom')) return;
  // Pakai titik sentuh, bukan e.target: alat zoom bisa "menangkap" pointer ke elemen peta
  const el = document.elementFromPoint(e.clientX, e.clientY) || e.target;
  const pin = el.closest('[data-no]');
  const fasum = el.closest('[data-fasum]');

  if (Pt.atur){
    if (pin) return pilihRumahPeta(pin.getAttribute('data-no').toUpperCase(), true);
    if (!Pt.pilih) return toast('Pilih rumah dulu di panel bawah.');
    const kotak = document.getElementById('ptGambar').getBoundingClientRect();
    const x = (e.clientX - kotak.left) / kotak.width * 100;
    const y = (e.clientY - kotak.top) / kotak.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    return simpanPinPeta(x, y);
  }
  if (pin) return bukaRumahPeta(pin.getAttribute('data-no'));
  if (fasum) return toast(fasum.getAttribute('data-fasum'));
}

/* ---------- INFO RUMAH ---------- */
function bukaRumahPeta(no){
  const r = Pt.rumah[no.replace(/\s/g, '').toUpperCase()];
  tbTeksPt('prJudul', 'Rumah ' + no);
  let h;
  if (!r){
    h = '<p>Rumah ini belum ada di Database Rumah.</p>';
  } else {
    const warna = PT_WARNA[ptKelas(r)];
    h = 'Status: <span class="pt-badge" style="--c:' + warna + '">' + ptAman(r.status || '-') + '</span><br>' +
      (r.dihuni
        ? 'Penghuni: <b>' + ptAman(r.penghuni || '-') + '</b><br>Anggota: <b>' + ptAman(r.jml || '-') + ' jiwa</b><br>' +
          (r.pemilik && r.pemilik !== r.penghuni ? 'Pemilik: ' + ptAman(r.pemilik) : '')
        : 'Pemilik: <b>' + ptAman(r.pemilik || '-') + '</b><br>Rumah belum dihuni.');
  }
  document.getElementById('prIsi').innerHTML = h;
  bukaLembar('lembarRumahPeta');
}

/* ---------- ATUR PIN (Admin Lingkungan) ---------- */
function aturPeta(){
  if (!Pt.data || !Pt.data.bolehUbah) return;
  Pt.atur = !Pt.atur;
  Pt.pilih = '';
  document.getElementById('ptPanel').classList.toggle('pt-sembunyi', !Pt.atur);
  document.getElementById('ptJendela').classList.toggle('atur', Pt.atur);
  const b = document.getElementById('ptTombolAtur');
  b.classList.toggle('on', Pt.atur);
  b.textContent = Pt.atur ? 'Sedang mengatur' : 'Atur pin';
  if (Pt.atur) isiPilihanPeta();
  gambarPeta();
}

function isiPilihanPeta(){
  const adaPin = {};
  Pt.data.titik.forEach(function(p){ if (p.jenis === 'RUMAH') adaPin[p.kode.toUpperCase()] = true; });
  const urut = Pt.data.rumah.slice().sort(function(a, b){
    return a.no.localeCompare(b.no, undefined, { numeric: true, sensitivity: 'base' });
  });
  const belum = urut.filter(function(r){ return !adaPin[r.no.toUpperCase()]; }).length;
  document.getElementById('ptPilih').innerHTML = '<option value="">— Pilih rumah' + (belum ? ' (' + belum + ' belum di peta)' : '') + ' —</option>' +
    urut.map(function(r){
      const no = r.no.toUpperCase();
      return '<option value="' + ptAman(no) + '"' + (Pt.pilih === no ? ' selected' : '') + '>' + ptAman(r.no) +
        (adaPin[no] ? '' : '  •  belum di peta') + '</option>';
    }).join('');
  ptPetunjuk();
}

function pilihRumahPeta(no, dariPeta){
  Pt.pilih = no || '';
  if (dariPeta) document.getElementById('ptPilih').value = Pt.pilih;
  ptPetunjuk();
  gambarPeta();
}

function ptPetunjuk(){
  const ada = Pt.pilih && Pt.data.titik.some(function(p){ return p.jenis === 'RUMAH' && p.kode.toUpperCase() === Pt.pilih; });
  tbTeksPt('ptPetunjuk', !Pt.pilih ? 'Pilih rumah (atau ketuk pinnya), lalu ketuk lokasinya di peta.'
    : (ada ? 'Ketuk lokasi baru untuk memindah pin ' + Pt.pilih + '.' : 'Ketuk atap rumah ' + Pt.pilih + ' di peta untuk memasang pin.'));
  document.getElementById('ptHapus').disabled = !ada;
}

async function simpanPinPeta(x, y){
  if (Pt.sibuk) return;
  const no = Pt.pilih;
  Pt.sibuk = true;
  try {
    const h = await panggilAPI('simpanTitikPeta', { kode: no, x: x, y: y });
    const lama = Pt.data.titik.filter(function(p){ return p.jenis === 'RUMAH' && p.kode.toUpperCase() === no; })[0];
    if (lama){ lama.x = h.x; lama.y = h.y; }
    else Pt.data.titik.push({ jenis: 'RUMAH', kode: no, x: h.x, y: h.y, putar: 0, ikon: '', ukuran: 0, ket: '' });
    toast(h.message);
    isiPilihanPeta();
    gambarPeta();
  } catch (e) {
    toast(e.message);
  } finally {
    Pt.sibuk = false;
  }
}

async function hapusPinPeta(){
  const no = Pt.pilih;
  if (!no || Pt.sibuk) return;
  if (!confirm('Hapus pin rumah ' + no + ' dari peta?\n\nData rumahnya tidak terhapus.')) return;
  Pt.sibuk = true;
  try {
    const h = await panggilAPI('hapusTitikPeta', no);
    Pt.data.titik = Pt.data.titik.filter(function(p){ return !(p.jenis === 'RUMAH' && p.kode.toUpperCase() === no); });
    toast(h.message);
    isiPilihanPeta();
    gambarPeta();
  } catch (e) {
    toast(e.message);
  } finally {
    Pt.sibuk = false;
  }
}

/* ---------- ALAT ---------- */
function tbTeksPt(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }
function ptAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}