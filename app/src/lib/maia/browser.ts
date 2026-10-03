"use client";

import { predict, type MaiaOutput, type OrtLike, type SessionLike } from "./encode";

/**
 * Maia 3 in the browser: the official ONNX export from the Maia team,
 * run with onnxruntime-web (WebAssembly, single thread, so no special headers).
 * The 45 MB model is fetched once and kept in the Cache Storage API.
 * Used only on finished games and in Nimzo's own Practice mode.
 */

export const MAIA_MODEL = "maia3_simplified";
const MODEL_URL = "/maia/maia3_simplified.onnx";
const CACHE = "nimzo-maia-v1";
const ORT_VERSION = "1.30.0";

let loading: Promise<{ ort: OrtLike; session: SessionLike }> | null = null;

async function modelBytes(onProgress?: (p: number) => void): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(MODEL_URL);
    if (hit) return await hit.arrayBuffer();
  } catch {
    // Cache Storage unavailable: fall through to a normal download.
  }
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`Maia model download failed (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 45_683_686;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const bytes = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  try {
    const cache = await caches.open(CACHE);
    await cache.put(MODEL_URL, new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }));
  } catch {
    // ignore
  }
  return bytes.buffer;
}

export function loadMaia(onProgress?: (p: number) => void) {
  loading ??= (async () => {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    const bytes = await modelBytes(onProgress);
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "basic" });
    return { ort: ort as unknown as OrtLike, session: session as unknown as SessionLike };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export async function maiaPredict(fen: string, elo: number): Promise<MaiaOutput> {
  const { ort, session } = await loadMaia();
  return predict(ort, session, fen, elo, elo);
}
