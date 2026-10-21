/**
 * Names for the versions a restore saves on its own. Restoring a version first keeps the draft
 * it replaces, as a version called "Before restoring <what was restored>". Restoring one of
 * those auto-saved versions must not nest the name ("Before restoring Before restoring …"), so
 * such a version is named by when it was saved instead, which the Versions list shows in the
 * viewer's own terms ("Before restoring the version from 3 days ago").
 */

export const BEFORE_RESTORING = "Before restoring ";

/** Version messages are capped at this many characters (the Save version field's maxLength). */
export const VERSION_MESSAGE_MAX = 200;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/**
 * The message for the version a restore saves first. `restoring` is the version being
 * restored: its own name when the artist gave it one, otherwise (unnamed, or itself saved by a
 * restore) the time it was saved.
 */
export function beforeRestoringMessage(restoring: { message: string | null; createdAt: Date }): string {
  const name = restoring.message?.trim();
  const label =
    name && !name.startsWith(BEFORE_RESTORING.trimEnd()) ? name : restoring.createdAt.toISOString();
  return `${BEFORE_RESTORING}${label}`.slice(0, VERSION_MESSAGE_MAX);
}

/** The ISO date in a "Before restoring <ISO date>" message, or null for any other message. */
export function beforeRestoringDate(message: string | null | undefined): string | null {
  if (!message?.startsWith(BEFORE_RESTORING)) return null;
  const rest = message.slice(BEFORE_RESTORING.length);
  return ISO_DATE.test(rest) ? rest : null;
}
