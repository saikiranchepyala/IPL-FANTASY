---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "2.5"
project: ipl-ssmb-fantasy-league
stack: "html, firebase, firestore, netlify, cricapi"
updated: "2026-04-11"
---

# IPL Fantasy League App — Claude Skill

## Project Identity
- **App**: Private IPL Fantasy League web app for ~12 friends
- **URL**: https://dancing-chimera-1a8fb5.netlify.app
- **Join code**: ULBF7G
- **Stack**: Single HTML file → Firebase Firestore → Netlify
- **Firebase project**: ipl-ssmb-fantasy-league
- **CricAPI key**: e2ecd022-a7a9-4855-a6c3-386ea4e83786 (S plan, 2000 calls/day)
- **Working file**: `C:\Users\shash\Downloads\ipl-fantasy-v4_render.html` (~13,000+ lines)

---

## Architecture
Single HTML file. All JS, CSS, HTML in one file. No backend.
Browser → Firebase Firestore (real-time onSnapshot) + CricAPI (stats)

### Firestore Structure
```
/meta/game          — currentMatchId, activeMatchIds[], adminPin, joinCode, cricApiKey, adminProfile, cachedIntlSeriesIds[]
/meta/members       — { name: { pin, teamName, joinedAt } }
/matches/{matchId}  — { label, t1, t2, t1img, t2img, matchNum, isIPL, matchType, players[], stats:{}, teams:{}, revealed, locked, finalized, liveMatchId, playerStatus:{}, fantasyEnabled, score[], matchStatus, matchResult, currentBatsmen[], currentBowler }
/season/totals      — { memberName: { total, matches:[{matchId,label,pts}] } }
```

### Key State Variables
```javascript
let session = { name, isAdmin }        // persisted to localStorage
let localTeam = { players[], captain, vc }
let activeMatches = {}                 // { [matchId]: { match, players, stats, teams } }
let adminSelectedMatchId               // which match tab admin is viewing
let memberSelectedMatchId              // which match member is viewing
let playerStatus = {}                  // { playerName: 'playing'|'notplaying'|'impact' }
let curRole, curSearch                 // persist across re-renders
let _matchType = 'ipl'                 // 'ipl'|'international'|'domestic'
```

### Key Functions
- `getActiveMid()` — returns admin or member selected match ID
- `getMatch(mid)` / `getTeams(mid)` / `getStats(mid)` / `getPlayers(mid)` — read from activeMatches
- `syncDerivedState()` — syncs currentMatch, matchPlayers, playerStats, allTeams from activeMatches
- `showScreen(n)` — router: loading/login/join/member/admin
- `refreshView()` — called by onSnapshot listeners
- `reRender()` — member picker re-render, preserves scroll position via window.scrollY
- `calcPoints(s)` — points calculator
- `memberMatchTotal(team, stats)` — total pts for a member
- `autoFetchStats(showFeedback)` — polls CricAPI scorecard, writes to Firestore
- `startAR(secs)` / `stopAR()` — auto-refresh interval, fires autoFetchStats immediately on start
- `robustMatch(raw)` — fuzzy name matching: exact → contains → initials+last → last name

---

## Match Types
- **🏏 IPL**: strict `indian premier league` filter, max 4 overseas, role limits apply
- **🌍 International**: bilateral/ICC, no overseas cap, no role limits
- **🏟️ Domestic**: Plunket Shield/Ranji etc, no caps

---

## Admin Flow
1. Find & Select Match → CricAPI `match_squad` auto-loads players + t1img/t2img flags
2. Members pick teams (open phase) — editable freely
3. **🥁 Toss Done** → revealed:true, auto-fetches playing XI from `match_info`, marks 🟢🔴🔵
4. Members can still edit until lock
5. **🔒 Lock Teams** → locked:true, team editor closes for all members
6. **Start Match** button → sets revealed:true + locked:true, starts auto-refresh
7. Auto-fetch scorecard every N mins from `match_scorecard` (IPL only)
8. **✅ Finalize** → saves to season/totals, sets finalized:true

---

## Member Flow
1. Login with name + 4-digit PIN (session saved to localStorage)
2. Select match tab (if multiple active)
3. Pick 11 players within 100CR budget, set C (2×) and VC (1.5×)
4. Save Team — re-saveable until locked
5. After toss → Live Scores shows all teams immediately
6. After finalize → history viewable from Season Table

---

## Rules & Constraints
- **Budget**: 100CR per team
- **Max per IPL team**: 6 players
- **Max overseas (IPL only)**: 4
- **Role limits (IPL only)**:
  - WK: min 1, max 4
  - BAT: min 3, max 6
  - AR: min 2, max 4
  - BOWL: min 3, max 6

---

## Points System
**Batting**
- 1pt/run, 1pt/four, 2pts/six
- 30+: +4, 50+: +8, 100+: +16
- Duck (batted + 0 runs + dismissed): -2
- SR bonus (min 10 balls): 170+:+6, 150+:+4, 130+:+2
- SR penalty: <70:-2, <60:-4, <50:-6

**Bowling**
- 25pts/wicket
- 3wkts:+4, 4wkts:+8, 5wkts:+16
- LBW/Bowled: +8 each
- Maiden: +8
- Economy bonus (min 2 overs): <5:+6, <6:+4, <7:+2
- Economy penalty: >8:-2, >9:-4, >10:-6

**Fielding**
- Catch: +8, 3+ catches: +4 bonus
- Run out direct: +12, indirect: +6
- Stumping: +12

**Bonus**
- Playing XI: +4 (isImpact sub: +2)
- Captain: 2× total points
- Vice-Captain: 1.5× total points
- Starting team total (9×4 + VC×4×1.5 + C×4×2) = **50 pts**

---

## autoFetchStats — Critical Behavior
- Polls `/v1/match_scorecard`
- **`anyBallBowled` guard**: if `matchStarted:false` AND no batsman has `b > 0`, returns early — prevents pre-match processing
- **Per-entry 0-ball guard**: skips batting entries where `balls=0 && runs=0 && !dismissed` — prevents ghost stats for pre-populated lineup entries
- **`playingXI: true`** only granted when player actually bats/bowls/fields OR admin sets status dropdown to Playing
- **Lineup poller** (`startAutomatedFetch`) sets `stats.${p.name}.playingXI = isStarter` for all announced XI at toss time — this creates the 50pt base
- **Self-heal block REMOVED** — never add back. Was `if (scData.status === "success" && activeMatchData.fantasyEnabled === false) { updateDoc(..., { fantasyEnabled: true }) }`. Caused ghost Firestore writes → onSnapshot → re-render at match start.
- Falls back to `match_info` for score/status when scorecard unavailable
- `fantasyEnabled` is ignored as a gate — just process what the API returns. Manual paste parser always available as fallback.

---

## Ghost Points Bug (PBKS vs SRH M17, April 2026) — FIXED
**What happened**: Abhishek Sharma, Shreyas Iyer, Shivang Kumar got ghost stats at match start.

**Root cause**:
1. Match was selected when CricAPI had `fantasyEnabled:false` → stored in Firestore
2. Admin revealed teams → `startAR()` → `autoFetchStats()` fires immediately
3. Self-heal block detected `fantasyEnabled:false` in Firestore but scorecard returned success → wrote `fantasyEnabled:true` to Firestore → onSnapshot triggered re-render
4. Scorecard processed with no 0-ball guard → CricAPI's pre-populated batting array (all 11 players shown as `0* 0b`) → `batted:true` written for non-batting players

**Fix**: Removed self-heal block entirely. Added `anyBallBowled` guard. Added per-entry 0-ball skip.

---

## CricAPI Endpoints Used
```
/v1/currentMatches   — live + recent (48hr window, cache:1 issue, retry 1-2 mins)
/v1/series_info      — full fixture list (use max 2-3x/day)
/v1/series           — search series by name
/v1/match_squad      — full squad (works pre-match)
/v1/match_info       — toss details, playing XI (used at reveal)
/v1/match_scorecard  — live innings data (IPL: works when fantasyEnabled:true)
```

### API Behaviour
- `fantasyEnabled` is an indicator, not a gate — app ignores it now
- IPL: flips to true on match day when data flow starts (can take a few balls)
- International: inconsistent coverage per match
- `currentMatches` can return empty with `cache:1` — retry after 1-2 mins
- Series IDs cached in Firebase (`cachedIntlSeriesIds`) to survive 48hr window

### Known Series IDs
```
IPL 2026:            87c62aac-bc3c-4738-ab93-19da0690488f
NZ vs SA 2026:       30845b53-91bc-4dbe-9e91-01319213e61f
NZ Women vs SA Women:aad7eded-4b56-498f-aae1-04cf4b839fc0
```

### IPL 2026 Match IDs
```
RCB vs SRH (M1):   55fe0f15-6eb0-4ad5-835b-5564be4f6a21
MI vs KKR (M2):    e02475c1-8f9a-4915-a9e8-d4dbc3441c96
RR vs CSK (M3):    d788e9f9-99bf-4650-a035-92a7e21b3d08
PBKS vs GT (M4):   11ff7db9-9c71-464e-afcb-5b03e4fa4b0a
LSG vs DC (M5):    ae676d7c-3082-489c-96c5-5620f393c900
KKR vs SRH (M6):   fd010e39-2255-4460-b0e0-962a26b67b70
CSK vs PBKS (M7):  96d2aa6b-ea40-4da4-b4cf-eb996de24ef7
DC vs MI (M8):     736f3e02-212a-49bc-8b3b-08a106312702
GT vs RR (M9):     ea4d01bf-bf47-4f7d-a4f8-32eade678141
SRH vs LSG (M10):  e43dd29e-c60e-40c9-a6c4-6c1bd69dd671
RCB vs CSK (M11):  e92727d0-61fc-4c6f-82ed-cde4789745a2
KKR vs PBKS (M12): adeebb28-bc39-439b-99ed-2daef5106232
RR vs MI (M13):    4f617f5e-c635-4989-b135-5430dc73c5d7
DC vs GT (M14):    12496498-8526-46d9-a053-da2ba8d047e1
KKR vs LSG (M15):  c78dcc8a-67cf-460a-8f2b-8f16d3891682
RR vs RCB (M16):   3ec1f721-7f79-49e3-bbc1-69e88b9cf4a3 (Fantasy: False)
PBKS vs SRH (M17): a4cd9851-d79a-42b6-8a4b-b35cbb9f9f0a
CSK vs DC (M18):   204afd0a-026a-41f4-afda-653030a84e46
LSG vs GT (M19):   36d875e2-3333-4fab-ba4d-4f89fb4d7055
MI vs RCB (M20):   11d553de-3b2a-4e58-9abd-4bb7d575595e
```

---

## IPL Team Colors
```javascript
const IPL_TEAM_COLORS = {
  'RCB':  { primary:'#cc0000', secondary:'#f59e0b' },
  'MI':   { primary:'#004ba0', secondary:'#00d4ff' },
  'CSK':  { primary:'#f5a623', secondary:'#1a1a2e' },
  'KKR':  { primary:'#3a0ca3', secondary:'#f59e0b' },
  'SRH':  { primary:'#ff6b00', secondary:'#1a1a2e' },
  'RR':   { primary:'#ff69b4', secondary:'#1e3a5f' },
  'DC':   { primary:'#0066cc', secondary:'#cc0000' },
  'PBKS': { primary:'#cc0000', secondary:'#c0c0c0' },
  'LSG':  { primary:'#00bfff', secondary:'#f59e0b' },
  'GT':   { primary:'#1c4a9f', secondary:'#f59e0b' },
};
```

---

## UI / Visual Design System
- **Style**: IPL Broadcast × Glassmorphism hybrid, dark navy base
- **Fonts**: Bebas Neue (display scores), Barlow Condensed (UI labels), Barlow (body), DM Mono (numbers)
- **Colors**: `--bg:#040810`, `--accent:#2563ff`, `--gold:#f59e0b`
- **16 themes** — all require opaque `--card-bg` (dark fills, not rgba(255,255,255,.09))
  - Full list: `titanium-gold`, `electric-ahmedabad`, `plum-noir`, `midnight`, `dracula`, `github-dimmed`, `monokai-pro`, `sakura-night`, `retro-terminal`, `emerald-pitch`, `solar-flare`, `aurora-borealis`, `royal-bengal`, `volcanic-obsidian`, `deep-cosmos`, `bronze-circuit`
  - Gate: `VALID_THEMES` array (~line 13268) — adding a theme CSS block is not enough, name must be in this array too
  - Removed: `cyber-marine`, `stellar-glass`, `pearl-light`, `sand-court` (eye strain)
- **Aurora background**: radial gradients + aura blobs (`.aura-blob { filter: blur(60px) }`) — stripped on mobile
- **Glass**: `backdrop-filter:blur(20px)` on sticky nav/score-pill only; stripped everywhere else on mobile

### Score Bar (`.csb-*`) — Live match widget
- Two team zones side by side, team-color gradient background on batting team
- Big score (`hsc-big-score`) renders in **team color** with glow via `text-shadow`
- Current batsmen section: both shown equally (no striker/non-striker visual distinction — that feature was removed)
- Bowler box: red left-accent strip (`border-left: 3px solid rgba(239,68,68,.5)`), figures in red

### Player Stat Cards (`_buildPlayerStatCards`, `.stat-card`, `.sc-*`)
- **Role-colored left border**: BAT=#60a5fa (blue), BOWL=#f87171 (red), AR=#fbbf24 (amber), WK=#c084fc (purple)
- **Stats as chips** (not text lines): `.mstat-chip-bat` (blue), `.mstat-chip-bowl` (red), `.mstat-chip-field` (purple)
- **Points display**: `.sc-pts-on` wrapper with `.sc-pts-num` (28px gradient gold) + `.sc-pts-unit` ("pts" label)
- **Admin save handler** at line ~5263 must use `sc-pts-num` / `sc-pts-unit` format (not old `<span>${pts}</span> pts`)

### Match Summary Scorecard (`.hsc-*`) — History/innings view
- Innings block: left border in team color, big score in team color with glow
- Batting rows: runs color-coded (`.hsc-r-warm/fifty/ton/duck`) — **no milestone badges** (★ and 💯 removed, `milestoneBadge()` returns `''`)
- Bowling rows: 3W/5W haul badges inline, wickets column orange on haul
- Duck rows: 60% opacity

---

## Performance (Mobile/iOS/Android)
### `@media (max-width: 768px)`
- Aura blob blur removed entirely (`filter: none`) — was blur(60px), massive GPU cost
- ALL `backdrop-filter` stripped via `*:not(.score-pill)` selector — was only stripping a named list
- `contain: layout style` on all cards — browser skips off-screen layout
- `overscroll-behavior: contain` on scrollable areas

### `@media (hover:none) and (pointer:coarse)` — touch devices
- Global `-webkit-tap-highlight-color: transparent`
- Button/tab transitions cut to 80ms
- Gradient text (`-webkit-text-fill-color: transparent`) disabled — forces GPU layer promotion
- Score bar gets `transform: translateZ(0)` for own compositor layer
- `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch` on scroll containers

### JS
- Stat card stagger: `15ms × i, max 120ms` (was 25ms/300ms)
- Card entrance animation: 180ms (was 250ms), translateY 4px (was 6px)
- `overscroll-behavior: contain` on `.stats-grid`
- `triggerCountUp` stagger: 30ms if >8 items, 50ms otherwise; 600ms animation per counter
- `_buildPlayerStatCards(animate: false)` — history view emits final values directly, no `data-count-up` attrs; prevents 20+ simultaneous RAF loops freezing Android

### Cross-Platform Mobile Optimizations (v2.4 audit)
**CSS `@media (max-width: 768px)` additions:**
- `livePulse`, `playingPulse`, `neonPulse`, `impactPulse` animations explicitly killed on elements that use them (`.sp-badge-live`, `[class*="playing-badge"]`, `.pv2-striker-dot`, `.pv2-bowler-dot`, `[style*="livePulse"]` etc.) — these animate box-shadow on every player card
- `[style*="animation"] { animation-iteration-count: 1 !important }` — catches inline-style animations that override class-level kills
- `.score-pill` blur reduced 16px → 8px on mobile — sticky + full backdrop-filter causes iOS scroll stutter
- `.theme-dropdown` backdrop-filter stripped + opaque fallback background
- Modal/overlay box-shadows flattened: `0 4px 16px rgba(0,0,0,.5)`
- `.csb-big-score`, `.hsc-big-score` text-shadows flattened to `0 1px 3px rgba(0,0,0,.5)`
- `.subs-list` added to `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch`
- `.pool-chips` added to touch scroll rules
- Duplicate `@media (max-width: 768px)` block (was at bottom of file) removed

**JS fixes:**
- `window.addEventListener('resize', ...)` for stadium canvas made `{ passive: true }` — non-passive listeners can block scroll
- `.topnav` `will-change: transform` removed — `will-change: transform` on a `position: sticky` element silently breaks stickiness on iOS Safari (creates new stacking context that interferes with sticky tracking)

### Admin Tab Bar (Mobile Fix)
- Root cause of tab inconsistency: overflow-x scroll on `.view-tabs` conflicted with tap events on Android
- Fix: `@media (max-width: 600px)` makes `.view-tabs { flex-wrap: wrap; overflow-x: visible }` — all 5 tabs render in 2 rows, no scrolling needed
- `.vtab` base style has `touch-action: manipulation; -webkit-tap-highlight-color: transparent` — eliminates 300ms delay
- `switchAdminTab` has `_switchAdminTabBusy` debounce guard (400ms) — prevents double-tap or scroll-then-tap firing two re-renders
- `.vtab.active { animation: none !important }` on mobile — kills glowPulse repaint during touch

### Tab Switch Scroll Fix
- `window.switchTab` now calls `window.scrollTo({ top: 0, behavior: "instant" })` before re-rendering — prevents viewport jumping when switching between My Team → Live Scores on Android
- `.csb-team-zone` transition narrowed from `transition: all 0.3s ease` → `transition: border-color 0.3s ease, background 0.3s ease` — `transition: all` was animating height/position from browser defaults on first DOM insertion causing the live banner to visibly move
- Touch device override: `.csb-team-zone { transition: none !important }` under `@media (hover:none) and (pointer:coarse)`

### parseJsonScorecard — Manual JSON Paste Fallback
- Implemented `window.parseJsonScorecard()` (was missing — button existed but function was undefined)
- Button in CricAPI card: "Parse JSON Scorecard" → reads from `#pasteJsonScorecardBox` textarea
- Accepts full API envelope (`{ data: { ... } }`) or bare payload
- Same parsing logic as `autoFetchStats`: `robustMatch`/`nl` lookup, batting/bowling/catching accumulation, 0-ball guard
- Writes `score[]`, `matchStatus`, and per-player stats to Firestore on success
- Clears textarea and refreshes stats grid after successful write
- Use when: auto-fetch lags, `fantasyEnabled:false`, or CricAPI is slow to update

### finalizeMatch Rewrite (Consistency Fix)
- Fresh Firestore fetch: `Promise.all([getDoc(matches/activeMid), getDoc(season/totals)])` replaces stale `activeMatches` cache — eliminates stale-data writes
- `skipNextRefresh = true` set before writes, released after — blocks intermediate `onSnapshot` re-renders while writes are in-flight
- Double-finalize guard uses fresh Firestore data (not in-memory) — `if (freshMatch.finalized && !confirm(...))` 
- `adminSelectedMatchId = remaining[0] || null` reset synchronously after writes — next `refreshView()` shows clean state
- Catch block includes `skipNextRefresh = false` — ensures `onSnapshot` refreshes are not permanently blocked if finalization throws an error

---

## Critical Bug Fixes — NEVER REVERT THESE
1. `renderMyTeamCard(myTeam, viewMatch)` — not currentMatch
2. `bindAvailSelects()` called on stats tab initial load
3. `noMatch` uses `activeMid` not `currentMatchId`
4. `renderLiveTab` uses `liveMatch/liveMid` not currentMatch
5. C/VC dropdowns call `reRender()` — not `getElementById('xiChips').innerHTML`
6. `nukeEverything` wipes `activeMatchIds:[]`, `cachedIntlSeriesIds:[]`, calls `deleteDoc`
7. `--cyan` replaced with explicit `#00d4ff`
8. Role limits guarded by `isIPLMatch()` — no role caps for international
9. FOREIGN tag guarded by `isIPLMatch()` — no tag for international
10. `handleLockTeam` saves to `saveMid = memberSelectedMatchId || currentMatchId`
11. `memberSelectedMatchId` set on login, saved to localStorage
12. `playerStatus = {}` cleared on match switch (both admin and member)
13. `removeActiveMatch` validates mid exists before removing
14. `autoFetchStats` uses only `activeMatchData.liveMatchId` — no currentMatch fallback
15. `renderAdminStats` uses `getActiveMid()` not `currentMatchId`
16. `bindCards` and role summary both use local `pool` not global `matchPlayers`
17. `reRender()` preserves scroll via `window.scrollY`
18. `matchType` saved in `renderMatchList` setDoc
19. Session persisted to localStorage, cleared on logout
20. `bindMember` checks `_viewMid/_viewMatch` not `currentMatch` for lock state
21. Auto-lock fires on first scorecard hit
22. Super over stats accumulated not overwritten
23. `altnames[]` indexed in player name lookup
24. `.trim()` on all raw API name extractions
25. Exact name match before fuzzy in playing XI detection
26. Double-finalize guard — hard stop if `match.finalized` already true
27. Shared surnames (Singh/Sharma) use exact-only matching for playing XI dots
28. Role mapRole() covers all bowling style strings: "Left-arm orthodox", "Leg Break" etc → BOWL
29. **Self-heal block removed** — never add `if (scData.status==="success" && fantasyEnabled===false) updateDoc(fantasyEnabled:true)` back
30. **0-ball batting guard** — always skip entries with `balls=0 && runs=0 && !dismissed`
31. **`anyBallBowled` guard** — don't process scorecard if no batsman has `b > 0` and `matchStarted:false`
32. **Admin pts save handler** — must write `<span class="sc-pts-num">${pts}</span><span class="sc-pts-unit">pts</span>` not old `<span>${pts}</span> pts`
33. **Admin tab mobile** — `_switchAdminTabBusy` guard must stay in `switchAdminTab`; removing it re-introduces double-render bug on Android tap
34. **VALID_THEMES** — every theme CSS block must have a matching entry in the `VALID_THEMES` array; `setDashboardTheme` silently bails if name not in list
35. **`milestoneBadge` removed** — function now returns `''`; do not restore ★/💯 badges, they were confusing on scorecards
36. **Admin match tab is 2-col** — uses `.admin-2col` (320px + 1fr); do not add a third `.acol` back; Submissions card lives inside COL2 after the CricAPI card
37. **Submissions sort order** — `ranked` sorted submitted-first then alphabetical; rank medals (🥇🥈🥉) removed; do not restore points-based sort here
38. **Tab switch scroll** — `window.switchTab` must call `window.scrollTo({ top: 0, behavior: "instant" })` before rendering; do not remove or change to smooth — causes Android viewport jump
39. **`.csb-team-zone` transition** — must be `border-color 0.3s ease, background 0.3s ease` (not `all 0.3s ease`); `transition:all` animates height/position on first DOM insert causing live banner to move on mobile
40. **`finalizeMatch` catch block** — must include `skipNextRefresh = false`; without it, any error during finalization permanently blocks all `onSnapshot` refreshes until page reload
41. **`parseJsonScorecard` function** — defined as `window.parseJsonScorecard`; do not remove — button at line ~3586 calls it directly via `onclick`; was previously missing causing uncaught ReferenceError on click
42. **`parseSquadList` header stripping** — when a comma-separated line has a team prefix (e.g. "LSG Impact Subs - Name1, Name2"), strip the prefix before splitting on commas; without this, first player is unmatched because the clean string includes the prefix
43. **`nearMatch()` in `parseSquadList`** — 1-char edit-distance function catches spelling variants (Ahmad↔Ahmed, Sharman↔Sharma); do not remove — required for fuzzy squad paste matching
44. **`addPlayerManually` skipNextRefresh guard** — `skipNextRefresh = true` must be inside a try/catch with `skipNextRefresh = false` in the catch; without it, any Firestore error permanently blocks all onSnapshot refreshes
45. **All async write functions need try/catch** — `removePlayer`, `clearPool`, `removeActiveMatch`, `createOrUpdateMatch`, `setStrikerOverride`, `bindAvailSelects` change handler, role-change handler inside `addPlayerManually` — all must have try/catch so user sees the error toast and state is not left dangling
46. **`abandonMatch` uses fresh Firestore fetch** — same as `finalizeMatch`: reads from `getDoc(matches/activeMid)` + `getDoc(season/totals)` inside `Promise.all`; also has `skipNextRefresh = true/false` guard; do not revert to stale `getTeams()`/`getMatch()` cache

---

## Features Status
### Implemented ✅
- Multi-match tabs (admin + member)
- 3-way match type (IPL/International/Domestic)
- Fresh team per match (no transfers)
- Session persistence (localStorage)
- Playing XI auto-detection at toss
- Auto-fetch stats + auto-lock on first scorecard hit
- Fuzzy name matching (overseas + credits)
- Team flags from API
- Match history modal (Season Table → click match pill)
- Podium animations + winner banner
- NOT OUT (*) indicator
- ✈ overseas in chips and XI panel
- Availability dots with glow + impact pulse
- nukeEverything (keeps members)
- Admin player profile
- Export CSV
- Mobile responsive + performance-optimized for iOS/Android
- Role-colored stat cards with chip-style stats
- Live score bar with team-colored scores + bowler strip
- Match Control panel redesigned: dot-line phase tracker, phase badge, grouped action buttons, `<details>` danger zone (`.mc-card`, `.mc-track`, `.mc-dot`, `.mc-node-*`, `.mc-lbl`)
- Admin sections condensed: `.pool-chips` scroll-capped (148px), `.mrow`/`.aa-row` tighter padding, `#finalizedMatchesList` scroll-capped (120px)
- 16 themes (added volcanic-obsidian, deep-cosmos, bronze-circuit)
- **Admin match tab restructured to 2-column layout** (was 3-col): COL1=Match Setup+Control (320px), COL2=CricAPI+Players → Submissions → Leaderboard stacked; collapses to 1-col at 900px
- **Submissions card** sits in COL2 below CricAPI, scroll-capped at 240px; sorted submitted (✓) first then pending (–) with a "PENDING" divider; rank medals removed

### Removed ❌
- Transfer system (fresh pick per match instead)
- Bulk paste players
- Striker/non-striker visual highlight (was unreliable)
- Self-heal block for fantasyEnabled (caused ghost points)
- Milestone badges on batting rows (★ 50+, 💯 100+) — confusing, removed
- Themes: cyber-marine, stellar-glass, pearl-light, sand-court (eye strain)
