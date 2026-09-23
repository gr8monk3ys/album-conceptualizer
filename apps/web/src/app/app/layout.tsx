import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getCredits } from "@/server/credits";
import { requireUser } from "@/server/identity";
import { getUnreadNotificationCount } from "@/server/notifications";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { session, userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = effectivePlan(workspace.subscription);
  const [credits, unreadNotifications] = await Promise.all([
    getCredits({ workspaceId: workspace.id, plan }),
    getUnreadNotificationCount({ workspaceId: workspace.id, userId }),
  ]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#app-main-content"
        className="sr-only z-50 rounded bg-accent text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:py-3"
      >
        Skip to content
      </a>
      <Sidebar
        className="hidden md:flex"
        workspaceName={workspace.name}
        userName={session.user?.name}
        plan={plan}
        credits={credits}
        unreadNotifications={unreadNotifications}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-header items-center border-b border-line bg-ground px-4 md:px-8">
          <div className="w-full min-w-0">
            <Topbar
              workspaceName={workspace.name}
              userName={session.user?.name}
              plan={plan}
              credits={credits}
              unreadNotifications={unreadNotifications}
            />
          </div>
        </header>
        <main id="app-main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
