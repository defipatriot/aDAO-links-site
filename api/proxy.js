// Vercel serverless function: /api/proxy?url=<encodedUrl>
//
// Server-side fetch for third-party APIs that don't send
// Access-Control-Allow-Origin headers (the browser refuses to read the
// response when fetched directly). We do the fetch from the Vercel edge,
// then return the body to the browser with permissive CORS headers.
//
// Locked down to a hardcoded host allowlist so this can't be abused as an
// open proxy. To add a new destination, append to ALLOWED_HOSTS and redeploy.
//
// Runtime: Node 18+ (Vercel default). Uses global fetch — no dependencies.

const ALLOWED_HOSTS = new Set([
    'ssdata.smartstakeapi.com',
    // Add more destination hosts here as needed.
]);

// Cap how much we'll buffer from upstream. SmartStake networkStats is ~10 KB;
// 5 MB gives plenty of headroom for future endpoints without enabling abuse.
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export default async function handler(req, res) {
    // Permissive CORS — this proxy is read-only and host-restricted, so the
    // open Origin header is fine. Tighten to a specific origin if desired.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

    const target = req.query?.url;
    if (typeof target !== 'string' || !target) {
        return res.status(400).json({ error: 'Missing or invalid url query param' });
    }

    let parsed;
    try { parsed = new URL(target); }
    catch { return res.status(400).json({ error: 'Malformed URL' }); }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return res.status(400).json({ error: 'Only http(s) URLs allowed' });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        return res.status(403).json({ error: `Host not in allowlist: ${parsed.hostname}` });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const upstream = await fetch(target, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'aDAO-proxy/1.0 (+https://www.thealliancedao.com)',
                'Accept': 'application/json, */*'
            }
        });

        // Stream limit: pull the body but bail if it grows past MAX_BYTES.
        const reader = upstream.body?.getReader?.();
        if (!reader) {
            // Older runtime fallback: rely on text() and trust upstream Content-Length.
            const txt = await upstream.text();
            if (txt.length > MAX_BYTES) {
                return res.status(502).json({ error: 'Upstream response too large' });
            }
            const ct = upstream.headers.get('content-type');
            if (ct) res.setHeader('Content-Type', ct);
            return res.status(upstream.status).send(txt);
        }

        const chunks = [];
        let received = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > MAX_BYTES) {
                try { controller.abort(); } catch {}
                return res.status(502).json({ error: 'Upstream response too large' });
            }
            chunks.push(value);
        }
        const body = Buffer.concat(chunks.map(c => Buffer.from(c)));
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        return res.status(upstream.status).send(body);
    } catch (e) {
        const msg = e?.name === 'AbortError' ? 'Upstream timeout' : (e?.message || 'Upstream fetch failed');
        return res.status(502).json({ error: msg });
    } finally {
        clearTimeout(timeout);
    }
}
