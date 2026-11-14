/* =================================================================
   MODUL LAPORAN KINERJA PKK (Tahap 5F)
   Input lewat Google Form; aplikasi menampilkan, merangkum, mencetak.
   ================================================================= */

const Lp = { data: [], tahunTerisi: false, cari: '', fotoAktif: 0 };

const LP_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

async function init_laporan_pkk(){
  Lp.data = []; Lp.tahunTerisi = false; Lp.cari = ''; Lp.fotoAktif++;
  const kini = new Date();
  // Bawaan: bulan & tahun ini (pilihan tahun diisi setelah data pertama datang)
  document.getElementById('lpTahun').innerHTML =
    '<option value="' + kini.getFullYear() + '">' + kini.getFullYear() + '</option><option value="">Semua tahun</option>';
  document.getElementById('lpBulan').value = String(kini.getMonth() + 1);
  await muatLaporan();
}

/* ---------- MUAT ---------- */
async function muatLaporan(){
  const kotak = document.getElementById('lpDaftar');
  if (!kotak) return;
  const thn = document.getElementById('lpTahun').value;
  const bln = document.getElementById('lpBulan').value;

  kotak.innerHTML = '<div class="memuat">Memuat laporan…</div>';
  document.getElementById('lpRingkas').innerHTML = '';

  try {
    const h = await panggilAPI('laporanPKK', thn, bln);
    Lp.data = h.data || [];

    // Isi pilihan tahun sekali, pertahankan pilihan sekarang
    if (!Lp.tahunTerisi){
      const daftar = (h.tahun || []).map(String);
      if (thn && daftar.indexOf(thn) === -1) daftar.unshift(thn);
      document.getElementById('lpTahun').innerHTML = '<option value="">Semua tahun</option>' +
        daftar.map(function(y){ return '<option value="' + lpAman(y) + '">' + lpAman(y) + '</option>'; }).join('');
      document.getElementById('lpTahun').value = thn;
      Lp.tahunTerisi = true;
    }

    const isi = document.getElementById('lpIsi');
    if (h.linkForm){ isi.href = h.linkForm; isi.classList.remove('lp-sembunyi'); }
    else isi.classList.add('lp-sembunyi');

    gambarLaporan();
  } catch (e) {
    document.getElementById('lpSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + lpAman(e.message) + '</p></div>';
  }
}

function lpPeriode(){
  const thn = document.getElementById('lpTahun').value;
  const bln = document.getElementById('lpBulan').value;
  if (!thn && !bln) return 'Semua periode';
  return [bln ? LP_BULAN[Number(bln)] : 'Setahun', thn || 'semua tahun'].join(' ');
}

/* ---------- TAMPIL ---------- */
function gambarLaporan(){
  const kotak = document.getElementById('lpDaftar');
  if (!kotak) return;
  const semua = Lp.data;
  document.getElementById('lpSub').textContent = lpPeriode() + ' · ' + semua.length + ' laporan';
  document.getElementById('lpCari').classList.toggle('lp-sembunyi', semua.length < 6);

  // Ringkasan periode (dari seluruh data periode, bukan hasil pencarian)
  if (semua.length){
    const kader = {}, prog = {};
    semua.forEach(function(d){
      if (d.kader) kader[d.kader.toLowerCase()] = true;
      const p = d.program || 'Lainnya';
      prog[p] = (prog[p] || 0) + 1;
    });
    const urutProg = Object.keys(prog).sort(function(a, b){ return prog[b] - prog[a]; });
    document.getElementById('lpRingkas').innerHTML = '<div class="lp-ringkas">' +
      '<div class="lp-angka"><div><b>' + semua.length + '</b><small>LAPORAN</small></div>' +
      '<div><b>' + Object.keys(kader).length + '</b><small>KADER MELAPOR</small></div>' +
      '<div><b>' + urutProg.length + '</b><small>PROGRAM</small></div></div>' +
      '<div class="lp-prog">' + urutProg.map(function(p){
        return '<span>' + lpAman(p) + '<b>' + prog[p] + '</b></span>';
      }).join('') + '</div></div>';
  }

  const q = Lp.cari.trim().toLowerCase();
  const tampil = [];
  semua.forEach(function(d, i){
    if (q){
      const teks = [d.kegiatan, d.kader, d.program, d.target, d.pemberi].join(' ').toLowerCase();
      if (teks.indexOf(q) === -1) return;
    }
    tampil.push(i);
  });

  if (!tampil.length){
    kotak.innerHTML = '<div class="kosong"><h2>Belum ada laporan</h2><p>' +
      (semua.length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada laporan kegiatan untuk ' + lpAman(lpPeriode()) + '.') +
      '</p></div>';
    return;
  }

  kotak.innerHTML = tampil.map(function(i){
    const d = Lp.data[i];
    return '<div class="lp-kartu">' +
      '<div class="lp-atas"><b>' + lpAman(d.kegiatan || '(tanpa judul)') + '</b>' +
        (d.program ? '<span class="lp-tag">' + lpAman(d.program) + '</span>' : '') + '</div>' +
      '<div class="lp-meta">' + lpAman(d.tgl) + ' · ' + lpAman(d.kader || '-') + '</div>' +
      '<div class="lp-detail">' +
        (d.target ? '<div><span>Sasaran:</span> ' + lpAman(d.target) + '</div>' : '') +
        (d.pemberi ? '<div><span>Pemberi tugas:</span> ' + lpAman(d.pemberi) + '</div>' : '') +
      '</div>' +
      (d.foto && d.foto.length
        ? '<button class="lp-foto" onclick="lihatFoto(' + i + ')"><svg class="ic"><use href="#i-mata"/></svg>' +
          'Lihat foto' + (d.foto.length > 1 ? ' (' + d.foto.length + ')' : '') + '</button>'
        : '') +
    '</div>';
  }).join('');
}

/* ---------- FOTO ---------- */
async function lihatFoto(i){
  const d = Lp.data[i];
  if (!d || !d.foto.length) return;
  const giliran = ++Lp.fotoAktif;

  document.getElementById('lfJudul').textContent = d.kegiatan || 'Foto Kegiatan';
  const kotak = document.getElementById('lfIsi');
  kotak.innerHTML = d.foto.map(function(id, k){
    return '<div class="lp-gambar" id="lfG' + k + '"><div class="ket">Memuat foto ' + (k + 1) + '…</div></div>';
  }).join('');
  bukaLembar('lembarFotoLaporan');

  // Satu per satu, supaya sinyal lemah tidak kewalahan
  for (let k = 0; k < d.foto.length; k++){
    if (giliran !== Lp.fotoAktif) return;   // lembar sudah dibuka untuk laporan lain
    const wadah = document.getElementById('lfG' + k);
    if (!wadah) return;
    try {
      const src = await panggilAPI('fotoLaporan', d.foto[k]);
      if (giliran !== Lp.fotoAktif) return;
      wadah.innerHTML = '<img alt="Foto kegiatan ' + (k + 1) + '">';
      wadah.querySelector('img').src = src;
    } catch (e) {
      if (giliran !== Lp.fotoAktif) return;
      wadah.innerHTML = '<div class="ket">' + lpAman(e.message) +
        '<br><a href="https://drive.google.com/open?id=' + encodeURIComponent(d.foto[k]) +
        '" target="_blank" rel="noopener">Buka di Google Drive</a></div>';
    }
  }
}

/* ---------- CETAK ---------- */
function cetakLaporan(){
  if (!Lp.data.length) return toast('Tidak ada laporan untuk dicetak.');
  const w = window.open('', '_blank');
  if (!w) return toast('Izinkan jendela baru untuk mencetak.');

  const baris = Lp.data.map(function(d, i){
    return '<tr><td>' + (i + 1) + '</td><td>' + lpAman(d.tgl) + '</td><td>' + lpAman(d.kader) + '</td>' +
      '<td><b>' + lpAman(d.kegiatan) + '</b></td><td>' + lpAman(d.program) + '</td>' +
      '<td>' + lpAman(d.target) + '</td><td>' + lpAman(d.pemberi) + '</td></tr>';
  }).join('');

  w.document.write('<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Laporan Kinerja PKK - ' + lpAman(lpPeriode()) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:18px;}' +
    'h1{font-size:16px;margin:0 0 2px;}p{margin:0 0 12px;color:#555;}' +
    'table{width:100%;border-collapse:collapse;}th,td{border:1px solid #999;padding:5px 6px;text-align:left;vertical-align:top;}' +
    'th{background:#eee;}@page{size:A4 landscape;margin:12mm;}</style></head><body>' +
    '<h1>Laporan Kinerja PKK</h1><p>Periode: ' + lpAman(lpPeriode()) + ' · ' + Lp.data.length + ' laporan</p>' +
    '<table><thead><tr><th>No</th><th>Tanggal</th><th>Kader</th><th>Kegiatan</th><th>Program</th>' +
    '<th>Sasaran</th><th>Pemberi Tugas</th></tr></thead><tbody>' + baris + '</tbody></table>' +
    '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 400);
}

/* ---------- ALAT ---------- */
function lpAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}