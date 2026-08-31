import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerseItem } from "./VerseItem";
import { Verse } from "@/types";

const verse: Verse = {
  id: "v-1",
  poemId: "poem-1",
  orderIndex: 1,
  text: "الشطر الأول ... الشطر الثاني",
  normalizedText: "الشطر الاول الشطر الثاني",
  firstHemistich: "الشطر الأول",
  secondHemistich: "الشطر الثاني",
};

describe("VerseItem editing shortcuts", () => {
  it("saves the edit with Ctrl+Enter", async () => {
    const onEditVerse = vi.fn().mockResolvedValue(undefined);
    render(
      <VerseItem verse={verse} isActive={false} onSeekToVerse={vi.fn()} onEditVerse={onEditVerse} />
    );

    fireEvent.click(screen.getByTitle("تعديل نص البيت"));
    const firstInput = screen.getByPlaceholderText("الصدر");
    fireEvent.change(firstInput, { target: { value: "شطر معدل" } });
    fireEvent.keyDown(firstInput, { key: "Enter", ctrlKey: true });

    expect(onEditVerse).toHaveBeenCalledWith("v-1", "شطر معدل", "الشطر الثاني");
  });

  it("cancels the edit with Escape without saving", () => {
    const onEditVerse = vi.fn();
    render(
      <VerseItem verse={verse} isActive={false} onSeekToVerse={vi.fn()} onEditVerse={onEditVerse} />
    );

    fireEvent.click(screen.getByTitle("تعديل نص البيت"));
    const firstInput = screen.getByPlaceholderText("الصدر");
    fireEvent.change(firstInput, { target: { value: "تغيير لن يُحفظ" } });
    fireEvent.keyDown(firstInput, { key: "Escape" });

    expect(onEditVerse).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("الصدر")).not.toBeInTheDocument();
  });
});
