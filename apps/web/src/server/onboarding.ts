import { AlbumJsonSchema } from "@/server/album-json";
import { getAlbumTrackedEvents } from "@/server/analytics";

export type AlbumOnboardingStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  complete: boolean;
};

export type AlbumOnboardingSummary = {
  completeCount: number;
  totalCount: number;
  steps: AlbumOnboardingStep[];
};

function hasDirectionLocked(data: unknown) {
  const parsed = AlbumJsonSchema.safeParse(data);
  if (!parsed.success) return false;

  const album = parsed.data;
  return Boolean(
    album.concept_summary?.trim() &&
      (album.narrative_structure?.trim() ||
        album.central_themes.length > 0 ||
        album.reference_albums.length > 0),
  );
}

export async function getAlbumOnboardingSummary(input: {
  workspaceId: string;
  albumId: string;
  data: unknown;
  isPublic: boolean;
}) {
  const trackedEvents = await getAlbumTrackedEvents(input.workspaceId, input.albumId);

  const steps: AlbumOnboardingStep[] = [
    {
      key: "blueprint_saved",
      label: "Blueprint saved",
      description: "Your first album scaffold is in the workspace.",
      href: `/app/albums/${input.albumId}`,
      complete: true,
    },
    {
      key: "direction_locked",
      label: "Lock the direction",
      description: "Add a concept, narrative shape, and at least one theme or reference.",
      href: `/app/albums/${input.albumId}/studio`,
      complete: hasDirectionLocked(input.data),
    },
    {
      key: "bible_reviewed",
      label: "Review the bible",
      description: "Check the album-level themes, motifs, and story map.",
      href: `/app/albums/${input.albumId}/bible`,
      complete: trackedEvents.has("album_bible_viewed"),
    },
    {
      key: "studio_saved",
      label: "Make a first studio pass",
      description: "Edit at least one track and save the album once.",
      href: `/app/albums/${input.albumId}/studio`,
      complete: trackedEvents.has("album_saved"),
    },
    {
      key: "export_or_publish",
      label: "Export or publish",
      description: "Create a handoff pack or publish the blueprint for remix.",
      href: `/app/albums/${input.albumId}/export`,
      complete: trackedEvents.has("album_export_requested") || input.isPublic,
    },
  ];

  return {
    steps,
    completeCount: steps.filter((step) => step.complete).length,
    totalCount: steps.length,
  } satisfies AlbumOnboardingSummary;
}
