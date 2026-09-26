import type { ReactNode } from "react";

import { AppSkipLink } from "@/components/app-skip-link";
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
      {/* The page's one skip link, named for where it lands ("Skip to the Overview"). */}
      <AppSkipLink />
      <Sidebar
        className="hidden md:flex"
        workspaceName={workspace.name}
        userName={session.user?.name}
        plan={plan}
        credits={credits}
        unreadNotifications={unreadNotifications}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky only where the window has height to spare: at least 31.3125em, which is
            501px at the default text size and grows with the reader's text size (a media query's
            em is the browser's default font size), so a phone held sideways, or a phone at 200%
            text, gets the header scrolling away instead of covering half the window. The
            Studio's save bar uses the same breakpoint; globals.css counts the header in the
            page's scroll padding (--header-offset) only while it sticks. The side padding gives
            way a little on a narrow phone so the three header controls fit at 200% text. */}
        <header className="z-30 flex h-header items-center border-b border-line bg-ground px-[min(1rem,5vw)] md:px-8 [@media(min-height:31.3125em)]:sticky [@media(min-height:31.3125em)]:top-0">
          {/* A size container: the search field and New album collapse to icons by the room
              the header actually has, not by the window. */}
          <div className="@container w-full min-w-0">
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
