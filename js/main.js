/* 起動と、画面の部品のつなぎ込み。 */
(async function main() {
  Store.load();
  /* 端末に入れた音を先に読む。これが済んでいないと Player が URL を引けない */
  await UserSounds.loadAll();
  await Store.loadLocalSounds();

  Player.setOnChange((id, state, remain) => Screens.paint(id, state, remain));
  Player.setMasterVolume(Store.state.masterVolume / 100);
  Player.sync(Store.state.buttons);

  const $ = sel => document.querySelector(sel);

  /* ---------- スタート画面 ---------- */
  $('#btn-go-main').addEventListener('click', () => Screens.show('main'));
  $('#btn-go-settings').addEventListener('click', () => {
    Screens.askPin(() => Screens.show('settings'));
  });

  /* ---------- メイン画面 ---------- */
  $('#btn-stop-all').addEventListener('click', () => Player.stopAll());
  $('#btn-back-start').addEventListener('click', () => {
    Player.stopAll();
    Screens.relockVolume();   /* 画面を離れたら、音の大きさに掛け直す */
    Screens.show('start');
  });

  $('#btn-unlock-volume').addEventListener('click', () => {
    Screens.askPin(() => Screens.unlockVolume());
  });
  $('#btn-open-settings').addEventListener('click', () => {
    Screens.askPin(() => {
      Player.stopAll();
      Screens.show('settings');
    });
  });
  $('#master-volume').addEventListener('input', e => {
    Store.state.masterVolume = parseInt(e.target.value, 10);
    Store.save();
    Player.setMasterVolume(Store.state.masterVolume / 100);
  });

  /* ---------- 設定画面 ---------- */
  $('#btn-settings-done').addEventListener('click', () => {
    Player.sync(Store.state.buttons);
    Screens.show('main');
  });

  $('#set-columns').addEventListener('change', e => {
    Store.state.columns = parseInt(e.target.value, 10);
    Store.save();
  });

  $('#set-lock-volume').addEventListener('change', e => {
    Store.state.lockVolume = e.target.checked;
    Store.save();
    Screens.applyVolumeLock();
  });

  $('#set-reduce-motion').addEventListener('change', e => {
    Store.state.reduceMotion = e.target.checked;
    Store.save();
    document.body.classList.toggle('reduce-motion', Store.state.reduceMotion);
  });

  $('#btn-save-pin').addEventListener('click', () => {
    const v = $('#set-pin').value.trim();
    if (!/^\d{4}$/.test(v)) {
      alert('すうじ 4けたで いれてください');
      $('#set-pin').value = Store.state.pin;
      return;
    }
    Store.state.pin = v;
    Store.save();
    alert('あんしょう ばんごうを ' + v + ' に かえました');
  });

  $('#btn-add-button').addEventListener('click', () => {
    if (!Store.addButton()) return;
    Player.sync(Store.state.buttons);
    Screens.renderSettings();
  });

  /* 設定の書き出し（ダウンロード）と読み込み。
     端末に入れた音を使っていれば、その音も書き出しに入る（別の端末へ運べる）。 */
  $('#btn-export').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const blob = new Blob([await Store.exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = 'otobutton-settings-' + stamp + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      alert('かきだせませんでした');
      console.warn(err);
    }
    btn.disabled = false;
  });

  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const { added } = await Store.importJson(await file.text());
      Player.setMasterVolume(Store.state.masterVolume / 100);
      Player.sync(Store.state.buttons);
      Screens.renderSettings();
      alert(added
        ? 'せっていと おと ' + added + 'こを よみこみました'
        : 'せっていを よみこみました');
    } catch (err) {
      alert('この ファイルは よみこめませんでした');
      console.warn(err);
    }
    e.target.value = '';
  });

  /* ボタンの「ファイルから」で選ばれた音 */
  $('#file-sound').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    Screens.acceptSoundFile(file);
  });

  /* ---------- 暗証番号のキー ---------- */
  document.querySelectorAll('#pin-dialog .pin-pad button').forEach(b => {
    b.addEventListener('click', () => Screens.pinKey(b.dataset.key));
  });

  /* 画面が隠れたら音を止める（タブを切り替えて鳴り続けるのを防ぐ） */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Player.stopAll();
  });

  Screens.show('start');
})();
