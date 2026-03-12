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
        <div className="text-xs text-[var(--muted2)]">Analytics</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Workspace funnel
        </div>
        <div className="mt-2 max-w-[72ch] text-sm text-[var(--muted)]">
          Track whether projects move from creation into activation, export, and publishing.
          Current window starts {summary.since.toLocaleDateString()}.
        </div>
      </div>

      <WorkspaceFunnelCard summary={summary} href="/app/settings/analytics" />

      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--muted2)]">Recent events</div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">
              What users did most recently
            </div>
          </div>
          <Link
            href="/app/create"
            className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            New project
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)]">
          {summary.recentEvents.length ? (
            <div className="divide-y divide-[rgba(255,255,255,0.06)]">
              {summary.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text)]">
                      {EVENT_LABELS[event.event] ?? event.event}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted2)]">
                      {event.album ? (
                        <Link
                          href={`/app/albums/${event.album.id}`}
                          className="hover:text-[var(--text)]"
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
                  <div className="text-xs text-[var(--muted2)]">
                    {event.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-[var(--muted)]">
              No events yet. Create an album to start filling the funnel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
