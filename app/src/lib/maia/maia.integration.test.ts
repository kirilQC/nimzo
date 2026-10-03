// Runs the real Maia 3 ONNX model under Node. Opt-in (loads a 45 MB model):
//   RUN_MAIA=1 npx vitest run src/lib/maia/maia.integration.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { encode, mirrorFen, predict } from "./encode";

describe("Maia encoding", () => {
  it("mirrors black-to-move positions", () => {
    expect(mirrorFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1",
    );
  });
  it("encodes all 20 legal opening moves", () => {
    expect(encode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").legal).toHaveLength(20);
  });
});

const run = process.env.RUN_MAIA ? describe : describe.skip;

run("Maia 3 model", () => {
  it("predicts human-like moves", async () => {
    // Same WebAssembly runtime the browser uses.
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    const model = readFileSync(fileURLToPath(new URL("../../../public/maia/maia3_simplified.onnx", import.meta.url)));
    const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });

    const start = await predict(ort, session, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1000, 1000);
    const top = Object.entries(start.policy).slice(0, 4);
    console.log("start, 1000 Elo:", top.map(([m, p]) => `${m} ${(p * 100).toFixed(1)}%`).join(", "), "value", start.value.toFixed(2));
    expect(["e2e4", "d2d4"]).toContain(top[0]![0]);
    expect(Object.values(start.policy).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);

    // Black to move after 1.e4: replies must come back in real-board orientation.
    const reply = await predict(ort, session, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", 1000, 1000);
    const replyTop = Object.keys(reply.policy)[0]!;
    console.log("after 1.e4:", Object.entries(reply.policy).slice(0, 3).map(([m, p]) => `${m} ${(p * 100).toFixed(1)}%`).join(", "));
    expect(replyTop[1]).toBe("7"); // a black pawn/piece move from rank 7 or knight from rank 8
    expect(["e7e5", "c7c5", "e7e6", "d7d5", "c7c6", "g8f6", "b8c6", "d7d6"]).toContain(replyTop);

    // Blackburne–Shilling: how often does a ~1000 player grab f7 with the knight?
    const trap = await predict(ort, session, "r1b1kbnr/pppp1ppp/8/4N1q1/2BnP3/8/PPPP1PPP/RNBQK2R w KQkq - 1 5", 1000, 1000);
    console.log("trap position:", Object.entries(trap.policy).slice(0, 4).map(([m, p]) => `${m} ${(p * 100).toFixed(1)}%`).join(", "));
    expect(trap.policy["e5f7"]).toBeGreaterThan(0.05);
  }, 120_000);
});
