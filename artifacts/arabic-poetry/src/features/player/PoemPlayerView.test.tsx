import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
