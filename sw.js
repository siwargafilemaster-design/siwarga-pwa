/* =================================================================
   sw.js — Service Worker SiWARGA
   Jaringan dulu untuk kode; simpanan dulu untuk ikon & huruf.
   Panggilan API (POST ke AppScript) TIDAK disentuh.

   Kapan VERSI perlu dinaikkan (v1 → v2)?
   - Saat mengganti logo di /aset dengan nama berkas yang sama, atau
   - Saat mengubah daftar SIMPAN_AWAL.
   Mengubah kode modul biasa TIDAK perlu menaikkan versi.
   ================================================================= */

const VERSI = 'siwarga-v3';
const BATAS_TUNGGU = 4000;   // ms; lewat dari ini & ada salinan → pakai salinan

const SIMPAN_AWAL = [
  '/',
  '/manifest.json',
  '/inti/base.css',
  '/inti/components.css',
  '/inti/api.js',
  '/inti/app.js',
  '/modul/dashboard/dashboard.html',
  '/modul/dashboard/dashboard.js',
  '/aset/icon-192.png',
  '/aset/icon-512.png',
  '/aset/splash-teal.png',
  '/aset/splash-oranye.png',
  '/aset/splash-logo.png',
  '/aset/splash-tulisan.png'
];

/* ---------- PASANG: simpan berkas inti ---------- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSI).then(function (cache) {
      // Satu per satu: berkas yang tidak ada dilewati, pemasangan tidak gagal total
      return Promise.all(SIMPAN_AWAL.map(function (url) {
        return cache.add(url).catch(function () { console.warn('[SW] lewati', url); });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

/* ---------- AKTIF: buang simpanan versi lama ---------- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (kunci) {
      return Promise.all(kunci
        .filter(function (k) { return k.indexOf('siwarga-') === 0 && k !== VERSI; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---------- AMBIL ---------- */
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;                 // POST ke AppScript: biarkan

  const url = new URL(req.url);

  // Huruf Google
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(simpananDulu(req));
    return;
  }

  // Asal lain (AppScript, gambar Drive, dll.): biarkan
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/aset/') === 0) {
    e.respondWith(simpananDulu(req));
    return;
  }

  e.respondWith(jaringanDulu(req));
});

/* ---------- STRATEGI ---------- */

function layakDisimpan(res) {
  return res && res.ok && !res.redirected;
}

async function jaringanDulu(req) {
  const cache = await caches.open(VERSI);
  const salinan = await cache.match(req, { ignoreSearch: true });

  const dariJaringan = fetch(req).then(function (res) {
    if (layakDisimpan(res)) cache.put(req, res.clone());
    return res;
  });

  // Belum punya salinan: tunggu jaringan apa adanya
  if (!salinan) {
    try {
      return await dariJaringan;
    } catch (err) {
      if (req.mode === 'navigate') {
        const awal = await cache.match('/');
        if (awal) return awal;
      }
      throw err;
    }
  }

  // Punya salinan: tunggu jaringan maksimal BATAS_TUNGGU, lalu pakai salinan.
  // Jaringan tetap berjalan di belakang dan memperbarui salinan untuk kunjungan berikutnya.
  return Promise.race([
    dariJaringan.catch(function () { return salinan; }),
    new Promise(function (ok) { setTimeout(function () { ok(salinan); }, BATAS_TUNGGU); })
  ]);
}

async function simpananDulu(req) {
  const cache = await caches.open(VERSI);
  const salinan = await cache.match(req);
  if (salinan) return salinan;

  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}