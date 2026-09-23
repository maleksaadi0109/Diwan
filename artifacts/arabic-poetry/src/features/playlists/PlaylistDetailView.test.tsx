import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistDetailView } from "./PlaylistDetailView";
import { Playlist, Poem } from "@/types";

const mockPlaylist: Playlist = {
  id: "pl-1",
  name: "قصائد المتنبي",
  createdAt: "2026-01-01T00:00:00.000Z",
  poemIds: ["poem-1", "poem-2"],
};

const mockPoems: Poem[] = [
  {
    id: "poem-1",
    title: "واحَرَّ قَلباهُ",
    poet: { id: "mutanabbi", name: "المتنبي", era: "عباسي" },
    era: "عباسي",
    bahr: "البسيط",
    rhyme: "ـمُ",
    versesCount: 1,
    coverImageUrl: "https://example.com/cover1.jpg",
    recordings: [],
    verses: [
      {
        id: "v-1",
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
    title: "الخيل والليل",
    poet: { id: "mutanabbi", name: "المتنبي", era: "عباسي" },
    era: "عباسي",
    bahr: "البسيط",
    rhyme: "ـمُ",
    versesCount: 1,
    recordings: [],
    verses: [
      {
        id: "v-2",
        poemId: "poem-2",
        orderIndex: 1,
        text: "الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ",
        normalizedText: "الخيل والليل والبيداء تعرفني والسيف والرمح والقرطاس والقلم",
        firstHemistich: "الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني",
        secondHemistich: "وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ",
      },
    ],
  },
];

describe("PlaylistDetailView poem click behavior", () => {
  it("only calls onOpenPoem when clicking the cover image button, not when clicking the title or play button", () => {
    const onOpenPoem = vi.fn();
    const onPlayFromIndex = vi.fn();
    const onTogglePlay = vi.fn();

    render(
      <PlaylistDetailView
        playlist={mockPlaylist}
        poems={mockPoems}
        isPlayingThisPlaylist={true}
        isPlaying={false}
        currentPoemId={null}
        shuffle={false}
        repeatMode="off"
        onBack={vi.fn()}
        onPlayFromIndex={onPlayFromIndex}
        onOpenPoem={onOpenPoem}
        onTogglePlay={onTogglePlay}
        onToggleShuffle={vi.fn()}
        onCycleRepeatMode={vi.fn()}
        onRemovePoem={vi.fn()}
        onReorder={vi.fn()}
        onRenamePlaylist={vi.fn()}
      />
    );

    // 1. Click title button of the first poem -> plays within playlist, does NOT open poem player
    const titleButtons = screen.getAllByTitle("تشغيل القصيدة في القائمة");
    fireEvent.click(titleButtons[0]);
    expect(onPlayFromIndex).toHaveBeenCalledWith(0);
    expect(onOpenPoem).not.toHaveBeenCalled();

    // 2. Click play button of the second poem -> plays within playlist, does NOT open poem player
    const playButtons = screen.getAllByTitle("تشغيل من هذه القصيدة");
    fireEvent.click(playButtons[1]);
    expect(onPlayFromIndex).toHaveBeenCalledWith(1);
    expect(onOpenPoem).not.toHaveBeenCalled();

    // 3. Click the cover image of the first poem -> ONLY this opens the poem player page!
    const coverImageButton = screen.getByLabelText("عرض صفحة واحَرَّ قَلباهُ");
    fireEvent.click(coverImageButton);
    expect(onOpenPoem).toHaveBeenCalledTimes(1);
    expect(onOpenPoem).toHaveBeenCalledWith(mockPoems[0], 0);

    // 4. Click cover thumbnail placeholder of the second poem (no image URL) -> also opens poem player page
    const placeholderThumbButton = screen.getByLabelText("عرض صفحة الخيل والليل");
    fireEvent.click(placeholderThumbButton);
    expect(onOpenPoem).toHaveBeenCalledTimes(2);
    expect(onOpenPoem).toHaveBeenCalledWith(mockPoems[1], 1);
  });
});
