// What a reference is for ("opener", "mix palette"…), as the References form offers it and
// as every page names it. One place for the words, in sentence case like the rest of the UI.

export const REFERENCE_ROLES = [
  "album-world",
  "opener",
  "closer",
  "chorus-energy",
  "vocal-texture",
  "mix-palette",
  "bridge-contrast",
] as const;

export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

/** "Vocal texture": a role as a label or chip, sentence case. */
export function referenceRoleLabel(role: string): string {
  const words = role.split("-").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "opener, closer and vocal texture": roles inside a sentence, lower case. */
export function referenceRoleList(roles: readonly string[]): string {
  const words = roles.map((role) => role.split("-").filter(Boolean).join(" "));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
