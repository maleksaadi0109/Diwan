import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShortcutsReferenceModal } from "./ShortcutsReferenceModal";

describe("ShortcutsReferenceModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutsReferenceModal open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every registered shortcut when open with no filter", () => {
    render(<ShortcutsReferenceModal open onClose={vi.fn()} />);
    expect(screen.getAllByText("تشغيل أو إيقاف القراءة").length).toBeGreaterThan(0);
    expect(screen.getByText(/وضع علامة حد زمني/)).toBeInTheDocument();
    expect(screen.getByText(/حفظ تعديل نص البيت/)).toBeInTheDocument();
  });

  it("filters the list by search query", () => {
    render(<ShortcutsReferenceModal open onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText("ابحث عن اختصار...");
    fireEvent.change(input, { target: { value: "حد زمني" } });
    expect(screen.getByText(/وضع علامة حد زمني/)).toBeInTheDocument();
    expect(screen.queryByText("تشغيل أو إيقاف القراءة")).not.toBeInTheDocument();
  });

  it("shows an empty state when no shortcut matches the query", () => {
    render(<ShortcutsReferenceModal open onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText("ابحث عن اختصار...");
    fireEvent.change(input, { target: { value: "xyz-does-not-exist" } });
    expect(screen.getByText("لا توجد اختصارات مطابقة")).toBeInTheDocument();
  });

  it("calls onClose when the overlay or close button is clicked", () => {
    const onClose = vi.fn();
    render(<ShortcutsReferenceModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
