import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navigation } from "./Navigation";

// The redesigned Navigation renders two parallel surfaces -- a desktop
// sidebar (`aside`) and a mobile bottom bar (`nav` with a distinct
// aria-label). The mobile bar shows shortened visible labels (so a single
// line never wraps and grows the fixed-height bar), but exposes the same
// full label as its accessible name via aria-label/title. Queries must be
// scoped to a surface, or use the accessible name for the mobile button.

describe("Navigation component", () => {
  it("renders all navigation items correctly on both desktop and mobile surfaces", () => {
    const handleSelectTab = vi.fn();
    render(
      <Navigation
        activeTab="library"
        onSelectTab={handleSelectTab}
        hasActivePoem={true}
      />
    );

    expect(screen.getByText("دِيـــوَان")).toBeInTheDocument();

    // Desktop sidebar and mobile bottom bar both expose a <nav> landmark
    // with the same label; there should be exactly the two of them.
    expect(screen.getAllByRole("navigation", { name: "أقسام التطبيق" })).toHaveLength(2);

    for (const label of [
      "المكتبة",
      "المشغّل والمزامنة",
      "استيراد قصيدة",
      "الإعدادات",
    ]) {
      // Visible once in the desktop sidebar's text, and exposed as the
      // accessible name of the corresponding mobile bottom-nav button.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("button", { name: label }).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("calls onSelectTab when clicking a tab", () => {
    const handleSelectTab = vi.fn();
    render(
      <Navigation
        activeTab="library"
        onSelectTab={handleSelectTab}
        hasActivePoem={true}
      />
    );

    const [settingsButton] = screen.getAllByRole("button", { name: /الإعدادات/ });
    fireEvent.click(settingsButton);
    expect(handleSelectTab).toHaveBeenCalledWith("settings");
  });
});
