/** Blunders per clock bucket, as horizontal bars with counts. */
export function ClockBuckets({ buckets }: { buckets: { bucket: string; blunders: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.blunders));
  return (
    <ul className="space-y-2.5">
      {buckets.map((b) => (
        <li key={b.bucket} className="grid grid-cols-[4.75rem_1fr_1.5rem] items-center gap-2 text-[0.8125rem]">
          <span className="text-body2">{b.bucket}</span>
          <span className="h-3 rounded-[3px] bg-chip" aria-hidden="true">
            <span className="block h-full rounded-[3px] bg-walnut" style={{ width: `${(b.blunders / max) * 100}%` }} />
          </span>
          <span className="mono text-right text-ink" aria-label={`${b.blunders} ${b.blunders === 1 ? "blunder" : "blunders"}`}>
            {b.blunders}
          </span>
        </li>
      ))}
    </ul>
  );
}
