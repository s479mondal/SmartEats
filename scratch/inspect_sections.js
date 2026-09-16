const fs = require('fs');
const text = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');

// Print sections with line ranges
const lines = text.split('\n');
let currentSec = null;
let secMap = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (lines[i-1] && lines[i-1].match(/^=+\s*$/) && line.match(/^[0-9]+\./)) {
    currentSec = line.trim();
    secMap[currentSec] = [];
  } else if (currentSec) {
    secMap[currentSec].push(line);
  }
}

for (const [sec, content] of Object.entries(secMap)) {
  console.log(`\n### ${sec}`);
  console.log(content.slice(0, 15).join('\n'));
}
