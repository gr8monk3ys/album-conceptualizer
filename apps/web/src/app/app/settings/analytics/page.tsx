import Link from "next/link";

import { WorkspaceFunnelCard } from "@/components/workspace-funnel-card";
import { getWorkspaceFunnelSummary } from "@/server/analytics";
import { requireUser } from "@/server/identity";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  user_signed_up: "User signed up",
  album_created: "Album created",
  album_bible_viewed: "Bible reviewed",
  album_studio_viewed: "Studio opened",
  album_coherence_viewed: "Coherence reviewed",
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
  billing_checkout_started: "Billing checkout started",
};

export default async function AnalyticsPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const summary = await getWorkspaceFunnelSummary(workspace.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-ink-3">Analytics</div>
        <div className="text-2xl font-semibold tracking-tight text-ink">
          Workspace funnel
        </div>
        <div className="mt-2 max-w-[72ch] text-sm text-ink-2">
          Track whether projects move from creation into activation, export, and publishing.
          Current window starts {summary.since.toLocaleDateString()}.
        </div>
      </div>

      <WorkspaceFunnelCard summary={summary} href="/app/settings/analytics" />

      <div className="rounded-2xl border border-line bg-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-ink-3">Recent events</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              What users did most recently
            </div>
          </div>
          <Link
            href="/app/create"
            className="rounded-full border border-line bg-raised px-3 py-2 text-xs font-semibold text-ink hover:bg-hover"
          >
            New project
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          {summary.recentEvents.length ? (
            <div className="divide-y divide-line">
              {summary.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      {EVENT_LABELS[event.event] ?? event.event}
                    </div>
                    <div className="mt-1 text-xs text-ink-3">
                      {event.album ? (
                        <Link
                          href={`/app/albums/${event.album.id}`}
                          className="hover:text-ink"
                        >
                          {event.album.title}
                        </Link>
                      ) : (
                        "Workspace event"
                      )}
                      {" · "}
                      {event.user?.name || event.user?.email || "Unknown user"}
                      {event.path ? ` · ${event.path}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-ink-3">
                    {event.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-ink-2">
              No events yet. Create an album to start filling the funnel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
