import { AlbumJsonSchema } from "@/server/album-json";
import { buildAlbumBible } from "@/server/bible";
import { analyzeAlbumCoherence } from "@/server/coherence";
import type { AlbumReferenceRecord } from "@/server/references";
import { analyzeAlbumRoughDemos } from "@/server/rough-demo-review";
import { getRoughDemoSourceLabel, listAlbumRoughDemos } from "@/server/rough-demos";

export type HandoffTarget = "suno" | "udio" | "daw";

const TARGET_CONFIG: Record<
  HandoffTarget,
  {
    title: string;
    intro: string;
    albumDirective: string;
    trackDirective: string;
  }
> = {
  suno: {
    title: "Suno Generator Brief",
    intro:
      "Use this pack to keep Suno generations aligned to one album world instead of treating each song like a separate prompt.",
    albumDirective:
      "Keep the same singer perspective, palette, and recurring motifs across every render. Treat the prompt lines as structured starting points, then refine per section inside Suno.",
    trackDirective:
      "Start with the prompt line, then preserve the emotional objective, vocal identity, and arrangement notes when iterating section edits.",
  },
  udio: {
    title: "Udio Generator Brief",
    intro:
      "Use this pack to anchor Udio sessions around one recurring voice, style palette, and section map for the album.",
    albumDirective:
      "Carry the same vocal identity and production palette between tracks. Use the section and arrangement notes as guidance when editing or extending in Udio.",
    trackDirective:
      "Use the prompt line as the base idea, then keep the listed references, transitions, and emotional targets intact when extending or replacing sections.",
  },
  daw: {
    title: "DAW Session Notes",
    intro:
      "Use this pack to prep arrangement, recording, and mix decisions before the project hits a DAW session or collaborator handoff.",
    albumDirective:
      "Treat the voice brief, palette, arrangement rules, and mix priorities as non-negotiable defaults for the whole project.",
    trackDirective:
      "Use the session objective and arrangement notes to build the rough first pass before chasing sound-design details.",
  },
};

function sanitizeFilename(value: string) {
  return value.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "handoff_pack";
}

function lineWrap(text: string, max = 96) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;

  const words = trimmed.split(/\s+/g);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= max) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function mdList(values: string[], emptyText = "_none_") {
  if (!values.length) return emptyText;
  return values.map((value) => `- ${value}`).join("\n");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function joinMaybe(values: Array<string | null | undefined>, sep = ", ") {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(sep);
}

function formatRole(role: string | null) {
  if (!role) return "album-wide";
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildReferenceLine(reference: AlbumReferenceRecord) {
  const parts = [
    reference.title,
    reference.artist,
    reference.targetRole ? formatRole(reference.targetRole) : null,
    reference.songTitle && reference.songTrackNumber
      ? `Track ${reference.songTrackNumber}: ${reference.songTitle}`
      : null,
    reference.bpm ? `${reference.bpm} BPM` : null,
    reference.key,
  ];
  return joinMaybe(parts, " · ");
}

function buildGeneratorPrompt(input: {
  albumGenre: string | null;
  conceptSummary: string | null;
  styleLeadVoice: string | null;
  sonicPalette: string[];
  emotionalTargets: string[];
  avoidList: string[];
  song: {
    title: string;
    tempo: number | null | undefined;
    key: string | null | undefined;
    time_signature: string | null | undefined;
    narrative_summary: string | null | undefined;
    themes: string[];
    motifs: string[];
    mood_tags: string[];
    instrumentation: string[];
  };
  references: AlbumReferenceRecord[];
}) {
  const parts = [
    input.albumGenre ?? null,
    input.song.mood_tags.length ? input.song.mood_tags.join(", ") : null,
    input.sonicPalette.length ? input.sonicPalette.join(", ") : null,
    input.song.instrumentation.length ? `instrumentation: ${input.song.instrumentation.join(", ")}` : null,
    input.styleLeadVoice ? `vocal: ${input.styleLeadVoice}` : null,
    input.song.tempo ? `${input.song.tempo} BPM` : null,
    input.song.key ? `key: ${input.song.key}` : null,
    input.song.time_signature ? `time signature: ${input.song.time_signature}` : null,
    input.song.narrative_summary ?? input.conceptSummary ?? null,
    input.song.themes.length ? `themes: ${input.song.themes.join(", ")}` : null,
    input.song.motifs.length ? `motifs: ${input.song.motifs.join(", ")}` : null,
    input.emotionalTargets.length ? `emotion: ${input.emotionalTargets.join(", ")}` : null,
    input.references.length
      ? `references: ${input.references
          .slice(0, 2)
          .map((reference) => joinMaybe([reference.title, reference.artist], " by "))
          .join("; ")}`
      : null,
  ];

  return lineWrap(parts.filter(Boolean).join(". ") + ".", 110);
}

function buildDawObjective(input: {
  title: string;
  narrativeSummary: string | null | undefined;
  themes: string[];
  motifs: string[];
  arrangementRules: string[];
  mixPriorities: string[];
  references: AlbumReferenceRecord[];
}) {
  const lines = [
    input.narrativeSummary ? `Song brief: ${input.narrativeSummary}` : null,
    input.themes.length ? `Theme focus: ${input.themes.join(", ")}` : null,
    input.motifs.length ? `Motif callbacks: ${input.motifs.join(", ")}` : null,
    input.arrangementRules.length ? `Arrangement guardrails: ${input.arrangementRules.join(", ")}` : null,
    input.mixPriorities.length ? `Mix focus: ${input.mixPriorities.join(", ")}` : null,
    input.references.length
      ? `Primary references: ${input.references
          .slice(0, 3)
          .map((reference) => buildReferenceLine(reference))
          .join(" | ")}`
      : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length ? lines.map((line) => `- ${line}`).join("\n") : "- No DAW notes yet.";
}

function formatSectionOrdinal(order: number) {
  return order >= 1 ? order : order + 1;
}

function buildSectionLines(
  sections: Array<{
    section_type: string;
    order: number;
    emotional_arc?: string | null;
    narrative_function?: string | null;
    chord_progression?: string[];
    duration_bars?: number | null;
  }>,
) {
  if (!sections.length) return "_No section map captured yet._";

  return sections
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((section) => {
      const bits = [
        `${section.section_type} #${formatSectionOrdinal(section.order)}`,
        section.narrative_function ?? null,
        section.emotional_arc ?? null,
        section.duration_bars ? `${section.duration_bars} bars` : null,
        Array.isArray(section.chord_progression) && section.chord_progression.length
          ? `chords: ${section.chord_progression.join(" - ")}`
          : null,
      ];
      return `- ${joinMaybe(bits, " · ")}`;
    })
    .join("\n");
}

export function buildHandoffPackMarkdown(input: {
  albumData: unknown;
  references: AlbumReferenceRecord[];
  target: HandoffTarget;
}) {
  const parsed = AlbumJsonSchema.safeParse(input.albumData);
  if (!parsed.success) {
    return "# Handoff Pack\n\nAlbum data is invalid. Re-save the project in Studio and try again.";
  }

  const album = parsed.data;
  const bible = buildAlbumBible(album);
  const coherence = analyzeAlbumCoherence(album);
  const roughDemos = listAlbumRoughDemos(album);
  const roughDemoReviews = analyzeAlbumRoughDemos(album);
  const roughDemoReviewMap = new Map(
    roughDemoReviews.map((review) => [review.demoId, review] as const),
  );
  const config = TARGET_CONFIG[input.target];

  const referencesByTrack = new Map<number, AlbumReferenceRecord[]>();
  const albumWideReferences: AlbumReferenceRecord[] = [];
  for (const reference of input.references) {
    if (reference.songTrackNumber) {
      const current = referencesByTrack.get(reference.songTrackNumber) ?? [];
      current.push(reference);
      referencesByTrack.set(reference.songTrackNumber, current);
    } else {
      albumWideReferences.push(reference);
    }
  }

  const lines: string[] = [];
  lines.push(`# ${album.title} — ${config.title}`);
  if (album.artist) lines.push(`**Artist:** ${album.artist}`);
  if (album.primary_genre) lines.push(`**Primary genre:** ${album.primary_genre}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Handoff objective");
  lines.push(lineWrap(config.intro));
  lines.push("");
  lines.push(lineWrap(config.albumDirective));
  lines.push("");

  lines.push("## Album blueprint");
  lines.push(`- **Concept:** ${album.concept_summary?.trim() || "_missing_"}`);
  lines.push(`- **Narrative structure:** ${album.narrative_structure?.trim() || "_unspecified_"}`);
  lines.push(`- **Central themes:** ${album.central_themes.length ? album.central_themes.join(", ") : "_none_"}`);
  lines.push(
    `- **Recurring motifs:** ${album.recurring_motifs.length ? album.recurring_motifs.join(", ") : "_none_"}`,
  );
  lines.push(`- **Coherence score:** ${coherence.score}/100`);
  lines.push(
    `- **Priority fixes:** ${
      coherence.nextActions.length
        ? coherence.nextActions.slice(0, 3).map((action) => action.title).join(" | ")
        : "No open issues"
    }`,
  );
  lines.push("");

  lines.push("## Voice / style bible");
  lines.push(
    `- **Lead voice:** ${bible.styleBible.lead_voice?.trim() ? bible.styleBible.lead_voice.trim() : "_none_"}`,
  );
  lines.push(
    `- **Narrator perspective:** ${
      bible.styleBible.narrator_perspective?.trim()
        ? bible.styleBible.narrator_perspective.trim()
        : "_none_"
    }`,
  );
  lines.push(
    `- **Vocal attributes:** ${
      bible.styleBible.vocal_attributes.length ? bible.styleBible.vocal_attributes.join(", ") : "_none_"
    }`,
  );
  lines.push(
    `- **Sonic palette:** ${
      bible.styleBible.sonic_palette.length ? bible.styleBible.sonic_palette.join(", ") : "_none_"
    }`,
  );
  lines.push(
    `- **Arrangement rules:** ${
      bible.styleBible.arrangement_rules.length
        ? bible.styleBible.arrangement_rules.join(", ")
        : "_none_"
    }`,
  );
  lines.push(
    `- **Mix priorities:** ${
      bible.styleBible.mix_priorities.length ? bible.styleBible.mix_priorities.join(", ") : "_none_"
    }`,
  );
  lines.push(
    `- **Avoid list:** ${
      bible.styleBible.avoid_list.length ? bible.styleBible.avoid_list.join(", ") : "_none_"
    }`,
  );
  lines.push(
    `- **Emotional targets:** ${
      bible.styleBible.emotional_targets.length
        ? bible.styleBible.emotional_targets.join(", ")
        : "_none_"
    }`,
  );
  if (bible.styleBible.reference_strategy) {
    lines.push(`- **Reference strategy:** ${lineWrap(bible.styleBible.reference_strategy, 108)}`);
  }
  lines.push("");

  lines.push("## Album-wide references");
  if (albumWideReferences.length) {
    lines.push(mdList(albumWideReferences.map((reference) => buildReferenceLine(reference))));
  } else {
    lines.push("_No album-wide references saved._");
  }
  lines.push("");

  lines.push("## Rough demo captures");
  if (roughDemos.length) {
    for (const demo of roughDemos.slice(0, 8)) {
      const review = roughDemoReviewMap.get(demo.id);
      lines.push(
        `- **${demo.title}** · ${getRoughDemoSourceLabel(demo.source_kind)}${
          demo.song_track_number ? ` · Track ${demo.song_track_number}` : " · Album-wide"
        }`,
      );
      if (review) {
        lines.push(`  - Review: ${review.headline}`);
        lines.push(`  - Suggested placement: ${review.suggestedPlacement}`);
        if (review.recommendedTrack) {
          lines.push(
            `  - Track fit: Track ${review.recommendedTrack.trackNumber} · ${review.recommendedTrack.title}`,
          );
        }
      }
      if (demo.capture_notes) lines.push(`  - Capture: ${demo.capture_notes}`);
      if (demo.sonic_traits.length) lines.push(`  - Sonic traits: ${demo.sonic_traits.join(", ")}`);
      if (demo.lyrical_fragments.length) {
        lines.push(`  - Lyrical fragments: ${demo.lyrical_fragments.join(", ")}`);
      }
      if (demo.next_actions.length) lines.push(`  - Next moves: ${demo.next_actions.join(", ")}`);
      if (review?.nextMoves.length) {
        lines.push(`  - Review next moves: ${review.nextMoves.join(", ")}`);
      }
      if (demo.local_file?.name) lines.push(`  - Local file: ${demo.local_file.name}`);
      if (demo.external_url) lines.push(`  - URL: ${demo.external_url}`);
    }
  } else {
    lines.push("_No rough demos saved yet._");
  }
  lines.push("");

  lines.push("## Track briefs");
  lines.push(lineWrap(config.trackDirective));
  lines.push("");

  for (const song of album.songs.slice().sort((left, right) => left.track_number - right.track_number)) {
    const songReferences = referencesByTrack.get(song.track_number) ?? [];
    lines.push(`### Track ${song.track_number}: ${song.title}`);
    lines.push(`- **Narrative summary:** ${normalizeText(song.narrative_summary) || "_missing_"}`);
    lines.push(`- **Tempo / key:** ${joinMaybe([song.tempo ? `${song.tempo} BPM` : null, song.key ?? null], " · ") || "_unset_"}`);
    lines.push(`- **Time signature:** ${normalizeText(song.time_signature) || "_unset_"}`);
    lines.push(`- **Themes:** ${song.themes.length ? song.themes.join(", ") : "_none_"}`);
    lines.push(`- **Motifs:** ${song.motifs.length ? song.motifs.join(", ") : "_none_"}`);
    lines.push(`- **Characters:** ${song.characters.length ? song.characters.join(", ") : "_none_"}`);
    lines.push(
      `- **Track references:** ${
        songReferences.length ? songReferences.map((reference) => buildReferenceLine(reference)).join(" | ") : "_none_"
      }`,
    );
    lines.push("");

    if (input.target === "daw") {
      lines.push("#### Session objective");
      lines.push(
        buildDawObjective({
          title: song.title,
          narrativeSummary: song.narrative_summary,
          themes: song.themes,
          motifs: song.motifs,
          arrangementRules: bible.styleBible.arrangement_rules,
          mixPriorities: bible.styleBible.mix_priorities,
          references: songReferences.length ? songReferences : albumWideReferences,
        }),
      );
    } else {
      lines.push("#### Prompt line");
      lines.push(
        buildGeneratorPrompt({
          albumGenre: album.primary_genre ?? null,
          conceptSummary: album.concept_summary ?? null,
          styleLeadVoice: bible.styleBible.lead_voice,
          sonicPalette: bible.styleBible.sonic_palette,
          emotionalTargets: bible.styleBible.emotional_targets,
          avoidList: bible.styleBible.avoid_list,
          song: {
            title: song.title,
            tempo: song.tempo,
            key: song.key,
            time_signature: song.time_signature,
            narrative_summary: song.narrative_summary,
            themes: song.themes,
            motifs: song.motifs,
            mood_tags: song.mood_tags,
            instrumentation: song.instrumentation,
          },
          references: songReferences.length ? songReferences : albumWideReferences,
        }),
      );
      lines.push("");
      lines.push(
        `**Avoid / negative prompt:** ${
          bible.styleBible.avoid_list.length ? bible.styleBible.avoid_list.join(", ") : "_none_"
        }`,
      );
    }

    lines.push("");
    lines.push("#### Section map");
    lines.push(buildSectionLines(song.sections ?? []));
    lines.push("");
    lines.push("#### Production notes");
    lines.push(normalizeText(song.production_notes) || "_No production notes captured yet._");
    lines.push("");
  }

  lines.push("## Collaboration note");
  lines.push(
    lineWrap(
      input.target === "daw"
        ? "Keep the singer perspective, palette, motif callbacks, and mix priorities consistent between sessions. If a track drifts, update the style bible or references before continuing."
        : "If a generated track drifts from the album voice, update the style bible or references first, then regenerate with the revised prompt line instead of treating the song in isolation.",
    ),
  );
  lines.push("");

  return lines.join("\n");
}

export function getHandoffPackFilename(albumTitle: string, target: HandoffTarget) {
  return `${sanitizeFilename(`${albumTitle}_${target}_handoff_pack`)}.md`;
}
