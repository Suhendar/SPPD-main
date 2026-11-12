#!/usr/bin/env python3
"""Dev server lokal: file statis + teruskan /api/* ke deploy Vercel.

Pakai:
    SPPD_API_UPSTREAM=https://sppd-anda.vercel.app python3 scripts/dev-server.py [port]

Tanpa ini, `python3 -m http.server` tidak bisa melayani /api/gemini
(python http.server tidak mendukung POST → 501).
"""
import os
import sys
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

UPSTREAM = os.environ.get('SPPD_API_UPSTREAM', '').rstrip('/')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(SimpleHTTPRequestHandler):
    def _proxy_api(self):
        if not UPSTREAM:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(
                b'{"error":"SPPD_API_UPSTREAM belum diset. Contoh: '
                b'SPPD_API_UPSTREAM=https://sppd-anda.vercel.app python3 '
                b'scripts/dev-server.py"}'
            )
            return
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else None
        out_headers = {}
        for key in ('Content-Type', 'Authorization'):
            if self.headers.get(key):
                out_headers[key] = self.headers.get(key)
        req = urllib.request.Request(
            UPSTREAM + self.path, data=body, headers=out_headers, method=self.command,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as upstream:
                payload = upstream.read()
                self.send_response(upstream.status)
                ctype = upstream.headers.get('Content-Type', 'application/json')
                self.send_header('Content-Type', ctype)
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:  # noqa: BLE001 — sampaikan sebagai JSON agar klien jelas
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(('{"error":"Upstream tidak terjangkau: %s"}' % e).encode())

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        if self.path.startswith('/api/'):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.end_headers()
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/'):
            sys.stderr.write('API %s %s\n' % (self.command, self.path))


if __name__ == '__main__':
    if not UPSTREAM:
        sys.stderr.write(
            'Catatan: SPPD_API_UPSTREAM belum diset — /api/* balas 502.\n'
            'Contoh: SPPD_API_UPSTREAM=https://sppd-anda.vercel.app '
            'python3 scripts/dev-server.py\n'
        )
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'SPPD dev: http://localhost:{PORT}  (API -> {UPSTREAM or "(belum diset)"})')
    srv.serve_forever()
