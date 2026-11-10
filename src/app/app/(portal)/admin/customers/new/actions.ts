"use server";

import type { ActionState } from "@/components/admin/ui";
import { adminAction, formText } from "@/lib/admin/action";
import { setUpCustomer } from "@/lib/admin/customer-setup";
import { readPriceChoice } from "@/lib/admin/price-form";
import { customerSetupDeps } from "@/lib/admin/setup-server";

// Set up a customer (ADM-12, plan §6.7).

export type SetupState = ActionState & { orgId?: string };

const int = (formData: FormData, name: string, fallback = 0) => {
  const text = formText(formData, name, 20);
  return text === "" ? fallback : Number(text);
};

export async function setUpCustomerAction(
  _state: SetupState,
  formData: FormData,
): Promise<SetupState> {
  let orgId: string | undefined;
  const state = await adminAction("/admin/customers/new", async (admin) => {
    const result = await setUpCustomer(
      customerSetupDeps(admin),
      {
        orgName: formText(formData, "orgName", 200),
        ownerEmail: formText(formData, "ownerEmail", 254),
        price: readPriceChoice(formData),
        billing: formText(formData, "billing") === "card" ? "card" : "invoice",
        daysUntilDue: int(formData, "daysUntilDue", 30),
        mandateId: formText(formData, "mandateId", 40).toUpperCase() || null,
        extraUsers: int(formData, "extraUsers"),
        trialDays: int(formData, "trialDays"),
        nonce: formText(formData, "nonce", 40),
      },
      admin.id,
    );
    orgId = result.orgId;
    return result.ok
      ? { message: result.message, warnings: result.warnings }
      : { error: result.error };
  });
  return { ...state, orgId };
}
