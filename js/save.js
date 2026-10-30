/* ============ Караван: сохранение на диск ============ */
(function (root) {
  'use strict';
  const C = root.Caravan;
  const KEY = 'caravan.save.v1';
  const Save = (C.save = {});

  function wrap(state) {
    return JSON.stringify({
      app: 'karavan',
      v: 1,
      savedAt: new Date().toISOString(),
      state,
    }, null, 2);
  }

  Save.hasLocal = function () {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  };

  Save.writeLocal = function (state) {
    try {
      localStorage.setItem(KEY, wrap(state));
      return true;
    } catch (e) {
      return false;
    }
  };

  Save.readLocal = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const state = obj && obj.state ? obj.state : obj;
      return C.game.sanitize(state);
    } catch (e) {
      return null;
    }
  };

  Save.clearLocal = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  };

  function fileName(state) {
    return `karavan-den-${state.day}.json`;
  }

  /* Записать настоящий файл на диск (Chromium), иначе — скачать */
  Save.exportFile = async function (state) {
    const data = wrap(state);
    const name = fileName(state);

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'Сохранение «Каравана»', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return { ok: true, file: handle.name || name };
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          if (err.name === 'AbortError') return { ok: false, msg: 'Сохранение отменено' };
        }
        /* падаем в скачивание */
      }
    }

    try {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { ok: true, file: name, downloaded: true };
    } catch (e) {
      return { ok: false, msg: 'Браузер не дал сохранить файл' };
    }
  };

  /* Прочитать файл: современный пикер, иначе — скрытый input */
  Save.importFile = function (inputEl) {
    return new Promise((resolve) => {
      const finish = (file) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const obj = JSON.parse(String(reader.result));
            const state = C.game.sanitize(obj && obj.state ? obj.state : obj);
            resolve(state ? { ok: true, state } : { ok: false, msg: 'Файл не похож на сохранение «Каравана»' });
          } catch (e) {
            resolve({ ok: false, msg: 'Не удалось прочитать JSON' });
          }
        };
        reader.onerror = () => resolve({ ok: false, msg: 'Ошибка чтения файла' });
        reader.readAsText(file);
      };

      if (typeof window.showOpenFilePicker === 'function') {
        window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'Сохранение «Каравана»', accept: { 'application/json': ['.json'] } }],
        }).then(async (handles) => {
          try {
            const file = await handles[0].getFile();
            finish(file);
          } catch (e) {
            resolve(null);
          }
        }).catch((err) => {
          if (err && err.name === 'AbortError') resolve(null);
          else inputEl.click();
        });
        return;
      }

      inputEl.onchange = () => {
        const file = inputEl.files && inputEl.files[0];
        inputEl.value = '';
        finish(file);
      };
      inputEl.click();
    });
  };

  Save.fileName = fileName;
})(typeof window !== 'undefined' ? window : globalThis);
