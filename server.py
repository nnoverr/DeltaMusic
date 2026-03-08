#!/usr/bin/env python3
"""
DeltaMusic iOS Server
Запустите: python3 server.py
Затем откройте Safari: http://localhost:8080
"""
import http.server
import socketserver
import urllib.request
import urllib.parse
import os, mimetypes, json

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png':  'image/png',
    '.webmanifest': 'application/manifest+json',
}

class ThreadingSimpleServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    pass

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {format % args}")

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        # ── Proxy endpoint (supports both /proxy and /api/proxy) ──
        if parsed.path in ('/proxy', '/api/proxy'):
            target = params.get('url', [None])[0]
            if not target:
                self.send_error(400, 'Missing ?url=')
                return
            try:
                # Use standard stealth headers
                req = urllib.request.Request(target, headers={
                    'User-Agent': (
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                        'AppleWebKit/537.36 (KHTML, like Gecko) '
                        'Chrome/120.0.0.0 Safari/537.36'
                    ),
                    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                    'Referer': 'https://muzofond.fm/',
                    'Connection': 'keep-alive',
                })
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read()
                    ct = resp.headers.get('Content-Type', 'application/octet-stream')
                    self.send_response(200)
                    self.send_header('Content-Type', ct)
                    self.send_header('Content-Length', str(len(data)))
                    self.send_cors()
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_error(502, f"Proxy Error: {str(e)}")
            return

        # ── Static files ────────────────────────────────
        path = parsed.path.lstrip('/')
        if not path:
            path = 'index.html'

        file_path = os.path.join(BASE_DIR, path)
        if not os.path.isfile(file_path):
            self.send_error(404, 'Not Found')
            return

        ext = os.path.splitext(file_path)[1].lower()
        ct = MIME.get(ext, mimetypes.guess_type(file_path)[0] or 'application/octet-stream')

        with open(file_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_cors()
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        # Support /proxy and /api/proxy for POST as well
        if parsed.path in ('/proxy', '/api/proxy'):
            target = params.get('url', [None])[0]
            if not target:
                self.send_error(400, 'Missing ?url=')
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                req = urllib.request.Request(target, data=body, method='POST', headers={
                    'Content-Type': 'text/plain;charset=utf-8',
                    'User-Agent': 'Mozilla/5.0',
                })
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/plain')
                    self.send_cors()
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_error(502, str(e))
        else:
            self.send_error(404)

if __name__ == '__main__':
    print(f"\n   DeltaMusic Multi-threaded iOS Server")
    print(f"   -- Open in Safari: http://localhost:{PORT}\n")
    with ThreadingSimpleServer(('0.0.0.0', PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
