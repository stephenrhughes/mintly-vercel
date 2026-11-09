import "server-only";

import { NewUserAdminEmail, newUserAdminSubject } from "@/emails/new-user-admin";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { createServiceClient, getServiceKey } from "@/lib/supabase/admin";

// AUTH-07: tell Mintly about a new user once they have confirmed their
// email. Claiming admin_notified_at first makes it happen once per user,
// however many times they confirm or sign in.
export async function notifyAdminOfNewUser(userId: string): Promise<void> {
  if (!getServiceKey()) return;
  try {
    const { data, error } = await createServiceClient()
      .from("profiles")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", userId)
      .is("admin_notified_at", null)
      .select("email, first_name, last_name, company_name")
      .maybeSingle<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
      }>();
    if (error) throw new Error(error.message);
    if (!data) return; // Already sent.

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    await sendEmail({
      to: adminNotifyEmail(),
      subject: newUserAdminSubject(data.email),
      react: NewUserAdminEmail({ email: data.email, name, companyName: data.company_name }),
    });
  } catch (error) {
    console.error("new user notice failed", error);
  }
}
