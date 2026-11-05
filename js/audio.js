/* 音の再生係。
   1ボタンに1つ <audio> を持たせる。同時に鳴らすので、ボタンごとに独立させる。
   押す → 頭から再生 / 鳴っている間に押す → 一時停止（位置は残す） /
   止まった位置からもう一度押す → そこから再開。ループはしない。 */
const Player = (() => {
  const TAP_GUARD_MS = 350;   // 誤タップ（連打）を無視する時間
  const tracks = new Map();   // ボタンid -> { el, url, lastTap, state }
  let masterVolume = 0.8;
  let onChange = () => {};    // 状態が変わったら画面に知らせる

  function setOnChange(fn) { onChange = fn; }

  function setMasterVolume(v01) {
    masterVolume = Math.min(1, Math.max(0, v01));
    tracks.forEach((t, id) => applyVolume(id));
  }

  function applyVolume(id) {
    const t = tracks.get(id);
    if (!t) return;
    t.el.volume = Math.min(1, Math.max(0, masterVolume * t.buttonVolume));
  }

  /* 設定が変わったら呼ぶ。音源が変わったボタンだけ作り直す。 */
  function sync(buttons) {
    const alive = new Set();
    buttons.forEach(b => {
      alive.add(b.id);
      const url = Store.soundUrl(b.sound);
      const t = tracks.get(b.id);
      if (t && t.url === url) {
        t.buttonVolume = b.volume / 100;
        t.tapAgain = b.tapAgain;
        applyVolume(b.id);
        return;
      }
      if (t) { t.el.pause(); t.el.src = ''; tracks.delete(b.id); }
      if (!url) return;
      const el = new Audio();
      el.preload = 'auto';
      el.src = url;
      const track = {
        el, url, lastTap: 0,
        buttonVolume: b.volume / 100,
        tapAgain: b.tapAgain,        /* 'restart' = はじめから / 'pause' = いちじていし */
        state: 'idle',
      };
      tracks.set(b.id, track);
      applyVolume(b.id);
      el.addEventListener('ended', () => {
        track.state = 'idle';
        el.currentTime = 0;
        onChange(b.id, 'idle', 0);
      });
      el.addEventListener('timeupdate', () => {
        if (track.state !== 'playing') return;
        onChange(b.id, 'playing', remainRatio(el));
      });
      el.addEventListener('error', () => {
        track.state = 'error';
        onChange(b.id, 'error', 0);
      });
    });
    /* 消えたボタンの音は片付ける */
    Array.from(tracks.keys()).forEach(id => {
      if (!alive.has(id)) {
        const t = tracks.get(id);
        t.el.pause(); t.el.src = '';
        tracks.delete(id);
      }
    });
  }

  function remainRatio(el) {
    if (!el.duration || !Number.isFinite(el.duration)) return 1;
    return Math.min(1, Math.max(0, 1 - el.currentTime / el.duration));
  }

  /* ボタンが押されたとき。戻り値は実際に処理したか（連打無視なら false） */
  function toggle(id) {
    const t = tracks.get(id);
    if (!t) return false;
    const now = Date.now();
    if (now - t.lastTap < TAP_GUARD_MS) return false;
    t.lastTap = now;

    /* 鳴っている最中にもう一度おしたとき。ボタンごとに決めてある。 */
    if (t.state === 'playing') {
      if (t.tapAgain === 'pause') {
        t.el.pause();
        t.state = 'paused';
        onChange(id, 'paused', remainRatio(t.el));
        return true;
      }
      /* はじめから鳴らし直す（既定）。止まらないので、止めるのは「ぜんぶとめる」 */
      try { t.el.currentTime = 0; } catch (e) { /* 読み込み前は無視 */ }
      const again = t.el.play();
      onChange(id, 'playing', 1);
      if (again && again.catch) again.catch(() => { t.state = 'idle'; onChange(id, 'idle', 0); });
      return true;
    }
    /* idle は頭から、paused は止めた位置から */
    const p = t.el.play();
    t.state = 'playing';
    onChange(id, 'playing', remainRatio(t.el));
    if (p && p.catch) p.catch(() => { t.state = 'idle'; onChange(id, 'idle', 0); });
    return true;
  }

  function stopAll() {
    tracks.forEach((t, id) => {
      t.el.pause();
      try { t.el.currentTime = 0; } catch (e) { /* 読み込み前は無視 */ }
      t.state = 'idle';
      onChange(id, 'idle', 0);
    });
  }

  function stateOf(id) {
    const t = tracks.get(id);
    return t ? t.state : 'none';
  }

  /* 設定画面の試聴。既に鳴っているものは止めてから1回だけ鳴らす。 */
  let preview = null;
  function previewSound(sound) {
    const url = Store.soundUrl(sound);
    if (!url) return;
    if (preview) { preview.pause(); preview = null; }
    preview = new Audio(url);
    preview.volume = masterVolume;
    preview.play().catch(() => {});
  }

  return { setOnChange, setMasterVolume, sync, toggle, stopAll, stateOf, previewSound };
})();
