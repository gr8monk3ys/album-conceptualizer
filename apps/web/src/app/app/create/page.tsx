import { AlbumCard, type AlbumListItem } from "@/components/album-card";

const drafts: AlbumListItem[] = [
  {
    id: "d1",
    title: "Neon Atlas",
    subtitle: "A city traveler rebuilding identity after midnight",
    tag: "concept",
    duration: "1:00",
  },
  {
    id: "d2",
    title: "Pulse Runner",
    subtitle: "Remix battle submission: syncopated bass + half-time lift",
    tag: "remix",
    duration: "0:47",
  },
];

export default function CreatePage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--muted2)]">Create</div>
            <div className="text-lg font-semibold tracking-tight text-[var(--text)]">
              Album Description
            </div>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--muted)]">
            v0.1
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            className="min-h-[150px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] focus:outline-none focus:ring-2 focus:ring-[rgba(109,94,252,0.25)]"
            placeholder="Haunting high-energy concept album about stream watching and digital ghosts..."
          />

          <div className="flex flex-wrap gap-2">
            {["Audio", "Lyrics", "Instrumental"].map((pill) => (
              <button
                key={pill}
                type="button"
                className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                + {pill}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="text-xs font-semibold text-[var(--text)]">Inspiration</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {["soft female vocals", "shehnai", "soul", "ambient"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[rgba(255,255,255,0.05)] px-3 py-1 text-xs text-[var(--muted)]"
                >
                  + {tag}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-2xl bg-[linear-gradient(90deg,var(--accent2),var(--accent))] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(255,62,165,0.15)] hover:brightness-110"
          >
            Create
          </button>

          <div className="text-xs text-[var(--muted2)]">
            Next.js + Neon + Stripe wiring comes next; this panel will call server actions for album
            generation and save results to Postgres.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--text)]">Drafts</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Filters
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--muted)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              Newest
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {drafts.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </section>
    </div>
  );
}

