import type { Playlist, Poem } from "../types";
import type { DiwanRepository } from "./db/repository";
import { TARANEEM_PLAYLIST, TARANEEM_POEMS } from "../data/taraneemData";

type CleanupRepository = Pick<DiwanRepository, "deletePoem" | "deletePlaylist">;

const seedPoemsById = new Map(TARANEEM_POEMS.map((poem) => [poem.id, poem]));
const persistedPoetFields = [
  "id", "name", "era", "bio", "birthYear", "deathYear", "country",
  "city", "latitude", "longitude", "regionId", "school",
] as const;

function unchangedSeedPlaylist(playlists: Playlist[]): Playlist | null {
  const playlist = playlists.find((item) => item.id === TARANEEM_PLAYLIST.id);
  if (!playlist || playlist.name !== TARANEEM_PLAYLIST.name ||
    playlist.poemIds.length !== TARANEEM_PLAYLIST.poemIds.length ||
    playlist.poemIds.some((id, index) => id !== TARANEEM_PLAYLIST.poemIds[index])
  ) return null;
  return playlist;
}

/**
 * Only remove the original, audio-less copies installed by older releases.
 * An imported recording, edited verse, changed metadata, or a user playlist
 * makes a poem user-owned, even when its ID originated in the built-in set.
 */
export function isUnusedTaraneemSeed(
  poem: Poem,
  playlists: Playlist[],
): boolean {
  const original = seedPoemsById.get(poem.id);
  if (!original || !unchangedSeedPlaylist(playlists)) return false;
  if (playlists.some((playlist) =>
    playlist.id !== TARANEEM_PLAYLIST.id && playlist.poemIds.includes(poem.id)
  )) return false;

  if (
    poem.title !== original.title ||
    persistedPoetFields.some((field) => poem.poet[field] !== original.poet[field]) ||
    poem.era !== original.era ||
    poem.bahr !== original.bahr ||
    poem.rhyme !== original.rhyme ||
    poem.description !== original.description ||
    poem.versesCount !== original.versesCount ||
    poem.sourceUrl !== original.sourceUrl ||
    poem.coverImageUrl !== original.coverImageUrl ||
    poem.externalProvider !== original.externalProvider ||
    poem.externalId !== original.externalId ||
    poem.theme !== original.theme ||
    poem.verified !== original.verified ||
    JSON.stringify(poem.tags) !== JSON.stringify(original.tags)
  ) return false;

  if (poem.recordings.length > 1) return false;
  const recording = poem.recordings[0];
  const originalRecording = original.recordings[0];
  if (recording && (
    recording.id !== originalRecording.id ||
    recording.title !== originalRecording.title ||
    recording.reciter !== originalRecording.reciter ||
    recording.durationMs !== originalRecording.durationMs ||
    recording.sampleRate !== originalRecording.sampleRate ||
    recording.channels !== originalRecording.channels ||
    recording.format !== originalRecording.format ||
    Boolean(recording.audioPath?.trim()) ||
    poem.defaultRecordingId !== original.defaultRecordingId
  )) return false;

  return poem.verses.length === original.verses.length &&
    poem.verses.every((verse, index) => {
      const seededVerse = original.verses[index];
      return verse.id === seededVerse.id &&
        verse.orderIndex === seededVerse.orderIndex &&
        verse.text === seededVerse.text &&
        verse.normalizedText === seededVerse.normalizedText &&
        verse.firstHemistich === seededVerse.firstHemistich &&
        verse.secondHemistich === seededVerse.secondHemistich &&
        verse.externalId === seededVerse.externalId &&
        verse.explanation === seededVerse.explanation &&
        !verse.alignment &&
        !verse.explanations?.length;
    });
}

export async function removeUnusedTaraneemSeeds(
  repository: CleanupRepository,
  poems: Poem[],
  playlists: Playlist[],
): Promise<{ poems: Poem[]; playlists: Playlist[] }> {
  // A changed playlist is user-owned. Removing even unchanged members would
  // change their curated collection, so leave the whole group untouched.
  const seededPlaylist = unchangedSeedPlaylist(playlists);
  if (!seededPlaylist) return { poems, playlists };

  const removed = new Set<string>();
  for (const poem of poems) {
    if (!isUnusedTaraneemSeed(poem, playlists)) continue;
    await repository.deletePoem(poem.id);
    removed.add(poem.id);
  }

  const remainingPoems = poems.filter((poem) => !removed.has(poem.id));
  if (seededPlaylist.poemIds.every((id) =>
    !remainingPoems.some((poem) => poem.id === id)
  )) {
    await repository.deletePlaylist(seededPlaylist.id);
    return {
      poems: remainingPoems,
      playlists: playlists.filter((playlist) => playlist.id !== seededPlaylist.id),
    };
  }
  return { poems: remainingPoems, playlists };
}