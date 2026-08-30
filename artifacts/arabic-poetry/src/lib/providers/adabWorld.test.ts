import { describe, it, expect, beforeEach } from "vitest";
import { AdabWorldProvider } from "./AdabWorldProvider";

// Synthetic HTML fixture that mirrors the generic heading/paragraph/list
// structure observed on adabworld.com's rendered content. Since the real
// site blocks automated fetches from this environment (Vercel bot
// mitigation), this fixture is a best-effort approximation, not a captured
// real page — see AdabWorldProvider.ts header comment.
const FIXTURE_HTML = `
<html>
<body>
<h1>تطاول ليلك بالأثمد</h1>
<p>2 بيتاً بحر المتقارب</p>

<h2>شرح قصيدة تطاول ليلك بالأثمد</h2>

<h3>تَطاوَلَ لَيلُكَ بِالأَثمَدِ وَنامَ الخَليُّ وَلَم تَرقُدِ</h3>
<p>يصف الشاعر طول ليله بسبب الأرق الذي أصابه بينما نام غيره من الناس بسهولة.</p>
<ul>
<li>الأثمد: نوع من الكحل الأسود.</li>
<li>الخليّ: الشخص الخالي من الهموم.</li>
</ul>

<h3>وَبِتُّ كَأَنَّ العِدا صَيَّرو ي فِي جِلدِ ذي مِرَّةٍ عَرمَضِ</h3>
<p>يشبّه نفسه بحالة من التعب الشديد جراء السهر الطويل.</p>
<ul>
<li>العدا: الأعداء.</li>
</ul>

<h2>ملخص قصيدة تطاول ليلك بالأثمد</h2>
<p>يتحدث امرؤ القيس في هذه القصيدة عن أرقه الطويل وسط نوم الآخرين، مصورًا حالته النفسية ببلاغة عالية.</p>

<h2>تحليل قصيدة تطاول ليلك بالأثمد</h2>
<h3>تحليل الجماليات البلاغية والأسلوبية</h3>
<h4>التشبيه</h4>
<p>شبّه الشاعر حالته بحيّة عرمض في وصف دقيق للتعب.</p>
<h4>الإيقاع</h4>
<p>يتميز البحر المتقارب بإيقاعه السريع المناسب لوصف القلق.</p>

<h2>قصائد أخرى لـامرؤ القيس</h2>
<p>روابط لقصائد أخرى</p>
</body>
</html>
`;

describe("AdabWorldProvider Test Suite", () => {
  let provider: AdabWorldProvider;

  beforeEach(() => {
    provider = new AdabWorldProvider();
  });

  it("1. validates standard poem URL and extracts slug", () => {
    const slug = provider.extractPoemSlugFromUrl("https://adabworld.com/poems/ttawl-lylk-balathmd-blgg5d");
    expect(slug).toBe("ttawl-lylk-balathmd-blgg5d");
  });

  it("2. rejects invalid hostname", () => {
    expect(() => provider.extractPoemSlugFromUrl("https://other-site.com/poems/xyz")).toThrow(
      /اسم النطاق غير مدعوم/
    );
  });

  it("3. rejects a URL without a poem slug", () => {
    expect(() => provider.extractPoemSlugFromUrl("https://adabworld.com/")).toThrow(
      /تعذر استخراج معرف القصيدة/
    );
  });

  it("4. parses title, meter, verses, glossary, summary and rhetorical analysis from HTML", () => {
    const data = provider.parseHtml(FIXTURE_HTML, "https://adabworld.com/poems/test");

    expect(data.title).toBe("تطاول ليلك بالأثمد");
    expect(data.meterName).toBe("المتقارب");
    expect(data.verseCount).toBe(2);
    expect(data.verses).toHaveLength(2);
    expect(data.verses[0]).toContain("تَطاوَلَ لَيلُكَ بِالأَثمَدِ");

    expect(data.verseExplanations[0].explanationText).toContain("الأرق");
    expect(data.verseExplanations[0].glossary).toEqual([
      { term: "الأثمد", meaning: "نوع من الكحل الأسود." },
      { term: "الخليّ", meaning: "الشخص الخالي من الهموم." },
    ]);

    expect(data.summary).toContain("أرقه الطويل");
    expect(data.rhetoricalAnalysis).toContain("التشبيه");
    expect(data.rhetoricalAnalysis).toContain("الإيقاع");

    expect(data.poetName).toBe("امرؤ القيس");
  });

  it("5. throws a clear error when the page looks like a bot-challenge response", () => {
    expect(() =>
      provider.parseHtml("<html><body>irrelevant</body></html>", "https://adabworld.com/poems/test")
    ).toThrow();
  });

  it("6. splits a verse into two hemistichs by word count", () => {
    const { first, second } = provider.splitHemistichs("تَطاوَلَ لَيلُكَ بِالأَثمَدِ وَنامَ الخَليُّ وَلَم تَرقُدِ");
    expect(first.split(/\s+/).length).toBeGreaterThan(0);
    expect(second.split(/\s+/).length).toBeGreaterThan(0);
    expect(`${first} ${second}`.split(/\s+/).length).toBe(7);
  });

  it("7. maps parsed data into a ParsedPoemPayload with sequential verse ordering", () => {
    const data = provider.parseHtml(FIXTURE_HTML, "https://adabworld.com/poems/test");
    const payload = provider.mapDataToPayload(data);

    expect(payload.title).toBe(data.title);
    expect(payload.verses.map((v) => v.orderIndex)).toEqual([1, 2]);
    expect(payload.bahr).toBe("المتقارب");
  });

  it("8. builds per-verse explanation items, including a rhetorical-analysis item on verse 1", () => {
    const data = provider.parseHtml(FIXTURE_HTML, "https://adabworld.com/poems/test");
    const map = provider.buildVerseExplanations(data);

    const verse1Items = map.get("1") || [];
    expect(verse1Items.some((item) => item.explanationType === "verse")).toBe(true);
    expect(verse1Items.some((item) => item.explanationType === "classical")).toBe(true);
    expect(verse1Items.some((item) => item.explanationType === "rhetorical")).toBe(true);

    const verse2Items = map.get("2") || [];
    expect(verse2Items.some((item) => item.explanationType === "verse")).toBe(true);
  });
});
