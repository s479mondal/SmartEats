const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/lenovo/.gemini/antigravity-ide/brain/cc420439-f886-4467-a40a-b3608683b18e/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});

let found = null;
rl.on('line', (line) => {
  if (line.includes('"type":"USER_INPUT"') && line.includes('COMPLETE CURRENT-STATE UPDATE')) {
    found = JSON.parse(line);
  }
});

rl.on('close', () => {
  if (found) {
    fs.writeFileSync('scratch/user_prompt_7_full.txt', found.content);
    console.log('Saved full prompt! Length:', found.content.length);
  } else {
    console.log('Not found in full transcript');
  }
});
