// Vercel serverless function: /api/eris?path=<encoded path>
//
// Server-side proxy for backend.erisprotocol.com. Eris's CORS policy
// explicitly rejects www.thealliancedao.com with HTTP 500
// ("not allowed origin: https://www.thealliancedao.com"), so the browser
// can't hit it directly even though the data is public. We fetch from the
// Vercel runtime instead and relay with permissive CORS headers.
//
// Why a `?path=` param here (vs hardcoded URL like /api/network-stats):
// Eris's Votion has many endpoints — /votion/{strategy}/{pool}-{lockup}/optimization,
// /votion/{strategy}/{pool}-{lockup}/snapshot, etc. — and the tool needs to hit
// several across an Auto-Fetch pass. A single proxy with a *path allowlist* is
// cheaper than spinning up one proxy per endpoint.
//
// SECURITY: only requests matching the prefix allowlist below pass through.
// Anything else returns 403 — this prevents the proxy from being abused as a
// general-purpose Eris-reflected SSRF or a way to hammer arbitrary endpoints.
//
// Runtime: Node 18+ (Vercel default). CommonJS, no package.json required.

const TARGET_HOST = 'https://backend.erisprotocol.com';

// Path prefixes that may be proxied. Add more here as the tool calls more endpoints.
// Each entry is a string prefix — the requested path must START with one of these.
const ALLOWED_PATH_PREFIXES = [
    '/votion/liquidity-alliance/',   // current usage: optimization + snapshot per LP+lockup
    '/votion/single-asset/',         // future-proofing for single-sided strategies
    '/prices',                       // Eris USD-price oracle for non-CoinGecko tokens
];

const FETCH_TIMEOUT_MS = 12000;     // Votion optimization queries can take 5-8s under load

// Browser-style headers so we don't get filtered as a bot. Eris doesn't appear
// to inspect User-Agent specifically, but matching what a real client sends is
// the path-of-least-resistance default.
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    // Pretend the origin is Eris's own dashboard, where these endpoints normally answer 200.
    'Origin':  'https://www.erisprotocol.com',
    'Referer': 'https://www.erisprotocol.com/',
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Resolve and validate path. The Vercel runtime URL-decodes ?path= for us
    // before populating req.query, so we get the raw path string.
    const pathParam = req.query && req.query.path;
    if (typeof pathParam !== 'string' || !pathParam) {
        return res.status(400).json({ error: 'Missing ?path query parameter' });
    }
    if (!pathParam.startsWith('/')) {
        return res.status(400).json({ error: 'path must start with /' });
    }
    // Block path traversal attempts up-front. Allowlist below is also a defense in depth.
    if (pathParam.includes('..') || pathParam.includes('//')) {
        return res.status(400).json({ error: 'invalid path' });
    }
    const allowed = ALLOWED_PATH_PREFIXES.some(prefix => pathParam.startsWith(prefix));
    if (!allowed) {
        return res.status(403).json({ error: 'path not in allowlist', path: pathParam });
    }

    const targetUrl = TARGET_HOST + pathParam;

    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);

    try {
        const upstream = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: BROWSER_HEADERS,
        });

        const body = await upstream.text();
        const ct = upstream.headers.get('content-type') || 'application/json';
        res.setHeader('Content-Type', ct);
        // Tag the response so DevTools makes the proxy hop visible.
        res.setHeader('X-Proxy-Source', 'aDAO-eris');
        res.setHeader('X-Upstream-Status', String(upstream.status));
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
