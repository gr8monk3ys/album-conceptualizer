// How a Studio save reaches the server. Saves go with keepalive when they can, so one on its
// way survives a reload or a closed tab. The browser gives a page 64 KiB of keepalive bodies in
// flight, all together, and refuses any keepalive request past that (a TypeError, the same as
// being offline). So a routine save only takes keepalive when a last-chance save of the largest
// keepalive size still fits beside it, and whatever keepalive can't carry goes without it.

/** The browser's keepalive budget per page: bodies in flight, all together (Fetch spec). */
export const KEEPALIVE_BUDGET = 65_536;

/**
 * The largest body sent with keepalive: two of them (a save in flight and the last-chance save
 * sent as the page goes) fit in the budget together, with room to spare.
 */
export const KEEPALIVE_BODY_LIMIT = 32_000;

/** A request body's size as the browser counts it: UTF-8 bytes, not UTF-16 units. */
export function bodyBytes(body: string): number {
  return new TextEncoder().encode(body).length;
}

/** A routine save (autosave, Save now, a version) or the last-chance save as the page goes. */
export type SaveKind = "routine" | "last-chance";

/** The keepalive bytes this page has in flight, and whether another request may join them. */
export class KeepaliveBudget {
  private used = 0;

  constructor(
    readonly total = KEEPALIVE_BUDGET,
    readonly limit = KEEPALIVE_BODY_LIMIT,
  ) {}

  get inFlight() {
    return this.used;
  }

  /**
   * Take room for a body of `bytes`, or false when it has to go without keepalive. A routine
   * save leaves room for a last-chance save of the largest size beside it; the last-chance save
   * takes whatever room is left.
   */
  take(bytes: number, kind: SaveKind): boolean {
    if (bytes > this.limit) return false;
    const reserve = kind === "routine" ? this.limit : 0;
    if (this.used + bytes + reserve > this.total) return false;
    this.used += bytes;
    return true;
  }

  /** The request that took `bytes` has finished. */
  give(bytes: number) {
    this.used = Math.max(0, this.used - bytes);
  }
}

/** One budget for the page, as the browser keeps it. */
export const pageKeepaliveBudget = new KeepaliveBudget();

/** The Studio's save request body: the whole album, and a version note for "Save version…". */
export function albumPatchBody(album: unknown, versionMessage?: string): string {
  return JSON.stringify({ album, versionMessage });
}

export type AlbumPatch = {
  /** Whether it went with keepalive (and so outlives the page); false once it was refused. */
  keepalive: () => boolean;
  /** The server's response. Rejects (TypeError) only when the server can't be reached. */
  response: Promise<Response>;
};

/**
 * PATCH the album: with keepalive when the budget allows, otherwise without. A keepalive
 * request the browser still refuses (another one on the page took the room) is sent again
 * without keepalive, so a refusal is never mistaken for the server being out of reach.
 */
export function sendAlbumPatch(
  albumId: string,
  body: string,
  kind: SaveKind,
  { budget = pageKeepaliveBudget, fetcher = fetch }: { budget?: KeepaliveBudget; fetcher?: typeof fetch } = {},
): AlbumPatch {
  const url = `/api/albums/${albumId}`;
  const init: RequestInit = { method: "PATCH", headers: { "content-type": "application/json" }, body };
  // Called at once, never on a later task: this may run as the page goes away.
  const send = (withKeepalive: boolean) => {
    try {
      return fetcher(url, withKeepalive ? { ...init, keepalive: true } : init);
    } catch (error) {
      return Promise.reject(error);
    }
  };
  const bytes = bodyBytes(body);
  let keepalive = budget.take(bytes, kind);
  if (!keepalive) return { keepalive: () => false, response: send(false) };

  const response = send(true).then(
    (result) => {
      budget.give(bytes);
      return result;
    },
    () => {
      budget.give(bytes);
      keepalive = false;
      return send(false);
    },
  );
  return { keepalive: () => keepalive, response };
}
