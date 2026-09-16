const fs = require('fs');
const text = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');
const lines = text.split('\n');

let inViva = false;
let vivaLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('24. VIVA UNDERSTANDING')) {
    inViva = true;
  } else if (lines[i].includes('25. FINAL END-TO-END DIAGRAM')) {
    inViva = false;
  }
  if (inViva) {
    vivaLines.push(lines[i]);
  }
}
console.log(vivaLines.join('\n'));
