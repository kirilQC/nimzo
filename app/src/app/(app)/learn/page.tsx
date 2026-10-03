import type { Metadata } from "next";
import { LearnView } from "@/components/learn/LearnView";
import { db as getDb } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const db = await getDb();
  const { data: lessons } = await db.from("lessons").select("category");
  const counts = new Map<string, number>();
  for (const l of lessons ?? []) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
  return <LearnView counts={counts} />;
}
