import { PoemImportProvider, ParsedPoemPayload, ParsedVersePayload, ParsedGlossaryEntry } from "./types";
import { Era, Bahr } from "@/types";
import { fetchUrlViaWorker } from "@/lib/worker/workerClient";

const ALDIWAN_HOSTS = ["aldiwan.net", "www.aldiwan.net"];

const ERA_KEYWORDS: Array<[string, Era]> = [
  ["العصر الجاهلي", "جاهلي"],
  ["جاهلي", "جاهلي"],
  ["صدر الإسلام", "إسلامي"],
  ["العصر الإسلامي", "إسلامي"],
  ["العصر الأموي", "أموي"],
  ["أموي", "أموي"],
  ["العصر العباسي", "عباسي"],
  ["عباسي", "عباسي"],
  ["العصر الأندلسي", "أندلسي"],
  ["أندلسي", "أندلسي"],
  ["العصر المملوكي", "مملوكي"],
  ["العصر العثماني", "عثماني"],
  ["العصر الحديث", "حديث"],
  ["العصر المعاصر", "معاصر"],
  ["معاصر", "معاصر"],
];

const BUHOOR: Bahr[] = [
  "الطويل", "البسيط", "الكامل", "الوافر", "الخفيف",
  "الرمل", "الرجز", "المتقارب", "المتدارك", "السريع", "المنسرح",
];

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCloudflareChallenge(status: number, text: string): boolean {
  if (status === 403 || status === 503) {
    if (
      text.includes("Just a moment") ||
      text.includes("challenges.cloudflare.com") ||
      text.includes("cf-mitigated") ||
      text.includes("Attention Required! | Cloudflare")
    ) {
      return true;
    }
  }
  return false;
}

export class AldewanProvider implements PoemImportProvider {
  id = "aldewan";
  name = "الديوان (aldiwan.net)";
  description = "جلب القصائد ومعاني الكلمات مباشرة من موقع الديوان (aldiwan.net)";
  supportsUrl = true;

  public splitHemistichs(verseText: string): { first: string; second: string } {
    if (!verseText) return { first: "", second: "" };

    const separators = [" — ", " - ", " | "];
    for (const sep of separators) {
      const idx = verseText.indexOf(sep);
      if (idx !== -1) {
        const first = verseText.slice(0, idx).trim();
        const second = verseText.slice(idx + sep.length).trim();
        return { first, second };
      }
    }

    return { first: verseText.trim(), second: "" };
  }

  /**
   * Validates that the given URL points to a poem page on aldiwan.net.
   * Returns the poem path (e.g. "poem81.html") or throws if invalid.
   */
  public extractPoemPathFromUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error("الرابط غير صالح. الرجاء إدخال رابط كامل من موقع aldiwan.net");
    }

    if (!ALDIWAN_HOSTS.includes(parsed.hostname.toLowerCase())) {
      throw new Error("الرابط ليس من موقع aldiwan.net");
    }

    const path = parsed.pathname.replace(/^\/+/, "");
    if (!path) {
      throw new Error("الرابط لا يشير إلى صفحة قصيدة محددة على aldiwan.net");
    }

    return path;
  }

  private extractBreadcrumb(html: string): { era?: string; poetName?: string; poemTitle?: string } {
    const scriptMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi) || [];
    for (const raw of scriptMatches) {
      const jsonText = raw.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
      try {
        const data = JSON.parse(jsonText);
        if (data && data["@type"] === "BreadcrumbList" && Array.isArray(data.itemListElement)) {
          const items = [...data.itemListElement].sort((a, b) => a.position - b.position);
          const names = items.map((item: { name?: string }) => item.name).filter(Boolean) as string[];
          return {
            era: names.length >= 3 ? names[0] : undefined,
            poetName: names.length >= 2 ? names[names.length - 2] : undefined,
            poemTitle: names[names.length - 1],
          };
        }
      } catch {
        // Not the breadcrumb script or malformed JSON; keep scanning.
      }
    }
    return {};
  }

  private detectEra(html: string, breadcrumbEra?: string): Era {
    const haystack = `${breadcrumbEra || ""} ${html}`;
    for (const [keyword, era] of ERA_KEYWORDS) {
      if (haystack.includes(keyword)) return era;
    }
    return "عباسي";
  }

  private detectBahr(html: string): Bahr {
    const seaLinkMatch = html.match(/href=["']sea-[^"']*["'][^>]*>\s*بحر\s*([^<]+?)\s*<\/a>/i);
    if (seaLinkMatch) {
      const candidate = seaLinkMatch[1].trim();
      const found = BUHOOR.find((b) => candidate.includes(b));
      if (found) return found;
    }
    for (const b of BUHOOR) {
      if (html.includes(`بحر ${b}`)) return b;
    }
    return "البسيط";
  }

  private detectRhyme(html: string): string {
    const qafiyaMatch = html.match(/href=["']q-[^"']*["'][^>]*>\s*قافية\s*([^<]+?)\s*<\/a>/i);
    if (qafiyaMatch) {
      return qafiyaMatch[1].replace(/\s+/g, " ").trim();
    }
    return "غير محدد";
  }

  /**
   * Extracts the poem verses container (id="poem_content") along with the
   * per-word "مساهمات" (contributions) glossary that aldiwan.net renders
   * further down the page, then builds verses + a word -> meaning glossary.
   */
  private extractVersesAndGlossary(html: string): { verses: ParsedVersePayload[]; glossary: ParsedGlossaryEntry[] } {
    const contentStart = html.indexOf('id="poem_content"');
    if (contentStart === -1) {
      return { verses: [], glossary: [] };
    }

    const boundaryMarker = html.indexOf("نبذة عن القصيدة", contentStart);
    const contentEnd = boundaryMarker !== -1 ? boundaryMarker : contentStart + 20000;
    const contentHtml = html.slice(contentStart, contentEnd);

    const hemistichMatches = contentHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
    const hemistichs = hemistichMatches.map((raw) => stripTags(raw)).filter((t) => t.length > 0);

    const verses: ParsedVersePayload[] = [];
    for (let i = 0; i < hemistichs.length; i += 2) {
      const first = hemistichs[i];
      const second = hemistichs[i + 1] || "";
      verses.push({
        orderIndex: verses.length + 1,
        text: second ? `${first} ${second}` : first,
        firstHemistich: first,
        secondHemistich: second,
      });
    }

    // Glossary: each contributed word explanation lives in a
    // <div id="mosahma_<id>" class="mosahmat_item">...</div> block with the
    // exact poem word in an <h2 class="h3"> and the explanation in an <h4>.
    const glossary: ParsedGlossaryEntry[] = [];
    const itemRegex = /<div id="mosahma_\d+" class="mosahmat_item">([\s\S]*?)<\/div>\s*(?=<div id="mosahma_\d+"|<div class="s-menu1"|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];
      const wordMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const meaningMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      const word = wordMatch ? stripTags(wordMatch[1]) : "";
      const meaning = meaningMatch ? stripTags(meaningMatch[1]) : "";
      if (word && meaning) {
        glossary.push({ word, meaning });
      }
    }

    return { verses, glossary };
  }

  public parseHtml(html: string, sourceUrl?: string): ParsedPoemPayload {
    if (isCloudflareChallenge(200, html)) {
      throw new Error(
        "تعذر تحليل الصفحة لأنها صفحة تحقق أمني من Cloudflare وليست محتوى القصيدة الفعلي."
      );
    }

    const breadcrumb = this.extractBreadcrumb(html);

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    let title = breadcrumb.poemTitle || "";
    let poetName = breadcrumb.poetName || "";
    if (!title && titleMatch) {
      const rawTitle = stripTags(titleMatch[1]);
      const parts = rawTitle.split(" - ");
      title = parts[0]?.trim() || "قصيدة غير معنونة";
      if (!poetName && parts.length >= 2) poetName = parts[1]?.trim();
    }
    title = title || "قصيدة غير معنونة";
    poetName = poetName || "شاعر مجهول";

    const era = this.detectEra(html, breadcrumb.era);
    const bahr = this.detectBahr(html);
    const rhyme = this.detectRhyme(html);
    const { verses, glossary } = this.extractVersesAndGlossary(html);

    if (verses.length === 0) {
      throw new Error(
        "لم يتم العثور على أبيات القصيدة في هذه الصفحة. تأكد من أن الرابط يشير مباشرة إلى صفحة قصيدة على aldiwan.net."
      );
    }

    return {
      title,
      poetName,
      era,
      bahr,
      rhyme,
      verses,
      glossary,
      sourceUrl,
    };
  }

  public parseRawText(text: string): ParsedPoemPayload {
    if (text.includes("<html") || text.includes("id=\"poem_content\"") || text.includes("<title")) {
      return this.parseHtml(text);
    }

    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const verses: ParsedVersePayload[] = lines.map((line, idx) => {
      const parts = line.split(/\s{3,}|\.{3,}| - /);
      const first = parts[0]?.trim() || line;
      const second = parts.slice(1).join(" ").trim();
      return {
        orderIndex: idx + 1,
        text: line,
        firstHemistich: first,
        secondHemistich: second,
      };
    });

    return {
      title: verses[0]?.firstHemistich || "قصيدة مستوردة",
      poetName: "شاعر مجهول",
      era: "عباسي",
      bahr: "البسيط",
      rhyme: "غير محدد",
      verses,
    };
  }

  public async fetchByUrl(url: string): Promise<ParsedPoemPayload> {
    const poemPath = this.extractPoemPathFromUrl(url);
    const targetUrl = `https://www.aldiwan.net/${poemPath}`;

    let response;
    try {
      response = await fetchUrlViaWorker(targetUrl, {
        Accept: "text/html,application/xhtml+xml",
      });
    } catch (err) {
      throw new Error((err as Error).message || "تعذر الاتصال بموقع aldiwan.net");
    }

    if (isCloudflareChallenge(response.status, response.text)) {
      throw new Error(
        "تعذر الوصول إلى aldiwan.net لأن الموقع محمي بنظام مكافحة الزحف الآلي (Cloudflare) الذي يمنع الطلبات المباشرة من الخادم. جرّب مرة أخرى لاحقًا، أو انسخ نص القصيدة يدويًا عبر تبويب الإدخال اليدوي."
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`تعذر جلب الصفحة من aldiwan.net (رمز الحالة ${response.status})`);
    }

    return this.parseHtml(response.text, targetUrl);
  }
}
