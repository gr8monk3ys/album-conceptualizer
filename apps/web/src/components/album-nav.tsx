"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "studio", label: "Studio" },
  { segment: "bible", label: "Bible" },
  { segment: "coherence", label: "Coherence" },
  { segment: "style", label: "Style" },
  { segment: "references", label: "References" },
  { segment: "demos", label: "Demos" },
  { segment: "inbox", label: "Inbox" },
  { segment: "export", label: "Export" },
] as const;

/** One way around an album, the same on every album screen. */
export function AlbumNav({ albumId }: { albumId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/app/albums/${albumId}`;
  const current = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";

  return (
    <nav aria-label="Album" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((tab) => {
          const active = current === tab.segment;
          return (
            <li key={tab.label}>
              <Link
                href={tab.segment ? `${base}/${tab.segment}` : base}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm transition-colors",
                  active
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The album spine is hidden in the Studio, which has its own editable track list. */
export function AlbumBody({ spine, children }: { spine: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const inStudio = /\/studio(\/|$)/.test(pathname);
  if (inStudio) return <div className="min-w-0">{children}</div>;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="hidden xl:block">{spine}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
