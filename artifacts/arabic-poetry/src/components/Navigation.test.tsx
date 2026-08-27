import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navigation } from "./Navigation";

describe("Navigation component", () => {
  it("renders all navigation items correctly", () => {
    const handleSelectTab = vi.fn();
    render(
      <Navigation
        activeTab="library"
        onSelectTab={handleSelectTab}
        hasActivePoem={true}
      />
    );

    expect(screen.getByText("دِيـــوَان")).toBeInTheDocument();
    expect(screen.getByText("المكتبة")).toBeInTheDocument();
    expect(screen.getByText("المشغّل والمزامنة")).toBeInTheDocument();
    expect(screen.getByText("محرر الحدود الزمنية")).toBeInTheDocument();
    expect(screen.getByText("استيراد قصيدة")).toBeInTheDocument();
    expect(screen.getByText("الإعدادات")).toBeInTheDocument();
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

    fireEvent.click(screen.getByText("الإعدادات"));
    expect(handleSelectTab).toHaveBeenCalledWith("settings");
  });
});
