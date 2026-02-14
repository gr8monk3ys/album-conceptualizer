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
          Configure your workspace, API keys, and billing plan. This Next.js app will store users and
          subscriptions in Neon (Postgres).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">Billing</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Manage plan, credits, and invoices.
          </div>
          <div className="mt-3">
            <Link
              href="/app/settings/billing"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open billing
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">API</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Configure the Python API base URL while we migrate endpoints to Next.js route handlers.
          </div>
          <div className="mt-3">
            <div className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--muted2)]">
              API_BASE_URL (coming soon)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

