import type { ReactNode } from "react";
import Link from "next/link";

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
  { href: "/app", label: "Open app" },
];

export function PublicTrustShell({
  eyebrow,
  title,
  description,
  children,
  aside,
}: PublicTrustShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(109,94,252,0.06),rgba(255,62,165,0.025)_30%,transparent_68%)]">
      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-14">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,62,165,0.9),rgba(109,94,252,0.76))]">
              <span className="text-[13px] font-semibold tracking-wide text-black/80">AC</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
                Album Conceptualizer
              </div>
              <div className="text-xs text-[var(--muted2)]">Launch trust and support</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
            >
              Open app
            </Link>
          </div>
        </header>

        <main className="mt-14 grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-[32px] border border-[var(--border)] bg-[rgba(255,255,255,0.035)] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.22)] md:p-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              {eyebrow}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-[var(--muted)] md:text-base">
              {description}
            </p>
            <div className="mt-8 flex flex-col gap-4">{children}</div>
          </article>

          <aside className="h-fit rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.025)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            {aside}
          </aside>
        </main>

        <footer className="mt-10 flex flex-col gap-4 text-xs text-[var(--muted2)] md:flex-row md:items-center md:justify-between">
          <div>Built for artists, producers, and teams working on coherent multi-song projects.</div>
          <div className="flex flex-wrap items-center gap-3">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--text)]">
                {link.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

export function TrustSection({ title, children }: TrustSectionProps) {
  return (
    <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}
