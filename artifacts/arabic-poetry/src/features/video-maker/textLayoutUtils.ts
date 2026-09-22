export function wrapArabicText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text
    .trim()
    .split(/\s+/)
    .flatMap((word) => splitLongWord(ctx, word, maxWidth));
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    // By concatenating left-to-right (currentLine + " " + word), 
    // the OS level text shaping (ligatures, Arabic layout) handles the RTL logic 
    // when we pass it to ctx.fillText if ctx.direction is "rtl" (or even "inherit" with Arabic chars).
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function splitLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number
): string[] {
  if (ctx.measureText(word).width <= maxWidth) return [word];

  const chunks: string[] = [];
  let chunk = "";
  for (const character of Array.from(word)) {
    const candidate = chunk + character;
    if (chunk && ctx.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
