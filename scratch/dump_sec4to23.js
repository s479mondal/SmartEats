const fs = require('fs');
const text = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');
const lines = text.split('\n');

let sec4to23 = [];
let capture = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('4. FRONTEND CURRENT STATUS')) {
    capture = true;
  } else if (lines[i].includes('24. VIVA UNDERSTANDING')) {
    capture = false;
  }
  if (capture) {
    sec4to23.push(lines[i]);
  }
}
fs.writeFileSync('scratch/sec4to23.txt', sec4to23.join('\n'));
console.log('Done, length:', sec4to23.length);
