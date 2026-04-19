# 🏏 IPL Fantasy League

A private, self-hosted IPL fantasy league web app for friend groups. Built as a **single HTML file** — no backend server needed, no app store, no subscriptions. Just Firebase + Netlify, both free.

> Pick your XI before every match, choose your Captain & Vice-Captain, play a Booster, and watch the leaderboard update live as the match unfolds. Teams are hidden until the match locks — then revealed simultaneously for everyone.

**Current version: v3.2.0** — [Changelog](#-changelog)

---

## ✨ Features

- **Per-match team selection** — fresh XI + Captain/VC picks every game
- **6-player team cap** — max 6 players from any one IPL team
- **Booster system** — Triple (3×), Double (2×), and Team (2×) boosters per season; one per match
- **Toss reveal mechanic** — all teams hidden until admin locks the match at first ball
- **Auto Playing XI detection** — background watcher polls CricAPI after toss; manual paste fallback if API is slow
- **Live points** — auto-fetches scorecard from CricketData.org API every ~5 minutes
- **Impact Sub support** — automatic status flip when sub enters
- **Season leaderboard** — cumulative points table with match-by-match breakdown and booster badges
- **Pitch overlay** — member-by-member XI visualisation from the leaderboard
- **CSV export** — download full season table as a spreadsheet
- **Admin panel** — manage matches, load players, control reveal timing, finalize points
- **Join via link** — admin generates a join code; members tap link and register
- **Works on mobile** — fully responsive, designed for phone use during a match

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

### Step 2 — Firestore Security Rules

In Firestore → **Rules** tab, replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
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

> **Note:** Scorecard data requires `fantasyEnabled: true` on the match. All IPL 2026 matches have this enabled as of the current season.

---

## ⚠️ Known Limitations

- **Catches/stumpings/run-outs** — CricAPI doesn't always populate these reliably; may need manual entry after the match.
- **Auto-refresh requires admin tab open** — the live poller only runs while the admin panel is open. Keep your screen active during the match.
- **Playing XI between toss and first ball** — CricAPI occasionally doesn't return XI status in this window. Use the "XI not loading from API?" paste panel in the Current Match tab to mark players manually.
- **Firestore rules are open** — fine for a private friend group; not suitable for a public app.
- **Playoffs/finals** — boosters are disabled for playoff matches (Qualifiers, Eliminators, Final).
- **Firestore free tier** — 50,000 reads / 20,000 writes per day — more than sufficient for a 25-member group across a full season.

---

## 🛠️ Local Development

No build step required. Open the file directly in a browser:

```bash
open ipl-fantasy-v4_render.html
```

Firebase will connect to your live Firestore instance, so any changes made locally affect real data.

---

## 📁 Repository Structure

```
/
├── ipl-fantasy-v4_render.html   # The entire app — single HTML file
├── skillipl.md                  # Project intelligence / architecture doc
├── StepByStepGuide              # Detailed setup walkthrough
└── README.md                    # This file
```

---

## 📋 Changelog

### v3.2.0 — April 18, 2026
- Added "XI not loading from API?" paste panel in Current Match tab — paste both Playing XIs when CricAPI fails post-toss
- Fixed `parseSquadList` to set `xiReady: true` when 22+ playing players confirmed (existing + batch counted together)
- Impact players (prefixed "Impact:") correctly excluded from xiReady threshold

### v3.1.0 — April 18, 2026
- Fixed final-over stats freeze: grace poll pattern gives CricAPI 60s after match end to commit final scorecard
- `_handleMatchEnd(activeMid)` stops recurring interval then fires one final poll; uses `_arGracePollMid` cancellation key

### v3.0.0 — April 18, 2026
- Fixed admin Season Leaderboard "X Matches ▾" toggle breaking for members with apostrophes in their name
- Full smoke test + API endpoint verification — all CricAPI endpoints confirmed live, `fantasyEnabled: true` for all IPL 2026 matches
- IPL 2026 series ID confirmed correct against live API

### v2.9.9 — April 18, 2026
- Restored `getTeamColor` function deleted by external model (was causing silent Loading screen freeze)
- Added try-catch to `showScreen` rAF so a crashed render never leaves the app invisible
- Fixed `?.split("vs")[n]` crash in score bar and booster dock
- Fixed `parseScorecardText` catch block not resetting `skipNextRefresh` after failed saves
- Fixed `prevScores` and `_pvMatchCache` not being cleared on logout (stale memory on iOS)

### v2.9.8 — April 2026
- Fixed RRR/balls-left showing "NEED N OFF 120 BALLS" from over 10 onwards
- Fixed final-over stats never reaching Firestore (live reference deep-compare bug)
- Fixed AR poller running indefinitely after match end when no changes detected
- Fixed CricAPI empty scorecard race condition after `matchEnded: true` (8s retry)

### v2.9.7 — April 2026
- Fixed GT vs KKR score swap from CricAPI multi-team inning labels

### v2.9.6 — April 2026
- Fixed batting/bowling field collision causing ghost points
- Fixed fuzzy name matcher causing wrong player attribution
- Fixed captain `(c)` tag causing all-rounder bowling rows to be skipped in manual scorecard paste

### v2.9.3 — April 2026
- Boosters now auto-save immediately for members who already locked in their team

### v2.9 — March 2026
- Booster system launched: Triple (3×), Double (2×), Team (2×) per season
- Booster dock, overlay, inventory management, privacy/reveal system

---

## 🤝 Contributing

This is a personal project for a private friend group. Feel free to fork it and adapt it for your own league.

---

## 📄 License

MIT — do whatever you want with it.
