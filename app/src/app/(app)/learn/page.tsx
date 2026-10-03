import type { Metadata } from "next";
import { LearnView } from "@/components/learn/LearnView";
import { requireOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const db = await requireOwner();
  const { data: lessons } = await db.from("lessons").select("category");
  const counts = new Map<string, number>();
  for (const l of lessons ?? []) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
  return <LearnView counts={counts} />;
}
