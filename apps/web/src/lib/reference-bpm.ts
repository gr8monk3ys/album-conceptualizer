import { TEMPO_MAX, TEMPO_MIN } from "@/lib/tempo";

/**
 * The tempo a reference's BPM is kept in, one definition for the References form and the
 * server that stores it, so the form never accepts what the server then refuses. It is the
 * Studio's track tempo range (`@/lib/tempo`), so the two never disagree.
 */
export const REFERENCE_BPM_MIN = TEMPO_MIN;
export const REFERENCE_BPM_MAX = TEMPO_MAX;

/** The rule as the artist reads it, at the field and in the server's 400. */
export const REFERENCE_BPM_RULE = `BPM is a whole number from ${REFERENCE_BPM_MIN} to ${REFERENCE_BPM_MAX}.`;

/**
 * What's wrong with a typed reference BPM, or null when it is fine (or empty: BPM is optional).
 *
 * While typing (`complete: false`) only what more typing can't fix is flagged: anything but
 * digits ("118.5", "fast"), or a number already above the range ("400"). A number still below
 * it ("1", on the way to "118") waits until the field is left or the form is sent
 * (`complete: true`).
 */
export function referenceBpmProblem(raw: string, { complete }: { complete: boolean }): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return REFERENCE_BPM_RULE;
  const value = Number(text);
  if (value > REFERENCE_BPM_MAX) return REFERENCE_BPM_RULE;
  if (complete && value < REFERENCE_BPM_MIN) return REFERENCE_BPM_RULE;
  return null;
}
