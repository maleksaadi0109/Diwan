import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BoundaryReviewEditor } from "./BoundaryReviewEditor";
import { mockPoems } from "@/data/mockData";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";

describe("BoundaryReviewEditor", () => {
  const mockPoem = mockPoems[0];

  it("renders poem title and verses list", () => {
    render(
      <AudioPlayerProvider>
        <BoundaryReviewEditor
          poem={mockPoem}
          onUpdateBoundary={() => {}}
        />
      </AudioPlayerProvider>
    );

    expect(screen.getByText("محرر المحاذاة وتدقيق الحدود")).toBeInTheDocument();
    expect(screen.getByText("البيت رقم ١")).toBeInTheDocument();
  });

  it("updates boundary when nudging start time", () => {
    const onUpdate = vi.fn();
    render(
      <AudioPlayerProvider>
        <BoundaryReviewEditor
          poem={mockPoem}
          onUpdateBoundary={onUpdate}
        />
      </AudioPlayerProvider>
    );

    const plus50Btns = screen.getAllByText("+50");
    // Click start timestamp +50ms nudge
    fireEvent.click(plus50Btns[0]);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("toggles status between auto, reviewed, and manual", () => {
    const onUpdate = vi.fn();
    render(
      <AudioPlayerProvider>
        <BoundaryReviewEditor
          poem={mockPoem}
          onUpdateBoundary={onUpdate}
        />
      </AudioPlayerProvider>
    );

    const manualBtn = screen.getByRole("button", { name: "يدوي" });
    fireEvent.click(manualBtn);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
      "manual"
    );
  });
});
