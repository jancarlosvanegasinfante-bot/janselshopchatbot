const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'local_db.json');
const mapPath = path.join(process.cwd(), 'src', 'original-images-map.json');

if (!fs.existsSync(dbPath) || !fs.existsSync(mapPath)) {
  console.log('Files do not exist');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const products = db.products || {};
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Helper to normalize strings for comparison
function cleanStr(s) {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, '');   // keep only alphanumeric
}

const mapEntries = Object.entries(map).map(([k, v]) => ({
  key: k,
  cleanKey: cleanStr(k),
  url: v
}));

console.log('--- Matching results ---');
let matchedCount = 0;
let unmatchedCount = 0;

Object.values(products).forEach(p => {
  const url = p.imageUrl || '';
  // We only care about products that have local images currently
  if (url.startsWith('/images/')) {
    const pName = p.name;
    const cleanName = cleanStr(pName);
    
    // Find best match in mapEntries
    let bestMatch = null;
    let bestScore = 0;
    
    mapEntries.forEach(entry => {
      // Metric 1: Check if one is substring of another
      let score = 0;
      if (cleanName === entry.cleanKey) {
        score = 100;
      } else if (cleanName.includes(entry.cleanKey) || entry.cleanKey.includes(cleanName)) {
        score = 90;
      } else {
        // Simple overlap score: count common alphanumeric characters (or words)
        // Let's split into chunks of 3 characters or words
        const words1 = pName.toLowerCase().split(/[^a-z0-9]+/);
        const words2 = entry.key.toLowerCase().split(/[^a-z0-9]+/);
        const commonWords = words1.filter(w => w && words2.includes(w));
        score = (commonWords.length / Math.max(words1.length, words2.length)) * 80;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    });
    
    if (bestScore >= 30) {
      matchedCount++;
      console.log(`Matched: "${pName}" -> key: "${bestMatch.key}" (Score: ${bestScore.toFixed(0)})`);
      console.log(`  - Local: "${p.imageUrl}"`);
      console.log(`  - Original external URL: "${bestMatch.url}"`);
    } else {
      unmatchedCount++;
      console.log(`❌ UNMATCHED: "${pName}" (Best was "${bestMatch ? bestMatch.key : 'none'}" with score ${bestScore.toFixed(0)})`);
    }
  }
});

console.log(`\nMatched: ${matchedCount}, Unmatched: ${unmatchedCount}`);
