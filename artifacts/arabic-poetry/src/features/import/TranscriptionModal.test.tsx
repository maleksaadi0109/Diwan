import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscriptionModal } from "./TranscriptionModal";
import { TranscriptResult } from "@/lib/worker/workerClient";

describe("TranscriptionModal", () => {
  const mockTranscript: TranscriptResult = {
    schema_version: "1.0",
    language: "ar",
    raw_text: "واحر قلباه ممن قلبه شبم",
    duration_ms: 6000,
    model_used: "small",
    device_used: "cpu",
    segments: [
      {
        id: 1,
        text: "واحر قلباه ممن قلبه شبم",
        start_ms: 2000,
        end_ms: 5500,
        words: [
          { word: "واحر", start_ms: 2000, end_ms: 2700, probability: 0.98 },
          { word: "قلباه", start_ms: 2800, end_ms: 3600, probability: 0.97 },
        ],
      },
    ],
    words: [
      { word: "واحر", start_ms: 2000, end_ms: 2700, probability: 0.98 },
      { word: "قلباه", start_ms: 2800, end_ms: 3600, probability: 0.97 },
    ],
  };

  it("does not render when closed", () => {
    const { container } = render(
      <TranscriptionModal
        isOpen={false}
        isTranscribing={false}
        progress={0}
        stageMessage=""
        transcript={null}
        errorMessage={null}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays transcribing progress state", () => {
    render(
      <TranscriptionModal
        isOpen={true}
        isTranscribing={true}
        progress={0.65}
        stageMessage="جاري معالجة الصوت بالذكاء الاصطناعي..."
        transcript={null}
        errorMessage={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("جاري معالجة الصوت بالذكاء الاصطناعي...")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("displays completed transcript and word timestamps", () => {
    const onApply = vi.fn();
    render(
      <TranscriptionModal
        isOpen={true}
        isTranscribing={false}
        progress={1.0}
        stageMessage="اكتمل"
        transcript={mockTranscript}
        errorMessage={null}
        onClose={() => {}}
        onApplyTranscript={onApply}
      />
    );

    expect(screen.getByText("واحر قلباه ممن قلبه شبم")).toBeInTheDocument();
    const applyBtn = screen.getByText("اعتماد التفريغ الصوتي");
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith(mockTranscript);
  });
});
