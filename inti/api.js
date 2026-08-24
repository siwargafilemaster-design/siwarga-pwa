// =========================================================
// api.js — jembatan ke backend AppScript
// =========================================================

const URL_API = "https://script.google.com/macros/s/AKfycbxTY7Rdrx9rFouyj1YaQlwIugU-g1FMRdbia7e7K0qmZ-oencN_SpITipFJlw8KfyFzYg/exec";

function ambilToken()      { return localStorage.getItem('siwarga_token'); }
function simpanToken(t)    { localStorage.setItem('siwarga_token', t); }
function buangToken()      { localStorage.removeItem('siwarga_token'); }

/**
 * PENTING: sengaja TANPA header Content-Type.
 * Header itu memicu preflight OPTIONS yang tidak bisa dijawab AppScript.
 */
async function panggilAPI(action, ...args) {
  const res = await fetch(URL_API, {
    method: "POST",
    body: JSON.stringify({ action: action, token: ambilToken(), args: args })
  });

  const json = await res.json();

  if (json.status === "error") {
    // Sesi habis di tengah jalan → bersihkan & beri tahu aplikasi
    if (json.code === 'SESI_HABIS') {
      buangToken();
      window.dispatchEvent(new CustomEvent('sesi-habis'));
    }
    const err = new Error(json.message || 'Terjadi kesalahan.');
    err.code = json.code || null;
    throw err;
  }

  return json.data;
}
