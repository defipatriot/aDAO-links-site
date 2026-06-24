/*
 * tile-feed.js — ONE feed contract for every dashboard tile (Rev 1.0.0)
 *
 * The rule: cron primary on load → live on Update/fallback → explicit error.
 * Never a silent 3rd source. Cron and live render the same way; a countdown
 * tracks the next cron run from the heartbeat; the Update button re-runs live
 * (rate-limited). Snapshots have no place here — there are only two sources.
 *
 * Browser: <script src="/lib/tile-feed.js"> → window.TileFeed
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TileFeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = '1.0.0';

  // JSON fetch with no silent fallback: parsed object, or null (never throws to caller).
  async function fetchJson(url) {
    try { var r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() : null; }
    catch (e) { return null; }
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return 'updating…';
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s %= 60;
    if (m >= 60) { var h = Math.floor(m / 60); m %= 60; return h + 'h ' + m + 'm'; }
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }

  /*
   * mount(cfg) wires one tile to the contract. cfg:
   *   loadCron:   async () => value|null   — read the cron JSON product
   *   loadLive:   async () => value|null   — run the live computation
   *   render:     (value, source) => void  — paint tile ('cron'|'live')
   *   renderError:() => void               — explicit error/broken state
   *   heartbeatUrl: string                 — JSON w/ next_expected_run_at + status
   *   onCountdown:(text, stale) => void     — paint the countdown label (optional)
   *   updateMinIntervalMs: number          — Update rate-limit (default 15m)
   * returns { refresh, runLive, destroy }
   */
  function mount(cfg) {
    var lastLiveAt = 0, timer = null, nextRunAt = 0, dead = false;
    var MININT = cfg.updateMinIntervalMs || 15 * 60 * 1000;

    async function fromCron() { var v = await cfg.loadCron(); if (v != null) { cfg.render(v, 'cron'); return true; } return false; }
    async function fromLive() { var v = await cfg.loadLive(); if (v != null) { cfg.render(v, 'live'); return true; } return false; }

    // load order: cron → live → error
    async function refresh() {
      if (await fromCron()) return 'cron';
      if (await fromLive()) return 'live';
      cfg.renderError(); return 'error';
    }

    // Update button: live, rate-limited; on live failure fall back cron→error (never stale-silent)
    async function runLive(force) {
      var now = Date.now();
      if (!force && now - lastLiveAt < MININT) return { ok: false, reason: 'rate_limited', waitMs: MININT - (now - lastLiveAt) };
      lastLiveAt = now;
      if (await fromLive()) return { ok: true };
      if (await fromCron()) return { ok: false, reason: 'live_failed_used_cron' };
      cfg.renderError(); return { ok: false, reason: 'all_failed' };
    }

    async function syncHeartbeat() {
      var hb = await fetchJson(cfg.heartbeatUrl);
      nextRunAt = (hb && hb.next_expected_run_at) ? Date.parse(hb.next_expected_run_at) : 0;
      var stale = hb ? (!!hb.status && hb.status !== 'ok') : true;
      tick(stale);
    }
    function tick(stale) {
      if (dead) return;
      var ms = nextRunAt ? nextRunAt - Date.now() : -1;
      if (cfg.onCountdown) cfg.onCountdown(nextRunAt ? fmtCountdown(ms) : '', !!stale);
      if (nextRunAt && ms <= 0) { fromCron(); syncHeartbeat(); return; } // new run due → re-pull cron + next window
      timer = setTimeout(function () { tick(stale); }, 1000);
    }
    function destroy() { dead = true; if (timer) clearTimeout(timer); }

    refresh().then(syncHeartbeat);
    return { refresh: refresh, runLive: runLive, destroy: destroy };
  }

  return { VERSION: VERSION, mount: mount, fetchJson: fetchJson, fmtCountdown: fmtCountdown };
});
