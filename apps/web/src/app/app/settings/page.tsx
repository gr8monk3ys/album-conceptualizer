import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/ui";
import { requireUser } from "@/server/identity";
import { effectivePlan } from "@/server/plan";
import { getActiveWorkspaceForUser } from "@/server/workspaces";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Settings",
  description: "Your plan and credits, workspace activity and service status.",
};

const PLAN_NAME = { free: "Free", pro: "Pro", team: "Team" } as const;

export default async function SettingsPage() {
  const { userId } = await requireUser();
  const workspace = await getActiveWorkspaceForUser(userId);
  const plan = effectivePlan(workspace.subscription);

  const rows: Array<{ href: string; title: string; detail: string; external?: boolean }> = [
    {
      href: "/app/settings/billing",
      title: "Plan and billing",
      detail: `You're on the ${PLAN_NAME[plan]} plan. Compare plans, see what credits pay for, and manage payment.`,
    },
    {
      href: "/app/settings/analytics",
      title: "Workspace funnel",
      detail: "How your albums move from first draft to export and publishing, and recent activity.",
    },
    {
      href: "/api/health",
      title: "Service status",
      detail: "A technical readout of whether saving and exports are working. Useful if something keeps failing.",
      external: true,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" catalog={workspace.name} />

      <ul aria-label="Settings" className="border-t border-line">
        {rows.map((row) => {
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{row.title}</span>
                <span className="mt-0.5 block text-sm text-ink-2">{row.detail}</span>
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
    </div>
  );
}
