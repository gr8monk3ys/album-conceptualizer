import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader, Section, TableScroller } from "@/components/ui";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { getAgentAvailability } from "@/server/engine";
import { FREE_PROJECT_LIMIT, planMonthlyCredits } from "@/server/plan";

// Rendered per request: whether AI drafts can run here is read from the server (cached 60s),
// so Help never lists as usable an action Billing and Challenges say isn't available.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Help",
  description:
    "How an album goes from one idea to a handoff pack, what credits pay for, what counts as written, and the Studio's keyboard shortcuts.",
};

const inlineLink =
  "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

const STEPS: Array<{ title: string; body: ReactNode }> = [
  {
    title: "Start the album",
    body: (
      <>
        New album opens a guided setup: a working title, the concept in a sentence or two, the
        album&apos;s themes and a first tracklist. Creating an album uses{" "}
        {plural(CREDIT_COSTS.albumCreate, "credit")}. Everything the setup drafts is a starting
        point for you to rewrite.
      </>
    ),
  },
  {
    title: "Write in the Studio",
    body: (
      <>
        Pick a track, give it a Story note (what happens in it) and a Role (where it sits in the
        arc), tag the album themes it carries, then write each Section&apos;s lyrics and chords.
        The Studio saves as you work.
      </>
    ),
  },
  {
    title: "Check how it holds together",
    body: (
      <>
        The album keeps two bibles. The Story bible (its own tab) gathers what the album is
        about: the concept, themes, story beats, characters and motifs. The Sound bible (under
        the Sound tab, with References and Demos) sets how it sounds: the lead voice, palette,
        arrangement rules and mix priorities. The Coherence report reads every track against
        them: which tracks carry the themes, which drift, and what to fix next, with a link
        straight to the field that needs it.
      </>
    ),
  },
  {
    title: "Hand it off",
    body: (
      <>
        Export packs the formats you choose (MIDI, ChordPro, MusicXML, JSON) into one zip for{" "}
        {plural(CREDIT_COSTS.exportZip, "credit")}, or writes a Handoff pack for the tool you use
        next: a DAW, an audio generator or a collaborator.
      </>
    ),
  },
  {
    title: "Share it, if you like",
    body: (
      <>
        Publishing puts the album on Discover, where others can read it and Remix it into their
        own workspace. The person remixing spends {plural(CREDIT_COSTS.albumFork, "credit")}; your
        album stays as it is.
      </>
    ),
  },
];

const COSTS: Array<{ action: string; cost: number; ai?: boolean }> = [
  { action: "Create an album", cost: CREDIT_COSTS.albumCreate },
  { action: "Remix an album from Discover or a share link", cost: CREDIT_COSTS.albumFork },
  { action: "Download an export zip", cost: CREDIT_COSTS.exportZip },
  {
    action: "Get an AI draft (brainstorming ideas, developing a song or reviewing coherence)",
    cost: CREDIT_COSTS.agentRun,
    ai: true,
  },
];

const PLANS = [
  { name: "Free", credits: planMonthlyCredits("free"), note: `Up to ${plural(FREE_PROJECT_LIMIT, "album")}.` },
  { name: "Pro", credits: planMonthlyCredits("pro"), note: "As many albums as you like." },
  { name: "Team", credits: planMonthlyCredits("team"), note: "As many albums as you like." },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? (
            <span aria-hidden="true" className="text-ink-3">
              +
            </span>
          ) : null}
          <kbd className="type-figure rounded-sm border border-line-strong bg-sunken px-1.5 py-0.5 font-sans text-xs font-semibold text-ink">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

// The Studio's shortcuts. Plain arrow keys are never taken, so the caret moves as usual.
const SHORTCUTS: Array<{ keys: string[][]; does: string; spoken: string }> = [
  {
    keys: [["Alt", "↑"], ["Alt", "↓"]],
    does: "Previous or next track, when you're not typing in a field",
    spoken: "Alt plus Up arrow, or Alt plus Down arrow",
  },
  {
    keys: [["Alt", "Page Up"], ["Alt", "Page Down"]],
    does: "Previous or next track, from anywhere, including while you type",
    spoken: "Alt plus Page Up, or Alt plus Page Down",
  },
  {
    keys: [["Alt", "Shift", "↑"], ["Alt", "Shift", "↓"]],
    does: "Previous or next Section of the current track",
    spoken: "Alt plus Shift plus Up arrow, or Alt plus Shift plus Down arrow",
  },
  {
    keys: [["Ctrl", "S"], ["⌘", "S"]],
    does: "Save now, without waiting for the automatic save",
    spoken: "Control plus S, or Command plus S on a Mac",
  },
];

/** The page's sections, in order, for the jump list at the top (each Section's h2 is `<id>-title`). */
const CONTENTS = [
  { id: "workflow", label: "From idea to handoff" },
  { id: "credits", label: "Credits and plans" },
  { id: "written", label: "What counts as written" },
  { id: "keyboard", label: "Keyboard shortcuts" },
  { id: "stuck", label: "Still stuck?" },
];

/** A short, task-based guide: the workflow, credits and plans, what counts, shortcuts. */
export default async function HelpPage() {
  // The same check Billing and Challenges use: false when AI drafts can't run on this server.
  const aiAvailable = await getAgentAvailability();
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        size="page"
        title="Help"
        description="How an album goes from one idea to a handoff pack, and the details that come up on the way."
      />

      {/* A jump list: every section one step away, so a question from another screen (What
          counts as written, from the Coherence report) lands on its answer. */}
      <nav aria-label="On this page" className="-mt-4">
        <ul className="flex flex-wrap items-center gap-x-1 text-sm">
          {CONTENTS.map((item, index) => (
            <li key={item.id} className="flex items-center gap-x-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-ink-3">
                  ·
                </span>
              ) : null}
              <a
                href={`#${item.id}-title`}
                className="inline-flex min-h-11 items-center px-1 text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section
        id="workflow"
        title="From idea to handoff"
        description="The album is the unit, not the song. Most records take these steps, in roughly this order."
      >
        <ol className="border-t border-line">
          {STEPS.map((step) => (
            <li key={step.title} className="border-b border-line py-4">
              <h3 className="text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="credits"
        title="Credits and plans"
        description="Credits pay for the few actions that do heavy work on the server. Writing, the Story and Sound bibles, the Coherence report, versions and comments are free to use as much as you like."
      >
        <div className="flex flex-col gap-8">
          <TableScroller label="What each action costs" className="max-w-2xl">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">What each action costs, in credits</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="type-catalog pb-2 pr-4 text-left text-xs text-ink-3">
                    Action
                  </th>
                  <th scope="col" className="type-catalog pb-2 text-right text-xs text-ink-3">
                    Credits
                  </th>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((row) => (
                  <tr key={row.action} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{row.action}</td>
                    {row.ai && !aiAvailable ? (
                      <td className="py-3 text-right text-ink-3">Not available on this server right now</td>
                    ) : (
                      <td className="type-figure py-3 text-right font-semibold text-ink">{row.cost}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroller>
          {/* Offers you can't take aren't sold: the same line Billing shows. */}
          {aiAvailable ? null : (
            <p className="-mt-4 max-w-[65ch] text-sm leading-relaxed text-ink-2">
              AI drafts aren&apos;t available on this server right now, so no plan includes them: its
              credits go to creating, remixing and exporting. Everything else works without them.
            </p>
          )}

          <TableScroller label="Monthly credits on each plan" className="max-w-2xl">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Monthly credits on each plan</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="type-catalog pb-2 pr-4 text-left text-xs text-ink-3">
                    Plan
                  </th>
                  <th scope="col" className="type-catalog pb-2 pr-4 text-right text-xs text-ink-3">
                    Credits a month
                  </th>
                  <th scope="col" className="type-catalog pb-2 text-left text-xs text-ink-3">
                    Albums
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan) => (
                  <tr key={plan.name} className="border-b border-line">
                    <th scope="row" className="py-3 pr-4 text-left font-semibold text-ink">
                      {plan.name}
                    </th>
                    <td className="type-figure py-3 pr-4 text-right text-ink">{plan.credits}</td>
                    <td className="py-3 text-ink-2">{plan.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroller>

          <div className="flex max-w-[65ch] flex-col gap-3 text-sm leading-relaxed text-ink-2">
            <p>
              At the start of each month your balance is topped up to your plan&apos;s amount.
              Credits you earned above it, from{" "}
              <Link href="/app/challenges" className={inlineLink}>
                daily writing challenges
              </Link>
              , are kept.
            </p>
            <p>
              Every button that spends credits says how many, and asks once before it spends,
              with the balance you&apos;ll have left. If an action fails, its credits come back.
            </p>
            {/* A link on its own line, not in running text: a full 44px target. */}
            <p>
              <Link href="/app/settings/billing" className={`${inlineLink} inline-flex min-h-11 items-center`}>
                Compare plans and manage billing
              </Link>
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="written"
        title="What counts as written"
        description="Progress marks, the Sequence and the Coherence report only count work you have actually done."
      >
        <dl className="flex max-w-[65ch] flex-col gap-4 text-sm leading-relaxed">
          <div>
            <dt className="font-semibold text-ink">Lyrics</dt>
            <dd className="mt-1 text-ink-2">
              A Section counts as written once it has words of yours. The bracketed placeholders
              the setup leaves, like [Verse line 1], don&apos;t count. In the Sequence, 1/2 means
              one of a track&apos;s two Sections is written.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Chords</dt>
            <dd className="mt-1 text-ink-2">
              The setup gives every Section a starter loop, such as C G Am F, so you can hear it
              straight away. Until you change a chord, it counts as the starting loop, not as
              written harmony.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Story note, Role and themes</dt>
            <dd className="mt-1 text-ink-2">
              A track has them once you fill them in the Studio. The Sequence shows a check under
              Role and a square under each album theme the track carries.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">The coherence score</dt>
            <dd className="mt-1 text-ink-2">
              The Coherence report waits for enough tracks with lyrics before it gives a score.
              Until then it lists what&apos;s missing. While some tracks are still unwritten it
              leads with how many are written and what the written tracks score on their own; the
              whole album&apos;s score comes second, held down until every track has lyrics, and
              the album reads as unfinished, whatever the score. That is progress, not a fault.
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        id="keyboard"
        title="Keyboard shortcuts in the Studio"
        description="Plain arrow keys always move the caret. On a Mac, Alt is the Option key (⌥)."
      >
        <TableScroller label="Studio keyboard shortcuts" className="max-w-3xl">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Studio keyboard shortcuts</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="type-catalog pb-2 pr-4 text-left text-xs text-ink-3">
                  Keys
                </th>
                <th scope="col" className="type-catalog pb-2 text-left text-xs text-ink-3">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((shortcut) => (
                <tr key={shortcut.does} className="border-b border-line align-top">
                  <td className="py-3 pr-4">
                    <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {shortcut.keys.map((combo, index) => (
                        <span key={combo.join("+")} className="inline-flex items-center gap-2">
                          {index > 0 ? <span className="text-ink-3">or</span> : null}
                          <Keys keys={combo} />
                        </span>
                      ))}
                    </span>
                    <span className="sr-only">{shortcut.spoken}</span>
                  </td>
                  <td className="py-3 text-ink-2">{shortcut.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      </Section>

      <Section id="stuck" title="Still stuck?">
        <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">
          If saving or exporting keeps failing,{" "}
          <Link href="/app/settings#troubleshooting-title" className={inlineLink}>
            Settings has a check you can run
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
