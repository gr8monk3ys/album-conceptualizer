import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1 text-xs text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
          Page not found
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">404</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-8">
          <Link
            href="/app"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
