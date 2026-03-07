const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
};

function proxyRequest(targetUrl, res) {
    try {
        const url = new URL(targetUrl);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                'Referer': 'https://rus.hitmotop.com/',
                'Connection': 'keep-alive',
            }
        };
        const proto = url.protocol === 'https:' ? https : http;
        const req = proto.request(options, (upstream) => {
            if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
                proxyRequest(new URL(upstream.headers.location, targetUrl).href, res);
                return;
            }
            res.writeHead(upstream.statusCode, {
                'Content-Type': upstream.headers['content-type'] || 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            });
            upstream.pipe(res);
        });
        req.on('error', e => {
            res.writeHead(500);
            res.end('Proxy error: ' + e.message);
        });
        req.end();
    } catch (e) {
        res.writeHead(400);
        res.end('Invalid URL');
    }
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
    }

    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
    if (reqUrl.pathname === '/proxy' || reqUrl.pathname === '/api/proxy') {
        const target = reqUrl.searchParams.get('url');
        if (!target) { res.writeHead(400); res.end('Missing url param'); return; }
        proxyRequest(target, res);
        return;
    }

    let filePath = path.join(__dirname, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            fs.readFile(filePath + '.html', (err2, data2) => {
                if (err2) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(data2);
            });
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  DeltaMusic Node Server (CommonJS) running at:\n  http://localhost:${PORT}\n`);
});
