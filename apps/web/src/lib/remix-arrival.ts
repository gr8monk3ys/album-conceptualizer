// The remix arrival contract: after a remix, Discover and share links open the new album's
// Studio with `?remixed=1`, and the Studio reads it to say what just happened in one line
// ("Remixed into your workspace · 45 credits left").

/** The search parameter the Studio reads; its value is always "1". */
export const REMIX_ARRIVAL_PARAM = "remixed";

/** Where a successful remix lands: the new album's Studio, marked as a fresh remix. */
export function remixArrivalHref(albumId: string) {
  return `/app/albums/${encodeURIComponent(albumId)}/studio?${REMIX_ARRIVAL_PARAM}=1`;
}
