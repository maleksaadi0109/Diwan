import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoemCard } from "./PoemCard";
import { MOCK_POEMS } from "@/data/mockData";

describe("PoemCard component", () => {
  it("opens the poem when the card button is activated", () => {
    // The card's open/select control is now a native <button>, so browsers
    // handle Enter/Space activation for us; simulate that native behavior
    // via a click event (jsdom does not synthesize click from keyDown).
    const handleOpenPoem = vi.fn();
    render(<PoemCard poem={MOCK_POEMS[0]} onOpenPoem={handleOpenPoem} />);

    const card = screen.getByRole("button", { name: new RegExp(MOCK_POEMS[0].title) });
    fireEvent.click(card);
    expect(handleOpenPoem).toHaveBeenCalledWith(MOCK_POEMS[0]);
  });

  it("does not open the poem when Enter/Space is pressed on a nested action button", () => {
    const handleOpenPoem = vi.fn();
    const handleAddToPlaylist = vi.fn();
    const handleDeletePoem = vi.fn();

    render(
      <PoemCard
        poem={MOCK_POEMS[0]}
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
        poem={MOCK_POEMS[0]}
        onOpenPoem={handleOpenPoem}
        selectionMode
        isSelected={false}
        onToggleSelect={handleToggleSelect}
      />
    );

    const card = screen.getByRole("button", { name: new RegExp(MOCK_POEMS[0].title) });
    fireEvent.click(card);
    expect(handleToggleSelect).toHaveBeenCalledWith(MOCK_POEMS[0].id);
  });
});
