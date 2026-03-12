import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-[var(--muted2)]">Settings</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Workspace settings
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
          Configure your workspace, runtime health, and billing plan. This Next.js app stores users
          and subscriptions in Neon (Postgres).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 [content-visibility:auto] [contain-intrinsic-size:960px] md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 [content-visibility:auto] [contain-intrinsic-size:220px]">
          <div className="text-sm font-semibold text-[var(--text)]">Billing</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Manage plan, credits, and invoices.
          </div>
          <div className="mt-3">
            <Link
              href="/app/settings/billing"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open Billing
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 [content-visibility:auto] [contain-intrinsic-size:220px]">
          <div className="text-sm font-semibold text-[var(--text)]">Runtime Health</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Check whether config, database, and export engine readiness are green in the deployed
            app.
          </div>
          <div className="mt-3">
            <Link
              href="/api/health"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open Health
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 [content-visibility:auto] [contain-intrinsic-size:220px]">
          <div className="text-sm font-semibold text-[var(--text)]">Analytics</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Review project creation, activation, export, publish, and billing funnel events.
          </div>
          <div className="mt-3">
            <Link
              href="/app/settings/analytics"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
