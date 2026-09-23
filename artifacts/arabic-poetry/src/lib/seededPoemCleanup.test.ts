import { beforeEach, describe, expect, it, vi } from "vitest";
import { TARANEEM_PLAYLIST, TARANEEM_POEMS, TARANEEM_POETS } from "../data/taraneemData";
import { WebMemoryAdapter } from "./db/adapter";
import { DiwanRepository } from "./db/repository";
import { isUnusedTaraneemSeed, removeUnusedTaraneemSeeds } from "./seededPoemCleanup";

const sample = TARANEEM_POEMS[0];

beforeEach(() => {
  localStorage.clear();
});

describe("unused built-in poem cleanup", () => {
  it("removes all 30 untouched seeds after a database round trip", async () => {
    const repository = new DiwanRepository(new WebMemoryAdapter());
    for (const poet of Object.values(TARANEEM_POETS)) await repository.savePoet(poet);
    for (const poem of TARANEEM_POEMS) await repository.savePoem(poem);
    const playlist = await repository.createPlaylist(
      TARANEEM_PLAYLIST.name, TARANEEM_PLAYLIST.id,
    );
    for (const id of TARANEEM_PLAYLIST.poemIds) {
      await repository.addPoemToPlaylist(playlist.id, id);
    }
    const seededPoems = (await repository.getAllPoems())
      .filter((poem) => TARANEEM_PLAYLIST.poemIds.includes(poem.id));
    const playlists = await repository.getAllPlaylists();

    expect(seededPoems).toHaveLength(30);
    expect(seededPoems.every((poem) => isUnusedTaraneemSeed(poem, playlists))).toBe(true);
    const cleaned = await removeUnusedTaraneemSeeds(
      repository, seededPoems, playlists,
    );
    expect(cleaned).toEqual({ poems: [], playlists: [] });
    expect((await repository.getAllPoems()).some((poem) =>
      TARANEEM_PLAYLIST.poemIds.includes(poem.id)
    )).toBe(false);
    expect(await repository.getPlaylistById(playlist.id)).toBeNull();
  });

  it("removes only untouched placeholders and their empty built-in playlist", async () => {
    const otherPoem = { ...sample, id: "my-own-poem" };
    const playlist = TARANEEM_PLAYLIST;
    const repository = {
      deletePoem: vi.fn(async () => {}),
      deletePlaylist: vi.fn(async () => {}),
    };

    const cleaned = await removeUnusedTaraneemSeeds(
      repository, [sample, otherPoem], [playlist],
    );
    expect(repository.deletePoem).toHaveBeenCalledExactlyOnceWith(sample.id);
    expect(repository.deletePlaylist).toHaveBeenCalledExactlyOnceWith(playlist.id);
    expect(cleaned).toEqual({ poems: [otherPoem], playlists: [] });
  });

  it("preserves a recording, text edits, and poems placed in a user playlist", () => {
    const withAudio = {
      ...sample,
      recordings: [{ ...sample.recordings[0], audioPath: "/user/recitation.mp3" }],
    };
    const edited = {
      ...sample,
      verses: [{ ...sample.verses[0], text: "نص معدّل" }, ...sample.verses.slice(1)],
    };
    const userPlaylist = { ...TARANEEM_PLAYLIST, id: "my-playlist", poemIds: [sample.id] };

    const editedPoet = { ...sample, poet: { ...sample.poet, bio: "سيرة أضافها المستخدم" } };

    expect(isUnusedTaraneemSeed(withAudio, [TARANEEM_PLAYLIST])).toBe(false);
    expect(isUnusedTaraneemSeed(edited, [TARANEEM_PLAYLIST])).toBe(false);
    expect(isUnusedTaraneemSeed(editedPoet, [TARANEEM_PLAYLIST])).toBe(false);
    expect(isUnusedTaraneemSeed(sample, [TARANEEM_PLAYLIST, userPlaylist])).toBe(false);
  });

  it.each([
    { ...TARANEEM_PLAYLIST, name: "قائمتي المخصصة" },
    { ...TARANEEM_PLAYLIST, poemIds: [...TARANEEM_PLAYLIST.poemIds].reverse() },
    { ...TARANEEM_PLAYLIST, poemIds: TARANEEM_PLAYLIST.poemIds.slice(1) },
    { ...TARANEEM_PLAYLIST, poemIds: [...TARANEEM_PLAYLIST.poemIds, "my-own-poem"] },
  ])("leaves a customized playlist and its poems alone", async (playlist) => {
    const otherPoem = { ...sample, id: "my-own-poem" };
    const repository = {
      deletePoem: vi.fn(async () => {}),
      deletePlaylist: vi.fn(async () => {}),
    };

    const cleaned = await removeUnusedTaraneemSeeds(
      repository, [sample, otherPoem], [playlist],
    );
    expect(cleaned.poems).toEqual([sample, otherPoem]);
    expect(cleaned.playlists).toEqual([playlist]);
    expect(repository.deletePoem).not.toHaveBeenCalled();
    expect(repository.deletePlaylist).not.toHaveBeenCalled();
  });

  it("does not create or remove anything from an empty new library", async () => {
    const repository = {
      deletePoem: vi.fn(async () => {}),
      deletePlaylist: vi.fn(async () => {}),
    };
    expect(await removeUnusedTaraneemSeeds(repository, [], []))
      .toEqual({ poems: [], playlists: [] });
    expect(repository.deletePoem).not.toHaveBeenCalled();
    expect(repository.deletePlaylist).not.toHaveBeenCalled();
  });
});