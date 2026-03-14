# IPL-FANTASY
# 🏏 IPL Fantasy League

A private, self-hosted IPL fantasy league web app for friend groups. Built as a **single HTML file** — no backend server needed, no app store, no subscriptions. Just Firebase + Netlify, both free.

> Pick your XI before every match, choose your Captain & Vice-Captain, and watch the leaderboard update live as the match unfolds. Teams are hidden until the toss — then revealed simultaneously for everyone.

---

## ✨ Features

- **Per-match team selection** — fresh XI + Captain/VC picks every game
- **6-player team cap** — max 6 players from any one IPL team (standard fantasy rule)
- **Toss reveal mechanic** — all teams hidden until admin triggers the reveal
- **Live points** — auto-fetches scorecard from CricketData.org API every 5 minutes
- **Season leaderboard** — cumulative points table across all matches with match-by-match breakdown
- **CSV export** — download the full season table as a spreadsheet
- **Admin panel** — manage matches, load players, enter/correct stats, control reveal timing
- **Join via link** — admin generates a 6-digit join code; friends tap the link and register
- **Works on mobile** — fully responsive, designed for phone use during a match

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file, no build step |
| Database | Firebase Firestore (free tier) |
| Hosting | Netlify Drop (free tier) |
| Cricket Data | [CricketData.org](https://cricketdata.org) API (free tier, 100 calls/day) |

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

Open `ipl-fantasy-v4.html` in any text editor. At the very top of the `<script>` block, replace the placeholder values:

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
2. Drag and drop `ipl-fantasy-v4.html` onto the page
3. Your league is live at a URL like `sunny-dolphin-abc123.netlify.app`
4. Optional: rename it under **Site configuration → Change site name**

---

## 🎮 How to Use

### Admin — Before Each Match

1. Log in with Admin PIN (default: `0000` — change it immediately in League Setup)
2. **League Setup tab** → Generate Join Link → share with your group on WhatsApp
3. **Current Match tab** → fill in match label + teams → **Create New Match**
4. Click **Find IPL Matches** → select today's match → playing XI auto-loads
5. Wait for friends to submit their teams

### Admin — On Match Day

| Time | Action |
|---|---|
| 30 min before toss | **Lock Teams** — no more edits |
| Toss announced | **🥁 TOSS DONE — REVEAL!** — all teams visible simultaneously |
| During match | **Player Stats tab** → set auto-refresh to 5 min → toggle **ON** |
| After match | Manually fix any missing catches/run-outs/stumpings |
| Match over | **✅ Finalize & Save to Season** — locks points into season table |
| Next match | **+ Start Next Match** — resets picks, keeps season history |

### Members — Each Match

1. Open the league URL → enter name + PIN
2. **My Team tab** → tap player cards to build your XI (max 6 from any one team)
3. Choose Captain (2×) and Vice-Captain (1.5×) from the dropdowns
4. Tap **🔒 LOCK IN MY TEAM**
5. After toss → **Live Scores tab** for the leaderboard
6. **Season Table tab** for cumulative standings

---

## 📊 Fantasy Points System

### Batting
| | |
|---|---|
| Run | +1 |
| Boundary (4) | +1 bonus |
| Six | +2 bonus |
| 30 runs | +4 bonus |
| 50 runs | +8 bonus |
| 100 runs | +16 bonus |
| Duck (batted, 0 runs) | −2 |
| SR ≥ 170 (min 10 balls) | +6 |
| SR ≥ 150 | +4 |
| SR ≥ 130 | +2 |
| SR < 50 | −6 |
| SR < 60 | −4 |
| SR < 70 | −2 |

### Bowling
| | |
|---|---|
| Wicket | +25 |
| LBW / Bowled bonus | +8 |
| 3-wicket haul | +4 bonus |
| 4-wicket haul | +8 bonus |
| 5-wicket haul | +16 bonus |
| Maiden over | +8 |
| ER < 5 (min 2 overs) | +6 |
| ER < 6 | +4 |
| ER < 7 | +2 |
| ER > 10 | −2 |
| ER > 9 | −4 |
| ER > 8 | −6 |

### Fielding
| | |
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
/meta/game              — { currentMatchId, adminPin, joinCode, cricApiKey }
/meta/members           — { [name]: { pin, teamName, joinedAt } }
/matches/{matchId}      — { label, t1, t2, players[], stats:{}, teams:{},
                            revealed, locked, finalized, liveMatchId }
/season/totals          — { [name]: { total, matches:[{ matchId, label, pts }] } }
```

---

## 🔑 Getting a CricketData.org API Key

1. Sign up free at [cricketdata.org](https://cricketdata.org)
2. Copy your API key from the dashboard
3. Paste it in **Admin → Current Match → CricketAPI section** → Save

Free tier: **100 calls/day** — enough for a full match day with 5-minute auto-refresh.

---

## ⚠️ Known Limitations

- **Stats auto-fetch coverage** — the CricAPI free tier updates every few minutes, not ball-by-ball. Catches, stumpings, and run-outs sometimes need manual entry after the match.
- **Auto-refresh requires admin tab open** — the 5-minute auto-refresh only runs while the admin panel is open in a browser tab. Keep your phone screen active during the match.
- **Firestore rules are open** — the current rules (`allow read, write: if true`) are fine for a private friend group but are not suitable for a public app. Do not store sensitive data.
- **Free tier limits** — Firestore free tier allows 50,000 reads and 20,000 writes per day, which is more than sufficient for a 10-person group across a full season.

---

## 🛠️ Local Development

No build step required. Just open the file directly in a browser:

```bash
open ipl-fantasy-v4.html
```

Note: Firebase will still connect to your live Firestore instance, so any changes made locally affect real data.

---

## 📁 Repository Structure

```
/
└── ipl-fantasy-v4.html    # The entire app — single file
└── README.md              # This file
```

---

## 🤝 Contributing

This is a personal project for a private friend group. Feel free to fork it and adapt it for your own league. If you find a bug or have a suggestion, open an issue.

---

## 📄 License

MIT — do whatever you want with it.
