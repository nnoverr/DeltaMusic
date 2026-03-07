export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const target = req.query.url;
    if (!target) { res.status(400).send('Missing ?url='); return; }

    try {
        const opts = {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                'Referer': 'https://muzofond.fm/',
            }
        };
        if (req.method === 'POST') {
            opts.body = JSON.stringify(req.body);
            opts.headers['Content-Type'] = 'text/plain;charset=utf-8';
        }

        const upstream = await fetch(target, opts);
        const ct = upstream.headers.get('content-type') || 'application/octet-stream';
        const data = await upstream.arrayBuffer();

        res.setHeader('Content-Type', ct);
        res.status(upstream.status).send(Buffer.from(data));
    } catch (e) {
        res.status(502).send('Proxy error: ' + e.message);
    }
}
