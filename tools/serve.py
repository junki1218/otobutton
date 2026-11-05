"""おとボタんを手元で見るためのサーバ。

`python -m http.server` は HTTP/1.0 で1件ずつしかさばけず、
画像が途中で切れて届くことがあった（Content-Length は正しいのに末尾が欠ける→
ブラウザが「壊れた画像」と見なす）。こちらは HTTP/1.1 ＋ 複数同時でさばく。

    python tools/serve.py            # http://localhost:8123
    python tools/serve.py 9000       # ポートを変える
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        """作りかけを見ているので、古いものを掴ませない。"""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    httpd = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=ROOT))
    print(f"おとボタン → http://localhost:{port}/   (Ctrl+C でとめる)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
