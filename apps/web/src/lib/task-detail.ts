// A task made from a comment takes the comment's first line as its title (cut at 90 characters)
// and keeps the whole comment as its body. Shown together, the title would be read twice; this
// is what the body adds beneath the title, or null when it adds nothing.

const ELLIPSIS = "…";

function squash(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function taskDetail(title: string, body: string | null | undefined): string | null {
  const fullBody = body?.trim() ?? "";
  if (!fullBody) return null;
  const heading = squash(title);
  const cut = heading.endsWith(ELLIPSIS);
  const shown = cut ? heading.slice(0, -ELLIPSIS.length).trimEnd() : heading;
  const flatBody = squash(fullBody);
  if (!shown || flatBody === shown) return shown ? null : fullBody;
  if (!flatBody.startsWith(shown)) return fullBody;

  // The body starts with the title: keep only what follows it, from the body itself so its
  // line breaks survive. Walk the body until as many non-space characters as the title holds
  // have gone by.
  const needed = shown.replace(/\s/g, "").length;
  let seen = 0;
  let index = 0;
  while (index < fullBody.length && seen < needed) {
    if (!/\s/.test(fullBody[index])) seen += 1;
    index += 1;
  }
  if (!fullBody.slice(index).trim()) return null;
  // A title cut inside a word ("…the lamp and t…") continues from the start of that word, so
  // the detail never opens on a fragment ("…the water", not "…he water").
  if (cut) {
    const inWord = (i: number) => i >= 0 && i < fullBody.length && !/\s/.test(fullBody[i]);
    while (index > 0 && inWord(index - 1) && inWord(index)) index -= 1;
  }
  const rest = fullBody.slice(index).trim();
  // A title cut mid-line continues where it stopped.
  return cut ? `${ELLIPSIS}${rest}` : rest;
}
