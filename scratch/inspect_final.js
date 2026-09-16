const fs = require('fs');
const text = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');
const lines = text.split('\n');

let inFinal = false;
let finalLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('25. FINAL END-TO-END DIAGRAM')) {
    inFinal = true;
  }
  if (inFinal) {
    finalLines.push(lines[i]);
  }
}
console.log(finalLines.join('\n'));
