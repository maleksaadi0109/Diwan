import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaylistsView } from "./PlaylistsView";
import { TARANEEM_PLAYLIST } from "@/data/taraneemData";

describe("PlaylistsView component", () => {
  it("renders playlists and triggers onOpenPlaylist when a playlist card is clicked", () => {
    const handleOpenPlaylist = vi.fn();
    const handleCreatePlaylist = vi.fn();
    const handleDeletePlaylist = vi.fn();

    render(
      <PlaylistsView
        playlists={[TARANEEM_PLAYLIST]}
        onOpenPlaylist={handleOpenPlaylist}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
      />
    );

    // Verify playlist name is rendered
    expect(screen.getByText(TARANEEM_PLAYLIST.name)).toBeDefined();

    // Click the playlist card button
    const openCard = screen.getByRole("button", { name: /إنشاد ترنيم/ });
    fireEvent.click(openCard);
    expect(handleOpenPlaylist).toHaveBeenCalledWith(TARANEEM_PLAYLIST);
  });
});
