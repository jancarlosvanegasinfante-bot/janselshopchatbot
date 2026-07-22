const fs = require('fs');
const path = require('path');

const imagesDir = path.join(process.cwd(), 'public', 'images');
const files = fs.readdirSync(imagesDir);

console.log('--- Searching public/images for target substrings ---');
const targets = ['bichota', 'audifonos', 'bombillo', 'cables', 'aceite'];

targets.forEach(t => {
  const matches = files.filter(f => f.toLowerCase().includes(t));
  console.log(`Target "${t}":`);
  matches.forEach(m => console.log(`  - ${m}`));
});
