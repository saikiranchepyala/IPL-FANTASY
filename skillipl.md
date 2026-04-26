---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "3.7.0"
project: ipl-ssmb-fantasy-league
stack: "HTML5/ES6+, Firebase (Firestore/Auth), CricAPI (CricketData.org), CSS3 (Modern Glassmorphism)"
---

# IPL Fantasy League v3.7.0 — Project Intelligence

## 📸 Professional Player Profiles (v3.7.0 — April 26, 2026)

**Goal**: Complete the professional look with real-time player imagery.

### Feature 1 — Automated Player Thumbnails
Player cards and team rows now feature official CricAPI thumbnails.
- **Auto-Sync**: Implemented a background "Backfill" engine. When an admin views a match, the app detects missing player IDs and automatically fetches them from the scorecard to populate images.
- **Robust Loading**: Upgraded `loadMatchPlayers` to capture unique IDs from the start, ensuring new matches have images immediately.

## 📺 Visual & Live Feed Enhancements (v3.6.9 — April 26, 2026)

**Goal**: Professional broadcast-style visuals and real-time awareness.

### Feature 1 — Player Thumbnails
Added circular player images to both the selection grid and the "My Team" card.
- **Source**: Dynamically pulls from CricAPI's image CDN using the player's unique ID.
- **Fallback**: Implemented an elegant SVG placeholder for players without an API image.

### Feature 2 — Global Live Ticker
Introduced a horizontal scrolling ticker at the top of the "Live Scores" tab.
- **Efficiency**: Calls the `currentMatches` endpoint every 5 minutes (costs only 1 credit for all active games).
- **Awareness**: Keeps members informed of other concurrent IPL scores without leaving the app.

### Feature 3 — Venue & Match Metadata
The `match-bar` (header) now explicitly displays the match venue (e.g., 🏟️ Wankhede Stadium).
- **Automation**: Admin match-selection logic updated to automatically capture and store venue metadata from the API during setup.

---

## 🚀 Network & Stats Resilience (v3.6.8 — April 25, 2026)

**Goal**: Zero-failure data fetching and improved member utility.

### Fix 1 — Player Career Stats (Lazy Load)
Implemented a "tap-to-view" player profile system. It fetches full career statistics (IPL & T20I) from CricAPI only when a user requests it. 
- **Caching**: Integrated a two-tier cache (In-memory + Firestore `/meta/playerProfiles`). 
- **Quota Savings**: Reduces per-match API calls from ~100 to nearly zero once the season roster is cached.

### Fix 2 — Proxy Fallback (Connection Resilience)
Upgraded `_cricFetch` to handle `ERR_CONNECTION_RESET` errors caused by restrictive local firewalls or ISPs.
- **Logic**: Attempts direct fetch first; if failure is detected, it automatically reroutes through a CORS proxy.
- **Security**: Moved API key handling to headers where supported to bypass URL-sniffing resets.

### Fix 3 — Credit Badge High-Visibility
Redesigned the player card footer to ensure credits are instantly readable on all screens.
- **Styling**: Solid, high-contrast backgrounds for each credit tier (Elite: Orange, Premium: Blue, Standard: Green).
- **Accessibility**: Increased font weight and added shadows for depth against glassmorphism backgrounds.

---

## 🔐 Firebase Anonymous Auth (v3.6.2 — April 24, 2026)

**Goal**: Gate all Firestore access behind Firebase Anonymous Auth so the database cannot be read or written by bots or direct API queries.

### Change 1 — Auth import
Added `getAuth` and `signInAnonymously` to the Firebase Auth module import in the ES module block.

### Change 2 — `boot()` auth call
`signInAnonymously(getAuth(app))` is called immediately after `db = getFirestore(app)` and before the first Firestore read (`getDoc(doc(db, "meta", "game"))`). This ensures every session has a valid Firebase UID before any database interaction.

### Change 3 — Firestore rules tightened
All `allow read: if true` and `allow create, update: if ...` expressions updated to require `request.auth != null`. A visitor who has not executed the app (and therefore not signed in anonymously) cannot read or write any collection.

**Why auth before rules**: The Firestore rule change and the client-side auth call must be deployed together. If rules are tightened before the client calls `signInAnonymously`, the app breaks for all users. The sequence is: deploy new HTML → update rules in Firebase console.

---

## 🔐 Security Hardening Round 2 (v3.6.0 — April 24, 2026)

### Fix 1 — Name validation: block Firestore dot-path unsafe characters
Added validation in `doJoin()` rejecting names containing `.` `[` `]` `#` `$` `/`. The primary fix targets `.` — v3.5.7 introduced `updateDoc` with dot-path notation for booster writes; a name like `J.Smith` would cause `updateDoc(doc, { "J.Smith.boosters": inv })` to write to a nested path `J → Smith → boosters` instead of the `J.Smith` field key, silently corrupting booster data.

### Fix 2 — Session timeout (10 hours)
`sessionSave()` now writes `savedAt: Date.now()` to localStorage. On `boot()`, if the saved session is older than 10 hours (`_SESSION_TTL = 36_000_000ms`), the session is cleared before restoration. Prevents removed/ex-members from staying logged in indefinitely across days.

### Fix 3 — Error message hygiene
- Boot-time `showError("Firebase error: " + e.message)` replaced with a generic user-facing message; real error logged to `console.warn`. Prevents collection names and Firestore paths from leaking to unauthenticated users on the login screen.
- `e.message` in match-list `innerHTML` (Find IPL Matches + Search Series panels) wrapped with `escHtml()` — was a minor XSS vector if CricAPI returned an error containing HTML.

### Fix 4 — netlify.toml: security response headers
New `netlify.toml` applies to all routes:
- `X-Frame-Options: DENY` — blocks clickjacking
- `X-Content-Type-Options: nosniff` — blocks MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-XSS-Protection: 1; mode=block`

### Fix 5 — firestore.rules committed to repo
`firestore.rules` added at repo root — Firestore security rules are now version-controlled. Full audit history and rollback via git. Previously rules only existed in the Firebase console with no history.

---

## 🔒 XSS Hardening & Input Safety (v3.5.9 — April 24, 2026)

**Goal**: Apply all confirmed-safe P1 security fixes from the full audit.

### Fix 1 — XSS: escHtml on all unescaped player/match name innerHTML insertions
Wrapped `p.name`, `match.label`, and `shortName(m.name)` with `escHtml()` across six render paths:
- `mtc-name` (My Team card)
- `sc-nm` (Player Stats card)
- `pc-name` (player selection card)
- pool-chip label (admin pool)
- `mopt-name` (match option in Find IPL Matches)
- `hm-title` (history modal title)

### Fix 2 — Race condition: setDoc → setDoc with merge:true
Both member join (`doJoin`) and admin profile save now use `{ merge: true }` on the `meta/members` write. Prevents a simultaneous join from silently overwriting a different member's record.

### Fix 3 — Supply chain: SRI hash on confetti CDN
Added `integrity="sha384-..."` and `crossorigin="anonymous"` to the canvas-confetti script tag. A CDN compromise can no longer silently inject code.

### Fix 4 — CSS: removed orphaned closing brace
Removed the stray `}` in the mobile performance block that was prematurely closing nothing, causing an IDE "at-rule or selector expected" parse error on line 15970.

### Fix 5 — Input hardening: maxlength on name fields
Added `maxlength="30"` to member login name, join name, and join team name inputs. Prevents excessively long strings from reaching Firestore or rendering paths.

---

## 🏏 Match Info Tab + Live Fetch Crash Fix (v3.5.8 — April 24, 2026)

### Feature — Match Info Standalone Tab
Added a 6th tab "Match Info" that renders a live batting/bowling scorecard directly from Firestore `match.stats`. Key behaviours:
- **Visibility**: Tab is conditionally rendered via `isCurrentMatchLive()` (`locked && !finalized && !matchEnded`). Appears when match starts, disappears when it ends — handled in all 7 render/refresh paths including admin `outerHTML` tab-bar swap.
- **Position**: Between "My Team" and "Live Scores" in member view; between "Current Match" and "Player Stats" in admin view.
- **URL params**: `?tab=scoreboard` (member) / `?atab=scoreboard` (admin).
- **Master Pulse**: RAF-based DOM patch targets `#lsv-body` after every successful auto-fetch write, updating the scorecard without a full re-render.
- **Content**: Per-innings batting table (sorted desc by runs, current batsmen highlighted with pulsing green dot) and bowling table (current bowler highlighted), with horizontal scroll on mobile.
- **Score colour fix**: `hsc-big-score` inside `.lsv-wrap` forced to `var(--white)` — the team primary colour was unreadable on dark backgrounds for several team palettes.

### Fix — `_isIPL is not defined` Crash During Live Fetch
`autoFetchStats` referenced `_isIPL` (a local variable scoped only to `renderPlayerGrid`) in the bowling overs guard introduced in v3.5.4. Fixed by replacing with `_matchType === "ipl"` (module-scope variable). This caused a `ReferenceError` toast on every fetch during live IPL matches.

---

## 🛡️ XSS & Security Hardening (v3.5.5 — April 22, 2026)

**Goal**: Close remaining security gaps identified in the second audit, primarily focusing on XSS vulnerabilities and Firestore rule permissiveness.

### Fix 1 — XSS Prevention
Added `escHtml()` (alias for `escAttr()`) to sanitize all user-controlled strings (member names, team names, error messages) before `innerHTML` interpolation. This prevents script injection via malicious member names or team names.

### Fix 2 — Firestore Rule Tightening
Updated `StepByStepGuide` and `README` with hardened rules for `/meta` and `/season` collections:
- `allow delete: if false;` for all documents.
- `allow create, update:` restricted to known document IDs (`members`, `game`, `totals`).

---

## 🔧 Post-Audit Stability Hardening (v3.5.4 — April 21, 2026)

**Fix 1 — Not-out Asterisk Display**
Fixed the leaderboard to correctly show the `*` for not-out batsmen by checking the `bat_notOut` field with a legacy fallback (`stats[p]?.bat_notOut ?? stats[p]?.notOut`).

**Fix 2 — "Save All" Legacy Cleanup**
Updated `saveAllStats` to nullify legacy fields (`runs`, `balls`, etc.) when writing the new prefixed fields (`bat_runs`, etc.).

**Fix 3 — Relaxed Bowling Overs Guard**
Relaxed the strict 4-over cap in `autoFetchStats` to support non-T20 matches (ODIs, etc.) while keeping the cap for IPL matches specifically.

---

## ✈️ Overseas Player Roster Update (v3.5.3 — April 21, 2026)

**Update**: Added **Dilshan Madushanka** (and variant spelling **Madhushanka**) to the `OVERSEAS_PLAYERS` set. 

---

## 🏏 Current Innings Detection Fix (v3.5.1 — April 21, 2026)

**Bug**: `autoFetchStats` used `sc[sc.length - 1]` to pick the "current" innings for live batsmen/bowler display. CricAPI doesn't guarantee innings order in the `scorecard[]` array.

**Fix**: Smart innings picker that finds the truly active innings based on fractional overs and inning progression.
