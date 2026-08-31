import { AlignmentStatus, Poem } from "@/types";
import { DiwanRepository } from "@/lib/db/repository";
import { UndoScope } from "@/contexts/UndoHistoryContext";

interface AlignmentSnapshot {
  alignmentId: string;
  startMs: number;
  endMs: number;
  status: AlignmentStatus;
  confidence?: number;
}

export interface MarkVerseBoundaryDeps {
  repo: Pick<DiwanRepository, "applyAlignmentBoundaryUpdates">;
  poem: Poem;
  verseId: string;
  boundaryMs: number;
  /** Reentrancy guard shared across calls (e.g. a `useRef({ current: false })`
   * from the caller). Overlapping calls -- such as several keydown events
   * fired by OS keyboard auto-repeat before the first mutation and its
   * state refresh finish -- are dropped instead of racing on the same
   * pre-edit snapshot. */
  lock: { current: boolean };
  pushEntry: (entry: {
    label: string;
    scope?: UndoScope;
    undo: () => Promise<void> | void;
    redo: () => Promise<void> | void;
  }) => void;
  refreshPoemState: (poemId: string) => Promise<void>;
  notify: (kind: "success" | "error", message: string) => void;
}

/**
 * Marks a verse boundary at `boundaryMs` (typically the current playback
 * position, triggered by the "B" shortcut while listening): moves the
 * active verse's alignment end and the immediately following verse's
 * alignment start to that timestamp, so the two stay contiguous. This
 * intentionally only *adjusts* an existing boundary shared by two already
 * -aligned, same-recording verses -- it never creates a new alignment from
 * scratch (a full timing/boundary editor is out of scope for this
 * shortcut), and it requires both sides to already have an alignment for
 * the same recording so the "boundary" concept stays well-defined; when
 * that pairing isn't available, it notifies the user instead of silently
 * adjusting only one side.
 *
 * The pair is written via `DiwanRepository.applyAlignmentBoundaryUpdates`,
 * which rolls the batch back if the second write fails, so a partial
 * failure can never leave the two verses with a mismatched boundary. The
 * undo history entry is only pushed after that mutation (and the resulting
 * state refresh) has fully completed.
 */
export async function markVerseBoundary({
  repo,
  poem,
  verseId,
  boundaryMs,
  lock,
  pushEntry,
  refreshPoemState,
  notify,
}: MarkVerseBoundaryDeps): Promise<void> {
  if (lock.current) return;
  lock.current = true;
  try {
    const index = poem.verses.findIndex((v) => v.id === verseId);
    if (index < 0) return;
    const verse = poem.verses[index];
    const currentAlignment = verse.alignment;
    if (!currentAlignment) {
      notify("error", "لا يوجد محاذاة صوتية لهذا البيت لوضع حد زمني.");
      return;
    }

    const nextVerseEntry = poem.verses[index + 1];
    const nextAlignment =
      nextVerseEntry?.alignment && nextVerseEntry.alignment.recordingId === currentAlignment.recordingId
        ? nextVerseEntry.alignment
        : undefined;
    if (!nextVerseEntry || !nextAlignment) {
      notify("error", "لا يمكن وضع حد زمني هنا: يجب أن يملك البيت التالي محاذاة صوتية لنفس التسجيل.");
      return;
    }

    const roundedBoundary = Math.round(boundaryMs);
    if (roundedBoundary <= currentAlignment.startMs || roundedBoundary >= nextAlignment.endMs) {
      notify("error", "موضع التشغيل الحالي خارج النطاق الزمني الصالح لوضع الحد هنا.");
      return;
    }

    const prevCurrent: AlignmentSnapshot = {
      alignmentId: currentAlignment.id,
      startMs: currentAlignment.startMs,
      endMs: currentAlignment.endMs,
      status: currentAlignment.status,
      confidence: currentAlignment.confidence,
    };
    const prevNext: AlignmentSnapshot = {
      alignmentId: nextAlignment.id,
      startMs: nextAlignment.startMs,
      endMs: nextAlignment.endMs,
      status: nextAlignment.status,
      confidence: nextAlignment.confidence,
    };
    const markedCurrent: AlignmentSnapshot = {
      alignmentId: currentAlignment.id,
      startMs: prevCurrent.startMs,
      endMs: roundedBoundary,
      status: "manual",
      confidence: prevCurrent.confidence,
    };
    const markedNext: AlignmentSnapshot = {
      alignmentId: nextAlignment.id,
      startMs: roundedBoundary,
      endMs: prevNext.endMs,
      status: "manual",
      confidence: prevNext.confidence,
    };

    const poemId = poem.id;

    try {
      await repo.applyAlignmentBoundaryUpdates([markedCurrent, markedNext]);
    } catch {
      notify("error", "تعذر حفظ الحد الزمني.");
      return;
    }

    await refreshPoemState(poemId);
    notify("success", "تم ضبط الحد الزمني بين البيتين.");

    pushEntry({
      label: "تعديل حد زمني بين بيتين",
      scope: { type: "poem", id: poemId },
      undo: async () => {
        await repo.applyAlignmentBoundaryUpdates([prevCurrent, prevNext]);
        await refreshPoemState(poemId);
      },
      redo: async () => {
        await repo.applyAlignmentBoundaryUpdates([markedCurrent, markedNext]);
        await refreshPoemState(poemId);
      },
    });
  } finally {
    lock.current = false;
  }
}
