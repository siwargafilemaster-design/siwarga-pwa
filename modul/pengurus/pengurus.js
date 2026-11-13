/* =================================================================
   MODUL DAFTAR PENGURUS & PANITIA (Tahap 5D)
   ================================================================= */

const Pg = {
  data: null,           // { rt, pkk, panitia, versiRT, versiPKK, boleh }
  tab: 'RT',
  edit: null,           // { mode: 'RT'|'PKK'|'PANITIA', versi, baris: [{jabatan,nama,hp}] }
  sibuk: false
};

async function init_pengurus(){
  Pg.data = null; Pg.tab = 'RT'; Pg.edit = null; Pg.sibuk = false;
  await muatPengurus();
}

/* ---------- MUAT & TAMPIL ---------- */
async function muatPengurus(){
  const kotak = document.getElementById('pgIsi');
  if (!kotak) return;
  kotak.innerHTML = '<div class="memuat">Memuat daftar pengurus…</div>';
  try {
    Pg.data = await panggilAPI('pengurus');
    gambarPengurus();
  } catch (e) {
    document.getElementById('pgSub').textContent = 'Gagal memuat';
    kotak.innerHTML = '<div class="kosong"><h2>Gagal memuat</h2><p>' + pgAman(e.message) + '</p></div>';
  }
}

function pilihTabPengurus(t){
  Pg.tab = t;
  document.querySelectorAll('.pg-tab button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-t') === t);
  });
  gambarPengurus();
}

function gambarPengurus(){
  const d = Pg.data;
  const kotak = document.getElementById('pgIsi');
  if (!d || !kotak) return;

  document.getElementById('pgSub').textContent =
    d.rt.length + ' pengurus RT · ' + d.pkk.length + ' pengurus PKK · ' + d.panitia.length + ' panitia aktif';

  if (Pg.tab === 'PANITIA') return gambarPanitia();

  const list = Pg.tab === 'RT' ? d.rt : d.pkk;
  const boleh = Pg.tab === 'RT' ? d.boleh.rt : d.boleh.pkk;

  let h = boleh
    ? '<div class="pg-alat"><button class="pg-btn utama" onclick="bukaEditPengurus(\'' + Pg.tab + '\')">Ubah pengurus ' + Pg.tab + '</button></div>'
    : '';

  h += list.length
    ? '<div class="pg-kotak">' + list.map(pgBarisOrang).join('') + '</div>'
    : '<div class="kosong"><h2>Belum ada data</h2><p>Susunan pengurus ' + Pg.tab + ' belum diisi.</p></div>';

  kotak.innerHTML = h;
}

function gambarPanitia(){
  const d = Pg.data;
  const kotak = document.getElementById('pgIsi');

  let h = d.boleh.panitia
    ? '<div class="pg-alat"><button class="pg-btn utama" onclick="bukaEditPengurus(\'PANITIA\')">+ Bentuk panitia</button></div>'
    : '';

  if (!d.panitia.length){
    h += '<div class="kosong"><h2>Tidak ada panitia aktif</h2><p>Kepanitiaan acara yang sedang berjalan akan tampil di sini.</p></div>';
  } else {
    h += d.panitia.map(function(p, i){
      return '<div class="pg-kotak">' +
        '<div class="pg-kepala"><span>' + pgAman(p.acara) + '</span>' +
          (d.boleh.panitia ? '<button class="pg-kecil" onclick="arsipkanAcara(' + i + ')">Arsipkan</button>' : '') +
        '</div>' +
        p.anggota.map(pgBarisOrang).join('') +
      '</div>';
    }).join('');
  }
  kotak.innerHTML = h;
}

function pgBarisOrang(o){
  const ketua = /ketua/i.test(o.jabatan) && !/wakil/i.test(o.jabatan);
  const wa = pgNomorWA(o.hp);
  return '<div class="pg-orang' + (ketua ? ' ketua' : '') + '">' +
    '<div class="isi"><small>' + pgAman(o.jabatan) + '</small><b>' + pgAman(o.nama) + '</b></div>' +
    (wa
      ? '<a class="pg-wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' +
          '<svg class="ic"><use href="#i-wa"/></svg>Chat</a>'
      : '<span class="pg-tanpa">—</span>') +
  '</div>';
}

/* ---------- ARSIP PANITIA ---------- */
async function arsipkanAcara(i){
  const p = Pg.data.panitia[i];
  if (!p || Pg.sibuk) return;
  if (!confirm('Arsipkan panitia "' + p.acara + '"? Panitia ini tidak tampil lagi di daftar.')) return;

  Pg.sibuk = true;
  tunggu('Mengarsipkan panitia…', p.acara);
  try {
    const h = await panggilAPI('arsipPanitia', p.acara);
    selesaiTunggu();
    toast(h.message || 'Diarsipkan');
    await muatPengurus();
  } catch (e) {
    selesaiTunggu();
    toast(e.message);
  } finally {
    Pg.sibuk = false;
  }
}

/* ---------- EDITOR ---------- */
function bukaEditPengurus(mode){
  const d = Pg.data;
  const salin = function(list){ return list.map(function(o){ return { jabatan: o.jabatan, nama: o.nama, hp: o.hp }; }); };

  if (mode === 'PANITIA'){
    Pg.edit = { mode: mode, versi: '', baris: [{ jabatan: 'Ketua', nama: '', hp: '' }] };
    document.getElementById('peJudul').textContent = 'Bentuk Panitia';
    document.getElementById('peAcara').value = '';
  } else {
    Pg.edit = {
      mode: mode,
      versi: mode === 'RT' ? d.versiRT : d.versiPKK,
      baris: salin(mode === 'RT' ? d.rt : d.pkk)
    };
    if (!Pg.edit.baris.length) Pg.edit.baris.push({ jabatan: 'Ketua ' + mode, nama: '', hp: '' });
    document.getElementById('peJudul').textContent = 'Ubah Pengurus ' + mode;
  }

  document.getElementById('peAreaAcara').classList.toggle('pg-sembunyi', mode !== 'PANITIA');
  document.getElementById('peGalat').textContent = '';
  gambarEditor();
  bukaLembar('lembarEditPengurus');
}

function gambarEditor(){
  const b = Pg.edit.baris;
  document.getElementById('peDaftar').innerHTML = b.map(function(o, i){
    return '<div class="pg-edit">' +
      '<div class="pg-edit-atas"><b>ORANG KE-' + (i + 1) + '</b>' +
        '<button class="pg-ikon naik" ' + (i === 0 ? 'disabled ' : '') + 'onclick="geserBaris(' + i + ',-1)" aria-label="Naik">' +
          '<svg class="ic"><use href="#i-chev"/></svg></button>' +
        '<button class="pg-ikon turun" ' + (i === b.length - 1 ? 'disabled ' : '') + 'onclick="geserBaris(' + i + ',1)" aria-label="Turun">' +
          '<svg class="ic"><use href="#i-chev"/></svg></button>' +
        '<button class="pg-ikon hapus" onclick="hapusBaris(' + i + ')" aria-label="Hapus">' +
          '<svg class="ic"><use href="#i-hapus"/></svg></button>' +
      '</div>' +
      '<input placeholder="Jabatan (mis. Bendahara)" maxlength="60" value="' + pgAman(o.jabatan) + '" ' +
        'oninput="Pg.edit.baris[' + i + '].jabatan = this.value">' +
      '<input placeholder="Nama" maxlength="80" value="' + pgAman(o.nama) + '" ' +
        'oninput="Pg.edit.baris[' + i + '].nama = this.value">' +
      '<input placeholder="HP / WhatsApp" inputmode="numeric" maxlength="15" value="' + pgAman(o.hp) + '" ' +
        'oninput="this.value = this.value.replace(/\\D/g, \'\'); Pg.edit.baris[' + i + '].hp = this.value">' +
    '</div>';
  }).join('');
}

function tambahBarisPengurus(){
  Pg.edit.baris.push({ jabatan: '', nama: '', hp: '' });
  gambarEditor();
  const semua = document.querySelectorAll('#peDaftar .pg-edit');
  if (semua.length) semua[semua.length - 1].querySelector('input').focus();
}

function geserBaris(i, arah){
  const b = Pg.edit.baris, j = i + arah;
  if (j < 0 || j >= b.length) return;
  const x = b[i]; b[i] = b[j]; b[j] = x;
  gambarEditor();
}

function hapusBaris(i){
  const o = Pg.edit.baris[i];
  if ((o.jabatan || o.nama) && !confirm('Hapus ' + (o.nama || o.jabatan) + ' dari daftar?')) return;
  Pg.edit.baris.splice(i, 1);
  gambarEditor();
}

function tutupEditPengurus(){
  tutupLembar('lembarEditPengurus');
  Pg.edit = null;
}

async function simpanEditPengurus(){
  if (!Pg.edit || Pg.sibuk) return;
  const galat = document.getElementById('peGalat');
  galat.textContent = '';

  const e = Pg.edit;
  const isi = e.baris.filter(function(o){ return String(o.jabatan).trim() || String(o.nama).trim(); });
  for (let i = 0; i < isi.length; i++){
    if (!String(isi[i].jabatan).trim() || !String(isi[i].nama).trim()){
      return (galat.textContent = 'Setiap orang wajib punya jabatan dan nama.');
    }
  }
  if (!isi.length) return (galat.textContent = 'Isi minimal satu orang.');

  let acara = '';
  if (e.mode === 'PANITIA'){
    acara = document.getElementById('peAcara').value.trim();
    if (!acara) return (galat.textContent = 'Nama acara wajib diisi.');
  }

  Pg.sibuk = true;
  tunggu('Menyimpan…', e.mode === 'PANITIA' ? acara : 'Pengurus ' + e.mode);
  try {
    const h = (e.mode === 'PANITIA')
      ? await panggilAPI('buatPanitia', acara, isi)
      : await panggilAPI('simpanPengurus', e.mode, isi, e.versi);
    selesaiTunggu();
    tutupEditPengurus();
    toast(h.message || 'Tersimpan');
    if (e.mode === 'PANITIA') Pg.tab = 'PANITIA';
    await muatPengurus();
    pilihTabPengurus(Pg.tab);
  } catch (err) {
    selesaiTunggu();
    galat.textContent = err.message;
  } finally {
    Pg.sibuk = false;
  }
}

/* ---------- ALAT ---------- */
function pgNomorWA(hp){
  let n = String(hp || '').replace(/\D/g, '');
  if (n.length < 8) return '';
  if (n.indexOf('0') === 0) n = '62' + n.substring(1);
  else if (n.indexOf('62') !== 0) n = '62' + n;
  return n;
}
function pgAman(t){
  const d = document.createElement('div');
  d.textContent = String(t == null ? '' : t);
  return d.innerHTML.replace(/"/g, '&quot;');
}