import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/server/db";

const ACTIVATION_EVENTS = [
  "album_bible_viewed",
  "album_studio_viewed",
  "album_saved",
] as const;

type ProductEventName =
  | "user_signed_up"
  | "album_created"
  | "album_bible_viewed"
  | "album_studio_viewed"
  | "album_saved"
  | "album_export_requested"
  | "album_published"
  | "billing_checkout_started";

type TrackProductEventInput = {
  name: ProductEventName;
  workspaceId?: string | null;
  userId?: string | null;
  albumId?: string | null;
  albumKey?: string | null;
  sessionId?: string | null;
  source?: "server" | "auth" | "client";
  path?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type WorkspaceFunnelSummary = {
  windowDays: number;
  since: Date;
  signups: number;
  projectsCreated: number;
  activatedAlbums: number;
  exportedAlbums: number;
  publishedAlbums: number;
  checkoutStarts: number;
  recentEvents: Array<{
    id: string;
    event: string;
    source: string;
    path: string | null;
    createdAt: Date;
    album: { id: string; title: string } | null;
    user: { name: string | null; email: string | null } | null;
  }>;
};

async function trackProductEvent(input: TrackProductEventInput) {
  const prisma = getPrisma();
  await prisma.analyticsEvent.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      albumId: input.albumId ?? null,
      albumKey: input.albumKey ?? input.albumId ?? null,
      sessionId: input.sessionId ?? null,
      event: input.name,
      source: input.source ?? "server",
      path: input.path ?? null,
      metadata: input.metadata,
    },
  });
}

export async function trackProductEventSafe(input: TrackProductEventInput) {
  try {
    await trackProductEvent(input);
  } catch (error) {
    console.error("analytics_track_failed", error);
  }
}

async function countDistinctAlbumEvents(input: {
  workspaceId: string;
  events: readonly ProductEventName[];
  since: Date;
}) {
  const prisma = getPrisma();
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      event: { in: [...input.events] },
      albumKey: { not: null },
      createdAt: { gte: input.since },
    },
    distinct: ["albumKey"],
    select: { albumKey: true },
  });
  return rows.length;
}

export async function getWorkspaceFunnelSummary(
  workspaceId: string,
  opts: { days?: number } = {},
): Promise<WorkspaceFunnelSummary> {
  const prisma = getPrisma();
  const windowDays = opts.days ?? 30;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [
    signups,
    projectsCreated,
    activatedAlbums,
    exportedAlbums,
    publishedAlbums,
    checkoutStarts,
    recentEvents,
  ] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { workspaceId, event: "user_signed_up", createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { workspaceId, event: "album_created", createdAt: { gte: since } },
    }),
    countDistinctAlbumEvents({
      workspaceId,
      events: ACTIVATION_EVENTS,
      since,
    }),
    countDistinctAlbumEvents({
      workspaceId,
      events: ["album_export_requested"],
      since,
    }),
    countDistinctAlbumEvents({
      workspaceId,
      events: ["album_published"],
      since,
    }),
    prisma.analyticsEvent.count({
      where: {
        workspaceId,
        event: "billing_checkout_started",
        createdAt: { gte: since },
      },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        event: true,
        source: true,
        path: true,
        createdAt: true,
        album: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    windowDays,
    since,
    signups,
    projectsCreated,
    activatedAlbums,
    exportedAlbums,
    publishedAlbums,
    checkoutStarts,
    recentEvents,
  };
}

export async function getAlbumTrackedEvents(workspaceId: string, albumId: string) {
  const prisma = getPrisma();
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      workspaceId,
      albumId,
      event: {
        in: [
          "album_created",
          "album_bible_viewed",
          "album_studio_viewed",
          "album_saved",
          "album_export_requested",
          "album_published",
        ],
      },
    },
    distinct: ["event"],
    select: { event: true },
  });

  return new Set(rows.map((row) => row.event));
}
