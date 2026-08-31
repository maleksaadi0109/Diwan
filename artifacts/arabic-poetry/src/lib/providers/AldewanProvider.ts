import { PoemImportProvider, ParsedPoemPayload, ParsedVersePayload } from "./types";
import { Era, Bahr } from "@/types";

export class AldewanProvider implements PoemImportProvider {
  id = "aldewan";
  name = "الديوان (Aldewan.net)";
  description = "جلب القصائد والبحور والروي من موقع ديوان العرب";
  supportsUrl = true;

  public parseHtml(html: string, sourceUrl?: string): ParsedPoemPayload {
    // 1. Extract title
    const titleMatch =
      html.match(/<h1[^>]*class=["'][^"']*poem-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<title>([\s\S]*?)<\/title>/i);

    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "قصيدة غير معنونة";
    const title = rawTitle.replace(/\s*-\s*الديوان.*/, "").trim();

    // 2. Extract Poet Name
    const poetMatch =
      html.match(/class=["'][^"']*poet-name[^"']*["'][^>]*>([\s\S]*?)<\//i) ||
      html.match(/قصائد\s+الشاعر\s+([^\s<]+(?:\s+[^\s<]+){1,3})/i);
    const poetName = poetMatch ? poetMatch[1].replace(/<[^>]+>/g, "").trim() : "شاعر مجهول";

    // 3. Extract Era
    let era: Era = "عباسي";
    if (html.includes("العصر الجاهلي") || html.includes("جاهلي")) era = "جاهلي";
    else if (html.includes("العصر الإسلامي") || html.includes("صدر الإسلام")) era = "إسلامي";
    else if (html.includes("العصر الأموي") || html.includes("أموي")) era = "أموي";
    else if (html.includes("العصر الأندلسي") || html.includes("أندلسي")) era = "أندلسي";
    else if (html.includes("العصر المملوكي")) era = "مملوكي";
    else if (html.includes("العصر العثماني")) era = "عثماني";
    else if (html.includes("العصر الحديث")) era = "حديث";
    else if (html.includes("العصر المعاصر") || html.includes("معاصر")) era = "معاصر";

    // 4. Extract Bahr
    let bahr: Bahr = "البسيط";
    const buhoorList: Bahr[] = [
      "الطويل", "البسيط", "الكامل", "الوافر", "الخفيف",
      "الرمل", "الرجز", "المتقارب", "المتدارك", "السريع", "المنسرح"
    ];
    for (const b of buhoorList) {
      if (html.includes(`بحر ${b}`) || html.includes(b)) {
        bahr = b;
        break;
      }
    }

    // 5. Extract Verses
    const verses: ParsedVersePayload[] = [];
    const verseLines = html.match(/<h3[^>]*class=["'][^"']*bet[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi) || [];

    if (verseLines.length > 0) {
      for (const [idx, rawVerse] of verseLines.entries()) {
        const clean = String(rawVerse).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const parts = clean.split(/\s{3,}|\.{3,}|-|،/);
        const first = parts[0]?.trim() || clean;
        const second = parts.slice(1).join(" ").trim();
        verses.push({
          orderIndex: idx + 1,
          text: clean,
          firstHemistich: first,
          secondHemistich: second,
        });
      }
    }

    return {
      title,
      poetName,
      era,
      bahr,
      rhyme: "الميم",
      verses,
      sourceUrl,
    };
  }

  public parseRawText(text: string): ParsedPoemPayload {
    if (text.includes("<html") || text.includes("<body") || text.includes("<h1")) {
      return this.parseHtml(text);
    }

    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const verses: ParsedVersePayload[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/\s{3,}|\.{3,}| - /);
      const first = parts[0]?.trim() || line;
      const second = parts.slice(1).join(" ").trim();
      verses.push({
        orderIndex: idx + 1,
        text: line,
        firstHemistich: first,
        secondHemistich: second,
      });
    });

    return {
      title: verses[0]?.firstHemistich || "قصيدة مستوردة",
      poetName: "أبو الطيب المتنبي",
      era: "عباسي",
      bahr: "البسيط",
      rhyme: "غير محدد",
      verses,
    };
  }

  public async fetchByUrl(url: string): Promise<ParsedPoemPayload> {
    try {
      const res = await fetch(url);
      const html = await res.text();
      return this.parseHtml(html, url);
    } catch (err) {
      console.warn("Could not fetch remote URL directly, using fallback parse:", err);
      return this.parseRawText(url);
    }
  }
}
