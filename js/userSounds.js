/* 端末の中に入れた音（iPad で録った声など）の置き場。

   設定は localStorage に入れているが、音声はそこには入らない（数MBで溢れる）ので
   IndexedDB に置く。ここに入れた音は、**その端末のブラウザの中だけ**にある。
   別の端末へは「せっていの もちだし」で運ぶ（書き出しの JSON に音も入る）。

   使う側は、はじめに一度 loadAll() を待つ。そのあとは url(id) が同期で返るので、
   Store.soundUrl() や Player をそのまま使える。 */
const UserSounds = (() => {
  const DB_NAME = 'otobutton';
  const STORE = 'sounds';
  const VERSION = 1;

  /* 1ファイルの上限。授業で使う録音（数分）なら十分に収まる。
     これを超えるものは、端末の空きを食い潰す前に断る。 */
  const MAX_BYTES = 30 * 1024 * 1024;

  let db = null;
  let available = true;                 /* IndexedDB が使えない端末でも落ちないように */
  const items = new Map();              /* id -> { id, name, type, size, added } */
  const urls = new Map();               /* id -> オブジェクトURL */

  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, VERSION);
      } catch (e) {
        available = false;
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => { available = false; reject(req.error); };
    });
  }

  function tx(mode) {
    return open().then(d => d.transaction(STORE, mode).objectStore(STORE));
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /* 入っている音をぜんぶ読み、再生に使える URL を作っておく。
     起動時に一度だけ呼ぶ。失敗しても「音が1つも無い」として続ける。 */
  async function loadAll() {
    items.clear();
    urls.forEach(u => URL.revokeObjectURL(u));
    urls.clear();
    try {
      const store = await tx('readonly');
      const rows = await wrap(store.getAll());
      rows.forEach(r => {
        items.set(r.id, { id: r.id, name: r.name, type: r.type, size: r.size, added: r.added });
        urls.set(r.id, URL.createObjectURL(r.blob));
      });
    } catch (e) {
      available = false;
      console.warn('端末に入れた音を読めませんでした', e);
    }
    return list();
  }

  /* ファイルを1つ取り込む。取り込めたら id を返す。 */
  async function add(file) {
    if (!available) throw new Error('この ブラウザでは おとを ほぞん できません');
    if (file.size > MAX_BYTES) {
      throw new Error('ファイルが おおきすぎます（' + Math.round(MAX_BYTES / 1048576) + 'MB まで）');
    }
    const rec = {
      id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: displayName(file.name),
      type: file.type || '',
      size: file.size,
      added: new Date().toISOString(),
      blob: file,
    };
    const store = await tx('readwrite');
    await wrap(store.put(rec));
    items.set(rec.id, { id: rec.id, name: rec.name, type: rec.type, size: rec.size, added: rec.added });
    urls.set(rec.id, URL.createObjectURL(rec.blob));
    return rec.id;
  }

  async function remove(id) {
    const store = await tx('readwrite');
    await wrap(store.delete(id));
    const u = urls.get(id);
    if (u) URL.revokeObjectURL(u);
    urls.delete(id);
    items.delete(id);
  }

  /* 拡張子を落として、画面に出す名前にする */
  function displayName(fileName) {
    const base = String(fileName).replace(/\.[^.]+$/, '').trim();
    return (base || 'おと').slice(0, 20);
  }

  function url(id) { return urls.get(id) || null; }
  function has(id) { return items.has(id); }
  function info(id) { return items.get(id) || null; }
  function list() {
    return [...items.values()].sort((a, b) => String(a.added).localeCompare(String(b.added)));
  }
  function isAvailable() { return available; }
  function totalBytes() { return list().reduce((n, i) => n + (i.size || 0), 0); }

  /* ---- 書き出し／読み込み（別の端末へ運ぶため） ---- */

  /* 音を data URL（base64）にして返す。JSON に入れて持ち出せる形。 */
  async function exportAll() {
    if (!available) return [];
    const store = await tx('readonly');
    const rows = await wrap(store.getAll());
    return Promise.all(rows.map(r => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve({ id: r.id, name: r.name, type: r.type, size: r.size, added: r.added, data: fr.result });
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(r.blob);
    })));
  }

  /* 書き出した音を取り込む。同じ id のものは上書きする。 */
  async function importAll(records) {
    if (!available || !Array.isArray(records)) return 0;
    let n = 0;
    for (const r of records) {
      if (!r || typeof r.data !== 'string' || !r.id) continue;
      try {
        const blob = await (await fetch(r.data)).blob();
        const store = await tx('readwrite');
        await wrap(store.put({
          id: r.id,
          name: r.name || 'おと',
          type: r.type || blob.type || '',
          size: blob.size,
          added: r.added || new Date().toISOString(),
          blob,
        }));
        n++;
      } catch (e) {
        console.warn('この おとは よみこめませんでした: ' + (r && r.name), e);
      }
    }
    await loadAll();
    return n;
  }

  return { loadAll, add, remove, url, has, info, list, isAvailable, totalBytes, exportAll, importAll, MAX_BYTES };
})();
