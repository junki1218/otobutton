# おとボタン 実装計画

## 構成

```
OtoButton/
  index.html          スタート / メイン / 設定 の3画面を1ファイルで切り替え
  css/style.css
  js/
    userSounds.js     端末に入れた音の置き場（IndexedDB）。store.js より先に読む
    store.js          設定の保存・読み込み（localStorage / JSON）
    audio.js          再生・一時停止・同時再生・残り時間
    screens.js        画面の描画と遷移
    main.js           起動
  assets/
    sfx/              既定の効果音10個（CC0・同梱）
    icons/            クレイアニメ調の絵記号（生成待ちは差し替え枠）
  sounds/             利用者が入れる音楽ファイル
    list.json         ← tools/refresh_sounds.py が作る
  tools/
    serve.py          手元で見るためのサーバ（http.server は画像が切れる）
    refresh_sounds.py sounds/ を見て list.json を書く
    shrink_icons.py   ライブラリの原本(1024)から assets/icons の 512 を作る
    fetch_sfx.py      CC0 音源の取得・変換（開発時のみ）
  docs/
    画像生成指示書.md  足りない絵の生成指示（クレイアニメ）
  SPEC.md / PLAN.md / README.md
```

## 手順

1. CC0 音源を取得し m4a に変換、`sounds/CREDITS.md` に出典を1件ずつ記録 ✅
2. `assets/icons/` の絵記号は、Drive に該当素材が無いため**全点を生成指示書へ**
   - 置かれるまでは、絵記号なしでも成立する見た目にする（名前の文字だけで使える）
3. store.js … 設定の形を決め、既定値・保存・JSON入出力・暗証番号
4. audio.js … HTMLAudioElement を1ボタン1個持つ。同時再生、位置保持、残り時間
5. screens.js … 3画面。設定変更は即座にメインへ反映
6. ブラウザで検品（同時再生・一時停止の位置保持・設定の保存・連打無視）
7. GitHub Pages に置く手順を README に書く

## 判断の記録

- **ビルド工程を入れない**（Vite 等を使わない）。index.html をそのまま置けば動く形にし、
  GitHub Pages への配置と、PC での確認を最短にする
- **音は HTMLAudioElement**（Web Audio API ではない）。同時10音なら十分で、
  一時停止・位置保持・残り時間がそのまま使える
- 残り時間リングは `requestAnimationFrame` ではなく `timeupdate` + CSS transition で描く
  （タブレットでの電池消費を抑え、「動きを減らすモード」で止めやすい）
