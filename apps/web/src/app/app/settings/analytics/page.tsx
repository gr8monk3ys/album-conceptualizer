import Link from "next/link";

import { RelativeTime } from "@/components/relative-time";
import { WorkspaceFunnelCard } from "@/components/workspace-funnel-card";
import { PageHeader, Section } from "@/components/ui";
import { getWorkspaceFunnelSummary } from "@/server/analytics";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Workspace funnel",
  description: "How albums in this workspace move from created to exported and published.",
};

const EVENT_LABELS: Record<string, string> = {
  user_signed_up: "Signed up",
  album_created: "Album created",
  album_bible_viewed: "Album Bible reviewed",
  album_studio_viewed: "Studio opened",
  album_coherence_viewed: "Coherence report read",
  album_style_bible_viewed: "Style bible opened",
  album_style_bible_saved: "Style bible saved",
  album_rough_demos_viewed: "Rough demos opened",
  album_demo_added: "Rough demo added",
  album_demo_updated: "Rough demo updated",
  album_demo_deleted: "Rough demo deleted",
  album_reference_added: "Reference added",
  album_reference_updated: "Reference updated",
  album_reference_deleted: "Reference deleted",
  album_handoff_downloaded: "Handoff pack downloaded",
  album_saved: "Studio saved",
  album_export_requested: "Export completed",
  album_published: "Published to Discover",
  billing_checkout_started: "Plan checkout started",
};

function eventLabel(event: string) {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  const words = event.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function AnalyticsPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const summary = await getWorkspaceFunnelSummary(workspace.id);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Workspace funnel"
        description="How albums in this workspace move from first draft to export and publishing. Each album counts once per stage."
      />

      <WorkspaceFunnelCard summary={summary} />

      <Section id="events" title="Recent activity" description="The latest 20 things that happened in this workspace.">
        {summary.recentEvents.length ? (
          <ol className="border-t border-line">
            {summary.recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 border-b border-line py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{eventLabel(event.event)}</p>
                  <p className="mt-0.5 text-ink-2">
                    {event.album ? (
                      <Link
                        href={`/app/albums/${event.album.id}`}
                        className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink"
                      >
                        {event.album.title}
                      </Link>
                    ) : (
                      "Workspace"
                    )}
                    <span aria-hidden="true"> · </span>
                    {event.user?.name || event.user?.email || "Someone"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-ink-3">
                  <RelativeTime date={event.createdAt.toISOString()} />
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-2">
            Nothing yet. Activity appears here once someone creates, writes or exports an album.
          </p>
        )}
      </Section>
    </div>
  );
}
