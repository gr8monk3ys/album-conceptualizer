const FALLBACK_RESEND_FROM = "onboarding@resend.dev";

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function hasGitHubAuthConfigured() {
  return hasValue(process.env.GITHUB_ID) && hasValue(process.env.GITHUB_SECRET);
}

function hasEmailAuthConfigured() {
  return hasValue(process.env.EMAIL_SERVER) || hasValue(process.env.RESEND_API_KEY);
}

function hasExplicitEmailSender() {
  return (
    hasValue(process.env.AUTH_EMAIL_FROM) ||
    hasValue(process.env.EMAIL_FROM) ||
    hasValue(process.env.RESEND_FROM)
  );
}

export function hasWebRateLimitingConfigured() {
  return (
    hasValue(process.env.UPSTASH_REDIS_REST_URL) && hasValue(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function stripeBillingTouched() {
  return [
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_PRICE_ID_FREE,
    process.env.STRIPE_PRICE_ID_PRO,
    process.env.STRIPE_PRICE_ID_TEAM,
    process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  ].some(hasValue);
}

function hasAnyStripePriceId() {
  return [
    process.env.STRIPE_PRICE_ID_FREE,
    process.env.STRIPE_PRICE_ID_PRO,
    process.env.STRIPE_PRICE_ID_TEAM,
    process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  ].some(hasValue);
}

export function isStrictProductionRuntime() {
  return process.env.NODE_ENV === "production" && process.env.AC_E2E !== "1";
}

export function getProductionConfigIssues() {
  if (!isStrictProductionRuntime()) return [] as string[];

  const issues: string[] = [];

  if (!hasValue(process.env.NEXTAUTH_SECRET) && !hasValue(process.env.AUTH_SECRET)) {
    issues.push("Set NEXTAUTH_SECRET or AUTH_SECRET.");
  }

  if (!hasValue(process.env.NEXTAUTH_URL)) {
    issues.push("Set NEXTAUTH_URL.");
  }

  if (!hasValue(process.env.NEXT_PUBLIC_APP_URL)) {
    issues.push("Set NEXT_PUBLIC_APP_URL.");
  }

  if (process.env.ENABLE_DEV_LOGIN === "1" || process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1") {
    issues.push("Disable ENABLE_DEV_LOGIN and NEXT_PUBLIC_ENABLE_DEV_LOGIN in production.");
  }

  const hasGitHubId = hasValue(process.env.GITHUB_ID);
  const hasGitHubSecret = hasValue(process.env.GITHUB_SECRET);
  if (hasGitHubId !== hasGitHubSecret) {
    issues.push("Configure both GITHUB_ID and GITHUB_SECRET together.");
  }

  if (!hasGitHubAuthConfigured() && !hasEmailAuthConfigured()) {
    issues.push("Configure at least one production auth provider (GitHub OAuth or email).");
  }

  if (hasEmailAuthConfigured() && !hasExplicitEmailSender()) {
    issues.push(
      `Set AUTH_EMAIL_FROM, EMAIL_FROM, or RESEND_FROM instead of relying on ${FALLBACK_RESEND_FROM}.`,
    );
  }

  if (!hasWebRateLimitingConfigured()) {
    issues.push("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production rate limiting.");
  }

  if (!hasValue(process.env.ENGINE_API_URL)) {
    issues.push("Set ENGINE_API_URL to enable export and preview flows.");
  }

  if (stripeBillingTouched()) {
    if (!hasValue(process.env.STRIPE_SECRET_KEY)) {
      issues.push("Set STRIPE_SECRET_KEY when Stripe billing is configured.");
    }
    if (!hasValue(process.env.STRIPE_WEBHOOK_SECRET)) {
      issues.push("Set STRIPE_WEBHOOK_SECRET when Stripe billing is configured.");
    }
    if (!hasAnyStripePriceId()) {
      issues.push("Set at least one Stripe price id when Stripe billing is configured.");
    }
  }

  return issues;
}
