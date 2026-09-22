import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoetryMapView } from "./PoetryMapView";
import { Poem } from "@/types";

const mockPoems: Poem[] = [
  {
    id: "poem-1",
    title: "بانت سعاد",
    poet: { id: "p1", name: "حسان بن ثابت", era: "إسلامي" },
    era: "إسلامي",
    bahr: "البسيط",
    rhyme: "اللام",
    versesCount: 0,
    verses: [],
    recordings: [],
    tags: []
  },
  {
    id: "poem-3",
    title: "قصيدة جديدة",
    poet: {
      id: "new-poet",
      name: "شاعر جديد",
      era: "معاصر",
      country: "العراق",
      city: "البصرة",
      latitude: 30.5,
      longitude: 47.8,
      regionId: "iraq",
      school: "الشعر الحر"
    },
    era: "معاصر",
    bahr: "تفعيلة / حر",
    rhyme: "غير محدد",
    versesCount: 0,
    verses: [],
    recordings: [],
    tags: []
  },
  {
    id: "poem-2",
    title: "نونية ابن زيدون",
    poet: { id: "p2", name: "ابن زيدون", era: "أندلسي" },
    era: "أندلسي",
    bahr: "الكامل",
    rhyme: "النون",
    versesCount: 0,
    verses: [],
    recordings: [],
    tags: []
  }
];

describe("PoetryMapView", () => {
  it("renders the map view and initial regions", () => {
    render(<PoetryMapView poems={mockPoems} onOpenPoem={vi.fn()} />);
    
    // Check main title
    expect(screen.getByText("أطلس الشعر العربي")).toBeInTheDocument();
    
    // Check if regions are rendered (by their names as text inside SVG)
    expect(screen.getByText("الأندلس")).toBeInTheDocument();
    expect(screen.getByText("الحجاز")).toBeInTheDocument();
    expect(screen.getByText("نجد")).toBeInTheDocument();
  });

  it("filters poets by era when an era button is clicked", () => {
    render(<PoetryMapView poems={mockPoems} onOpenPoem={vi.fn()} />);
    
    // Click the Andalusia region
    const andalusiaNode = screen.getByTestId("map-node-andalusia");
    fireEvent.click(andalusiaNode);
    
    // Should show Ibn Zaydun
    expect(screen.getByText("ابن زيدون")).toBeInTheDocument();
    
    // Switch era to Abbasid (where Ibn Zaydun is not present)
    const abbasidBtn = screen.getByRole("button", { name: "عباسي" });
    fireEvent.click(abbasidBtn);
    
    // Should show the empty state message
    expect(screen.getByText(/لا يوجد شعراء مدرجون/)).toBeInTheDocument();
  });

  it("calls onOpenPoem when a matched poem is clicked", () => {
    const handleOpenPoem = vi.fn();
    render(<PoetryMapView poems={mockPoems} onOpenPoem={handleOpenPoem} />);
    
    // Select Andalusia region
    const andalusiaNode = screen.getByTestId("map-node-andalusia");
    fireEvent.click(andalusiaNode);
    
    // The matched poem "نونية ابن زيدون" should be visible
    const poemBtn = screen.getByText("نونية ابن زيدون");
    expect(poemBtn).toBeInTheDocument();
    
    fireEvent.click(poemBtn);
    expect(handleOpenPoem).toHaveBeenCalledWith(mockPoems.find((poem) => poem.id === "poem-2"));
  });

  it("shows a newly imported poet from the poet's saved geography", () => {
    render(<PoetryMapView poems={mockPoems} onOpenPoem={vi.fn()} />);
    fireEvent.click(screen.getByTestId("map-node-iraq"));

    expect(screen.getByText("شاعر جديد")).toBeInTheDocument();
    expect(screen.getByText("البصرة، العراق")).toBeInTheDocument();
    expect(screen.getByText("قصيدة جديدة")).toBeInTheDocument();
  });
});