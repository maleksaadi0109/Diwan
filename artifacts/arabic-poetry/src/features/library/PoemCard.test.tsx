import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoemCard } from "./PoemCard";
import { Poem } from "@/types";

const testPoem: Poem = {
  id: "test-card-poem",
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
      id: "v-1",
      poemId: "test-card-poem",
      orderIndex: 1,
      text: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
      normalizedText: "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
      firstHemistich: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
      secondHemistich: "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
    },
  ],
};

describe("PoemCard component", () => {
  it("opens the poem when the card button is activated", () => {
    const handleOpenPoem = vi.fn();
    render(<PoemCard poem={testPoem} onOpenPoem={handleOpenPoem} />);

    const card = screen.getByRole("button", { name: new RegExp(testPoem.title) });
    fireEvent.click(card);
    expect(handleOpenPoem).toHaveBeenCalledWith(testPoem);
  });

  it("does not open the poem when Enter/Space is pressed on a nested action button", () => {
    const handleOpenPoem = vi.fn();
    const handleAddToPlaylist = vi.fn();
    const handleDeletePoem = vi.fn();

    render(
      <PoemCard
        poem={testPoem}
        onOpenPoem={handleOpenPoem}
        onAddToPlaylist={handleAddToPlaylist}
        onDeletePoem={handleDeletePoem}
      />
    );

    const addButton = screen.getByRole("button", { name: "إضافة إلى قائمة تشغيل" });
    fireEvent.keyDown(addButton, { key: "Enter" });
    expect(handleOpenPoem).not.toHaveBeenCalled();

    const deleteButton = screen.getByRole("button", { name: "حذف القصيدة" });
    fireEvent.keyDown(deleteButton, { key: " " });
    expect(handleOpenPoem).not.toHaveBeenCalled();
  });

  it("toggles selection when the card button is activated in selection mode", () => {
    const handleOpenPoem = vi.fn();
    const handleToggleSelect = vi.fn();

    render(
      <PoemCard
        poem={testPoem}
        onOpenPoem={handleOpenPoem}
        selectionMode
        isSelected={false}
        onToggleSelect={handleToggleSelect}
      />
    );

    const card = screen.getByRole("button", { name: new RegExp(testPoem.title) });
    fireEvent.click(card);
    expect(handleToggleSelect).toHaveBeenCalledWith(testPoem.id);
  });
});
