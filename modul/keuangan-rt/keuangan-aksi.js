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

/* =================================================================
   CASH OPNAME & AUDIT
   ================================================================= */

const Audit = { hasil: null, modeRT: false };

function bolehAudit(){
  return ['DEVELOPER','RT','SEKRETARIS'].indexOf(App.peran) !== -1;
}

/** Menyesuaikan isi menu aksi dengan peran yang login. */
function siapkanMenuAksi(){
  const keuangan = bolehCatat();
  const lingkungan = bolehAudit();

  ['aksiOpname'].forEach(function(id){
    const el = document.getElementById(id);
    if (el) el.classList.toggle('sembunyi', !keuangan);
  });

  const riw = document.getElementById('aksiRiwayat');
  if (riw) riw.classList.toggle('sembunyi', !lingkungan);

  // Butir laporan & WA hanya untuk pengurus keuangan
  document.querySelectorAll('#lembarAksi .aksi-item').forEach(function(el){
    if (el.id === 'aksiRiwayat' || el.id === 'aksiOpname') return;
    el.classList.toggle('sembunyi', !keuangan);
  });
}

/* ---------- CASH OPNAME ---------- */
function bukaOpname(){
  tutupLembar('lembarAksi');
  ['opB1Tunai','opB1Bank','opB2Tunai','opB2Bank','opCatatan'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  document.getElementById('opGalat').classList.remove('on');
  bukaLembar('lembarOpname');
}

function angkaDari(id){
  return Number(String(document.getElementById(id).value).replace(/[^0-9-]/g, '')) || 0;
}

async function jalankanAudit(){
  const galat  = document.getElementById('opGalat');
  const tombol = document.getElementById('btnProsesAudit');

  const data = {
    b1_tunai: angkaDari('opB1Tunai'),
    b1_bank:  angkaDari('opB1Bank'),
    b2_tunai: angkaDari('opB2Tunai'),
    b2_bank:  angkaDari('opB2Bank'),
    catatan:  document.getElementById('opCatatan').value
  };

  if (!data.b1_tunai && !data.b1_bank && !data.b2_tunai && !data.b2_bank){
    galat.textContent = 'Masukkan minimal satu saldo riil.';
    galat.classList.add('on');
    return;
  }
  galat.classList.remove('on');

  tombol.disabled = true; tombol.textContent = 'Membedah pembukuan…';

  try {
    const r = await panggilAPI('jalankanAudit', data);
    Audit.hasil  = r;
    Audit.modeRT = false;

    tutupLembar('lembarOpname');
    gambarHasilAudit(r, false);
    bukaLembar('lembarHasilAudit');

  } catch (e) {
    galat.textContent = e.message;
    galat.classList.add('on');
  } finally {
    tombol.disabled = false; tombol.textContent = 'Proses Audit';
  }
}

/* ---------- TAMPILAN HASIL ---------- */
function gambarHasilAudit(r, modeRT){
  const bagian = function(data, sys, riil, judul, kode){
    const ditutup = data.statusLog && String(data.statusLog).indexOf('CLOSED') !== -1;

    let cap;
    if (ditutup)          cap = '<span class="au-cap tutup">SELESAI</span>';
    else if (data.isWajar) cap = '<span class="au-cap wajar">WAJAR</span>';
    else                   cap = '<span class="au-cap periksa">PERIKSA</span>';

    let narasi;
    if (data.net_diff === 0 && (riil.tunai - sys.tunai) === 0){
      narasi = 'Pembukuan cocok sepenuhnya.';
    } else if (data.net_diff === 0){
      narasi = 'Total saldo cocok. Selisihnya hanya pada jenis penyimpanan — kemungkinan setor atau tarik tunai yang belum dicatat.';
    } else {
      narasi = 'Ditemukan ' + (data.net_diff < 0 ? 'kekurangan' : 'kelebihan') +
               ' saldo sebesar <b>' + rupiah(Math.abs(data.net_diff)) + '</b>.';
    }
    narasi += ' <span style="opacity:.8;">Penyimpangan ' + data.persen + '% dari total kas.</span>';

    let aksi = '';
    if (modeRT && !ditutup){
      aksi =
        '<div class="au-aksi">' +
          '<button onclick="tutupAudit(' + r.rowIdx + ',\'' + kode + '\')">Tutup (Sesuai)</button>' +
          '<button class="putih" onclick="putihkanAudit(' + r.rowIdx + ',\'' + kode + '\')">Putihkan</button>' +
        '</div>';
    } else if (ditutup){
      aksi = '<div class="au-selesai">Sudah ditindaklanjuti</div>';
    }

    return '<div class="au-kartu">' +
      '<div class="au-atas"><span>' + judul + '</span>' + cap + '</div>' +
      '<table class="au-tabel">' +
        '<thead><tr><th>Kantong</th><th class="num">Sistem</th><th class="num">Riil</th></tr></thead>' +
        '<tbody>' +
          '<tr><td>Tunai</td><td class="num">' + rupiah(sys.tunai) + '</td>' +
            '<td class="num" style="font-weight:700;">' + rupiah(riil.tunai) + '</td></tr>' +
          '<tr><td>Bank</td><td class="num">' + rupiah(sys.bank) + '</td>' +
            '<td class="num" style="font-weight:700;">' + rupiah(riil.bank) + '</td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div class="au-selisih' + (data.net_diff < 0 ? ' minus' : '') + '">' +
        '<span>Selisih bersih</span><span>' + rupiah(data.net_diff) + '</span></div>' +
      '<div class="au-narasi">' +
        (kode === 'B1' ? '<b>Termasuk dana titipan warga.</b> ' : '') + narasi +
      '</div>' + aksi +
    '</div>';
  };

  document.getElementById('isiHasilAudit').innerHTML =
    bagian(r.b1, { tunai: r.sys.b1_tunai, bank: r.sys.b1_bank },
                  { tunai: r.riil.b1_tunai, bank: r.riil.b1_bank },
                  'Bendahara 1 — Kas RT', 'B1') +
    bagian(r.b2, { tunai: r.sys.b2_tunai, bank: r.sys.b2_bank },
                  { tunai: r.riil.b2_tunai, bank: r.riil.b2_bank },
                  'Bendahara 2 — Jimpitan', 'B2') +
    '<div style="text-align:center;font-size:.64rem;color:var(--muted);margin-top:4px;">' +
      'Audit #' + (r.rowIdx || '-') + ' · ' + aman(r.tglStr || '') + '</div>';
}

/* ---------- RIWAYAT ---------- */
async function bukaRiwayatAudit(){
  tutupLembar('lembarAksi');
  document.getElementById('isiRiwayat').innerHTML = '<div class="memuat">Memuat…</div>';
  bukaLembar('lembarRiwayat');

  try {
    const daftar = await panggilAPI('riwayatAudit');
    gambarRiwayat(daftar || []);
  } catch (e) {
    document.getElementById('isiRiwayat').innerHTML =
      '<div class="kosong"><h2>Gagal memuat</h2><p>' + aman(e.message) + '</p></div>';
  }
}

function gambarRiwayat(daftar){
  const kotak = document.getElementById('isiRiwayat');

  if (!daftar.length){
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada temuan</h2>' +
                      '<p>Semua audit sudah ditindaklanjuti.</p></div>';
    return;
  }

  kotak.innerHTML = daftar.map(function(d, i){
    const cap = function(s){
      const tutup = String(s).indexOf('CLOSED') !== -1;
      return '<span class="riw-cap ' + (tutup ? 'closed' : 'open') + '">' +
             (tutup ? 'Selesai' : 'Terbuka') + '</span>';
    };

    return '<div class="riw">' +
      '<div class="riw-isi"><b>' + aman(d.tgl) + '</b>' +
        cap(d.raw.b1.status) + cap(d.raw.b2.status) + '</div>' +
      '<button class="btn btn-utama" style="width:auto;padding:8px 14px;font-size:.74rem;"' +
        ' onclick="periksaRiwayat(' + i + ')">Periksa</button>' +
    '</div>';
  }).join('');

  Audit.daftar = daftar;
}

/** Menyusun ulang tampilan audit dari baris riwayat. */
function periksaRiwayat(indeks){
  const d = Audit.daftar[indeks];
  if (!d) return;
  const r = d.raw;

  const hitung = function(sysT, sysB, net){
    const total = Math.abs(Number(sysT) + Number(sysB));
    return {
      isWajar: Math.abs(net) <= total * 0.02,
      persen: total === 0 ? 0 : (Math.abs(net) / total * 100).toFixed(2)
    };
  };

  const s1 = hitung(r.b1.sys_t, r.b1.sys_b, r.b1.net);
  const s2 = hitung(r.b2.sys_t, r.b2.sys_b, r.b2.net);

  const susun = {
    tglStr: d.tgl,
    rowIdx: d.rowIdx,
    sys:  { b1_tunai: r.b1.sys_t,  b1_bank: r.b1.sys_b,  b2_tunai: r.b2.sys_t,  b2_bank: r.b2.sys_b },
    riil: { b1_tunai: r.b1.riil_t, b1_bank: r.b1.riil_b, b2_tunai: r.b2.riil_t, b2_bank: r.b2.riil_b },
    b1: { net_diff: Number(r.b1.net), isWajar: s1.isWajar, persen: s1.persen, statusLog: r.b1.status },
    b2: { net_diff: Number(r.b2.net), isWajar: s2.isWajar, persen: s2.persen, statusLog: r.b2.status }
  };

  Audit.hasil  = susun;
  Audit.modeRT = true;

  tutupLembar('lembarRiwayat');
  gambarHasilAudit(susun, true);
  bukaLembar('lembarHasilAudit');
}

/* ---------- TINDAK LANJUT ---------- */
async function tutupAudit(rowIdx, tipe){
  if (!confirm('Tutup temuan ' + tipe + ' sebagai SESUAI?\n\nTidak ada jurnal penyesuaian yang dibuat.')) return;

  try {
    const r = await panggilAPI('tutupAudit', rowIdx, tipe);
    toast(r && r.message ? r.message : 'Audit ditutup');
    tutupLembar('lembarHasilAudit');
    bukaRiwayatAudit();
  } catch (e) {
    toast('Gagal: ' + e.message);
  }
}

async function putihkanAudit(rowIdx, tipe){
  if (!confirm('Putihkan selisih ' + tipe + '?\n\nSistem akan MENULIS jurnal penyesuaian ' +
               'supaya catatan cocok dengan uang riil. Tindakan ini tercatat permanen.')) return;

  try {
    const r = await panggilAPI('putihkanAudit', rowIdx, tipe);
    toast(r && r.message ? r.message : 'Pemutihan selesai');

    tutupLembar('lembarHasilAudit');
    Keu.jurnal = null;
    await segarkanSaldo();
    bukaRiwayatAudit();

  } catch (e) {
    toast('Gagal: ' + e.message);
  }
}