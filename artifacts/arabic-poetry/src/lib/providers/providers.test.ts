import { describe, it, expect } from "vitest";
import { AldewanProvider } from "./AldewanProvider";
import { LocalCorpusProvider } from "./LocalCorpusProvider";

describe("Poem Providers", () => {
  describe("AldewanProvider", () => {
    const provider = new AldewanProvider();

    // Minimal fixture mirroring aldiwan.net's real markup: breadcrumb JSON-LD,
    // a `poem_content` block with one verse (two <h3> hemistichs, one word
    // wrapped in a mosahma_highlight span), and the corresponding
    // "مساهمات" (contributions) glossary entry for that word.
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>تطاول ليلك بالأثمد - امرؤ القيس - الديوان</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "العصر الجاهلي", "item": "https://www.aldiwan.net/cat-poets-pre-islamic-period"},
            {"@type": "ListItem", "position": 2, "name": "امرؤ القيس", "item": "https://www.aldiwan.net/cat-poet-imru-alqays"},
            {"@type": "ListItem", "position": 3, "name": "تطاول ليلك بالأثمد"}
          ]
        }
        </script>
      </head>
      <body>
        <div class="bet-1 row" id="poem_content">
          <h3>تَطاوَلَ لَيلُكَ <span class="mosahma_highlight" id="496">بِالأَثمَدِ</span></h3>
          <h3>وَنامَ الخَلِيُّ وَلَم تَرقُدِ</h3>
        </div>
        <div class="header-center">نبذة عن القصيدة</div>
        <div class="tips row">
          <div class="col-6 col-md-3"><a href="sea-المتقارب.html">بحر المتقارب</a></div>
          <div class="col-6 col-md-3"><a href="q-د">قافية الدال (د)</a></div>
        </div>
        <div class="mosahmat">
          <div id="mosahma_496" class="mosahmat_item">
            <div class="header">
              <h2 class="h3">بِالأَثمَدِ</h2>
            </div>
            <h4 class="main-color">الإثمد: اسم موضع.</h4>
          </div>
        </div>
        <div class="s-menu1"></div>
      </body>
      </html>
    `;

    it("extracts poem/poet metadata from the breadcrumb", () => {
      const result = provider.parseHtml(sampleHtml, "https://www.aldiwan.net/poem81.html");
      expect(result.title).toBe("تطاول ليلك بالأثمد");
      expect(result.poetName).toBe("امرؤ القيس");
      expect(result.era).toBe("جاهلي");
    });

    it("extracts bahr and rhyme from the topic links", () => {
      const result = provider.parseHtml(sampleHtml);
      expect(result.bahr).toBe("المتقارب");
      expect(result.rhyme).toBe("الدال (د)");
    });

    it("pairs consecutive hemistich <h3> tags into verses", () => {
      const result = provider.parseHtml(sampleHtml);
      expect(result.verses).toHaveLength(1);
      expect(result.verses[0].firstHemistich).toBe("تَطاوَلَ لَيلُكَ بِالأَثمَدِ");
      expect(result.verses[0].secondHemistich).toBe("وَنامَ الخَلِيُّ وَلَم تَرقُدِ");
    });

    it("extracts the word-meaning glossary from the contributions section", () => {
      const result = provider.parseHtml(sampleHtml);
      expect(result.glossary).toHaveLength(1);
      expect(result.glossary?.[0]).toEqual({
        word: "بِالأَثمَدِ",
        meaning: "الإثمد: اسم موضع.",
      });
    });

    it("rejects a URL from a different host", () => {
      expect(() => provider.extractPoemPathFromUrl("https://example.com/poem81.html")).toThrow();
    });

    it("accepts a valid aldiwan.net poem URL", () => {
      expect(provider.extractPoemPathFromUrl("https://www.aldiwan.net/poem81.html")).toBe("poem81.html");
    });
  });

  describe("LocalCorpusProvider", () => {
    const provider = new LocalCorpusProvider();

    it("parses JSON poem file format", () => {
      const jsonStr = JSON.stringify({
        title: "أراك عصي الدمع",
        poet: { name: "أبو فراس الحمداني", era: "عباسي" },
        bahr: "الطويل",
        verses: [
          { orderIndex: 1, first: "أراك عصي الدمع شيمتك الصبر", second: "أما للهوى نهي عليك ولا أمر" },
        ],
      });

      const result = provider.parseJson(jsonStr);
      expect(result.title).toBe("أراك عصي الدمع");
      expect(result.poetName).toBe("أبو فراس الحمداني");
      expect(result.bahr).toBe("الطويل");
      expect(result.verses).toHaveLength(1);
      expect(result.verses[0].firstHemistich).toBe("أراك عصي الدمع شيمتك الصبر");
    });

    it("parses TSV/CSV format", () => {
      const tsv = `الشطر الأول\tالشطر الثاني\nولست أرى السعادة جمع مال\tولكن التقي هو السعيد`;
      const result = provider.parseTsvOrCsv(tsv, "\t");
      expect(result.verses).toHaveLength(1);
      expect(result.verses[0].firstHemistich).toBe("ولست أرى السعادة جمع مال");
      expect(result.verses[0].secondHemistich).toBe("ولكن التقي هو السعيد");
    });
  });
});
