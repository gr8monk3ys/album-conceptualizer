import type { ReactNode } from "react";

import { Playerbar } from "@/components/playerbar";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <Sidebar className="hidden md:flex" />

        <div className="flex min-h-[calc(100vh-28px)] flex-1 flex-col gap-4">
          <header className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 shadow-[0_14px_50px_rgba(0,0,0,0.4)] backdrop-blur">
            <Topbar />
          </header>

          <main className="flex-1 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4 shadow-[0_14px_60px_rgba(0,0,0,0.35)]">
            {children}
          </main>
        </div>
      </div>

      <Playerbar />
    </div>
  );
}

