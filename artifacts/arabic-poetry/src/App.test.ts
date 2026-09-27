import { describe, expect, it } from "vitest";
import { shouldSyncDisplayedPoem } from "./lib/playerSync";

describe("shouldSyncDisplayedPoem", () => {
  it("does not restore the previous track while a newly selected poem is loading", () => {
    expect(
      shouldSyncDisplayedPoem("player", "poem-2", "poem-1", "poem-2")
    ).toBe(false);
  });

  it("syncs the displayed poem when queue playback advances tracks", () => {
    expect(
      shouldSyncDisplayedPoem("player", "poem-1", "poem-2", null)
    ).toBe(true);
  });

  it("does nothing when the displayed and current poems already match", () => {
    expect(
      shouldSyncDisplayedPoem("player", "poem-2", "poem-2", null)
    ).toBe(false);
  });
});