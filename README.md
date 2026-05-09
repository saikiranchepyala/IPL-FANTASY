# 🏏 IPL Fantasy League

A private, self-hosted IPL fantasy league web app for friend groups. Built as a **single HTML file** — no backend server needed, no app store, no subscriptions. Just Firebase + Netlify, both free.

> Pick your XI before every match, choose your Captain & Vice-Captain, play a Booster, and watch the leaderboard update live as the match unfolds. Teams are hidden until the match locks — then revealed simultaneously for everyone.

**Current version: v3.15.2** — [Changelog](#-changelog)

## 🛡️ Security & Known Limitations

Because this is a **"No-Backend" Serverless SPA**, the browser handles all logic (points calculations, API fetching).
- **Firestore Trust Boundary**: The `firestore.rules` rely on `request.auth != null` via Firebase Anonymous Auth. This means anyone who visits your Netlify URL gets a valid token. 
- **API Key Visibility**: The CricketData API key is stored in the `/meta/game` document, which is globally readable by any authenticated visitor. Do not share your league URL on public forums or social media if you are concerned about your 2000-call daily quota being scraped.
- **Admin Actions**: Because Anonymous Auth does not natively map roles, administrative updates to match documents are structurally permitted by Firestore rules for any visitor. The app relies on client-side UI gating. This app is designed strictly for **trusted, private friend groups**.

---

## ✨ Features

- **Per-match team selection** — fresh XI + Captain/VC picks every game
- **6-player team cap** — max 6 players from any one IPL team
- **Booster system** — Triple (3×), Double (2×), and Team (2×) boosters per season; one per match
- **Toss reveal mechanic** — all teams hidden until admin locks the match at first ball
- **Auto Playing XI detection** — background watcher polls CricAPI after toss; manual paste fallback if API is slow
- **Live points** — auto-fetches scorecard from CricketData.org API every ~5 minutes
- **Smart Innings Picker** — automatically detects the live batting team even if CricAPI data is out of order
- **Impact Sub support** — automatic status flip when sub enters
- **Season leaderboard** — cumulative points table with match-by-match breakdown and booster badges
- **Pitch overlay** — member-by-member XI visualisation from the leaderboard
- **CSV export** — download full season table as a spreadsheet with prioritized "clean" match labels
- **Admin panel** — manage matches, load players, control reveal timing, finalize points
- **Join via link** — admin generates a join code; members tap link and register
- **Works on mobile** — fully responsive, designed for phone use during a match
- **XSS Hardened** — all user inputs are sanitized before rendering
- **Match Info tab** — live batting/bowling scorecard tab that appears automatically when a match is in progress and disappears when it ends; visible to both members and admins

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file, no build step |
| Database | Firebase Firestore (free tier) |
| Hosting | Netlify Drop (free tier) |
| Cricket Data | [CricketData.org](https://cricketdata.org) API (paid plan) |

---

## 🚀 Setup Guide

### Step 1 — Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `ipl-fantasy-league`) → disable Analytics → **Create project**
3. In the left sidebar → **Build → Firestore Database** → **Create database**
4. Choose **Start in test mode** → region: `asia-south1` → **Enable**

### Step 2 — Enable Anonymous Authentication

The app signs every visitor in silently with Firebase Anonymous Auth before making any database calls. This ensures bots and direct API queries cannot read your database.

1. Firebase Console → **Build → Authentication → Sign-in method**
2. Click **Anonymous** → toggle **Enable** → **Save**

### Step 3 — Firestore Security Rules (Hardened)

In Firestore → **Rules** tab, replace everything with these rules. All reads and writes require a valid Firebase session (set automatically by the app via anonymous auth):

The current ruleset lives at `firestore.rules` in this repo — copy/paste that file's contents into the rules editor verbatim, then click **Publish**. The headline guarantees:

- **No deletes anywhere.** Every block declares `allow delete: if false`.
- **Match updates are field-whitelisted.** Only the keys listed in `affectedKeys().hasOnly([...])` may be written. There is no `hasAny` shortcut — a payload mixing `teams` with arbitrary new keys is rejected.
- **`/meta/<docId>` is doc-id whitelisted.** Only `game`, `members`, `playerProfiles`, `seasonSquads_<seriesId>`, and `seasonFixtures_<seriesId>` are writable. An attacker cannot spam `/meta/<random>` docs.
- **`/season/<docId>` is locked to `totals`.**

If you've previously deployed an older ruleset, redeploy the current `firestore.rules` before the next match.

### Step 3 — Get Firebase Config

1. Firebase Console → gear icon ⚙️ → **Project settings**
2. Scroll to **Your apps** → click **`</>`** (Web) → register with any nickname
3. Copy the `firebaseConfig` object

### Step 4 — Configure the HTML File

Open `ipl-fantasy-v4_render.html` in any text editor. At the very top of the `<script>` block, replace the placeholder values:

```js
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

Save the file.

### Step 5 — Deploy to Netlify

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop `ipl-fantasy-v4_render.html` onto the page
3. Your league is live at a URL like `sunny-dolphin-abc123.netlify.app`
4. Optional: rename it under **Site configuration → Change site name**

---

## 🎮 How to Use

### Admin — Match Day Flow

| Time | Action |
|---|---|
| Before match day | Create match, fill Label + Team 1/2, click **Find IPL Matches** → select → player pool loads |
| ~30 min before first ball | Click **Fetch Playing XI** once after toss. Auto-watcher starts. If CricAPI is slow, expand **"XI not loading from API?"** panel and paste both XIs manually |
| First ball | Click **START MATCH** — locks picks, reveals leaderboard, starts live stats |
| During match | Stats auto-update every ~5 min while admin tab is open. Manual fetch available anytime |
| Match ends | Poller fires one final fetch 60s after match end to catch last-over stats, then auto-stops |
| After match | Click **Finalize & Save** — locks points, updates season table |

### Members — Each Match

1. Open the league URL → enter name + PIN
2. **My Team tab** → tap player cards to build your XI (max 6 from any one team)
3. Choose Captain (2×) and Vice-Captain (1.5×)
4. Optionally apply a **Booster** (Triple/Double/Team) from the booster dock
5. Tap **LOCK IN MY TEAM**
6. After match locks → **Live Scores tab** for leaderboard and pitch view
7. **Season Table tab** for cumulative standings

---

## ⚡ Booster System

Each member gets a season inventory of boosters — usable in league stage matches only (not playoffs/finals):

| Booster | Qty/Season | Effect |
|---|---|---|
| Triple (3×) | 2 | Multiplies your entire match total by 3× |
| Double (2×) | 3 | Multiplies your entire match total by 2× |
| Team (2×) | 2 | Multiplies every player from a chosen IPL team in your XI by 2× |

- **One booster per match** — can be changed until you lock in your team
- **Revealed at lock** — type + target visible to everyone once admin clicks START MATCH
- Boosters stack on top of Captain/VC multipliers

---

## 📊 Fantasy Points System

### Batting
| Event | Points |
|---|---|
| Run | +1 |
| Boundary (4) | +1 bonus |
| Six | +2 bonus |
| 30 runs | +4 bonus |
| 50 runs | +8 bonus |
| 100 runs | +16 bonus |
| Duck (batted, 0 runs, got out) | −2 |
| SR ≥ 170 (min 10 balls) | +6 |
| SR ≥ 150 | +4 |
| SR ≥ 130 | +2 |
| SR < 50 | −6 |
| SR < 60 | −4 |
| SR < 70 | −2 |

### Bowling
| Event | Points |
|---|---|
| Wicket | +25 |
| LBW / Bowled bonus | +8 each |
| 3-wicket haul | +4 bonus |
| 4-wicket haul | +8 bonus |
| 5-wicket haul | +16 bonus |
| Maiden over | +8 |
| ER < 5 (min 2 overs) | +6 |
| ER < 6 | +4 |
| ER < 7 | +2 |
| ER > 8 | −2 |
| ER > 9 | −4 |
| ER > 10 | −6 |

### Fielding
| Event | Points |
|---|---|
| Catch | +8 |
| 3+ catches in match | +4 bonus |
| Stumping | +12 |
| Direct run-out | +12 |
| Indirect run-out | +6 |

### Multipliers
| | |
|---|---|
| Playing XI | +4 |
| Captain | ×2 all points |
| Vice-Captain | ×1.5 all points |

---

## 🗄️ Firestore Data Structure

```
/meta/game              — { currentMatchId, activeMatchIds[], adminPin, joinCode,
                            cricApiKey, cachedIntlSeriesIds[] }
/meta/members           — { [name]: { pin, teamName, joinedAt,
                            boosters: { triple, double, team } } }
/matches/{matchId}      — { label, t1, t2, t1img, t2img, liveMatchId,
                            players[], stats:{}, teams:{},
                            revealed, locked, finalized, matchEnded,
                            tossResult, xiReady, matchNum, matchType,
                            score[], matchStatus, overSummaries,
                            currentBatsmen[], currentBowler }
/season/totals          — { [name]: { total, matches:[{ matchId, label, pts }] } }
```

---

## 🔑 Getting a CricketData.org API Key

1. Sign up free at [cricketdata.org](https://cricketdata.org)
2. Copy your API key from the dashboard
3. Paste it in **Admin → Current Match → API Key** → Save

This app uses a **paid CricketData.org API plan** for reliable scorecard access across all IPL matches.

---

## ⚠️ Known Limitations

- **Catches/stumpings/run-outs** — CricAPI doesn't always populate these reliably; may need manual entry after the match.
- **Auto-refresh requires admin tab open** — the live poller only runs while the admin panel is open. Keep your screen active during the match.
- **Playing XI between toss and first ball** — CricAPI occasionally doesn't return XI status in this window. Use the "XI not loading from API?" paste panel in the Current Match tab to mark players manually.
- **Security** — Hardened Firestore rules are included to prevent unauthorized match/meta/season deletions. This is sufficient for a private friend group but not for a public application.
- **Playoffs/finals** — boosters are disabled for playoff matches (Qualifiers, Eliminators, Final).
- **Firestore free tier** — 50,000 reads / 20,000 writes per day — more than sufficient for a 25-member group across a full season.
---

## 🛠️ Local Development & Git Workflow

No build step required. Open the file directly in a browser:

```bash
open ipl-fantasy-v4_render.html
```

### Git Step-by-Step for Updates

If you make changes or receive an update, follow these steps to keep your repository in sync:

1.  **Check Status**: See which files have changed.
    ```bash
    git status
    ```
2.  **Stage Changes**: Add the modified files to the next commit.
    ```bash
    git add ipl-fantasy-v4_render.html
    ```
3.  **Commit**: Save your changes with a descriptive message.
    ```bash
    git commit -m "Brief description of what was changed"
    ```
4.  **Push**: Upload your changes to GitHub.
    ```bash
    git push
    ```
5.  **Pull**: If you are working from multiple machines, always pull the latest changes before starting.
    ```bash
    git pull
    ```

---
Firebase will connect to your live Firestore instance, so any changes made locally affect real data.

---

## 📁 Repository Structure

```
/
├── ipl-fantasy-v4_render.html   # The entire app — single HTML file
├── firestore.rules              # Firestore security rules (version-controlled)
├── netlify.toml                 # Netlify deploy config + security headers
├── skillipl.md                  # Project intelligence / architecture doc
├── StepByStepGuide              # Detailed setup walkthrough
└── README.md                    # This file
```

---

## 📋 Changelog

### v3.15.2 — May 8, 2026
**Firestore rules security fix (external code review)**

External review of `firestore.rules` surfaced two real exploits reachable by any anonymous-authed visitor. Both fixed; **rules must be redeployed via Firebase Console** before next match.

- **CRITICAL — `hasAny` bypass on match updates.** The match-update rule had:
  ```
  request.resource.data.diff(resource.data).affectedKeys().hasAny(['teams']) ||
  request.resource.data.diff(resource.data).affectedKeys().hasOnly([...whitelist])
  ```
  Because `hasAny(['teams'])` returns true whenever the payload includes `teams`, a malicious member could submit `{teams.X.players: [...], locked: true, matchEnded: true, score: []}` — the first clause short-circuits to ALLOW, the whitelist check never runs, and the entire payload commits. Any logged-in member could corrupt match state, force-finalize, or clear the score. Removed the `hasAny` clause entirely. Legitimate member team writes still pass via the whitelist (since `teams` is in it). Documented that anonymous auth means a determined member could still write any whitelisted field — that's the same residual limitation noted under Security & Known Limitations, pending custom-claims migration.
- **CRITICAL — arbitrary deletion of league-wide docs.** `/meta/game`, `/meta/members`, `/meta/{docId}` (wildcard), and `/season/{docId}` were all declared `allow write: if request.auth != null`. In Firestore, `write` includes `create + update + delete`. Combined with anonymous auth, any visitor could `deleteDoc(meta/game)` and wipe the entire league config (admin PIN, join code, API key, active matches), or `deleteDoc(season/totals)` to nuke season standings. The README claimed `allow delete: if false` was in place — it wasn't. Rules now explicitly split into `allow create, update` + `allow delete: if false` for every meta and season block. The matches block already had explicit delete: false (unchanged).
- **HARDENING — doc-id allowlisting on `/meta` and `/season`.** While fixing the above, also tightened `/meta/{docId}` to only accept the doc IDs the client actually writes (`game`, `members`, `playerProfiles`, `seasonSquads_<seriesId>`, `seasonFixtures_<seriesId>` via regex). `/season/{docId}` is locked to the single id `totals`. Closes off the prior vector where an attacker could spam arbitrary `/meta/<random>` documents.

Code-only changes shipped earlier today (v3.15.0/v3.15.1) are unaffected; this is a server-side rules patch only. Deploy order: doesn't matter — the rule changes only DENY actions the legitimate client never performed.

### v3.15.1 — May 8, 2026
**Post-review hardening (three real bugs caught before deploy)**

A comprehensive review of the v3.15.0 additions surfaced three issues. Fixed before the IPL match 52 deployment.

- **CRITICAL: `apiMatchWinner` field was rejected by Firestore rules.** The end-of-match path in `autoFetchStats` wrote a new `apiMatchWinner` key alongside the whitelisted fields, but `firestore.rules` `matches/{matchId}` update rule uses `affectedKeys().hasOnly([...])` — any field outside the list rejects the entire `updateDoc`. Once a match ended, the whole batched write (score, matchEnded, matchResult, …) would have failed silently, breaking finalization. Folded the winner into the already-whitelisted `matchResult` field. The Live Scorecard FINAL chip now reads from `matchResult` instead.
- **Latent XSS-shaped break: apostrophes in player names.** Inline handlers like `onclick="openPlayerProfile('${escAttr(name)}')"` look safe — `escAttr` converts `'` to `&#39;` — but the browser HTML-decodes attribute values before JS parses them, so `&#39;` becomes a literal `'` and prematurely terminates the JS string. `sanitizePlayerName()` was only stripping `[.\[\]#$/]`. Now also strips `' " \`` so a future "O'Brien"-style cricketer doesn't break clicks (no current IPL 2026 player has an apostrophe; defensive fix).
- **Empty-cache lock-out in `loadSeasonSquadIndex`.** A transient malformed read of `meta/seasonSquads_<id>` would return `{}`, which got memoized in `_seasonSquadCache` and silently disabled all future avatar lookups for the session. Now only caches indexes with at least one entry; transient bad reads retry on the next call.

### v3.15.0 — May 8, 2026
**CricketData.org API Audit + Dashboard Lift**

After auditing every endpoint cricketdata.org publishes against the live IPL 2026 payload (series id `87c62aac-…`, 74 matches, 10 squads), the dashboard picked up new data sources, dropped a quietly-broken one, and gained a few member-visible features.

- **Removed dead `fantasySquad` call**: `loadMatchPlayers` was hitting `/v1/fantasySquad` on every match-load, but that endpoint requires the paid Fantasy plan and silently returned `{ status: "failure", reason: "Invalid API requested" }` on the free tier. The fallback chain hid the failure — meaning every player's `credits` field was `null` regardless of the original intent, and one quota call was wasted per load. `match_squad` is now the primary roster source with `match_info.teamInfo[].players` as fallback.
- **Season Squad cache (`series_squad`)**: One call returns all 10 IPL franchises with ~250 players, photos, country, and batting/bowling style. Cached in Firestore at `meta/seasonSquads_<seriesId>` with an in-memory hot tier. New admin button **↻ Refresh Squads** under League Setup → 📦 Season Cache. `loadMatchPlayers` consults the cache to enrich roster entries with `playerImg` etc. — meaning per-match fetches no longer have to re-resolve the same data.
- **Season Fixtures cache (`series_info`)**: Single call caches the full 74-match IPL 2026 schedule at `meta/seasonFixtures_<seriesId>`. Powers a new member-visible **Schedule** tab with summary stats (Total / Played / Live / Upcoming) and three sections (Live → Upcoming → Completed) showing match #, date, teams, venue, score, and result. Free to render after the one cached call.
- **Server-side quota reconciliation**: `_cricFetch` now reads `info.hitsToday` from every successful response and raises (never lowers) the local localStorage counter to that value. Multi-tab and multi-device drift no longer let the league overrun the 2000/day budget; the 1800-warning and 2000-stop thresholds also fire from server values.
- **Player avatars across the dashboard**: New `avatarHtml(player, size)` helper renders the `playerImg` URL with an initials-fallback `<span>` injected by `onerror`. Wired into the admin Player Stats grid card and the member Player Stats card, both now clickable to open the existing Player Profile modal. The on-card thumbnail in `renderGrid` (My Team picker) prefers cached `playerImg` over the synthesized `https://h.cricapi.com/img/players/<id>.jpg` URL — fewer 404s.
- **Player Profile modal — richer**: `players_info` now caches `playerImg`, `dateOfBirth`, and `placeOfBirth` in addition to career stats. Modal shows the photo + age + place of birth alongside the existing role/style line, and the career-stats section adds **ODI** and **Test** rows alongside the existing IPL and T20I blocks.
- **Live scorecard `matchWinner` + bowling extras**: `match_scorecard` parser now captures the explicit `data.matchWinner` field (saved as `apiMatchWinner`) and surfaces it in the FINAL chip (e.g. `FINAL · 🏆 LSG won`) instead of relying on the status-string regex. Bowling row gets a `wd`/`nb` annotation when those values are present, and both scorecard parsers now persist `wd`/`nb` per bowler.
- **Historic IPL series wiring**: `IPL_HISTORIC_SERIES` constant maps 2022/2023/2024/2025 to their CricAPI series ids. `window.cacheHistoricIPLSeason(year)` warms `seasonSquads_<id>` + `seasonFixtures_<id>` for any of them — backed by four admin buttons in the Season Cache card. Sets up future head-to-head views without burning quota by default.
- **CSP**: `netlify.toml` `img-src` now allows `https://g.cricapi.com` (team logos) alongside the existing `h.cricapi.com` (player photos).

### v3.14.0 — May 7, 2026
**Quota Hardening & Data Integrity (Round 2)**
- **Live scorecard overs restored**: When CricAPI returned an empty `data.score` array, the fallback path that rebuilt scores from `scorecard` recovered runs (sum batting + extras) and wickets (sum bowling) but had no fallback for overs — leaving live overs stuck at 0.0 while the rest of the score looked correct. `mappedFromSc` now sums bowler overs in cricket notation; an additional pass backfills a stale `o` from the scorecard mapping when the API returns r/w without overs.
- **Player-name Firestore dot-path fix**: IPL squad imports from `fantasySquad`/`match_info`/`match_squad` pushed names like `K.L. Rahul` and `M.S. Dhoni` verbatim into the player pool. Those names were used in dot-paths (`stats.${name}.bat_runs`, `playerStatus.${name}`), where Firestore interprets `.` as a nested-key separator — silently scattering a single player's stats across nested objects. New `sanitizePlayerName()` strips Firestore-unsafe chars at every push site in `loadMatchPlayers`. (Existing corrupted documents are not migrated; this only prevents new writes.)
- **Exponential backoff on `adminFetchXI`**: Replaced fixed 20s × 20 attempts (~20 quota burned in 7 min when CricAPI is slow) with chained `setTimeout`s at 20s → 30s → 45s → 67s → 90s (capped), max 12 attempts. Worst-case quota drops from ~20 to ~12 calls.
- **Per-tick ticker leadership verification**: Leader election only ran at startup; once two tabs both passed `_shouldStartTicker()` in a race, both kept polling `currentMatches` every 5 min in parallel forever (the 4:52/4:54/4:57/4:59 alternating pattern in API logs). `fetchGlobalTicker` now re-reads localStorage each tick and clears its own interval if another tab now holds a fresh claim.
- **Cross-resume coalescer floor**: `_startTickerIfNeeded` fired `fetchGlobalTicker` immediately on every call — so each visibility-resume / Firestore-snapshot replay burned a fresh `currentMatches` request even when the same tab fetched 30 s earlier. Last-fetch timestamp now lives in localStorage (`cric_ticker_last_fetch_v1`); the immediate fire is skipped if any tab fetched within the 4-min floor.
- **Tab-router dedupe**: 4 admin and 5 member tab-routing if-chains were hand-copied across `switchTab`/`switchAdminTab`/`renderAdmin`/`renderMember`/`_doRefresh` and had drifted independently. Replaced with two lookup maps (`_ADMIN_TAB_RENDERERS`, `_MEMBER_TAB_RENDERERS`) and `_renderAdminTabBody`/`_renderMemberTabBody` helpers — pure cleanup, ~80 lines removed.

### v3.13.0 — May 6, 2026
**Performance & Quota Hardening (iOS / Android)**
- **Visibility-pause repaired**: `clearInterval(window._tickerInterval)` was clearing the wrong reference (the live handle is module-scoped). Backgrounded tabs were quietly burning CricAPI quota. Now correctly stops `_tickerInterval`, `_xiPreMatchTimer`, and `_xiPollTimer` on `document.hidden`, and resumes them on `visibilitychange`.
- **XI auto-watcher decoupled from `onSnapshot`**: The pre-match XI watcher was being unconditionally invoked from every match snapshot. After it exhausted MAX_ATTEMPTS and cleared its timer, the next snapshot silently re-armed a fresh 40-attempt cycle — making the 60-minute cap meaningless. Now gated on toss-result transition + a per-`mid` "given-up" Set, so MAX_ATTEMPTS actually sticks.
- **`autoFetchStats` coalescer (30 s)**: Background polls within 30 s of a previous attempt for the same `mid` are skipped. Admin-initiated retries (`adminFetchXI`'s 20 s loop) and the manual fetch button bypass the coalescer via an explicit flag.
- **Smoke-test routed through `_cricFetch`**: The diagnostic smoke test was bypassing the quota tracker via raw `fetch()`, undercounting daily usage. Now flows through the central wrapper and respects the 2000-call cap.
- **Cross-tab ticker leader election**: `fetchGlobalTicker` previously ran in every open tab, multiplying CricAPI calls per user (5 tabs ≈ 1440 wasted credits/day). Now uses a 6-minute localStorage heartbeat — only one tab is the "leader" and runs the ticker; followers stay quiet.
- **Negative cache for player profiles**: Clicking a not-yet-indexed player burned 2 CricAPI calls (search + info) on every click. A session-scoped `_profileNotFound` Set short-circuits subsequent clicks. Reload to retry.
- **Quota-tracker UTC day key**: `_trackApiCall` was using `new Date().toDateString()` (local timezone), so DST transitions and travel could silently reset the counter mid-day. Switched to `toISOString().slice(0,10)` (UTC `YYYY-MM-DD`).
- **Removed duplicate `_trackApiCall()` calls**: Two double-counting invocations inside `autoFetchStats` (scorecard + match_info fallback paths) were inflating the daily count — `_cricFetch` already tracks every attempt. Removed.
- **Search input debounced (120 ms)**: The player-picker search re-rendered ~50 cards on every keystroke, causing input lag on low-end Android. Now debounced.
- **Canvas particles honor `prefers-reduced-motion`**: The ambient stadium particle canvas (~15–80 particles via `requestAnimationFrame`) now exits early when the OS-level reduce-motion preference is set. Mobile already had visibility-pause; this adds OS-preference respect.

### v3.12.0 — April 30, 2026
**Logic & Data Integrity Overhaul**
- **Atomic Transactions**: Converted `applyBoosterChoice`, `removeBooster`, `handleLockTeam`, and `doJoin` to use `runTransaction`. Prevents booster inventory duplication and member registration collisions.
- **Impact-Sub Double Counting**: Fixed an issue where `autoFetchStats` unconditionally set `playingXI: true` for any player who batted/bowled, improperly stacking +4 points for both the original starter and the impact sub.
- **Economy NaN Fix**: Added division-by-zero guards to the economy rate calculation and resolved `toRealOvers("4.6")` returning an incorrect value of `5.0`.
- **Fuzzy Match Shadowing**: Refactored `getCredits` to use a strict initial+last-name check, preventing substring-shadowing (e.g., "Patel" incorrectly assigning credits for "Harshit Patel").
- **Auto-Lock Sync**: Added an explicit API `matchStarted` check to the auto-lock trigger, preventing premature lockouts if CricAPI publishes the batting lineup at the toss.
- **Global Error Handlers**: Added `window.onerror` and `unhandledrejection` listeners to catch silent asynchronous failures.

### v3.11.0 — April 29, 2026
**Architectural Hardening & Code Quality**
- **Resolved 30 ESLint issues**: Fixed all 13 errors and 17 warnings, including `no-undef` and `no-unused-vars`.
- **Unified Module Scope**: Merged all independent `<script>` tags into the main module scope. This fixes cross-script dependency issues and enables strict `no-undef` enforcement.
- **Dead Code Elimination**: Removed several unused variables (`matchHistory`, `xiRetryCount`, `_cricApiCalls`, etc.) and the redundant `renderXIChips` helper.
- **Standardized Globals**: Replaced risky global function calls with explicit `window.` prefixes where required by module scoping rules.
- **Improved Hygiene**: Converted `catch(e) {}` blocks to ES2019 `catch {}` and added safety guards to `ln(n)`.

### v3.10.0 — April 29, 2026
**Final Architectural & Logic Hardening**
- **Atomic Match Counter**: Implemented a Firestore transaction for sequential `matchNum` generation. Prevents collisions if multiple admins create matches simultaneously.
- **Match-Scoped Pollers**: Refactored the `autoFetchStats` re-entrancy guard to be match-specific. Multiple active matches can now be polled independently without blocking each other.
- **Robust PIN Upgrade**: The legacy PIN auto-upgrade now `awaits` the database write and handles failures, preventing users from being locked out due to transient network errors during migration.
- **CricAPI Proxy Support**: Added architectural support for routing API calls through a Netlify Function. Includes a "Proxy Toggle" in League Settings to hide the API key from visitors.
- **Secure Join Links**: Swapped `Math.random()` for `crypto.getRandomValues()` for higher-entropy invitation code generation.
- **ESLint Hardening**: Re-enabled `no-undef` rule and declared browser/firebase globals to catch typos in the 17k-line codebase.
- **Hygiene**: Added null-guards to name helpers, switched animations to `textContent`, and removed exposed debug scorecard functions from production.

### v3.9.1 — April 29, 2026
**Critical Security & Atomicity Fixes**
- **Reflected XSS Patch**: Sanitized the `?join=` query parameter on the join screen to prevent script injection via invitation links.
- **Full State Atomicity**: Folded `meta/game` active match updates into the `finalizeMatch` atomic `writeBatch`. Prevents "ghost" active matches if a separate update fails.
- **XSS Defense-in-Depth**: Systematic `escHtml` wrap for all player name helpers (`fmtName`, `ln`). Covers leaderboards, XI displays, and admin dropdowns.
- **Auth Hardening**: Re-validates member names on login/upgrade to prevent dot-path injection from legacy or direct-write names.
- **Global Data Reset**: Fixed a session leak where `sessionClear` left data globals populated. Now explicitly resets all match/stats/member globals to empty on logout.

### v3.9.0 — April 29, 2026
**Performance Architecture & Mobile Hardening**
- **Targeted DOM Updates (Point 3)**: Implemented surgical `textContent` updates for the Live Score Pill and Leaderboard scores. The app no longer destroys/rebuilds the entire DOM on every score tick, eliminating UI flicker and significantly reducing CPU/Battery usage.
- **Mobile GPU Optimization**: Automatically strips `backdrop-filter` and infinite decorative animations on devices under 768px. Eliminated all `will-change: transform` site-wide to prevent GPU tile exhaustion on mid-range Androids.
- **Layout Reflow Cleanup (Point 7)**: Removed all forced synchronous reflow (`offsetHeight`) hacks, ensuring buttery smooth scrolling during live match updates.
- **Redundant Re-render Short-Circuit (Point 8)**: Added JSON-stringified comparison checks to all Firestore `onSnapshot` listeners. The app now aborts the refresh loop if the incoming data hasn't actually changed.
- **Cold-Load Wins**: Optimized Google Fonts payload and added `<link rel="modulepreload">` for Firebase SDKs to speed up First Contentful Paint.
- **Housekeeping**: Hardened `.gitignore` with `.env*` patterns and implemented a 7-day TTL expiration for the local player cache.

### v3.8.2 — April 28, 2026
**Robustness & Bug Fixes**
- **Lost Booster Bug Fixed**: Resolved an issue where returning members re-authenticating via the Join Link (`?join=CODE`) had their local team state wiped, leading to their boosters being silently refunded upon saving.
- **Automated Role Correction**: Added a `ROLE_OVERRIDES` dictionary inside the CricAPI squad-fetching logic to correctly assign "BOWL" to uncapped players like Brijesh Sharma and Yash Raj Punja.
- **Booster Race Condition**: Rewrote standalone `applyBoosterChoice` and `removeBooster` menus to use atomic `writeBatch` transactions.
- **fetchGlobalTicker ReferenceError**: Fixed `activeTab is not defined` crash in the background ticker by parsing `window.location.search` instead.
- **Test Suite Expansion**: Added 9 new tests to `test-suite.js` to simulate the "Allrounder" misclassification and verify the new role override logic.

### v3.8.1 — April 28, 2026
**Security Hardening & Bug Fixes**
- **XSS Vulnerability Sweep**: Replaced all fragile `.replace(/'/g, "\\'")` onclick escaping with `escAttr(JSON.stringify(...))`. Added `escAttr()` to all unescaped `value=""`, `data-p`, `data-team`, `data-name`, and `data-venue` attributes across ~45 interpolation sites. Zero unescaped user/API data flows into HTML attributes.
- **Booster Race Condition (H2)**: Refactored team lock to use `writeBatch` — team submission and booster inventory update are now a single atomic Firestore operation, preventing inventory corruption from concurrent submissions.
- **Silent Error Swallowing (H3)**: Replaced all `.catch(() => {})` and `.catch(() => null)` with `console.warn` logging so series cache and fetch failures are visible.
- **PIN Migration**: Force-migrated all 22 remaining plaintext PINs to PBKDF2-SHA256 hashes. Legacy deadline shortened from May 15 to May 5.

### v3.8.0 — April 28, 2026
**CricAPI Credit Optimization**
- **Removed auto-sync from snapshot loop**: `adminAutoSyncPlayerIds` was firing on every Firestore `onSnapshot` callback, causing 2-6 extra API calls per auto-refresh tick. Photo sync is now manual-only (admin button), eliminating the cascade where AR write → snapshot → sync → API calls multiplied credits per tick.
- **Global ticker gated to admin sessions**: `fetchGlobalTicker` (calls `currentMatches` every 5 min) was running for all users including idle member tabs. Now only starts for admin sessions with active matches, saving ~96 credits/user/day.
- **AR default interval raised from 30s to 60s**: Fantasy point granularity doesn't need 30-second polling. Halves AR credit usage per match (~210 credits saved). Admin can still select 30s from the dropdown.

### v3.7.9 — April 26, 2026
**Data Integrity & Security**
- **Booster Data-Loss Race Condition Fixed**: Updated the `setDoc` calls in team submission, join, and profile-save functions to use targeted `{ merge: true }` on specific user keys (e.g., `{[session.name]: { boosters: inv2 }}`). This definitively prevents concurrent team submissions from overwriting and deleting other members' accounts or booster states.
- **Known Limitations Added**: Acknowledged the architectural tradeoff of storing the CricAPI key in a publicly-readable Firestore document for this serverless SPA model.

### v3.7.8 — April 26, 2026
**Security & Firestore Hardening**
- **0000 Auto-Creation Removed**: Stopped client-side creation of `meta/game` document to close the default Admin PIN race condition. First-time setup must now be done manually in the Firebase Console.
- **Strict Data Validation**: Hardened Firestore rules. `matches` document updates now use `.hasOnly()` instead of `.hasAny()`, preventing malicious injection of arbitrary fields into match objects.

### v3.7.5 — April 26, 2026
**Security Review Fixes**
- **PBKDF2 PIN Hashing**: Upgraded from single SHA-256 to PBKDF2 with 600k iterations via `crypto.subtle`. Brute-forcing 10k PIN candidates now takes minutes instead of microseconds.
- **Legacy PIN Deadline**: Plaintext PINs in Firestore refused after 2026-05-15, closing the downgrade attack vector.
- **Removed corsproxy.io**: Deleted the CORS proxy fallback that leaked the CricAPI key to a third party. Dropped from CSP.
- **Admin Name Validation**: `adminSaveProfile` now uses shared `validateName()` to block Firestore-unsafe characters.

### v3.7.4 — April 26, 2026
**PIN Hashing & Content Security Policy**
- **PIN Hashing**: All member and admin PINs are now hashed with SHA-256 (salted with the member's name) before storage in Firestore. Legacy plaintext PINs auto-upgrade on first login.
- **Content Security Policy**: Added a full CSP header to `netlify.toml` restricting scripts, styles, images, and connections to trusted origins only.

### v3.7.2 — April 26, 2026
**Security & Stability**
- **Auth Restoration**: Re-added `signInAnonymously()` to the boot sequence to satisfy hardened Firestore rules.
- **XSS Shielding**: Moved STATS buttons to a safe event-delegation pattern and applied `escHtml()` to all API-driven data fields (profile stats, venues).
- **Crash Fix**: Removed the dangerous `.catch(() => null)` pattern from all fetch calls to prevent null-dereference runtime errors.

### v3.7.1 — April 26, 2026
**Performance & Stability**
- **API Engine Hardening**: Removed redundant JSON parsing calls across the entire application to prevent "r.json is not a function" errors.
- **Manual 🔄 Sync Button**: Added a force-sync button for player images in the Admin tab.
- **Global ID Cache**: Player IDs are now persisted in `localStorage`, ensuring images load faster on repeat visits.
- **Security Fix**: Bypassed CORB blocks for player images by implementing safe SVG fallbacks.

### v3.7.0 — April 26, 2026
**Professional Player Profiles**
- **Automated Thumbnails**: Every player card now displays official images from CricAPI.
- **Auto-Sync Engine**: Implemented background "Backfill" for existing matches — missing player IDs are automatically fetched from scorecards and stored in Firestore to enable images instantly.
- **Enhanced Setup**: `loadMatchPlayers` now captures unique IDs during initial match creation for immediate visual feedback.

### v3.6.9 — April 26, 2026
**Visual & Live Feed Enhancements**
- **Player Thumbnails**: Added circular player images to selection cards and "My Team" view.
- **Global Ticker**: Real-time scrolling scoreboard for other active IPL matches (Live Tab).
- **Venue Metadata**: Match header now displays the stadium venue automatically pulled from CricAPI.

### v3.6.8 — April 25, 2026
**Network & Stats Resilience**
- **Player Career Stats (Lazy Load)**: Built a tap-to-view profile system fetching career data (IPL/T20I) from CricAPI.
- **Two-Tier Caching**: Firestore `/meta/playerProfiles` caching to minimize API quota usage.
- **Proxy Fallback**: Upgraded `_cricFetch` to automatically reroute through a CORS proxy if direct ISP connection resets occur.
- **High-Visibility UI**: Bright, solid-color credit badges for better accessibility.

### v3.6.2 — April 24, 2026
- **Firebase Anonymous Auth**: App now signs every visitor in silently with Firebase Anonymous Auth before any Firestore read. Firestore rules updated to require `request.auth != null` on all reads and writes — bots and direct API queries can no longer access the database without first loading and executing the app.

### v3.6.1 — April 24, 2026
- **Mobile: duplicate font load removed** — Google Fonts `@import` inside CSS eliminated; fonts now load only once via the `<link>` in `<head>`, halving font download on first visit.
- **Mobile: toast safe-area fix** — Toast `bottom` position now uses `max(20px, env(safe-area-inset-bottom, 20px))` so it clears the iPhone home indicator on all modern iPhones.
- **Mobile: recent overs scroll** — Added `-webkit-overflow-scrolling: touch` and `overscroll-behavior-x: contain` to `.csb-recent-overs` for smooth iOS momentum scroll.
- **Mobile: touch target fix** — `.btn-ghost` and `.btn-sm` now have `min-height: 44px` in the touch media query, meeting Apple HIG and Material minimum tap-target sizes.

### v3.6.0 — April 24, 2026
- **Name validation**: Member names containing `.` `[` `]` `#` `$` `/` are now rejected at join time — prevents dot-path corruption in booster `updateDoc` writes where `.` is treated as a Firestore field separator.
- **Session timeout**: Sessions older than 10 hours are automatically cleared on boot — removed members can no longer stay logged in indefinitely.
- **Error message hygiene**: Boot-time Firebase errors now show a generic "could not connect" message instead of leaking collection names/paths; `e.message` in match-list innerHTML is now escaped with `escHtml()`.
- **Security headers**: Added `netlify.toml` with `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection` for all routes.
- **Firestore rules**: Added `firestore.rules` to the repo — rules are now version-controlled with full audit history and rollback capability.

### v3.5.9 — April 24, 2026
- **XSS hardening**: Wrapped all unescaped `p.name` / `match.label` / `shortName(m.name)` innerHTML insertions with `escHtml()` across My Team card, Player Stats card, player selection card, admin pool chip, match option list, and history modal title.
- **Race condition fix**: `setDoc` on `meta/members` at join and admin profile save now uses `{ merge: true }` — prevents a simultaneous join from overwriting another member's data.
- **Supply chain**: Added SRI hash (`sha384`) to the canvas-confetti CDN script tag.
- **CSS**: Removed orphaned closing `}` that was causing an IDE parse error in the mobile performance media query block.
- **Input hardening**: Added `maxlength="30"` to member name, join name, and join team name inputs.

### v3.5.8 — April 24, 2026
- **Match Info tab**: Added a standalone 6th tab showing the live batting and bowling scorecard. Tab is conditionally rendered — it only appears when a match is live (`locked && !finalized && !matchEnded`) and disappears automatically when the match ends. Positioned between "My Team" and "Live Scores" in member view, and between "Current Match" and "Player Stats" in admin view. RAF-based DOM patch keeps it in sync with every auto-fetch cycle.
- **Live score fix**: Fixed a crash (`ReferenceError: _isIPL is not defined`) that occurred during live stat fetches. The v3.5.4 bowling-overs guard incorrectly used a local variable `_isIPL` from `renderPlayerGrid`; replaced with the module-scope `_matchType === "ipl"` check.
- **Score readability**: Team score in the Match Info innings header now renders in white instead of the team's primary colour, which was unreadable on dark backgrounds for several team palettes.

### v3.5.7 — April 23, 2026
- **Audit-Driven Stability**: Refactored match finalization to use atomic `writeBatch` transactions.
- **Boot Crash Prevention**: Fixed TDZ ReferenceError in `showError` content rendering.
- **Booster Protection**: Switched to dot-path `updateDoc` to prevent concurrent booster data loss.
- **Super Over Scoring**: Fixed logical OR for `notOut` status and per-innings overs capping.
- **Security**: Extended XSS escaping to scorecard player names.
- **Squad Update**: Added Krish Bhagat (MI) to the player credits pool.

### v3.5.6 — April 22, 2026
- **CSV Formula Injection Fix**: Added `safeCSV` prefixing to prevent formula execution in exported spreadsheets.
- **Hardened Booster State**: Refined `applyBoosterChoice` and `removeBooster` logic to ensure local state only updates after a successful database write.

### v3.5.5 — April 22, 2026
- **XSS Hardening**: Implemented `escHtml()` serialization for all member-controlled strings (names, team names) to prevent script injection.
- **Security Hardening**: Tightened Firestore rules for `/meta` and `/season` collections to prevent unauthorized deletions.
- **Logging**: Replaced silent catch blocks with `console.warn` for better observability.

### v3.5.4 — April 21, 2026
- Fixed not-out asterisk display on leaderboard.
- Fixed `saveAllStats` legacy field cleanup to prevent data corruption.
- Relaxed bowling overs guard to support non-T20 matches.
- Implemented `CSS.escape()` for robust DOM query selectors.

### v3.5.3 — April 21, 2026
- Added Dilshan Madushanka to the overseas players roster.

### v3.5.2 — April 21, 2026
- Fixed `abandonMatch` field migration gap.
- Enhanced `exportCSV` label lookup prioritization.

### v3.5.1 — April 21, 2026
- Implemented **Smart Innings Picker** for live display.

### v3.5.0 — April 20, 2026
- Hardened security rules for matches collection.
- Added 5 new dark themes: Cyberpunk, Synthwave, Matrix, Blood Moon, Absinthe.

---

## 🤝 Contributing

This is a personal project for a private friend group. Feel free to fork it and adapt it for your own league.

---

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). You are free to use, modify, and distribute this software as per the terms of the license.
