export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-[var(--muted2)]">Coming soon</div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">{title}</div>
      {description ? (
        <div className="max-w-[70ch] text-sm text-[var(--muted)]">{description}</div>
      ) : null}
      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--muted)]">
        This route is scaffolded to match the Suno-style dashboard layout. Next steps: database
        models (Neon), auth, Stripe billing, and wiring the existing album features.
      </div>
    </div>
  );
}

