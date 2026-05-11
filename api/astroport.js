// Vercel serverless function: /api/astroport?path=<encoded path with optional querystring>
//
// Server-side proxy for app.astroport.fi. Astroport's TRPC endpoints generally
// allow direct browser access (the tool currently calls them directly for
// xASTRO + LST prices), but the `charts.liquidity` endpoint specifically has
// been observed returning HTTP 500 intermittently for pools Astroport's
// indexer doesn't know about, *and* its responses don't always carry the CORS
// header consistently. Routing through this proxy:
//   1. eliminates the inconsistent CORS behavior entirely
//   2. lets us add a short circuit-breaker if Astroport starts rate-limiting
//   3. centralizes path inspection so we can log/observe usage if needed
//
// `?path=` includes the querystring (the trpc input blob). Example:
//   /api/astroport?path=/api/trpc/charts.liquidity%3Finput%3D%257B%2522json%2522%253A...
//
// SECURITY: only path prefixes in ALLOWED_PATH_PREFIXES pass through.
// Anything else returns 403.
//
// Runtime: Node 18+ (Vercel default). CommonJS.

const TARGET_HOST = 'https://app.astroport.fi';

const ALLOWED_PATH_PREFIXES = [
    '/api/trpc/charts.liquidity',
    '/api/trpc/charts.volume',
    '/api/trpc/pools.byAddress',
    '/api/trpc/pools.getAll',
    '/api/trpc/tokens.getPrice',
    '/api/trpc/tokens.byChain',
    '/api/trpc/protocol.stakingApy',
    '/api/trpc/protocol.circulatingSupply',
    '/api/trpc/common.chainStatus',
];

const FETCH_TIMEOUT_MS = 12000;

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin':  'https://app.astroport.fi',
    'Referer': 'https://app.astroport.fi/',
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

    const pathParam = req.query && req.query.path;
    if (typeof pathParam !== 'string' || !pathParam) {
        return res.status(400).json({ error: 'Missing ?path query parameter' });
    }
    if (!pathParam.startsWith('/')) {
        return res.status(400).json({ error: 'path must start with /' });
    }
    if (pathParam.includes('..') || pathParam.includes(' ')) {
        return res.status(400).json({ error: 'invalid path' });
    }
    // Check against the prefix allowlist. The path may contain a `?input=...`
    // querystring with URL-encoded JSON — we check only up to the first `?`.
    const pathOnly = pathParam.split('?')[0];
    const allowed = ALLOWED_PATH_PREFIXES.some(prefix => pathOnly.startsWith(prefix));
    if (!allowed) {
        return res.status(403).json({ error: 'path not in allowlist', path: pathOnly });
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
        res.setHeader('X-Proxy-Source', 'aDAO-astroport');
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
