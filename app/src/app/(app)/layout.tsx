import { Nav } from "@/components/Nav";
import { AnalysisProvider } from "@/components/analysis/AnalysisProvider";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/data";
import { DEFAULT_DEPTH } from "@/lib/analysis/runGame";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  const depth = Number((settings.thresholds as { engine_depth?: number } | null)?.engine_depth) || DEFAULT_DEPTH;
  return (
    <AnalysisProvider depth={depth} autoRecent={settings.auto_analyze_recent ?? 20}>
      <Nav username={env().CHESSCOM_USERNAME} />
      <main className="mx-auto max-w-[1080px] px-6 py-8">{children}</main>
    </AnalysisProvider>
  );
}
