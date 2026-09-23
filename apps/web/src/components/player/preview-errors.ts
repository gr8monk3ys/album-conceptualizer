// What went wrong with a preview, in the artist's words: what failed and what to do next.
// Pure; no React, no audio.

export type PreviewInstrument = "piano" | "epiano" | "strings" | "pad";

export const INSTRUMENT_LABELS: Record<PreviewInstrument, string> = {
  piano: "Piano",
  epiano: "Electric piano",
  strings: "Strings",
  pad: "Pad",
};

/**
 * Where a preview failed:
 * - `audio`: the in-browser audio player (loaded on the first preview) didn't load;
 * - `file`: the rendered preview came back but couldn't be read;
 * - `instrument`: the instrument's sounds (fetched from an online sound library) didn't load;
 * - `offline`: the server couldn't be reached to render the chords.
 */
export type PreviewFailure = "audio" | "file" | "instrument" | "offline";

/** A preview that failed at a known step; the message is written for the artist. */
export class PreviewError extends Error {
  readonly failure: PreviewFailure;
  constructor(failure: PreviewFailure, instrument: PreviewInstrument = "piano") {
    super(previewFailureMessage(failure, instrument));
    this.name = "PreviewError";
    this.failure = failure;
  }
}

/** Used when nothing better is known. Still names the next step. */
export const PREVIEW_FAILED_MESSAGE = "Couldn't play this preview. Retry in a moment.";

export function previewFailureMessage(failure: PreviewFailure, instrument: PreviewInstrument = "piano"): string {
  switch (failure) {
    case "instrument":
      return `Couldn't play this preview: the ${INSTRUMENT_LABELS[instrument].toLowerCase()} sounds didn't load. They come from an online sound library, so check your connection, then retry.`;
    case "audio":
      return "Couldn't play this preview: the audio player didn't load in this browser. Check your connection, then retry.";
    case "file":
      return "Couldn't play this preview: the rendered file couldn't be read. Retry; if it keeps failing, change a chord and preview again.";
    case "offline":
      return "Couldn't render this preview: the server can't be reached. Check your connection, then retry.";
  }
}

/** When an instrument switch fails, the preview keeps playing on the previous one. */
export function instrumentSwitchMessage(wanted: PreviewInstrument, kept: PreviewInstrument): string {
  return `The ${INSTRUMENT_LABELS[wanted].toLowerCase()} sounds didn't load, so the preview stays on ${INSTRUMENT_LABELS[kept].toLowerCase()}. Check your connection, then pick it again.`;
}

/** The artist-facing message for anything a preview load threw. */
export function previewErrorMessage(err: unknown): string {
  return err instanceof PreviewError ? err.message : PREVIEW_FAILED_MESSAGE;
}
