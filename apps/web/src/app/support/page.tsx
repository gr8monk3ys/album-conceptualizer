import type { Metadata } from "next";

import {
  PublicTrustShell,
  REPO_DOCS_URL,
  REPO_ISSUES_URL,
  TrustSection,
} from "@/components/public-trust-shell";

export const metadata: Metadata = {
  title: "Support",
  description: "Support and contact paths for Album Conceptualizer users and self-hosters.",
};

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
}

export default function SupportPage() {
  const supportEmail = getSupportEmail();
  const hasSupportEmail = Boolean(supportEmail);

  return (
    <PublicTrustShell
      eyebrow="Support"
      title="Get help with access, billing, and exports"
      description="Use the support channel configured for this deployment for account and billing issues. Self-hosters and contributors can also use the repository docs and issue tracker."
      aside={
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[var(--muted2)]">Primary route</div>
            <div className="mt-1 text-lg font-semibold text-[var(--text)]">
              {hasSupportEmail ? "Email support" : "GitHub issue tracker"}
            </div>
          </div>
          <a
            href={hasSupportEmail ? `mailto:${supportEmail}` : REPO_ISSUES_URL}
            className="inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            {hasSupportEmail ? supportEmail : "Open GitHub issues"}
          </a>
          <div className="text-sm leading-relaxed text-[var(--muted)]">
            {hasSupportEmail
              ? "Use this for account access, privacy requests, billing questions, or export failures."
              : "No public support email is configured for this deployment yet. For self-hosting or repo-level issues, use GitHub issues."}
          </div>
        </div>
      }
    >
      <TrustSection title="1. Fastest paths">
        <p>
          Use the deployment support channel for account access, billing questions, subscription
          changes, export failures, and privacy requests.
        </p>
        <p>
          If you already have access to the workspace, the billing page inside the app is the
          fastest place to manage subscription state and view plan details.
        </p>
      </TrustSection>

      <TrustSection title="2. Self-hosting and developer issues">
        <p>
          If you are running the repo yourself, the best path is usually the documentation and the
          issue tracker:
        </p>
        <p>
          <a href={REPO_DOCS_URL} className="text-[var(--text)] underline underline-offset-4">
            Repository documentation
          </a>
          {" · "}
          <a href={REPO_ISSUES_URL} className="text-[var(--text)] underline underline-offset-4">
            GitHub issues
          </a>
        </p>
      </TrustSection>

      <TrustSection title="3. What to include in a support request">
        <p>
          Include the workspace or album name, what you were trying to do, the rough time it
          happened, any visible error text, and whether the problem affects sign-in, billing,
          publish/remix, or export.
        </p>
      </TrustSection>

      <TrustSection title="4. Response expectations">
        <p>
          Support response times depend on the deployment and plan. During alpha or self-hosted
          use, responses may be best-effort rather than covered by a formal SLA.
        </p>
      </TrustSection>
    </PublicTrustShell>
  );
}
