---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "2.9.7"
project: ipl-ssmb-fantasy-league
stack: "HTML5/ES6+, Firebase (Firestore/Auth), CricAPI (CricketData.org), CSS3 (Modern Glassmorphism)"
---

# IPL Fantasy League v2.9 — Project Intelligence

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

## 📡 CricAPI Endpoints Used
| Endpoint | When called | Purpose |
|---|---|---|
| `currentMatches` | Admin "Find IPL Matches" + smoke test | Discover live/upcoming match IDs |
| `series` | Admin series search | Search by series name |
| `series_info` | Admin series search | Full match list for a series |
| `match_info` | "Load Players" button | Team info + player roles |
| `match_squad` | Fallback if `match_info.teamInfo` empty | Raw squad names |
| `match_scorecard` | `autoFetchStats()` — every poll cycle | Live stats, toss, XI, score — primary endpoint |
| `match_info` (2nd) | Inside `autoFetchStats`, when scorecard returns failure | Score + status + XI fallback (no batting/bowling stats) |

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
- **Overs Guard**: `toRealOvers()` now includes a hard limit for T20. Any value > 10.0 (e.g., a misinterpreted batting score of 35) is reset to 0.0.
- **Playoff Guard**: `applyBoosterChoice` now has an explicit code-level guard using `isPlayoffMatch(match)` to prevent booster usage during Finals/Qualifiers.
- **Console Exposure**: Key state variables (`activeMatches`, `currentMatchId`, etc.) and helper functions are now exposed to `window` for instant console debugging.
- **Resilient Scorebar**: Fallbacks to `scorecard` array if root `score` object is missing from CricAPI.

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
