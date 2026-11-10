import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

// Reads for the admin feedback page (plan §6.8): ratings from the free
// checker and enquiries, newest first. Callers have passed requireAdmin().

export type Rating = {
  id: string;
  rating: number;
  feedback: string | null;
  source: string | null;
  createdAt: Date;
};

export type Enquiry = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  answers: Record<string, unknown>;
  outcome: string | null;
  sourcePage: string | null;
};

export async function listFeedback(
  limit = 200,
): Promise<{ ratings: Rating[]; enquiries: Enquiry[] }> {
  const db = createServiceClient();
  const [ratings, enquiries] = await Promise.all([
    db
      .from("tool_ratings")
      .select("id, rating, feedback, source, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<
        Array<{
          id: string;
          rating: number;
          feedback: string | null;
          source: string | null;
          created_at: string;
        }>
      >(),
    db
      .from("enquiries")
      .select("id, created_at, name, email, company, phone, message, answers, outcome, source_page")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<
        Array<{
          id: string;
          created_at: string;
          name: string;
          email: string;
          company: string | null;
          phone: string | null;
          message: string | null;
          answers: Record<string, unknown> | null;
          outcome: string | null;
          source_page: string | null;
        }>
      >(),
  ]);
  if (ratings.error) throw new Error(`reading ratings failed: ${ratings.error.message}`);
  if (enquiries.error) throw new Error(`reading enquiries failed: ${enquiries.error.message}`);
  return {
    ratings: ratings.data.map((r) => ({ ...r, createdAt: new Date(r.created_at) })),
    enquiries: enquiries.data.map((e) => ({
      id: e.id,
      createdAt: new Date(e.created_at),
      name: e.name,
      email: e.email,
      company: e.company,
      phone: e.phone,
      message: e.message,
      answers: e.answers ?? {},
      outcome: e.outcome,
      sourcePage: e.source_page,
    })),
  };
}
