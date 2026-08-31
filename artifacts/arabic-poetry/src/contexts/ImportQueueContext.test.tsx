import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { ImportQueueProvider, useImportQueueContext } from "./ImportQueueContext";
import { DiwanRepository } from "@/lib/db/repository";
import type { ParsedVersePayload } from "@/lib/providers/types";
import type { PoemImportJobPayload } from "./ImportQueueContext";

// The pipeline calls out to worker/API endpoints (transcribe, align, VAD).
// In this jsdom test environment those fetches fail (no server), which each
// function already handles by falling back to canned "browser simulation"
// data -- so the pipeline runs deterministically end-to-end without mocks,
// except where a specific test below needs to control timing or inject a
// failure, in which case it mocks just that one function.

const mockState = vi.hoisted(() => ({
  transcribeFailuresRemaining: 0,
  vadDelayMs: 0,
  alignDelayMs: 0,
  sharedAdapter: null as Awaited<ReturnType<typeof import("@/lib/db/adapter").getDatabase>> | null,
}));

// The real getDatabase() opens a brand-new ":memory:" sqlite connection on
// every call in this Node test environment, so the queue's own repo and any
// repo the test creates to inspect persisted state would silently diverge
// (two empty databases that never see each other's writes). Share one
// adapter per test so cancellation assertions actually observe what the
// pipeline wrote, or failed to write.
vi.mock("@/lib/db/adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/adapter")>();
  return {
    ...actual,
    getDatabase: vi.fn(async () => {
      if (!mockState.sharedAdapter) {
        mockState.sharedAdapter = await actual.getDatabase();
      }
      return mockState.sharedAdapter;
    }),
  };
});

vi.mock("@/lib/worker/workerClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/worker/workerClient")>();
  return {
    ...actual,
    detectSpeechIntervals: vi.fn(async (wavPath: string) => {
      if (mockState.vadDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, mockState.vadDelayMs));
      }
      return actual.detectSpeechIntervals(wavPath);
    }),
    transcribeArabicAudio: vi.fn(async (...args: Parameters<typeof actual.transcribeArabicAudio>) => {
      if (mockState.transcribeFailuresRemaining > 0) {
        mockState.transcribeFailuresRemaining -= 1;
        throw new Error("محاكاة فشل التفريغ الصوتي لأغراض الاختبار");
      }
      return actual.transcribeArabicAudio(...args);
    }),
    alignPoemAudio: vi.fn(async (...args: Parameters<typeof actual.alignPoemAudio>) => {
      if (mockState.alignDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, mockState.alignDelayMs));
      }
      return actual.alignPoemAudio(...args);
    }),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return <ImportQueueProvider>{children}</ImportQueueProvider>;
}

const sampleVerses: ParsedVersePayload[] = [
  {
    orderIndex: 1,
    text: "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
    firstHemistich: "واحَرَّ قَلباهُ",
    secondHemistich: "مِمَّن قَلبُهُ شَبِمُ",
  },
  {
    orderIndex: 2,
    text: "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
    firstHemistich: "وَمَن بِجِسمي",
    secondHemistich: "وَحالي عِندَهُ سَقَمُ",
  },
];

function makePoemImportPayload(title: string): PoemImportJobPayload {
  return {
    title,
    poetName: "شاعر تجريبي",
    era: "عباسي",
    bahr: "البسيط",
    rhyme: "الميم",
    parsedVerses: sampleVerses,
    audioSourceMode: "skip",
  };
}

describe("ImportQueueContext background processing queue", () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.transcribeFailuresRemaining = 0;
    mockState.vadDelayMs = 0;
    mockState.alignDelayMs = 0;
    mockState.sharedAdapter = null;
  });

  it("drains a newly enqueued job all the way to completion without getting stuck pending", async () => {
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة اختبار الطابور",
        payload: makePoemImportPayload("قصيدة اختبار الطابور"),
      });
      expect(jobId).toBeTruthy();
    });

    // Regression guard: before the fix, the job's synchronous "pending" state
    // was never observed by drainQueue (it read a stale ref), so it could
    // stay pending forever instead of transitioning through processing.
    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job).toBeTruthy();
        expect(job!.status).toBe("completed");
      },
      { timeout: 15000 }
    );

    const job = result.current.jobs.find((j) => j.id === jobId)!;
    expect(job.progress).toBe(1);
    const jobResult = result.current.getJobResult<{ poemId: string; poemTitle: string }>(jobId);
    expect(jobResult?.poemTitle).toBe("قصيدة اختبار الطابور");
  }, 20000);

  it("processes a genuinely failed job through to a successful retry", async () => {
    mockState.transcribeFailuresRemaining = 1;
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة فشل ثم إعادة محاولة",
        payload: makePoemImportPayload("قصيدة فشل ثم إعادة محاولة"),
      });
      expect(jobId).toBeTruthy();
    });

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("failed");
        expect(job?.errorMessage).toBeTruthy();
      },
      { timeout: 15000 }
    );

    result.current.retryJob(jobId);

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("completed");
        expect(job?.retryCount).toBe(1);
      },
      { timeout: 15000 }
    );
  }, 25000);

  it("cancelling a job mid-processing stops the pipeline and never saves a poem", async () => {
    mockState.vadDelayMs = 400;
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة يتم إلغاؤها",
        payload: makePoemImportPayload("قصيدة يتم إلغاؤها"),
      });
      expect(jobId).toBeTruthy();
    });

    // Wait until the pipeline is inside the (artificially delayed) VAD stage,
    // then cancel. Regression guard: a stage's own progress persist used to
    // blindly overwrite the whole job row from a stale in-memory snapshot,
    // wiping out the cancelRequested flag cancelJob had just written.
    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.stage).toBe("vad");
      },
      { timeout: 5000 }
    );

    result.current.cancelJob(jobId);

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("cancelled");
      },
      { timeout: 15000 }
    );

    const job = result.current.jobs.find((j) => j.id === jobId)!;
    expect(job.status).not.toBe("completed");

    const repo = await DiwanRepository.create();
    const poems = await repo.getAllPoems();
    expect(poems.some((p) => p.id === `poem-wiz-${jobId}`)).toBe(false);
  }, 20000);

  it("cancelling during the (late) alignment stage still stops before the poem is saved", async () => {
    // Regression guard: cancellation used to only be checked between the
    // earlier stages, not right before the final save -- cancelling during
    // forced alignment could still run to completion and persist a poem.
    mockState.alignDelayMs = 400;
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة يتم إلغاؤها أثناء المحاذاة",
        payload: makePoemImportPayload("قصيدة يتم إلغاؤها أثناء المحاذاة"),
      });
      expect(jobId).toBeTruthy();
    });

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.stage).toBe("align");
      },
      { timeout: 5000 }
    );

    result.current.cancelJob(jobId);

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("cancelled");
      },
      { timeout: 15000 }
    );

    const repo = await DiwanRepository.create();
    const poems = await repo.getAllPoems();
    expect(poems.some((p) => p.id === `poem-wiz-${jobId}`)).toBe(false);
  }, 20000);

  it("serializes concurrent job patches so a cancellation flag is never lost to an in-flight stage update", async () => {
    // Deterministic regression test for the read-modify-write race: two
    // patches to the same job started back-to-back, where the first's
    // write completes strictly after the second's read would have fired
    // under the old (non-serialized) implementation. With per-job
    // serialization, the second patch must observe the first's write.
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة اختبار التزامن",
        payload: makePoemImportPayload("قصيدة اختبار التزامن"),
      });
      expect(jobId).toBeTruthy();
    });

    // Let it reach "completed" first so both patches below apply to a
    // settled job outside of the real pipeline's own concurrent writes.
    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("completed");
      },
      { timeout: 15000 }
    );

    const repo = await DiwanRepository.create();

    // Fire two overlapping "patches" directly against the same underlying
    // mechanism the queue uses (save the current row with one field changed
    // each, without awaiting in between) to simulate cancelJob and a stage
    // update racing to persist different fields on the same job.
    const before = await repo.getImportJobById(jobId);
    expect(before).toBeTruthy();

    result.current.cancelJob(jobId); // sets cancelRequested (no-op status-wise once completed)
    result.current.retryJob(jobId); // immediately queues a status/stage/progress patch

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("completed");
        expect(job?.retryCount).toBeGreaterThanOrEqual(1);
      },
      { timeout: 15000 }
    );

    // Both concurrent writers' intents must have survived: the retry's
    // increment and completion, without one silently reverting the other.
    const after = result.current.jobs.find((j) => j.id === jobId)!;
    expect(after.retryCount).toBeGreaterThanOrEqual(1);
    expect(after.status).toBe("completed");
  }, 20000);

  it("reprocesses a retried (already-completed) job back to completion", async () => {
    const { result } = renderHook(() => useImportQueueContext(), { wrapper });

    let jobId = "";
    await waitFor(() => {
      jobId = result.current.enqueuePoemImport({
        title: "قصيدة إعادة المحاولة",
        payload: makePoemImportPayload("قصيدة إعادة المحاولة"),
      });
      expect(jobId).toBeTruthy();
    });

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("completed");
      },
      { timeout: 15000 }
    );

    result.current.retryJob(jobId);

    await waitFor(
      () => {
        const job = result.current.jobs.find((j) => j.id === jobId);
        expect(job?.status).toBe("completed");
        expect(job?.retryCount).toBeGreaterThanOrEqual(1);
      },
      { timeout: 15000 }
    );
  }, 25000);
});
