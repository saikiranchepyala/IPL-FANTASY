# 🏏 IPL Fantasy League

A private, self-hosted IPL fantasy league web app for friend groups. Built as a **single HTML file** — no backend server needed, no app store, no subscriptions. Just Firebase + Netlify, both free.

> Pick your XI before every match, choose your Captain & Vice-Captain, play a Booster, and watch the leaderboard update live as the match unfolds. Teams are hidden until the match locks — then revealed simultaneously for everyone.

**Current version: v3.7.6** — [Changelog](#-changelog)

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

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow delete: if false; 
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.resource.data.diff(resource.data).affectedKeys().size() == 0
        || request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['teams', 'stats', 'locked', 'revealed', 'xiReady', 'matchStatus',
                     'score', 'matchEnded', 'players', 'playerStatus', 'currentBatsmen',
                     'currentBowler', 'matchResult', 'abandoned', 'finalized',
                     'tossResult', 'overSummaries', 'label', 'liveMatchId',
                     't1', 't2', 't1img', 't2img', 'isIPL', 'matchType',
                     'matchNum', 'fantasyEnabled', 'createdAt', 'venue'])
      );
    }

    match /meta/{docId} {
      allow read:           if request.auth != null;
      allow delete:         if false;
      allow create, update: if request.auth != null && (docId == 'members' || docId == 'game' || docId == 'playerProfiles');
    }

    match /season/{docId} {
      allow read:           if request.auth != null;
      allow delete:         if false;
      allow create, update: if request.auth != null && docId == 'totals';
    }

  }
}
```

Click **Publish**.

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

### v3.7.6 — April 26, 2026
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

MIT — do whatever you want with it.
