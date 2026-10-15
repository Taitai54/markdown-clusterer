const path = require('path');

// Copied from electron/main.js for verification
function extractHeadline(content, filename) {
    // 1. Try to find frontmatter title
    const frontmatterMatch = content.match(/^---\s*[\s\S]*?title:\s*(.+?)\s*[\r\n][\s\S]*?---/);
    if (frontmatterMatch && frontmatterMatch[1]) {
        return frontmatterMatch[1].replace(/^["']|["']$/g, '').trim(); // Remove quotes if present
    }

    // 2. Try to find first markdown header # Header
    const headerMatch = content.match(/^#\s+(.+)$/m);
    if (headerMatch && headerMatch[1]) {
        return headerMatch[1].trim();
    }

    // 3. Fallback to filename without extension
    return path.parse(filename).name;
}

function extractTags(content) {
    const frontmatterMatch = content.match(/^---\s*[\s\S]*?tags:\s*\[(.*?)\][\s\S]*?---/);
    if (frontmatterMatch && frontmatterMatch[1]) {
        return frontmatterMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
    }
    return [];
}

// Test Cases
const tests = [
    {
        name: 'Frontmatter Title',
        content: '---\ntitle: "My Great Post"\n---\n# Content',
        filename: 'post.md',
        expectedHeadline: 'My Great Post'
    },
    {
        name: 'Markdown Header',
        content: 'Just some text\n# Actual Header\nMore text',
        filename: 'header.md',
        expectedHeadline: 'Actual Header'
    },
    {
        name: 'Fallback Filename',
        content: 'Just text, no header',
        filename: 'fallback-file.md',
        expectedHeadline: 'fallback-file'
    },
    {
        name: 'Tags Extraction',
        content: '---\ntags: [ai, coding, electron]\n---',
        filename: 'tags.md',
        expectedTags: ['ai', 'coding', 'electron']
    }
];

let passed = 0;
let failed = 0;

console.log('Running Verification Tests...\n');

tests.forEach(test => {
    if (test.expectedHeadline) {
        const result = extractHeadline(test.content, test.filename);
        if (result === test.expectedHeadline) {
            console.log(`✅ ${test.name}: Passed`);
            passed++;
        } else {
            console.log(`❌ ${test.name}: Failed (Expected "${test.expectedHeadline}", got "${result}")`);
            failed++;
        }
    }

    if (test.expectedTags) {
        const result = extractTags(test.content);
        if (JSON.stringify(result) === JSON.stringify(test.expectedTags)) {
            console.log(`✅ ${test.name}: Passed`);
            passed++;
        } else {
            console.log(`❌ ${test.name}: Failed`);
            failed++;
        }
    }
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
