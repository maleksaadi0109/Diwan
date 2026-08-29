import { Poem } from "@/types";

/**
 * Formats milliseconds to LRC timestamp format: [mm:ss.xx]
 */
export function formatLrcTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);

  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");
  const hStr = String(hundredths).padStart(2, "0");

  return `[${mStr}:${sStr}.${hStr}]`;
}

/**
 * Formats milliseconds to SRT timestamp format: 00:00:00,000
 */
export function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");
  const msStr = String(millis).padStart(3, "0");

  return `${hStr}:${mStr}:${sStr},${msStr}`;
}

/**
 * Exports poem with synchronized timestamps as standard LRC
 */
export function exportLrc(poem: Poem): string {
  const lines: string[] = [
    `[ti:${poem.title}]`,
    `[ar:${poem.poet.name}]`,
    `[al:ديوان الشعر العربي]`,
    `[by:Diwan Desktop]`,
    `[re:Diwan]`,
    `# البحر: ${poem.bahr}`,
    `# القافية: ${poem.rhyme}`,
    `# العصر: ${poem.era}`,
    "",
  ];

  // Only verses with a real alignment get timestamps — unaligned verses are
  // included as untimed comment lines rather than with invented timing.
  poem.verses.forEach((verse) => {
    if (verse.alignment) {
      lines.push(`${formatLrcTimestamp(verse.alignment.startMs)}${verse.text}`);
    } else {
      lines.push(`# [غير محاذى] ${verse.text}`);
    }
  });

  return lines.join("\n");
}

/**
 * Exports poem with synchronized timestamps as standard SRT subtitles
 */
export function exportSrt(poem: Poem): string {
  const blocks: string[] = [];

  // SRT is strictly timed: unaligned verses are skipped entirely instead of
  // being exported with fabricated timestamps.
  let counter = 0;
  poem.verses.forEach((verse) => {
    if (!verse.alignment) return;
    counter += 1;
    const startTag = formatSrtTimestamp(verse.alignment.startMs);
    const endTag = formatSrtTimestamp(verse.alignment.endMs);
    blocks.push(
      `${counter}\n${startTag} --> ${endTag}\n${verse.firstHemistich} ... ${verse.secondHemistich}`
    );
  });

  return blocks.join("\n\n") + "\n";
}

/**
 * Exports complete poem bundle as structured Diwan JSON
 */
export function exportDiwanJson(poem: Poem): string {
  const bundle = {
    schema_version: "1.0",
    generator: "Diwan Arabic Poetry Desktop App",
    exported_at: new Date().toISOString(),
    poem: {
      id: poem.id,
      title: poem.title,
      poet: poem.poet,
      era: poem.era,
      bahr: poem.bahr,
      rhyme: poem.rhyme,
      description: poem.description,
      verses_count: poem.verses.length,
      verses: poem.verses.map((v) => ({
        id: v.id,
        order_index: v.orderIndex,
        text: v.text,
        first_hemistich: v.firstHemistich,
        second_hemistich: v.secondHemistich,
        alignment: v.alignment
          ? {
              start_ms: v.alignment.startMs,
              end_ms: v.alignment.endMs,
              confidence: v.alignment.confidence,
              status: v.alignment.status,
            }
          : undefined,
      })),
      recordings: poem.recordings.map((r) => ({
        id: r.id,
        title: r.title,
        reciter: r.reciter,
        duration_ms: r.durationMs,
      })),
    },
  };

  return JSON.stringify(bundle, null, 2);
}

/**
 * Downloads string content as a client-side file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
