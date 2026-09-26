// The Studio writes where the writer is into its own address (?song=N&sid=…) as they move. A
// layout refresh (after a save that changes the album's frame) re-renders the page from the
// address as it was when the refresh started, so its props can name a track the writer has
// since left. Those props only echo the Studio's own address back, and must not move the
// selection; a link the writer followed must.

/** A selection as the page's props carry it (`?song=&section=&sid=&focus=`). */
export type AddressSelection = { song?: string; section?: string; sid?: string; focus?: string };

/** The part of an address that says where the writer is: the track and the section. */
export function addressKey(song: string | null | undefined, sid: string | null | undefined): string {
  return `${song ?? ""}|${sid ?? ""}`;
}

/** Enough for any number of refreshes in flight at once. */
const REMEMBERED = 50;

/** The addresses this Studio wrote, oldest first. */
export class OwnAddresses {
  private written: string[] = [];

  /** The Studio put this address in the URL (or found it there already). */
  wrote(key: string) {
    if (this.written.at(-1) === key) return;
    this.written.push(key);
    if (this.written.length > REMEMBERED) this.written.shift();
  }

  /**
   * Whether `selection` only echoes an address the Studio wrote, so the track on screen stays.
   * A link that carries a one-shot `focus` or `section` is never an echo: the Studio drops
   * those from its address, so only a link the writer followed has them. Once props echo an
   * address, the ones written before it are forgotten: later props never go back past it.
   */
  isEcho(selection: AddressSelection): boolean {
    if (selection.focus || selection.section) return false;
    const at = this.written.lastIndexOf(addressKey(selection.song, selection.sid));
    if (at < 0) return false;
    this.written.splice(0, at);
    return true;
  }
}
