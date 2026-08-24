/* =================================================================
   MODUL BERANDA
   ================================================================= */

async function init_dashboard(){
  tanggalBeranda();
  document.getElementById('dashPeran').textContent   = LABEL_PERAN[App.peran] || App.peran;
  document.getElementById('dashRoleTag').textContent = LABEL_PERAN[App.peran] || App.peran;

  try {
    const d = await panggilAPI('getBeranda');
    isiIdentitas(d.info);
    isiPengumuman(d.pengumuman);
    isiStatistik(d.statistik);
    isiRonda(d.ronda);
  } catch (e) {
    document.getElementById('boxPengumuman').innerHTML =
      '<div class="card ann"><div class="ann-body">Gagal memuat data: ' + e.message + '</div></div>';
  }
}

function tanggalBeranda(){
  const hari  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const n = new Date();
  document.getElementById('dashHari').textContent = hari[n.getDay()];
  document.getElementById('dashTgl').textContent  =
    n.getDate() + ' ' + bulan[n.getMonth()] + ' ' + n.getFullYear();
}

function isiIdentitas(info){
  if (!info) return;
  document.getElementById('dashNamaRT').textContent = 'Warga ' + (info.nama || '');
  document.getElementById('dashDesc').textContent   = info.desc || '';
  document.getElementById('dashJudul').textContent  = info.nama || 'Lingkungan RT';

  if (info.logo && info.logo.length > 20){
    document.getElementById('dashLogo').innerHTML = '<img src="' + info.logo + '" alt="Logo">';
  }
}

function isiPengumuman(daftar){
  const kotak = document.getElementById('boxPengumuman');

  if (!daftar || !daftar.length){
    kotak.innerHTML = '<div class="card ann"><div class="ann-ic">' +
      '<svg class="ic ic-sm"><use href="#i-mega"/></svg></div>' +
      '<div class="ann-body">Belum ada pengumuman.</div></div>';
    return;
  }

  kotak.innerHTML = daftar.map(function(teks){
    return '<div class="card ann"><div class="ann-ic">' +
           '<svg class="ic ic-sm"><use href="#i-mega"/></svg></div>' +
           '<div class="ann-body">' + amanTeks(teks) + '</div></div>';
  }).join('');
}

function isiStatistik(s){
  const kotak = document.getElementById('boxStatistik');
  if (!s){ kotak.innerHTML = ''; return; }

  const totalRumah = (s.milik || 0) + (s.kontrak || 0) + (s.numpang || 0);
  const totalJiwa  = (s.pria  || 0) + (s.wanita  || 0);

  kotak.innerHTML =
    kartuDonat(totalRumah, 'rumah', s.milik, totalRumah, 'var(--sage)', 'Status Hunian',
      [['var(--sage)','Milik ' + (s.milik||0)],
       ['#EDF0F4','Kontrak ' + (s.kontrak||0)],
       ['var(--gold)','Numpang ' + (s.numpang||0)]]) +
    kartuDonat(totalJiwa, 'jiwa', s.pria, totalJiwa, 'var(--hero-2)', 'Gender',
      [['var(--hero-2)','Laki ' + (s.pria||0)],
       ['var(--pink)','Perempuan ' + (s.wanita||0)]]);
}

function kartuDonat(angka, satuan, bagian, total, warna, nama, legenda){
  const keliling = 239;                    // 2 × π × 38
  const isi = total ? (bagian / total) * keliling : 0;

  return '<div class="card stat">' +
    '<div class="donut"><svg width="96" height="96" viewBox="0 0 96 96">' +
      '<circle cx="48" cy="48" r="38" stroke="#EDF0F4" stroke-width="13" fill="none"/>' +
      '<circle cx="48" cy="48" r="38" stroke="' + warna + '" stroke-width="13" fill="none" ' +
        'stroke-linecap="round" stroke-dasharray="' + isi.toFixed(0) + ' ' + keliling + '"/>' +
    '</svg><div class="donut-mid"><b>' + angka + '</b><span>' + satuan + '</span></div></div>' +
    '<div class="stat-name">' + nama + '</div>' +
    '<div class="legend">' +
      legenda.map(function(l){
        return '<span><i style="background:' + l[0] + '"></i>' + l[1] + '</span>';
      }).join('') +
    '</div></div>';
}

function isiRonda(r){
  const lbl  = document.getElementById('rondaHari');
  const list = document.getElementById('rondaList');

  if (!r || r.status !== 'success'){
    lbl.textContent = 'Jadwal belum tersedia';
    list.innerHTML = '';
    return;
  }

  lbl.textContent = (r.hariIni || '') + ' · ' + (r.tgl || '');

  const petugas = String(r.petugas || '')
    .split(/[,;\n]/).map(function(x){ return x.trim(); })
    .filter(function(x){ return x && x !== '-'; });

  if (!petugas.length){
    list.innerHTML = '<div class="guard"><span>Belum ada petugas</span></div>';
    return;
  }

  list.innerHTML = petugas.map(function(nama){
    return '<div class="guard"><i>' + inisial(nama) + '</i><span>' + amanTeks(nama) + '</span></div>';
  }).join('');
}

function inisial(teks){
  const bersih = String(teks).replace(/^[A-Z0-9]+\s*-\s*/i, '').trim();
  const kata = bersih.split(/\s+/);
  return ((kata[0] || '?')[0] + (kata[1] ? kata[1][0] : '')).toUpperCase();
}

function amanTeks(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML;
}

/* ---------- SOS ---------- */
function bukaKentongan(){
  const lokasi = prompt('Lokasi kejadian (contoh: Blok A1):');
  if (!lokasi) return;

  const pilihan = prompt('Jenis darurat:\n1 = Kebakaran\n2 = Maling\n3 = Medis\n4 = Darurat Lain');
  const peta = { '1':'KEBAKARAN', '2':'MALING', '3':'MEDIS', '4':'DARURAT LAIN' };
  const jenis = peta[String(pilihan).trim()];
  if (!jenis) return;

  if (!confirm('Kirim sinyal ' + jenis + ' di ' + lokasi + '?')) return;
  kirimSinyal(jenis, lokasi);
}