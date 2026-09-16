const fs = require('fs');
const content = fs.readFileSync('scratch/user_prompt_7_clean.txt', 'utf8');

// Find all numbered section titles
const lines = content.split('\n');
const sections = [];
lines.forEach((l, idx) => {
  if (l.match(/^[0-9]+\.\s+[A-Z]/) || l.match(/^==+\s*[0-9]+/)) {
    sections.push({ line: idx + 1, text: l.trim() });
  }
});
console.log(JSON.stringify(sections, null, 2));
