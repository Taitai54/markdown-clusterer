// This is a manual instruction for myself/user or a script if I could run electron headless easily.
// Instead, I'll modify the threshold in main.js temporarily to "2" to force the batch path with just a few files.

const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'electron/main.js');
let content = fs.readFileSync(mainPath, 'utf-8');

// Force threshold to 2 for testing
const newContent = content.replace('const LARGE_DATASET_THRESHOLD = 50;', 'const LARGE_DATASET_THRESHOLD = 2;');

fs.writeFileSync(mainPath, newContent);
console.log('Modified main.js to force batch mode (Threshold = 2)');
