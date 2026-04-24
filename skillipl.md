---
name: ipl-fantasy-league
description: "Full context skill for the IPL Fantasy League private web app — architecture, API, points system, bug fixes, design system."
version: "3.5.7"
project: ipl-ssmb-fantasy-league
stack: "HTML5/ES6+, Firebase (Firestore/Auth), CricAPI (CricketData.org), CSS3 (Modern GlassMorphism)"
---

# IPL Fantasy League v3.5.7 — Project Intelligence

## 🛡️ Critical Audit & Integration Hardening (v3.5.7 — April 23, 2026)

**Goal**: Address high-severity issues identified in the full system audit, ensuring atomic data operations and preventing silent application crashes.

### Fix 1 — Atomic Match Finalization
Replaced sequential `setDoc` and `updateDoc` calls with Firestore `writeBatch`. This ensures that updating the **Season Totals** and marking a match as **Finalized** (or Abandoned) happens in a single atomic transaction. Prevents data inconsistency where points are added but the match isn't locked, which could lead to double-counting.

### Fix 2 — TDZ (Temporal Dead Zone) Crash Prevention
Fixed a critical boot-time bug in `showError()`. The function was attempting to use `escHtml` (a `const` variable) before its declaration in the script's execution flow. In environments with network or Firebase initialization errors, this caused a secondary `ReferenceError`, resulting in a blank screen instead of a helpful error message. Switched to `escAttr` (a hoisted function declaration).

### Fix 3 — Booster Data Loss Prevention
Refactored booster management to use `updateDoc` with **dot-path notation** (e.g., `updateDoc(doc, { "memberName.boosters": inv })`). Previous versions used `setDoc` on the entire `meta/members` document, which created a race condition: if two users applied boosters simultaneously, the second write would silently overwrite the first user's update.

### Fix 4 — Multi-Innings & Super Over Scoring
- **notOut Persistence**: Changed the `notOut` assignment to use logical OR (`||=`). If a player is "not out" in any innings (main or super over), they now correctly retain that status for bonus points.
- **Per-Innings Overs Cap**: The 4-over bowling cap for IPL matches is now applied to individual innings records rather than the accumulated total. This prevents bowlers who bowl in both the main match and a super over from having their entire wickets/overs record zeroed out for "exceeding" 4 overs.
- **Over Summaries Merging**: `overSummaries` are now concatenated across all innings instead of being overwritten by the last innings in the array.

### Fix 5 — CricAPI Quota & Global Sync
- **Midnight Reset**: The `_QUOTA_KEY` is now dynamically generated inside `_trackApiCall`, ensuring the 2000-call limit resets correctly at midnight without requiring a page refresh.
- **Off-by-one Fix**: Corrected the quota logic to allow exactly 2000 calls per day.

### Fix 6 — XSS & Template Security
Extended XSS protection to the scorecard player rows. Player names (`b.name`, `bowler.name`) are now escaped within template literals to prevent injection via API data.

### 🏏 Squad Update
Added **Krish Bhagat** (Mumbai Indians) to the `PLAYER_CREDITS` pool with a base value of 7 credits.

---

## 🔧 Final Stability Refinements (v3.5.6 — April 22, 2026)


## 🛡️  XSS & Security Hardening (v3.5.5 — April 22, 2026)

**Goal**: Close remaining security gaps identified in the second audit, primarily focusing on XSS vulnerabilities and Firestore rule permissiveness.

### Fix 1 — XSS Prevention
Added `escHtml()` (alias for `escAttr()`) to sanitize all user-controlled strings (member names, team names, error messages) before `innerHTML` interpolation. This prevents script injection via malicious member names or team names.
Applied to: 
- `hm-title` (pitch overlay)
- `lb-name`, `lb-tname`, `lb-pitch-btn` title (leaderboard)
- `sc-name`, `sc-tname` (season leaderboard)
- `td-name` (match breakdown table)
- `nav-u` (navigation bar)
- `mrow-n`, `mrow-s` (all members list)
- `wb-winner` (winner banner)
- `showError()` content

### Fix 2 — Firestore Rule Tightening
Updated `StepByStepGuide` and `README` with hardened rules for `/meta` and `/season` collections:
- `allow delete: if false;` for all documents.
- `allow create, update:` restricted to known document IDs (`members`, `game`, `totals`).
- Prevents drive-by "nuking" of the entire database.

### Fix 3 — Error Visibility
Replaced silent `catch (e) {}` blocks with `console.warn(e)` across the entire file to surface failures in `localStorage` operations and Firebase listener unsubscriptions.

---

## 🔧 Post-Audit Stability Hardening (v3.5.4 — April 21, 2026)

**Fix 1 — Not-out Asterisk Display**
Fixed the leaderboard to correctly show the `*` for not-out batsmen by checking the `bat_notOut` field with a legacy fallback (`stats[p]?.bat_notOut ?? stats[p]?.notOut`).

**Fix 2 — "Save All" Legacy Cleanup**
Updated `saveAllStats` to nullify legacy fields (`runs`, `balls`, etc.) when writing the new prefixed fields (`bat_runs`, etc.). This prevents double-counting in points calculations and keeps the database clean.

**Fix 3 — Relaxed Bowling Overs Guard**
Relaxed the strict 4-over cap in `autoFetchStats` to support non-T20 matches (ODIs, etc.) while keeping the cap for IPL matches specifically.

**Fix 4 — Robust DOM Queries**
Wrapped player names in `CSS.escape()` for all manual save and availability toggle query selectors to prevent crashes when player names contain special characters (like quotes or brackets).

**Fix 5 — Dead Code Cleanup**
Removed unused imports and variables (`deleteDoc`, `xiRetryCount`, `matchHistory`) to keep the bundle lean.

---

## ✈️ Overseas Player Roster Update (v3.5.3 — April 21, 2026)

**Update**: Added **Dilshan Madushanka** (and variant spelling **Madhushanka**) to the `OVERSEAS_PLAYERS` set. 
- Ensures he is correctly tagged as "FOREIGN" in the UI.
- Correctly counts toward the 4-player overseas cap for team submissions.

---

## 🏏 Current Innings Detection Fix (v3.5.1 — April 21, 2026)

**Bug**: `autoFetchStats` used `sc[sc.length - 1]` to pick the "current" innings for live batsmen/bowler display. CricAPI doesn't guarantee innings order in the `scorecard[]` array — when the 1st innings was last in the array, the app showed stale 1st-innings batsmen (e.g. SRH's Abhishek Sharma/Ishan Kishan) while DC was actually batting in the 2nd innings.

**Fix**: Smart innings picker that finds the truly active innings:
1. **Priority 1**: Innings with fractional overs (mid-over = definitely in progress).
2. **Priority 2**: Incomplete innings (< 20 overs) with not-out batsmen — take the one with most overs bowled.
3. **Priority 3**: Any innings under 20 overs.
4. **Fallback**: Last innings in array (original behavior).
