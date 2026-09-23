import { QuickStartComposer } from "@/components/quickstart-composer";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "New Album",
  description: "Plan a new concept album: the idea, its direction and a first tracklist.",
};

export default function CreatePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New album"
        description="Three short steps to a blueprint: the idea, its direction, and a first tracklist. Everything stays editable in the Studio afterwards."
      />
      <QuickStartComposer />
    </div>
  );
}
