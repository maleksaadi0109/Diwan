import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoemPlayerView } from "./PoemPlayerView";
import { MOCK_POEMS } from "@/data/mockData";

describe("PoemPlayerView component", () => {
  it("renders the poem title and verses", () => {
    const samplePoem = MOCK_POEMS[0];
    render(<PoemPlayerView poem={samplePoem} />);

    expect(screen.getByRole("heading", { level: 2, name: samplePoem.title })).toBeInTheDocument();
    expect(
      screen.getAllByText(samplePoem.verses[0].firstHemistich).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(samplePoem.verses[0].secondHemistich)
    ).toBeInTheDocument();
  });
});
