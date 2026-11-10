// A price's display name (SUB-01): the tier's name for self-serve prices,
// otherwise the price's nickname. Pure, for pages that already hold the price.

import { isPlanTier, PLANS } from "./plans";
import { type PriceLike, priceMeta } from "./subscription-record";

export function planLabel(price: PriceLike & { nickname?: string | null }): string {
  const meta = priceMeta(price);
  if (meta.product === "eiscd") return price.nickname ?? "EISCD data file";
  if (isPlanTier(meta.tier)) return PLANS[meta.tier].name;
  return price.nickname ?? "Custom plan";
}
