"""素材ライブラリの原本（1024）から、アプリに入れる 512 を作り直す。

アプリに 1024 を入れると16点で13.3MBになり、手元のサーバでは
画像が途中で切れて届くことがあった。画面に出る一番大きい姿は170px前後なので、
画面の密度が2倍の端末でも512で足りる。

**縮めたものを縮め直さないこと。** かならず原本から作る。

    python tools/shrink_icons.py
"""
import os
import sys

from PIL import Image

LIB = r"G:\マイドライブ\04_素材ライブラリ\画像材料\ClayAnimation\おとボタン"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
LONG_SIDE = 512


def main():
    if not os.path.isdir(LIB):
        print(f"原本のフォルダが見つかりません: {LIB}")
        print("G: ドライブ（Google ドライブ）がつながっているか確かめてください。")
        return 1

    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(LIB)):
        if not name.lower().endswith(".png"):
            continue
        if "_old" in name:
            continue  # 作り直したとき、前の版を同じフォルダに残してある
        im = Image.open(os.path.join(LIB, name)).convert("RGBA")
        w, h = im.size
        if max(w, h) > LONG_SIDE:
            s = LONG_SIDE / max(w, h)
            im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        dst = os.path.join(OUT, name)
        im.save(dst, optimize=True)
        total += os.path.getsize(dst)
        print(f"  {name:18s} {im.size}")
    print(f"合計 {total / 1048576:.2f}MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
