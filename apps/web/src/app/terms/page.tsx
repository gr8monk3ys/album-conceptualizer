import type { Metadata } from "next";

import { PublicTrustShell, TrustSection } from "@/components/public-trust-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Album Conceptualizer and its hosted workspace.",
};

export default function TermsPage() {
  return (
    <PublicTrustShell
      eyebrow="Terms of service"
      title="Terms for using Album Conceptualizer"
      description="These terms govern your access to the hosted app, related export workflows, and any paid subscription features exposed through the service."
      aside={
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[var(--muted2)]">What this covers</div>
            <div className="mt-1 text-lg font-semibold text-[var(--text)]">
              Workspace, exports, billing
            </div>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <div>Use the service lawfully and do not upload material you do not have rights to use.</div>
            <div>Your album data stays yours; we only need a limited license to host and process it.</div>
            <div>Paid subscriptions, if enabled, are billed through Stripe and can change with notice.</div>
          </div>
        </div>
      }
    >
      <TrustSection title="1. Using the service">
        <p>
          Album Conceptualizer is a workspace for planning, editing, exporting, publishing, and
          remixing concept-album blueprints. You may use it only in compliance with applicable
          laws, platform rules, and these terms.
        </p>
        <p>
          You are responsible for the prompts, lyrics, references, uploaded material, and other
          project content you create or store in the workspace.
        </p>
      </TrustSection>

      <TrustSection title="2. Accounts and access">
        <p>
          You must provide accurate account information and keep your sign-in method under your
          control. You are responsible for activity that happens through your account.
        </p>
        <p>
          We may suspend or restrict access if we detect abuse, non-payment, fraud, security risk,
          or behavior that threatens the product or other users.
        </p>
      </TrustSection>

      <TrustSection title="3. Your content and exports">
        <p>
          You retain ownership of the content you create in the workspace. You grant us a limited
          license to host, process, transform, and export that content solely to operate, secure,
          and improve the service.
        </p>
        <p>
          You are responsible for obtaining any rights, permissions, or clearances needed for the
          source material you upload or reference, including lyrics, stems, samples, and artwork.
        </p>
      </TrustSection>

      <TrustSection title="4. Billing and subscriptions">
        <p>
          If billing is enabled for your workspace, subscription purchases and billing management
          are handled through Stripe. Plan limits, pricing, and available features may change over
          time.
        </p>
        <p>
          Unless required otherwise by law, fees are non-refundable after the billing period
          starts. You can manage cancellation or downgrade requests through the billing portal when
          available.
        </p>
      </TrustSection>

      <TrustSection title="5. Acceptable use">
        <p>
          Do not use the service to infringe intellectual-property rights, evade payment or rate
          limits, interfere with other users, reverse engineer protected systems, or distribute
          malware, spam, or illegal material.
        </p>
        <p>
          We may investigate misuse and remove content or access when necessary to protect the
          service, users, or our service providers.
        </p>
      </TrustSection>

      <TrustSection title="6. Availability and beta status">
        <p>
          The product may evolve quickly, especially during alpha or beta periods. Features may be
          added, changed, or removed, and availability may be interrupted by maintenance, provider
          issues, or security work.
        </p>
        <p>
          We do not guarantee uninterrupted access, permanent storage, or suitability for any
          particular commercial use without your own review and backup processes.
        </p>
      </TrustSection>

      <TrustSection title="7. Third-party services">
        <p>
          The service depends on third parties such as authentication providers, hosting, storage,
          email delivery, and Stripe. Your use of those connected services may also be subject to
          their own terms and policies.
        </p>
      </TrustSection>

      <TrustSection title="8. Disclaimers and limits">
        <p>
          The service is provided on an “as is” and “as available” basis to the maximum extent
          permitted by law. We disclaim implied warranties of merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental,
          special, consequential, or lost-profit damages arising from your use of the service.
        </p>
      </TrustSection>

      <TrustSection title="9. Contact">
        <p>
          For support, billing, or account questions, use the public support page at{" "}
          <a href="/support" className="text-[var(--text)] underline underline-offset-4">
            /support
          </a>
          .
        </p>
      </TrustSection>
    </PublicTrustShell>
  );
}
