import type { ReactNode } from "react";
import { headers } from "next/headers";

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
  const [requestHeaders, { session, userId }] = await Promise.all([headers(), requireUser()]);
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = workspace.subscription?.plan ?? "free";
  const currentPath = requestHeaders.get("x-pathname") ?? "/app";
  const credits = await getCreditsStatus({ workspaceId: workspace.id, plan });
  const unreadNotifications = await getUnreadNotificationCount({
    workspaceId: workspace.id,
    userId,
  });

  return (
    <div className="relative px-3 py-3 md:px-4 md:py-4">
      <a
        href="#app-main-content"
        className="sr-only absolute left-4 top-4 z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.35)]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <Sidebar
          className="hidden md:flex"
          currentPath={currentPath}
          workspaceName={workspace.name}
          userName={session.user?.name}
          plan={plan}
          credits={credits}
          unreadNotifications={unreadNotifications}
        />

        <div className="flex min-h-[calc(100vh-28px)] flex-1 flex-col gap-4">
          <header className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
            <Topbar
              title={workspace.name}
              currentPath={currentPath}
              user={session.user}
              plan={plan}
              credits={credits}
              unreadNotifications={unreadNotifications}
            />
          </header>

          <main
            id="app-main-content"
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.018)] p-4 shadow-[0_10px_32px_rgba(0,0,0,0.22)]"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
