import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryView } from "./LibraryView";
import { Poem } from "@/types";

const testLibraryPoems: Poem[] = [
  {
    id: "poem-1",
    title: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
    poet: {
      id: "mutanabbi",
      name: "أبو الطيب المتنبي",
      era: "عباسي",
    },
    era: "عباسي",
    bahr: "البسيط",
    rhyme: "الميم المضمومة (ـمُ)",
    versesCount: 1,
    tags: ["عتاب", "فخر"],
    recordings: [],
    verses: [
      {
        id: "v1-1",
        poemId: "poem-1",
        orderIndex: 1,
        text: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
        normalizedText: "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
        firstHemistich: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
        secondHemistich: "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
      },
    ],
  },
  {
    id: "poem-2",
    title: "قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ",
    poet: {
      id: "imru_alqais",
      name: "امرؤ القيس",
      era: "جاهلي",
    },
    era: "جاهلي",
    bahr: "الطويل",
    rhyme: "اللام المكسورة (ـلِ)",
    versesCount: 1,
    tags: ["غزل", "معلقة"],
    recordings: [],
    verses: [
      {
        id: "v2-1",
        poemId: "poem-2",
        orderIndex: 1,
        text: "قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ ... بِسِقطِ اللِوى بَينَ الدَخولِ فَحَومَلِ",
        normalizedText: "قفا نبك من ذكرى حبيب ومنزل بسقط اللوى بين الدخول فحومل",
        firstHemistich: "قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ",
        secondHemistich: "بِسِقطِ اللِوى بَينَ الدَخولِ فَحَومَلِ",
      },
    ],
  },
];

describe("LibraryView component", () => {
  it("renders list of poems and search bar", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();

    render(
      <LibraryView
        poems={testLibraryPoems}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
      />
    );

    expect(screen.getByText("المكتبة")).toBeInTheDocument();
    expect(screen.getAllByText("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ").length).toBeGreaterThan(0);
    expect(screen.getByText("أبو الطيب المتنبي")).toBeInTheDocument();
  });

  it("filters poems when searching in Arabic", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();

    render(
      <LibraryView
        poems={testLibraryPoems}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
      />
    );

    const searchInput = screen.getByPlaceholderText(/ابحث بقصيدة/i);
    fireEvent.change(searchInput, { target: { value: "امرؤ القيس" } });

    expect(screen.getAllByText("قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ").length).toBeGreaterThan(0);
    expect(screen.queryByText("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ")).not.toBeInTheDocument();
  });

  it("renders empty library state when no poems exist", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();

    render(
      <LibraryView
        poems={[]}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
      />
    );

    expect(screen.getByText("المكتبة فارغة حالياً")).toBeInTheDocument();
    const importBtn = screen.getByRole("button", { name: "استيراد قصيدة جديدة" });
    fireEvent.click(importBtn);
    expect(handleNavigateToImport).toHaveBeenCalled();
  });

  it("supports multi-select and bulk deletion", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();
    const handleBulkDelete = vi.fn();

    render(
      <LibraryView
        poems={testLibraryPoems}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
        onBulkDeletePoems={handleBulkDelete}
      />
    );

    // Turn on multi-select
    const selectModeBtn = screen.getByRole("button", { name: "تحديد متعدد" });
    fireEvent.click(selectModeBtn);

    // Click "تحديد الكل"
    const selectAllBtn = screen.getByRole("button", { name: "تحديد الكل" });
    fireEvent.click(selectAllBtn);

    // Floating action bar appears with delete button
    const deleteBulkBtn = screen.getByRole("button", { name: /حذف المحدد/i });
    fireEvent.click(deleteBulkBtn);

    // Confirmation modal appears
    expect(screen.getByText("تأكيد حذف القصائد")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "تأكيد الحذف النهائي" });
    fireEvent.click(confirmBtn);

    expect(handleBulkDelete).toHaveBeenCalledWith(["poem-1", "poem-2"]);
  });
});
