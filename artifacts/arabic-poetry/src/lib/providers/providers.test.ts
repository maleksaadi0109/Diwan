import { describe, it, expect } from "vitest";
import { AldewanProvider } from "./AldewanProvider";
import { LocalCorpusProvider } from "./LocalCorpusProvider";

describe("Poem Providers", () => {
  describe("AldewanProvider", () => {
    const provider = new AldewanProvider();

    it("parses Aldewan HTML structure correctly", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>واحر قلباه - أبو الطيب المتنبي - الديوان</title></head>
        <body>
          <h1 class="poem-title">واحر قلباه ممن قلبه شبم</h1>
          <div class="poet-name">أبو الطيب المتنبي</div>
          <div class="bahr">بحر البسيط</div>
          <div class="era">العصر العباسي</div>
          <div class="poem-content">
            <h3 class="bet">واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ</h3>
            <h3 class="bet">ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي ... وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ</h3>
          </div>
        </body>
        </html>
      `;

      const result = provider.parseHtml(sampleHtml);
      expect(result.title).toBe("واحر قلباه ممن قلبه شبم");
      expect(result.poetName).toBe("أبو الطيب المتنبي");
      expect(result.bahr).toBe("البسيط");
      expect(result.era).toBe("عباسي");
      expect(result.verses).toHaveLength(2);
      expect(result.verses[0].firstHemistich).toBe("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ");
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
