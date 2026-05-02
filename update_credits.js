const fs = require('fs');

const updates = {
  "Shubman Gill": 10,
  "Jos Buttler": 10,
  "Sai Sudharsan": 10,
  "Ravisrinivasan Sai Kishore": 9.5, // "Sai Kishore" mapped to full name if needed, but I'll add both
  "Sai Kishore": 9.5,
  "Rashid Khan": 9.5,
  "Prasidh Krishna": 9,
  "Rahul Tewatia": 9,
  "Washington Sundar": 8.5,
  "Shahrukh Khan": 8.5,
  "Ishant Sharma": 8,
  "Jason Holder": 8,
  "Glenn Phillips": 8,
  "Arshad Khan": 8,
  "Kagiso Rabada": 7.5,
  "Nishant Sindhu": 7.5,
  "Kumar Kushagra": 7,
  "Connor Esterhuizen": 7,
  "Luke Wood": 7,
  "Gurnoor Brar": 7,
  "Jayant Yadav": 7,
  "Prithvi Raj Yarra": 7,
  "Kulwant Khejroliya": 7,
  "Tom Banton": 7,
  "Anuj Rawat": 7,
  "Ashok Sharma": 7,
  "Manav Suthar": 7
};

let content = fs.readFileSync('ipl-fantasy-v4_render.html', 'utf8');

// Find where PLAYER_CREDITS ends.
const regex = /const PLAYER_CREDITS = \{([\s\S]*?)\n      \};/;
const match = content.match(regex);

if (match) {
  let inner = match[1];
  
  // We can just append the new values at the end of the object literal so they override the previous ones
  let newEntries = "\n\n        // --- GUJARAT TITANS (Verified) ---\n" + Object.entries(updates).map(([k,v]) => `        "${k}": ${v},`).join("\n");
  
  content = content.replace(regex, `const PLAYER_CREDITS = {${inner}${newEntries}\n      };`);
  fs.writeFileSync('ipl-fantasy-v4_render.html', content);
  console.log("Credits updated successfully!");
} else {
  console.log("Could not find PLAYER_CREDITS in file.");
}
