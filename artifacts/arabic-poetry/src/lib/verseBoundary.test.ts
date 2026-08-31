import { describe, it, expect, vi } from "vitest";
import { markVerseBoundary } from "./verseBoundary";
import { AlignmentStatus, Poem } from "@/types";

// A tiny in-memory stand-in for DiwanRepository.applyAlignmentBoundaryUpdates
// that mirrors its real rollback contract, so these tests exercise the same
// atomicity guarantee without needing a real database.
function makeFakeRepo(alignments: Record<string, { startMs: number; endMs: number; status: AlignmentStatus; confidence?: number }>) {
  // Mirrors the real DiwanRepository/DatabaseAdapter transaction contract:
  // every update in the batch is applied against a snapshot, and if any of
  // them throws, the whole batch is discarded as a unit (true all-or-
  // nothing, not a best-effort per-item compensation).
  const applyAlignmentBoundaryUpdates = vi.fn(
    async (updates: { alignmentId: string; startMs: number; endMs: number; status: AlignmentStatus; confidence?: number }[]) => {
      const snapshot = { ...alignments };
      try {
        for (const u of updates) {
          if (!alignments[u.alignmentId]) throw new Error(`no such alignment ${u.alignmentId}`);
          alignments[u.alignmentId] = { startMs: u.startMs, endMs: u.endMs, status: u.status, confidence: u.confidence };
        }
      } catch (err) {
        for (const key of Object.keys(alignments)) delete alignments[key];
        Object.assign(alignments, snapshot);
        throw err;
      }
    }
  );
  return { applyAlignmentBoundaryUpdates };
}

function makePoem(): Poem {
  return {
    id: "poem-1",
    title: "قصيدة",
    poet: { id: "poet-1", name: "شاعر", era: "عباسي" },
    era: "عباسي",
    bahr: "البسيط",
    rhyme: "الميم",
    versesCount: 2,
    tags: [],
    recordings: [],
    verses: [
      {
        id: "v-1",
        poemId: "poem-1",
        orderIndex: 1,
        text: "البيت الأول",
        normalizedText: "البيت الاول",
        firstHemistich: "الشطر الأول",
        secondHemistich: "الشطر الثاني",
        alignment: {
          id: "align-1",
          verseId: "v-1",
          recordingId: "rec-1",
          startMs: 0,
          endMs: 5000,
          confidence: 0.9,
          status: "auto",
        },
      },
      {
        id: "v-2",
        poemId: "poem-1",
        orderIndex: 2,
        text: "البيت الثاني",
        normalizedText: "البيت الثاني",
        firstHemistich: "الشطر الثالث",
        secondHemistich: "الشطر الرابع",
        alignment: {
          id: "align-2",
          verseId: "v-2",
          recordingId: "rec-1",
          startMs: 5000,
          endMs: 9000,
          confidence: 0.9,
          status: "auto",
        },
      },
    ],
  };
}

describe("markVerseBoundary", () => {
  it("moves the shared boundary, persists both alignments, notifies, and pushes an undo entry", async () => {
    const alignments = {
      "align-1": { startMs: 0, endMs: 5000, status: "auto" as AlignmentStatus, confidence: 0.9 },
      "align-2": { startMs: 5000, endMs: 9000, status: "auto" as AlignmentStatus, confidence: 0.9 },
    };
    const repo = makeFakeRepo(alignments);
    const pushEntry = vi.fn();
    const refreshPoemState = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    const lock = { current: false };

    await markVerseBoundary({
      repo,
      poem: makePoem(),
      verseId: "v-1",
      boundaryMs: 5300,
      lock,
      pushEntry,
      refreshPoemState,
      notify,
    });

    expect(alignments["align-1"]).toMatchObject({ endMs: 5300, status: "manual" });
    expect(alignments["align-2"]).toMatchObject({ startMs: 5300, status: "manual" });
    expect(refreshPoemState).toHaveBeenCalledWith("poem-1");
    expect(notify).toHaveBeenCalledWith("success", expect.any(String));
    expect(pushEntry).toHaveBeenCalledTimes(1);
    expect(lock.current).toBe(false);

    // Undo restores the original boundary...
    const entry = pushEntry.mock.calls[0][0];
    await entry.undo();
    expect(alignments["align-1"]).toMatchObject({ endMs: 5000, status: "auto" });
    expect(alignments["align-2"]).toMatchObject({ startMs: 5000, status: "auto" });

    // ...and redo re-applies the marked boundary.
    await entry.redo();
    expect(alignments["align-1"]).toMatchObject({ endMs: 5300, status: "manual" });
    expect(alignments["align-2"]).toMatchObject({ startMs: 5300, status: "manual" });
  });

  it("notifies an error and makes no change when the next verse has no matching alignment", async () => {
    const alignments = { "align-1": { startMs: 0, endMs: 5000, status: "auto" as AlignmentStatus, confidence: 0.9 } };
    const repo = makeFakeRepo(alignments);
    const pushEntry = vi.fn();
    const refreshPoemState = vi.fn();
    const notify = vi.fn();
    const poem = makePoem();
    poem.verses[1].alignment = undefined;

    await markVerseBoundary({
      repo,
      poem,
      verseId: "v-1",
      boundaryMs: 5300,
      lock: { current: false },
      pushEntry,
      refreshPoemState,
      notify,
    });

    expect(repo.applyAlignmentBoundaryUpdates).not.toHaveBeenCalled();
    expect(pushEntry).not.toHaveBeenCalled();
    expect(refreshPoemState).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("error", expect.any(String));
  });

  it("drops an overlapping call while one is already in flight (guards against key auto-repeat)", async () => {
    const alignments = {
      "align-1": { startMs: 0, endMs: 5000, status: "auto" as AlignmentStatus, confidence: 0.9 },
      "align-2": { startMs: 5000, endMs: 9000, status: "auto" as AlignmentStatus, confidence: 0.9 },
    };
    const repo = makeFakeRepo(alignments);
    let releaseFirstCall: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirstCall = resolve;
    });
    const realApply = repo.applyAlignmentBoundaryUpdates;
    repo.applyAlignmentBoundaryUpdates = vi.fn(async (...args: Parameters<typeof realApply>) => {
      await gate;
      return realApply(...args);
    });
    const pushEntry = vi.fn();
    const refreshPoemState = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    const lock = { current: false };
    const poem = makePoem();

    const first = markVerseBoundary({ repo, poem, verseId: "v-1", boundaryMs: 5300, lock, pushEntry, refreshPoemState, notify });
    // Fired while the first call's mutation hasn't resolved yet -- simulates
    // OS keyboard auto-repeat sending a second "B" keydown immediately.
    const second = markVerseBoundary({ repo, poem, verseId: "v-1", boundaryMs: 5400, lock, pushEntry, refreshPoemState, notify });

    releaseFirstCall?.();
    await Promise.all([first, second]);

    expect(repo.applyAlignmentBoundaryUpdates).toHaveBeenCalledTimes(1);
    expect(pushEntry).toHaveBeenCalledTimes(1);
    expect(lock.current).toBe(false);
  });

  it("notifies an error and pushes no undo entry when the persistence write fails", async () => {
    const alignments = {
      "align-1": { startMs: 0, endMs: 5000, status: "auto" as AlignmentStatus, confidence: 0.9 },
      "align-2": { startMs: 5000, endMs: 9000, status: "auto" as AlignmentStatus, confidence: 0.9 },
    };
    const repo = makeFakeRepo(alignments);
    repo.applyAlignmentBoundaryUpdates = vi.fn().mockRejectedValue(new Error("db write failed"));
    const pushEntry = vi.fn();
    const refreshPoemState = vi.fn();
    const notify = vi.fn();
    const lock = { current: false };

    await expect(
      markVerseBoundary({ repo, poem: makePoem(), verseId: "v-1", boundaryMs: 5300, lock, pushEntry, refreshPoemState, notify })
    ).resolves.toBeUndefined();

    expect(notify).toHaveBeenCalledWith("error", expect.any(String));
    expect(pushEntry).not.toHaveBeenCalled();
    expect(refreshPoemState).not.toHaveBeenCalled();
    // The lock must be released even after a failure, so a retry can proceed.
    expect(lock.current).toBe(false);
  });
});
