import { PoemImportProvider, ParsedPoemPayload, ParsedVersePayload } from "./types";
import { Era, Bahr } from "@/types";

export class LocalCorpusProvider implements PoemImportProvider {
  id = "local_corpus";
  name = "ملف محلي (JSON / TSV / CSV / TXT)";
  description = "استيراد ملفات القصائد والدواوين المحفوظة محلياً بتنسيقات متعددة";
  supportsUrl = false;

  public parseJson(jsonStr: string): ParsedPoemPayload {
    const data = JSON.parse(jsonStr);
    const title = String(data.title || "قصيدة مستوردة");
    const poetName = String(data.poet?.name || data.poetName || data.author || "شاعر غير محدد");
    const era = (data.era || data.poet?.era || "عباسي") as Era;
    const bahr = (data.bahr || "البسيط") as Bahr;
    const rhyme = String(data.rhyme || "غير محدد");

    const rawVerses = Array.isArray(data.verses) ? data.verses : [];
    const verses: ParsedVersePayload[] = rawVerses.map((v: Record<string, unknown>, idx: number) => {
      const text = String(v.text || `${v.firstHemistich || v.first || ""} ... ${v.secondHemistich || v.second || ""}`);
      const first = String(v.firstHemistich || v.first || text.split("...")[0]?.trim() || text);
      const second = String(v.secondHemistich || v.second || text.split("...")[1]?.trim() || "");

      return {
        orderIndex: Number(v.orderIndex || idx + 1),
        text,
        firstHemistich: first,
        secondHemistich: second,
      };
    });

    return {
      title,
      poetName,
      era,
      bahr,
      rhyme,
      description: data.description ? String(data.description) : undefined,
      verses,
    };
  }

  public parseTsvOrCsv(content: string, delimiter: string = "\t"): ParsedPoemPayload {
    const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const verses: ParsedVersePayload[] = [];

    lines.forEach((line, idx) => {
      // Ignore header if present
      if (idx === 0 && (line.includes("الشطر الأول") || line.includes("first"))) {
        return;
      }

      const parts = line.split(delimiter);
      const first = parts[0]?.trim() || "";
      const second = parts[1]?.trim() || "";
      const text = `${first} ... ${second}`.trim();

      if (first || second) {
        verses.push({
          orderIndex: verses.length + 1,
          text,
          firstHemistich: first,
          secondHemistich: second,
        });
      }
    });

    return {
      title: verses[0]?.firstHemistich || "قصيدة مستوردة",
      poetName: "شاعر غير محدد",
      era: "عباسي",
      bahr: "البسيط",
      rhyme: "غير محدد",
      verses,
    };
  }

  public parseRawText(text: string): ParsedPoemPayload {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return this.parseJson(trimmed);
    }
    if (trimmed.includes("\t")) {
      return this.parseTsvOrCsv(trimmed, "\t");
    }
    if (trimmed.includes(",") && !trimmed.includes("،")) {
      return this.parseTsvOrCsv(trimmed, ",");
    }

    // Default plaintext line-by-line
    const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const verses: ParsedVersePayload[] = lines.map((l, idx) => {
      const parts = l.split(/\s{3,}|\.{3,}| - /);
      return {
        orderIndex: idx + 1,
        text: l,
        firstHemistich: parts[0]?.trim() || l,
        secondHemistich: parts.slice(1).join(" ").trim(),
      };
    });

    return {
      title: verses[0]?.firstHemistich || "قصيدة مستوردة",
      poetName: "شاعر غير محدد",
      era: "عباسي",
      bahr: "البسيط",
      rhyme: "غير محدد",
      verses,
    };
  }
}
