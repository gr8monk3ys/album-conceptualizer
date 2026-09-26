import { QuickStartComposer } from "@/components/quickstart-composer";
import { PageHeader } from "@/components/ui";
import { getCredits } from "@/server/credits";
import { getAgentAvailability } from "@/server/engine";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "New album",
  description: "Plan a new concept album: the idea, its direction and a first sequence of tracks.",
};

export default async function CreatePage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  // The optional AI brainstorm is only clickable when this server can run it; the balance lets
  // every spend on this page say what will be left.
  const [aiAvailable, credits] = await Promise.all([
    getAgentAvailability(),
    getCredits({ workspaceId: workspace.id, plan: effectivePlan(workspace.subscription) }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      {/* The page-title size: "New album" names one of the app's own screens, not a work; the
          display cut is spent on album titles and public pages (DESIGN.md, Typography). */}
      <PageHeader
        title="New album"
        size="page"
        description="Three short steps to a blueprint: the idea, its direction, and a first sequence of tracks. Everything stays editable in the Studio afterwards."
      />
      <QuickStartComposer aiAvailable={aiAvailable} creditsRemaining={credits.remaining} />
    </div>
  );
}
