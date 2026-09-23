import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CatalogView } from "./CatalogView";
import { POEM_CATALOG, CATALOG_RECITERS } from "@/data/poemCatalog";

const mockEnqueue = vi.fn().mockReturnValue("job-test-1");

vi.mock("@/contexts/ImportQueueContext", () => ({
  useImportQueueContext: () => ({
    enqueuePoemImport: mockEnqueue,
    jobs: [],
  }),
}));

vi.mock("@/lib/providers/MizanAlArabProvider", () => {
  return {
    MizanAlArabProvider: class {
      fetchPoemById = vi.fn().mockResolvedValue({ id: "123" });
      mapApiResponseToPayload = vi.fn().mockReturnValue({
        title: "قصيدة اختبارية",
        poetName: "شاعر اختباري",
        era: "عباسي",
        bahr: "الطويل",
        rhyme: "ر",
        verses: [],
      });
    },
  };
});

describe("CatalogView reciter-organized layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reciter layout by default with reciter cards and headers", () => {
    render(<CatalogView poems={[]} />);

    // Shows the library title
    expect(screen.getByText("المكتبة الجاهزة")).toBeDefined();

    // Check that reciters bar is rendered
    expect(screen.getByText(/تصفح حسب القارئ/)).toBeDefined();
    expect(screen.getByText("كل القرّاء")).toBeDefined();

    // Reciters should be visible in the filter bar
    expect(screen.getAllByText(CATALOG_RECITERS["osama-alwaaedh"].name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(CATALOG_RECITERS["omar-alsharafi"].name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(CATALOG_RECITERS["khaled-alsharafi"].name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(CATALOG_RECITERS["khaled-bin-hassan"].name).length).toBeGreaterThanOrEqual(1);
  });

  it("filters poems when clicking a specific reciter in the top bar", () => {
    render(<CatalogView poems={[]} />);

    // Initially reciter sections exist in "by_reciter" mode
    expect(screen.getAllByText(CATALOG_RECITERS["omar-alsharafi"].name).length).toBeGreaterThanOrEqual(1);

    // Click on Omar Al-Sharafi filter button
    const omarButtons = screen.getAllByRole("button", { name: new RegExp(CATALOG_RECITERS["omar-alsharafi"].name) });
    fireEvent.click(omarButtons[0]);

    // In filtered view, "إظهار جميع القرّاء" appears
    expect(screen.getByText("إظهار جميع القرّاء")).toBeDefined();
  });

  it("switches view modes between grouped by reciter and unified grid", () => {
    render(<CatalogView poems={[]} />);

    // Find view mode buttons
    const gridModeBtn = screen.getByTitle("عرض شبكة موحدة");
    fireEvent.click(gridModeBtn);

    // In grid mode, poem cards still show the reciter chip
    const poemTitle = POEM_CATALOG[0].titleHint;
    expect(screen.getByText(poemTitle)).toBeDefined();

    const reciterModeBtn = screen.getByTitle("عرض مرتب حسب القارئ");
    fireEvent.click(reciterModeBtn);

    expect(screen.getByText(poemTitle)).toBeDefined();
  });

  it("searches poems by title, poet, or reciter name", () => {
    render(<CatalogView poems={[]} />);

    const searchInput = screen.getByPlaceholderText(/بحث في القصائد/);
    fireEvent.change(searchInput, { target: { value: "عنترة" } });

    // Matching poems/poets should be displayed
    expect(screen.getAllByText(/عنترة/).length).toBeGreaterThan(0);
  });
});
