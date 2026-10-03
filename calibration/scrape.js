(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const id = location.pathname.split("/").filter(Boolean).find((s) => /^\d+$/.test(s));
  let btn = null;
  for (let t = 0; t < 120 && !btn; t++) {
    btn = [...document.querySelectorAll("button")].find((b) => /start review/i.test(b.innerText));
    if (!btn) await sleep(500);
  }
  if (!btn) return "no review button for " + id;
  const text = document.body.innerText;
  const acc = /Accuracy\s*\n\s*([\d.]+)\s*\n\s*([\d.]+)/.exec(text);
  const counts = {};
  for (const k of ["Brilliant", "Great", "Book", "Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Miss", "Blunder"]) {
    const m = new RegExp(String.raw`\n${k}\s*\n\s*(\d+)\s*\n\s*(\d+)`).exec(text);
    if (m) counts[k] = [Number(m[1]), Number(m[2])];
  }
  btn.click();
  await sleep(2000);
  const nodes = [...document.querySelectorAll(".node.main-line-ply[data-node]")].sort(
    (a, b) => Number(a.dataset.node.split("-")[1]) - Number(b.dataset.node.split("-")[1]),
  );
  const moves = [];
  for (const n of nodes) {
    const ply = Number(n.dataset.node.split("-")[1]) + 1;
    const san = n.innerText.trim();
    n.click();
    let box = null;
    for (let t = 0; t < 30; t++) {
      await sleep(80);
      box = document.querySelector(".move-feedback-box-content");
      if (box && box.querySelector(".move-san-san")?.innerText.trim() === san) break;
    }
    moves.push({
      ply,
      san,
      cls: box?.querySelector(".move-feedback-box-icon svg g[id]")?.id ?? "",
      desc: box?.querySelector(".move-feedback-box-description")?.innerText.trim() ?? "",
      score: box?.querySelector(".move-feedback-box-score")?.innerText.trim() ?? "",
    });
  }
  const payload = { id, accuracy: acc ? [Number(acc[1]), Number(acc[2])] : null, counts, moves };
  await fetch("http://localhost:8765/", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
  return `${id}: acc ${payload.accuracy} moves ${moves.length} unlabeled ${moves.filter((m) => !m.cls).length}`;
})();
