import { ButtonLink, PageHeader } from "@/components/ui";

export default function AppNotFound() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <PageHeader
        title="Nothing here"
        description="This page doesn’t exist, or the album it belonged to was deleted or isn’t in your workspace. Links shared from Discover only work while the album stays published."
      />
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink tone="primary" href="/app">
          Back to your albums
        </ButtonLink>
        <ButtonLink tone="secondary" href="/app/library">
          Open the library
        </ButtonLink>
      </div>
    </div>
  );
}
