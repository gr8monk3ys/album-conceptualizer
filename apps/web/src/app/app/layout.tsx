import type { ReactNode } from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { PlayerProvider } from "@/components/player/player-provider";
import { Playerbar } from "@/components/playerbar";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getCreditsStatus } from "@/server/credits";
import { requireUser } from "@/server/identity";
import { getUnreadNotificationCount } from "@/server/notifications";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // This layout is protected by NextAuth middleware, but we still resolve session/workspace
  // here so child pages can stay focused on their content.
  const { session, userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = workspace.subscription?.plan ?? "free";
  const credits = await getCreditsStatus({ workspaceId: workspace.id, plan });
  const unreadNotifications = await getUnreadNotificationCount({
    workspaceId: workspace.id,
    userId,
  });

  return (
    <ErrorBoundary>
    <PlayerProvider>
      <div className="relative px-3 py-3 md:px-4 md:py-4">
        <div className="mx-auto flex max-w-[1600px] gap-4">
          <Sidebar
            className="hidden md:flex"
            workspaceName={workspace.name}
            userName={session.user?.name}
            plan={plan}
            credits={credits}
            unreadNotifications={unreadNotifications}
          />

          <div className="flex min-h-[calc(100vh-28px)] flex-1 flex-col gap-4">
            <header className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 shadow-[0_14px_50px_rgba(0,0,0,0.4)] backdrop-blur">
              <Topbar title={workspace.name} user={session.user} />
            </header>

            <main className="flex-1 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4 shadow-[0_14px_60px_rgba(0,0,0,0.35)]">
              {children}
            </main>
          </div>
        </div>

        <Playerbar />
      </div>
    </PlayerProvider>
    </ErrorBoundary>
  );
}
