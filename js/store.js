/* 設定の持ち方・保存・読み込み。
   設定は端末の localStorage に自動保存し、JSON ファイルで別端末へ渡せる。 */
const Store = (() => {
  const KEY = 'otobutton.settings.v1';
  const MAX_BUTTONS = 10;

  /* 同梱の効果音10個（すべて CC0。出典は sounds/CREDITS.md） */
  const SFX = [
    { file: '01_chime.m4a',    name: 'ちゃいむ',   icon: 'chime' },
    { file: '02_suzu.m4a',     name: 'すず',       icon: 'bell' },
    { file: '03_taiko.m4a',    name: 'たいこ',     icon: 'drum' },
    { file: '04_cymbal.m4a',   name: 'しんばる',   icon: 'cymbal' },
    { file: '05_piano.m4a',    name: 'ぴあの',     icon: 'piano' },
    { file: '06_pinpon.m4a',   name: 'ぴんっ',     icon: 'note' },
    { file: '07_kirakira.m4a', name: 'きらきら',   icon: 'sparkle' },
    { file: '08_cracker.m4a',  name: 'ぱんっ',     icon: 'cracker' },
    { file: '09_warai.m4a',    name: 'わらいごえ', icon: 'laugh' },
    { file: '10_karasu.m4a',   name: 'からす',     icon: 'crow' },
  ];

  /* ボタンに貼れる絵記号（クレイアニメ調の画像。assets/icons/ に置く）。
     画像がまだ無いものは、読み込みに失敗したら文字だけで表示される。 */
  const ICONS = [
    { id: 'chime',   label: 'ちゃいむ' },
    { id: 'bell',    label: 'すず' },
    { id: 'drum',    label: 'たいこ' },
    { id: 'cymbal',  label: 'しんばる' },
    { id: 'piano',   label: 'ぴあの' },
    { id: 'note',    label: 'おんぷ' },
    { id: 'sparkle', label: 'きらきら' },
    { id: 'cracker', label: 'クラッカー' },
    { id: 'laugh',   label: 'わらう' },
    { id: 'crow',    label: 'とり' },
    { id: 'music',   label: 'おんがく' },
    { id: 'speaker', label: 'スピーカー' },
  ];

  /* ボタンの色（文字が白でも読める濃さにそろえてある） */
  const COLORS = [
    { id: 'red',    label: 'あか',     value: '#d94f5c' },
    { id: 'orange', label: 'だいだい', value: '#dd7f33' },
    { id: 'yellow', label: 'きいろ',   value: '#c99a12' },
    { id: 'green',  label: 'みどり',   value: '#3c9b63' },
    { id: 'teal',   label: 'みずいろ', value: '#3a9aae' },
    { id: 'blue',   label: 'あお',     value: '#3f78bd' },
    { id: 'purple', label: 'むらさき', value: '#8065b8' },
    { id: 'pink',   label: 'ぴんく',   value: '#cf6c98' },
    { id: 'brown',  label: 'ちゃいろ', value: '#8d6b4f' },
    { id: 'gray',   label: 'はいいろ', value: '#6d7a88' },
  ];

  /* マス目の中でどれだけ広がるか。おおきい＝マス目いっぱい。
     1 を超えると隣とぶつかるので、ここは 1.0 が上限。 */
  const SIZES = [
    { id: 'small',  label: 'ちいさい', scale: 0.72 },
    { id: 'normal', label: 'ふつう',   scale: 0.88 },
    { id: 'large',  label: 'おおきい', scale: 1.0 },
  ];

  function makeButton(i) {
    const sfx = SFX[i % SFX.length];
    return {
      id: 'b' + (i + 1),
      name: sfx.name,
      color: COLORS[i % COLORS.length].id,
      size: 'normal',
      icon: sfx.icon,
      sound: { type: 'sfx', file: sfx.file },
      volume: 100,
    };
  }

  function defaults() {
    return {
      version: 1,
      pin: '0000',
      columns: 3,
      reduceMotion: false,
      lockVolume: true,          /* 既定で、音の大きさは暗証番号なしには変えられない */
      masterVolume: 80,
      buttons: Array.from({ length: 6 }, (_, i) => makeButton(i)),
    };
  }

  /* 保存されていた設定が古い・壊れている場合でも画面が出るように、形を整える */
  function normalize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const out = { ...d, ...raw };
    out.version = 1;
    out.pin = /^\d{4}$/.test(String(raw.pin)) ? String(raw.pin) : d.pin;
    out.columns = clamp(parseInt(raw.columns, 10) || d.columns, 1, 5);
    out.masterVolume = clamp(parseInt(raw.masterVolume, 10), 0, 100, d.masterVolume);
    out.reduceMotion = !!raw.reduceMotion;
    out.lockVolume = raw.lockVolume === undefined ? d.lockVolume : !!raw.lockVolume;
    const list = Array.isArray(raw.buttons) ? raw.buttons : [];
    out.buttons = list.slice(0, MAX_BUTTONS).map((b, i) => {
      const base = makeButton(i);
      const sound = b && b.sound && typeof b.sound === 'object' ? b.sound : base.sound;
      return {
        id: base.id,
        name: typeof b?.name === 'string' ? b.name.slice(0, 8) : base.name,
        color: COLORS.some(c => c.id === b?.color) ? b.color : base.color,
        size: SIZES.some(s => s.id === b?.size) ? b.size : base.size,
        icon: b?.icon === '' || ICONS.some(ic => ic.id === b?.icon) ? b.icon : base.icon,
        sound: {
          /* file = 端末に入れた音（iPad で録った声など）。実体は IndexedDB にある */
          type: ['sfx', 'local', 'file', 'none'].includes(sound.type) ? sound.type : 'sfx',
          file: typeof sound.file === 'string' ? sound.file : base.sound.file,
        },
        volume: clamp(parseInt(b?.volume, 10), 0, 100, 100),
      };
    });
    if (out.buttons.length === 0) out.buttons = d.buttons;
    return out;
  }

  function clamp(n, lo, hi, fallback) {
    if (!Number.isFinite(n)) return fallback !== undefined ? fallback : lo;
    return Math.min(hi, Math.max(lo, n));
  }

  let state = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = normalize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.warn('設定を読めなかったので既定値で始めます', e);
      state = defaults();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('設定を保存できませんでした', e);
    }
  }

  /* sounds/list.json（refresh_sounds.py が作る）を読む。無ければ空で続行する。 */
  let localSounds = [];
  async function loadLocalSounds() {
    try {
      const res = await fetch('sounds/list.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      localSounds = Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      localSounds = [];
    }
    return localSounds;
  }

  function addButton() {
    if (state.buttons.length >= MAX_BUTTONS) return false;
    const b = makeButton(state.buttons.length);
    b.id = 'b' + (Date.now() % 100000);
    state.buttons.push(b);
    save();
    return true;
  }

  function removeButton(index) {
    if (state.buttons.length <= 1) return false;
    state.buttons.splice(index, 1);
    save();
    return true;
  }

  function moveButton(index, delta) {
    const to = index + delta;
    if (to < 0 || to >= state.buttons.length) return false;
    const [b] = state.buttons.splice(index, 1);
    state.buttons.splice(to, 0, b);
    save();
    return true;
  }

  function soundUrl(sound) {
    if (!sound || sound.type === 'none') return null;
    if (sound.type === 'local') return 'sounds/' + sound.file;
    /* 端末に入れた音。UserSounds.loadAll() のあとなら URL が引ける。
       消された音を指していたら null（ボタンは鳴らないが、画面は出る）。 */
    if (sound.type === 'file') return UserSounds.url(sound.file);
    return 'assets/sfx/' + sound.file;
  }

  /* 書き出しには、端末に入れた音そのものも入れる。
     音を入れていなければ、これまでと同じ中身になる。 */
  async function exportJson() {
    const out = { ...state };
    const used = new Set(state.buttons.filter(b => b.sound.type === 'file').map(b => b.sound.file));
    const all = await UserSounds.exportAll();
    const mine = all.filter(r => used.has(r.id));
    if (mine.length) out.userSounds = mine;
    return JSON.stringify(out, null, 2);
  }

  async function importJson(text) {
    const parsed = JSON.parse(text);
    const added = await UserSounds.importAll(parsed && parsed.userSounds);
    state = normalize(parsed);
    save();
    return { state, added };
  }

  return {
    MAX_BUTTONS, SFX, ICONS, COLORS, SIZES,
    get state() { return state; },
    get localSounds() { return localSounds; },
    load, save, loadLocalSounds, defaults,
    addButton, removeButton, moveButton,
    soundUrl, exportJson, importJson,
    colorValue: id => (COLORS.find(c => c.id === id) || COLORS[0]).value,
    sizeScale: id => (SIZES.find(s => s.id === id) || SIZES[1]).scale,
  };
})();
