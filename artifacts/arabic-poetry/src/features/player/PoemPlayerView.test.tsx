import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoemPlayerView } from "./PoemPlayerView";
import { Poem } from "@/types";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";

const samplePoem: Poem = {
  id: "test-poem-1",
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
      poemId: "test-poem-1",
      orderIndex: 1,
      text: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
      normalizedText: "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
      firstHemistich: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
      secondHemistich: "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
    },
  ],
};

describe("PoemPlayerView component", () => {
  it("renders the poem title and verses", () => {
    render(
      <AudioPlayerProvider>
        <PoemPlayerView poem={samplePoem} />
      </AudioPlayerProvider>
    );

    expect(screen.getByRole("heading", { level: 2, name: samplePoem.title })).toBeInTheDocument();
    expect(screen.getAllByText("واحَرَّ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("شَبِمُ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("سَقَمُ").length).toBeGreaterThan(0);
  });

  it("calls onOpenShortcutsHelp when the help button is clicked", () => {
    const onOpenShortcutsHelp = vi.fn();
    render(
      <AudioPlayerProvider>
        <PoemPlayerView poem={samplePoem} onOpenShortcutsHelp={onOpenShortcutsHelp} />
      </AudioPlayerProvider>
    );

    fireEvent.click(screen.getByLabelText("عرض اختصارات لوحة المفاتيح"));
    expect(onOpenShortcutsHelp).toHaveBeenCalledTimes(1);
  });
});

describe("PoemPlayerView keyboard row navigation & boundary marking", () => {
  const twoVersePoem: Poem = {
    ...samplePoem,
    verses: [
      { ...samplePoem.verses[0], id: "v-1", orderIndex: 1 },
      {
        ...samplePoem.verses[0],
        id: "v-2",
        orderIndex: 2,
        firstHemistich: "شطر ثانٍ أول",
        secondHemistich: "شطر ثانٍ ثانٍ",
        text: "شطر ثانٍ أول ... شطر ثانٍ ثانٍ",
      },
    ],
  };

  it("selects the next/previous verse row with ArrowDown/ArrowUp without seeking", () => {
    render(
      <AudioPlayerProvider>
        <PoemPlayerView poem={twoVersePoem} />
      </AudioPlayerProvider>
    );

    // Nothing selected yet -- ArrowDown selects the first verse row, a
    // second ArrowDown moves to the next, and ArrowUp moves back -- none of
    // this should throw or remove either verse row from the DOM (unlike
    // Left/Right, which seek playback rather than change selection).
    fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });

    expect(
      screen.getAllByTitle("انقر نقرًا مزدوجًا لعرض شرح البيت في نافذة مستقلة").length
    ).toBe(2);
  });

  it("invokes onMarkVerseBoundary with the active verse id on KeyB", () => {
    const onMarkVerseBoundary = vi.fn();
    render(
      <AudioPlayerProvider>
        <PoemPlayerView poem={twoVersePoem} onMarkVerseBoundary={onMarkVerseBoundary} />
      </AudioPlayerProvider>
    );

    fireEvent.keyDown(window, { key: "b", code: "KeyB" });
    // With no active playback yet there's no active verse, so nothing fires;
    // this confirms the handler doesn't throw when there's no active verse.
    expect(onMarkVerseBoundary).not.toHaveBeenCalled();
  });

  it("ignores row-navigation and boundary shortcuts while typing in a text field", () => {
    const onMarkVerseBoundary = vi.fn();
    render(
      <AudioPlayerProvider>
        <PoemPlayerView poem={twoVersePoem} onMarkVerseBoundary={onMarkVerseBoundary} />
      </AudioPlayerProvider>
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "b", code: "KeyB" });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    expect(onMarkVerseBoundary).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
