/**
 * Break points for long words, so a title too wide for its column breaks with a hyphen
 * ("Extraor-dinarily") instead of anywhere without one ("Extraordinar|ily"). `hyphens: auto`
 * needs the browser's hyphenation dictionary for the language, which Chromium on Linux and
 * Android lacks, so it gave no hyphen there; a soft hyphen (U+00AD) is honoured everywhere,
 * shows only where the line actually breaks, and is skipped by find-in-page and screen readers.
 *
 * The break points follow two plain English syllable rules, never leaving fewer than three
 * letters before a break or four after it: between a vowel and a consonant followed by a vowel ("Congre-
 * gations"), and between two consonants that sit between vowels ("Extraor-dinarily"). Pairs
 * that sound as one ("ph", "th", "ch"…) are never split, and a title already carrying a soft
 * hyphen is left as it is.
 */
export const SOFT_HYPHEN = "\u00ad";

const VOWEL = /[aeiouyàáâäãåèéêëìíîïòóôöõùúûüý]/i;
const LETTER = /\p{L}/u;
const DIGRAPHS = new Set(["ph", "th", "ch", "sh", "gh", "wh", "ck", "qu", "ng"]);
/** Words shorter than this always fit: the card and header sizes hold eight letters whole. */
const MIN_WORD = 8;
const MIN_PART = 3;
/** A word's last piece keeps four letters, so an ending ("-res", "-ly") never stands alone. */
const MIN_END = 4;

const isVowel = (char: string | undefined) => Boolean(char && VOWEL.test(char));
const isConsonant = (char: string | undefined) => Boolean(char && LETTER.test(char) && !VOWEL.test(char));

function hyphenateWord(word: string): string {
  const letters = Array.from(word);
  if (letters.length < MIN_WORD || !letters.every((char) => LETTER.test(char))) return word;
  const breaks = new Set<number>();
  for (let i = MIN_PART; i <= letters.length - MIN_END; i += 1) {
    const prev = letters[i - 1];
    const here = letters[i];
    const next = letters[i + 1];
    const pair = `${here}${next ?? ""}`.toLowerCase();
    // V-CV, with a sounded pair kept whole: "Sema-phores", "Congre-gations".
    if (isVowel(prev) && isConsonant(here) && (isVowel(next) || (DIGRAPHS.has(pair) && isVowel(letters[i + 2])))) {
      breaks.add(i);
      continue;
    }
    // VC-CV, unless the two consonants sound as one: "Extraor-dinarily", "win-dows".
    const before = `${prev}${here}`.toLowerCase();
    if (isVowel(letters[i - 2]) && isConsonant(prev) && isConsonant(here) && isVowel(next) && !DIGRAPHS.has(before)) {
      breaks.add(i);
    }
  }
  // Break points too close together make fragments nobody reads as a word: keep them apart.
  let last = 0;
  let out = "";
  letters.forEach((char, index) => {
    if (breaks.has(index) && index - last >= MIN_PART && letters.length - index >= MIN_END) {
      out += SOFT_HYPHEN;
      last = index;
    }
    out += char;
  });
  return out;
}

/** `text` with soft hyphens in its long words; short words, numbers and hyphenated words stay. */
export function softHyphens(text: string): string {
  if (text.includes(SOFT_HYPHEN)) return text;
  return text.replace(/[\p{L}]+/gu, (word) => hyphenateWord(word));
}
