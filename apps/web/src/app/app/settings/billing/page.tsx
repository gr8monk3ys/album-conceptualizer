export default function BillingPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-[var(--muted2)]">Billing</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Upgrade your plan
        </div>
        <div className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
          Stripe checkout + webhooks will sync subscription status and credits into Neon. The UI is
          scaffolded to match Suno-style paywalls.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { name: "Free", price: "$0", perks: ["5 projects", "Basic exports", "Community templates"] },
          { name: "Pro", price: "$12", perks: ["Unlimited projects", "Remix battles", "DAW handoff packs"] },
          { name: "Team", price: "$29", perks: ["Workspaces", "Realtime collab", "Admin controls"] },
        ].map((plan) => (
          <div
            key={plan.name}
            className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text)]">{plan.name}</div>
              <div className="text-sm font-semibold text-white">{plan.price}/mo</div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  {perk}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Choose {plan.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

