const fs = require('fs');
const content = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');

const lines = content.split('\n');
const sections = [];
lines.forEach((l, idx) => {
  if (l.match(/^=+\s*$/) && lines[idx+1] && lines[idx+1].match(/^[0-9]+\./)) {
    sections.push({ line: idx + 2, text: lines[idx+1].trim() });
  }
});
console.log(JSON.stringify(sections, null, 2));
