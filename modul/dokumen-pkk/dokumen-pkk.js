/* =================================================================
   MODUL DOKUMEN RAPAT PKK (Tahap 5E)
   Tidak punya logika sendiri: memakai mesin di dokumen-rt.js.
   Mesin dimuat sekali saja, lalu ditandai terpasang supaya
   kunjungan ke Dokumen RT tidak memuatnya dua kali.
   ================================================================= */

async function init_dokumen_pkk(){
  if (typeof mulaiDokumen !== 'function'){
    await new Promise(function(ok, gagal){
      const s = document.createElement('script');
      s.src = '/modul/dokumen-rt/dokumen-rt.js';
      s.onload = ok;
      s.onerror = function(){ gagal(new Error('Mesin dokumen gagal dimuat. Periksa sambungan.')); };
      document.body.appendChild(s);
    });
    App.modulTerpasang['dokumen-rt'] = true;
  }
  await mulaiDokumen('PKK');
}