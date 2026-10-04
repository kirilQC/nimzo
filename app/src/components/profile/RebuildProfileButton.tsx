"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Recomputes the statistics and asks Arthur to rewrite the profile (takes a minute or two). */
export function RebuildProfileButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/rebuild", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't build the profile.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? "Arthur is studying your games…" : label}
      </button>
      {error && (
        <span className="text-sm text-[color:var(--blunder-bg)]" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
