/* ============ Караван: старт ============ */
(function (root) {
  'use strict';
  const C = root.Caravan;

  function boot() {
    try {
      C.ui.boot();
    } catch (err) {
      console.error(err);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:30px;background:#120e0b;color:#f2e6d2;font:14px/1.5 system-ui;z-index:99;text-align:center';
      box.innerHTML = '<div><h2 style="color:#e8b464">Караван не завёлся</h2><pre style="white-space:pre-wrap;color:#e0605a;font-size:12px">' +
        String(err && err.stack || err).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) +
        '</pre><p>Открой консоль браузера (F12) для подробностей.</p></div>';
      document.body.appendChild(box);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
