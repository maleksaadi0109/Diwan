import { describe, it, expect, vi, beforeEach } from "vitest";
import { MizanAlArabProvider, MizanPoemApiResponse } from "./MizanAlArabProvider";
import { DiwanRepository } from "../db/repository";
import { WebMemoryAdapter } from "../db/adapter";
import { Poem } from "@/types";

describe("MizanAlArabProvider Test Suite", () => {
  let provider: MizanAlArabProvider;
  let repo: DiwanRepository;

  beforeEach(async () => {
    provider = new MizanAlArabProvider();
    const adapter = new WebMemoryAdapter();
    repo = await DiwanRepository.create(adapter);
  });

  it("1. validates standard poem URL", () => {
    const id = provider.extractPoemIdFromUrl("https://mizanalarab.com/poem/mutanabbi-waharra");
    expect(id).toBe("mutanabbi-waharra");
  });

  it("2. extracts poem ID ignoring #v fragment", () => {
    const id = provider.extractPoemIdFromUrl("https://mizanalarab.com/poem/10482#v=12");
    expect(id).toBe("10482");
  });

  it("3. rejects invalid hostname", () => {
    expect(() => provider.extractPoemIdFromUrl("https://other-site.com/poem/10482")).toThrow(
      /اسم النطاق غير مدعوم/
    );
  });

  it("4. rejects malformed poem ID", () => {
    expect(() => provider.extractPoemIdFromUrl("https://mizanalarab.com/poem/")).toThrow(
      /تعذر استخراج معرف القصيدة/
    );
  });

  it("5. handles successful poem response", async () => {
    const mockApiResponse: MizanPoemApiResponse = {
      id: "poem-101",
      title: "واحر قلباه",
      poet_name: "أبو الطيب المتنبي",
      era: "عباسي",
      meter_name: "البسيط",
      theme: "عتاب ومدح",
      verified: true,
      verses: [
        {
          id: "v-1",
          order_num: 1,
          text: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ — وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(mockApiResponse),
    });

    const parsed = await provider.fetchByUrl("https://mizanalarab.com/poem/poem-101", mockFetch as unknown as typeof fetch);
    expect(parsed.title).toBe("واحر قلباه");
    expect(parsed.poetName).toBe("أبو الطيب المتنبي");
    expect(parsed.bahr).toBe("البسيط");
    expect(parsed.verses.length).toBe(1);
    expect(parsed.verses[0].firstHemistich).toBe("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ");
    expect(parsed.verses[0].secondHemistich).toBe("وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ");
  });

  it("6. parses poem with poet_name but no nested poet", () => {
    const mockData: MizanPoemApiResponse = {
      id: "poem-102",
      title: "قصيدة الفرزدق",
      poet_name: "الفرزدق",
      verses: [{ id: "v-1", text: "هذا الذي تعرف البطحاء وطأته — والبيت يعرفه والحل والحرم" }],
    };

    const payload = provider.mapApiResponseToPayload(mockData);
    expect(payload.poetName).toBe("الفرزدق");
  });

  it("7. parses poem with nested poet object", () => {
    const mockData: MizanPoemApiResponse = {
      id: "poem-103",
      title: "أراك عصي الدمع",
      poet: {
        id: "poet-abu-firas",
        name: "أبو فراس الحمداني",
        era: "العصر العباسي",
      },
      verses: [{ id: "v-1", text: "أَراكَ عَصِيَّ الدَمعِ شيمَتُكَ الصَبرُ — أَما لِلهَوى نَهيٌ عَلَيكَ وَلا أَمرُ" }],
    };

    const payload = provider.mapApiResponseToPayload(mockData);
    expect(payload.poetName).toBe("أبو فراس الحمداني");
    expect(payload.era).toBe("عباسي");
  });

  it("8. handles empty verses gracefully", () => {
    const mockData: MizanPoemApiResponse = {
      id: "poem-empty",
      title: "قصيدة فارغة",
      verses: [],
    };

    const payload = provider.mapApiResponseToPayload(mockData);
    expect(payload.verses).toEqual([]);
  });

  it("9. handles duplicate re-import without duplicating verses in repository", async () => {
    const poem: Poem = {
      id: "poem-reimport-1",
      title: "قصيدة الاختبار",
      poet: { id: "poet-1", name: "الشاعر", era: "أموي" },
      era: "أموي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 2,
      tags: [],
      externalProvider: "mizan_al_arab",
      externalId: "mizan-99",
      verses: [
        {
          id: "v-1",
          poemId: "poem-reimport-1",
          orderIndex: 1,
          text: "البيت الأول",
          normalizedText: "البيت الاول",
          firstHemistich: "صدر",
          secondHemistich: "عجز",
        },
        {
          id: "v-2",
          poemId: "poem-reimport-1",
          orderIndex: 2,
          text: "البيت الثاني",
          normalizedText: "البيت الثاني",
          firstHemistich: "صدر",
          secondHemistich: "عجز",
        },
      ],
      recordings: [],
    };

    await repo.savePoem(poem);
    // Re-import with updated title
    await repo.savePoem({
      ...poem,
      title: "قصيدة الاختبار المحدثة",
    });

    const retrieved = await repo.getPoemById("poem-reimport-1");
    expect(retrieved?.title).toBe("قصيدة الاختبار المحدثة");
    expect(retrieved?.verses.length).toBe(2);
  });

  it("10. handles failed explanation request without crashing poem flow", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network Error"));
    const explanations = await provider.fetchClassicalExplanations("v-fail", mockFetch as unknown as typeof fetch);
    expect(explanations).toEqual([]);
  });

  it("11. maps classical explanations correctly", async () => {
    const mockExp = [
      {
        id: 1,
        verse_id: "v-100",
        text: "شرح البيت من ديوان المتنبي للعكبري",
        author: "العكبري",
        author_death_hijri: "616 هـ",
        source_title: "التبيان في شرح الديوان",
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(mockExp),
    });

    const res = await provider.fetchClassicalExplanations("v-100", mockFetch as unknown as typeof fetch);
    expect(res.length).toBe(1);
    expect(res[0].author).toBe("العكبري");
    expect(res[0].sourceTitle).toBe("التبيان في شرح الديوان");
    expect(res[0].explanationType).toBe("classical");
  });

  it("12. retries on 429 rate limit response", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "0" }),
          text: async () => "Rate Limited",
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ id: "poem-retry", title: "نجاح بعد التكرار", verses: [] }),
      };
    });

    const poem = await provider.fetchPoemById("poem-retry", mockFetch as unknown as typeof fetch);
    expect(callCount).toBe(2);
    expect(poem.title).toBe("نجاح بعد التكرار");
  });

  it("13. rejects request timeout cleanly", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    await expect(provider.fetchJson("https://mizanalarab.com/api/poems/1", mockFetch as unknown as typeof fetch)).rejects.toThrow(
      /انتهت مهلة الاتصال بالخادم/
    );
  });

  it("14. rejects malformed JSON response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => "{ not valid json ...",
    });

    await expect(provider.fetchJson("https://mizanalarab.com/api/poems/1", mockFetch as unknown as typeof fetch)).rejects.toThrow(
      /تعذر تحليل استجابة JSON/
    );
  });

  it("15. rejects HTML returned instead of JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<!DOCTYPE html><html><body>Error Page</body></html>",
    });

    await expect(provider.fetchJson("https://mizanalarab.com/api/poems/1", mockFetch as unknown as typeof fetch)).rejects.toThrow(
      /تم إرجاع HTML بدلاً من JSON/
    );
  });

  it("16. preserves full Arabic diacritics in verse text", () => {
    const diacritizedText = "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ — وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ";
    const { first, second } = provider.splitHemistichs(diacritizedText);
    expect(first).toBe("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ");
    expect(second).toBe("وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ");
  });

  it("17. splits hemistichs on em dash, hyphen, or pipe reliably", () => {
    const s1 = provider.splitHemistichs("صدر البيت — عجز البيت");
    expect(s1).toEqual({ first: "صدر البيت", second: "عجز البيت" });

    const s2 = provider.splitHemistichs("صدر البيت - عجز البيت");
    expect(s2).toEqual({ first: "صدر البيت", second: "عجز البيت" });

    const s3 = provider.splitHemistichs("صدر البيت | عجز البيت");
    expect(s3).toEqual({ first: "صدر البيت", second: "عجز البيت" });
  });

  it("18. preserves manual alignment timestamps after re-importing metadata", async () => {
    const poem: Poem = {
      id: "poem-align-preserve",
      title: "قصيدة مع طوابع",
      poet: { id: "poet-1", name: "الشاعر", era: "أموي" },
      era: "أموي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 1,
      tags: [],
      externalProvider: "mizan_al_arab",
      externalId: "m-123",
      verses: [
        {
          id: "v-preserve-1",
          poemId: "poem-align-preserve",
          orderIndex: 1,
          text: "بيت ذو طابع زمني",
          normalizedText: "بيت ذو طابع زمني",
          firstHemistich: "صدر",
          secondHemistich: "عجز",
          alignment: {
            id: "align-custom-1",
            verseId: "v-preserve-1",
            recordingId: "rec-1",
            startMs: 4500,
            endMs: 9500,
            confidence: 0.99,
            status: "manual",
          },
        },
      ],
      recordings: [],
    };

    await repo.savePoem(poem);

    // Re-import without alignment in payload
    await repo.savePoem({
      ...poem,
      description: "تحديث الوصف فقط",
      verses: [
        {
          id: "v-preserve-1",
          poemId: "poem-align-preserve",
          orderIndex: 1,
          text: "بيت ذو طابع زمني",
          normalizedText: "بيت ذو طابع زمني",
          firstHemistich: "صدر",
          secondHemistich: "عجز",
        },
      ],
    });

    const retrieved = await repo.getPoemById("poem-align-preserve");
    expect(retrieved?.verses[0].alignment?.startMs).toBe(4500);
    expect(retrieved?.verses[0].alignment?.status).toBe("manual");
  });
});
