import type { AlbumBible } from "@/server/bible";
import { buildMotifCharacterGraph } from "@/server/bible-relationships";

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

export function buildBibleMarkdown(bible: AlbumBible) {
  const lines: string[] = [];

  lines.push(`# ${bible.title}`);
  if (bible.artist) lines.push(`**Artist:** ${bible.artist}`);
  if (bible.primaryGenre) lines.push(`**Genre:** ${bible.primaryGenre}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Logline");
  lines.push(bible.conceptSummary?.trim() ? lineWrap(bible.conceptSummary) : "_No concept summary set._");
  lines.push("");

  lines.push("## Album Themes");
  lines.push(mdList(bible.centralThemes, "_No album-level themes set._"));
  lines.push("");

  lines.push("## Recurring Motifs");
  lines.push(mdList(bible.recurringMotifs, "_No album-level motifs set._"));
  lines.push("");

  const warnings = bible.issues.filter((i) => i.level === "warn");
  const infos = bible.issues.filter((i) => i.level === "info");

  lines.push("## Issues");
  if (!warnings.length && !infos.length) {
    lines.push("_No issues detected._");
  } else {
    if (warnings.length) {
      lines.push("### Warnings");
      for (const issue of warnings) {
        lines.push(`- **${issue.title}**: ${issue.detail}`);
      }
      lines.push("");
    }
    if (infos.length) {
      lines.push("### Info");
      for (const issue of infos) {
        lines.push(`- **${issue.title}**: ${issue.detail}`);
      }
    }
  }
  lines.push("");

  const graph = buildMotifCharacterGraph(bible, { maxCharacters: 16, maxMotifs: 16, minEdgeWeight: 1 });
  lines.push("## Relationship Map (Characters x Motifs)");
  if (!graph.edges.length) {
    lines.push("_No relationships found (tag characters and motifs per track)._");
  } else {
    for (const edge of graph.edges.slice(0, 60)) {
      lines.push(`- **${edge.character}** ↔ **${edge.motif}** (tracks: ${edge.trackNumbers.join(", ")})`);
    }
    if (graph.edges.length > 60) {
      lines.push("");
      lines.push(`_…${graph.edges.length - 60} more_`);
    }
  }
  lines.push("");

  lines.push("## Timeline");
  lines.push(
    `_Mode: ${
      bible.timeline.mode === "chronological" ? "chronological_order" : "track_number"
    }_`,
  );
  lines.push("");

  for (const track of bible.timeline.tracks) {
    lines.push(`### Track ${track.trackNumber}: ${track.title}`);
    if (typeof track.chronologicalOrder === "number") {
      lines.push(`- **Chronological order:** ${track.chronologicalOrder}`);
    }
    lines.push(`- **Narrative summary:** ${track.narrativeSummary?.trim() ? track.narrativeSummary.trim() : "_missing_"}`);
    lines.push(`- **Themes:** ${track.themes.length ? track.themes.join(", ") : "_none_"}`);
    lines.push(`- **Motifs:** ${track.motifs.length ? track.motifs.join(", ") : "_none_"}`);
    lines.push(`- **Characters:** ${track.characters.length ? track.characters.join(", ") : "_none_"}`);
    if (track.sections.length) {
      lines.push("");
      lines.push("Sections:");
      for (const section of track.sections) {
        const parts: string[] = [];
        parts.push(`${section.sectionType} #${section.order + 1}`);
        if (section.narrativeFunction) parts.push(`role: ${section.narrativeFunction}`);
        if (section.emotionalArc) parts.push(`arc: ${section.emotionalArc}`);
        if (section.chordCount) parts.push(`${section.chordCount} chords`);
        lines.push(`- ${parts.join(" · ")}`);
      }
    }
    lines.push("");
  }

  lines.push("## Character Index");
  if (!bible.characterIndex.length) lines.push("_No characters tagged._");
  else {
    for (const c of bible.characterIndex) {
      lines.push(`- **${c.name}**: ${c.trackNumbers.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## Motif Index");
  if (!bible.motifIndex.length) lines.push("_No motifs tagged._");
  else {
    for (const m of bible.motifIndex) {
      lines.push(`- **${m.name}**: ${m.trackNumbers.join(", ")}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

