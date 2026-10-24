/* =================================================================
   MODUL VERIFIKASI SETORAN
   Antrian bukti transfer warga → diperiksa → disetujui / ditolak
   ================================================================= */

const Verif = { antrian: [], aktif: null, alasanIdx: -1, sibuk: false };

const ALASAN_TOLAK = [
  'Nominal tidak sesuai',
  'Gambar buram / rusak',
  'Salah rekening tujuan',
  'Tanggal sudah lewat / kadaluarsa',
  'Dobel transaksi',
  'Lainnya (tulis sendiri)'
];
const IDX_LAINNYA = ALASAN_TOLAK.length - 1;

// Server memformat bulan dalam singkatan Inggris
const BLN_EN_ID = { Jan:'Jan', Feb:'Feb', Mar:'Mar', Apr:'Apr', May:'Mei', Jun:'Jun',
                    Jul:'Jul', Aug:'Agu', Sep:'Sep', Oct:'Okt', Nov:'Nov', Dec:'Des' };

async function init_verifikasi(){
  // HTML halaman diambil baru tiap kunjungan → keadaan lama dibuang
  Verif.antrian  = [];
  Verif.aktif    = null;
  Verif.alasanIdx = -1;
  Verif.sibuk    = false;

  await muatAntrian();
}

/* ---------- ANTRIAN ---------- */
async function muatAntrian(){
  const kotak = document.getElementById('vfDaftar');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Mencari antrian setoran…</div>';

  try {
    Verif.antrian = (await panggilAPI('antrianVerifikasi')) || [];
    gambarAntrian();
  } catch (e) {
    document.getElementById('vfSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + vAman(e.message) + '</p></div>';
  }
}

function gambarAntrian(){
  const kotak = document.getElementById('vfDaftar');
  const sub   = document.getElementById('vfSub');
  const daftar = Verif.antrian;

  if (!daftar.length){
    sub.textContent = 'Tidak ada antrian';
    kotak.innerHTML = '<div class="kosong"><h2>Tidak ada antrian</h2>' +
                      '<p>Semua bukti transfer warga sudah diproses.</p></div>';
    return;
  }

  sub.textContent = daftar.length + ' menunggu diperiksa';

  kotak.innerHTML = daftar.map(function(d, i){
    return '<div class="vf-kartu">' +
      '<div class="vf-atas"><span class="vf-cap">MENUNGGU</span>' +
        '<small>' + vAman(tglIdn(d.tglStruk)) + '</small></div>' +
      '<div class="vf-nominal">' + vRp(d.nominal) + '</div>' +
      '<div class="vf-rumah">Rumah ' + vAman(d.rumah) + '</div>' +
      '<div class="vf-ket">' + vAman(d.ket || '-') + '</div>' +
      '<button class="btn btn-utama" onclick="periksaBukti(' + i + ')">Periksa Bukti</button>' +
    '</div>';
  }).join('');
}

/* ---------- PERIKSA BUKTI ---------- */
async function periksaBukti(i){
  const d = Verif.antrian[i];
  if (!d) return;
  Verif.aktif = d;

  document.getElementById('vfInfo').innerHTML =
    vBaris('Nominal', vRp(d.nominal), true) +
    vBaris('Rumah', d.rumah) +
    vBaris('Tanggal struk', tglIdn(d.tglStruk)) +
    vBaris('Diunggah', d.timestamp) +
    vBaris('Keterangan', d.ket || '-') +
    vBaris('Ref ID', d.refId || '-');

  const kotak = document.getElementById('vfGambar');
  kotak.classList.remove('zoom');
  kotak.innerHTML = '<div class="teks">Memuat gambar…</div>';
  vBuka('lembarBukti');

  if (!d.adaGambar){
    kotak.innerHTML = '<div class="teks">Tidak ada gambar bukti untuk transaksi ini.</div>';
    return;
  }

  try {
    const g = await panggilAPI('buktiVerifikasi', d.rowId);

    // Kalau sudah menutup atau berganti kartu selama menunggu, abaikan
    if (!Verif.aktif || Verif.aktif.rowId !== d.rowId) return;

    const img = document.createElement('img');
    img.alt = 'Bukti transfer';
    img.src = g.dataUrl;
    img.onclick = function(){ kotak.classList.toggle('zoom'); };

    kotak.innerHTML = '';
    kotak.appendChild(img);

  } catch (e) {
    if (Verif.aktif && Verif.aktif.rowId === d.rowId){
      kotak.innerHTML = '<div class="teks">Gambar tidak dapat dimuat.<br>' + vAman(e.message) + '</div>';
    }
  }
}

/* ---------- SETUJUI ---------- */
async function setujui(paksa){
  const d = Verif.aktif;
  if (!d || Verif.sibuk) return;

  if (!paksa){
    const yakin = confirm('Terima setoran ' + vRp(d.nominal) + ' dari rumah ' + d.rumah +
                          '?\n\nData akan dicatat ke Jurnal Keuangan dan struk dikirim ke warga lewat WhatsApp.');
    if (!yakin) return;
  }

  await kirimKeputusan({ rowId: d.rowId, action: 'APPROVE', forceApprove: !!paksa });
}

function setujuiPaksa(){
  vTutup('lembarDuplikat');
  setujui(true);
}

/* ---------- TOLAK ---------- */
function bukaTolak(){
  if (!Verif.aktif) return;
  Verif.alasanIdx = -1;

  document.getElementById('alasanDaftar').innerHTML = ALASAN_TOLAK.map(function(a, i){
    return '<button class="alasan-pil" onclick="pilihAlasan(' + i + ')">' + vAman(a) + '</button>';
  }).join('');

  document.getElementById('kotakLainnya').classList.add('sembunyi');
  document.getElementById('alasanManual').value = '';
  document.getElementById('tolakGalat').classList.remove('on');
  vBuka('lembarTolak');
}

function pilihAlasan(i){
  Verif.alasanIdx = i;

  document.querySelectorAll('#alasanDaftar .alasan-pil').forEach(function(b, n){
    b.classList.toggle('on', n === i);
  });

  const lain = (i === IDX_LAINNYA);
  document.getElementById('kotakLainnya').classList.toggle('sembunyi', !lain);
  if (lain) setTimeout(function(){ document.getElementById('alasanManual').focus(); }, 150);
}

async function tolakSekarang(){
  const d = Verif.aktif;
  const galat = document.getElementById('tolakGalat');
  if (!d || Verif.sibuk) return;

  if (Verif.alasanIdx < 0){
    galat.textContent = 'Pilih salah satu alasan.';
    galat.classList.add('on');
    return;
  }

  let alasan = ALASAN_TOLAK[Verif.alasanIdx];
  if (Verif.alasanIdx === IDX_LAINNYA){
    alasan = document.getElementById('alasanManual').value.trim();
    if (!alasan){
      galat.textContent = 'Tulis alasannya dulu.';
      galat.classList.add('on');
      return;
    }
  }
  galat.classList.remove('on');

  await kirimKeputusan({ rowId: d.rowId, action: 'REJECT', alasan: alasan });
}

/* ---------- KIRIM KEPUTUSAN ---------- */
async function kirimKeputusan(form){
  if (Verif.sibuk) return;
  Verif.sibuk = true;
  kunciTombol(true);

  try {
    const r = await panggilAPI('prosesVerifikasi', form);

    // Peringatan duplikat: tanyakan dulu, jangan anggap selesai
    if (r && r.status === 'warning'){
      document.getElementById('isiDuplikat').textContent = r.message || 'Transaksi serupa sudah ada.';
      vBuka('lembarDuplikat');
      return;
    }

    vTutup('lembarTolak');
    vTutup('lembarDuplikat');
    vTutup('lembarBukti');
    Verif.aktif = null;

    toast(r && r.message ? r.message : 'Selesai diproses');
    muatAntrian();

  } catch (e) {
    toast('Gagal: ' + e.message);

    // Kemungkinan sudah diproses orang lain → tutup semua dan segarkan
    if (String(e.message).indexOf('sudah diproses') !== -1){
      vTutup('lembarTolak');
      vTutup('lembarDuplikat');
      vTutup('lembarBukti');
      Verif.aktif = null;
      muatAntrian();
    }
  } finally {
    Verif.sibuk = false;
    kunciTombol(false);
  }
}

function kunciTombol(kunci){
  document.querySelectorAll(
    '#lembarBukti .lembar-bawah button, #lembarTolak .lembar-bawah button, ' +
    '#lembarDuplikat .lembar-bawah button'
  ).forEach(function(b){ b.disabled = kunci; });
}

/* ---------- ALAT ---------- */
function vBuka(id){ const el = document.getElementById(id); if (el) el.classList.add('on'); }
function vTutup(id){ const el = document.getElementById(id); if (el) el.classList.remove('on'); }

function vAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}

function vRp(n){
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

function vBaris(label, nilai, besar){
  return '<div class="vf-baris' + (besar ? ' besar' : '') + '"><span>' + vAman(label) +
         '</span><b>' + vAman(nilai) + '</b></div>';
}

/** "21 Aug 2026" → "21 Agu 2026". Format lain dibiarkan apa adanya. */
function tglIdn(t){
  return String(t == null ? '' : t).replace(/\b([A-Z][a-z]{2})\b/, function(m){
    return BLN_EN_ID[m] || m;
  });
}