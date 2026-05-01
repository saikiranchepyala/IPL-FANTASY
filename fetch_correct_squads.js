const fs = require('fs');
const http = require('https');

const API_KEY = "a311eeb5-0c69-45c5-bbc7-0cc35d781b0e";
const SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"; // IPL 2026

http.get(`https://api.cricapi.com/v1/series_squad?apikey=${API_KEY}&id=${SERIES_ID}`, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.status !== "success") {
      console.error("API Error:", json.reason);
      return;
    }
    
    const teams = json.data;
    let markdown = "# Corrected IPL 2026 Player Credits Review\n\n";
    
    // Existing credits for cross-referencing
    const EXISTING_CREDITS = {
        "Virat Kohli": 11, "Rohit Sharma": 11, "Jasprit Bumrah": 11, "Suryakumar Yadav": 11,
        "Jos Buttler": 11, "Rashid Khan": 11, "Pat Cummins": 11, "Rishabh Pant": 11, "Cameron Green": 11,
        "Shubman Gill": 10, "Yashasvi Jaiswal": 10, "KL Rahul": 10, "Sanju Samson": 10, "Hardik Pandya": 10,
        "Ravindra Jadeja": 10, "Mitchell Starc": 10, "Trent Boult": 10, "Travis Head": 10, "Heinrich Klaasen": 10,
        "Kagiso Rabada": 10, "Josh Hazlewood": 10, "Liam Livingstone": 10, "Varun Chakravarthy": 10, "Jofra Archer": 10,
        "Ruturaj Gaikwad": 9, "Tilak Varma": 9, "Rinku Singh": 9, "Shreyas Iyer": 9, "Abhishek Sharma": 9, "Riyan Parag": 9,
        "B Sai Sudharsan": 9, "Sai Sudharsan": 9, "Nicholas Pooran": 9, "Tim David": 9, "Sam Curran": 9,
        "Yuzvendra Chahal": 9, "Mohammed Siraj": 9, "Arshdeep Singh": 9, "Bhuvneshwar Kumar": 9, "T Natarajan": 9,
        "Axar Patel": 9, "Kuldeep Yadav": 9, "Ravi Bishnoi": 9, "David Miller": 9, "Shimron Hetmyer": 9,
        "Aiden Markram": 9, "Sunil Narine": 9, "Phil Salt": 10, "Rachin Ravindra": 9, "Matheesha Pathirana": 9,
        "Nitish Kumar Reddy": 9, "Ishan Kishan": 9, "Mohammad Shami": 9, "Mayank Yadav": 9,
    };
    
    let allPlayers = [];
    teams.forEach(team => {
      team.players.forEach(p => {
        allPlayers.push({ name: p.name, team: team.teamName, role: p.role });
      });
    });
    
    teams.forEach(team => {
      markdown += `## ${team.teamName}\n`;
      markdown += `| Player | Role | Current Credit | Suggested Credit |\n`;
      markdown += `|---|---|---|---|\n`;
      
      team.players.forEach(p => {
        const current = EXISTING_CREDITS[p.name] || (EXISTING_CREDITS[p.name.split(" ").pop()] ? 7.5 : 7);
        markdown += `| ${p.name} | ${p.role} | ${current} |  |\n`;
      });
      markdown += `\n`;
    });
    
    fs.writeFileSync('Corrected_Squad_Review.md', markdown);
    console.log("Generated Corrected_Squad_Review.md successfully.");
  });
});
