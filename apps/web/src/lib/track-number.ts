import { andList } from "@/lib/and-list";

/** A track number as the spine and the Story bible print it: two figures ("01", "12"). */
export function trackCode(trackNumber: number): string {
  return String(trackNumber).padStart(2, "0");
}

/** "01", "01 and 04", "01, 04, and 07": track numbers in running text. */
export function trackCodes(trackNumbers: readonly number[]): string {
  return andList(trackNumbers.map(trackCode));
}
