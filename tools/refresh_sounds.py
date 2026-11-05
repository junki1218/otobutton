"""sounds/ フォルダを見て sounds/list.json を書き直す。

使い方: このファイルをダブルクリック、または
    python tools/refresh_sounds.py

ブラウザはフォルダの中身を自分で一覧できないので、
音楽ファイルを sounds/ に入れたあとは必ずこれを走らせる。
"""
import json
import sys
from pathlib import Path

EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".mp4"}
ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT / "sounds"


def display_name(stem: str) -> str:
    """ファイル名から画面に出す名前を作る。先頭の番号と区切り記号を落とす。"""
    name = stem
    for sep in ("_", "-", " "):
        head, _, tail = name.partition(sep)
        if head.isdigit() and tail:
            name = tail
            break
    return name.replace("_", " ").replace("-", " ").strip() or stem


def main() -> int:
    SOUNDS.mkdir(exist_ok=True)
    files = sorted(
        (p for p in SOUNDS.iterdir() if p.is_file() and p.suffix.lower() in EXTS),
        key=lambda p: p.name.lower(),
    )
    items = [
        {"file": p.name, "name": display_name(p.stem), "size": p.stat().st_size}
        for p in files
    ]
    out = SOUNDS / "list.json"
    out.write_text(
        json.dumps({"updated": "", "items": items}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{out} を書きました（{len(items)} 件）")
    for it in items:
        print("  -", it["name"], f"({it['file']})")
    if not items:
        print("  （sounds フォルダに音楽ファイルがありません）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
