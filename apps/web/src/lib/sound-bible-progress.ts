/**
 * How much of the Sound bible is set, in the one wording every surface uses (the One Term Rule):
 * "3 of 9 fields set". "Fields", never "sections" (a Section is part of a song) or "parts".
 */
export function soundBibleFieldsSet(filled: number, total: number) {
  return `${filled} of ${total} ${total === 1 ? "field" : "fields"} set`;
}
