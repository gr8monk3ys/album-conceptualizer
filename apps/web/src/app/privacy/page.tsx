import type { Metadata } from "next";

import { PublicTrustShell, TrustSection } from "@/components/public-trust-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Album Conceptualizer collects, uses, and stores account and project data.",
};

export default function PrivacyPage() {
  return (
    <PublicTrustShell
      eyebrow="Privacy policy"
      title="How Album Conceptualizer handles your data"
      description="This page explains what account, project, billing, and analytics data the app can store, why it is used, and how support requests are handled."
      aside={
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[var(--muted2)]">At a glance</div>
            <div className="mt-1 text-lg font-semibold text-[var(--text)]">
              What we collect
            </div>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <div>Account details needed to authenticate and route workspaces.</div>
            <div>Album, song, export, version, comment, and analytics data needed to operate the app.</div>
            <div>Billing identifiers from Stripe when subscriptions are enabled.</div>
          </div>
        </div>
      }
    >
      <TrustSection title="1. Data we collect">
        <p>
          Depending on how the deployment is configured, we may collect account information such as
          your name, email address, provider account identifiers, and session data.
        </p>
        <p>
          We also store workspace data needed to operate the product, including album metadata,
          song structure, lyrics drafts, comments, tasks, versions, shares, notifications, and
          analytics events.
        </p>
      </TrustSection>

      <TrustSection title="2. How we use data">
        <p>
          We use your data to authenticate you, save projects, provide export workflows, show
          workspace analytics, enforce rate limits, prevent abuse, and support billing and
          subscription management where enabled.
        </p>
        <p>
          We may also use operational logs and aggregate product analytics to diagnose issues,
          improve reliability, and understand feature adoption.
        </p>
      </TrustSection>

      <TrustSection title="3. Billing and payments">
        <p>
          Billing is handled through Stripe. We do not store raw payment-card numbers in this app.
          We may store Stripe customer, subscription, and checkout identifiers so plans stay in
          sync with your workspace.
        </p>
      </TrustSection>

      <TrustSection title="4. Sharing and service providers">
        <p>
          We may share data with infrastructure and service providers that help us run the product,
          such as hosting, database, cache, email, authentication, logging, and payment providers.
        </p>
        <p>
          We may also disclose information when required by law, to protect the service, or during
          a merger, acquisition, financing, or similar business transfer.
        </p>
      </TrustSection>

      <TrustSection title="5. Cookies and session storage">
        <p>
          The app uses cookies or equivalent session mechanisms for authentication, security, and
          core product behavior. If you disable them, sign-in and protected routes may stop working
          correctly.
        </p>
      </TrustSection>

      <TrustSection title="6. Retention and deletion">
        <p>
          We retain account and project data for as long as needed to operate the service, comply
          with legal obligations, resolve disputes, and enforce agreements. Backups may persist for
          a limited period after deletion.
        </p>
        <p>
          If you want account or project data removed, use{" "}
          <a href="/support" className="text-[var(--text)] underline underline-offset-4">
            /support
          </a>{" "}
          to contact the team for the current deployment.
        </p>
      </TrustSection>

      <TrustSection title="7. Security">
        <p>
          We use reasonable technical and organizational measures to protect data, but no system is
          perfectly secure. You should still use strong authentication, avoid sharing credentials,
          and keep your own backups of critical material.
        </p>
      </TrustSection>

      <TrustSection title="8. Your choices">
        <p>
          You can usually review or update workspace content directly in the app. Billing settings
          can be managed from the workspace billing area when enabled. For privacy requests that
          are not self-serve, contact support.
        </p>
      </TrustSection>
    </PublicTrustShell>
  );
}
