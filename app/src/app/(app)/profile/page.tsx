import type { Metadata } from "next";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { PageHeader } from "@/components/ui";
import { ProfileView } from "@/components/profile/ProfileView";
import { RebuildProfileButton } from "@/components/profile/RebuildProfileButton";
import { formatDate } from "@/lib/format";
import { sectionTitle } from "@/lib/knowledge";
import type { ProfileStats } from "@/lib/profile/stats";
import type { WrittenProfile } from "@/lib/profile/synthesize";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const db = await getDb();
  const [{ data: latest }, { count: analyzed }] = await Promise.all([
    db.from(T.player_profiles).select("id, created_at, games_analyzed, stats, profile").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from(T.game_analysis).select("game_id", { count: "exact", head: true }).eq("time_class", "rapid"),
  ]);

  if (!latest) {
    return (
      <div>
        <PageHeader title="Profile" subtitle="How you play, built from every game Nimzo has analyzed." />
        <div className="card p-8 text-center">
          <p className="text-body2">
            {analyzed ? `${analyzed} rapid games are analyzed and ready.` : "No analyzed games yet."} Build your profile to see your habits, strengths and training plan.
          </p>
          <div className="mt-4 flex justify-center">
            <RebuildProfileButton label="Build my profile" />
          </div>
        </div>
      </div>
    );
  }

  const stats = latest.stats as ProfileStats;
  const profile = latest.profile as WrittenProfile | null;
  const lessonTitles = Object.fromEntries(
    [...(profile?.weaknesses ?? []).flatMap((w) => w.knowledge_ids), ...(profile?.training_plan ?? []).flatMap((t) => t.knowledge_ids)].map((id) => [id, sectionTitle(id) ?? id]),
  );
  const newer = (analyzed ?? 0) - latest.games_analyzed;

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle={`Built from ${latest.games_analyzed} rapid games, ${formatDate(stats.period.from, { month: "short", year: "numeric" })} to ${formatDate(stats.period.to, { month: "short", year: "numeric" })}. Updated ${formatDate(latest.created_at, { month: "short", day: "numeric" })}.`}
        action={<RebuildProfileButton label={newer > 0 ? `Update with ${newer} new games` : "Rebuild"} />}
      />
      <ProfileView stats={stats} profile={profile} lessonTitles={lessonTitles} />
    </div>
  );
}
