import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// A generic command-pattern undo/redo stack shared by every editing surface
// (verse text/boundary edits, merge/split, delete, playlist reorder). Each
// screen builds its own `undo`/`redo` closures capturing whatever state is
// needed to fully reverse/replay the action, then hands the entry to
// `pushEntry` -- this context never needs to know what kind of edit it was.

const MAX_HISTORY = 20;

export interface UndoScope {
  /** What kind of thing this entry affects, used to evict it once the user
   * navigates away from that poem/playlist (undoing it there would no
   * longer make visible sense). Entries with no scope are never evicted. */
  type: "poem" | "playlist";
  id: string;
}

export interface UndoEntry {
  id: string;
  /** Short Arabic description shown in the undo/redo button tooltip and the toast, e.g. "حذف بيت". */
  label: string;
  scope?: UndoScope;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

export type UndoToastKind = "success" | "error";

export interface UndoToastNotification {
  id: string;
  kind: UndoToastKind;
  message: string;
}

interface UndoHistoryContextValue {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  pushEntry: (entry: Omit<UndoEntry, "id">) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearScope: (scope: UndoScope) => void;
  clearAll: () => void;
  notifications: UndoToastNotification[];
  dismissNotification: (id: string) => void;
  /** General-purpose toast, reusing the same UI as undo/redo notifications
   * for other transient feedback (e.g. a keyboard-shortcut action that
   * can't complete because a precondition isn't met). */
  notify: (kind: UndoToastKind, message: string) => void;
}

const UndoHistoryContext = createContext<UndoHistoryContextValue | null>(null);

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function UndoHistoryProvider({ children }: { children: React.ReactNode }) {
  const [undoStack, setUndoStackState] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStackState] = useState<UndoEntry[]>([]);
  const [notifications, setNotifications] = useState<UndoToastNotification[]>([]);

  // Synchronous source of truth mirrored into state for render -- undo()/
  // redo() run one at a time (guarded by busyRef) but a rapid double
  // Ctrl+Z should still see the just-updated stack rather than a value
  // captured by a stale render closure.
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const busyRef = useRef(false);

  const setUndoStack = useCallback((next: UndoEntry[]) => {
    undoStackRef.current = next;
    setUndoStackState(next);
  }, []);

  const setRedoStack = useCallback((next: UndoEntry[]) => {
    redoStackRef.current = next;
    setRedoStackState(next);
  }, []);

  const pushNotification = useCallback((kind: UndoToastKind, message: string) => {
    const id = makeId("undo-toast");
    setNotifications((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushEntry = useCallback(
    (entry: Omit<UndoEntry, "id">) => {
      const full: UndoEntry = { id: makeId("undo"), ...entry };
      setUndoStack([...undoStackRef.current, full].slice(-MAX_HISTORY));
      // A fresh action invalidates whatever redo chain existed -- redoing
      // past it would silently resurrect a change the user just replaced.
      setRedoStack([]);
    },
    [setUndoStack, setRedoStack]
  );

  const undo = useCallback(async () => {
    if (busyRef.current) return;
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    busyRef.current = true;
    const entry = stack[stack.length - 1];
    setUndoStack(stack.slice(0, -1));
    try {
      await entry.undo();
      setRedoStack([...redoStackRef.current, entry].slice(-MAX_HISTORY));
      pushNotification("success", `تم التراجع عن: ${entry.label}`);
    } catch (err) {
      console.error("Undo failed:", err);
      pushNotification("error", `تعذر التراجع عن: ${entry.label}`);
    } finally {
      busyRef.current = false;
    }
  }, [pushNotification, setUndoStack, setRedoStack]);

  const redo = useCallback(async () => {
    if (busyRef.current) return;
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    busyRef.current = true;
    const entry = stack[stack.length - 1];
    setRedoStack(stack.slice(0, -1));
    try {
      await entry.redo();
      setUndoStack([...undoStackRef.current, entry].slice(-MAX_HISTORY));
      pushNotification("success", `تمت إعادة تنفيذ: ${entry.label}`);
    } catch (err) {
      console.error("Redo failed:", err);
      pushNotification("error", `تعذر إعادة تنفيذ: ${entry.label}`);
    } finally {
      busyRef.current = false;
    }
  }, [pushNotification, setUndoStack, setRedoStack]);

  const clearScope = useCallback(
    (scope: UndoScope) => {
      const matches = (e: UndoEntry) => e.scope && e.scope.type === scope.type && e.scope.id === scope.id;
      setUndoStack(undoStackRef.current.filter((e) => !matches(e)));
      setRedoStack(redoStackRef.current.filter((e) => !matches(e)));
    },
    [setUndoStack, setRedoStack]
  );

  const clearAll = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [setUndoStack, setRedoStack]);

  // Global Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, ignored while focus is in a text
  // field so undoing an edit doesn't fight the browser's native text-input
  // undo (e.g. while typing a verse edit).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (!ctrlOrCmd) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const value = useMemo<UndoHistoryContextValue>(
    () => ({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
      redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
      pushEntry,
      undo,
      redo,
      clearScope,
      clearAll,
      notifications,
      dismissNotification,
      notify: pushNotification,
    }),
    [undoStack, redoStack, pushEntry, undo, redo, clearScope, clearAll, notifications, dismissNotification, pushNotification]
  );

  return <UndoHistoryContext.Provider value={value}>{children}</UndoHistoryContext.Provider>;
}

export function useUndoHistory(): UndoHistoryContextValue {
  const ctx = useContext(UndoHistoryContext);
  if (!ctx) {
    throw new Error("useUndoHistory must be used within an UndoHistoryProvider");
  }
  return ctx;
}
