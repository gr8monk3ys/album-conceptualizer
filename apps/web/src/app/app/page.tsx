import { AlbumCard, type AlbumListItem } from "@/components/album-card";

const demo: AlbumListItem[] = [
  {
    id: "a1",
    title: "Untitled",
    subtitle: "Hypnagogic pop / synth noir / city-night arc",
    tag: "v1 preview",
    duration: "1:00",
  },
  {
    id: "a2",
    title: "After Midnight",
    subtitle: "Indie pop concept draft | 10 tracks | rewrite pass pending",
    duration: "0:32",
  },
  {
    id: "a3",
    title: "Signal Return",
    subtitle: "Alt-pop bible + release kit exported",
    tag: "release kit",
    duration: "3:09",
  },
];

export default function AppHomePage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--muted2)]">For you</div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Recent projects
        </div>
        <div className="max-w-[64ch] text-sm text-[var(--muted)]">
          Pick up where you left off. This dashboard will soon sync to Neon (Postgres) and your
          Stripe plan, Suno-style.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {demo.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}

