const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const cssLink = '<link href="styles.css" rel="stylesheet" />';

let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  const oldContent = content;

  // Replace script link
  content = content.replace(/<script\s+src="https:\/\/cdn\.tailwindcss\.com.*?"\s*><\/script>\s*/gi, cssLink + '\n    ');

  // Find the exact script block containing 'tailwind.config ='
  const startIdx = content.indexOf('<script>');
  if (startIdx !== -1) {
    const snippet = content.slice(startIdx, startIdx + 250);
    if (snippet.includes('tailwind.config')) {
      const endIdx = content.indexOf('</script>', startIdx);
      if (endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx + 9);
      }
    }
  }

  if (oldContent !== content) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    count++;
  }
}

console.log(`Finished updating ${count} HTML files.`);