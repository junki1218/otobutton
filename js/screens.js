/* 画面の描画と行き来。スタート / メイン / せってい の3画面。 */
const Screens = (() => {
  const $ = sel => document.querySelector(sel);
  const RING_LEN = 2 * Math.PI * 46;   // ring の円周（r=46）

  /* ---------- 画面の切り替え ---------- */
  function show(name) {
    ['start', 'main', 'settings'].forEach(n => {
      $('#screen-' + n).classList.toggle('is-active', n === name);
    });
    if (name === 'main') renderGrid();
    if (name === 'settings') renderSettings();
  }

  /* ---------- 画像がまだ無いときは静かに隠す ---------- */
  function iconImg(id, cls) {
    const img = document.createElement('img');
    img.className = cls;
    img.alt = '';
    img.src = 'assets/icons/' + id + '.png';
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }

  /* ---------- メイン画面 ---------- */
  function renderGrid() {
    const s = Store.state;
    const grid = $('#button-grid');
    grid.innerHTML = '';
    grid.style.setProperty('--columns', s.columns);
    document.body.classList.toggle('reduce-motion', s.reduceMotion);

    s.buttons.forEach(b => {
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.className = 'pad';
      pad.dataset.id = b.id;
      pad.style.setProperty('--pad-color', Store.colorValue(b.color));
      pad.style.setProperty('--pad-scale', Store.sizeScale(b.size));

      pad.innerHTML =
        '<svg class="pad__ring" viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="pad__ring-track" cx="50" cy="50" r="46"></circle>' +
        '<circle class="pad__ring-bar" cx="50" cy="50" r="46"></circle></svg>';

      if (b.icon) pad.appendChild(iconImg(b.icon, 'pad__icon'));
      const name = document.createElement('span');
      name.className = 'pad__name';
      name.textContent = b.name;
      pad.appendChild(name);

      const bar = pad.querySelector('.pad__ring-bar');
      bar.style.strokeDasharray = RING_LEN;
      bar.style.strokeDashoffset = RING_LEN;

      attachPress(pad, b.id);
      grid.appendChild(pad);
    });
    $('#master-volume').value = s.masterVolume;
    applyVolumeLock();
  }

  /* 音の大きさのつまみ。かぎが掛かっている間は動かせない。 */
  let volumeUnlocked = false;

  function applyVolumeLock() {
    const locked = Store.state.lockVolume && !volumeUnlocked;
    $('#master-volume').disabled = locked;
    $('#btn-unlock-volume').hidden = !locked;
    $('.tool--volume').classList.toggle('is-locked', locked);
  }

  function unlockVolume() {
    volumeUnlocked = true;
    applyVolumeLock();
  }

  function relockVolume() {
    volumeUnlocked = false;
    applyVolumeLock();
  }

  /* 押した感。指が触れた瞬間に沈ませ、その場から波紋を出し、音を鳴らす。
     click を待たずに pointerdown で鳴らすのは、押してから音までの間を無くすため。 */
  function attachPress(pad, id) {
    let acted = false;

    pad.addEventListener('pointerdown', e => {
      pad.classList.add('is-pressed');
      if (!Store.state.reduceMotion) ripple(pad, e);
      acted = Player.toggle(id);
      /* 端末が振動に対応していれば、ごく短く返す（iPad は無視する） */
      if (acted && navigator.vibrate) {
        try { navigator.vibrate(12); } catch (err) { /* 使えなければ何もしない */ }
      }
    });

    const release = () => {
      pad.classList.remove('is-pressed');
      if (acted && !Store.state.reduceMotion) pop(pad);
      acted = false;
    };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, release));
    /* ドラッグしても押したままにならないよう、念のため */
    pad.addEventListener('contextmenu', e => e.preventDefault());
  }

  function ripple(pad, e) {
    const r = pad.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = (e.clientX - r.left) + 'px';
    dot.style.top = (e.clientY - r.top) + 'px';
    pad.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }

  function pop(pad) {
    pad.classList.remove('is-popping');
    void pad.offsetWidth;          /* 連続で押しても毎回動くように、一度戻す */
    pad.classList.add('is-popping');
    pad.addEventListener('animationend', () => pad.classList.remove('is-popping'), { once: true });
  }

  /* 再生状態が変わったら、そのボタンだけ塗り替える */
  function paint(id, state, remain) {
    const pad = document.querySelector('.pad[data-id="' + id + '"]');
    if (!pad) return;
    pad.classList.toggle('is-playing', state === 'playing');
    pad.classList.toggle('is-paused', state === 'paused');
    pad.classList.toggle('is-error', state === 'error');
    const bar = pad.querySelector('.pad__ring-bar');
    if (bar) bar.style.strokeDashoffset = RING_LEN * (1 - remain);
  }

  /* ---------- 設定画面 ---------- */
  function renderSettings() {
    const s = Store.state;

    const colSel = $('#set-columns');
    colSel.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = i + 'れつ';
      colSel.appendChild(o);
    }
    colSel.value = s.columns;
    $('#set-reduce-motion').checked = s.reduceMotion;
    $('#set-lock-volume').checked = s.lockVolume;
    $('#set-pin').value = s.pin;
    $('#button-count-label').textContent =
      '（' + s.buttons.length + 'こ / さいだい ' + Store.MAX_BUTTONS + 'こ）';
    $('#btn-add-button').disabled = s.buttons.length >= Store.MAX_BUTTONS;

    const n = Store.localSounds.length;
    $('#local-sound-status').textContent = n
      ? 'sounds フォルダに ' + n + ' きょく あります'
      : 'sounds フォルダは からです（音楽を入れたあと tools/refresh_sounds.py を走らせてください）';

    renderUserSounds();

    const box = $('#button-editor');
    box.innerHTML = '';
    s.buttons.forEach((b, i) => box.appendChild(buttonCard(b, i)));
  }

  function buttonCard(b, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--pad-color', Store.colorValue(b.color));

    const head = document.createElement('div');
    head.className = 'card__head';
    const no = document.createElement('span');
    no.className = 'card__no';
    no.textContent = index + 1;
    head.appendChild(no);

    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.className = 'card__name';
    nameIn.maxLength = 8;
    nameIn.value = b.name;
    nameIn.placeholder = 'ひらがな 5もじ';
    nameIn.addEventListener('input', () => {
      b.name = nameIn.value;
      Store.save();
    });
    head.appendChild(nameIn);

    const tools = document.createElement('span');
    tools.className = 'card__tools';
    tools.appendChild(miniBtn('↑', () => { if (Store.moveButton(index, -1)) renderSettings(); }, index === 0));
    tools.appendChild(miniBtn('↓', () => { if (Store.moveButton(index, 1)) renderSettings(); }, index === Store.state.buttons.length - 1));
    tools.appendChild(miniBtn('けす', () => {
      if (!confirm('この ボタンを けしますか？')) return;
      if (Store.removeButton(index)) renderSettings();
    }, Store.state.buttons.length <= 1));
    head.appendChild(tools);
    card.appendChild(head);

    /* 音の割り当て */
    const soundRow = row('おと');
    const sel = document.createElement('select');
    sel.appendChild(optGroup('きまった おと', Store.SFX.map(s => ({
      value: 'sfx:' + s.file,
      label: s.name,
    }))));
    if (Store.localSounds.length) {
      sel.appendChild(optGroup('じぶんの おんがく', Store.localSounds.map(s => ({
        value: 'local:' + s.file,
        label: s.name,
      }))));
    }
    const mine = UserSounds.list();
    if (mine.length) {
      sel.appendChild(optGroup('いれた おと', mine.map(s => ({
        value: 'file:' + s.id,
        label: s.name,
      }))));
    }
    const none = document.createElement('option');
    none.value = 'none:';
    none.textContent = '（なし）';
    sel.appendChild(none);
    /* 消された音を指していたら、それと分かる行を出す（黙って別の音に変えない） */
    if (b.sound.type === 'file' && !UserSounds.has(b.sound.file)) {
      const lost = document.createElement('option');
      lost.value = 'file:' + b.sound.file;
      lost.textContent = '（おとが みつかりません）';
      sel.appendChild(lost);
    }
    sel.value = b.sound.type + ':' + (b.sound.type === 'none' ? '' : b.sound.file);
    sel.addEventListener('change', () => {
      const cut = sel.value.indexOf(':');
      b.sound = { type: sel.value.slice(0, cut), file: sel.value.slice(cut + 1) };
      Store.save();
      Player.sync(Store.state.buttons);
    });
    soundRow.appendChild(sel);
    soundRow.appendChild(miniBtn('きく', () => Player.previewSound(b.sound)));
    soundRow.appendChild(miniBtn('ファイルから', () => pickSoundFile(b)));
    card.appendChild(soundRow);

    /* 色 */
    const colorRow = row('いろ');
    Store.COLORS.forEach(c => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch' + (b.color === c.id ? ' is-on' : '');
      sw.style.background = c.value;
      sw.title = c.label;
      sw.setAttribute('aria-label', c.label);
      sw.addEventListener('click', () => {
        b.color = c.id;
        Store.save();
        renderSettings();
      });
      colorRow.appendChild(sw);
    });
    card.appendChild(colorRow);

    /* 大きさ */
    const sizeRow = row('おおきさ');
    Store.SIZES.forEach(sz => {
      sizeRow.appendChild(chip(sz.label, b.size === sz.id, () => {
        b.size = sz.id;
        Store.save();
        renderSettings();
      }));
    });
    card.appendChild(sizeRow);

    /* 絵記号 */
    const iconRow = row('え');
    iconRow.appendChild(chip('なし', b.icon === '', () => {
      b.icon = '';
      Store.save();
      renderSettings();
    }));
    Store.ICONS.forEach(ic => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-pick' + (b.icon === ic.id ? ' is-on' : '');
      btn.title = ic.label;
      btn.appendChild(iconImg(ic.id, 'icon-pick__img'));
      const cap = document.createElement('span');
      cap.className = 'icon-pick__cap';
      cap.textContent = ic.label;
      btn.appendChild(cap);
      btn.addEventListener('click', () => {
        b.icon = ic.id;
        Store.save();
        renderSettings();
      });
      iconRow.appendChild(btn);
    });
    card.appendChild(iconRow);

    /* このボタンの音量 */
    const volRow = row('おとの おおきさ');
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = 0;
    vol.max = 100;
    vol.step = 5;
    vol.value = b.volume;
    vol.addEventListener('input', () => {
      b.volume = parseInt(vol.value, 10);
      Store.save();
      Player.sync(Store.state.buttons);
    });
    volRow.appendChild(vol);
    card.appendChild(volRow);

    return card;
  }

  /* ---------- 端末に入れた音 ---------- */

  /* 「ファイルから」を押したとき。どのボタンに入れるかを覚えてから、
     隠してあるファイル選択を開く。iPad では「ファイル」や「ミュージック」が開く。 */
  let soundTarget = null;

  function pickSoundFile(button) {
    if (!UserSounds.isAvailable()) {
      alert('この ブラウザでは おとを ほぞん できません');
      return;
    }
    soundTarget = button;
    const input = $('#file-sound');
    input.value = '';          /* 同じファイルを続けて選んでも change が出るように */
    input.click();
  }

  /* ファイルが選ばれたあと。main.js の change から呼ぶ。 */
  async function acceptSoundFile(file) {
    const button = soundTarget;
    soundTarget = null;
    if (!file) return;
    try {
      const id = await UserSounds.add(file);
      if (button) {
        button.sound = { type: 'file', file: id };
        Store.save();
        Player.sync(Store.state.buttons);
      }
      renderSettings();
    } catch (e) {
      alert(e && e.message ? e.message : 'この ファイルは いれられませんでした');
      console.warn(e);
    }
  }

  function humanSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
    return Math.max(1, Math.round(bytes / 1024)) + 'KB';
  }

  function renderUserSounds() {
    const box = $('#user-sound-list');
    const status = $('#user-sound-status');
    box.innerHTML = '';
    if (!UserSounds.isAvailable()) {
      status.textContent = 'この ブラウザでは おとを ほぞん できません';
      return;
    }
    const mine = UserSounds.list();
    if (!mine.length) {
      status.textContent = 'まだ ありません（ボタンの「ファイルから」で いれられます）';
      return;
    }
    mine.forEach(s => {
      const line = document.createElement('div');
      line.className = 'sound-list__row';

      const name = document.createElement('span');
      name.className = 'sound-list__name';
      name.textContent = s.name;
      line.appendChild(name);

      const size = document.createElement('span');
      size.className = 'hint';
      size.textContent = humanSize(s.size);
      line.appendChild(size);

      line.appendChild(miniBtn('きく', () => Player.previewSound({ type: 'file', file: s.id })));
      line.appendChild(miniBtn('けす', async () => {
        const used = Store.state.buttons.filter(b => b.sound.type === 'file' && b.sound.file === s.id);
        const warn = used.length
          ? '「' + s.name + '」は ' + used.length + 'この ボタンで つかって います。けしますか？'
          : '「' + s.name + '」を けしますか？';
        if (!confirm(warn)) return;
        await UserSounds.remove(s.id);
        used.forEach(b => { b.sound = { type: 'none', file: '' }; });
        Store.save();
        Player.sync(Store.state.buttons);
        renderSettings();
      }));
      box.appendChild(line);
    });
    status.textContent = mine.length + 'こ / あわせて ' + humanSize(UserSounds.totalBytes())
      + '。この きかいの なかだけに あります';
  }

  function row(label) {
    const r = document.createElement('div');
    r.className = 'card__row';
    const l = document.createElement('span');
    l.className = 'card__label';
    l.textContent = label;
    r.appendChild(l);
    return r;
  }

  function optGroup(label, items) {
    const g = document.createElement('optgroup');
    g.label = label;
    items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.value;
      o.textContent = it.label;
      g.appendChild(o);
    });
    return g;
  }

  function miniBtn(text, fn, disabled) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini-btn';
    b.textContent = text;
    b.disabled = !!disabled;
    b.addEventListener('click', fn);
    return b;
  }

  function chip(text, on, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (on ? ' is-on' : '');
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- 暗証番号 ---------- */
  let pinBuf = '';
  let pinDone = null;

  function askPin(onOk) {
    pinBuf = '';
    pinDone = onOk;
    $('#pin-error').hidden = true;
    drawPinDots();
    $('#pin-dialog').hidden = false;
  }

  function drawPinDots() {
    const dots = $('#pin-dots');
    dots.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('span');
      d.className = 'pin-dot' + (i < pinBuf.length ? ' is-on' : '');
      dots.appendChild(d);
    }
  }

  function pinKey(key) {
    if (key === 'cancel') {
      $('#pin-dialog').hidden = true;
      return;
    }
    if (key === 'back') {
      pinBuf = pinBuf.slice(0, -1);
      drawPinDots();
      return;
    }
    if (pinBuf.length >= 4) return;
    pinBuf += key;
    drawPinDots();
    if (pinBuf.length < 4) return;
    if (pinBuf === Store.state.pin) {
      $('#pin-dialog').hidden = true;
      const fn = pinDone;
      pinDone = null;
      if (fn) fn();
    } else {
      $('#pin-error').hidden = false;
      pinBuf = '';
      setTimeout(drawPinDots, 150);
    }
  }

  return {
    show, renderGrid, renderSettings, paint, askPin, pinKey,
    applyVolumeLock, unlockVolume, relockVolume,
    pickSoundFile, acceptSoundFile,
  };
})();
