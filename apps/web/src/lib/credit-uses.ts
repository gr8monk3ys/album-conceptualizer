import { CREDIT_COSTS } from "@/lib/credit-costs";

export type CreditUse = { key: string; label: string; detail?: string; cost: number; unavailable?: boolean };

/**
 * What credits buy, in the product's own units. "One album, start to handoff" is a worked
 * example (its parts are listed), not a limit: the Studio, the Story bible and the Coherence
 * report never cost credits.
 *
 * The worked example and the cost table. When AI can't run on this server, AI drafts aren't
 * sold: the example leaves them out and the AI row says plainly it isn't available.
 */
export function creditUses(aiAvailable: boolean): { albumPass: number; uses: CreditUse[] } {
  const albumPass =
    CREDIT_COSTS.albumCreate + (aiAvailable ? 2 * CREDIT_COSTS.agentRun : 0) + CREDIT_COSTS.exportZip;
  const passDetail = aiAvailable
    ? `Create it (${CREDIT_COSTS.albumCreate}), two AI drafts (${2 * CREDIT_COSTS.agentRun}), one zip export (${CREDIT_COSTS.exportZip})`
    : `Create it (${CREDIT_COSTS.albumCreate}), one zip export (${CREDIT_COSTS.exportZip})`;
  return {
    albumPass,
    uses: [
      { key: "create", label: "Create an album", cost: CREDIT_COSTS.albumCreate },
      { key: "remix", label: "Remix an album from Discover", cost: CREDIT_COSTS.albumFork },
      {
        key: "ai",
        label: "An AI draft: ideas for a new album, a track, or a written review",
        detail: aiAvailable ? undefined : "Not available on this server right now.",
        cost: CREDIT_COSTS.agentRun,
        unavailable: !aiAvailable,
      },
      { key: "zip", label: "Download the zip export", cost: CREDIT_COSTS.exportZip },
      { key: "pass", label: "One album, start to handoff", detail: passDetail, cost: albumPass },
    ],
  };
}
