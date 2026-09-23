import { QuickStartComposer } from "@/components/quickstart-composer";
import { PageHeader } from "@/components/ui";
import { getAgentAvailability } from "@/server/engine";

export const metadata = {
  title: "New Album",
  description: "Plan a new concept album: the idea, its direction and a first tracklist.",
};

export default async function CreatePage() {
  // The optional AI brainstorm is only clickable when this server can run it.
  const aiAvailable = await getAgentAvailability();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New album"
        description="Three short steps to a blueprint: the idea, its direction, and a first tracklist. Everything stays editable in the Studio afterwards."
      />
      <QuickStartComposer aiAvailable={aiAvailable} />
    </div>
  );
}
