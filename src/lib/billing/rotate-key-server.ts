import "server-only";

import { KeyRotatedEmail, keyRotatedSubject } from "@/emails/plan-change";
import { apiKeyStore, disableKey } from "@/lib/aws/apiKeys";
import { sendEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/hosts";
import { getDeploymentEnvironment } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/admin";

import type { RotateKeyDeps } from "./rotate-key";
import { createSupabaseBillingStore } from "./store-supabase";

export function rotateKeyDeps(): RotateKeyDeps {
  const db = createServiceClient();
  const store = createSupabaseBillingStore(db);
  return {
    db,
    keys: { createKey: (input) => apiKeyStore().createKey(input), disableKey },
    lock: { tryLock: (key) => store.tryLock(key), releaseLock: (key) => store.releaseLock(key) },
    async notifyOwner({ orgId, orgName, rotatedBy, oldKeyUntil }) {
      const owner = await store.getOwner(orgId);
      if (!owner) return;
      await sendEmail({
        to: owner.email,
        subject: keyRotatedSubject,
        react: KeyRotatedEmail({
          orgName,
          rotatedBy,
          oldKeyUntil,
          subscriptionUrl: appUrl("/subscription"),
        }),
      });
    },
    keyTags: { platform: "v2", env: getDeploymentEnvironment() },
  };
}
