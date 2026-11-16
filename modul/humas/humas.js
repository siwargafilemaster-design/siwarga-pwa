/* =================================================================
   MODUL LAYANAN HUNIAN (Tahap 7D)
   Pengajuan penghuni baru (dengan Pakta Integritas bertanda tangan),
   persetujuan Ketua RT, pemantauan pengontrak & tunggakan, check-out, riwayat.
   Foto dokumen & data tunggakan tidak disimpan di penyimpanan HP.
   ================================================================= */

const Hn = { awal: null, monitor: null, tab: 'AJU', langkah: 1, foto: {}, coret: false, ttdSiap: false,
             entri: null, keluar: null, pakta: null, sibuk: false };
const HN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const HN_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HN_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
                  'September', 'Oktober', 'November', 'Desember'];
const HN_DOK_LABEL = { ktp: 'KTP', kk: 'KK', nikah: 'Buku Nikah', ttd: 'Tanda tangan' };

async function init_humas(){
  Hn.sibuk = false; Hn.monitor = null; Hn.ttdSiap = false;
  resetBaruHn();
  pilihTabHn(App.aksi === 'baru' ? 'BARU' : 'AJU');
  if (Hn.awal) gambarSemuaHn();
  await muatHumas();
}

/* ---------- MUAT ---------- */
async function muatHumas(){
  if (!document.getElementById('hnSub')) return;
  if (!Hn.awal) hnTeks('hnSub', 'Memuat…');
  try {
    Hn.awal = await panggilAPI('humasAwal');
    if (document.getElementById('hnSub')) gambarSemuaHn();
  } catch (e) {
    if (!Hn.awal) hnTeks('hnSub', 'Gagal memuat');
    toast(e.message);
  }
}

function segarkanHn(){
  muatHumas();
  if (Hn.tab === 'HUNI') muatMonitorHn(true);
}

function gambarSemuaHn(){
  const h = Hn.awal;
  const n = h.menunggu.length;
  hnTeks('hnSub', n ? n + ' pengajuan menunggu persetujuan' : 'Tidak ada pengajuan menunggu');
  const b = document.getElementById('hnBadge');
  b.textContent = n;
  b.classList.toggle('hn-sembunyi', !n);
  gambarMenungguHn();
  gambarRiwayatHn();
  gambarRumahHn();
}

function pilihTabHn(t){
  Hn.tab = t;
  document.querySelectorAll('#hnSeg button').forEach(function(x){ x.classList.toggle('on', x.dataset.t === t); });
  ['AJU', 'HUNI', 'BARU', 'RIW'].forEach(function(x){
    document.getElementById('hnTab' + x).classList.toggle('hn-sembunyi', x !== t);
  });
  if (t === 'HUNI' && !Hn.monitor) muatMonitorHn(false);
  if (t === 'BARU') tampilLangkahHn();
}

/* ---------- PENGAJUAN & RIWAYAT ---------- */
function hnChipStatus(e){
  if (e.jenis === 'KELUAR') return '<span class="hn-chip">KELUAR</span>';
  const k = { MENUNGGU: 'kuning', DISETUJUI: 'hijau', DITOLAK: 'merah' }[e.status] || '';
  return '<span class="hn-chip ' + k + '">' + hnAman(e.status) + '</span>';
}

function hnItemEntri(e){
  return '<button class="hn-item" onclick="bukaEntriHn(\'' + hnAman(e.id) + '\')">' +
    '<span class="hn-no">' + hnAman(e.rumah) + '</span>' +
    '<span class="isi"><b>' + hnAman(e.nama) + '</b><small>' + hnAman(hnJudul(e.statusHuni)) + ' · ' + hnTgl(e.tgl) +
    ' · ' + hnAman(e.petugas) + '</small></span>' + hnChipStatus(e) + '</button>';
}

function gambarMenungguHn(){
  const d = Hn.awal.menunggu;
  document.getElementById('hnMenunggu').innerHTML = d.length
    ? (Hn.awal.bolehPutus ? '' : '<p class="hn-ket">Menunggu persetujuan Ketua RT.</p>') + d.map(hnItemEntri).join('')
    : '<div class="hn-kartu"><p class="hn-ket">Tidak ada pengajuan yang menunggu. Untuk mendaftarkan penghuni baru, buka tab <b>Masuk Baru</b>.</p></div>';
}

function gambarRiwayatHn(){
  const q = document.getElementById('hnCari').value.trim().toLowerCase();
  const d = Hn.awal.riwayat.filter(function(e){ return !q || (e.rumah + ' ' + e.nama).toLowerCase().indexOf(q) !== -1; });
  document.getElementById('hnRiwayat').innerHTML = d.length ? d.map(hnItemEntri).join('')
    : '<p class="hn-ket">' + (Hn.awal.riwayat.length ? 'Tidak ada yang cocok.' : 'Belum ada riwayat.') + '</p>';
}

function hnCariEntri(id){
  return Hn.awal.menunggu.concat(Hn.awal.riwayat).filter(function(e){ return e.id === id; })[0];
}

function hnBaris(l, v){ return v === '' || v == null ? '' : '<div class="hn-baris"><span>' + l + '</span><b>' + v + '</b></div>'; }

function bukaEntriHn(id){
  const e = hnCariEntri(id);
  if (!e) return;
  Hn.entri = e;
  const masuk = e.jenis === 'MASUK';
  hnTeks('hdJudul', (masuk ? 'Penghuni Masuk · ' : 'Check-out · ') + e.rumah);
  let h = hnBaris('Status', hnChipStatus(e)) +
    hnBaris('Nama', hnAman(e.nama)) +
    hnBaris('NIK', hnAman(e.nik)) + hnBaris('No. KK', hnAman(e.kk)) + hnBaris('No. HP', hnAman(e.hp)) +
    hnBaris('Jumlah orang', e.jml) + hnBaris('Status hunian', hnAman(hnJudul(e.statusHuni))) +
    hnBaris(masuk ? 'Mulai menghuni' : 'Tanggal pindah', hnTgl(e.tglHuni)) +
    hnBaris(masuk ? 'Diajukan' : 'Dicatat', hnTgl(e.tgl, true) + ' · ' + hnAman(e.petugas)) +
    (masuk && e.diputuskan ? hnBaris('Diputuskan', hnTgl(e.diputuskan, true)) : '') +
    hnBaris('Catatan', hnAman(e.catatan)) +
    (e.tunggakan ? hnBaris('Tunggakan saat keluar', '<span class="hn-merah">' + hnRp(e.tunggakan) + '</span>') : '');

  const dok = Object.keys(HN_DOK_LABEL).filter(function(k){ return e.dok[k]; });
  if (dok.length || e.adaPakta) {
    h += '<div class="hn-tombol-dok">' +
      (e.adaPakta ? '<button onclick="lihatPaktaHn(\'' + hnAman(e.id) + '\')">📜 Pakta Integritas</button>' : '') +
      dok.filter(function(k){ return k !== 'ttd'; }).map(function(k){
        return '<button onclick="lihatDokHn(\'' + hnAman(e.id) + '\',\'' + k + '\')">🪪 ' + HN_DOK_LABEL[k] + '</button>';
      }).join('') + '</div>';
  }

  if (masuk && e.status === 'MENUNGGU') {
    if (Hn.awal.bolehPutus) {
      h += '<div class="field" style="margin-top:12px;"><label for="hdAlasan">Catatan / alasan (wajib bila menolak)</label>' +
        '<textarea id="hdAlasan" rows="2" maxlength="200"></textarea></div>' +
        '<div class="hn-aksi"><button class="btn btn-utama" onclick="putuskanHn(\'SETUJU\')">Setujui</button>' +
        '<button class="btn hn-btn-bahaya" onclick="putuskanHn(\'TOLAK\')">Tolak</button></div>' +
        '<p class="hn-ket">Periksa foto KTP/KK dan Pakta sebelum menyetujui. Setelah disetujui, rumah langsung tercatat dihuni dan Humas diminta melengkapi Data Pokok.</p>';
    } else {
      h += '<p class="hn-ket" style="margin-top:12px;">Menunggu persetujuan Ketua RT.</p>';
    }
  }
  document.getElementById('hdIsi').innerHTML = h;
  bukaLembar('lembarHn');
}

async function putuskanHn(aksi){
  if (Hn.sibuk || !Hn.entri) return;
  const e = Hn.entri;
  const alasan = document.getElementById('hdAlasan').value.trim();
  if (aksi === 'TOLAK' && !alasan) return toast('Tuliskan alasan penolakan.');
  if (!confirm((aksi === 'SETUJU' ? 'Setujui ' : 'Tolak ') + e.nama + ' sebagai penghuni rumah ' + e.rumah + '?')) return;
  Hn.sibuk = true;
  tunggu(aksi === 'SETUJU' ? 'Menyetujui…' : 'Menolak…', 'Rumah ' + e.rumah);
  try {
    const h = await panggilAPI('putuskanHuni', { id: e.id, aksi: aksi, alasan: alasan });
    selesaiTunggu();
    toast(h.message);
    tutupLembar('lembarHn');
    Hn.monitor = null;
    await muatHumas();
  } catch (err) {
    selesaiTunggu();
    toast(err.message);
  } finally {
    Hn.sibuk = false;
  }
}

/* ---------- DOKUMEN & PAKTA ---------- */
async function lihatDokHn(id, jenis){
  tunggu('Membuka ' + HN_DOK_LABEL[jenis] + '…');
  try {
    const h = await panggilAPI('dokumenHuni', { id: id, jenis: jenis });
    selesaiTunggu();
    hnTeks('hdokJudul', HN_DOK_LABEL[jenis]);
    document.getElementById('hdokImg').src = h.data;
    bukaLembar('lembarDokHn');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  }
}

async function lihatPaktaHn(id){
  tunggu('Membuka Pakta Integritas…');
  try {
    const h = await panggilAPI('paktaHuni', { id: id });
    selesaiTunggu();
    Hn.pakta = h;
    document.getElementById('hpIsi').innerHTML = hnPaktaHtml(h.pakta, h.entri, h.ttd);
    document.getElementById('hpBawah').classList.remove('hn-sembunyi');
    bukaLembar('lembarPaktaHn');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  }
}

function lihatPaktaKosongHn(){
  if (!Hn.awal) return toast('Data belum dimuat.');
  Hn.pakta = null;
  document.getElementById('hpIsi').innerHTML = hnPaktaHtml(Hn.awal.pakta, null, '');
  document.getElementById('hpBawah').classList.add('hn-sembunyi');
  bukaLembar('lembarPaktaHn');
}

/** Dokumen Pakta. p = salinan pakta (dengan p.penanda bila sudah ditandatangani), e = entri, ttd = data URI. */
function hnPaktaHtml(p, e, ttd){
  const s = p.penanda || {};
  const isi = function(v){ return v ? hnAman(v) : '…………………………'; };
  const putus = e && e.status === 'DISETUJUI' ? 'Disetujui Ketua RT, ' + hnTglPanjang(e.diputuskan)
              : e && e.status === 'DITOLAK' ? 'Ditolak Ketua RT, ' + hnTglPanjang(e.diputuskan)
              : e ? 'Menunggu persetujuan Ketua RT' : '';
  return '<div class="hn-dok">' +
    '<h3>PAKTA INTEGRITAS PENGHUNI</h3><p class="sub">' + hnAman(p.lingkungan) + '</p>' +
    '<p>Yang bertanda tangan di bawah ini:</p><table>' +
      '<tr><td>Nama</td><td>:</td><td><b>' + isi(s.nama) + '</b></td></tr>' +
      '<tr><td>NIK</td><td>:</td><td>' + isi(s.nik) + '</td></tr>' +
      '<tr><td>No. KK</td><td>:</td><td>' + isi(s.kk) + '</td></tr>' +
      '<tr><td>No. HP</td><td>:</td><td>' + isi(s.hp) + '</td></tr>' +
      '<tr><td>Rumah</td><td>:</td><td>' + isi(s.rumah) + (s.statusHuni ? ' (' + hnAman(hnJudul(s.statusHuni)) + ')' : '') + '</td></tr>' +
      '<tr><td>Mulai menghuni</td><td>:</td><td>' + (s.tglHuni ? hnTglPanjang(s.tglHuni) : isi('')) + '</td></tr>' +
    '</table>' +
    '<p>dengan ini menyatakan sanggup mematuhi ketentuan berikut:</p><ol>' +
      p.butir.map(function(b){ return '<li><b>' + hnAman(b.judul) + '.</b> ' + hnAman(b.isi) + '</li>'; }).join('') +
    '</ol><p>' + hnAman(p.penutup) + '</p>' +
    '<div class="ttd2">' +
      '<div>Diterima oleh,<br>' + (s.petugas ? hnAman(s.petugas) : 'Petugas Humas') + '<div class="kosong"></div>' +
        '<small>' + hnAman(putus) + '</small></div>' +
      '<div>' + (p.tempat ? hnAman(p.tempat) + ', ' : '') + (s.waktu ? hnTglPanjang(s.waktu) : '…………') +
        '<br>Yang menyatakan,' + (ttd ? '<img src="' + ttd + '" alt="">' : '<div class="kosong"></div>') +
        '<b><u>' + isi(s.nama) + '</u></b></div>' +
    '</div>' +
    (s.waktu ? '<div class="kaki">Ditandatangani secara digital melalui SiWARGA pada ' + hnTgl(s.waktu, true) +
      (e ? ' · ID ' + hnAman(e.id) : '') + ' · Pakta versi ' + hnAman(p.versi) + '</div>'
      : '<div class="kaki">Contoh isi Pakta yang berlaku sekarang (versi ' + hnAman(p.versi) + ').</div>') +
    '</div>';
}

function hnMuatPdf(){
  if (window.html2pdf) return Promise.resolve();
  return new Promise(function(ok, gagal){
    const s = document.createElement('script');
    s.src = HN_PDF; s.onload = ok;
    s.onerror = function(){ gagal(new Error('Alat PDF gagal dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(s);
  });
}

async function unduhPaktaHn(){
  if (!Hn.pakta || Hn.sibuk) return;
  Hn.sibuk = true;
  tunggu('Membuat PDF…', 'Pakta Integritas');
  const tempat = document.createElement('div');
  tempat.className = 'hn-pdf';
  const wadah = document.createElement('div');
  wadah.innerHTML = hnPaktaHtml(Hn.pakta.pakta, Hn.pakta.entri, Hn.pakta.ttd);
  tempat.appendChild(wadah);
  document.body.appendChild(tempat);
  try {
    await hnMuatPdf();
    const e = Hn.pakta.entri;
    await html2pdf().set({
      margin: 0,
      filename: 'Pakta_' + e.rumah + '_' + e.nama.replace(/[^\w]+/g, '_') + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['li', '.ttd2'] }
    }).from(wadah.firstChild).save();
    selesaiTunggu();
    toast('PDF tersimpan di folder unduhan.');
  } catch (err) {
    selesaiTunggu();
    toast('PDF gagal dibuat: ' + err.message);
  } finally {
    tempat.remove();
    Hn.sibuk = false;
  }
}

/* ---------- PENGONTRAK & TUNGGAKAN ---------- */
async function muatMonitorHn(segar){
  const el = document.getElementById('hnPengontrak');
  if (!el) return;
  if (!Hn.monitor || segar) {
    document.getElementById('hnRingkas').innerHTML = '';
    el.innerHTML = '<div class="hn-kartu"><p class="hn-ket">Menghitung tunggakan setiap rumah… Bisa memakan ±30 detik bila banyak pengontrak.</p></div>';
  }
  try {
    Hn.monitor = await panggilAPI('monitoringHuni', { segar: !!segar });
    if (document.getElementById('hnPengontrak')) gambarMonitorHn();
  } catch (e) {
    el.innerHTML = '<p class="hn-ket">' + hnAman(e.message) + '</p>';
    toast(e.message);
  }
}

function gambarMonitorHn(){
  const d = Hn.monitor.data;
  const nunggak = d.filter(function(r){ return r.hutang > 0; });
  const total = nunggak.reduce(function(a, r){ return a + r.hutang; }, 0);
  document.getElementById('hnRingkas').innerHTML = '<div class="hn-ringkas">' +
    '<div><b>' + d.length + '</b><small>Rumah</small></div>' +
    '<div><b class="' + (nunggak.length ? 'hn-merah' : 'hn-hijau') + '">' + nunggak.length + '</b><small>Menunggak</small></div>' +
    '<div><b class="' + (total ? 'hn-merah' : '') + '">' + hnRpPendek(total) + '</b><small>Total tunggakan</small></div></div>';
  document.getElementById('hnPengontrak').innerHTML = d.length ? d.map(function(r, i){
    const kanan = r.galat ? '<span class="hn-kanan">?<small><br>tak terbaca</small></span>'
      : r.hutang > 0 ? '<span class="hn-kanan hn-merah">' + hnRp(r.hutang) + '<small><br>' + r.bulan + ' bulan</small></span>'
      : '<span class="hn-kanan hn-hijau">Lunas' + (r.saldo > 0 ? '<small><br>titipan ' + hnRp(r.saldo) + '</small>' : '') + '</span>';
    return '<button class="hn-item" onclick="bukaPengontrakHn(' + i + ')"><span class="hn-no">' + hnAman(r.no) + '</span>' +
      '<span class="isi"><b>' + hnAman(r.nama || '-') + '</b><small>' + hnAman(hnJudul(r.status)) + ' · ' + r.jml + ' orang</small></span>' +
      kanan + '</button>';
  }).join('') : '<div class="hn-kartu"><p class="hn-ket">Belum ada rumah berstatus Pengontrak atau Menumpang.</p></div>';
  hnTeks('hnWaktuMonitor', 'Dihitung ' + hnTgl(Hn.monitor.waktu, true) + '. Tekan tombol segarkan untuk menghitung ulang.');
}

function bukaPengontrakHn(i){
  const r = Hn.monitor.data[i];
  Hn.keluar = { no: r.no, nama: r.nama, hutang: r.hutang, bulan: r.bulan };
  hnTeks('hdJudul', 'Rumah ' + r.no);
  let h = hnBaris('Penghuni', hnAman(r.nama || '-')) + hnBaris('Status', hnAman(hnJudul(r.status))) +
    hnBaris('Jumlah orang', r.jml) + hnBaris('No. HP', hnAman(r.hp || '-')) +
    hnBaris('Tunggakan', r.galat ? 'tidak terbaca (' + hnAman(r.galat) + ')'
      : r.hutang > 0 ? '<span class="hn-merah">' + hnRp(r.hutang) + ' · ' + r.bulan + ' bulan</span>' : '<span class="hn-hijau">Lunas</span>') +
    hnBaris('Titipan / deposit', hnRp(r.saldo));
  h += '<div class="hn-aksi" style="margin-top:14px;">';
  if (r.hp) {
    const teks = r.hutang > 0
      ? 'Assalamu\'alaikum Bapak/Ibu ' + r.nama + ', kami dari Humas. Mohon info pelunasan iuran warga rumah ' + r.no +
        ' sebesar ' + hnRp(r.hutang) + ' (' + r.bulan + ' bulan). Terima kasih.'
      : 'Assalamu\'alaikum Bapak/Ibu ' + r.nama + ', kami dari Humas. Terima kasih, iuran warga rumah ' + r.no + ' sudah lunas.';
    h += '<a class="btn hn-btn-wa" href="https://wa.me/' + encodeURIComponent(r.hp) + '?text=' + encodeURIComponent(teks) +
      '" target="_blank" rel="noopener">' + (r.hutang > 0 ? 'Tagih lewat WhatsApp' : 'Kirim WhatsApp') + '</a>';
  }
  h += '<button class="btn hn-btn-bahaya" onclick="bukaKeluarHn()">Check-out (pindah keluar)</button></div>';
  document.getElementById('hdIsi').innerHTML = h;
  bukaLembar('lembarHn');
}

function bukaKeluarHn(){
  const k = Hn.keluar;
  tutupLembar('lembarHn');
  hnTeks('hkJudul', 'Check-out · ' + k.no);
  document.getElementById('hkTgl').value = hnIsoHariIni();
  document.getElementById('hkStatus').value = 'DISEWAKAN';
  document.getElementById('hkCatatan').value = '';
  document.getElementById('hkLanjut').checked = false;
  hnTampilTunggakan();
  bukaLembar('lembarKeluarHn');
}

function hnTampilTunggakan(){
  const k = Hn.keluar, ada = k.hutang > 0;
  const el = document.getElementById('hkTunggakan');
  el.innerHTML = ada ? '⚠️ <b>' + hnAman(k.nama) + '</b> masih menunggak <b>' + hnRp(k.hutang) + '</b> (' + k.bulan +
    ' bulan). Tagih dulu sebelum check-out. Bila dibayar tunai ke Humas, serahkan ke Bendahara untuk dicatat.' : '';
  el.classList.toggle('hn-sembunyi', !ada);
  document.getElementById('hkLanjutWadah').classList.toggle('hn-sembunyi', !ada);
}

async function prosesKeluarHn(){
  if (Hn.sibuk) return;
  const k = Hn.keluar;
  const tgl = document.getElementById('hkTgl').value;
  if (!tgl) return toast('Isi tanggal pindah.');
  const lanjut = document.getElementById('hkLanjut').checked;
  if (k.hutang > 0 && !lanjut) return toast('Centang pernyataan tunggakan dulu.');
  if (!confirm('Check-out rumah ' + k.no + ' (' + k.nama + ')?\n\nSeluruh anggota keluarga dicatat pindah dan rumah dikosongkan.')) return;
  Hn.sibuk = true;
  tunggu('Memproses check-out…', 'Rumah ' + k.no);
  try {
    const h = await panggilAPI('checkoutHuni', {
      rumah: k.no, tglPindah: tgl, statusRumah: document.getElementById('hkStatus').value,
      catatan: document.getElementById('hkCatatan').value.trim(), lanjut: lanjut
    });
    selesaiTunggu();
    if (h.perluKonfirmasi) {          // tunggakan terbaru berbeda dari yang tampil
      k.hutang = h.tunggakan.hutang; k.bulan = h.tunggakan.bulan;
      document.getElementById('hkLanjut').checked = false;
      hnTampilTunggakan();
      return toast('Tunggakan terbaru ' + hnRp(k.hutang) + '. Periksa lalu centang pernyataannya.');
    }
    toast(h.message);
    tutupLembar('lembarKeluarHn');
    muatMonitorHn(false);
    muatHumas();
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Hn.sibuk = false;
  }
}

/* ---------- MASUK BARU ---------- */
function gambarRumahHn(){
  const sel = document.getElementById('hbRumah');
  const pilih = sel.value;
  sel.innerHTML = '<option value="">Pilih rumah…</option>' + Hn.awal.rumah.map(function(r){
    return '<option value="' + hnAman(r.no) + '"' + (r.adaPengajuan ? ' disabled' : '') + '>' + hnAman(r.no) + ' · ' +
      hnAman(hnJudul(r.status)) + (r.adaPengajuan ? ' (ada pengajuan)' : '') + '</option>';
  }).join('');
  sel.value = pilih;
}

function resetBaruHn(){
  ['hbNama', 'hbNik', 'hbKk', 'hbHp'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('hbJml').value = 1;
  document.getElementById('hbTgl').value = hnIsoHariIni();
  document.getElementById('hbStatus').value = 'PENGONTRAK';
  document.getElementById('hbRumah').value = '';
  document.getElementById('hbSetuju').checked = false;
  Hn.foto = {};
  ['ktp', 'kk', 'nikah'].forEach(function(k){
    const b = document.getElementById('hbFoto' + k);
    b.style.backgroundImage = ''; b.classList.remove('ada');
  });
  Hn.langkah = 1;
  hapusTtdHn();
}

function tampilLangkahHn(){
  const n = Hn.langkah;
  [1, 2, 3, 4].forEach(function(i){ document.getElementById('hbL' + i).classList.toggle('hn-sembunyi', i !== n); });
  hnTeks('hbLangkah', 'Langkah ' + n + ' dari 4');
  document.getElementById('hbKembali').classList.toggle('hn-sembunyi', n === 1);
  hnTeks('hbLanjut', n === 4 ? 'Kirim Pengajuan' : 'Lanjut');
  if (n === 4) {
    const s = hnDataBaru();
    const p = Object.assign({}, Hn.awal ? Hn.awal.pakta : {}, { penanda: {
      nama: s.nama, nik: s.nik, kk: s.kk, hp: s.hp, rumah: s.rumah, statusHuni: s.statusHuni, tglHuni: s.tglHuni } });
    if (Hn.awal) document.getElementById('hbPakta').innerHTML = hnPaktaHtml(p, null, '');
    hnTeks('hbSetujuTeks', 'Saya, ' + s.nama + ', telah membaca, memahami, dan menyetujui seluruh isi Pakta Integritas ini.');
    siapkanTtdHn();
  }
  window.scrollTo(0, 0);
}

function hnDataBaru(){
  const v = function(id){ return document.getElementById(id).value.trim(); };
  return { rumah: v('hbRumah'), statusHuni: v('hbStatus'), tglHuni: v('hbTgl'), nama: v('hbNama'),
           nik: v('hbNik').replace(/\D/g, ''), kk: v('hbKk').replace(/\D/g, ''), hp: v('hbHp').replace(/\D/g, ''),
           jml: parseInt(v('hbJml'), 10) || 0 };
}

function langkahHn(arah){
  if (arah < 0) { Hn.langkah = Math.max(1, Hn.langkah - 1); return tampilLangkahHn(); }
  const s = hnDataBaru(), n = Hn.langkah;
  if (!Hn.awal) return toast('Data belum dimuat.');
  if (n === 1) {
    if (!s.rumah) return toast('Pilih rumah dulu.');
    if (!s.tglHuni) return toast('Isi tanggal mulai menghuni.');
  }
  if (n === 2) {
    if (s.nama.length < 3) return toast('Isi nama lengkap Kepala Keluarga.');
    if (s.nik.length !== 16) return toast('NIK harus 16 digit (sekarang ' + s.nik.length + ').');
    if (s.kk.length !== 16) return toast('No. KK harus 16 digit (sekarang ' + s.kk.length + ').');
    if (s.hp.length < 10) return toast('Nomor WhatsApp belum benar.');
    if (s.jml < 1 || s.jml > 30) return toast('Jumlah orang 1–30.');
  }
  if (n === 3 && (!Hn.foto.ktp || !Hn.foto.kk)) return toast('Foto KTP dan KK wajib.');
  if (n === 4) return kirimBaruHn(s);
  Hn.langkah = n + 1;
  tampilLangkahHn();
}

function pilihFotoHn(input, k){
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) return toast('Foto terlalu besar.');
  const baca = new FileReader();
  baca.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const skala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * skala); c.height = Math.round(img.height * skala);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      Hn.foto[k] = c.toDataURL('image/jpeg', 0.85);
      const b = document.getElementById('hbFoto' + k);
      b.style.backgroundImage = 'url("' + Hn.foto[k] + '")';
      b.classList.add('ada');
    };
    img.onerror = function(){ toast('Berkas ini bukan gambar.'); };
    img.src = e.target.result;
  };
  baca.readAsDataURL(f);
}

/* ---------- TANDA TANGAN ---------- */
function siapkanTtdHn(){
  const c = document.getElementById('hbTtd');
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  if (Hn.ttdSiap && c.width === Math.round(r.width * (window.devicePixelRatio || 1))) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#14213d';
  Hn.coret = false;
  if (!Hn.ttdSiap) {
    let gores = false;
    const titik = function(e){ const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    c.addEventListener('pointerdown', function(e){
      gores = true; c.setPointerCapture(e.pointerId);
      const p = titik(e), x = c.getContext('2d');
      x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + 0.1, p[1] + 0.1); x.stroke();
      Hn.coret = true;
    });
    c.addEventListener('pointermove', function(e){
      if (!gores) return;
      const p = titik(e), x = c.getContext('2d');
      x.lineTo(p[0], p[1]); x.stroke();
    });
    const henti = function(){ gores = false; };
    c.addEventListener('pointerup', henti);
    c.addEventListener('pointercancel', henti);
  }
  Hn.ttdSiap = true;
}

function hapusTtdHn(){
  const c = document.getElementById('hbTtd');
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  Hn.coret = false;
}

async function kirimBaruHn(s){
  if (Hn.sibuk) return;
  if (!document.getElementById('hbSetuju').checked) return toast('Calon penghuni harus mencentang persetujuan Pakta.');
  if (!Hn.coret) return toast('Calon penghuni belum tanda tangan.');
  if (!confirm('Kirim pengajuan ' + s.nama + ' untuk rumah ' + s.rumah + ' ke Ketua RT?')) return;
  Hn.sibuk = true;
  tunggu('Mengirim pengajuan…', 'Mengunggah dokumen');
  try {
    const h = await panggilAPI('ajukanHuni', Object.assign({}, s, {
      foto: { ktp: Hn.foto.ktp, kk: Hn.foto.kk, nikah: Hn.foto.nikah || '' },
      ttd: document.getElementById('hbTtd').toDataURL('image/png'),
      setuju: true, asal: location.origin
    }));
    selesaiTunggu();
    toast(h.message);
    resetBaruHn();
    await muatHumas();
    pilihTabHn('AJU');
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Hn.sibuk = false;
  }
}

/* ---------- ALAT KECIL ---------- */
function hnTeks(id, t){ const el = document.getElementById(id); if (el) el.textContent = t; }

function hnAman(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function hnJudul(s){ s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function hnRp(n){ return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
function hnRpPendek(n){ return n >= 1e6 ? 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt' : n >= 1e3 ? 'Rp ' + Math.round(n / 1e3) + ' rb' : 'Rp ' + n; }

function hnIsoHariIni(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function hnTgl(iso, jam){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return hnAman(iso || '-');
  return Number(m[3]) + ' ' + HN_BLN[Number(m[2]) - 1] + ' ' + m[1] + (jam && m[4] ? ' ' + m[4] + '.' + m[5] : '');
}

function hnTglPanjang(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[3]) + ' ' + HN_BULAN[Number(m[2]) - 1] + ' ' + m[1] : hnAman(iso || '');
}