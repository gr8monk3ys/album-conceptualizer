import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { PageHeader, Section, buttonClass } from "@/components/ui";
import { getCredits } from "@/server/credits";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Settings",
  description: "Who is signed in, your plan and credits, how your albums are progressing, and help.",
};

const PLAN_NAME = { free: "Free", pro: "Pro", team: "Team" } as const;

type Row = { href: string; title: string; detail: string; external?: boolean };

function SettingsRows({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <ul aria-label={label} className="border-t border-line">
      {rows.map((row) => {
        const content = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-ink">{row.title}</span>
              <span className="mt-0.5 block max-w-[65ch] text-sm text-ink-2">{row.detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden="true" />
          </>
        );
        const className = "group flex min-h-11 items-center gap-4 px-1 py-4 transition-colors hover:bg-hover";
        return (
          <li key={row.href} className="border-b border-line">
            {row.external ? (
              <a href={row.href} className={className}>
                {content}
              </a>
            ) : (
              <Link href={row.href} className={className}>
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function SettingsPage() {
  const { session, userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = effectivePlan(workspace.subscription);
  const credits = await getCredits({ workspaceId: workspace.id, plan });
  const name = session.user?.name?.trim() || null;
  const email = session.user?.email?.trim() || null;

  const rows: Row[] = [
    {
      href: "/app/settings/billing",
      title: "Plan and billing",
      detail: "Compare plans, see what each action costs, and manage payment.",
    },
    {
      href: "/app/settings/analytics",
      title: "Album progress",
      detail: "How many of your albums have been worked on, exported and published lately, and what happened recently.",
    },
    {
      href: "/app/help",
      title: "Help",
      detail: "How an album goes from idea to handoff, what credits pay for, what counts as written, and keyboard shortcuts.",
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader size="page" title="Settings" catalog={workspace.name} />

      {/* Who is signed in and on what plan, said plainly; the name and email come from the
          sign-in, so there is nothing to edit here. */}
      <Section
        id="account"
        title="Account"
        description="Your name and email come from how you signed in."
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-y border-line py-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-y-3">
          <dt className="type-catalog text-xs text-ink-2">Signed in as</dt>
          <dd className="mb-2 break-words text-sm font-semibold text-ink sm:mb-0">{name ?? "No name set"}</dd>
          <dt className="type-catalog text-xs text-ink-2">Email</dt>
          <dd className="mb-2 break-words text-sm text-ink sm:mb-0">{email ?? "No email on this sign-in"}</dd>
          <dt className="type-catalog text-xs text-ink-2">Plan</dt>
          <dd className="mb-2 text-sm text-ink sm:mb-0">
            <span className="font-semibold">{PLAN_NAME[plan]}</span>
            <span className="type-figure text-ink-2">
              {" · "}
              {credits.remaining} {credits.remaining === 1 ? "credit" : "credits"} left
            </span>
          </dd>
          <dt className="type-catalog text-xs text-ink-2">Workspace</dt>
          <dd className="break-words text-sm text-ink">{workspace.name}</dd>
        </dl>
        <div className="mt-4">
          <SignOutButton className={buttonClass("secondary")} />
        </div>
      </Section>

      <SettingsRows rows={rows} label="Settings" />

      <Section
        id="troubleshooting"
        title="If something keeps failing"
        description="When saving or exporting fails more than once, this check shows whether the server can reach your saved albums and the export service."
      >
        <SettingsRows
          label="Troubleshooting"
          rows={[
            {
              href: "/api/health",
              title: "Check saving and exports",
              detail: "Opens a short technical readout. Include it if you report a problem.",
              external: true,
            },
          ]}
        />
      </Section>
    </div>
  );
}
