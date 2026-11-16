/* =================================================================
   MODUL LAYANAN SURAT (Tahap 7C)
   Alur: Isi → Pratinjau → Terbitkan (nomor resmi dari server) → Unduh PDF / Kirim WA.
   Isi surat ikut diarsipkan, jadi surat lama bisa diunduh ulang dengan nomor yang sama.
   Kop, TTD, dan stempel disimpan di memori HP selama sesi (bukan di penyimpanan HP).
   ================================================================= */

const Sr = { awal: null, aset: null, asetJanji: null, jenis: 'PENGANTAR', target: 'ALL', warga: null,
             penerima: [], surat: null, kertas: {}, arsip: null, lembar: '', pilih: {}, sibuk: false };
const SR_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const SR_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const SR_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const SR_LABEL = { PENGANTAR: 'Pengantar', UNDANGAN: 'Undangan', BEBAS: 'Surat Bebas' };
const SR_KERTAS_BAWAAN = { PENGANTAR: 'A4', UNDANGAN: 'F4_2UP', BEBAS: 'A4' };
const SR_MM = 96 / 25.4;   // piksel per milimeter

async function init_surat(){
  Sr.sibuk = false; Sr.lembar = '';
  suratBaruSr();
  pilihJenisSr('PENGANTAR');
  if (Sr.awal) srPakaiAwal();
  await muatSurat(false);
}

/* ---------- MUAT DATA ---------- */
async function muatSurat(paksa){
  if (!document.getElementById('srSub')) return;
  if (paksa && Sr.aset){
    Object.keys(Sr.aset).forEach(function(k){ if (Sr.aset[k]) URL.revokeObjectURL(Sr.aset[k]); });
    Sr.aset = null;
  }
  if (!Sr.awal) srTeks('srSub', 'Memuat…');
  try {
    const h = await panggilAPI('suratAwal');
    Sr.awal = h;
    if (document.getElementById('srSub')) srPakaiAwal();
  } catch (e) {
    if (!Sr.awal) srTeks('srSub', 'Gagal memuat');
    toast(e.message);
  }
  srMuatAset().catch(function(e){ toast(e.message); });
}

function srPakaiAwal(){
  const h = Sr.awal;
  srTeks('srSub', 'Nomor berikutnya ' + h.nomorBerikut);
  const kurang = [];
  if (!h.identitas.kode) kurang.push('kode nomor surat');
  if (!h.identitas.wilayah) kurang.push('wilayah');
  if (!h.aset.kop) kurang.push('kop');
  if (!h.aset.ttd) kurang.push('tanda tangan');
  if (!h.aset.stempel) kurang.push('stempel');
  const p = document.getElementById('srKurang');
  p.textContent = 'Belum diatur di Pengaturan: ' + kurang.join(', ') + '.';
  p.classList.toggle('sr-sembunyi', !kurang.length);
  srLabelWarga();
  srLabelPenerima();
}

/** Kop/TTD/stempel → blob URL (pendek, tidak menggandakan data di setiap halaman). */
function srMuatAset(){
  if (Sr.aset) return Promise.resolve(Sr.aset);
  if (Sr.asetJanji) return Sr.asetJanji;
  Sr.asetJanji = panggilAPI('asetSurat').then(function(h){
    const a = {};
    ['kop', 'ttd', 'stempel'].forEach(function(k){ a[k] = h[k] ? srBlobUrl(h[k]) : ''; });
    Sr.aset = a;
    srGayaKop();
    return a;
  }).finally(function(){ Sr.asetJanji = null; });
  return Sr.asetJanji;
}

function srBlobUrl(dataUri){
  const p = dataUri.split(',');
  const mime = (p[0].match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(p[1]);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u], { type: mime }));
}

function srGayaKop(){
  let g = document.getElementById('srGayaKop');
  if (!g){ g = document.createElement('style'); g.id = 'srGayaKop'; document.head.appendChild(g); }
  g.textContent = Sr.aset && Sr.aset.kop ? '.sr-kop{background-image:url("' + Sr.aset.kop + '");}' : '';
}

/* ---------- FORMULIR ---------- */
function pilihJenisSr(j){
  Sr.jenis = j;
  document.querySelectorAll('#srSeg button').forEach(function(b){ b.classList.toggle('on', b.dataset.j === j); });
  ['PENGANTAR', 'UNDANGAN', 'BEBAS'].forEach(function(x){
    document.getElementById('srForm' + x).classList.toggle('sr-sembunyi', x !== j);
  });
}

function pilihTargetSr(v){
  Sr.target = v;
  document.getElementById('srAreaPilih').classList.toggle('sr-sembunyi', v !== 'SPECIFIC');
  document.getElementById('srAreaManual').classList.toggle('sr-sembunyi', v !== 'MANUAL');
}

function suratBaruSr(){
  ['srTujuanP', 'srKeperluan', 'srManual', 'srJam', 'srTempat', 'srAcara', 'srPerihal', 'srTujuanB', 'srIsiB']
    .forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('srTgl').value = srIsoHariIni();
  document.getElementById('srJamSelesai').value = 'Selesai';
  document.getElementById('srTarget').value = 'ALL';
  pilihTargetSr('ALL');
  Sr.warga = null; Sr.penerima = []; Sr.surat = null;
  srLabelWarga();
  srLabelPenerima();
  srTampil('buat');
}

function srTampil(v){
  document.getElementById('srBuat').classList.toggle('sr-sembunyi', v !== 'buat');
  document.getElementById('srLihat').classList.toggle('sr-sembunyi', v !== 'lihat');
  window.scrollTo(0, 0);
}

/* ---------- PILIH WARGA (PENGANTAR) ---------- */
function bukaWargaSr(){
  if (!Sr.awal) return toast('Data warga belum dimuat.');
  document.getElementById('swCari').value = '';
  gambarWargaSr();
  bukaLembar('lembarWargaSr');
}

function gambarWargaSr(){
  const q = document.getElementById('swCari').value.trim().toLowerCase();
  const hasil = [];
  Sr.awal.warga.forEach(function(w, i){
    if (!q || (w.nama + ' ' + w.rumah).toLowerCase().indexOf(q) !== -1) hasil.push(i);
  });
  document.getElementById('swDaftar').innerHTML = hasil.length ? hasil.slice(0, 200).map(function(i){
    const w = Sr.awal.warga[i];
    return '<button class="sr-item" onclick="pilihWargaSr(' + i + ')"><span class="sr-no">' + srAman(w.rumah) + '</span>' +
      '<span><b>' + srAman(w.nama) + '</b><small>' + srAman(w.hub || '-') + '</small></span></button>';
  }).join('') : '<p class="sr-ket">Tidak ada yang cocok.</p>';
}

function pilihWargaSr(i){
  Sr.warga = Sr.awal.warga[i];
  srLabelWarga();
  tutupLembar('lembarWargaSr');
}

function srLabelWarga(){
  const el = document.getElementById('srWargaLbl');
  if (!el) return;
  el.innerHTML = Sr.warga
    ? '<b>' + srAman(Sr.warga.nama) + '</b> · ' + srAman(Sr.warga.rumah) + '<small>NIK ' + srAman(Sr.warga.nik || '-') + '</small>'
    : 'Pilih warga…';
}

/* ---------- PILIH RUMAH (UNDANGAN & KIRIM WA) ---------- */
function bukaRumahSr(mode){
  if (!Sr.awal) return toast('Data rumah belum dimuat.');
  Sr.lembar = mode;
  Sr.pilih = {};
  if (mode === 'PILIH'){
    Sr.penerima.forEach(function(n){ Sr.pilih[n] = true; });
  } else {
    const x = Sr.surat.isi, adaHP = {};
    Sr.awal.rumah.forEach(function(r){ if (r.adaHP) adaHP[r.no] = r; });
    if (x.target === 'SPECIFIC') x.penerima.forEach(function(p){ if (adaHP[p.no]) Sr.pilih[p.no] = true; });
    else Object.keys(adaHP).forEach(function(n){ if (adaHP[n].dihuni) Sr.pilih[n] = true; });
  }
  srTeks('srJudulRumah', mode === 'WA' ? 'Kirim Undangan WA' : 'Pilih Penerima');
  srTeks('srKetRumah', mode === 'WA'
    ? 'Satu pesan per rumah, ke Kepala Keluarga (atau pemilik bila rumah kosong). Isi pesan diambil dari surat yang sudah terbit.'
    : 'Satu lembar undangan per rumah, atas nama Kepala Keluarga (atau pemilik bila rumah kosong).');
  document.getElementById('srCariRumah').value = '';
  gambarRumahSr();
  bukaLembar('lembarRumahSr');
}

function srCocokRumah(r, q){ return !q || (r.no + ' ' + r.nama).toLowerCase().indexOf(q) !== -1; }

function gambarRumahSr(){
  const wa = Sr.lembar === 'WA';
  const q = document.getElementById('srCariRumah').value.trim().toLowerCase();
  const baris = [];
  Sr.awal.rumah.forEach(function(r, i){
    if (!srCocokRumah(r, q)) return;
    const mati = wa && !r.adaHP;
    const tanda = [];
    if (!r.dihuni) tanda.push('rumah kosong · pemilik');
    if (!r.adaHP) tanda.push('tanpa HP');
    baris.push('<label class="sr-item' + (mati ? ' mati' : '') + '">' +
      '<input type="checkbox"' + (Sr.pilih[r.no] && !mati ? ' checked' : '') + (mati ? ' disabled' : '') +
      ' onchange="centangRumahSr(' + i + ', this.checked)">' +
      '<span class="sr-no">' + srAman(r.no) + '</span>' +
      '<span><b>' + srAman(r.nama) + '</b>' + (tanda.length ? '<small>' + tanda.join(' · ') + '</small>' : '') + '</span></label>');
  });
  document.getElementById('srDaftarRumah').innerHTML = baris.join('') || '<p class="sr-ket">Tidak ada yang cocok.</p>';
  srHitungRumah();
}

function centangRumahSr(i, on){
  const no = Sr.awal.rumah[i].no;
  if (on) Sr.pilih[no] = true; else delete Sr.pilih[no];
  srHitungRumah();
}

function semuaRumahSr(on){
  const wa = Sr.lembar === 'WA';
  const q = document.getElementById('srCariRumah').value.trim().toLowerCase();
  Sr.awal.rumah.forEach(function(r){
    if (!srCocokRumah(r, q)) return;
    if (on && !(wa && !r.adaHP)) Sr.pilih[r.no] = true;
    if (!on) delete Sr.pilih[r.no];
  });
  gambarRumahSr();
}

function srHitungRumah(){
  const n = Object.keys(Sr.pilih).length;
  srTeks('srTombolRumah', Sr.lembar === 'WA' ? 'Kirim ke ' + n + ' rumah' : 'Selesai (' + n + ' rumah)');
}

function selesaiRumahSr(){
  const nos = Sr.awal.rumah.map(function(r){ return r.no; }).filter(function(n){ return Sr.pilih[n]; });
  if (Sr.lembar === 'WA') return kirimWASr(nos);
  Sr.penerima = nos;
  srLabelPenerima();
  tutupLembar('lembarRumahSr');
}

function srLabelPenerima(){
  const el = document.getElementById('srPenerimaLbl');
  if (el) el.textContent = Sr.penerima.length ? Sr.penerima.length + ' rumah terpilih' : 'Pilih rumah…';
}

/* ---------- KUMPULKAN & PRATINJAU ---------- */
function srKumpulkan(){
  const v = function(id){ return document.getElementById(id).value.trim(); };
  if (Sr.jenis === 'PENGANTAR'){
    if (!Sr.warga) throw new Error('Pilih warga dulu.');
    if (!v('srTujuanP')) throw new Error('Tujuan surat belum diisi.');
    if (!v('srKeperluan')) throw new Error('Keperluan belum diisi.');
    return { kunci: Sr.warga.kunci, tujuan: v('srTujuanP'), keperluan: v('srKeperluan') };
  }
  if (Sr.jenis === 'UNDANGAN'){
    const x = { target: Sr.target, tgl: v('srTgl'), jamMulai: v('srJam'), jamSelesai: v('srJamSelesai'),
                tempat: v('srTempat'), acara: v('srAcara'), rumah: [], manual: [] };
    if (!x.tgl) throw new Error('Tanggal acara belum diisi.');
    if (!x.jamMulai) throw new Error('Jam mulai belum diisi.');
    if (!x.tempat) throw new Error('Tempat belum diisi.');
    if (!x.acara) throw new Error('Acara belum diisi.');
    if (x.target === 'SPECIFIC'){
      if (!Sr.penerima.length) throw new Error('Pilih minimal satu rumah penerima.');
      x.rumah = Sr.penerima.slice();
    }
    if (x.target === 'MANUAL'){
      x.manual = document.getElementById('srManual').value.split('\n')
        .map(function(s){ return s.trim(); }).filter(Boolean);
    }
    return x;
  }
  if (!v('srPerihal')) throw new Error('Perihal belum diisi.');
  if (!v('srTujuanB')) throw new Error('Tujuan belum diisi.');
  if (!v('srIsiB')) throw new Error('Isi surat belum diisi.');
  return { perihal: v('srPerihal'), tujuan: v('srTujuanB'), isi: v('srIsiB') };
}

/** Surat sementara untuk pratinjau, dirakit sama persis seperti yang akan disimpan server. */
function srDraf(form){
  const h = Sr.awal, id = h.identitas;
  const isi = Object.assign({}, form, { id: { tempat: id.tempat, wilayah: id.wilayah, nama: id.nama } });
  if (Sr.jenis === 'PENGANTAR'){
    const w = Sr.warga;
    isi.warga = { nama: w.nama, nik: w.nik, kk: w.kk, rumah: w.rumah,
                  alamat: (id.lingkungan ? id.lingkungan + ' ' : '') + 'Nomor ' + w.rumah };
  }
  if (Sr.jenis === 'UNDANGAN'){
    const peta = {};
    h.rumah.forEach(function(r){ peta[r.no] = r; });
    isi.penerima = form.rumah.map(function(n){ return { no: n, nama: peta[n] ? peta[n].nama : n }; });
  }
  return { jenis: Sr.jenis, kode: h.nomorContoh, tgl: srIsoHariIni(), isi: isi, terbit: false, form: form };
}

async function pratinjauSr(){
  if (!Sr.awal) return toast('Data belum dimuat.');
  let form;
  try { form = srKumpulkan(); } catch (e) { return toast(e.message); }
  Sr.surat = srDraf(form);
  await srBukaLihat();
}

async function srBukaLihat(){
  const s = Sr.surat;
  if (!Sr.aset){
    tunggu('Memuat kop & tanda tangan…');
    try { await srMuatAset(); } catch (e) { toast(e.message); }
    finally { selesaiTunggu(); }
  }
  const kertas = (s.terbit && s.isi.kertas) || Sr.kertas[s.jenis] || SR_KERTAS_BAWAAN[s.jenis];
  document.getElementById('srKertas').value = kertas;
  srTeks('srNomor', s.terbit ? s.kode : 'Belum terbit');
  const bisaWa = s.terbit && s.jenis === 'UNDANGAN' && s.isi.target !== 'MANUAL';
  [['srBtnTerbit', !s.terbit], ['srBtnUbah', !s.terbit], ['srBtnPdf', s.terbit], ['srBtnWa', bisaWa], ['srBtnBaru', s.terbit]]
    .forEach(function(b){ document.getElementById(b[0]).classList.toggle('sr-sembunyi', !b[1]); });
  srTeks('srCatatan', s.terbit
    ? 'Diterbitkan ' + srTglPanjang(s.tgl) + '. Bisa diunduh ulang kapan saja dari Arsip, dengan nomor yang sama.'
    : 'Nomor resmi diberikan saat surat diterbitkan.');
  srTampil('lihat');
  gambarPratinjauSr();
}

function gambarPratinjauSr(){
  if (!Sr.surat) return;
  const kertas = document.getElementById('srKertas').value;
  if (!Sr.surat.terbit) Sr.kertas[Sr.surat.jenis] = kertas;
  const hal = srHalaman(Sr.surat, kertas);
  const bingkai = document.getElementById('srBingkai');
  const isi = document.getElementById('srKertasIsi');
  isi.innerHTML = hal[0];
  const skala = bingkai.clientWidth / ((kertas === 'A4' ? 210 : 215) * SR_MM);
  isi.style.transform = 'scale(' + skala + ')';
  bingkai.style.height = Math.ceil((kertas === 'A4' ? 296 : 329) * SR_MM * skala) + 'px';
  srTeks('srHalInfo', hal.length > 1 ? 'Menampilkan halaman 1 dari ' + hal.length + '. Semua halaman ikut di PDF.' : '');
}

/* ---------- TERBITKAN ---------- */
async function terbitkanSr(){
  if (Sr.sibuk || !Sr.surat || Sr.surat.terbit) return;
  if (!confirm('Terbitkan surat ini?\n\nNomor resmi akan dipakai dan tercatat di arsip.')) return;
  Sr.sibuk = true;
  tunggu('Menerbitkan…', SR_LABEL[Sr.surat.jenis]);
  try {
    const isi = Object.assign({}, Sr.surat.form, { kertas: document.getElementById('srKertas').value });
    const h = await panggilAPI('terbitkanSurat', { jenis: Sr.surat.jenis, isi: isi });
    selesaiTunggu();
    toast(h.message);
    Sr.surat = { jenis: h.jenis, kode: h.kode, tgl: h.tgl, isi: h.isi, terbit: true };
    Sr.arsip = null;
    await srBukaLihat();
    muatSurat(false);            // nomor berikutnya diperbarui di latar
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Sr.sibuk = false;
  }
}

/* ---------- PDF ---------- */
function srMuatPdf(){
  if (window.html2pdf) return Promise.resolve();
  return new Promise(function(ok, gagal){
    const s = document.createElement('script');
    s.src = SR_PDF;
    s.onload = ok;
    s.onerror = function(){ gagal(new Error('Alat PDF gagal dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(s);
  });
}

function srGambarSiap(el){
  return Promise.all(Array.prototype.map.call(el.querySelectorAll('img'), function(img){
    if (img.complete) return Promise.resolve();
    return new Promise(function(ok){ img.onload = ok; img.onerror = ok; });
  }));
}

async function unduhPdfSr(){
  if (Sr.sibuk || !Sr.surat || !Sr.surat.terbit) return;
  Sr.sibuk = true;
  const kertas = document.getElementById('srKertas').value;
  const hal = srHalaman(Sr.surat, kertas);
  tunggu('Membuat PDF…', hal.length + ' halaman');
  const tempat = document.createElement('div');
  tempat.className = 'sr-pdf';
  const wadah = document.createElement('div');
  wadah.innerHTML = hal.join('');
  tempat.appendChild(wadah);
  document.body.appendChild(tempat);
  try {
    await srMuatPdf();
    await srGambarSiap(wadah);
    await html2pdf().set({
      margin: 0,
      filename: 'Surat_' + Sr.surat.kode.replace(/\//g, '-') + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: hal.length > 8 ? 1.5 : 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: kertas === 'A4' ? 'a4' : [215, 330], orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(wadah).save();
    selesaiTunggu();
    toast('PDF tersimpan di folder unduhan.');
  } catch (e) {
    selesaiTunggu();
    toast('PDF gagal dibuat: ' + e.message);
  } finally {
    tempat.remove();
    Sr.sibuk = false;
  }
}

/* ---------- KIRIM WA ---------- */
async function kirimWASr(nos){
  if (Sr.sibuk) return;
  if (!nos.length) return toast('Pilih minimal satu rumah.');
  if (!confirm('Kirim undangan "' + Sr.surat.isi.acara + '" ke ' + nos.length + ' rumah lewat WhatsApp?')) return;
  tutupLembar('lembarRumahSr');
  Sr.sibuk = true;
  tunggu('Mengirim WA…', nos.length + ' rumah · sekitar ' + Math.max(1, Math.ceil(nos.length * 1.6 / 60)) + ' menit');
  try {
    const h = await panggilAPI('kirimUndanganWA', { kode: Sr.surat.kode, rumah: nos });
    selesaiTunggu();
    toast(h.message);
    if (h.gagal.length){
      srTeks('hwRingkas', h.message + ' Yang gagal:');
      document.getElementById('hwDaftar').innerHTML = h.gagal.map(function(g){
        return '<div class="sr-item"><span class="sr-no">' + srAman(g.no) + '</span><span><b>' + srAman(g.nama) +
          '</b><small>' + srAman(g.alasan) + '</small></span></div>';
      }).join('');
      bukaLembar('lembarHasilWaSr');
    }
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Sr.sibuk = false;
  }
}

/* ---------- ARSIP ---------- */
async function bukaArsipSr(){
  document.getElementById('saCari').value = '';
  bukaLembar('lembarArsipSr');
  if (Sr.arsip) gambarArsipSr();
  else document.getElementById('saDaftar').innerHTML = '<p class="sr-ket">Memuat…</p>';
  try {
    const h = await panggilAPI('arsipSurat');
    Sr.arsip = h.data;
    if (document.getElementById('saDaftar')) gambarArsipSr();
  } catch (e) {
    if (!Sr.arsip) document.getElementById('saDaftar').innerHTML = '<p class="sr-ket">' + srAman(e.message) + '</p>';
    toast(e.message);
  }
}

function gambarArsipSr(){
  const q = document.getElementById('saCari').value.trim().toLowerCase();
  const baris = [];
  Sr.arsip.forEach(function(a, i){
    if (q && (a.kode + ' ' + a.tujuan + ' ' + a.perihal).toLowerCase().indexOf(q) === -1) return;
    baris.push('<button class="sr-item"' + (a.adaIsi ? '' : ' disabled') + ' onclick="bukaSuratArsipSr(' + i + ')">' +
      '<span style="flex:1;min-width:0;"><b>' + srAman(a.kode) + '</b> <span class="sr-jenis">' + srAman(SR_LABEL[a.jenis] || a.jenis) + '</span>' +
      '<small>' + srAman(a.tujuan) + ' · ' + srAman(a.perihal) + '</small>' +
      '<small>' + srAman(srTglPanjang(a.tgl)) + (a.adaIsi ? '' : ' · tanpa isi') + '</small></span></button>');
  });
  document.getElementById('saDaftar').innerHTML = baris.length ? baris.join('')
    : '<p class="sr-ket">' + (Sr.arsip.length ? 'Tidak ada yang cocok.' : 'Belum ada surat yang diterbitkan.') + '</p>';
}

async function bukaSuratArsipSr(i){
  const a = Sr.arsip[i];
  if (!a.adaIsi) return toast('Arsip ini tidak menyimpan isi surat.');
  tunggu('Membuka arsip…', a.kode);
  try {
    const h = await panggilAPI('arsipSurat', { kode: a.kode });
    selesaiTunggu();
    Sr.surat = { jenis: h.jenis, kode: h.kode, tgl: h.tgl, isi: h.isi, terbit: true };
    tutupLembar('lembarArsipSr');
    await srBukaLihat();
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  }
}

/* ---------- PERAKIT KERTAS ---------- */

/** Semua halaman (string HTML) untuk satu surat pada ukuran kertas tertentu. */
function srHalaman(s, kertas){
  const isi = srDaftarTujuan(s).map(function(t){ return srSurat(s, t); });
  if (kertas === 'F4_2UP'){
    if (isi.length === 1) isi.push(isi[0]);            // satu surat → dua salinan per lembar
    const hal = [];
    for (let i = 0; i < isi.length; i += 2){
      hal.push('<div class="sr-hal sr-f4">' +
        '<div class="sr-separuh sr-kop">' + isi[i] + '</div><div class="sr-potong"></div>' +
        (i + 1 < isi.length ? '<div class="sr-separuh sr-kop">' + isi[i + 1] + '</div>' : '') + '</div>');
    }
    return hal;
  }
  const uk = kertas === 'A4' ? 'sr-a4' : 'sr-f4';
  return isi.map(function(x){ return '<div class="sr-hal ' + uk + ' sr-penuh sr-kop">' + x + '</div>'; });
}

function srDaftarTujuan(s){
  const x = s.isi;
  if (s.jenis !== 'UNDANGAN') return [x.tujuan];
  if (x.target === 'SPECIFIC') return x.penerima.map(function(p){ return p.nama; });
  if (x.target === 'MANUAL') return x.manual && x.manual.length ? x.manual : [''];
  return ['Bapak/Ibu Warga ' + ((x.id && x.id.wilayah) || '')];
}

function srBaris(l, v){ return '<tr><td class="l">' + l + '</td><td class="t">:</td><td>' + v + '</td></tr>'; }

function srSurat(s, tujuan){
  const x = s.isi, id = x.id || {};
  let perihal, badan;
  if (s.jenis === 'PENGANTAR'){
    const w = x.warga || {};
    perihal = 'Surat Pengantar';
    badan = '<p>Yang bertanda tangan di bawah ini, Ketua ' + srAman(id.wilayah) + ', menerangkan bahwa:</p>' +
      '<table class="sr-detail">' +
        srBaris('Nama', '<b style="text-transform:uppercase;">' + srAman(w.nama) + '</b>') +
        srBaris('NIK', srAman(w.nik || '-')) +
        srBaris('No. KK', srAman(w.kk || '-')) +
        srBaris('Alamat', srAman(w.alamat || '-')) +
      '</table>' +
      '<p>Adalah benar warga kami. Surat ini diberikan untuk keperluan: <b>"' + srAman(x.keperluan) + '"</b>.</p>' +
      '<p>Demikian surat pengantar ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>';
  } else if (s.jenis === 'UNDANGAN'){
    perihal = 'Undangan';
    badan = "<p>Assalamu'alaikum Wr. Wb.</p>" +
      '<p>Dengan ini kami mengharap kehadiran Bapak/Ibu/Sdr/i dalam acara yang akan diselenggarakan pada:</p>' +
      '<table class="sr-detail sr-geser">' +
        srBaris('Hari/Tgl', '<b>' + srAman(srHariTgl(x.tgl)) + '</b>') +
        srBaris('Waktu', srAman(x.jamMulai + ' WIB - ' + x.jamSelesai)) +
        srBaris('Tempat', srAman(x.tempat)) +
        srBaris('Acara', srAman(x.acara)) +
      '</table>' +
      '<p>Mengingat pentingnya acara tersebut, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya.</p>' +
      '<p>Demikian undangan ini kami sampaikan. Atas perhatian dan kehadirannya kami ucapkan terima kasih.</p>' +
      "<p>Wassalamu'alaikum Wr. Wb.</p>";
  } else {
    perihal = x.perihal;
    badan = '<p>' + srAman(x.isi).replace(/\n/g, '<br>') + '</p><p>Demikian kami sampaikan, terima kasih.</p>';
  }
  return '<div class="sr-tgl">' + (id.tempat ? srAman(id.tempat) + ', ' : '') + srAman(srTglPanjang(s.tgl)) + '</div>' +
    '<table class="sr-kepala">' + srBaris('Nomor', '<b>' + srAman(s.kode) + '</b>') +
      srBaris('Perihal', '<b>' + srAman(perihal) + '</b>') + '</table>' +
    '<div class="sr-kepada">Kepada Yth.<br><b>' + (tujuan ? srAman(tujuan) : '……………………………………') + '</b><br>Di Tempat</div>' +
    '<div class="sr-rata">' + badan + '</div>' + srTtd(id);
}

function srTtd(id){
  const a = Sr.aset || {};
  return '<div class="sr-ttd"><div class="sr-ttd-kotak"><div>Ketua ' + srAman(id.wilayah) + '</div>' +
    '<div class="sr-ttd-gbr">' +
      (a.ttd ? '<img class="ttd" src="' + a.ttd + '" alt="">' : '') +
      (a.stempel ? '<img class="stempel" src="' + a.stempel + '" alt="">' : '') +
    '</div><div class="sr-ttd-nama">' + (id.nama ? srAman(id.nama) : '&nbsp;') + '</div></div></div>';
}

/* ---------- ALAT KECIL ---------- */
function srTeks(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }

function srAman(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function srIsoHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function srTanggal(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function srTglPanjang(iso){
  const d = srTanggal(iso);
  return d ? d.getDate() + ' ' + SR_BULAN[d.getMonth()] + ' ' + d.getFullYear() : (iso || '');
}

function srHariTgl(iso){
  const d = srTanggal(iso);
  return d ? SR_HARI[d.getDay()] + ', ' + srTglPanjang(iso) : (iso || '');
}