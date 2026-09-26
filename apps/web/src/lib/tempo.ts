/**
 * One tempo range for the whole app: a track's tempo in the Studio and a reference's BPM both
 * read 20–300 bpm, so a tempo the artist can set in one place is never refused in the other.
 */
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;

/** The tempo the create wizard gives every track, and the one the Coherence report treats as unset. */
export const SETUP_TEMPO = 120;
