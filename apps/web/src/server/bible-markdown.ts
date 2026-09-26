import type { AlbumBible } from "@/server/bible";
import { buildMotifCharacterGraph } from "@/server/bible-relationships";
import { formatPackDate } from "@/server/pack-date";
import { albumMotifIndex } from "@/lib/motifs";

function lineWrap(text: string, max = 92) {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= max) return t;

  const words = t.split(/\s+/g);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
      continue;
    }
    if (current.length + 1 + w.length <= max) current = `${current} ${w}`;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function mdList(values: string[], emptyText: string) {
  if (!values.length) return emptyText;
  return values.map((v) => `- ${v}`).join("\n");
}

/** One "**Label:** value" line, or nothing: the Bible never prints "_none_" for an unset field. */
function field(label: string, value: string | string[] | null | undefined, prefix = "") {
  const text = Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean).join(", ")
    : (value ?? "").trim();
  return text ? `${prefix}**${label}:** ${lineWrap(text)}` : null;
}

function block(fields: Array<string | null>, emptyLine: string) {
  const set = fields.filter((line): line is string => Boolean(line));
  return set.length ? set : [emptyLine];
}

/** Section numbers as the artist reads them: the first section is #1, whichever base it's stored in. */
function sectionOrdinal(order: number) {
  return order >= 1 ? order : order + 1;
}

export function buildBibleMarkdown(bible: AlbumBible, generatedAt: Date = new Date()) {
  const lines: string[] = [];
  // Album motifs plus track motif tags: the same source as the Bible page and Coherence report.
  const motifs = albumMotifIndex({
    recurring_motifs: bible.recurringMotifs,
    songs: bible.tracks.map((track) => ({ track_number: track.trackNumber, motifs: track.motifs })),
  });

  lines.push(`# ${bible.title}`);
  if (bible.artist) lines.push(`**Artist:** ${bible.artist}`);
  if (bible.primaryGenre) lines.push(`**Genre:** ${bible.primaryGenre}`);
  lines.push(`**Generated:** ${formatPackDate(generatedAt)}`);
  lines.push("");

  lines.push("## Concept");
  lines.push(
    bible.conceptSummary?.trim()
      ? lineWrap(bible.conceptSummary)
      : "Not set yet — add a concept summary in the Studio.",
  );
  lines.push("");

  lines.push("## Album themes");
  lines.push(mdList(bible.centralThemes, "Not set yet — add the album's themes in the Studio."));
  lines.push("");

  lines.push("## Motifs");
  lines.push(
    mdList(
      motifs.map((motif) => {
        const where = motif.trackNumbers.length
          ? `${motif.trackNumbers.length === 1 ? "track" : "tracks"} ${motif.trackNumbers.join(", ")}`
          : "on no track yet";
        return `**${motif.name}**${motif.albumLevel ? " (album motif)" : ""}: ${where}`;
      }),
      "Not set yet — name the album's motifs in the Studio.",
    ),
  );
  lines.push("");

  const style = bible.styleBible;
  lines.push("## Style bible");
  lines.push(
    ...block(
      [
        field("Lead voice", style.lead_voice),
        field("Narrator perspective", style.narrator_perspective),
        field("Vocal attributes", style.vocal_attributes),
        field("Sonic palette", style.sonic_palette),
        field("Arrangement rules", style.arrangement_rules),
        field("Mix priorities", style.mix_priorities),
        field("Avoid list", style.avoid_list),
        field("Emotional targets", style.emotional_targets),
        field("Reference strategy", style.reference_strategy),
      ],
      "Not set yet — add it in the Style bible.",
    ),
  );
  lines.push("");

  // As on the Bible page: how the threads hang together. Per-track gaps are the Coherence
  // report's job, and Style bible gaps show as the block above.
  const threads = bible.issues.filter((i) => i.scope === "structure");
  lines.push("## Loose threads");
  lines.push(
    mdList(
      threads.map((issue) => `**${issue.title}**: ${issue.detail}`),
      "Every theme, character and story order holds across the album.",
    ),
  );
  lines.push("");

  const graph = buildMotifCharacterGraph(bible, { maxCharacters: 16, maxMotifs: 16, minEdgeWeight: 1 });
  lines.push("## Characters and motifs");
  if (!graph.edges.length) {
    lines.push("No connections yet — tag characters and motifs on the same tracks.");
  } else {
    for (const edge of graph.edges.slice(0, 60)) {
      lines.push(`- **${edge.character}** ↔ **${edge.motif}** (tracks: ${edge.trackNumbers.join(", ")})`);
    }
    if (graph.edges.length > 60) {
      lines.push("");
      lines.push(`…and ${graph.edges.length - 60} more.`);
    }
  }
  lines.push("");

  lines.push("## Story beats");
  lines.push(bible.timeline.mode === "chronological" ? "In story order." : "In tracklist order.");
  lines.push("");

  for (const track of bible.timeline.tracks) {
    lines.push(`### Track ${track.trackNumber}: ${track.title}`);
    lines.push(
      ...block(
        [
          typeof track.chronologicalOrder === "number" ? `- **Story order:** ${track.chronologicalOrder}` : null,
          field("Story note", track.narrativeSummary, "- "),
          field("Themes", track.themes, "- "),
          field("Motifs", track.motifs, "- "),
          field("Characters", track.characters, "- "),
        ],
        "Nothing set for this track yet — add a story note, themes and motifs in the Studio.",
      ),
    );
    if (track.sections.length) {
      lines.push("");
      lines.push("Sections:");
      for (const section of track.sections) {
        const parts: string[] = [];
        parts.push(`${section.sectionType} #${sectionOrdinal(section.order)}`);
        if (section.narrativeFunction) parts.push(`function: ${section.narrativeFunction}`);
        if (section.emotionalArc) parts.push(`arc: ${section.emotionalArc}`);
        if (section.chordCount) parts.push(`${section.chordCount} chords`);
        lines.push(`- ${parts.join(" · ")}`);
      }
    }
    lines.push("");
  }

  lines.push("## Characters");
  lines.push(
    mdList(
      bible.characterIndex.map((c) => `**${c.name}**: ${c.trackNumbers.length === 1 ? "track" : "tracks"} ${c.trackNumbers.join(", ")}`),
      "No characters tagged yet.",
    ),
  );
  lines.push("");

  return lines.join("\n");
}
