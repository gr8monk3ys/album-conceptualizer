"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { ConfirmSpend } from "@/components/confirm-spend";
import { LiveStatus, Panel, Section, buttonClass } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";

export type ExportFormat = "midi" | "chordpro" | "musicxml" | "json" | "text";

type Status = { tone: "ok" | "danger" | "neutral"; text: string } | null;

const ALL_FORMATS: Array<{ key: ExportFormat; title: string; desc: string }> = [
  { key: "midi", title: "MIDI", desc: "Chord progressions and basic timing, ready to drop into a DAW." },
  { key: "chordpro", title: "ChordPro", desc: "Lyrics with chords for OnSong or SongBook." },
  { key: "musicxml", title: "MusicXML", desc: "Notation for MuseScore, Finale or Sibelius." },
  { key: "json", title: "JSON", desc: "The full album, for backups or moving it elsewhere." },
  { key: "text", title: "Text", desc: "The tracklist as plain text." },
];

const HANDOFF_PACKS = [
  {
    key: "suno",
    destination: "Suno",
    title: "Suno brief",
    use: "For generating tracks in Suno without losing the album's voice.",
    contents: [
      "A prompt line for every track, built from its tempo, key, themes and your Sound bible",
      "Negative prompt guidance from your avoid list",
      "Your references listed beside each prompt, never in it: Suno rejects artist names",
      "The section map and production notes for each track",
    ],
  },
  {
    key: "udio",
    destination: "Udio",
    title: "Udio brief",
    use: "For Udio sessions where you extend and replace sections one at a time.",
    contents: [
      "A prompt line per track to start from, with the emotional targets to keep",
      "Your references listed beside each prompt, never in it: Udio rejects artist names",
      "A section-by-section map for editing and extending",
      "Negative prompt guidance from your avoid list",
    ],
  },
  {
    key: "daw",
    destination: "DAW session",
    title: "DAW session notes",
    use: "For a producer, an engineer or your own session file.",
    contents: [
      "A session objective per track: arrangement guardrails, mix focus and primary references",
      "The section map with bar counts and chords",
      "Production notes plus the recording and mix priorities from your Sound bible",
    ],
  },
] as const;

/** The server's human-written `error` field, or the fallback. Never a raw body or status. */
async function readError(response: Response, fallback: string) {
  if (response.status === 401) return "You're signed out. Sign in again, then retry.";
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}

function filenameFrom(disposition: string | null) {
  if (!disposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // Fall through to the plain filename.
    }
  }
  const plain = /filename="([^"]+)"/i.exec(disposition);
  return plain ? plain[1] : null;
}

/** Fetch a file and hand it to the browser as a download, so failures can be explained. */
async function download(url: string, fallbackName: string, failure: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false as const, message: `${failure} Check your connection and try again.` };
  }
  if (!response.ok) return { ok: false as const, message: await readError(response, failure) };

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filenameFrom(response.headers.get("content-disposition")) ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return { ok: true as const };
}

function credits(n: number) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

/**
 * What to do with the zip once it is down, for the formats in it: the export ends on the next
 * step of the work, not on the balance. MIDI leads because it is what goes into a DAW.
 */
export function zipNextStep(formats: ReadonlySet<ExportFormat>): string {
  if (formats.has("midi")) return "open the MIDI files in your DAW (one per track, at each track's tempo)";
  if (formats.has("musicxml")) return "open the MusicXML files in MuseScore, Finale or Sibelius";
  if (formats.has("chordpro")) return "open the ChordPro charts in OnSong or SongBook";
  if (formats.has("json")) return "keep the JSON as a backup, or import it elsewhere";
  return "the tracklist is in the text file";
}

export function AlbumExport({
  albumId,
  creditsRemaining,
}: {
  albumId: string;
  creditsRemaining: number;
}) {
  const [selected, setSelected] = useState<Set<ExportFormat>>(
    () => new Set<ExportFormat>(["midi", "chordpro", "json"]),
  );
  const [includeProductionNotes, setIncludeProductionNotes] = useState(true);
  const [remaining, setRemaining] = useState(creditsRemaining);
  const [zipStatus, setZipStatus] = useState<Status>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<Status>(null);
  const [handoffBusy, setHandoffBusy] = useState<string | null>(null);

  const router = useRouter();
  const cost = CREDIT_COSTS.exportZip;
  const canAfford = remaining >= cost;

  function toggle(format: ExportFormat) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }

  async function downloadZip() {
    if (!selected.size || !canAfford) return;
    setIsZipping(true);
    setZipStatus({ tone: "neutral", text: "Preparing your zip…" });
    // A POST: the zip spends credits, so it is never a plain link.
    const result = await download(`/api/albums/${albumId}/export`, "album_export.zip", "The zip couldn't be built.", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ formats: Array.from(selected), includeProductionNotes }),
    });
    setIsZipping(false);
    if (!result.ok) {
      setZipStatus({ tone: "danger", text: result.message });
      return;
    }
    const left = Math.max(0, remaining - cost);
    setRemaining(left);
    setZipStatus({ tone: "ok", text: `Zip downloaded — ${zipNextStep(selected)}. ${credits(left)} left.` });
    // The zip was charged for; re-render the server layout so the credits meter agrees.
    router.refresh();
  }

  async function downloadHandoff(
    event: MouseEvent<HTMLAnchorElement>,
    pack: (typeof HANDOFF_PACKS)[number],
  ) {
    // Let the browser handle new-tab and save-as clicks on the plain link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (handoffBusy) return;
    setHandoffBusy(pack.key);
    setHandoffStatus({ tone: "neutral", text: `Preparing the ${pack.title}…` });
    const result = await download(
      event.currentTarget.href,
      `${pack.key}_handoff_pack.md`,
      `The ${pack.title} couldn't be built.`,
    );
    setHandoffBusy(null);
    setHandoffStatus(
      result.ok
        ? { tone: "ok", text: `${pack.destination} pack downloaded.` }
        : { tone: "danger", text: result.message },
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Section
        id="handoff"
        title="Hand off the album"
        description="Pick where the record goes next. Each pack is a plain-text brief (.md) built from your Story bible, Coherence report, references and Sound bible, so every track carries the same world."
      >
        <ul className="@container divide-y divide-line border-y border-line">
          {HANDOFF_PACKS.map((pack) => (
            <li
              key={pack.key}
              className="grid grid-cols-1 gap-4 py-5 @2xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,auto)] @2xl:gap-6"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-ink">{pack.destination}</h3>
                <p className="mt-1 max-w-[65ch] text-sm text-ink-2">{pack.use}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-3">What&apos;s inside</p>
                <ul className="mt-1.5 max-w-[65ch] list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-3">
                  {pack.contents.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="@2xl:pt-1">
                <a
                  href={`/api/albums/${albumId}/handoff?target=${pack.key}`}
                  download
                  aria-busy={handoffBusy === pack.key || undefined}
                  onClick={(event) => void downloadHandoff(event, pack)}
                  className={buttonClass("secondary", "text-center")}
                >
                  Download {pack.title}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="max-w-[65ch] text-sm text-ink-3">
            Every pack also carries the album blueprint, the Sound bible, your references, rough
            demo reviews and the top Coherence fixes. Fields you haven&apos;t set are left out. Handoff packs don&apos;t use credits.
          </p>
          <LiveStatus message={handoffStatus?.text ?? null} tone={handoffStatus?.tone} />
        </div>
      </Section>

      <Section
        id="export-files"
        title="Download the files"
        description="One zip with the formats you pick, ready for a DAW, notation software or a chord chart app."
      >
        <Panel className="@container">
          <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold text-ink">Formats</legend>
              <ul className="mt-2 divide-y divide-line">
                {ALL_FORMATS.map((fmt) => {
                  const inputId = `export-format-${fmt.key}`;
                  return (
                    <li key={fmt.key} className="py-1.5">
                      <label
                        htmlFor={inputId}
                        className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 text-sm font-semibold text-ink"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selected.has(fmt.key)}
                          onChange={() => toggle(fmt.key)}
                          aria-describedby={`${inputId}-desc`}
                          className="h-5 w-5 shrink-0 cursor-pointer accent-ink"
                        />
                        {fmt.title}
                      </label>
                      <p id={`${inputId}-desc`} className="-mt-1.5 max-w-[65ch] pb-1.5 pl-8 text-sm text-ink-2">
                        {fmt.desc}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <div className="flex min-w-0 flex-col gap-4 @2xl:border-l @2xl:border-line @2xl:pl-6">
              <fieldset>
                <legend className="text-sm font-semibold text-ink">Options</legend>
                <label
                  htmlFor="include-production-notes"
                  className="mt-2 flex min-h-11 min-w-0 cursor-pointer items-center gap-3 text-sm font-semibold text-ink"
                >
                  <input
                    id="include-production-notes"
                    type="checkbox"
                    checked={includeProductionNotes}
                    onChange={() => setIncludeProductionNotes((v) => !v)}
                    aria-describedby="include-production-notes-desc"
                    className="h-5 w-5 shrink-0 cursor-pointer accent-ink"
                  />
                  Include production notes
                </label>
                <p id="include-production-notes-desc" className="-mt-1.5 max-w-[65ch] pl-8 text-sm text-ink-2">
                  Adds your production notes to the formats that can carry them.
                </p>
              </fieldset>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                {/* A zip spends credits, so it asks once before charging. */}
                <ConfirmSpend
                  cost={cost}
                  remaining={remaining}
                  actionLabel="Download zip"
                  tone="primary"
                  busy={isZipping}
                  disabled={selected.size === 0 || !canAfford}
                  onConfirm={downloadZip}
                >
                  {isZipping ? "Preparing zip…" : `Download zip · ${credits(cost)}`}
                </ConfirmSpend>
                {selected.size === 0 ? (
                  <p id="export-zip-cost" className="text-sm text-ink-2">
                    Pick at least one format to build a zip.
                  </p>
                ) : canAfford ? (
                  <p id="export-zip-cost" className="text-sm text-ink-3">
                    You have {credits(remaining)}.
                  </p>
                ) : (
                  <p id="export-zip-cost" className="max-w-[65ch] text-sm text-warn">
                    A zip costs {credits(cost)} and you have {credits(remaining)}. Earn more from{" "}
                    <Link href="/app/challenges" className="underline underline-offset-4 hover:text-ink">
                      challenges
                    </Link>{" "}
                    or{" "}
                    <Link
                      href="/app/settings/billing"
                      className="underline underline-offset-4 hover:text-ink"
                    >
                      change your plan
                    </Link>
                    . Handoff packs above are free.
                  </p>
                )}
                {/* Always mounted, so "Preparing…" and the result are both announced. */}
                <LiveStatus message={zipStatus?.text ?? null} tone={zipStatus?.tone} />
              </div>
            </div>
          </div>
        </Panel>
      </Section>
    </div>
  );
}
