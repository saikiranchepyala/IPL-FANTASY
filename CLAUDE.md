# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IPL Fantasy League — a private, self-hosted IPL fantasy cricket web app built as a **single monolithic HTML file** (`ipl-fantasy-v4_render.html`, ~17,700 lines). No build step, no bundler, no package manager for the app itself. Uses Firebase Firestore for data, Firebase Anonymous Auth for access control, and CricketData.org API for live cricket data. Deployed via Netlify Drop.

## Development

```bash
# Run locally — just open the file in a browser
open ipl-fantasy-v4_render.html

# Lint (optional — requires npm install first)
npx eslint ipl-fantasy-v4_render.html
```

No build step or dev server. The app loads Firebase SDK from CDN via ES module imports. Local runs hit the live Firestore instance — changes affect real data.

```bash
# Run tests (102 assertions: schema, points calc, sync logic, CSS audit)
node mock-server.js &
node test-suite.js        # writes test-results.log
```

## Architecture of the Single HTML File

The entire app lives in `ipl-fantasy-v4_render.html`. It's structured as:

1. **`<head>`** (lines 1–24): Meta tags, Google Fonts, canvas-confetti CDN (with SRI hash)
2. **`<script type="module">`** (lines 25–~10,290): All application JavaScript
3. **`<style>`** (lines ~10,294–~17,200): All CSS including theme system and responsive styles
4. **`<body>`** (lines ~17,200–end): Minimal DOM shell populated by JS

### JavaScript Architecture (inside the single `<script type="module">`)

The JS is organized into logical sections separated by comment banners:

- **Config & Imports** (~line 25): `FIREBASE_CONFIG`, Firebase SDK imports (Firestore, Auth)
- **IPL Constants** (~line 78): Team colors (`IPL_TEAM_COLORS`), logos, role limits, player credits, overseas player roster
- **Points System** (~line 270): `calcPoints(s)` — the fantasy scoring engine; `memberMatchTotal()` — applies Captain/VC/Booster multipliers
- **Booster System** (~line 344): Triple(3×), Double(2×), Team(2×) booster logic with Firestore persistence
- **Player Career Stats** (~line 473): Lazy-load from CricAPI with two-tier cache (in-memory + Firestore `/meta/playerProfiles`)
- **State Management** (~line 894): Module-scope variables (`_members`, `_match`, `_stats`, `_role`, `_mid`, etc.) — no framework, just plain globals
- **`_cricFetch()`** (~line 1063): Central API wrapper with AbortController timeout (15s)
- **`boot()`** (~line 1176): Entry point — anonymous auth → load game state → route to login/member/admin view
- **Router** (~line 1386): URL param-based tab navigation (`?tab=`, `?atab=` for admin)
- **PIN Hashing** (~line 1676): `hashPin()` (PBKDF2-SHA256, 600k iterations), `verifyPin()` with legacy plaintext auto-upgrade (deadline: 2026-05-15)
- **Login/Join UI** (~line 1515): `doLogin()`, `doJoin()` with shared `validateName()` (blocks Firestore-unsafe chars `.[]#$/`)
- **Member Tabs** (~line 1954): My Team, Live Scores, Season Table, Match History, Match Info (conditional)
- **Admin Tabs** (~line 5008): Current Match management, Player Stats, admin controls
- **`autoFetchStats()`** (~line 9002): The live scoring engine — polls CricAPI every ~5 min, parses scorecard, updates stats in Firestore
- **Name Matching** (~line 5716): Ultra-strict player name fuzzy matching between CricAPI data and local player pool
- **Stat Parsing** (~line 5794): Multi-phase regex parser for scorecard data (discovery → selective reset → regex parse → save & sync)
- **`finalizeMatch()`** (~line 7048): Locks points and updates season totals via `writeBatch` atomic transaction
- **Helpers** (~line 9960): `escHtml()`/`escAttr()` for XSS prevention, `showError()`, theme system

### Key Patterns

- **XSS Safety**: All user-controlled strings must be wrapped in `escHtml()` before `innerHTML` interpolation. This is a hard rule — multiple security rounds have enforced it.
- **Firestore Dot-Path Safety**: Member names cannot contain `.[]#$/` because `updateDoc` uses dot-path notation (e.g., `"memberName.boosters"` would corrupt nested paths).
- **`setDoc` with `{ merge: true }`**: Always use merge on `meta/members` writes to prevent race conditions between simultaneous joins.
- **Error Handling**: Never use `.catch(() => null)` — it masks crashes. Errors must propagate to `try/catch` blocks.
- **Impact Subs**: Player status can change mid-match when a substitute enters; handled by `playerStatus` field.

## Firestore Collections

```
/meta/game              — { currentMatchId, activeMatchIds[], adminPin, joinCode, cricApiKey }
/meta/members           — { [name]: { pin, teamName, joinedAt, boosters: {triple, double, team} } }
/meta/playerProfiles    — cached CricAPI career stats
/matches/{matchId}      — full match state (players, stats, teams, scores, lock/reveal/finalize flags)
/season/totals          — { [name]: { total, matches: [{matchId, label, pts}] } }
```

## Security Rules

`firestore.rules` is version-controlled at repo root. Key constraints:
- All reads/writes require `request.auth != null` (Firebase Anonymous Auth)
- Deletes are blocked (`allow delete: if false`) on all collections
- Match updates are field-whitelisted via `affectedKeys().hasAny([...])`
- Meta writes restricted to known doc IDs (`members`, `game`, `playerProfiles`)

**Known limitation**: Anonymous auth means any visitor who loads the page satisfies `request.auth != null`. Write authorization is effectively open — there is no server-side enforcement of admin-only operations. PIN hashing protects against passive DB reads but not against direct Firestore writes. Proper fix requires Firebase custom claims + role-checked rules via a Cloud Function.

## Deployment

Deploy by dragging `ipl-fantasy-v4_render.html` to [app.netlify.com/drop](https://app.netlify.com/drop). Security headers are configured in `netlify.toml`. Firestore rules must be updated separately via the Firebase Console.

**Important**: When tightening Firestore rules, deploy the new HTML first, then update rules — otherwise the app breaks for all users.
