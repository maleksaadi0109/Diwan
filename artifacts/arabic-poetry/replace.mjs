import fs from 'fs';
import path from 'path';

const dir = 'artifacts/arabic-poetry/src';

const mappings = [
  // Backgrounds
  [/bg-charcoal-950/g, 'bg-sand-100'],
  [/bg-charcoal-900/g, 'bg-sand-50'],
  [/bg-charcoal-850/g, 'bg-white'],
  [/bg-charcoal-800/g, 'bg-sand-200'],
  [/bg-charcoal-700/g, 'bg-sand-300'],
  [/bg-charcoal-600/g, 'bg-sand-400'],
  [/bg-charcoal-500/g, 'bg-sand-500'],
  
  // Text
  [/text-parchment-50/g, 'text-ink-950'],
  [/text-parchment-100/g, 'text-ink-900'],
  [/text-parchment-200/g, 'text-ink-800'],
  [/text-parchment-300/g, 'text-ink-700'],
  [/text-parchment-400/g, 'text-ink-600'],
  [/text-charcoal-400/g, 'text-ink-500'],
  [/text-charcoal-300/g, 'text-ink-400'],
  [/text-charcoal-200/g, 'text-ink-300'],
  
  // Borders
  [/border-charcoal-800/g, 'border-sand-300'],
  [/border-charcoal-700/g, 'border-sand-400'],
  [/border-charcoal-600/g, 'border-sand-500'],

  // Divide
  [/divide-charcoal-800/g, 'divide-sand-300'],
  [/divide-charcoal-700/g, 'divide-sand-400'],
  
  // Hover & Active Backgrounds
  [/hover:bg-charcoal-800/g, 'hover:bg-sand-200'],
  [/hover:bg-charcoal-700/g, 'hover:bg-sand-300'],
  [/hover:bg-charcoal-850/g, 'hover:bg-sand-200'],

  // Accents (Gold -> Crimson/Gold)
  // Most old gold accents should become crimson, but we'll leave gold where we want true illumination
  // For simplicity, let's map text-gold-400 to text-crimson-700
  [/text-gold-300/g, 'text-crimson-600'],
  [/text-gold-400/g, 'text-crimson-700'],
  [/text-gold-500/g, 'text-crimson-800'],
  [/bg-gold-400\/10/g, 'bg-crimson-800\/10'],
  [/bg-gold-500\/10/g, 'bg-crimson-800\/10'],
  [/bg-gold-500\/20/g, 'bg-crimson-800\/20'],
  [/bg-gold-400/g, 'bg-crimson-700'],
  [/bg-gold-500/g, 'bg-crimson-800'],
  [/bg-gold-600/g, 'bg-crimson-900'],
  [/hover:bg-gold-600/g, 'hover:bg-crimson-900'],
  [/border-gold-500\/20/g, 'border-crimson-800\/20'],
  [/border-gold-500\/30/g, 'border-crimson-800\/30'],
  [/border-gold-500/g, 'border-crimson-800'],
  [/ring-gold-500/g, 'ring-crimson-800'],
  
  // From/To gradients
  [/from-charcoal-950/g, 'from-sand-100'],
  [/to-charcoal-900/g, 'to-sand-50'],
  [/from-charcoal-900/g, 'from-sand-50'],
  [/to-charcoal-950/g, 'to-sand-100'],
  [/via-charcoal-900/g, 'via-sand-50'],
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
console.log('Done mapping tokens!');
