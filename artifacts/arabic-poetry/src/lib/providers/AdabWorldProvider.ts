import { PoemImportProvider, ParsedPoemPayload, ParsedVersePayload } from "./types";
import { Era, Bahr, VerseExplanationItem } from "@/types";
import { fetchUrlViaWorker } from "@/lib/worker/workerClient";

/**
 * IMPORTANT — unverified provider.
 *
 * adabworld.com sits behind Vercel's bot-mitigation firewall, which returns a
 * "Vercel Security Checkpoint" challenge page (HTTP 429, header
 * `x-vercel-mitigated: challenge`) for requests coming from data-center /
 * cloud IP ranges (including this workspace's dev environment). Because of
 * that, this parser could not be validated against the real live HTML of the
 * site while it was written — it is built from the site's rendered content
 * structure only. It may need adjustment the first time it is used for real
 * (e.g. from the packaged desktop app on a residential network).
 *
 * The parser deliberately throws clear, specific errors instead of silently
 * returning wrong/empty data whenever a section it expects is missing or the
 * response looks like a bot-challenge page.
 */

export interface AdabWorldVerseExplanation {
  verseText: string;
  explanationText: string;
  glossary: { term: string; meaning: string }[];
}

export interface AdabWorldPoemData {
  title: string;
  poetName: string;
  meterName?: string;
  verseCount?: number;
  verses: string[];
  verseExplanations: AdabWorldVerseExplanation[];
  summary?: string;
  rhetoricalAnalysis?: string;
  sourceUrl: string;
}

const BOT_CHALLENGE_MARKERS = ["Vercel Security Checkpoint", "x-vercel-mitigated", "Attention Required"];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Extracts the inner text of every heading/paragraph/list-item tag, tagged with its kind, in document order. */
interface HtmlBlock {
  tag: "h1" | "h2" | "h3" | "h4" | "p" | "li";
  text: string;
}

function extractBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const re = /<(h1|h2|h3|h4|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase() as HtmlBlock["tag"];
    const text = stripHtml(match[2]).replace(/\s+/g, " ").trim();
    if (text) blocks.push({ tag, text });
  }
  return blocks;
}

export class AdabWorldProvider implements PoemImportProvider {
  id = "adab_world";
  name = "عالَم الأدب (Adab World)";
  description = "استيراد نصوص القصائد مع ملخصها وتحليل جمالياتها البلاغية والأسلوبية";
  supportsUrl = true;

  private static USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  private cache = new Map<string, AdabWorldPoemData>();

  /** Validates and extracts the poem slug from an adabworld.com URL: https://adabworld.com/poems/{slug} */
  public extractPoemSlugFromUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== "string") {
      throw new Error("رابط القصيدة غير صالح (URL is empty or not a string)");
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error("صيغة الرابط غير صحيحة (Malformed URL)");
    }

    const validHosts = ["adabworld.com", "www.adabworld.com"];
    if (!validHosts.includes(parsed.hostname.toLowerCase())) {
      throw new Error(`اسم النطاق غير مدعوم: ${parsed.hostname}. الرابط يجب أن يكون من adabworld.com`);
    }

    const match = parsed.pathname.match(/\/poems\/([^/]+)/);
    if (!match || !match[1]) {
      throw new Error("تعذر استخراج معرف القصيدة من الرابط. تأكد أن الرابط بصيغة https://adabworld.com/poems/{slug}");
    }

    return match[1];
  }

  private assertNotChallenged(status: number, headers: string, rawText: string) {
    const looksBlocked =
      status === 429 ||
      BOT_CHALLENGE_MARKERS.some((marker) => rawText.includes(marker) || headers.includes(marker.toLowerCase()));

    if (looksBlocked) {
      throw new Error(
        "موقع عالَم الأدب (adabworld.com) رفض الطلب واعتبره طلبًا آليًا (حماية Vercel ضد الروبوتات). " +
          "قد يعمل هذا بشكل مختلف من شبكة منزلية عادية بدل بيئة العمل السحابية. جرّب لاحقًا أو من شبكة أخرى."
      );
    }
    if (status < 200 || status >= 300) {
      throw new Error(`فشل الاتصال بموقع عالَم الأدب (رمز الحالة: ${status})`);
    }
  }

  /** Fetches the raw HTML for a poem page and parses it into structured content. */
  public async fetchPoemData(url: string): Promise<AdabWorldPoemData> {
    const slug = this.extractPoemSlugFromUrl(url);
    const cached = this.cache.get(slug);
    if (cached) return cached;

    const targetUrl = `https://adabworld.com/poems/${slug}`;
    const res = await fetchUrlViaWorker(targetUrl, {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": AdabWorldProvider.USER_AGENT,
    });

    this.assertNotChallenged(res.status, JSON.stringify(res.content_type || ""), res.text || "");

    const data = this.parseHtml(res.text, targetUrl);
    this.cache.set(slug, data);
    return data;
  }

  /**
   * Parses the poem page HTML into structured content: title, meter, verses,
   * per-verse explanation + word glossary, poem summary, and the rhetorical /
   * stylistic analysis section (تحليل الجماليات البلاغية والأسلوبية).
   */
  public parseHtml(html: string, sourceUrl: string): AdabWorldPoemData {
    if (!html || html.trim().length < 200) {
      throw new Error("محتوى الصفحة فارغ أو غير مكتمل — تعذر تحليل القصيدة");
    }

    const blocks = extractBlocks(html);
    if (blocks.length === 0) {
      throw new Error(
        "تعذر العثور على أي محتوى قابل للتحليل في صفحة عالَم الأدب. قد يكون الموقع غيّر بنية الصفحة."
      );
    }

    // Title: first heading tag in the document.
    const titleBlock = blocks.find((b) => b.tag === "h1" || b.tag === "h2");
    if (!titleBlock) {
      throw new Error("تعذر العثور على عنوان القصيدة في الصفحة");
    }
    const title = titleBlock.text;

    // Meter + verse count, e.g. "16 بيتاً بحر المتقارب" (searched across all block text).
    const fullText = blocks.map((b) => b.text).join("\n");
    const meterMatch = fullText.match(/(\d+)\s*بيت\S*\s*بحر\s+([^\n\d]+?)(?=\n|$)/);
    const verseCount = meterMatch ? parseInt(meterMatch[1], 10) : undefined;
    const meterName = meterMatch ? meterMatch[2].trim() : undefined;

    // Poet name from the "قصائد أخرى لـ<الشاعر>" section, present near the bottom of the page.
    const poetMatch = fullText.match(/قصائد\s+أخرى\s+ل[ـِ]*\s*([^\n]+)/);
    const poetName = poetMatch ? poetMatch[1].trim() : "شاعر مجهول";

    // Locate the section headings we care about, by index into `blocks`.
    const findHeadingIndex = (matcher: RegExp, fromIndex = 0) =>
      blocks.findIndex((b, i) => i >= fromIndex && (b.tag === "h2" || b.tag === "h3") && matcher.test(b.text));

    const explanationSectionIdx = findHeadingIndex(/شرح\s+قصيدة/);
    const summarySectionIdx = findHeadingIndex(/ملخص\s+قصيدة/);
    const rhetoricalSectionIdx = findHeadingIndex(/الجماليات\s+البلاغية|تحليل\s+قصيدة/);

    if (explanationSectionIdx === -1) {
      throw new Error("تعذر العثور على قسم شرح القصيدة في الصفحة");
    }

    // Poem summary: paragraphs between the summary heading and the next heading.
    let summary: string | undefined;
    if (summarySectionIdx !== -1) {
      const nextHeadingIdx = blocks.findIndex(
        (b, i) => i > summarySectionIdx && (b.tag === "h1" || b.tag === "h2" || b.tag === "h3")
      );
      const end = nextHeadingIdx === -1 ? blocks.length : nextHeadingIdx;
      summary = blocks
        .slice(summarySectionIdx + 1, end)
        .filter((b) => b.tag === "p" || b.tag === "li")
        .map((b) => b.text)
        .join("\n\n")
        .trim() || undefined;
    }

    // Rhetorical / stylistic analysis section.
    let rhetoricalAnalysis: string | undefined;
    if (rhetoricalSectionIdx !== -1) {
      const nextTopHeadingIdx = blocks.findIndex(
        (b, i) => i > rhetoricalSectionIdx && b.tag === "h2"
      );
      const end = nextTopHeadingIdx === -1 ? blocks.length : nextTopHeadingIdx;
      const analysisBlocks = blocks
        .slice(rhetoricalSectionIdx + 1, end)
        .filter((b) => b.tag === "h3" || b.tag === "h4" || b.tag === "p" || b.tag === "li");
      rhetoricalAnalysis = analysisBlocks
        .map((b) => (b.tag === "h3" || b.tag === "h4" ? `**${b.text}**` : b.text))
        .join("\n")
        .trim() || undefined;
    }

    // Per-verse explanation blocks: h3 headings under the "شرح قصيدة" section carry
    // the fully-spaced verse text; subsequent <p>/<li> blocks (until the next h3/h2)
    // are its prose explanation and word glossary.
    const explanationSectionEnd =
      [summarySectionIdx, rhetoricalSectionIdx]
        .filter((i) => i > explanationSectionIdx)
        .sort((a, b) => a - b)[0] ??
      blocks.findIndex((b, i) => i > explanationSectionIdx && b.tag === "h2") ??
      blocks.length;
    const sectionEnd = explanationSectionEnd === -1 ? blocks.length : explanationSectionEnd;

    const verseExplanations: AdabWorldVerseExplanation[] = [];
    for (let i = explanationSectionIdx + 1; i < sectionEnd; i++) {
      const block = blocks[i];
      if (block.tag !== "h3" && block.tag !== "h4") continue;
      // Heuristic: a verse heading contains Arabic diacritics or is reasonably long (a full line of poetry),
      // as opposed to a short editorial sub-heading.
      const wordCount = block.text.split(/\s+/).filter(Boolean).length;
      if (wordCount < 3) continue;

      let j = i + 1;
      const proseParts: string[] = [];
      const glossary: { term: string; meaning: string }[] = [];
      while (j < sectionEnd && blocks[j].tag !== "h3" && blocks[j].tag !== "h4") {
        const text = blocks[j].text;
        const glossaryMatch = text.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
        if (blocks[j].tag === "li" && glossaryMatch) {
          glossary.push({ term: glossaryMatch[1].trim(), meaning: glossaryMatch[2].trim() });
        } else {
          proseParts.push(text);
        }
        j++;
      }

      verseExplanations.push({
        verseText: block.text,
        explanationText: proseParts.join("\n\n").trim(),
        glossary,
      });
      i = j - 1;
    }

    if (verseExplanations.length === 0) {
      throw new Error("تعذر استخراج أبيات القصيدة من قسم الشرح — قد تكون بنية الصفحة مختلفة عمّا هو متوقع");
    }

    const verses = verseExplanations.map((v) => v.verseText);

    return {
      title,
      poetName,
      meterName,
      verseCount,
      verses,
      verseExplanations,
      summary,
      rhetoricalAnalysis,
      sourceUrl,
    };
  }

  /** Splits a verse line into two roughly equal hemistichs by word count (no explicit separator exists on adabworld.com). */
  public splitHemistichs(verseText: string): { first: string; second: string } {
    const words = verseText.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return { first: verseText.trim(), second: "" };
    const mid = Math.ceil(words.length / 2);
    return { first: words.slice(0, mid).join(" "), second: words.slice(mid).join(" ") };
  }

  public mapEra(_poetName?: string): Era {
    // adabworld.com poem pages don't expose the literary era directly; default to classical.
    return "جاهلي";
  }

  public mapBahr(meterName?: string): Bahr {
    const known: Bahr[] = [
      "الطويل", "البسيط", "الكامل", "الوافر", "الخفيف", "الرمل", "الرجز",
      "المتقارب", "المتدارك", "السريع", "المنسرح", "المقتضب", "المجتث", "المضارع", "الهزج", "تفعيلة / حر",
    ];
    if (meterName) {
      const found = known.find((b) => meterName.includes(b));
      if (found) return found;
    }
    return "تفعيلة / حر";
  }

  public mapDataToPayload(data: AdabWorldPoemData): ParsedPoemPayload {
    const verses: ParsedVersePayload[] = data.verseExplanations.map((v, idx) => {
      const { first, second } = this.splitHemistichs(v.verseText);
      return {
        orderIndex: idx + 1,
        externalId: `${idx + 1}`,
        text: v.verseText,
        firstHemistich: first,
        secondHemistich: second,
      };
    });

    return {
      title: data.title,
      poetName: data.poetName,
      era: this.mapEra(data.poetName),
      bahr: this.mapBahr(data.meterName),
      rhyme: "غير محدد",
      description: data.summary,
      verses,
      sourceUrl: data.sourceUrl,
    };
  }

  /** Builds the per-verse explanation + glossary items (attached alongside any existing Mizan explanations). */
  public buildVerseExplanations(data: AdabWorldPoemData): Map<string, VerseExplanationItem[]> {
    const map = new Map<string, VerseExplanationItem[]>();

    data.verseExplanations.forEach((v, idx) => {
      const externalId = `${idx + 1}`;
      const items: VerseExplanationItem[] = [];

      if (v.explanationText) {
        items.push({
          id: `adabworld-exp-${externalId}-${idx}`,
          verseId: "",
          verseExternalId: externalId,
          text: v.explanationText,
          sourceTitle: "عالَم الأدب",
          explanationType: "verse",
          provider: this.id,
        });
      }

      v.glossary.forEach((g, gIdx) => {
        items.push({
          id: `adabworld-glossary-${externalId}-${gIdx}`,
          verseId: "",
          verseExternalId: externalId,
          text: `${g.term}: ${g.meaning}`,
          sourceTitle: "معجم عالَم الأدب",
          explanationType: "classical",
          provider: this.id,
        });
      });

      if (items.length > 0) map.set(externalId, items);
    });

    // The rhetorical/stylistic analysis applies to the poem as a whole; attach it to the first verse
    // so it's visible without needing a separate poem-level explanation surface in the UI.
    if (data.rhetoricalAnalysis) {
      const firstKey = "1";
      const existing = map.get(firstKey) || [];
      existing.push({
        id: `adabworld-rhetorical-${firstKey}`,
        verseId: "",
        verseExternalId: firstKey,
        text: data.rhetoricalAnalysis,
        sourceTitle: "تحليل الجماليات البلاغية والأسلوبية",
        explanationType: "rhetorical",
        provider: this.id,
      });
      map.set(firstKey, existing);
    }

    return map;
  }

  // --- PoemImportProvider interface ---

  public parseRawText(_text: string): ParsedPoemPayload {
    throw new Error("عالَم الأدب لا يدعم الإدخال اليدوي — استخدم رابط القصيدة فقط");
  }

  public async fetchByUrl(url: string): Promise<ParsedPoemPayload> {
    const data = await this.fetchPoemData(url);
    return this.mapDataToPayload(data);
  }
}
