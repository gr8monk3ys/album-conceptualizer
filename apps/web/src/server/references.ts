import { getPrisma } from "@/server/db";

export type AlbumReferenceRecord = {
  id: string;
  songId: string | null;
  songTrackNumber: number | null;
  songTitle: string | null;
  title: string;
  artist: string | null;
  sourceUrl: string | null;
  notes: string | null;
  targetRole: string | null;
  bpm: number | null;
  key: string | null;
  moodTags: string[];
  arrangementTags: string[];
  createdAt: string;
  updatedAt: string;
};

function mapReference(
  reference: {
    id: string;
    songId: string | null;
    songTrackNumber: number | null;
    songTitle: string | null;
    title: string;
    artist: string | null;
    sourceUrl: string | null;
    notes: string | null;
    targetRole: string | null;
    bpm: number | null;
    key: string | null;
    moodTags: string[];
    arrangementTags: string[];
    createdAt: Date;
    updatedAt: Date;
  },
): AlbumReferenceRecord {
  return {
    id: reference.id,
    songId: reference.songId,
    songTrackNumber: reference.songTrackNumber,
    songTitle: reference.songTitle,
    title: reference.title,
    artist: reference.artist,
    sourceUrl: reference.sourceUrl,
    notes: reference.notes,
    targetRole: reference.targetRole,
    bpm: reference.bpm,
    key: reference.key,
    moodTags: reference.moodTags,
    arrangementTags: reference.arrangementTags,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

export async function listAlbumReferences(workspaceId: string, albumId: string) {
  const prisma = getPrisma();
  const references = await prisma.albumReference.findMany({
    where: {
      albumId,
      album: { workspaceId },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      songId: true,
      songTrackNumber: true,
      songTitle: true,
      title: true,
      artist: true,
      sourceUrl: true,
      notes: true,
      targetRole: true,
      bpm: true,
      key: true,
      moodTags: true,
      arrangementTags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return references.map(mapReference);
}
