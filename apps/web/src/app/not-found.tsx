import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
          Page not found
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text)]">404</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
