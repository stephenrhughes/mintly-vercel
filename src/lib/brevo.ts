import "server-only";

// The Brevo marketing list (Q7, SYS-09), ported from mintly-web
// register/src/brevoHelpers.js. Without BREVO_API_KEY every call is a
// logged no-op, so local and preview deployments never touch the real list.

const API = "https://api.brevo.com/v3";

type Env = Record<string, string | undefined>;

function config(env: Env = process.env) {
  const key = env.BREVO_API_KEY?.trim();
  const listId = Number.parseInt(env.BREVO_LIST_ID ?? "", 10);
  return key && Number.isInteger(listId) ? { key, listId } : null;
}

async function call(path: string, init: RequestInit, okStatuses: number[] = []) {
  const settings = config();
  if (!settings) {
    console.info(`[brevo] skipped (BREVO_API_KEY or BREVO_LIST_ID unset): ${init.method} ${path}`);
    return;
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "api-key": settings.key,
      "content-type": "application/json",
      accept: "application/json",
    },
  });
  if (!response.ok && !okStatuses.includes(response.status)) {
    throw new Error(`Brevo ${init.method} ${path} failed with ${response.status}`);
  }
}

/** PROV-02: add a new customer to the marketing list (unless they opted out; the caller checks). */
export async function addContact(email: string) {
  const settings = config();
  await call("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      listIds: settings ? [settings.listId] : [],
      updateEnabled: true,
      attributes: { MINTLY_STATUS: "Trialing" },
    }),
  });
}

/** PROV-04: the trial has converted to a paid plan. */
export async function markTrialConverted(email: string) {
  await call(
    `/contacts/${encodeURIComponent(email)}`,
    { method: "PUT", body: JSON.stringify({ attributes: { MINTLY_STATUS: "Subscribed" } }) },
    [404],
  );
}

/** PROV-06, PROV-07: a customer who is leaving is deleted from Brevo, as today. */
export async function removeFromList(email: string) {
  await call(`/contacts/${encodeURIComponent(email)}`, { method: "DELETE" }, [404]);
}

/**
 * LEAD-02: someone asked for the BACS checklist on /links. They go on the
 * lead list (BREVO_LEAD_LIST_ID, list 9 on the old site) with PDF_STATUS
 * set, which Brevo's automation uses to send the PDF.
 */
export async function addLead(email: string, name: string, env: Env = process.env) {
  const listId = Number.parseInt(env.BREVO_LEAD_LIST_ID ?? "", 10);
  await call(
    "/contacts",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        listIds: Number.isInteger(listId) ? [listId] : [],
        updateEnabled: true,
        attributes: { PDF_STATUS: "Downloaded", FULLNAME: name },
      }),
    },
    [204],
  );
}
