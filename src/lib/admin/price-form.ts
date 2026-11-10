import { formText } from "./action";
import type { PriceChoice } from "./customer-setup";

/**
 * The price an admin chose on a form: an existing price, or a new custom
 * one typed in pounds ("1,200.50") and stored in pence (ADM-11, ADM-12).
 */
export function readPriceChoice(formData: FormData): PriceChoice {
  if (formText(formData, "priceKind") === "custom") {
    const pounds = Number(formText(formData, "customAmount", 20).replaceAll(",", ""));
    return {
      kind: "custom",
      basePriceId: formText(formData, "basePriceId", 100),
      unitAmount: Number.isFinite(pounds) ? Math.round(pounds * 100) : Number.NaN,
      interval: formText(formData, "customInterval") === "year" ? "year" : "month",
      nickname: formText(formData, "customName", 100),
    };
  }
  return { kind: "existing", priceId: formText(formData, "priceId", 100) };
}
