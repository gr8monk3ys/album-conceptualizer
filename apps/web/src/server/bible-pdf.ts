import PDFDocument from "pdfkit";

import type { AlbumBible } from "@/server/bible";
import { buildMotifCharacterGraph } from "@/server/bible-relationships";

function sanitizeFilename(value: string) {
  return value.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "bible";
}

type TextBlockOpts = {
  size?: number;
  color?: string;
  spacing?: number;
};

function writeHeading(doc: PDFKit.PDFDocument, text: string, opts?: TextBlockOpts) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold");
  doc.fontSize(opts?.size ?? 14);
  if (opts?.color) doc.fillColor(opts.color);
  else doc.fillColor("#111111");
  doc.text(text, { align: "left" });
  doc.fillColor("#111111");
  doc.font("Helvetica");
  doc.fontSize(11);
  doc.moveDown((opts?.spacing ?? 0.3) as number);
}

function writeParagraph(doc: PDFKit.PDFDocument, text: string, opts?: TextBlockOpts) {
  doc.font("Helvetica");
  doc.fontSize(opts?.size ?? 11);
  if (opts?.color) doc.fillColor(opts.color);
  else doc.fillColor("#222222");
  doc.text(text, { align: "left" });
  doc.fillColor("#111111");
  doc.moveDown((opts?.spacing ?? 0.3) as number);
}

function writeBullets(doc: PDFKit.PDFDocument, items: string[], opts?: { indent?: number }) {
  const indent = opts?.indent ?? 18;
  for (const item of items) {
    doc.text(`• ${item}`, { indent, continued: false });
  }
  doc.moveDown(0.3);
}

export async function buildBiblePdfBuffer(bible: AlbumBible) {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 54,
    info: {
      Title: `${bible.title} — Album Bible`,
      Author: bible.artist ?? undefined,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (d: Buffer) => chunks.push(d));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Cover
  doc.font("Helvetica-Bold");
  doc.fontSize(24);
  doc.fillColor("#111111");
  doc.text(bible.title, { align: "left" });
  doc.font("Helvetica");
  doc.fontSize(12);
  doc.fillColor("#444444");
  doc.text(
    [bible.artist ? `by ${bible.artist}` : null, bible.primaryGenre ? bible.primaryGenre : null]
      .filter(Boolean)
      .join(" · ") || "Album bible",
  );
  doc.fillColor("#444444");
  doc.moveDown(0.2);
  doc.fontSize(10);
  doc.text(`Generated ${new Date().toLocaleString()}`);

  doc.moveDown(1.2);

  writeHeading(doc, "Logline", { size: 14 });
  writeParagraph(
    doc,
    bible.conceptSummary?.trim() || "No concept summary set. Add one in Studio to anchor this bible.",
  );

  writeHeading(doc, "Album Themes", { size: 14 });
  if (bible.centralThemes.length) writeBullets(doc, bible.centralThemes);
  else writeParagraph(doc, "No album-level themes set.", { color: "#555555" });

  writeHeading(doc, "Recurring Motifs", { size: 14 });
  if (bible.recurringMotifs.length) writeBullets(doc, bible.recurringMotifs);
  else writeParagraph(doc, "No album-level motifs set.", { color: "#555555" });

  writeHeading(doc, "Voice / Style Bible", { size: 14 });
  writeParagraph(
    doc,
    bible.styleBible.lead_voice?.trim() || "No lead voice brief set.",
    { color: bible.styleBible.lead_voice ? "#222222" : "#555555" },
  );
  if (bible.styleBible.narrator_perspective) {
    writeParagraph(doc, `Narrator perspective: ${bible.styleBible.narrator_perspective}`, {
      color: "#555555",
      size: 10,
      spacing: 0.2,
    });
  }
  const styleLines = [
    bible.styleBible.vocal_attributes.length
      ? `Vocal attributes: ${bible.styleBible.vocal_attributes.join(", ")}`
      : null,
    bible.styleBible.sonic_palette.length
      ? `Sonic palette: ${bible.styleBible.sonic_palette.join(", ")}`
      : null,
    bible.styleBible.arrangement_rules.length
      ? `Arrangement rules: ${bible.styleBible.arrangement_rules.join(", ")}`
      : null,
    bible.styleBible.mix_priorities.length
      ? `Mix priorities: ${bible.styleBible.mix_priorities.join(", ")}`
      : null,
    bible.styleBible.avoid_list.length ? `Avoid list: ${bible.styleBible.avoid_list.join(", ")}` : null,
    bible.styleBible.emotional_targets.length
      ? `Emotional targets: ${bible.styleBible.emotional_targets.join(", ")}`
      : null,
  ].filter((line): line is string => Boolean(line));
  if (styleLines.length) writeBullets(doc, styleLines);
  else writeParagraph(doc, "No style constraints or palette anchors set.", { color: "#555555" });
  if (bible.styleBible.reference_strategy) {
    writeParagraph(doc, `Reference strategy: ${bible.styleBible.reference_strategy}`, {
      color: "#555555",
      size: 10,
    });
  }

  const warnings = bible.issues.filter((i) => i.level === "warn");
  const infos = bible.issues.filter((i) => i.level === "info");

  writeHeading(doc, "Issues", { size: 14 });
  if (!warnings.length && !infos.length) {
    writeParagraph(doc, "No issues detected.", { color: "#555555" });
  } else {
    if (warnings.length) {
      writeHeading(doc, "Warnings", { size: 12, color: "#a40034" });
      writeBullets(doc, warnings.map((w) => `${w.title}: ${w.detail}`));
    }
    if (infos.length) {
      writeHeading(doc, "Info", { size: 12, color: "#333333" });
      writeBullets(doc, infos.map((i) => `${i.title}: ${i.detail}`));
    }
  }

  // Relationship map
  const graph = buildMotifCharacterGraph(bible, { maxCharacters: 18, maxMotifs: 18, minEdgeWeight: 1 });
  writeHeading(doc, "Relationships (Characters x Motifs)", { size: 14 });
  if (!graph.edges.length) {
    writeParagraph(doc, "No relationships found. Tag characters and motifs per track to visualize ties.", {
      color: "#555555",
    });
  } else {
    writeBullets(
      doc,
      graph.edges.slice(0, 50).map((e) => `${e.character} ↔ ${e.motif} (tracks: ${e.trackNumbers.join(", ")})`),
    );
    if (graph.edges.length > 50) {
      writeParagraph(doc, `…${graph.edges.length - 50} more`, { color: "#555555" });
    }
  }

  // Timeline / tracks
  doc.addPage();
  writeHeading(doc, "Timeline", { size: 16 });
  writeParagraph(
    doc,
    `Mode: ${bible.timeline.mode === "chronological" ? "chronological_order" : "track_number"}`,
    { color: "#555555" },
  );

  for (const track of bible.timeline.tracks) {
    writeHeading(doc, `Track ${track.trackNumber}: ${track.title}`, { size: 13 });
    if (typeof track.chronologicalOrder === "number") {
      writeParagraph(doc, `Chronological order: ${track.chronologicalOrder}`, { color: "#555555" });
    }
    writeParagraph(doc, track.narrativeSummary?.trim() || "Narrative summary missing.", { spacing: 0.2 });

    const tags: string[] = [];
    if (track.themes.length) tags.push(`Themes: ${track.themes.join(", ")}`);
    if (track.motifs.length) tags.push(`Motifs: ${track.motifs.join(", ")}`);
    if (track.characters.length) tags.push(`Characters: ${track.characters.join(", ")}`);
    if (tags.length) writeParagraph(doc, tags.join(" · "), { color: "#555555", size: 10, spacing: 0.2 });

    if (track.sections.length) {
      const sectionLines = track.sections.map((s) => {
        const parts: string[] = [];
        parts.push(`${s.sectionType} #${s.order + 1}`);
        if (s.narrativeFunction) parts.push(`role: ${s.narrativeFunction}`);
        if (s.emotionalArc) parts.push(`arc: ${s.emotionalArc}`);
        if (s.chordCount) parts.push(`${s.chordCount} chords`);
        return parts.join(" · ");
      });
      writeBullets(doc, sectionLines, { indent: 12 });
    } else {
      writeParagraph(doc, "No sections.", { color: "#777777", size: 10 });
    }
  }

  // Indices
  doc.addPage();
  writeHeading(doc, "Character Index", { size: 16 });
  if (!bible.characterIndex.length) writeParagraph(doc, "No characters tagged.", { color: "#555555" });
  else writeBullets(doc, bible.characterIndex.map((c) => `${c.name}: ${c.trackNumbers.join(", ")}`), { indent: 12 });

  writeHeading(doc, "Motif Index", { size: 16 });
  if (!bible.motifIndex.length) writeParagraph(doc, "No motifs tagged.", { color: "#555555" });
  else writeBullets(doc, bible.motifIndex.map((m) => `${m.name}: ${m.trackNumbers.join(", ")}`), { indent: 12 });

  doc.end();
  const buffer = await done;
  const filename = sanitizeFilename(`${bible.title}_album_bible`) + ".pdf";
  return { buffer, filename };
}
