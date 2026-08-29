import fs from 'fs';
import path from 'path';

const dir = 'artifacts/arabic-poetry/src';

const mappings = [
  [/text-charcoal-950/g, 'text-sand-50'],
  [/text-charcoal-600/g, 'text-ink-400'],
  [/border-charcoal-850/g, 'border-sand-300'],
  [/border-charcoal-750/g, 'border-sand-300'],
  [/placeholder-parchment-400/g, 'placeholder-ink-300'],
  [/shadow-gold-500\/20/g, 'shadow-crimson-800\/20'],
  [/shadow-gold-500\/5/g, 'shadow-crimson-800\/5'],
  [/shadow-gold-500\/30/g, 'shadow-crimson-800\/30'],
  [/shadow-gold-500\/50/g, 'shadow-crimson-800\/50'],
  [/ring-gold-400\/80/g, 'ring-crimson-700\/80'],
  [/border-gold-400\/60/g, 'border-crimson-700\/60'],
];

function processDir(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content;
      for (const [regex, replacement] of mappings) {
        newContent = newContent.replace(regex, replacement);
      }
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }
    }
  }
}

processDir(dir);
console.log('Cleanup mapped!');
