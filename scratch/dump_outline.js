const fs = require('fs');
const content = fs.readFileSync('scratch/user_prompt_7_full.txt', 'utf8');

// Let's write out chunks or full text so we can examine all questions
fs.writeFileSync('scratch/all_sections_outline.txt', content);
console.log('Outlined written. Total chars:', content.length);
