import { PoemImportProvider, ParsedPoemPayload, ParsedVersePayload } from "./types";
import { Era, Bahr, VerseExplanationItem } from "@/types";
import { fetchUrlViaWorker } from "@/lib/worker/workerClient";

export interface MizanPoetPayload {
  id?: string | number;
  name?: string;
  era?: string;
  bio?: string;
  birth_year?: string;
  death_year?: string;
}

export interface MizanVersePayload {
  id: string | number;
  order_num?: number;
  order_index?: number;
  text: string;
  first_hemistich?: string;
  second_hemistich?: string;
}

export interface MizanPoemApiResponse {
  id: string | number;
  title: string;
  poet_name?: string;
  poet_id?: string | number;
  poet?: MizanPoetPayload;
  era?: string;
  meter_name?: string;
  bahr?: string;
  theme?: string;
  rhyme?: string;
  verified?: boolean;
  verses: MizanVersePayload[];
}

export interface MizanClassicalExplanationResponse {
  id?: string | number;
  verse_id?: string | number;
  text: string;
  author?: string;
  author_death_hijri?: string;
  source_title?: string;
}

export class MizanAlArabProvider implements PoemImportProvider {
  id = "mizan_al_arab";
  name = "ميزان العرب (Mizan Al-Arab)";
  description = "استيراد نصوص القصائد والشروح الكلاسيكية والمعاجم من ميزان العرب";
  supportsUrl = true;

  private static BASE_URL = "https://mizanalarab.com";
  private static USER_AGENT = "DiwanDesktop/1.0 (Arabic Poetic Audio Sync; +https://github.com/diwan/diwan)";

  // In-memory cache
  private poemCache = new Map<string, MizanPoemApiResponse>();
  private explanationCache = new Map<string, VerseExplanationItem[]>();

  /**
   * Validates and extracts the poem ID from a Mizan Al-Arab URL:
   * https://mizanalarab.com/poem/{poemId} or https://mizanalarab.com/poem/{poemId}#v={verseId}
   */
  public extractPoemIdFromUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== "string") {
      throw new Error("رابط القصيدة غير صالح (URL is empty or not a string)");
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error("صيغة الرابط غير صحيحة (Malformed URL)");
    }

    const validHosts = ["mizanalarab.com", "www.mizanalarab.com"];
    if (!validHosts.includes(parsed.hostname.toLowerCase())) {
      throw new Error(`اسم النطاق غير مدعوم: ${parsed.hostname}. الرابط يجب أن يكون من mizanalarab.com`);
    }

    // Match /poem/{poemId} in pathname (ignoring hash fragment #v)
    const match = parsed.pathname.match(/\/poem\/([^/?#]+)/i);
    if (!match || !match[1] || match[1].trim() === "") {
      throw new Error("تعذر استخراج معرف القصيدة من المسار (Missing poem ID in path)");
    }

    const poemId = match[1].trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(poemId)) {
      throw new Error("معرف القصيدة يحتوي على رموز غير صالحة (Malformed poem ID)");
    }

    return poemId;
  }

  /**
   * Splits a verse text into first and second hemistichs using strict separators:
   * " — " (em dash), " - " (hyphen), " | " (pipe)
   */
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
   * Maps an era string to standard application Era type
   */
  public mapEra(rawEra?: string): Era {
    if (!rawEra) return "عباسي";
    const e = rawEra.trim();
    if (e.includes("جاهل")) return "جاهلي";
    if (e.includes("إسلام") || e.includes("صدر")) return "إسلامي";
    if (e.includes("أمو")) return "أموي";
    if (e.includes("عباس")) return "عباسي";
    if (e.includes("أندلس")) return "أندلسي";
    if (e.includes("مملوك")) return "مملوكي";
    if (e.includes("عثمان")) return "عثماني";
    if (e.includes("حديث")) return "حديث";
    if (e.includes("معاصر")) return "معاصر";
    return "عباسي";
  }

  /**
   * Maps a poetic meter string to standard application Bahr type
   */
  public mapBahr(rawBahr?: string): Bahr {
    if (!rawBahr) return "البسيط";
    const buhoor: Bahr[] = [
      "الطويل", "البسيط", "الكامل", "الوافر", "الخفيف", "الرمل",
      "الرجز", "المتقارب", "المتدارك", "السريع", "المنسرح", "المقتضب",
      "المجتث", "المضارع", "الهزج", "تفعيلة / حر"
    ];
    for (const b of buhoor) {
      if (rawBahr.includes(b)) return b;
    }
    return "البسيط";
  }

  /**
   * HTTP GET fetcher with retry logic, rate-limit backoff, timeouts, and User-Agent
   */
  public async fetchJson<T>(
    endpointUrl: string,
    fetchFn: typeof fetch = fetch
  ): Promise<T> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s total timeout

      try {
        let status = 200;
        let contentType = "application/json";
        let text = "";

        if (fetchFn === fetch) {
          const res = await fetchUrlViaWorker(endpointUrl, {
            "User-Agent": MizanAlArabProvider.USER_AGENT,
          });
          status = res.status;
          contentType = res.content_type || "";
          text = res.text;
        } else {
          const response = await fetchFn(endpointUrl, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "User-Agent": MizanAlArabProvider.USER_AGENT,
            },
            signal: controller.signal,
          });
          status = response.status;
          contentType = response.headers.get("content-type") || "";
          text = await response.text();
        }

        clearTimeout(timeoutId);

        if (status >= 200 && status < 300) {
          // Reject HTML returned instead of JSON
          if (!contentType.includes("application/json") && (text.startsWith("<!DOCTYPE") || text.startsWith("<html"))) {
            throw new Error("استجابة الخادم غير متوقعة: تم إرجاع HTML بدلاً من JSON");
          }

          try {
            return JSON.parse(text) as T;
          } catch (jsonErr) {
            throw new Error(`تعذر تحليل استجابة JSON: ${(jsonErr as Error).message}`);
          }
        }

        // Do not retry client errors (400, 401, 403, 404)
        if (status === 400 || status === 401 || status === 403 || status === 404) {
          throw new Error(`خطأ في طلب القصيدة (HTTP ${status})`);
        }

        // Retryable server errors (429, 502, 503, 504)
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          attempt++;
          const waitMs = 350 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 3000)));
          continue;
        }

        throw new Error(`فشل الاتصال بالخادم (HTTP ${status})`);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const error = err as Error;
        if (error.name === "AbortError") {
          throw new Error("انتهت مهلة الاتصال بالخادم (Request timed out)");
        }
        if (attempt >= maxRetries || error.message.includes("HTTP 40") || error.message.includes("HTML")) {
          throw error;
        }
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    throw new Error("تعذر إكمال الطلب بعد المحاولات المتكررة");
  }

  /**
   * Fetches full poem and parses it into standard payload
   */
  public async fetchPoemById(
    poemId: string,
    fetchFn: typeof fetch = fetch
  ): Promise<MizanPoemApiResponse> {
    if (this.poemCache.has(poemId)) {
      return this.poemCache.get(poemId)!;
    }

    const endpoint = `${MizanAlArabProvider.BASE_URL}/api/poems/${encodeURIComponent(poemId)}`;
    const data = await this.fetchJson<MizanPoemApiResponse>(endpoint, fetchFn);

    if (!data || !data.title || !Array.isArray(data.verses)) {
      throw new Error("استجابة الخادم ناقصة أو غير متوافقة مع بنية القصيدة");
    }

    this.poemCache.set(poemId, data);
    return data;
  }

  /**
   * Fetches classical explanations for a verse
   */
  public async fetchClassicalExplanations(
    verseId: string | number,
    fetchFn: typeof fetch = fetch
  ): Promise<VerseExplanationItem[]> {
    const key = `classical-${verseId}`;
    if (this.explanationCache.has(key)) {
      return this.explanationCache.get(key)!;
    }

    const endpoint = `${MizanAlArabProvider.BASE_URL}/api/explanations/classical/${encodeURIComponent(verseId)}`;
    try {
      const data = await this.fetchJson<MizanClassicalExplanationResponse[] | MizanClassicalExplanationResponse>(
        endpoint,
        fetchFn
      );

      const items = Array.isArray(data) ? data : (data ? [data] : []);
      const mapped: VerseExplanationItem[] = items.map((item, idx) => ({
        id: `mizan-exp-${verseId}-${idx + 1}`,
        verseId: String(verseId),
        verseExternalId: String(verseId),
        text: item.text || "لا يتوفر شرح لهذا البيت في المصدر",
        author: item.author || undefined,
        authorDeathHijri: item.author_death_hijri || undefined,
        sourceTitle: item.source_title || undefined,
        explanationType: "classical",
        provider: "mizan_al_arab",
        rawSourceJson: JSON.stringify(item),
      }));

      this.explanationCache.set(key, mapped);
      return mapped;
    } catch (err) {
      console.warn(`Could not fetch classical explanations for verse ${verseId}:`, err);
      return [];
    }
  }

  /**
   * Fetches modern / linguistic verse explanation
   */
  public async fetchVerseExplanation(
    verseId: string | number,
    fetchFn: typeof fetch = fetch
  ): Promise<VerseExplanationItem[]> {
    const key = `verse-${verseId}`;
    if (this.explanationCache.has(key)) {
      return this.explanationCache.get(key)!;
    }

    const endpoint = `${MizanAlArabProvider.BASE_URL}/api/explanations/verse/${encodeURIComponent(verseId)}`;
    try {
      const data = await this.fetchJson<Record<string, unknown>>(endpoint, fetchFn);
      if (!data || Object.keys(data).length === 0) return [];

      const text = (data.text || data.explanation || data.meaning || "") as string;
      if (!text) return [];

      const mapped: VerseExplanationItem = {
        id: `mizan-vexp-${verseId}-1`,
        verseId: String(verseId),
        verseExternalId: String(verseId),
        text,
        explanationType: "verse",
        provider: "mizan_al_arab",
        rawSourceJson: JSON.stringify(data),
      };

      this.explanationCache.set(key, [mapped]);
      return [mapped];
    } catch {
      return [];
    }
  }

  /**
   * Background enrichment: fetches explanations for all verses in batches with concurrency limit 4
   */
  public async enrichVersesWithExplanations(
    verses: MizanVersePayload[],
    onProgress?: (completed: number, total: number, message: string) => void,
    fetchFn: typeof fetch = fetch
  ): Promise<Map<string, VerseExplanationItem[]>> {
    const resultMap = new Map<string, VerseExplanationItem[]>();
    const total = verses.length;
    let completed = 0;

    const batchSize = 4;
    for (let i = 0; i < verses.length; i += batchSize) {
      const batch = verses.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (v) => {
          try {
            const classical = await this.fetchClassicalExplanations(v.id, fetchFn);
            const modern = await this.fetchVerseExplanation(v.id, fetchFn);
            resultMap.set(String(v.id), [...classical, ...modern]);
          } catch {
            resultMap.set(String(v.id), []);
          } finally {
            completed++;
            if (onProgress) {
              onProgress(completed, total, `تم تحميل شرح ${completed} من ${total} بيتًا`);
            }
          }
        })
      );

      // 250ms courteous delay between batches
      if (i + batchSize < verses.length) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    return resultMap;
  }

  /**
   * Converts Mizan API response into application ParsedPoemPayload
   */
  public mapApiResponseToPayload(response: MizanPoemApiResponse): ParsedPoemPayload {
    const poetName = response.poet_name || response.poet?.name || "شاعر غير معروف";
    const era = this.mapEra(response.poet?.era || response.era);
    const bahr = this.mapBahr(response.meter_name || response.bahr);

    const verses: ParsedVersePayload[] = response.verses.map((v, idx) => {
      const orderIndex = v.order_num || v.order_index || idx + 1;
      const { first, second } = this.splitHemistichs(v.text);

      return {
        orderIndex,
        text: v.text,
        firstHemistich: v.first_hemistich || first,
        secondHemistich: v.second_hemistich || second,
      };
    });

    return {
      title: response.title,
      poetName,
      era,
      bahr,
      rhyme: response.rhyme || "الميم",
      description: response.theme ? `الغرض الشعري: ${response.theme}` : undefined,
      verses,
      sourceUrl: `${MizanAlArabProvider.BASE_URL}/poem/${response.id}`,
    };
  }

  public parseRawText(text: string): ParsedPoemPayload {
    try {
      const parsed = JSON.parse(text) as MizanPoemApiResponse;
      return this.mapApiResponseToPayload(parsed);
    } catch {
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      const verses: ParsedVersePayload[] = lines.map((line, idx) => {
        const { first, second } = this.splitHemistichs(line);
        return {
          orderIndex: idx + 1,
          text: line,
          firstHemistich: first,
          secondHemistich: second,
        };
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
  }

  public async fetchByUrl(url: string, fetchFn: typeof fetch = fetch): Promise<ParsedPoemPayload> {
    const poemId = this.extractPoemIdFromUrl(url);
    const apiResponse = await this.fetchPoemById(poemId, fetchFn);
    return this.mapApiResponseToPayload(apiResponse);
  }
}
