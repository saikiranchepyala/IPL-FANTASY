---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "3.5.3"
project: ipl-ssmb-fantasy-league
stack: "HTML5/ES6+, Firebase (Firestore/Auth), CricAPI (CricketData.org), CSS3 (Modern Glassmorphism)"
---

# IPL Fantasy League v3.5 — Project Intelligence

## ✈️ Overseas Player Roster Update (v3.5.3 — April 21, 2026)

**Update**: Added **Dilshan Madushanka** (SRH) to the `OVERSEAS_PLAYERS` set. 
- Ensures he is correctly tagged as "FOREIGN" in the UI.
- Correctly counts toward the 4-player overseas cap for team submissions.

---

## 🔧 Post-Audit Fixes (v3.5.2 — April 21, 2026)

**Fix 1 — `abandonMatch` field migration gap**
Updated `abandonMatch` to use effective runs and not-out values (`bat_runs ?? runs`). Previously, the duck-penalty protection logic used only legacy fields, causing it to trigger for every auto-fetched player (whose legacy fields are null) but only write to the legacy `notOut` field (which `calcPoints` ignores in favor of `bat_notOut`). Fixed to read/write both.

**Fix 2 — `exportCSV` label prioritization**
Enhanced the CSV export logic to find the "cleanest" label for a match ID across all member records. It now filters out labels containing the rain emoji (🌧️) or "Abandoned" text when choosing the header label for a match column.

---

## 🏏 Current Innings Detection Fix (v3.5.1 — April 21, 2026)


**Bug**: `autoFetchStats` used `sc[sc.length - 1]` to pick the "current" innings for live batsmen/bowler display. CricAPI doesn't guarantee innings order in the `scorecard[]` array — when the 1st innings was last in the array, the app showed stale 1st-innings batsmen (e.g. SRH's Abhishek Sharma/Ishan Kishan) while DC was actually batting in the 2nd innings.

**Fix**: Smart innings picker that finds the truly active innings:
1. **Priority 1**: Innings with fractional overs (mid-over = definitely in progress).
2. **Priority 2**: Incomplete innings (< 20 overs) with not-out batsmen — take the one with most overs bowled.
3. **Priority 3**: Any innings under 20 overs.
4. **Fallback**: Last innings in array (original behavior).

---

## 🔒 Security Hardening — Firestore Rules (v3.5.0 — April 20, 2026)

**Goal**: Transition from "Public/Open" database rules to "Hardened" rules to prevent accidental or malicious data loss while maintaining the "Zero-Auth" (PIN-based) user flow.

### Fix 1 — Deletion Protection
Modified rules to `allow delete: if false;` for the `matches` collection. This prevents any user (or script) from wiping out match history via the client-side SDK.

### Fix 2 — Structural Integrity (Field Validation)
Implemented an `affectedKeys()` check on match updates. Only known application fields (`teams`, `stats`, `locked`, `revealed`, etc.) can be modified. This prevents a malicious actor from injecting garbage data or large blobs into the match documents.

### Fix 3 — Rules documentation in StepByStepGuide
Updated the guide to provide these hardened rules as the default setup for new deployments.

**Rule**: Never revert Firestore rules to `if true`. Any new match-level field must be added to the `hasAny([...])` list in the security rules or the write will fail.

---

## 🔧 Auto-Refresh Button Fix (v3.4.0 — April 20, 2026)

**Root cause**: Three compounding issues combined to leave the button permanently stuck at "⏸ OFF":

### Fix 1 — `arInterval` variable shadowing (rename to `arIntervalTimer`)
`let arInterval` shadowed the `<select id="arInterval">` DOM element in some browser environments, causing `parseInt(arInterval?.value)` to fail silently. Renamed the JS variable to `arIntervalTimer` everywhere.

### Fix 2 — `arStoredSecs` persistence across re-renders
`_doRefresh()` replaces `adminContent.innerHTML` on every tick — the dropdown always re-rendered with the default "30 sec" option. Added `window.arStoredSecs = 30` (init) and `onchange="window.arStoredSecs = parseInt(this.value)"` on the select; rendered options use `${window.arStoredSecs === N ? "selected" : ""}` to restore the chosen interval.

### Fix 3 — Removed overly strict `liveMatchId` guard (main green-button bug)
A guard was added to `startAR` that returned `false` and showed "Set liveMatchId first" if `match.liveMatchId` wasn't set. This blocked `arIntervalTimer` from being set, so `refreshView()` always rendered the button as "⏸ OFF". `autoFetchStats` already handles missing `liveMatchId` gracefully (silent bail), so the guard was redundant and harmful. **Removed.**

The `!match.locked` guard was also removed — auto-refresh can now start before the match is locked (needed for pre-match XI polling).

**Rule**: `startAR` only blocks on `match.finalized`. Never add guards that silently prevent `arIntervalTimer` from being set — the visual button state is derived directly from `arIntervalTimer`, so any silent return leaves the UI showing "⏸ OFF" with no explanation.

**`adminToggleAR` checks `startAR` return value**: Toast only fires if `startAR` returns `true`; no misleading "ON 🟢" on a finalized match.

**Rule**: Always use `arIntervalTimer` for the `setInterval` handle. The ID `arInterval` is reserved for the DOM `<select>` element.

---

## 🔧 Stats Grid + Ghost Cleanup Migration Fix (v3.3.0 — April 20, 2026)

**Root cause**: The v2.9.6 `bat_*` field prefix migration (`autoFetchStats` now sets `bat_runs`, `bat_balls`, `bat_4s`, `bat_6s`, `bat_notOut` and explicitly nullifies the legacy `runs`, `balls`, `fours`, `sixes`, `notOut` fields to clear old corruption) was not fully propagated to two display/cleanup functions.

### Fix 1 — `renderStatsGrid` out-badge shows for all auto-fetched batters (MEDIUM — wrong display)
`s.batted && !s.notOut` — with `s.notOut = null` (explicitly nullified by `autoFetchStats`), `!null = true`, so the out-badge `†` was shown for ALL batters including not-outs. Fix: `!(s.bat_notOut ?? s.notOut)`.

### Fix 2 — `cleanupGhostStats` falsely marks auto-fetched batters as ghosts (MEDIUM — wrong points)
`s.batted && (s.balls === 0 || s.balls == null)` — `s.balls = null` after migration, so every auto-fetched batter with `bat_balls=N, balls=null` was detected as a "ghost" and had `batted` set to `false`. Fix: `const _effectiveBalls = s.bat_balls ?? s.balls ?? 0; if (s.batted && _effectiveBalls === 0)`. Same fix applied to the runs ghost check.

**Rule**: Anywhere stats are read for display or cleanup, use the `bat_*` field with fallback: `s.bat_balls ?? s.balls`, `s.bat_runs ?? s.runs`, `s.bat_notOut ?? s.notOut`. `calcPoints()` already does this correctly. Every other stat consumer must follow the same pattern.



## 🔧 Manual XI Paste Panel + xiReady Fix (v3.2.0 — April 18, 2026)

**Root cause**: When CricAPI doesn't return Playing XI data in the window between toss and first ball (Path A status field absent, Path B scorecard arrays empty), the XI poller times out with no fallback. The admin had to switch to the Player Stats tab to use "Bulk Mark Playing XI" — and even then, `xiReady` was never set to `true`, so members never saw the "Toss done" prompt.

**Fixes**:

1. **`parseSquadList` now sets `xiReady = true`** when total playing count reaches 22+.
   Counts existing `activeMatchData.playerStatus` "playing" entries PLUS the current batch — so pasting both teams in two separate batches of 11 each still triggers xiReady correctly.
   Impact players (prefixed with "Impact:") are excluded from the count and never trigger xiReady.

2. **Manual XI panel added to Current Match tab** — collapsible `<details>` block ("XI not loading from API? Paste manually ▾"), only visible when `!xiReady && !locked && !finalized`.
   Admin pastes both Playing XIs (names from WhatsApp, Cricbuzz, Tribune India) → calls `parseSquadList('matchTabSquadBox')`.

3. **`parseSquadList` accepts `sourceId` parameter** (defaults to `"bulkSquadBox"` for backward compat). Current Match tab passes `'matchTabSquadBox'`.

**Impact player handling** (unchanged, documented here): The `parseSquadList` protection logic prevents "impact" status from overwriting an already-playing player in the same paste. `nowPlaying` count only tracks `"playing"` status — impact subs never contribute to the 22 threshold.

**Admin flow when CricAPI fails**:
1. Click "TOSS DONE — FETCH XI" → poller runs 20 attempts
2. If times out: expand "XI not loading from API?" panel → paste both XIs → "Mark Playing XI"
3. `xiReady` triggers when 22 playing confirmed → members see "Toss done" prompt

## 🔧 Final-Over Stats Fix (v3.1.0 — April 19, 2026)

**Root cause**: CricAPI's scorecard endpoint lags 1-2 overs behind live play. When `matchEnded: true` fires, our AR poller wrote whatever CricAPI had at that moment (stale by 1-2 overs) then called `stopAR()` and died. The v2.9.8 8-second retry only handles `sc.length === 0` (completely empty scorecard) — it does nothing when the scorecard is populated but stale. Admin was forced to use the manual scorecard parser for the final over every match.

**Fix**: Replaced both `stopAR()` + toast blocks on `ended` detection with `_handleMatchEnd(activeMid)`. On first detection, the recurring interval stops but a single grace poll fires 60 seconds later — giving CricAPI time to commit the final scorecard. On the grace poll's completion, the poller truly stops. Uses `activeMid` as a key so the grace poll is silently cancelled if admin navigates away (stopAR clears `_arGracePollMid`).

```js
function _handleMatchEnd(activeMid) {
  if (window._arGracePollMid !== activeMid) {
    // First detection — stop interval, schedule grace poll in 60s
    stopAR();
    window._arGracePollMid = activeMid;
    toast("🏁 Match ended — fetching final stats in 60s...", "info");
    setTimeout(() => {
      if (window._arGracePollMid === activeMid) autoFetchStats(false);
    }, 60000);
  } else {
    // Grace poll completed — truly stop now
    window._arGracePollMid = null;
    stopAR();
    toast("🏁 Final stats saved. Click 'Finalize & Save' when ready.", "info");
  }
}
```

`stopAR()` now also clears `window._arGracePollMid = null` so any navigate-away cancels the grace poll.

**Rule**: Never call `stopAR()` directly on `ended` detection inside `autoFetchStats`. Always route through `_handleMatchEnd`. The two call sites are the early-return branch (`!isChanged && !showFeedback`) and the post-write branch — both use `_handleMatchEnd(activeMid)`.

**What this does NOT fix**: CricAPI lag *during* the match (scorecard 1-2 overs behind while play is live). That is a CricAPI limitation — use "Fetch Now" manually in the final 2 overs if stats feel behind. The grace poll only rescues the final committed stats after `matchEnded` fires.

---

## 🔧 Smoke Test & Stability Fix (v3.0.0 — April 18, 2026)

Full regression + integration audit performed. One bug found and fixed. JS syntax check clean (394,677 chars, `node --check` passed). All CricAPI endpoints verified live against real key.

### Fix 1 — Admin Season Leaderboard `pillId` uses `/\s+/g` instead of `/[^a-zA-Z0-9_-]/g` (MEDIUM)
The member scorecard (`mpills-`) was correctly patched in a previous session to strip all non-alphanumeric chars from `pillId`. The admin scorecard (`ampills-`) was missed. If any member name contains an apostrophe (e.g. `D'Souza`), the `pillId` becomes `ampills-D'Souza` which breaks the inline `getElementById('ampills-D'Souza')` string in the onclick handler — the "X Matches ▾" toggle in the admin Season Leaderboard tab silently does nothing for that member.

**Fix** (line ~5947): `r.name.replace(/\s+/g, "_")` → `r.name.replace(/[^a-zA-Z0-9_-]/g, "_")`

**Rule**: Both scoreboard `pillId` sites must use `/[^a-zA-Z0-9_-]/g`:
- Member scorecard: `mpills-${r.name.replace(/[^a-zA-Z0-9_-]/g, "_")}` (line ~2675)
- Admin scorecard: `ampills-${r.name.replace(/[^a-zA-Z0-9_-]/g, "_")}` (line ~5947)

### API Verification (v3.0.0 — April 18, 2026)
All endpoints tested live. `fantasyEnabled: true` for all current IPL 2026 matches — scorecard endpoint fully operational. `IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"` confirmed correct against live API.

| Endpoint | Status |
|---|---|
| `currentMatches` | ✅ All IPL 2026 matches, `fantasyEnabled: true` |
| `match_scorecard` | ✅ Full batting/bowling data returned |
| `match_info` | ✅ toss/matchStarted/matchEnded correct |
| `match_squad` | ✅ ~26-27 players per team |
| `match_points` | ✅ Per-player fantasy points present |
| `series` | ✅ IPL 2026 found via series ID |
| `series_info` | ✅ All 70 IPL 2026 fixtures returned |
| `cricScore` | ✅ 72 match entries |

---

## 🔧 Smoke Test & Stability Fixes (v2.9.9 — April 18, 2026)

Full regression + integration audit performed. Five bugs found and fixed. No logic or data flow changes — surgical stability patches only.

### Fix 1 — `getTeamColor` deleted by external model (CRITICAL — Loading screen stuck)
`getTeamColor(matchData)` was removed from `ipl-fantasy-v4_render.html` by an external model. It is called by `injectTeamAmbient`, which is called at the top of every `_doRefresh()` tick. Since `_doRefresh` runs inside `setTimeout`, the `TypeError: getTeamColor is not a function` was uncaught and silent — the app stayed on Loading forever.

**Restored** at line ~168 (between `resolveTeamKey` and `resolveInningKey`):
```js
function getTeamColor(matchData) {
  if (!matchData) return { primary: "#2563ff", secondary: "#f59e0b", gradient: "135deg, rgba(37,99,255,.15), rgba(245,158,11,.05)" };
  const t1Key = resolveTeamKey(matchData.t1 || matchData.label || "");
  if (t1Key && IPL_TEAM_COLORS[t1Key]) return IPL_TEAM_COLORS[t1Key];
  return { primary: "#2563ff", secondary: "#f59e0b", gradient: "135deg, rgba(37,99,255,.15), rgba(245,158,11,.05)" };
}
```

**Rule**: `getTeamColor` must always exist between `resolveTeamKey` and `resolveInningKey`. It is called in 5 places: `injectTeamAmbient`, `renderTeamTab`, `renderMatchLeaderboard`, `renderAdminMatch`, `renderMemberMatchSelector`. Any model that removes it will break the boot sequence.

### Fix 2 — `showScreen` rAF has no error recovery (HIGH — app goes invisible)
`showScreen` sets `app.style.opacity = "0"` synchronously before the `requestAnimationFrame`. If the render function throws inside the rAF, `opacity` is never restored to `"1"`. The app becomes fully invisible with no error message.

**Fix**: wrapped the render + bindEvents call in try-catch. On error, falls back to `renderLoading()` and still completes the reveal rAF.

```js
requestAnimationFrame(() => {
  try {
    app.innerHTML = (map[n] || renderLoading)();
    bindEvents(n);
  } catch (e) {
    console.error("showScreen render error:", e);
    app.innerHTML = renderLoading();
  }
  requestAnimationFrame(() => { /* opacity:1 restore */ });
});
```

**Rule**: Any render function that can be called from `showScreen` must either be crash-proof or throw gracefully. The try-catch provides a last-resort safety net but does not replace null guards in individual render functions.

### Fix 3 — `?.split("vs")[n]` crash in `renderScoreBar` and booster dock (HIGH — TypeError)
The external model replaced the safe `(match.label || "").split(/\s+vs\s+/i)` pattern with `match.label?.split("vs")[0]`. When `match.label` is `undefined` (and `match.t1` is also unset), `?.split("vs")` returns `undefined`, then `undefined[0]` throws `TypeError` (no optional chaining on the index access).

Additionally, literal `"vs"` is case-sensitive — `"MI VS CSK"` or `"MI Vs CSK"` labels silently fail attribution. The rest of the codebase uses a case-insensitive regex.

**Fixed in two places**:
- `renderScoreBar` (line ~2059): `const _sbLabelParts = (match.label || "").split(/\s+vs\s+/i);`
- Booster dock (line ~666): `const _bstLabelParts = (activeMatch?.label || "").split(/\s+vs\s+/i);`

**Rule**: Never use `?.split("vs")[n]` — the optional chaining protects the `.split()` call but not the index access. Always use `(value || "").split(/\s+vs\s+/i)[n]`. This is the consistent pattern used everywhere else in the file (`renderScorePill`, `attributeScores`, `resolveInningKey`).

### Fix 4 — `parseScorecardText` catch block doesn't reset `skipNextRefresh` (MEDIUM)
The legacy scorecard text parser sets `skipNextRefresh = true` before `updateDoc`, then resets it to `false` in the first `.then()` on success. But the `.catch()` block only showed a toast — no reset. If `updateDoc` failed, `skipNextRefresh` stayed `true` and the next organic Firestore snapshot (someone else's action) was silently skipped, causing the admin to see stale data.

**Fix**: Added `skipNextRefresh = false;` as the first line of the `.catch()` callback.

**Rule**: Every code path that sets `skipNextRefresh = true` must have a corresponding reset in its error/catch path. The flag is consumed by the next `matches/matchId` onSnapshot on success; on failure (no snapshot fires), the catch must reset it manually.

### Fix 5 — `prevScores` and `_pvMatchCache` never cleared on logout (MEDIUM — memory leak)
- `prevScores` accumulates `"mid_memberName" → pts` entries on every leaderboard render — never cleared.
- `_pvMatchCache` accumulates full match objects for every match rendered — never cleared.
Over a season (14 matches × 10 members), `prevScores` holds ~140 entries and `_pvMatchCache` holds ~14 match snapshots. Both survive logout/re-login in the same tab, meaning a new user in the same browser session sees stale cache. On iOS, long-lived memory accumulation causes input lag and GC pauses.

**Fix**: Added `prevScores = {}; _pvMatchCache = {};` at the end of `sessionClear()`, after `matchUnsubs = {}`.

### Fix 6 — `pillId` apostrophe injection in season scorecard (Previous session)
Season scorecard generated `pillId = r.name.replace(/\s+/g, "_")` — apostrophes in names like `"D'Souza"` produced `pillId = "mpills-D'Souza"` which broke the inline `onclick="...getElementById('mpills-D'Souza')..."` string.

**Fix** (already applied in previous session): Changed to `r.name.replace(/[^a-zA-Z0-9_-]/g, "_")` — strips all non-alphanumeric characters, not just spaces.

**Rule**: Any `pillId` or `safeN` used inside an inline `onclick="...'${...}'..."` string must be sanitized with `/[^a-zA-Z0-9_-]/g` — not just `/\s+/g`. Apostrophes, quotes, and special characters all break the inline JS string delimiter.

## 🏗️ Core Architecture
- **Single-File Engine**: `ipl-fantasy-v4_render.html` contains the entire app (logic, styles, views).
- **Backend**: Firebase Firestore handles real-time sync for matches, member teams, and global stats.
- **Data Source**: CricAPI (v1) via `match_scorecard`, `match_info`, `match_squad`, `currentMatches`, `series`, `series_info` endpoints.
- **Security Model**: Admin-only write access to match metadata; Member-only write access to their own team picks until match lock.

## 🚀 Automation & Logic (v2.8+)

### Pre-Match XI Auto-Watcher
- `startPreMatchXIWatcher()` / `stopPreMatchXIWatcher()` — background poller that auto-starts after toss.
- Polls `match_scorecard` every **90s** for up to 40 attempts (~60 min), covering toss → first ball window.
- **Trigger**: fires from Firestore `onSnapshot` only when `tossResult` is set in the match document (toss has happened). Before toss, zero polling. Admin does NOT need to do anything.
- **How tossResult gets set**: admin clicks "Fetch Playing XI" once after toss → `autoFetchStats` detects toss from CricAPI → writes `tossResult` to Firestore → `onSnapshot` fires → watcher auto-starts.
- Auto-stops when `xiReady = true`, `locked = true`, `finalized = true`, or 40 attempts reached.
- `stopPreMatchXIWatcher()` also called explicitly on "START MATCH" click.

#### Critical: Feedback Loop Prevention (v2.8 fix)
**Do NOT call `stopPreMatchXIWatcher()` from the `onSnapshot` handler or from the guard block inside `startPreMatchXIWatcher`.** Doing so creates a feedback loop:
> `poll()` writes to Firestore → `onSnapshot` fires → `stopPreMatchXIWatcher()` clears timer → next `onSnapshot` restarts watcher with immediate `poll()` → writes to Firestore → repeat
This caused burst API calls 4–15s apart, burning quota rapidly. The watcher's own `poll()` function is the **only** place that calls `stopPreMatchXIWatcher()` (when it detects the match has started/ended/XIconfirmed). The `startPreMatchXIWatcher` guard simply `return`s silently if conditions aren't met.

### Playing XI Detection — Two-Path System
- **Path A** (primary): reads `scData.data?.players[].status === "playing"` — works during/post-match.
- **Path B** (fallback): when Path A yields < 11 starters, reads `scData.data?.scorecard[].batting` and `.bowling` — CricAPI pre-populates these with the Playing XI announcement (0 runs/0 balls) right after toss. **This is the path that actually works pre-match.** Same approach as the confirmed-working JSON-paste parser.
- `xiReady` flag set in Firestore only when 22+ players confirmed (both teams).
- "Fetch Playing XI" button still exists for manual trigger; runs retry loop (20× at 20s).

### API Leak — Member-Triggered Calls (v2.8 fix)
- `renderStatsGrid` had a "RETRY NOW" button (`onclick="window.autoFetchStats(true)"`) visible to all members when `fantasyEnabled === false` (pre-match state). With 25 members across multiple pre-match matches, any click fired a real `match_scorecard` API call. Produced irregular gaps (1–5 min) in logs — the human-click pattern.
- **Fix**: Button removed entirely from member view. Informational text stays; `autoFetchStats` is admin-only.

### API Leak — Post-Match Poller
- **Before**: poller kept running after `matchEnded = true` by design ("keep polling until admin finalizes"). Burned quota indefinitely if admin forgot to finalize.
- **After**: `stopAR()` fires automatically the moment `matchEnded = true` is detected in `autoFetchStats`. Final stats committed first, then poller stops. Toast: `🏁 Match concluded — final stats saved. Click 'Finalize & Save' when ready.`
- `matchEnded: true` now also written to Firestore via the **main scorecard path** (was previously only written in the `match_info` fallback path).

### Zero-Touch Playing XI (v2.6 — unchanged)
- 4-tier name resolution (Exact → Contains → Initials → Last Name) maps CricAPI names to internal pool names.
- Impact Sub detection: automatic status flip from `substitute` → `playing` on entry.

## 🏟️ Admin Flow (Match Day)
1. **Before match day**: Create match, fill Label + Team 1/2, click "Find IPL Matches" → select → `liveMatchId` auto-fills → player pool loads (~51 players).
2. **After toss (~30 min before first ball)**: Click **"Fetch Playing XI"** once. This detects the toss, writes `tossResult` to Firestore, and auto-starts the 90s XI watcher. You'll get `✅ Playing XI auto-detected for both teams!` toast — no further action needed.
3. **First ball**: Click **START MATCH** — locks picks, reveals leaderboard, starts live stats poller.
4. **Match ends**: Poller auto-stops when `matchEnded = true` detected. Toast prompts to finalize.
5. **After match**: Click **Finalize & Save** — locks points, updates season table, saves to history.

## 📡 CricAPI Endpoints — Full Verified Audit (v2.9.8)

All endpoints below were tested live against the real API key on 2026-04-18.

### In Use
| Endpoint | When called | Purpose |
|---|---|---|
| `currentMatches` | Admin "Find IPL Matches" + smoke test | Discover live/upcoming match IDs. Returns `teamInfo[].img` used for `t1img`/`t2img` |
| `series` | Admin series search | Search by series name |
| `series_info` | Admin series search | Full match list for a series |
| `match_info` | "Load Players" button | Team info + player roles |
| `match_squad` | Fallback if `match_info.teamInfo` empty | Raw squad names |
| `match_scorecard` | `autoFetchStats()` — every poll cycle | Live stats, toss, XI, score — primary endpoint |
| `match_info` (2nd) | Inside `autoFetchStats`, when scorecard returns failure | Score + status + XI fallback (no batting/bowling stats) |

### Exists — Not Used (verified with real key)
| Endpoint | Response confirmed | Notes |
|---|---|---|
| `cricScore` | ✅ success | Returns all current matches with `id`, `ms` (fixture/live/result), `t1`, `t2`, `t1s`/`t2s` (score strings like `"195/6 (20)"`), `t1img`/`t2img` (CricAPI CDN logo URLs), `series`. Lightweight, no match ID needed. **Not needed** — app already has `IPL_TEAM_LOGOS` static map + `teamInfo[].img` from `currentMatches` already stored as `t1img`/`t2img` in Firebase. All render paths already consume `match.t1img \|\| IPL_TEAM_LOGOS[t1Key]` with `onerror` fallback. |
| `matches` | ✅ "Invalid API Key" (exists) | Broader version of `currentMatches` — includes scheduled future matches. Same field structure. Not needed since `currentMatches` covers active matches. |
| `match_points` | ✅ success | Returns per-player fantasy points: `id`, `name`, `altnames`, `points`. Organised by innings (batting/bowling/catching) and a totals block. **Not usable as a replacement for `calcPoints()`** — CricAPI default rules differ materially: 20 pts/wkt (vs our 25), +12/maiden (vs our +8), +4/50 milestone (vs our +8), run-out +6 (vs our +12 direct). The `altnames` per player are already handled — app builds `altnames` from the player pool loaded via `loadMatchPlayers`. |

### Does Not Exist / Not Accessible on This Plan
| Endpoint | Result | Notes |
|---|---|---|
| `bbb` | ❌ "Invalid API requested" | Ball-by-ball endpoint. Not accessible. Firebase schema has `bbbEnabled: false` on all IPL matches — confirmed disabled at the CricAPI level, not just the app. |
| `player_info` | ❌ "Invalid API requested" | Not accessible on this plan. |
| `player_stats` | ❌ "Invalid API requested" | Not accessible on this plan. |
| `match_players` | ❌ "Invalid API requested" | Not accessible on this plan. |
| `cricScore` (V2 livescores) | ❌ 400 error | Paid V2 feature. Different from the V1 `cricScore` endpoint above. |

### Confirmed Root Cause of CricAPI Instability
**`fantasyEnabled: false` → `match_scorecard` returns `"ERR: Scorecard not found"`.**

Tested live: SRH vs CSK (2026-04-18) had `fantasyEnabled: false`. `match_scorecard` for that match ID returned failure. `match_info` for the same match returned correct score and status. This is not a bug in the app — CricAPI simply does not serve the scorecard endpoint for matches where `fantasyEnabled: false`. The fallback to `match_info` inside `autoFetchStats` handles this case (score/status sync only; no batting/bowling stats available). Admin has requested CricAPI to enable `fantasyEnabled: true` for IPL matches. Once active, the scorecard will be reliable.

### Alternative Data Source — TheSportsDB (Investigated, Rejected)
Tested live on 2026-04-18. Findings:
- IPL league ID is **4460** (not 4506 — that resolves to Coppa Italia).
- `eventsseason.php?id=4460&s=2025-2026` → `{"events":null}` — **no current season data**.
- `eventsseason.php?id=4460&s=2024` → 16 of 74 matches only — **incomplete historical coverage**.
- Match event fields: `intHomeScore`, `intAwayScore`, `strResult` (result string) — generic sports DB format. No innings breakdown, no per-player batting/bowling stats.
- Player endpoint: biographical only (name, DOB, team). No cricket stats.
- V2 livescores: paid plan, 2-minute cadence, no player-level data.
- **Verdict**: Cannot replace or supplement CricAPI for player stats. Unusable for `calcPoints()`.

## ⚡ Booster System (v2.9)

### Rules
- **1 booster per match** — team doc holds a single `booster` object; dock shows Remove/Change when one is active.
- **League stage only** — `isPlayoffMatch(match)` checks label for: `playoff`, `qualifier`, `eliminator`, `final`, `semi-final`, `q1`, `q2`, `el.`. Dock shows greyed "not available" message; overlay blocked with toast.

### Season Inventory (per member)
Stored in `meta/members[name].boosters`: `{ triple: 2, double: 3, team: 2 }`.
- **Triple (3×)**: 2 per season — multiplies the entire match total by 3×.
- **Double (2×)**: 3 per season — multiplies the entire match total by 2×.
- **Team (2×)**: 2 per season — multiplies every player from a chosen IPL team in your XI by 2×.
- Inventory initialized when member joins or admin saves profile. Existing members default to full inventory if `boosters` field is absent.

### Points Calculation Order
1. Per-player: `calcPoints(stats)` → Captain (2×) / VC (1.5×).
2. **Team booster** (per-player): if player's `resolveTeamKey(team)` === `booster.target`, ×2. Applied inside the reduce.
3. **Triple/Double** (whole-match): after the full reduce, multiply the total by ×3 or ×2. No target needed.
- Example: 400 base pts + Triple = 1200 pts. Bridges the season leaderboard gap.
- `bstTotalBadge(booster, isFinalized)` — returns badge HTML for triple/double shown on lb-card score.
- `bstChipForPlayer(booster, playerName, pTeamKey, isFinalized)` — only for team booster, shown on player chips.

### Per-Match Booster Data
Saved in `matches/{mid}/teams/{name}.booster`: `{ type: 'triple'|'double'|'team', target: null|'SRH' }`.
- `target` is `null` for triple/double (no player selection needed — multiplies entire total).
- `target` is IPL team key (e.g. `'SRH'`) for team booster. Only match teams shown in picker.
- Inventory is decremented in `meta/members` when team is saved with a new booster; refunded if booster is removed or changed.

### Booster Auto-Save for Already-Submitted Teams (v2.9.3)
**Problem**: Members who had already locked in their team applied a booster, saw a toast, but nothing was saved — they didn't know to re-press "Lock In".
**Fix**: `applyBoosterChoice` and `removeBooster` are now `async`. For members with `submitted: true`, they immediately write to Firestore:
1. `updateDoc` patches `matches/{mid}/teams/{name}.booster` directly.
2. Fresh `getDoc` reads `meta/members`, adjusts inventory (refund old type if changing, deduct new type).
3. `setDoc` writes back updated inventory.
4. **In-memory patch**: `activeMatches[activeMid].teams[name].booster` is updated immediately so a subsequent lock-in sees `prevBooster === newBooster` → no double inventory charge.
- If team not yet submitted, booster is staged to `localTeam.booster` only. Toast: "Booster staged — lock in your team to save it."
- `finalizeMatch` always reads fresh Firestore data — unaffected by this change.

### Privacy / Reveal System
- **Before match starts** (not locked): booster is completely hidden from other members. On your own team card, a "⚡ Booster Active" pill confirms it is set but shows no type/target.
- **After admin clicks START MATCH** (`locked: true`): full booster type and target immediately revealed to everyone — badge on lb-card name row, card border glow, and player chip badges.
- There is **no "secret while live" phase** — reveal happens at lock, not finalization.
- Your OWN booster: `renderMyTeamCard` always passes `true` to `bstChipForPlayer` (owner always sees own booster in full). Do NOT revert these to `match.finalized`.

### UI Components
- **Booster Dock** (`renderBoosterDock`): glass card in the XI builder (only when XI is full, before lock). Shows inventory chips (TRIPLE/DOUBLE/TEAM) → tap to open overlay. Active booster shows with Remove/Change buttons.
- **Booster Overlay** (`openBoosterOverlay`): bottom sheet with 3 type buttons + target picker. Player list for triple/double; 10 IPL team keys for team booster. "APPLY" stages it locally; booster is only committed when "LOCK IN MY TEAM" is clicked.
- **Leaderboard card highlights** (live match, `match.locked`): `bstCardClass` adds `.lb-bst-triple/.lb-bst-double/.lb-bst-team` to the lb-card for a colored left-border glow. `bstPill` renders a `bst-live-pill` badge in the name row (next to team name) showing type + target. Score badge (`.lb-score .bst-reveal-badge`) is 11px for visibility.
- **Key functions**: `getBoosterInventory(name)`, `renderBoosterDock(match, team)`, `bstChipForPlayer(booster, playerName, pTeamKey, isFinalized)`, `_bstSheetInner()`, `_refreshBoosterDock()`.
- **Window globals**: `window.openBoosterOverlay(preType?)`, `window.removeBooster()`, `window.bstSelectType(type)`, `window.bstSelectTarget(target)`, `window.applyBoosterChoice()`.

### `memberMatchTotal` Signature Change
Now takes optional `playersList` arg: `memberMatchTotal(team, stats, playersList?)`.
- Falls back to global `matchPlayers` if not provided (backward compat for callers without a match context).
- Both finalize paths (`finalizeMatch` and `abandonMatch`) now pass `freshMatch.players` explicitly.
- Admin standings calculation (line ~3651) passes `getPlayers(activeMid)` explicitly — without this, team booster points are wrong when admin has multiple matches loaded and `matchPlayers` global is stale.

## 📏 Points System (Full — matches calcPoints() in code)

### Base
- +4 Starting XI; 0 for Impact Sub until they enter.

### Batting
- 1pt/run, +1/four, +2/six
- Milestones: +4 (30), +8 (50), +16 (100)
- Duck penalty: -2 (batted, scored 0, got out)
- Strike rate bonus/penalty (min 10 balls faced):
  - SR ≥170: +6 | SR ≥150: +4 | SR ≥130: +2
  - SR <50: -6 | SR <60: -4 | SR <70: -2

### Bowling
- **25 pts/wicket** (not 20)
- +4 (3-fer), +8 (4-fer), +16 (5-fer)
- +8/Maiden
- +8 per LBW or Bowled dismissal
- Economy rate bonus/penalty (min 2 overs bowled):
  - ER <5: +6 | ER <6: +4 | ER <7: +2
  - ER >10: -6 | ER >9: -4 | ER >8: -2

### Fielding
- +8/catch, +4 bonus for 3+ catches in a match
- +12/stumping, +12/direct run-out, +6/indirect run-out

### Multipliers
- Captain: 2× | Vice Captain: 1.5×

## 🧬 Data Sync Integrity (v2.9.6 — Fixes for MI vs PBKS Crisis)

### 1. Batting vs Bowling Field Isolation
**Problem**: Both batting (Runs) and bowling (Runs Conceded) often use the key `r` or `runs` in API responses. In `autoFetchStats`, the bowling loop was overwriting the batting loop, causing a batter's runs (e.g., 19) to be misinterpreted as bowling overs (19.0), leading to massive ghost points.
**Fix**: 
- **Partitioned Fields**: Batting stats are now saved in Firestore using explicit prefixes: `bat_runs`, `bat_balls`, `bat_4s`, `bat_6s`, `bat_notOut`. 
- **Resilient Calculator**: `calcPoints()` was updated to prefer these prefixed fields (`s.bat_runs ?? s.runs`) while maintaining backward compatibility for legacy data.
- **Automatic Cleansing**: `autoFetchStats`, `parseScorecardText`, and `parseJsonScorecard` now explicitly nullify legacy fields (`runs`, `balls`, etc.) when saving, permanently clearing previous corruption from the match document.

### 2. Ultra-Strict Name Mapping (Identity Theft Fix)
**Problem**: The `robustMatch` fuzzy matcher was too aggressive, accidentally mapping **Arshdeep Singh's** points (92) onto **Shreyas Iyer**. It was matching common substrings (like "Singh") or noise words (like "de" in "de Kock") to incorrect players.
**Fix**:
- **Suffix Stripping**: Automatically removes `(c)`, `(wk)`, `(sub)`, `(impact)`, `batting`, `not out` before matching.
- **Meaningful Word Check**: Skips noise words (length ≤ 2). Requires **every** meaningful word in the API name to match a word in the pool name.
- **Exact Single-Word Guard**: If the API provides only one meaningful word, it must be an exact match (prevents generic surname collisions).
- **Parity**: This logic is now identical across `autoFetchStats`, `parseScorecardText`, and `parseJsonScorecard`.

### 3. Hardened Scorecard Text Parser (Captain/All-Rounder Fix)
**Problem**: When pasting manual scorecards, the parser misidentified Captains (who have `(c)` in their bowling row) as batting rows, skipping their bowling stats entirely.
**Fix**:
- **Numeric Fingerprint**: Uses numeric group counts to distinguish roles. Batting lines (R, B, 4s, 6s, SR) = **5 numbers**. Bowling lines (O, M, R, W, NB, WD) = **6 numbers**.
- **Refined Keyword Guard**: Specifically looks for the `"c [Fielder] b [Bowler]"` pattern for dismissals. Safely ignores `(c)` and `(wk)` player titles so all-rounders have both rows parsed correctly.

### 4. Safety Guards & Debugging
- **Overs Guard**: `toRealOvers()` has a hard cap: any value > 10.0 returns 0. This guard exists for **bowler overs only** (max 4 in IPL T20). Do NOT pass innings overs (which go up to 20) through `toRealOvers()` — it will return 0 and silently corrupt any calculation that depends on it.
- **Playoff Guard**: `applyBoosterChoice` now has an explicit code-level guard using `isPlayoffMatch(match)` to prevent booster usage during Finals/Qualifiers.
- **Console Exposure**: Key state variables (`activeMatches`, `currentMatchId`, etc.) and helper functions are now exposed to `window` for instant console debugging.
- **Resilient Scorebar**: Fallbacks to `scorecard` array if root `score` object is missing from CricAPI.

### 6. RRR / Balls-Left Calculation (v2.9.8 — "NEED 45 OFF 120 BALLS" Fix)
**Problem**: `renderScoreBar` called `toRealOvers(parseFloat(inn2Score?.o))` to get innings overs bowled. `toRealOvers` caps any value > 10 at 0 (its bowler-overs guard). At 15.2 overs, `toRealOvers` returned 0, so `ballsLeft = 120 - 0 = 120`. The RRR line showed `NEED N OFF 120 BALLS` for the entire 2nd innings beyond over 10.

**Fix**: Inline the overs-to-balls conversion in `renderScoreBar` — no call to `toRealOvers`:
```js
const _ovRaw = parseFloat(inn2Score?.o) || 0;
const _ovFull = Math.floor(_ovRaw);
const _ovBalls = Math.round((_ovRaw - _ovFull) * 10);
const ballsBowled = _ovFull * 6 + Math.min(_ovBalls, 6);
const ballsLeft = 120 - ballsBowled;
```

**Rule**: All other `toRealOvers` call sites operate on individual bowler overs (max 4) and are unaffected. Never pass innings-level overs through `toRealOvers`.

### 7. `autoFetchStats` Deep-Compare Mutation Bug (v2.9.8 — Final-Over Stats Drop Fix)
**Problem**: `playerStats` is the module-level variable set by `syncDerivedState()` as `playerStats = activeMatches[mid]?.stats` — a **live reference** to the same object as `activeMatchData.stats`. Inside `autoFetchStats`, when we do `playerStats[n] = { ...newStats }`, we simultaneously mutate `activeMatchData.stats[n]`. The deep compare then evaluates `activeMatchData.stats[n]` vs `statsUpdate["stats.n"]` — they are the same object, always equal. `isChanged` stays false for every `stats.*` key.

This was masked during active play because `score` / `matchStatus` / `overSummaries` keys change each poll and trigger `isChanged = true` through those fields. But at **end of innings** — score frozen (all out or 20 overs complete), status already written — none of those keys change either, `isChanged = false` for the entire update, and the AR poller silently skips the Firestore write. Stats from the final over never reach Firestore.

**Fix**: Skip the deep compare when player stats were actually processed:
```js
let isChanged = updated > 0; // stats updated → always write; mutation makes stats.* comparison unreliable
if (!isChanged) {
  for (const [key, newVal] of Object.entries(statsUpdate)) {
    if (key.startsWith("stats.")) continue; // skip — same-reference mutation makes these always-equal
    // ... compare score/matchStatus/overSummaries keys only
  }
}
```

**Second fix**: `stopAR()` was only reachable after the Firestore write. When the early return fired (`!isChanged && !showFeedback`), `stopAR()` was never reached — the AR poller kept running indefinitely after match end, burning quota. Fixed: `stopAR()` is now also called inside the early-return branch when `ended = true`.

**Rule**: Never add new deep-compare logic that covers `stats.*` keys by comparing against `activeMatchData.stats.*`. The reference is shared with `playerStats` and will always appear unchanged after processing. Either compare only non-stats keys, or gate on `updated > 0`.

### 8. CricAPI `matchEnded` Race Condition (v2.9.8)
**Observed**: CricAPI sets `matchEnded: true` and simultaneously returns an empty `scorecard: []` for a brief window after a match ends (the scorecard finalizes seconds to minutes after the ended flag). The previous code had `if (sc.length === 0 && !ended)` — the `!ended` guard meant an empty scorecard on a concluded match was silently ignored. `batAcc`/`bowlAcc` stayed empty, `updated = 0`, and player stats were never written on that poll.

**Fix**: When `sc.length === 0` AND `ended = true`, wait 8 seconds and re-fetch `match_scorecard` once. If the retry returns a populated scorecard, splice it into `sc` and continue processing normally. If retry also returns empty, log a warning and continue (stats from previous polls remain in Firestore).

**Rule**: Do not change the `!ended` guard back without also handling the retry — removing the guard without a retry just runs the `match_info` fallback which has no batting/bowling data and returns early, same net result.

### 5. CricAPI Multi-Team Inning Label Attribution (v2.9.7 — GT vs KKR Swap Fix)
**Problem**: CricAPI's `score[].inning` field is NOT a clean single-team label. It can return:
- Lowercase single-team: `"kolkata knight riders Inning 1"`
- **Multi-team concatenation**: `"Gujarat Titans,Kolkata Knight Riders Inning 1"` (the FIRST comma-segment is the batting team; the second is the bowling team).
- Both innings in a T20 may be labeled `"Inning 1"` (not `Inning 1` / `Inning 2` as intuition suggests). Do NOT use the trailing number as a disambiguator.

When `resolveTeamKey` ran word/substring checks on the full combined string, `KKR`/`KOLKATA` was checked before `GT`/`GUJARAT`, so the GT innings row was mis-attributed to KKR. The `scoreByTeam` map then had KKR overwriting itself with GT's score, and the unclaimed-fallback in `attributeScores` handed the leftover row (KKR's actual innings) to GT — producing **fully swapped scores** across the live scorebar and sticky score pill.

**Fix**: `resolveTeamKey` (first lines of the function, ~line 140) now splits on `[,&/]` or ` and ` **FIRST** and runs all subsequent word/substring checks against only the first segment. Single-team names are unaffected (split is a no-op). Multi-team labels resolve to the batting team correctly.

**Never do**:
- Do NOT reorder the word-check / substring-check blocks inside `resolveTeamKey` to "prefer" a team — ordering can't win against combined strings, and any re-order risks collateral regressions with other substring collisions.
- Do NOT remove the first-segment split — it is the only correct way to handle the multi-team label format. Upstream CricAPI behavior is not negotiable.
- Do NOT try to attribute scores purely by positional index (`scores[0]` → t1, `scores[1]` → t2). CricAPI orders `score[]` by **batting order**, not by t1/t2 order. Positional attribution will randomly swap the batting team's runs onto the bowling team's zone whenever t1 is the 2nd-innings team.

**Downstream helpers that depend on this working correctly** — do not bypass them:
- `resolveInningKey(inningRaw, match)` — the canonical inning-to-team-key resolver. Uses `resolveTeamKey` + t1/t2 substring + word-by-word fallback.
- `attributeScores(match, scores)` — builds the `{ teamKey: scoreEntry }` map used by `renderScoreBar` and the score pill. Includes unclaimed-fallback (if one team resolves, the other score must be the other team) and status-based anchor (`"<team> need N runs"` → batting team).
- `renderScoreBar(match)` — the live scorebar. Must call `attributeScores`; must NOT fall back to positional `scores[idx]` for live matches.
- `renderScorePill()` — sticky top pill. Same attribution rules.

**Regression test (mandatory before shipping any change in this area)**: Paste this CricAPI payload into the JSON scorecard parser and confirm:
- GT zone shows `181/5 (19.4)`
- KKR zone shows `180/10 (20.0)`
- Sticky pill shows `GT 181/5 (19.4)` vs `KKR 180/10 (20.0)` (NOT swapped)

```json
"score": [
  { "r": 180, "w": 10, "o": 20,   "inning": "kolkata knight riders Inning 1" },
  { "r": 181, "w": 5,  "o": 19.4, "inning": "Gujarat Titans,Kolkata Knight Riders Inning 1" }
]
```

If the swap reappears, the split-first logic in `resolveTeamKey` has been removed or bypassed. Restore it — do not patch around it elsewhere.

---

## ⚠️ Known Edge Cases & Critical Rules

- **API Lag**: Scorecard may delay 1-2 overs; admin must click "Start Match" manually at first ball.
- **Ghost Points**: `anyBallBowled` guard prevents pre-match stats from leaking before game starts.
- **Impact Swaps**: Handled automatically via `match_scorecard` poller status updates.
- **Overscroll on desktop**: `overscroll-behavior-y: none` MUST stay inside touch media query — global breaks desktop scroll.
- **XI Watcher feedback loop**: NEVER call `stopPreMatchXIWatcher()` from `onSnapshot` handler or from the guard inside `startPreMatchXIWatcher`. Only `poll()` calls it. Violating this causes rapid-fire API calls (4–15s apart) that drain quota.
- **Privacy Wall**: All scores hard-locked to `0 pts` until admin clicks "START MATCH" (`match.revealed: true`).
- **Fix Ishan button**: Removed — was a one-off hardcoded fix for Ishan Kishan catches, no longer needed.
- **RETRY NOW button**: Removed from member view in `renderStatsGrid` — was calling `autoFetchStats` on member click when `fantasyEnabled === false`. Admin-only operation has no place in member UI.
- **bstSelectTarget selector**: Must query `.bst-target-item, .bst-team-card` (both selectors). Querying `.bst-target-item` only means team card taps never register. Fixed in v2.9.
- **Booster reveal gate is `match.locked`, not `match.finalized`**: All reveal logic (`bstTotalBadge`, `bstChipForPlayer` in lb-card, `boosterStatusHtml` in my-team-card) uses `match.locked`. `renderMyTeamCard` passes `true` to `bstChipForPlayer` (owner always sees own booster in full). Do NOT revert these to `match.finalized`.
- **No pulsing secret dot**: The `.lb-bst-active` pulsing dot (was shown during live match to hint a booster exists) has been removed. The full booster is revealed at lock, so there is nothing to hint at secretly. CSS class remains in the stylesheet but is unused.
- **Points are 25pt/wkt not 20pt/wkt**: The code has always used 25. Do not change this — members' season totals are built on it.
- **Booster inventory race condition**: Inventory read/write happens at team save time via fresh `getDoc`. If two saves fire simultaneously (unlikely with single-user sessions), the second write wins. Acceptable for a 25-member private league.
- **`switchAdminTab` must NOT call `refreshView()`**: Rebuilding the full screen on every tab click invalidates all compositor layers simultaneously — causes Android flicker. Surgical swap of `#admin-tab-content` only.
- **`window.scrollTo` must be desktop-only in tab switches**: Instant scroll-to-top on Android forces the Chrome address bar to reappear, collapsing the viewport height in one frame — this is the "bottom screen flicker". Always gate with `(hover: hover) and (pointer: fine)`.
- **Admin standings `memberMatchTotal` must pass `getPlayers(activeMid)`**: Without the explicit playersList, team booster calculations fall back to global `matchPlayers` which may be stale if admin has multiple matches loaded.
- **`contain: paint layout` must NOT be on `#admin-body`**: Creates double-promotion with `transform: translateZ(0)` — Android Chrome re-rasterises the entire paint box on every `:active` tap. Member body never had this, so member taps never flickered. Do not re-add `contain` here.
- **`contain: paint` clips `position: absolute` children**: `contain: paint` clips absolutely-positioned children to the element's border-box. Fine for the current layout but a hidden footgun for any future overlay inside `#admin-body`.
- **Inline onclick functions must be on `window`**: All functions called from `onclick="..."` attributes in admin tab HTML strings must be assigned to `window`. Closures in module scope are not reachable from inline handlers. The `window.admin*` wrapper block before `renderMatchList` is the canonical place.
- **`bindAdmin` slim must be maintained**: `bindAdmin(true)` is called on every tab switch. Any non-async, non-dynamic binding added back to `bindAdmin` reintroduces the binding gap. New buttons should use inline onclick, not `bindAdmin` wiring.
- **`#finalizeBtn`, `#nukeBtn`, `#saveAllStatsBtn` ids must stay**: These functions self-disable by `getElementById` during async operations. Even though onclick is inline, the id attributes must coexist on the same button element.
- **`_cricFetch` returns a raw Response — always chain `.then(r => r.json())`**: Every call to `_cricFetch` must call `.json()` on the result. `autoFetchStats` previously skipped this, making all `scData.data` accesses return `undefined` silently.
- **Toast element must stay outside `#appRoot`**: `#appRoot` has `transform: translateZ(0)` which breaks `position: fixed` for any child. The `<div id="toast">` must be a direct child of `<body>`, placed after `</div>` closing `#appRoot`. Do not move it inside any transformed ancestor.
- **`match_scorecard` failure ≠ match not live**: CricAPI can return "match scorecard not found" while the match is actively in progress (`matchStarted: true`). This happens when `fantasyEnabled: false`. Always fall back to `match_info` for score/status rather than treating it as a hard error. Scorecard becomes available automatically — do not add retry logic that bypasses the normal poller.
- **`resolveTeamKey` MUST split on `[,&/]` and ` and ` FIRST**: CricAPI returns multi-team inning labels like `"Gujarat Titans,Kolkata Knight Riders Inning 1"` where the first comma-segment is the batting team. Without the split, `KOLKATA` is matched before `GUJARAT` and both scorebar/pill show swapped team scores (GT vs KKR production bug). Never reorder the team checks inside `resolveTeamKey` to "prefer" a team — that doesn't fix combined strings and risks other regressions. Never attribute `scores[]` positionally for live matches; CricAPI orders by batting order, not t1/t2 order.
- **CricAPI inning labels are unreliable**: Can be lowercase (`"kolkata knight riders Inning 1"`), combined (`"Gujarat Titans,Kolkata Knight Riders Inning 1"`), and BOTH T20 innings may be labeled `Inning 1` (do not use the trailing number to disambiguate 1st vs 2nd innings). Always route inning resolution through `resolveInningKey(inningRaw, match)` and score attribution through `attributeScores(match, scores)` — these helpers compose correctly; bypassing them reintroduces the swap bug.
- **`toRealOvers` is for bowler overs only — never pass innings overs**: `toRealOvers` has a `> 10 → return 0` guard for bowler safety. Innings overs go up to 20 and will return 0. Any calculation using innings overs (balls bowled, balls left, phase boundaries) must inline the math: `full = Math.floor(ov); balls = Math.round((ov - full) * 10); realBalls = full * 6 + Math.min(balls, 6)`.
- **`playerStats` is a live reference — deep compare on `stats.*` keys is always false**: `playerStats === activeMatchData.stats`. After `playerStats[n] = newObj`, the deep compare sees `activeMatchData.stats[n] === statsUpdate["stats.n"]` and finds no change. Do not add any deep-compare logic covering `stats.*` keys. The write guard in `autoFetchStats` must use `updated > 0` as the authoritative signal.
- **`s1.w === 10` all-out check uses `parseInt`**: `s1.w` from CricAPI may be a string. The `attributeScores` fail-safe uses `parseInt(s1.w) === 10` to detect all-out innings. Do not change back to strict `===` without verifying CricAPI always returns a number type.
- **CricAPI sets `matchEnded: true` before scorecard is fully populated**: Empty `scorecard: []` with `matchEnded: true` is a normal transient state handled by the 8s retry. A populated-but-stale scorecard with `matchEnded: true` is also normal — handled by the 60s grace poll in `_handleMatchEnd`. Never call `stopAR()` directly on `ended` detection; always call `_handleMatchEnd(activeMid)`.
- **CricAPI scorecard lags 1-2 overs during live play**: Not fixable in code. Use the "Fetch Now" button manually in the final 2 overs to minimise lag. The grace poll rescues post-match final stats; in-match lag is a CricAPI limitation.
- **`getTeamColor` must always exist** (restored v2.9.9): Called by `injectTeamAmbient` at the top of every `_doRefresh()` tick. If deleted, `_doRefresh` throws a silent `TypeError` inside `setTimeout` and the app stays on Loading forever. Lives between `resolveTeamKey` and `resolveInningKey`.
- **`showScreen` rAF is wrapped in try-catch** (v2.9.9): `app.style.opacity = "0"` is set synchronously before the rAF. If the render function throws without try-catch, opacity stays 0 and the app is invisible. The try-catch falls back to `renderLoading()`. Do not remove the try-catch — without it a single bad render leaves users with a blank screen.
- **Never use `?.split("vs")[n]` for label parsing** (v2.9.9): Optional chaining on `.split()` protects the call but NOT the index access — `undefined[0]` throws. Always use `(value || "").split(/\s+vs\s+/i)[n]`. This is the consistent pattern across `renderScorePill`, `attributeScores`, `resolveInningKey`, and both fixed sites.
- **Every `skipNextRefresh = true` site must have a catch reset** (v2.9.9): On write success the flag is consumed by the next `matches` snapshot. On write failure no snapshot fires, so the catch block must `skipNextRefresh = false` immediately. Missing this causes one silent skipped refresh after every failed save.
- **`sessionClear()` must clear `prevScores` and `_pvMatchCache`** (v2.9.9): Both objects accumulate entries across matches and survive logout in-tab. Clear them in `sessionClear()` after `matchUnsubs = {}`. Missing this causes stale memory growth on iOS and stale pitch overlay data after re-login.
- **Inline onclick `pillId` / `safeN` must strip all special characters**: Use `/[^a-zA-Z0-9_-]/g`, not `/\s+/g`. Apostrophes and quotes in player/member names (e.g. `D'Souza`) break `getElementById('...')` inline JS string delimiters. Any string interpolated inside a single-quoted `onclick` attribute must be fully sanitized. Both `mpills-` (member scorecard, line ~2675) and `ampills-` (admin scorecard, line ~5947) must use this pattern — the admin one was patched in v3.0.0 after being missed in the original fix.
