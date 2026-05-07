# Changes Pending — aDAO-links-site

> Rolling list of identified changes for batch uploads. Add to this as we identify more, check off as completed.

---

## ✅ READY TO PUSH (current batch)

All changes consolidated in the deliverables. Replace the corresponding files in your repo and push.

### `index.html` (single big update)

**Cleanup:**
- [x] Removed `Logos` modal trigger link from footer
- [x] Removed `test-page.html` link from footer

**SEO meta tags:**
- [x] Canonical URL pointing to `https://www.thealliancedao.com/`
- [x] Enhanced Open Graph (og:url, og:type, og:site_name, og:image:width/height)
- [x] Full Twitter Card meta tag set
- [x] Explicit `<meta name="robots" content="index, follow">`
- [x] `<meta name="theme-color" content="#0a0b0f">` (mobile browser chrome)
- [x] Improved meta description (~150 chars)

**PWA install:**
- [x] `<link rel="manifest" href="site.webmanifest">` wired
- [x] PWA mode detection script (top of `<head>`)
- [x] Default-page redirect on launch (sessionStorage prevents loops)
- [x] App install instructions in modal (replaced busy footer column)
- [x] App selector in footer + popup with iOS/Android install instructions

**Fallback removal (no more snapshot data on failed fetches):**
- [x] `dashboardData` snapshot values nulled out (structure preserved)
- [x] Hardcoded "1,000" in HTML at line 840 → spinner
- [x] All `|| 1000` daoHeld fallbacks removed
- [x] Hardcoded `1000.toLocaleString()` setter at line 5515 → blank
- [x] `|| 5828` and `|| 137` calculator fallbacks removed
- [x] `|| 0` TLA deposits fallbacks removed
- [x] Mint count tiles → show `—` when fetch fails
- [x] Avg daily gain → show `—` + "No live data"
- [x] Treasury total → only displays if ALL assets priced
- [x] **TLA Deposits + APR**: 14-day freshness check (stale = `—`)
- [x] **TLA VP**: 14-day freshness check + hardcoded VP locks fallback removed

**Mobile UX improvements:**
- [x] **Top nav grid**: 2 cols on mobile (was 1)
- [x] **Status sliders grid**: 2 cols at sm+ (was lg+)
- [x] **Stat tiles**: tightened gap and padding on mobile via media query
- [x] **Mobile sticky quick-nav bar**: pills for Top / Rewards / Stats / Marketplace / Activity (hidden on desktop)
- [x] Smooth-scroll behavior for anchor links
- [x] Reduced font sizes on stat cards for mobile

### `sitemap.xml` (full rewrite)
- [x] Removed 7 dead entries: graphs, news, nft-explorer, on-ramp, off-ramp, rampt, alliance-dao-docs
- [x] Added 8 missing active pages
- [x] Re-prioritized: live dashboards bumped to 0.9 + daily change frequency
- [x] Updated lastmod dates

### `site.webmanifest` (PWA upgrade)
- [x] Description, scope, categories
- [x] Maskable icon variants for Android
- [x] 3 quick-launch shortcuts (NFT Explorer, TLA Stats, DAO Governance)

### Vercel infrastructure (already done by user)
- [x] 308 redirects configured for all 4 domain variants
- [x] (User to confirm) Duplicate Vercel project deleted

---

## ✅ Already done at the repo level

- [x] Deleted from repo: graphs, news, rampt, on-ramp, off-ramp, alliance-dao-docs
- [x] (User pending) Delete `test-page.html` from repo

---

## 🔧 Next batch — bug fixes

- [ ] **rawgit.hack issue:** In `tla_tool.html` line 142, change ext-tab link from `https://raw.githack.com/...` to local `tla-tool_ext.html`. Eliminates the "One more step" interstitial and serves from Vercel CDN.

---

## 🌐 SEO Phase 2 — site-wide pattern (after this push verified)

Apply the same SEO meta tag template to every other active page:
- [ ] ally.html
- [ ] alliances.html
- [ ] tla-stats.html
- [ ] tla-docs.html
- [ ] tla_tool.html
- [ ] tla-tool_ext.html
- [ ] dao_governance.html
- [ ] dao_governance_tool.html
- [ ] dao_treasury.html
- [ ] dao_tla_deposits.html
- [ ] nft-explorer-index.html
- [ ] planet-map.html
- [ ] rarity-explained.html
- [ ] release-history.html
- [ ] tutorials.html
- [ ] links.html
- [ ] tools.html
- [ ] capa_lp_converter.html
- [ ] fuel_tracker.html

Each page needs: unique title, unique description, own canonical URL pointing to its own page.

---

## 📱 Mobile Phase 2 (if Phase 1 isn't enough)

- [ ] Option C: Tabbed dashboard layout on mobile (group sections into tabs, only one visible at a time)
- [ ] Apply mobile tightening pattern to other pages

---

## 🧹 Cleanup — dead code (low priority)

- [ ] Remove dead Logos modal HTML in index.html (line 1745+ area)
- [ ] Remove `'logo-modal-trigger': 'logoModal'` mapping in JS (line 5396 area)

---

## 🚀 Future projects — separate threads

### Service worker (PWA "real app feel")
- Offline shell — show app UI even without network
- Faster repeat loads via asset caching
- Update detection — notify users when new version deployed
- Push notifications (deferred — needs cron jobs first)

### TLA data collection automation
- GitHub Actions cron `0 59 23 * * 0` (Sunday 23:59 UTC)
- Port browser-based collection logic to Node.js
- Auto-commit JSON snapshots to the 3 storage repos via PAT
- Replace manual Sunday-night data capture
- `epoch_1-300_date.json` from website-adao-core repo will be useful here

### Capa Protocol integration prep
- New pages/sections for Capa marketplace when partnership solidifies
- Lore integration (per the Lion DAO framework)

### Static site generator migration (very long-term)
- Astro/Eleventy would let us template head meta tags + nav once instead of repeating across 20 files
- Big refactor — not urgent

---

## 📝 Open questions / decisions needed

- [ ] When Capa partnership goes live: own page or woven into existing alliances.html?
- [ ] Should NFT contract address be more prominently displayed somewhere? (Currently buried in footer)
- [ ] Force-blank perpetually-spinning tiles after timeout instead of letting them spin?
- [ ] LST ratio defaults (`bLUNA || 1.6048`, `ampLUNA || 1.9015`, etc.) — still in code in ~10 places. Remove these too, or are they OK because ratios drift slowly?
