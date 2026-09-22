import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ImportQueueTray } from "./ImportQueueTray";
import { ImportQueueContext } from "@/contexts/ImportQueueContext";
import { AudioPlayerContext } from "@/contexts/AudioPlayerContext";
import type { ImportJob, Poem } from "@/types";

describe("ImportQueueTray Component", () => {
  const mockDismissJob = vi.fn();
  const mockDismissAllFinishedJobs = vi.fn();
  const mockSetIsTrayHidden = vi.fn();
  const mockSetAutoHideWhenIdle = vi.fn();
  const mockSetTrayCorner = vi.fn();
  const mockSetCustomCoordinates = vi.fn();
  const mockResetTrayPosition = vi.fn();

  const baseQueueValue = {
    jobs: [] as ImportJob[],
    isProcessing: false,
    enqueuePoemImport: vi.fn(),
    enqueueYoutubeDownload: vi.fn(),
    retryJob: vi.fn(),
    cancelJob: vi.fn(),
    dismissJob: mockDismissJob,
    dismissAllFinishedJobs: mockDismissAllFinishedJobs,
    getJobResult: vi.fn(),
    notifications: [],
    dismissNotification: vi.fn(),
    subscribeToCompletion: vi.fn(() => () => {}),
    isTrayHidden: false,
    setIsTrayHidden: mockSetIsTrayHidden,
    autoHideWhenIdle: false,
    setAutoHideWhenIdle: mockSetAutoHideWhenIdle,
    trayCorner: "bottom-left" as const,
    setTrayCorner: mockSetTrayCorner,
    customCoordinates: null,
    setCustomCoordinates: mockSetCustomCoordinates,
    resetTrayPosition: mockResetTrayPosition,
  };

  const baseAudioValue = {
    currentPoem: null as Poem | null,
    playerState: {
      isPlaying: false,
      currentTimeMs: 0,
      durationMs: 0,
      currentVerseIndex: 0,
      bufferedRanges: [],
      error: null,
    },
    audioController: null as any,
    playPoem: vi.fn(),
    togglePlay: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    seekToVerse: vi.fn(),
    setPlaybackRate: vi.fn(),
    playbackRate: 1,
    closeToTray: false,
    setCloseToTray: vi.fn(),
    mediaSessionEnabled: false,
    setMediaSessionEnabled: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (
    queueOverrides: Partial<typeof baseQueueValue> = {},
    audioOverrides: Partial<typeof baseAudioValue> = {}
  ) => {
    return render(
      <AudioPlayerContext.Provider value={{ ...baseAudioValue, ...audioOverrides }}>
        <ImportQueueContext.Provider value={{ ...baseQueueValue, ...queueOverrides }}>
          <ImportQueueTray />
        </ImportQueueContext.Provider>
      </AudioPlayerContext.Provider>
    );
  };

  it("renders nothing when there are no jobs and no notifications", () => {
    const { container } = renderWithProviders({ jobs: [] });
    expect(container.firstChild).toBeNull();
  });

  it("renders floating button when there are active jobs", () => {
    const activeJob: ImportJob = {
      id: "job-1",
      jobType: "poem_import",
      title: "قصيدة المتنبي",
      status: "processing",
      stage: "transcribe",
      stageLabel: "جاري التفريغ الصوتي",
      progress: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payloadJson: "{}",
      retryCount: 0,
    };

    renderWithProviders({ jobs: [activeJob] });
    const button = screen.getByTitle(/^طابور المعالجة/);
    expect(button).toBeDefined();
  });

  it("does not render floating button when isTrayHidden is true", () => {
    const activeJob: ImportJob = {
      id: "job-1",
      jobType: "poem_import",
      title: "قصيدة المتنبي",
      status: "processing",
      stage: "transcribe",
      stageLabel: "جاري التفريغ الصوتي",
      progress: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payloadJson: "{}",
      retryCount: 0,
    };

    renderWithProviders({ jobs: [activeJob], isTrayHidden: true });
    expect(screen.queryByTitle(/^طابور المعالجة/)).toBeNull();
  });

  it("auto-hides when autoHideWhenIdle is true and there are no running tasks", () => {
    const completedJob: ImportJob = {
      id: "job-1",
      jobType: "poem_import",
      title: "قصيدة المتنبي",
      status: "completed",
      stage: "completed",
      stageLabel: "اكتمل",
      progress: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payloadJson: "{}",
      retryCount: 0,
    };

    renderWithProviders({
      jobs: [completedJob],
      autoHideWhenIdle: true,
    });

    expect(screen.queryByTitle(/^طابور المعالجة/)).toBeNull();
  });

  it("calls setIsTrayHidden(true) when quick-hide button is clicked", () => {
    const activeJob: ImportJob = {
      id: "job-1",
      jobType: "poem_import",
      title: "قصيدة المتنبي",
      status: "processing",
      stage: "transcribe",
      stageLabel: "جاري التفريغ الصوتي",
      progress: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payloadJson: "{}",
      retryCount: 0,
    };

    renderWithProviders({ jobs: [activeJob] });
    const hideBtn = screen.getByTitle(/^إخفاء طابور المعالجة/);
    fireEvent.click(hideBtn);
    expect(mockSetIsTrayHidden).toHaveBeenCalledWith(true);
  });

  it("opens modal and allows cycling corners and clearing finished jobs", () => {
    const completedJob: ImportJob = {
      id: "job-1",
      jobType: "poem_import",
      title: "قصيدة المتنبي",
      status: "completed",
      stage: "completed",
      stageLabel: "اكتمل",
      progress: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payloadJson: "{}",
      retryCount: 0,
    };

    renderWithProviders({ jobs: [completedJob] });
    const toggleBtn = screen.getByTitle(/^طابور المعالجة/);
    fireEvent.click(toggleBtn);

    expect(screen.getByText("طابور المعالجة في الخلفية")).toBeDefined();

    // Clear finished jobs
    const clearBtn = screen.getByTitle(/مسح جميع المهام المنتهية/);
    fireEvent.click(clearBtn);
    expect(mockDismissAllFinishedJobs).toHaveBeenCalled();

    // Move / Cycle corner
    const moveBtn = screen.getByTitle(/نقل الزاوية/);
    fireEvent.click(moveBtn);
    expect(mockSetTrayCorner).toHaveBeenCalledWith("bottom-right");
  });
});
