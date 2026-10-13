/* =================================================================
   MODUL KEUANGAN RT — bagian baca
   ================================================================= */

const Keu = {
  summary: null,
  rumah: [],
  terpilih: null
};

async function init_keuangan_rt(){
  pasangPencarian();

  // Tampilkan dari ingatan HP dulu supaya layar tidak kosong
  const lama = ambilIngatan('keuangan');
  if (lama){
    Keu.summary = lama.summary;
    Keu.rumah   = lama.rumah || [];
    gambarSaldo(Keu.summary);
    gambarDaftarRumah();
  }

  try {
    const d = await panggilAPI('keuanganAwal');
    Keu.summary = d.summary;
    Keu.rumah   = d.rumah || [];
    simpanIngatan('keuangan', d);

    gambarSaldo(Keu.summary);
    gambarDaftarRumah();
  } catch (e) {
    if (!lama){
      document.getElementById('keuSub').textContent = 'Gagal memuat';
      document.getElementById('hasilBuku').innerHTML =
        '<div class="kosong"><h2>Gagal memuat data</h2><p>' + aman(e.message) + '</p></div>';
    }
  }
}

/* ---------- SALDO ---------- */
function gambarSaldo(s){
  if (!s) return;

  document.getElementById('keuTunai').textContent   = rupiahPendek(s.tunai);
  document.getElementById('keuBank').textContent    = rupiahPendek(s.bank);
  document.getElementById('keuTotal').textContent   = rupiahPendek(s.total);
  document.getElementById('keuB1').textContent      = rupiahPendek(s.b1_total);
  document.getElementById('keuB2').textContent      = rupiahPendek(s.b2_total);
  document.getElementById('keuTitipan').textContent = rupiahPendek(s.titipan);

  document.getElementById('keuSub').textContent = 'Total kas ' + rupiah(s.total);

  const n = new Date();
  document.getElementById('keuUpdate').textContent =
    'Diperbarui ' + String(n.getHours()).padStart(2,'0') + ':' +
    String(n.getMinutes()).padStart(2,'0');
}

/* ---------- DAFTAR RUMAH ---------- */
function gambarDaftarRumah(saring){
  const kotak = document.getElementById('rumahGrid');
  const jml   = document.getElementById('keuJmlRumah');
  if (!kotak) return;

  jml.textContent = Keu.rumah.length + ' rumah';

  let daftar = Keu.rumah;
  if (saring){
    const q = saring.trim().toUpperCase();
    daftar = daftar.filter(function(r){ return String(r).toUpperCase().indexOf(q) !== -1; });
  }

  // Tanpa pencarian, tampilkan secukupnya saja supaya tidak panjang
  const dipotong = !saring && daftar.length > 24;
  if (dipotong) daftar = daftar.slice(0, 24);

  if (!daftar.length){
    kotak.innerHTML = '<div style="font-size:.78rem;color:var(--muted);padding:8px 2px;">Tidak ada rumah yang cocok.</div>';
    return;
  }

  kotak.innerHTML = daftar.map(function(r){
    const aktif = (r === Keu.terpilih) ? ' on' : '';
    return '<button class="rumah-pil' + aktif + '" onclick="pilihRumah(\'' +
           String(r).replace(/'/g, "\\'") + '\')">' + aman(r) + '</button>';
  }).join('') + (dipotong
    ? '<div style="font-size:.7rem;color:var(--muted);width:100%;padding:6px 2px;">…dan ' +
      (Keu.rumah.length - 24) + ' lagi. Ketik di kotak pencarian.</div>'
    : '');
}

function pasangPencarian(){
  const input = document.getElementById('cariRumah');
  if (!input) return;
  input.addEventListener('input', function(){ gambarDaftarRumah(this.value); });
}

/* ---------- BUKU BESAR ---------- */
async function pilihRumah(no){
  Keu.terpilih = no;
  gambarDaftarRumah(document.getElementById('cariRumah').value);

  const kotak = document.getElementById('hasilBuku');
  kotak.innerHTML = '<div class="memuat">Menyiapkan kartu tagihan…</div>';

  try {
    const d = await panggilAPI('getBukuBesar', no);

    if (!d || d.status === 'error'){
      kotak.innerHTML = '<div class="kosong"><h2>Gagal</h2><p>' +
                        aman(d && d.message ? d.message : 'Data tidak terbaca.') + '</p></div>';
      return;
    }

    gambarBukuBesar(d, no);
  } catch (e) {
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + aman(e.message) + '</p></div>';
  }
}

function gambarBukuBesar(d, no){
  const kotak = document.getElementById('hasilBuku');
  let html = '';

  html += '<div class="sec-head" style="margin-top:4px;"><h3>Rumah ' + aman(no) + '</h3></div>';

  const saldo = (d.info && d.info.saldo) ? d.info.saldo : 0;
  html += '<div class="keu-saldo-titipan"><span>Saldo titipan rumah</span><b>' +
          rupiah(saldo) + '</b></div>';

  if (!d.cards || !d.cards.length){
    html += '<div class="kosong"><h2>Belum ada data</h2><p>Rumah ini belum punya kartu tagihan.</p></div>';
    kotak.innerHTML = html;
    return;
  }

  d.cards.forEach(function(c){
    let gaya = 'pemilik';
    if (c.type === 'ACTIVE') gaya = 'aktif';
    else if (c.type === 'PAST') gaya = 'lama';

    let label = '';
    if (c.statusDetail) label += '<span class="kw-label">' + aman(c.statusDetail) + '</span>';
    label += '<span class="kw-label">' + aman(c.statusLabel || '') + '</span>';

    let baris = '';
    if (c.rows && c.rows.length){
      baris = c.rows.map(function(h){
        return '<tr><td style="font-weight:600;white-space:nowrap;">' + aman(h.bulan) + '</td>' +
               '<td class="num">' + aman(h.tagihan) + '</td>' +
               '<td><span class="st ' + kelasStatus(h.status) + '">' + aman(h.status) + '</span></td>' +
               '<td class="num" style="color:var(--muted);font-size:.72rem;">' +
                 aman(h.tglBayar || '-') + '</td></tr>';
      }).join('');
    } else {
      baris = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">' +
              'Tidak ada tagihan pada periode ini.</td></tr>';
    }

    html +=
      '<div class="kartu-warga">' +
        '<div class="kw-atas ' + gaya + '">' +
          '<div class="kw-nama">' + aman(c.nama) + '</div>' +
          '<div>' + label + '</div>' +
          '<div class="kw-hutang"><div><small>Tunggakan</small>' +
            '<b>' + rupiah(c.totalHutang) + '</b></div></div>' +
        '</div>' +
        '<div class="kw-gulir"><table class="kw-tabel">' +
          '<thead><tr><th>Bulan</th><th class="num">Tagihan</th><th>Status</th>' +
          '<th class="num">Bayar</th></tr></thead>' +
          '<tbody>' + baris + '</tbody>' +
        '</table></div>' +
      '</div>';
  });

  kotak.innerHTML = html;
}

function kelasStatus(s){
  const t = String(s || '').toUpperCase();
  if (t === 'LUNAS') return 'lunas';
  if (t === 'BELUM BAYAR') return 'belum';
  return 'tidak';
}

/* ---------- ALAT ---------- */
function rupiah(n){
  if (!n) return 'Rp 0';
  if (typeof n === 'string' && n.indexOf('Rp') !== -1) return n;
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/** Versi pendek untuk kotak sempit: Rp 18,7jt */
function rupiahPendek(n){
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return 'Rp ' + (v/1000000).toFixed(1).replace('.', ',') + 'jt';
  if (Math.abs(v) >= 1000)    return 'Rp ' + Math.round(v/1000) + 'rb';
  return 'Rp ' + v.toLocaleString('id-ID');
}

function aman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}