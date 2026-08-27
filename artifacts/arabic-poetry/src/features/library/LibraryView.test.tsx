import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryView } from "./LibraryView";
import { MOCK_POEMS } from "@/data/mockData";

describe("LibraryView component", () => {
  it("renders list of poems and search bar", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();

    render(
      <LibraryView
        poems={MOCK_POEMS}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
      />
    );

    expect(screen.getByText("ديوان الشعر العربي")).toBeInTheDocument();
    expect(screen.getAllByText("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ").length).toBeGreaterThan(0);
    expect(screen.getByText("أبو الطيب المتنبي")).toBeInTheDocument();
  });

  it("filters poems when searching in Arabic", () => {
    const handleOpenPoem = vi.fn();
    const handleNavigateToImport = vi.fn();

    render(
      <LibraryView
        poems={MOCK_POEMS}
        onOpenPoem={handleOpenPoem}
        onNavigateToImport={handleNavigateToImport}
      />
    );

    const searchInput = screen.getByPlaceholderText(/ابحث بالقصيدة/i);
    fireEvent.change(searchInput, { target: { value: "امرؤ القيس" } });

    expect(screen.getAllByText("قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ").length).toBeGreaterThan(0);
    expect(screen.queryByText("واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ")).not.toBeInTheDocument();
  });
});
