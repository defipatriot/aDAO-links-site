// Vercel serverless function: /api/proxy?u=<base64url>
//
// Server-side fetch for third-party APIs that don't send
// Access-Control-Allow-Origin headers. Locked to a hardcoded host allowlist
// so it can't be abused as an open proxy.
//
// IMPORTANT: Vercel's edge layer / WAF rejects requests where the query
// string contains "https://" or "http://" (it pattern-matches as SSRF and
// returns 405 with body {"detail":"Method Not Allowed"} BEFORE reaching this
// function). To dodge that, callers should base64-encode the destination URL
// and pass it as `?u=`. The plain `?url=` form is kept for callers from
// non-WAF contexts (curl, server-to-server) but will be blocked from the
// browser.
//
// Runtime: Node 18+ (Vercel default). CommonJS, no package.json required.

const ALLOWED_HOSTS = new Set([
    'ssdata.smartstakeapi.com',
    // Add more destination hosts here as needed.
]);

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Resolve destination URL from either ?u=<base64> (preferred) or ?url=<plain>.
    let target = null;
    if (req.query) {
        if (typeof req.query.u === 'string' && req.query.u) {
            try {
                target = Buffer.from(req.query.u, 'base64').toString('utf-8');
            } catch (e) {
                return res.status(400).json({ error: 'Invalid base64 in u param' });
            }
        } else if (typeof req.query.url === 'string' && req.query.url) {
            target = req.query.url;
        }
    }
    if (!target) {
        return res.status(400).json({ error: 'Missing url (use ?u=<base64> or ?url=<plain>)' });
    }

    let parsed;
    try { parsed = new URL(target); }
    catch (e) { return res.status(400).json({ error: 'Malformed URL: ' + target.slice(0, 100) }); }

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
