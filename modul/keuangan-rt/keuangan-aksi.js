/* =================================================================
   KEUANGAN RT — laporan & penagihan
   Dimuat hanya saat dibutuhkan, supaya modul utama tetap ringan.
   ================================================================= */

const BULAN_LAPORAN = ['Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'];

const Aksi = { jenis: null, massal: null };

/* ---------- MENU ---------- */
function bukaMenuAksi(){ bukaLembar('lembarAksi'); }

/* ---------- LAPORAN ---------- */
function bukaPilihPeriode(jenis){
  Aksi.jenis = jenis;
  tutupLembar('lembarAksi');

  const judul = {
    BULANAN:  'Laporan Bulanan',
    JIMPITAN: 'Rekap Jimpitan',
    TAHUNAN:  'Laporan Tahunan'
  };
  document.getElementById('periodeJudul').textContent = judul[jenis] || 'Pilih Periode';

  // Laporan tahunan tidak perlu bulan
  document.getElementById('kotakBulan').classList.toggle('sembunyi', jenis === 'TAHUNAN');

  const n = new Date();
  const pilih = document.getElementById('lapBulan');
  pilih.innerHTML = BULAN_LAPORAN.map(function(b, i){
    return '<option value="' + (i+1) + '">' + b + '</option>';
  }).join('');
  pilih.value = n.getMonth() + 1;

  document.getElementById('lapTahun').value = n.getFullYear();
  document.getElementById('lapGalat').classList.remove('on');

  bukaLembar('lembarPeriode');
}

async function buatLaporan(){
  const galat  = document.getElementById('lapGalat');
  const tombol = document.getElementById('btnBuatLaporan');
  const tahun  = document.getElementById('lapTahun').value;
  const bulan  = document.getElementById('lapBulan').value;

  if (!tahun){
    galat.textContent = 'Tahun belum diisi.';
    galat.classList.add('on');
    return;
  }
  galat.classList.remove('on');

  tombol.disabled = true;
  tombol.textContent = (Aksi.jenis === 'TAHUNAN') ? 'Menyusun data setahun…' : 'Membuat PDF…';

  try {
    const r = await panggilAPI('buatLaporan', Aksi.jenis, bulan, tahun);

    const nama = (Aksi.jenis === 'TAHUNAN')
      ? 'Laporan_Tahunan_' + tahun + '.pdf'
      : 'Laporan_' + Aksi.jenis + '_' + BULAN_LAPORAN[bulan-1] + '_' + tahun + '.pdf';

    unduhPdf(r.pdfData, nama);
    tutupLembar('lembarPeriode');
    toast('PDF selesai diunduh');

  } catch (e) {
    galat.textContent = e.message;
    galat.classList.add('on');
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Buat PDF';
  }
}

/**
 * Unduh langsung — TIDAK memakai window.open.
 * Membuka tab baru sering diblokir browser HP (bug P-3).
 */
function unduhPdf(base64, namaBerkas){
  const biner = atob(base64);
  const angka = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) angka[i] = biner.charCodeAt(i);

  const blob = new Blob([angka], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}

/* ---------- KIRIM TAGIHAN SATU RUMAH ---------- */
async function kirimTagihanSatu(noRumah, lingkup, tombol){
  if (!confirm('Kirim tagihan WhatsApp ke rumah ' + noRumah + '?')) return;

  const teksAsli = tombol ? tombol.innerHTML : '';
  if (tombol){ tombol.disabled = true; tombol.textContent = 'Mengirim…'; }

  try {
    const r = await panggilAPI('kirimTagihan', noRumah, lingkup);
    toast(r && r.message ? r.message : 'Terkirim');
  } catch (e) {
    toast('Gagal: ' + e.message);
  } finally {
    if (tombol){ tombol.disabled = false; tombol.innerHTML = teksAsli; }
  }
}

/* ---------- KIRIM MASSAL ---------- */
function konfirmasiMassal(jenis){
  Aksi.massal = jenis;
  tutupLembar('lembarAksi');

  const perluPeriode = (jenis === 'REKAP');

  document.getElementById('massalJudul').textContent =
    perluPeriode ? 'Kirim Rekap Massal' : 'Tagih Penunggak';

  document.getElementById('massalKet').innerHTML = perluPeriode
    ? 'Pesan WhatsApp akan dikirim ke <b>SELURUH warga</b> yang punya nomor HP terdaftar. ' +
      'Pastikan bulan yang dipilih benar.<br><br>' +
      '<span style="color:var(--muted);font-size:.76rem;">Hanya bisa dikirim sekali per jam.</span>'
    : 'Pesan tagihan akan dikirim ke warga yang menunggak <b>lebih dari 3 bulan</b>.<br><br>' +
      '<span style="color:var(--muted);font-size:.76rem;">Hanya bisa dikirim sekali per jam.</span>';

  document.getElementById('kotakPeriodeMassal').classList.toggle('sembunyi', !perluPeriode);

  if (perluPeriode){
    const n = new Date();
    document.getElementById('massalPeriode').value =
      BULAN_LAPORAN[n.getMonth()] + ' ' + n.getFullYear();
  }

  document.getElementById('massalGalat').classList.remove('on');
  bukaLembar('lembarMassal');
}

async function kirimMassal(){
  const galat  = document.getElementById('massalGalat');
  const tombol = document.getElementById('btnKirimMassal');
  const periode = document.getElementById('massalPeriode').value.trim();

  if (Aksi.massal === 'REKAP' && !periode){
    galat.textContent = 'Bulan & tahun belum diisi.';
    galat.classList.add('on');
    return;
  }
  galat.classList.remove('on');

  tombol.disabled = true;
  tombol.textContent = 'Mengirim…';

  try {
    const r = await panggilAPI('kirimMassal', Aksi.massal, periode);
    tutupLembar('lembarMassal');
    toast(r && r.message ? r.message : 'Terkirim');
  } catch (e) {
    galat.textContent = e.message;
    galat.classList.add('on');
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Kirim';
  }
}