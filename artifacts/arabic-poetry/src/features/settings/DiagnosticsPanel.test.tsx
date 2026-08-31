import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DiagnosticsPanel", () => {
  it("runs the health snapshot and shows worker/tooling details", async () => {
    render(<DiagnosticsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "تشغيل فحص الصحة" }));

    await waitFor(() => {
      expect(screen.getByText("معالج بايثون متصل وجاهز للعمل")).toBeInTheDocument();
    });
    expect(screen.getByText(/إصدار yt-dlp/)).toBeInTheDocument();
  });

  it("runs the audio decode test against the bundled sample and shows a pass result", async () => {
    render(<DiagnosticsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "اختبار بملف نموذجي" }));

    await waitFor(() => {
      expect(screen.getByText(/المدة:/)).toBeInTheDocument();
    });
  });

  it("runs the storage permissions test and shows a pass result", async () => {
    render(<DiagnosticsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "تشغيل الاختبار" }));

    await waitFor(() => {
      expect(screen.getByText("تمت الكتابة والقراءة والحذف بنجاح")).toBeInTheDocument();
    });
  });

  it("exports a diagnostic report and shows a success message", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DiagnosticsPanel />);

    fireEvent.click(screen.getByRole("button", { name: /تصدير تقرير تشخيصي/ }));

    await waitFor(() => {
      expect(screen.getByText("تم حفظ التقرير التشخيصي بنجاح")).toBeInTheDocument();
    });
  });
});
