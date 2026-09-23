import { ActiveTab } from "@/types";

export function shouldSyncDisplayedPoem(
  activeTab: ActiveTab,
  activePoemId: string | null,
  currentPoemId: string | null,
  pendingUserSelectionId: string | null
): boolean {
  if (activeTab !== "player" || !currentPoemId || activePoemId === currentPoemId) {
    return false;
  }

  // A library/card click deliberately changes the displayed poem before
  // AudioPlayerContext has committed the matching current poem. Let that
  // load finish instead of restoring the previous track and creating an
  // activePoem/currentPoem update loop.
  return pendingUserSelectionId !== activePoemId;
}