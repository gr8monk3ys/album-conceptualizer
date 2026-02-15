"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MoreHorizontal, Play } from "lucide-react";

import { cn } from "@/lib/utils";

export type AlbumListItem = {
  id: string;
  title: string;
  subtitle: string;
  tag?: string;
  duration?: string;
  cover?: string;
};

export function AlbumCard({
  album,
  className,
  href,
}: {
  album: AlbumListItem;
  className?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="relative h-16 w-16 flex-none overflow-hidden rounded-xl bg-[rgba(255,255,255,0.06)]">
        {album.cover ? (
          <Image
            src={album.cover}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,62,165,0.35),rgba(109,94,252,0.25),rgba(255,255,255,0.04))]" />
        )}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-black">
              <Play className="h-4 w-4" />
            </div>
          </div>
        </div>
        {album.duration ? (
          <div className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90">
            {album.duration}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold text-[var(--text)]">
            {album.title}
          </div>
          {album.tag ? (
            <div className="rounded-full bg-[rgba(255,62,165,0.18)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              {album.tag}
            </div>
          ) : null}
        </div>
        <div className="truncate text-xs text-[var(--muted2)]">{album.subtitle}</div>
      </div>

      <div className="flex items-center gap-1 text-[var(--muted)]">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Like"
          onClick={(event) => event.preventDefault()}
        >
          <Heart className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="More"
          onClick={(event) => event.preventDefault()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  const wrapperClassName = cn(
    "group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] hover:bg-[rgba(255,255,255,0.05)]",
    className,
  );

  return href ? (
    <Link href={href} className={wrapperClassName}>
      {content}
    </Link>
  ) : (
    <div className={wrapperClassName}>{content}</div>
  );
}
