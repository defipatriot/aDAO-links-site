// Vercel serverless function: /api/proxy?url=<encodedUrl>
//
// Server-side fetch for third-party APIs that don't send
// Access-Control-Allow-Origin headers (the browser refuses to read the
// response when fetched directly). We do the fetch from the Vercel runtime,
// then return the body to the browser with permissive CORS headers.
//
// Locked down to a hardcoded host allowlist so this can't be abused as an
// open proxy. To add a new destination, append to ALLOWED_HOSTS and redeploy.
//
// Runtime: Node 18+ (Vercel default). Uses CommonJS exports for max
// compatibility — no package.json or vercel.json required. Global `fetch`
// is available in Node 18+.

const ALLOWED_HOSTS = new Set([
    'ssdata.smartstakeapi.com',
    // Add more destination hosts here as needed.
]);

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

module.exports = async function handler(req, res) {
    // Permissive CORS — proxy is read-only and host-restricted, so * is fine.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const target = req.query && req.query.url;
    if (typeof target !== 'string' || !target) {
        return res.status(400).json({ error: 'Missing or invalid url query param' });
    }

    let parsed;
    try { parsed = new URL(target); }
    catch (e) { return res.status(400).json({ error: 'Malformed URL' }); }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return res.status(400).json({ error: 'Only http(s) URLs allowed' });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        return res.status(403).json({ error: 'Host not in allowlist: ' + parsed.hostname });
    }

    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);

    try {
        const upstream = await fetch(target, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'aDAO-proxy/1.0 (+https://www.thealliancedao.com)',
                'Accept': 'application/json, */*'
            }
        });

        const body = await upstream.text();
        if (body.length > MAX_BYTES) {
            return res.status(502).json({ error: 'Upstream response too large' });
        }
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        return res.status(upstream.status).send(body);
    } catch (e) {
        const msg = (e && e.name === 'AbortError')
            ? 'Upstream timeout'
            : ((e && e.message) || 'Upstream fetch failed');
        return res.status(502).json({ error: msg });
    } finally {
        clearTimeout(timeout);
    }
};
