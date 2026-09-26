import { PageNotFoundTitle } from "@/components/page-not-found-title";
import { ButtonLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Page not found" };

// Unknown /app addresses and albums that aren't in this workspace. (An unknown page inside an
// album that exists has its own screen, under the album's header: albums/[albumId]/not-found.)
// One way back, and one different way on: search, for an album that may be under another name.
export default function AppNotFound() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <PageNotFoundTitle />
      <PageHeader
        title="Page not found"
        description="There’s nothing at this address in your workspace. The link may be mistyped, or the album it pointed to was deleted or belongs to another workspace. Links shared from Discover only work while the album stays published."
      />
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink tone="primary" href="/app">
          Go to Home
        </ButtonLink>
        <ButtonLink tone="secondary" href="/app/search">
          Search your workspace
        </ButtonLink>
      </div>
    </div>
  );
}
