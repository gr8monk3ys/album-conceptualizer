"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";

import { Button, Panel, Section, StatusMessage, buttonClass } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";

type ExportFormat = "midi" | "chordpro" | "musicxml" | "json" | "text";

type Status = { tone: "ok" | "danger" | "neutral"; text: string } | null;

const ALL_FORMATS: Array<{ key: ExportFormat; title: string; desc: string }> = [
  { key: "midi", title: "MIDI", desc: "Chord progressions and basic timing, ready to drop into a DAW." },
  { key: "chordpro", title: "ChordPro", desc: "Lyrics with chords for OnSong or SongBook." },
  { key: "musicxml", title: "MusicXML", desc: "Notation for MuseScore, Finale or Sibelius." },
  { key: "json", title: "JSON", desc: "The full project, for backups or moving the album elsewhere." },
  { key: "text", title: "Text", desc: "The tracklist as plain text." },
];

const HANDOFF_PACKS = [
  {
    key: "suno",
    destination: "Suno",
    title: "Suno brief",
    use: "For generating tracks in Suno without losing the album's voice.",
    contents: [
      "A prompt line for every track, built from its tempo, key, themes and your style bible",
      "Negative prompt guidance from your avoid list",
      "The section map and production notes for each track",
    ],
  },
  {
    key: "udio",
    destination: "Udio",
    title: "Udio brief",
    use: "For Udio sessions where you extend and replace sections one at a time.",
    contents: [
      "A prompt line per track to start from, with the references and emotional targets to keep",
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
      "Production notes plus the recording and mix priorities from your style bible",
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
async function download(url: string, fallbackName: string, failure: string) {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
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

  const cost = CREDIT_COSTS.exportZip;
  const canAfford = remaining >= cost;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("formats", Array.from(selected).join(","));
    if (includeProductionNotes) params.set("production_notes", "1");
    return params.toString();
  }, [selected, includeProductionNotes]);

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
    const result = await download(
      `/api/albums/${albumId}/export?${query}`,
      "album_export.zip",
      "The zip couldn't be built.",
    );
    setIsZipping(false);
    if (!result.ok) {
      setZipStatus({ tone: "danger", text: result.message });
      return;
    }
    const left = Math.max(0, remaining - cost);
    setRemaining(left);
    setZipStatus({ tone: "ok", text: `Zip downloaded. ${credits(left)} left.` });
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
        description="Pick where the record goes next. Each pack is a plain-text brief (.md) built from your Album Bible, coherence report, references and style bible, so every track carries the same world."
      >
        <ul className="@container divide-y divide-line border-y border-line">
          {HANDOFF_PACKS.map((pack) => (
            <li
              key={pack.key}
              className="grid grid-cols-1 gap-4 py-5 @2xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] @2xl:gap-6"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-ink">{pack.destination}</h3>
                <p className="mt-1 text-sm text-ink-2">{pack.use}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-3">What&apos;s inside</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-3">
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
                  className={buttonClass("secondary", "whitespace-nowrap")}
                >
                  Download {pack.title}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-ink-3">
            Every pack also carries the album blueprint, the style bible, your references, rough
            demo reviews and the top coherence fixes. Handoff packs don&apos;t use credits.
          </p>
          {handoffStatus ? (
            <StatusMessage tone={handoffStatus.tone}>{handoffStatus.text}</StatusMessage>
          ) : null}
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
                        className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selected.has(fmt.key)}
                          onChange={() => toggle(fmt.key)}
                          aria-describedby={`${inputId}-desc`}
                          className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
                        />
                        {fmt.title}
                      </label>
                      <p id={`${inputId}-desc`} className="-mt-1.5 pb-1.5 pl-8 text-sm text-ink-2">
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
                  className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink"
                >
                  <input
                    id="include-production-notes"
                    type="checkbox"
                    checked={includeProductionNotes}
                    onChange={() => setIncludeProductionNotes((v) => !v)}
                    aria-describedby="include-production-notes-desc"
                    className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
                  />
                  Include production notes
                </label>
                <p id="include-production-notes-desc" className="-mt-1.5 pl-8 text-sm text-ink-2">
                  Adds your production notes to the formats that can carry them.
                </p>
              </fieldset>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Button
                  tone="primary"
                  disabled={selected.size === 0 || !canAfford || isZipping}
                  aria-describedby="export-zip-cost"
                  onClick={() => void downloadZip()}
                >
                  {isZipping ? "Preparing zip…" : `Download zip · ${credits(cost)}`}
                </Button>
                {selected.size === 0 ? (
                  <p id="export-zip-cost" className="text-sm text-ink-2">
                    Pick at least one format to build a zip.
                  </p>
                ) : canAfford ? (
                  <p id="export-zip-cost" className="text-sm text-ink-3">
                    You have {credits(remaining)}.
                  </p>
                ) : (
                  <p id="export-zip-cost" className="text-sm text-warn">
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
                {zipStatus ? (
                  <StatusMessage tone={zipStatus.tone}>{zipStatus.text}</StatusMessage>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      </Section>
    </div>
  );
}
