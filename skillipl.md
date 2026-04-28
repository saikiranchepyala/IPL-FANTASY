---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "3.8.0"
project: ipl-ssmb-fantasy-league
stack: "HTML5/ES6+, Firebase (Firestore/Auth), CricAPI (CricketData.org), CSS3 (Modern Glassmorphism)"
---

# IPL Fantasy League v3.8.0 — Project Intelligence

## ⚡ CricAPI Credit Optimization (v3.8.0 — April 28, 2026)

**Goal**: Eliminate unnecessary CricAPI credit burn caused by snapshot-triggered API cascades, idle member polling, and aggressive default AR interval.

### Fix 1 — Remove `adminAutoSyncPlayerIds` from `syncDerivedState`
`syncDerivedState()` is called on every Firestore `onSnapshot` callback (meta/game changes, match doc changes). It was unconditionally calling `adminAutoSyncPlayerIds()` for admin sessions, which makes 1-2 `_cricFetch` calls (`match_info` + `match_scorecard`). With 3 active matches, each AR tick triggered a write → snapshot → sync cascade producing 6 extra API calls per tick. Removed the auto-call; photo sync remains available as a manual admin button.

### Fix 2 — Gate global ticker to admin-only with active matches
`fetchGlobalTicker()` was started unconditionally in `boot()` for every user, polling `currentMatches` every 5 minutes. With 8 members leaving tabs open, that's 768 credits/day just from the ticker. Added `_startTickerIfNeeded()` which only starts the ticker when: (a) session is admin, and (b) there are active matches. Called from `_doRefresh()` so it auto-starts after admin login.

### Fix 3 — Raise AR default from 30s to 60s
Changed `window.arStoredSecs` default and both fallback values in `adminStartMatch`/`adminToggleAR` from `"30"` to `"60"`. Fantasy point updates don't need 30s granularity — wickets and boundaries are infrequent enough that 60s is sufficient. Saves ~210 credits per 3.5-hour match. Admin can still manually select 30s from the dropdown.

---

## 🛡️ Data Integrity Patch (v3.7.9 — April 26, 2026)

**Goal**: Close the data-loss race condition on `meta/members` during concurrent team submissions.

### Fix 1 — targeted dot-notation merging on `setDoc`
Updated `setDoc` calls in `lockTeamBtn`, `doJoin`, and `adminSaveProfile` to map to the specific `session.name` key using `{ [session.name]: newData }` along with `{ merge: true }`. Previously, it was spreading the entire `allMembers` object, creating a classic read-modify-write race condition where simultaneous users would silently overwrite each other's account data and boosters.

---

## 🛡️ Security & Firestore Hardening (v3.7.8 — April 26, 2026)

**Goal**: Close the 0000 admin race condition and tighten Firestore `update` validation.

### Fix 1 — Removed "0000" Auto-Creation
Deleted the code in `boot()` that automatically created the `meta/game` document with the default PIN `0000`. First-time setup must now be done manually in the Firebase Console to prevent a race condition where the first visitor claims the Admin role.

### Fix 2 — Strict Data Validation (`.hasOnly()`)
Hardened Firestore rules. `matches` document updates now use `.hasOnly()` instead of `.hasAny()`, preventing malicious injection of arbitrary fields into match objects.

---

## 🛡️ Security Review Fixes (v3.7.5 — April 26, 2026)

**Goal**: Address all actionable findings from the v3.7.2→v3.7.4 security re-review.

### Fix 1 — PBKDF2 PIN Hashing (600k iterations)
Replaced single-round SHA-256 with `crypto.subtle.deriveBits` using PBKDF2-SHA256 and 600k iterations. The 10,000-candidate PIN space now takes minutes to brute-force instead of microseconds.

### Fix 2 — Legacy PIN Sunset Deadline
Added `_PIN_LEGACY_DEADLINE` (2026-05-15). After this date, plaintext PINs stored in Firestore are refused — closing the downgrade attack where an attacker could overwrite a hash with a known plaintext.

### Fix 3 — Removed corsproxy.io Fallback
Deleted the entire CORS proxy fallback from `_cricFetch`. The previous implementation leaked the CricAPI key to a third-party proxy, had dead code (`safeUrl` computed but never used), and stream-of-consciousness comments. Also removed `corsproxy.io` from the CSP `connect-src` directive.

### Fix 4 — Shared Name Validation
Extracted `validateName()` with `_NAME_BAD_CHARS` regex and applied it to both `doJoin` and `adminSaveProfile`. Previously `adminSaveProfile` had no dot-path character validation — an admin name like "Foo.Bar" would corrupt Firestore writes.

### Fix 5 — CLAUDE.md Accuracy
Updated to reflect: test suite exists (102 tests), PBKDF2 hashing, and an honest caveat that anonymous auth does not enforce admin-only write authorization.

---

## 🔐 PIN Hashing & Content Security Policy (v3.7.4 — April 26, 2026)

**Goal**: Protect member PINs at rest and restrict browser resource loading to trusted origins.

### Feature 1 — PIN Hashing (SHA-256 + Salt)
Implemented `hashPin(pin, salt)` using the browser's native `crypto.subtle.digest("SHA-256", ...)` API. The member's lowercased name is used as the salt, ensuring identical PINs produce unique hashes in Firestore.

- **`verifyPin()`**: Compares entered PIN against stored value (hashed or legacy plaintext).
- **Auto-Upgrade**: On successful legacy login, the plaintext PIN is silently replaced with its SHA-256 hash in Firestore.
- **Functions Updated**: `doMemberLogin`, `bindReturn`, `doAdminLogin`, `doJoin`, `adminSaveLeague`.
- **Admin Salt**: Admin PIN uses the fixed salt `"__admin__"` since it's not tied to a member name.

### Feature 2 — Content Security Policy (CSP)
Added a `Content-Security-Policy` header to `netlify.toml`:
- **script-src**: `'self'`, `'unsafe-inline'` (required for `<script type="module">` and Static DNA onclick handlers), `www.gstatic.com` (Firebase SDK), `cdn.jsdelivr.net` (confetti).
- **connect-src**: Firebase (`*.googleapis.com`, `*.firebaseio.com`, `*.firebaseapp.com`), `api.cricapi.com`, `corsproxy.io`.
- **img-src**: `data:` (SVG fallbacks), `h.cricapi.com` (player photos), `scores.iplt20.com` (team logos), Google CDNs.
- **frame-src / object-src**: `'none'` — blocks iframing and plugin embeds.

---

## 🛡️ Security & Stability Patch (v3.7.2 — April 26, 2026)

**Goal**: Align code with hardened Firestore rules and block XSS vectors.

### Fix 1 — Anonymous Auth Restoration
Re-implemented `signInAnonymously()` in the `boot()` sequence. This ensures all users have a valid Firebase UID before interacting with the database, satisfying the `request.auth != null` requirement in `firestore.rules`.

### Fix 2 — XSS Shielding (Event Delegation)
Removed all inline `onclick` handlers for player stats. Switched to a safe data-attribute pattern (`data-pname`) with global event delegation.
- **Sanitization**: Applied `escHtml()` to all API-driven fields including player metadata, career stats, and match venues.

### Fix 3 — Runtime Crash Prevention
Removed the `.catch(() => null)` pattern from asynchronous `_cricFetch` calls. Errors now propagate correctly to `try/catch` blocks, preventing "Cannot read properties of null" crashes during network interruptions.

---

## 🛠️ Performance & Stability (v3.7.1 — April 26, 2026)

**Goal**: Polish and harden all new features for 100% reliability.

### Fix 1 — API Consistency
Standardized `_cricFetch` to return parsed JSON directly. Removed all redundant `.json()` calls across the 17k+ line codebase to prevent "r.json is not a function" runtime crashes.

### Fix 2 — Foolproof Thumbnail Sync
Overhauled the player image synchronization engine:
- **Global Search Fallback**: If a match-level ID is missing, the app now searches the entire CricAPI database for a name match.
- **Manual 🔄 Button**: Added a dedicated sync button in the Admin tab for on-demand photo population.
- **Global Cache**: Implemented `ipl_player_cache` in `localStorage` so player IDs are remembered across sessions.

### Fix 3 — CORB Security Bypass
Redesigned image rendering to use a safe Data URI placeholder instead of broken remote URLs, preventing browser-level security blocks (CORB/CORS).

---

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
