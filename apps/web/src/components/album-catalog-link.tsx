"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A quiet link in the release header's catalog line that is also a location (Version history):
 * on its own page it is marked current, for assistive tech (aria-current) and to the eye (a
 * saffron underline, the current-location signal), since no album tab claims that page.
 */
export function AlbumCatalogLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(className, current && "text-ink decoration-accent decoration-2 hover:decoration-accent")}
    >
      {children}
    </Link>
  );
}
