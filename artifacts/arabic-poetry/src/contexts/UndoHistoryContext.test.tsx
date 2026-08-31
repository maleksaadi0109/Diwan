import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { UndoHistoryProvider, useUndoHistory } from "./UndoHistoryContext";

function wrapper({ children }: { children: ReactNode }) {
  return <UndoHistoryProvider>{children}</UndoHistoryProvider>;
}

describe("UndoHistoryContext", () => {
  it("undoes then redoes a pushed entry, calling the matching callback each time", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });
    const undoFn = vi.fn();
    const redoFn = vi.fn();

    act(() => {
      result.current.pushEntry({ label: "تعديل تجريبي", undo: undoFn, redo: redoFn });
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoLabel).toBe("تعديل تجريبي");

    await act(async () => {
      await result.current.undo();
    });
    expect(undoFn).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    await act(async () => {
      await result.current.redo();
    });
    expect(redoFn).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("clears the redo stack when a new action is pushed", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });

    act(() => {
      result.current.pushEntry({ label: "أول", undo: vi.fn(), redo: vi.fn() });
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.pushEntry({ label: "ثاني", undo: vi.fn(), redo: vi.fn() });
    });
    expect(result.current.canRedo).toBe(false);
  });

  it("caps history depth at 20 entries, dropping the oldest", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.pushEntry({ label: `عملية ${i}`, undo: vi.fn(), redo: vi.fn() });
      }
    });
    expect(result.current.undoLabel).toBe("عملية 24");

    // Undo all the way down; only the most recent 20 should be reachable.
    let undoCount = 0;
    while (result.current.canUndo && undoCount < 30) {
      await act(async () => {
        await result.current.undo();
      });
      undoCount += 1;
    }
    expect(undoCount).toBe(20);
  });

  it("evicts only entries matching a scope, leaving unrelated entries intact", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });

    act(() => {
      result.current.pushEntry({
        label: "تعديل في القصيدة أ",
        scope: { type: "poem", id: "poem-a" },
        undo: vi.fn(),
        redo: vi.fn(),
      });
      result.current.pushEntry({
        label: "إعادة ترتيب قائمة تشغيل",
        scope: { type: "playlist", id: "playlist-1" },
        undo: vi.fn(),
        redo: vi.fn(),
      });
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clearScope({ type: "poem", id: "poem-a" });
    });

    // The playlist-scoped entry should survive; it's now the only (and thus top) entry.
    expect(result.current.undoLabel).toBe("إعادة ترتيب قائمة تشغيل");

    act(() => {
      result.current.clearScope({ type: "playlist", id: "playlist-1" });
    });
    expect(result.current.canUndo).toBe(false);
  });

  it("shows an error toast and does not resurrect the entry on the redo stack when undo() throws", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });
    const failingUndo = vi.fn(async () => {
      throw new Error("فشل تجريبي");
    });

    act(() => {
      result.current.pushEntry({ label: "عملية فاشلة", undo: failingUndo, redo: vi.fn() });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(failingUndo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    await waitFor(() => {
      expect(result.current.notifications.some((n) => n.kind === "error")).toBe(true);
    });
  });

  it("responds to Ctrl+Z / Ctrl+Shift+Z on window but ignores them while focus is in a text input", async () => {
    const { result } = renderHook(() => useUndoHistory(), { wrapper });
    const undoFn = vi.fn();
    const redoFn = vi.fn();

    act(() => {
      result.current.pushEntry({ label: "تعديل", undo: undoFn, redo: redoFn });
    });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    expect(undoFn).not.toHaveBeenCalled();

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await waitFor(() => expect(undoFn).toHaveBeenCalledTimes(1));

    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })
    );
    await waitFor(() => expect(redoFn).toHaveBeenCalledTimes(1));

    document.body.removeChild(input);
  });
});
