// The EISCD spec documents, bundled at build time for the server summary.
import monthlyV2 from "../../../../public/assets/eiscd-openapi-monthly-v2.json";
import weeklyV2 from "../../../../public/assets/eiscd-openapi-weekly-v2.json";
import weeklyV1 from "../../../../public/assets/eiscd-openapi.json";

export const EISCD_DOCUMENTS: Record<string, object> = {
  "eiscd-openapi-weekly-v2": weeklyV2,
  "eiscd-openapi": weeklyV1,
  "eiscd-openapi-monthly-v2": monthlyV2,
};
