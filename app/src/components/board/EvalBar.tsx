/** Vertical eval bar. whitePct = white's win% (0–100); null = no analysis yet. */
export function EvalBar({ whitePct, label, orientation = "white" }: { whitePct: number | null; label?: string; orientation?: "white" | "black" }) {
  const pct = whitePct ?? 50;
  const whiteOnBottom = orientation === "white";
  return (
    <div
      className="relative w-4 shrink-0 overflow-hidden rounded-[4px] border border-line bg-panel sm:w-5"
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={whitePct === null ? "Not analyzed" : label ?? `${Math.round(pct)}% for White`}
    >
      <div
        className="absolute inset-x-0 bg-[#F5EFE3] transition-[height] duration-200 motion-reduce:transition-none"
        style={{ height: `${pct}%`, [whiteOnBottom ? "bottom" : "top"]: 0 }}
      />
    </div>
  );
}
