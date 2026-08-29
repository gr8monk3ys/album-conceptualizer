"use client";

import dynamic from "next/dynamic";

const MobileAppMenu = dynamic(
  () => import("@/components/mobile-app-menu").then((mod) => mod.MobileAppMenu),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-10 w-10 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.05)] md:hidden"
        aria-hidden="true"
      />
    ),
  },
);

const UserMenu = dynamic(() => import("@/components/user-menu").then((mod) => mod.UserMenu), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="hidden h-8 w-28 rounded-xl bg-[rgba(255,255,255,0.04)] md:block" />
      <div className="h-9 w-9 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)]" />
      <div className="h-9 w-9 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)]" />
    </div>
  ),
});

export function TopbarMobileMenuControl({
  currentPath,
  workspaceName,
  userName,
  plan,
  credits,
  unreadNotifications,
}: {
  currentPath: string;
  workspaceName: string;
  userName?: string | null;
  plan?: string | null;
  credits?: { remaining: number; total: number };
  unreadNotifications?: number;
}) {
  return (
    <MobileAppMenu
      currentPath={currentPath}
      workspaceName={workspaceName}
      userName={userName}
      plan={plan}
      credits={credits}
      unreadNotifications={unreadNotifications}
    />
  );
}

export function TopbarUserControls({
  name,
  email,
  imageUrl,
}: {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}) {
  return <UserMenu name={name} email={email} imageUrl={imageUrl} />;
}
