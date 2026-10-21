import type { ReactNode } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { Wordmark } from "@/components/wordmark";

export const REPO_DOCS_URL =
  "https://github.com/gr8monk3ys/album-conceptualizer/tree/main/docs";
export const REPO_ISSUES_URL =
  "https://github.com/gr8monk3ys/album-conceptualizer/issues";

type PublicTrustShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside: ReactNode;
};

type TrustSectionProps = {
  title: string;
  children: ReactNode;
};

const FOOTER_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/app", label: "Open your workspace" },
];

/** Layout for the public trust pages (`/terms`, `/privacy`, `/support`). */
export function PublicTrustShell({
  eyebrow,
  title,
  description,
  children,
  aside,
}: PublicTrustShellProps) {
  return (
    <div className="min-h-screen bg-ground">
      <div className="mx-auto flex max-w-[1200px] flex-col px-4 pb-10 pt-4 sm:px-6 md:pt-6">
        <SiteHeader />

        <main className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 pt-12 md:pt-16 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            <p className="text-sm font-semibold text-ink-3">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-ink-2">{description}</p>
            <div className="mt-8 flex flex-col">{children}</div>
          </article>

          <aside className="h-fit rounded border border-line bg-raised p-5">{aside}</aside>
        </main>

        <footer className="mt-20 flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between md:mt-24">
          <div className="min-w-0">
            <Wordmark />
            <p className="mt-1 text-xs text-ink-3">Plan concept albums that hold together.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded px-2 text-sm text-ink-2 hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
      </div>
    </div>
  );
}

export function TrustSection({ title, children }: TrustSectionProps) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 max-w-[65ch] space-y-3 text-base leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}
