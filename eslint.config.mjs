import html from "eslint-plugin-html";
import globals from "globals";

export default [
  {
    files: ["**/*.html"],
    plugins: {
      html
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        firebase: "readonly",
        google: "readonly",
        // Firestore functions imported via CDN
        doc: "readonly",
        getDoc: "readonly",
        setDoc: "readonly",
        updateDoc: "readonly",
        deleteDoc: "readonly",
        onSnapshot: "readonly",
        collection: "readonly",
        getDocs: "readonly",
        runTransaction: "readonly",
        serverTimestamp: "readonly",
        // Project globals (attached to window or local module scope)
        metaGame: "writable",
        allMembers: "readonly",
        playerStats: "readonly",
        activeMatches: "writable",
        localTeam: "writable",
        currentMatchId: "writable",
        memberSelectedMatchId: "writable",
        adminSelectedMatchId: "writable",
        _refreshTimer: "writable",
        _autoFetchRunning: "readonly",
        _lsvGen: "writable",
        session: "writable",
        getActiveMid: "readonly",
        getMatch: "readonly",
        getStats: "readonly",
        getBoosterInventory: "readonly",
        memberMatchTotal: "readonly",
        calcPoints: "readonly",
        toRealOvers: "readonly",
        robustMatch: "readonly",
        resolveTeamKey: "readonly",
        escHtml: "readonly",
        escAttr: "readonly",
        toast: "readonly",
        switchTab: "readonly",
        switchAdminTab: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn"
    }
  }
];
