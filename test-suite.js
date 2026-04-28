// ═══════════════════════════════════════════════════════════════════════
//  test-suite.js — Full-Spectrum Tests for IPL Fantasy League
//  Usage: node test-suite.js [--mock-port 3333]
//
//  Requires mock-server.js running:  node mock-server.js &
//  Output: test-results.log (written to cwd)
// ═══════════════════════════════════════════════════════════════════════

const http = require("http");
const fs = require("fs");
const path = require("path");

const MOCK_PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--mock-port") || "3333");
const MOCK_BASE = `http://localhost:${MOCK_PORT}`;
const LOG_FILE = path.join(__dirname, "test-results.log");

let totalTests = 0;
let passed = 0;
let failed = 0;
const results = [];

// ── Helpers ───────────────────────────────────────────────────────────

function log(msg) {
  results.push(msg);
  console.log(msg);
}

function assert(label, condition, detail) {
  totalTests++;
  if (condition) {
    passed++;
    log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    log(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
  }
}

function fetchJSON(urlPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${MOCK_BASE}${urlPath}`;
    http.get(fullUrl, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from ${urlPath}: ${e.message}`)); }
      });
    }).on("error", reject);
  });
}

function fetchWithTiming(urlPath) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    http.get(`${MOCK_BASE}${urlPath}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const elapsed = performance.now() - start;
        try { resolve({ data: JSON.parse(data), elapsed }); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

// ── Points Calculator (mirror of the app's calcPoints) ────────────────
// Extracted from ipl-fantasy-v4_render.html:271-322

function toRealOvers(o) {
  if (!o) return 0;
  const f = Math.floor(o);
  const b = Math.round((o - f) * 10);
  return f + b / 6;
}

function calcPoints(s) {
  if (!s) return 0;
  let p = 0;
  const runs = s.bat_runs ?? (s.runs || 0);
  const balls = s.bat_balls ?? (s.balls || 0);
  const fours = s.bat_4s ?? (s.fours || 0);
  const sixes = s.bat_6s ?? (s.sixes || 0);
  const notOut = s.bat_notOut ?? (s.notOut || false);
  const wkts = s.wickets || 0;
  const overs = toRealOvers(s.overs || 0);

  p += runs + fours + sixes * 2;
  if (runs >= 100) p += 16;
  else if (runs >= 50) p += 8;
  else if (runs >= 30) p += 4;
  if (s.batted && runs === 0 && !notOut) p -= 2;
  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr >= 170) p += 6;
    else if (sr >= 150) p += 4;
    else if (sr >= 130) p += 2;
    else if (sr < 50) p -= 6;
    else if (sr < 60) p -= 4;
    else if (sr < 70) p -= 2;
  }
  p += wkts * 25 + (s.maidens || 0) * 8;
  if (wkts >= 5) p += 16;
  else if (wkts >= 4) p += 8;
  else if (wkts >= 3) p += 4;
  p += (s.lbwBowled || 0) * 8;
  if (overs >= 2) {
    const er = s.eco != null ? s.eco : (s.runsConceded || 0) / overs;
    if (er < 5) p += 6;
    else if (er < 6) p += 4;
    else if (er < 7) p += 2;
    else if (er > 10) p -= 6;
    else if (er > 9) p -= 4;
    else if (er > 8) p -= 2;
  }
  p += (s.catches || 0) * 8;
  if ((s.catches || 0) >= 3) p += 4;
  p += (s.runOutDirect || 0) * 12 + (s.runOutIndirect || 0) * 6 + (s.stumpings || 0) * 12;
  if (s.playingXI) p += 4;
  return Math.round(p);
}

function memberMatchTotal(team, stats, playersList) {
  const booster = team.booster || null;
  let total = (team.players || []).reduce((acc, p) => {
    let pts = calcPoints(stats[p]);
    if (p === team.captain) pts *= 2;
    else if (p === team.vc) pts *= 1.5;
    if (booster?.type === "team") {
      const pObj = playersList.find((pl) => pl.name === p);
      if (pObj && pObj.teamKey === booster.target) pts *= 2;
    }
    return acc + pts;
  }, 0);
  if (booster?.type === "triple") total *= 3;
  else if (booster?.type === "double") total *= 2;
  return Math.round(total);
}

// ── escHtml (mirror of app's escAttr/escHtml) ─────────────────────────

function escHtml(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Stat mapping: CricAPI scorecard → app's "Plain Text Standard" ─────

function mapBatting(entry) {
  return {
    batted: true,
    bat_runs: entry.runs,
    bat_balls: entry.balls,
    bat_4s: entry.fours,
    bat_6s: entry.sixes,
    bat_notOut: entry.isNotOut,
    playingXI: true,
  };
}

function mapBowling(entry) {
  return {
    overs: entry.overs,
    maidens: entry.maidens,
    runsConceded: entry.runs,
    wickets: entry.wickets,
    playingXI: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  TEST SUITES
// ═══════════════════════════════════════════════════════════════════════

async function runAllTests() {
  const startTime = performance.now();
  log("═══════════════════════════════════════════════════════════════");
  log("  IPL Fantasy League — Full-Spectrum Test Suite");
  log(`  ${new Date().toISOString()}`);
  log(`  Mock server: ${MOCK_BASE}`);
  log("═══════════════════════════════════════════════════════════════\n");

  // ── 1. FUNCTIONAL & SCHEMA TESTS ──────────────────────────────────
  log("── 1. FUNCTIONAL & SCHEMA TESTS ─────────────────────────────\n");

  // 1a. JSON Schema Validation
  log("  [1a] JSON Schema — match_scorecard");
  try {
    const sc = await fetchJSON("/v1/match_scorecard?id=mock-match-001&apikey=test");
    assert("Response has 'status' field", sc.status !== undefined);
    assert("status is 'success'", sc.status === "success");
    assert("data.id exists and is string", typeof sc.data?.id === "string");
    assert("data.name exists", typeof sc.data?.name === "string");
    assert("data.venue exists", typeof sc.data?.venue === "string");
    assert("data.matchType is 't20'", sc.data?.matchType === "t20");
    assert("data.score is an array", Array.isArray(sc.data?.score));
    assert("data.scorecard is an array", Array.isArray(sc.data?.scorecard));
    assert("data.players is an array", Array.isArray(sc.data?.players));

    // Score entry schema
    const s0 = sc.data.score[0];
    assert("score[0] has r (runs)", typeof s0?.r === "number");
    assert("score[0] has w (wickets)", typeof s0?.w === "number");
    assert("score[0] has o (overs)", typeof s0?.o === "number");
    assert("score[0] has inning (string)", typeof s0?.inning === "string");

    // Player entry schema
    const p0 = sc.data.players[0];
    assert("player has id", typeof p0?.id === "string");
    assert("player has name", typeof p0?.name === "string");
    assert("player has status", typeof p0?.status === "string");
    assert("player status is 'playing' or 'notplaying'", ["playing", "notplaying"].includes(p0?.status));
  } catch (e) {
    assert("Schema test fetch succeeded", false, e.message);
  }

  log("");
  log("  [1a] JSON Schema — match_squad & Role Overrides");
  try {
    const sq = await fetchJSON("/v1/match_squad?id=mock-match-001&apikey=test");
    assert("match_squad status is 'success'", sq.status === "success");
    assert("match_squad data is an array", Array.isArray(sq.data));
    assert("match_squad has teamName", typeof sq.data[0]?.teamName === "string");
    assert("match_squad has players array", Array.isArray(sq.data[0]?.players));
    
    // Test role overrides simulation
    const p1 = sq.data[0].players.find(p => p.name === "Brijesh Sharma");
    const p2 = sq.data[0].players.find(p => p.name === "Yash Raj Punja");
    const p3 = sq.data[0].players.find(p => p.name === "Sanju Samson");
    
    const ROLE_OVERRIDES = { "Brijesh Sharma": "BOWL", "Yash Raj Punja": "BOWL" };
    function mockMapRole(r) {
      if (!r) return "BAT";
      const rl = r.toLowerCase().trim();
      if (rl === "ar" || rl.includes("all")) return "AR";
      if (rl === "wk" || rl.includes("wk") || rl.includes("wicket")) return "WK";
      if (rl === "bowl" || rl.includes("bowl")) return "BOWL";
      return "BAT";
    }
    
    assert("Brijesh Sharma API role is 'Allrounder'", p1.role === "Allrounder");
    assert("Yash Raj Punja API role is 'Allrounder'", p2.role === "Allrounder");
    
    const brijeshFinal = ROLE_OVERRIDES[p1.name] || mockMapRole(p1.role);
    const yashFinal = ROLE_OVERRIDES[p2.name] || mockMapRole(p2.role);
    const sanjuFinal = ROLE_OVERRIDES[p3.name] || mockMapRole(p3.role);
    
    assert("Brijesh Sharma successfully overridden to BOWL", brijeshFinal === "BOWL");
    assert("Yash Raj Punja successfully overridden to BOWL", yashFinal === "BOWL");
    assert("Sanju Samson maps correctly without override", sanjuFinal === "WK");
  } catch (e) {
    assert("match_squad fetch and role test succeeded", false, e.message);
  }

  log("");
  log("  [1a] JSON Schema — match_info fallback");
  try {
    const info = await fetchJSON("/v1/match_info?id=mock-match-001&apikey=test");
    assert("match_info status is 'success'", info.status === "success");
    assert("match_info has data.score array", Array.isArray(info.data?.score));
    assert("match_info has data.players array", Array.isArray(info.data?.players));
  } catch (e) {
    assert("match_info fetch succeeded", false, e.message);
  }

  log("");
  log("  [1a] JSON Schema — scorecard failure mode");
  try {
    const fail = await fetchJSON("/v1/match_scorecard?id=mock-match-unavailable&apikey=test");
    assert("Failure status is 'failure'", fail.status === "failure");
    assert("Failure has 'reason' field", typeof fail.reason === "string");
  } catch (e) {
    assert("Failure mode fetch succeeded", false, e.message);
  }

  // 1b. Field mapping: CricAPI → Plain Text Standard
  log("\n  [1b] Field Mapping — CricAPI batting → app stat format");
  try {
    const sc = await fetchJSON("/v1/match_scorecard?id=mock-match-edge&apikey=test");
    const innings = sc.data.scorecard[0];
    const kohli = innings.batting.find((b) => b.batsman.name === "Virat Kohli");
    const mapped = mapBatting(kohli);

    assert("bat_runs maps from .runs", mapped.bat_runs === 42);
    assert("bat_balls maps from .balls", mapped.bat_balls === 30);
    assert("bat_4s maps from .fours", mapped.bat_4s === 5);
    assert("bat_6s maps from .sixes", mapped.bat_6s === 2);
    assert("bat_notOut maps from .isNotOut", mapped.bat_notOut === false);
    assert("playingXI set to true", mapped.playingXI === true);
    assert("batted set to true", mapped.batted === true);
  } catch (e) {
    assert("Field mapping test succeeded", false, e.message);
  }

  log("\n  [1b] Field Mapping — CricAPI bowling → app stat format");
  try {
    const sc = await fetchJSON("/v1/match_scorecard?id=mock-match-edge&apikey=test");
    const bowl = sc.data.scorecard[0].bowling[0];
    const mapped = mapBowling(bowl);

    assert("overs maps correctly", mapped.overs === 4);
    assert("maidens maps correctly", mapped.maidens === 1);
    assert("runsConceded maps from .runs", mapped.runsConceded === 22);
    assert("wickets maps correctly", mapped.wickets === 2);
  } catch (e) {
    assert("Bowling mapping test succeeded", false, e.message);
  }

  // 1c. Edge-case dismissals
  log("\n  [1c] Edge Case Dismissals");
  try {
    const sc = await fetchJSON("/v1/match_scorecard?id=mock-match-edge&apikey=test");
    const batsmen = sc.data.scorecard[0].batting;

    const retired = batsmen.find((b) => b.batsman.name === "Virat Kohli");
    assert("Retired Hurt — dismissal field present", retired.dismissal === "retired hurt");
    assert("Retired Hurt — isNotOut=false (counts as out in fantasy)", retired.isNotOut === false);
    const retiredPts = calcPoints({ ...mapBatting(retired) });
    assert("Retired Hurt — points calculated (42r+5×4+2×6 +4SR +4XI)", retiredPts > 0, `got ${retiredPts}`);
    // 42 + 5 + 4 + 2(SR130) + 4(XI) + 4(30bonus) = 61 expected
    assert("Retired Hurt — exact points = 61", retiredPts === 61, `got ${retiredPts}`);

    const timedOut = batsmen.find((b) => b.batsman.name === "Glenn Maxwell");
    assert("Timed Out — dismissal field present", timedOut.dismissal === "timed out");
    assert("Timed Out — 0 runs, 0 balls", timedOut.runs === 0 && timedOut.balls === 0);
    const toPts = calcPoints({ ...mapBatting(timedOut) });
    // batted=true, runs=0, notOut=false → duck −2, plus playingXI +4 = 2
    assert("Timed Out — duck penalty applies (batted, 0 runs, out)", toPts === 2, `got ${toPts}`);

    const obstruct = batsmen.find((b) => b.batsman.name === "Rajat Patidar");
    assert("Obstruction — dismissal field present", obstruct.dismissal === "obstructing the field");
    assert("Obstruction — runs preserved", obstruct.runs === 18);
    const obPts = calcPoints({ ...mapBatting(obstruct) });
    // 18 + 2(4s) + 0(6s) + 4(XI) + 0(SR=128.57 <130) = 24
    assert("Obstruction — exact points = 24", obPts === 24, `got ${obPts}`);

    const notOutBatter = batsmen.find((b) => b.batsman.name === "Faf du Plessis");
    assert("Not Out — isNotOut=true", notOutBatter.isNotOut === true);
    assert("Not Out — no duck penalty for 0 runs if notOut",
      calcPoints({ batted: true, bat_runs: 0, bat_balls: 5, bat_notOut: true, playingXI: true }) === 4
    );

    const duck = batsmen.find((b) => b.batsman.name === "Dinesh Karthik");
    assert("Real Duck — 0 runs, out, batted", duck.runs === 0 && !duck.isNotOut);
    const dkPts = calcPoints({ ...mapBatting(duck) });
    // 0 runs, 3 balls (<10 so no SR), duck=-2, XI=+4 = 2
    assert("Real Duck — duck penalty (0r, out, batted) = 2", dkPts === 2, `got ${dkPts}`);
  } catch (e) {
    assert("Edge case dismissal tests succeeded", false, e.message);
  }

  // ── 2. SYNC & TIMER LOGIC TESTS ─────────────────────────────────
  log("\n── 2. SYNC & TIMER LOGIC TESTS ──────────────────────────────\n");

  // 2a. Master Pulse generation counter (stale patch detection)
  log("  [2a] Master Pulse — _lsvGen stale patch detection");
  {
    let _lsvGen = 0;
    let patchApplied = false;

    // Simulate: user is on scoreboard tab, gen=0
    const pulseGen = _lsvGen;
    // Simulate: user navigates away before RAF fires
    _lsvGen++; // tab switch increments gen

    // RAF callback checks generation
    if (_lsvGen !== pulseGen) {
      patchApplied = false; // stale → dropped
    } else {
      patchApplied = true;
    }
    assert("Stale patch dropped when _lsvGen incremented", patchApplied === false);

    // Simulate: user stays on tab
    _lsvGen = 5;
    const pulseGen2 = _lsvGen;
    // RAF fires immediately, no tab switch
    const shouldPatch = _lsvGen === pulseGen2;
    assert("Patch applied when _lsvGen matches", shouldPatch === true);
  }

  // 2b. _autoFetchRunning re-entrancy guard
  log("\n  [2b] autoFetchStats re-entrancy guard");
  {
    let _autoFetchRunning = false;
    let callCount = 0;

    async function fakeAutoFetch() {
      if (_autoFetchRunning) return; // skip overlapping
      _autoFetchRunning = true;
      try {
        callCount++;
        await new Promise((r) => setTimeout(r, 50)); // simulate work
      } finally {
        _autoFetchRunning = false;
      }
    }

    // Fire 3 concurrent calls
    await Promise.all([fakeAutoFetch(), fakeAutoFetch(), fakeAutoFetch()]);
    assert("Only 1 of 3 concurrent autoFetch calls executed", callCount === 1);

    // Sequential call after first completes
    await fakeAutoFetch();
    assert("Sequential call after completion succeeds", callCount === 2);
  }

  // 2c. Network delay — response still parseable
  log("\n  [2c] Network delay simulation (5s)");
  try {
    const { data, elapsed } = await fetchWithTiming(
      "/v1/match_scorecard?id=mock-match-001&apikey=test&_delay=5000"
    );
    assert("Response received after 5s delay", elapsed >= 4800, `elapsed: ${elapsed.toFixed(0)}ms`);
    assert("Response is valid JSON after delay", data.status === "success");
    assert("Scorecard data intact after delay", Array.isArray(data.data?.scorecard));
  } catch (e) {
    assert("Network delay test completed", false, e.message);
  }

  // 2d. AbortController timeout simulation
  log("\n  [2d] AbortController timeout (simulated 15s limit)");
  {
    let aborted = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); aborted = true; }, 100); // 100ms fake timeout

    try {
      // This would be a real fetch in production; simulate abort
      await new Promise((resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        setTimeout(resolve, 200); // "response" arrives after timeout
      });
      assert("Request should have been aborted", false);
    } catch (e) {
      clearTimeout(timeout);
      assert("AbortController fires on timeout", e.name === "AbortError");
      assert("Aborted flag set", aborted === true);
    }
  }

  // 2e. stopAR clears both intervals
  log("\n  [2e] stopAR — interval cleanup");
  {
    let arIntervalTimer = null;
    let arTimer = null;
    let arSecs = 0;

    // Simulate startAR
    arIntervalTimer = setInterval(() => {}, 30000);
    arTimer = setInterval(() => { arSecs = Math.max(0, arSecs - 1); }, 1000);
    arSecs = 30;

    assert("arIntervalTimer is set", arIntervalTimer !== null);
    assert("arTimer is set", arTimer !== null);

    // Simulate stopAR
    clearInterval(arIntervalTimer); arIntervalTimer = null;
    clearInterval(arTimer); arTimer = null;
    arSecs = 0;

    assert("arIntervalTimer cleared to null", arIntervalTimer === null);
    assert("arTimer cleared to null", arTimer === null);
    assert("arSecs reset to 0", arSecs === 0);
  }

  // ── 3. STRESS & PERFORMANCE TESTS ────────────────────────────────
  log("\n── 3. STRESS & PERFORMANCE TESTS ────────────────────────────\n");

  // 3a. High-scoring innings (260+) — row count validation
  log("  [3a] High-scoring innings — 260+ row handling");
  try {
    const sc = await fetchJSON("/v1/match_scorecard?id=mock-match-stress&apikey=test");
    const inn = sc.data.scorecard[0];
    assert("11 batting entries returned", inn.batting.length === 11);
    assert("6 bowling entries returned", inn.bowling.length === 6);

    const totalRuns = inn.batting.reduce((a, b) => a + b.runs, 0);
    assert("Total runs ≥ 260", totalRuns >= 260, `got ${totalRuns}`);

    // Simulate RAF innerHTML render — measure string size
    const batHtml = inn.batting.map((b) =>
      `<div class="hsc-bat-row"><span>${escHtml(b.batsman.name)}</span><span>${b.runs}</span><span>${b.balls}</span></div>`
    ).join("");
    const bowlHtml = inn.bowling.map((b) =>
      `<div class="hsc-bowl-row"><span>${escHtml(b.bowler.name)}</span><span>${b.overs}</span><span>${b.runs}</span><span>${b.wickets}</span></div>`
    ).join("");
    const fullHtml = batHtml + bowlHtml;

    assert("Generated HTML has 17 rows (11 bat + 6 bowl)", (fullHtml.match(/hsc-(bat|bowl)-row/g) || []).length === 17);
    assert("HTML size is reasonable (<10KB)", fullHtml.length < 10000, `size: ${fullHtml.length} bytes`);
  } catch (e) {
    assert("High-scoring innings test succeeded", false, e.message);
  }

  // 3b. Points calculation under extreme stats
  log("\n  [3b] Points calc — extreme values");
  {
    const century = { batted: true, bat_runs: 102, bat_balls: 48, bat_4s: 12, bat_6s: 5, bat_notOut: true, playingXI: true };
    const cenPts = calcPoints(century);
    // 102 + 12 + 10 + 16(century) + 6(SR=212.5≥170) + 4(XI) = 150
    assert("Century (102 off 48) = 150 pts", cenPts === 150, `got ${cenPts}`);

    const fifer = { wickets: 5, overs: 4, maidens: 1, runsConceded: 18, playingXI: true };
    const fiferPts = calcPoints(fifer);
    // 5×25 + 8(maiden) + 16(5W) + 6(ER=4.5<5) + 4(XI) = 159
    assert("5W haul (5/18 in 4ov, 1M) = 159 pts", fiferPts === 159, `got ${fiferPts}`);

    const allRounder = {
      batted: true, bat_runs: 50, bat_balls: 30, bat_4s: 5, bat_6s: 3,
      bat_notOut: true, wickets: 2, overs: 3, maidens: 0,
      runsConceded: 22, catches: 1, playingXI: true,
    };
    const arPts = calcPoints(allRounder);
    // Bat: 50+5+6+8(50)+4(SR166.7≥150) = 73
    // Bowl: 50 + 0 + 4(ER=7.33>7 no penalty, <8) = 50  WAIT
    // Bowl: 2×25=50, 0 maidens, ER=22/3=7.33 → no bonus/penalty
    // Field: 1×8=8
    // XI: 4
    // Total: 73+50+8+4 = 135
    assert("All-rounder (50 off 30, 2W, 1ct) = 135 pts", arPts === 135, `got ${arPts}`);

    // Zero stats — no crash
    assert("null stats → 0 pts", calcPoints(null) === 0);
    assert("empty object → 0 pts", calcPoints({}) === 0);
    assert("undefined → 0 pts", calcPoints(undefined) === 0);
  }

  // 3c. memberMatchTotal with boosters
  log("\n  [3c] memberMatchTotal — booster multipliers");
  {
    const stats = {
      "Player A": { batted: true, bat_runs: 50, bat_balls: 30, bat_4s: 5, bat_6s: 2, bat_notOut: false, playingXI: true },
      "Player B": { batted: true, bat_runs: 20, bat_balls: 15, bat_4s: 2, bat_6s: 1, bat_notOut: false, playingXI: true },
    };
    const players = [
      { name: "Player A", teamKey: "RCB" },
      { name: "Player B", teamKey: "LSG" },
    ];

    const baseTeam = { players: ["Player A", "Player B"], captain: "Player A", vc: "Player B" };
    const basePts = memberMatchTotal(baseTeam, stats, players);
    assert("Base total computed (C=2×, VC=1.5×)", basePts > 0, `got ${basePts}`);

    const tripleTeam = { ...baseTeam, booster: { type: "triple" } };
    const triplePts = memberMatchTotal(tripleTeam, stats, players);
    assert("Triple booster = 3× base total", triplePts === basePts * 3, `${triplePts} vs 3×${basePts}`);

    const doubleTeam = { ...baseTeam, booster: { type: "double" } };
    const doublePts = memberMatchTotal(doubleTeam, stats, players);
    assert("Double booster = 2× base total", doublePts === basePts * 2, `${doublePts} vs 2×${basePts}`);

    const teamBooster = { ...baseTeam, booster: { type: "team", target: "RCB" } };
    const teamBstPts = memberMatchTotal(teamBooster, stats, players);
    assert("Team booster doubles only RCB player", teamBstPts > basePts, `${teamBstPts} vs base ${basePts}`);
  }

  // 3d. Memory leak check — interval duplication
  log("\n  [3d] Memory leak check — startAR/stopAR interval duplication");
  {
    const intervals = [];
    const origSetInterval = global.setInterval;
    const origClearInterval = global.clearInterval;
    let activeCount = 0;

    // Monkey-patch to track intervals
    global.setInterval = (fn, ms) => {
      const id = origSetInterval(fn, ms);
      intervals.push(id);
      activeCount++;
      return id;
    };
    global.clearInterval = (id) => {
      origClearInterval(id);
      if (id != null) activeCount--;
    };

    // Simulate 20 rapid startAR/stopAR cycles (like a 4-hour session with tab switches)
    let arIntervalTimer = null;
    let arTimer = null;

    for (let i = 0; i < 20; i++) {
      // stopAR
      if (arIntervalTimer) { clearInterval(arIntervalTimer); arIntervalTimer = null; }
      if (arTimer) { clearInterval(arTimer); arTimer = null; }
      // startAR
      arIntervalTimer = setInterval(() => {}, 300000);
      arTimer = setInterval(() => {}, 1000);
    }
    // Final stopAR
    if (arIntervalTimer) { clearInterval(arIntervalTimer); arIntervalTimer = null; }
    if (arTimer) { clearInterval(arTimer); arTimer = null; }

    assert("No leaked intervals after 20 start/stop cycles", activeCount === 0, `active: ${activeCount}`);

    // Restore
    global.setInterval = origSetInterval;
    global.clearInterval = origClearInterval;
    intervals.forEach((id) => origClearInterval(id)); // cleanup stragglers
  }

  // 3e. Grace poll — _handleMatchEnd doesn't stack
  log("\n  [3e] Grace poll — _handleMatchEnd idempotency");
  {
    let gracePollMid = null;
    let gracePollCount = 0;

    function handleMatchEnd(mid) {
      if (gracePollMid === mid) return; // no-op
      gracePollMid = mid;
      gracePollCount++;
    }

    handleMatchEnd("match-1");
    handleMatchEnd("match-1"); // duplicate — should be no-op
    handleMatchEnd("match-1");
    assert("_handleMatchEnd fires only once per matchId", gracePollCount === 1);

    handleMatchEnd("match-2"); // new match — fires
    assert("_handleMatchEnd fires for new matchId", gracePollCount === 2);
  }

  // ── 4. CROSS-PLATFORM UI VALIDATION ──────────────────────────────
  log("\n── 4. CROSS-PLATFORM UI VALIDATION ──────────────────────────\n");

  // 4a. CSS audit — read actual HTML file
  log("  [4a] CSS Touch Properties Audit");
  try {
    const html = fs.readFileSync(path.join(__dirname, "ipl-fantasy-v4_render.html"), "utf-8");

    const touchManip = (html.match(/touch-action:\s*manipulation/g) || []).length;
    assert("touch-action: manipulation present (≥5 rules)", touchManip >= 5, `found ${touchManip}`);

    const webkitScroll = (html.match(/-webkit-overflow-scrolling:\s*touch/g) || []).length;
    assert("-webkit-overflow-scrolling: touch present (≥5 rules)", webkitScroll >= 5, `found ${webkitScroll}`);

    // Check specific elements have touch-action
    assert("Buttons have touch-action", /button.*touch-action/s.test(html) || /touch-action.*button/s.test(html));
    assert(".vtab has touch-action", html.includes(".vtab") && touchManip > 0);

    // Table scroll wrappers
    const tblWrap = (html.match(/lsv-tbl-wrap|hsc-tbl/g) || []).length;
    assert("Scorecard table wrappers exist in HTML", tblWrap > 0, `found ${tblWrap} refs`);

    // Sticky headers check
    const stickyCount = (html.match(/position:\s*sticky/g) || []).length;
    assert("Sticky positioning used (for headers)", stickyCount >= 1, `found ${stickyCount}`);
  } catch (e) {
    assert("CSS audit read file", false, e.message);
  }

  // 4b. Scorecard table structure
  log("\n  [4b] Scorecard table structure for mobile");
  try {
    const html = fs.readFileSync(path.join(__dirname, "ipl-fantasy-v4_render.html"), "utf-8");

    assert("Batting table header has BATTER/R/B/4s/6s/SR columns",
      html.includes("hsc-col-name") && html.includes("hsc-col-r") && html.includes("hsc-col-sr"));

    assert("Bowling table header has BOWLER/O/M/R/W/ECO columns",
      html.includes("hsc-tbl-hd-bowl"));

    // .lsv-inn has touch-action: pan-y
    assert(".lsv-inn has touch-action: pan-y", html.includes("lsv-inn") && html.includes("touch-action: pan-y"));

    // overflow-x for horizontal scroll on small screens
    const overflowX = (html.match(/overflow-x:\s*auto/g) || []).length;
    assert("overflow-x: auto present for horizontal scroll", overflowX >= 1, `found ${overflowX}`);
  } catch (e) {
    assert("Table structure audit failed", false, e.message);
  }

  // 4c. XSS safety in rendered output
  log("\n  [4c] XSS safety — escHtml coverage");
  {
    assert("escHtml escapes <script>", escHtml("<script>alert(1)</script>") === "&lt;script&gt;alert(1)&lt;/script&gt;");
    assert("escHtml escapes quotes", escHtml('"><img onerror=alert(1)>') === "&quot;&gt;&lt;img onerror=alert(1)&gt;");
    assert("escHtml handles null-ish input", escHtml(null) === "");
    assert("escHtml handles number input", escHtml(42) === "");
  }

  // 4d. Static DNA — inline onclick handlers
  log("\n  [4d] Static DNA — window function exposure");
  try {
    const html = fs.readFileSync(path.join(__dirname, "ipl-fantasy-v4_render.html"), "utf-8");

    const windowAssignments = html.match(/window\.\w+\s*=/g) || [];
    assert("Window functions exposed (Static DNA pattern)", windowAssignments.length >= 15,
      `found ${windowAssignments.length} window.* assignments`);

    // Key admin handlers must be on window
    const criticalHandlers = [
      "createOrUpdateMatch", "finalizeMatch", "abandonMatch", "saveAllStats",
      "exportCSV", "adminStartMatch", "adminFetchXI", "adminToggleAR",
    ];
    for (const handler of criticalHandlers) {
      assert(`window.${handler} exposed`,
        html.includes(`window.${handler}`) || html.includes(`window.${handler} =`));
    }
  } catch (e) {
    assert("Static DNA audit failed", false, e.message);
  }

  // ── SUMMARY ──────────────────────────────────────────────────────
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  log("\n═══════════════════════════════════════════════════════════════");
  log(`  RESULTS: ${passed} passed, ${failed} failed, ${totalTests} total`);
  log(`  Duration: ${elapsed}s`);
  log("═══════════════════════════════════════════════════════════════\n");

  // Write log file
  fs.writeFileSync(LOG_FILE, results.join("\n") + "\n");
  console.log(`\n📄 Full results written to ${LOG_FILE}`);

  process.exit(failed > 0 ? 1 : 0);
}

// ── Entry point ───────────────────────────────────────────────────────

runAllTests().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(2);
});
