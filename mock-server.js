// ═══════════════════════════════════════════════════════════════════════
//  mock-server.js — Local CricAPI mock for IPL Fantasy League testing
//  Usage: node mock-server.js [--port 3333] [--delay 0]
//  Serves fake CricAPI responses at http://localhost:3333/v1/*
// ═══════════════════════════════════════════════════════════════════════

const http = require("http");
const url = require("url");

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") || "3333");
const BASE_DELAY = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--delay") || "0");

// ── Fixtures ──────────────────────────────────────────────────────────

const PLAYERS_T1 = [
  { id: "p1001", name: "Virat Kohli" },
  { id: "p1002", name: "Faf du Plessis" },
  { id: "p1003", name: "Glenn Maxwell" },
  { id: "p1004", name: "Dinesh Karthik" },
  { id: "p1005", name: "Rajat Patidar" },
  { id: "p1006", name: "Cameron Green" },
  { id: "p1007", name: "Wanindu Hasaranga" },
  { id: "p1008", name: "Harshal Patel" },
  { id: "p1009", name: "Mohammed Siraj" },
  { id: "p1010", name: "Josh Hazlewood" },
  { id: "p1011", name: "Yash Dayal" },
];

const PLAYERS_T2 = [
  { id: "p2001", name: "KL Rahul" },
  { id: "p2002", name: "Quinton de Kock" },
  { id: "p2003", name: "Marcus Stoinis" },
  { id: "p2004", name: "Nicholas Pooran" },
  { id: "p2005", name: "Krunal Pandya" },
  { id: "p2006", name: "Deepak Hooda" },
  { id: "p2007", name: "Ravi Bishnoi" },
  { id: "p2008", name: "Mohsin Khan" },
  { id: "p2009", name: "Avesh Khan" },
  { id: "p2010", name: "Mark Wood" },
  { id: "p2011", name: "Manan Vohra" },
];

// Standard innings — normal match
function standardScorecard() {
  return {
    status: "success",
    data: {
      id: "mock-match-001",
      name: "Royal Challengers Bengaluru vs Lucknow Super Giants, 42nd Match",
      status: "Lucknow Super Giants won by 5 wickets",
      venue: "M. Chinnaswamy Stadium, Bengaluru",
      matchType: "t20",
      matchStarted: true,
      matchEnded: true,
      score: [
        { r: 181, w: 7, o: 20, inning: "Royal Challengers Bengaluru Inning 1" },
        { r: 185, w: 5, o: 18.3, inning: "Lucknow Super Giants Inning 1" },
      ],
      tpiplayerstats: buildPlayerStats("normal"),
      scorecard: [
        buildInning("Royal Challengers Bengaluru Inning 1", "batting-t1-normal", "bowling-t2-normal"),
        buildInning("Lucknow Super Giants Inning 1", "batting-t2-normal", "bowling-t1-normal"),
      ],
      players: [
        ...PLAYERS_T1.map((p) => ({ ...p, country: "RCB", status: "playing" })),
        ...PLAYERS_T2.map((p) => ({ ...p, country: "LSG", status: "playing" })),
      ],
    },
  };
}

// High-scoring innings — 260+ stress test
function highScoringScorecard() {
  const batsmen = [];
  // 11 batsmen — simulates a 260+ total where most contribute
  const scores = [92, 65, 48, 33, 27, 15, 12, 8, 3, 1, 0];
  const balls =  [38, 30, 22, 18, 12,  6,  5, 3, 2, 1, 1];
  for (let i = 0; i < 11; i++) {
    batsmen.push({
      batsman: { id: PLAYERS_T1[i].id, name: PLAYERS_T1[i].name },
      runs: scores[i],
      balls: balls[i],
      fours: Math.floor(scores[i] / 8),
      sixes: Math.floor(scores[i] / 15),
      strikeRate: balls[i] > 0 ? ((scores[i] / balls[i]) * 100).toFixed(2) : "0.00",
      dismissal: i < 7 ? "c Fielder b Bowler" : "not out",
      isNotOut: i >= 7,
    });
  }
  // 6+ bowlers from T2
  const bowlers = PLAYERS_T2.slice(5).map((p, i) => ({
    bowler: { id: p.id, name: p.name },
    overs: [4, 4, 4, 3, 3, 2][i] || 2,
    maidens: 0,
    runs: [42, 55, 38, 48, 35, 45][i] || 30,
    wickets: [2, 0, 3, 1, 1, 0][i] || 0,
    economy: 0, // computed by tests
  }));

  return {
    status: "success",
    data: {
      id: "mock-match-stress",
      name: "Stress Test Match — 263/3",
      status: "Royal Challengers Bengaluru 263/3 (20 ov)",
      venue: "Wankhede Stadium, Mumbai",
      matchType: "t20",
      matchStarted: true,
      matchEnded: false,
      score: [{ r: 263, w: 3, o: 20, inning: "Royal Challengers Bengaluru Inning 1" }],
      scorecard: [
        {
          inning: "Royal Challengers Bengaluru Inning 1",
          batting: batsmen,
          bowling: bowlers,
        },
      ],
      players: PLAYERS_T1.map((p) => ({ ...p, country: "RCB", status: "playing" })),
    },
  };
}

// Edge-case dismissals: Retired Hurt, Timed Out, Obstructing the Field
function edgeCaseDismissals() {
  return {
    status: "success",
    data: {
      id: "mock-match-edge",
      name: "Edge Case Dismissal Test",
      status: "In Progress",
      venue: "Test Ground",
      matchType: "t20",
      matchStarted: true,
      matchEnded: false,
      score: [{ r: 145, w: 4, o: 15.2, inning: "Royal Challengers Bengaluru Inning 1" }],
      scorecard: [
        {
          inning: "Royal Challengers Bengaluru Inning 1",
          batting: [
            {
              batsman: { id: "p1001", name: "Virat Kohli" },
              runs: 42, balls: 30, fours: 5, sixes: 2,
              strikeRate: "140.00",
              dismissal: "retired hurt",
              isNotOut: false,
            },
            {
              batsman: { id: "p1003", name: "Glenn Maxwell" },
              runs: 0, balls: 0, fours: 0, sixes: 0,
              strikeRate: "0.00",
              dismissal: "timed out",
              isNotOut: false,
            },
            {
              batsman: { id: "p1005", name: "Rajat Patidar" },
              runs: 18, balls: 14, fours: 2, sixes: 0,
              strikeRate: "128.57",
              dismissal: "obstructing the field",
              isNotOut: false,
            },
            {
              batsman: { id: "p1002", name: "Faf du Plessis" },
              runs: 65, balls: 40, fours: 7, sixes: 3,
              strikeRate: "162.50",
              dismissal: "not out",
              isNotOut: true,
            },
            {
              batsman: { id: "p1004", name: "Dinesh Karthik" },
              runs: 0, balls: 3, fours: 0, sixes: 0,
              strikeRate: "0.00",
              dismissal: "c Pooran b Bishnoi",
              isNotOut: false,
            },
          ],
          bowling: [
            {
              bowler: { id: "p2007", name: "Ravi Bishnoi" },
              overs: 4, maidens: 1, runs: 22, wickets: 2, economy: 5.5,
            },
          ],
        },
      ],
      players: PLAYERS_T1.map((p) => ({ ...p, country: "RCB", status: "playing" })),
    },
  };
}

// Scorecard not yet available (pre-toss / early match)
function scorecardUnavailable() {
  return {
    status: "failure",
    reason: "Scorecard not available yet",
  };
}

// Match info fallback (used when scorecard endpoint fails)
function matchInfoFallback() {
  return {
    status: "success",
    data: {
      id: "mock-match-001",
      name: "Royal Challengers Bengaluru vs Lucknow Super Giants",
      status: "Match not started",
      score: [],
      players: [
        ...PLAYERS_T1.map((p) => ({ ...p, country: "RCB", status: "playing" })),
        ...PLAYERS_T2.map((p) => ({ ...p, country: "LSG", status: "playing" })),
      ],
    },
  };
}

function buildInning(label, batKey, bowlKey) {
  // Minimal — tests should use the specific fixture functions above
  return { inning: label, batting: [], bowling: [] };
}

function buildPlayerStats(variant) {
  return []; // tpiplayerstats not used by the fantasy app
}

// ── Route handler ──────────────────────────────────────────────────

const routes = {
  "/v1/match_scorecard": (params) => {
    const id = params.id || "";
    if (id === "mock-match-stress") return highScoringScorecard();
    if (id === "mock-match-edge") return edgeCaseDismissals();
    if (id === "mock-match-unavailable") return scorecardUnavailable();
    return standardScorecard();
  },
  "/v1/match_info": (params) => {
    return matchInfoFallback();
  },
  "/v1/currentMatches": () => ({
    status: "success",
    data: [
      {
        id: "mock-match-001",
        name: "RCB vs LSG",
        status: "In Progress",
        score: [{ r: 145, w: 3, o: 15.2, inning: "RCB Inning 1" }],
      },
    ],
  }),
  "/v1/players_info": (params) => ({
    status: "success",
    data: {
      id: params.id || "unknown",
      name: "Test Player",
      country: "India",
      stats: [
        { fn: "ipl", matchtype: "t20", stat: { batting: { innings: 100, runs: 3500 }, bowling: { innings: 20, wickets: 10 } } },
      ],
    },
  }),
};

// ── Server ──────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const params = parsed.query;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const handler = routes[path];
  if (!handler) {
    res.writeHead(404);
    res.end(JSON.stringify({ status: "failure", reason: `Unknown endpoint: ${path}` }));
    return;
  }

  const delay = params._delay ? parseInt(params._delay) : BASE_DELAY;
  setTimeout(() => {
    const body = handler(params);
    res.writeHead(200);
    res.end(JSON.stringify(body));
  }, delay);
});

server.listen(PORT, () => {
  console.log(`🏏 CricAPI Mock Server running at http://localhost:${PORT}`);
  console.log(`   Base delay: ${BASE_DELAY}ms (override per-request with ?_delay=5000)`);
  console.log(`\n   Endpoints:`);
  console.log(`     GET /v1/match_scorecard?id=mock-match-001       — normal match`);
  console.log(`     GET /v1/match_scorecard?id=mock-match-stress    — 260+ innings (11 bat, 6 bowl)`);
  console.log(`     GET /v1/match_scorecard?id=mock-match-edge      — retired hurt / timed out / obstruction`);
  console.log(`     GET /v1/match_scorecard?id=mock-match-unavailable — scorecard failure`);
  console.log(`     GET /v1/match_info?id=mock-match-001            — match_info fallback`);
  console.log(`     GET /v1/currentMatches                          — active matches ticker`);
  console.log(`     GET /v1/players_info?id=p1001                   — player career stats`);
  console.log(`\n   Tip: ?_delay=5000 on any endpoint simulates network lag`);
});
