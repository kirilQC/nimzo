// Rebuilds the player profile (statistics + Arthur's written profile and memory) from the command line.
// Usage (from app/): NIMZO_SCRIPT=1 npx tsx --conditions=react-server --env-file=.env.local scripts/build-profile.mts
import { rebuildProfile } from "../src/lib/profile/synthesize";
import { claudeUsage } from "../src/lib/coach/claude";
const t0 = Date.now();
const r = await rebuildProfile("rapid");
const cost = (claudeUsage.input * 4 + claudeUsage.cacheWrite * 5 + claudeUsage.cacheRead * 0.4 + claudeUsage.output * 20) / 1e6;
console.log(`profile ${r.id} from ${r.games} games in ${((Date.now() - t0) / 1000).toFixed(0)}s, Claude $${cost.toFixed(2)} (${claudeUsage.calls} calls)`);
