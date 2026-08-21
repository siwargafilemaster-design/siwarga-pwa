// =========================================================
// api.js — jembatan ke backend AppScript
// Pola dari "FONDASI Project Baru" (terbukti di app Zakat)
// =========================================================

const URL_API = "https://script.google.com/macros/s/AKfycbzaT1gqIqhh2suw-_ixWRpsABpPqwiI8qNGx2nRV16h8x_xnbTse4bcrkBxngvOed-ZEQ/exec";

/**
 * Memanggil satu action di backend.
 * PENTING: sengaja TANPA header Content-Type.
 * Header itu memicu preflight OPTIONS yang tidak bisa dijawab AppScript.
 */
async function panggilAPI(action, ...args) {
  const token = localStorage.getItem('siwarga_token') || null;

  const res = await fetch(URL_API, {
    method: "POST",
    body: JSON.stringify({ action: action, token: token, args: args })
  });

  const json = await res.json();

  if (json.status === "error") {
    // Nanti di Tahap 1, SESI_HABIS ditangani khusus (minta login ulang)
    const err = new Error(json.message || 'Terjadi kesalahan.');
    err.code = json.code || null;
    throw err;
  }

  return json.data;
}
