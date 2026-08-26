import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BoundaryReviewEditor } from "./BoundaryReviewEditor";
import { mockPoems } from "@/data/mockData";

describe("BoundaryReviewEditor", () => {
  const mockPoem = mockPoems[0];

  it("renders poem title and verses list", () => {
    render(
      <BoundaryReviewEditor
        poem={mockPoem}
        onUpdateBoundary={() => {}}
      />
    );

    expect(screen.getByText("محرر المحاذاة وتدقيق الحدود الزمنية")).toBeInTheDocument();
    expect(screen.getByText("البيت رقم ١")).toBeInTheDocument();
  });

  it("updates boundary when nudging start time", () => {
    const onUpdate = vi.fn();
    render(
      <BoundaryReviewEditor
        poem={mockPoem}
        onUpdateBoundary={onUpdate}
      />
    );

    const plus50Btns = screen.getAllByText("+50ms");
    // Click start timestamp +50ms nudge
    fireEvent.click(plus50Btns[0]);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("toggles status between auto, reviewed, and manual", () => {
    const onUpdate = vi.fn();
    render(
      <BoundaryReviewEditor
        poem={mockPoem}
        onUpdateBoundary={onUpdate}
      />
    );

    const reviewedBtn = screen.getByText("مدقق");
    fireEvent.click(reviewedBtn);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
      "reviewed"
    );
  });
});
