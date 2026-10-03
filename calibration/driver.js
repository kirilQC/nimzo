await (async (ids) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  for (const id of ids) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:0;top:0;width:1400px;height:900px;z-index:99999;background:#fff";
    f.src = `https://www.chess.com/analysis/game/live/${id}?tab=review`;
    document.body.appendChild(f);
    try {
      await new Promise((r) => (f.onload = r));
      const doc = () => f.contentDocument;
      let btn = null;
      for (let t = 0; t < 160 && !btn; t++) {
        btn = [...doc().querySelectorAll("button")].find((b) => /start review/i.test(b.innerText));
        if (!btn) await sleep(500);
      }
      if (!btn) { results.push(`${id}: no review button`); continue; }
      await sleep(500);
      const text = doc().body.innerText;
      const acc = /Accuracy\s*\n\s*([\d.]+)\s*\n\s*([\d.]+)/.exec(text);
      const counts = {};
      for (const k of ["Brilliant", "Great", "Book", "Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Miss", "Blunder"]) {
        const m = new RegExp(String.raw`\n${k}\s*\n\s*(\d+)\s*\n\s*(\d+)`).exec(text);
        if (m) counts[k] = [Number(m[1]), Number(m[2])];
      }
      btn.click();
      await sleep(2000);
      const nodes = [...doc().querySelectorAll(".node.main-line-ply[data-node]")].sort(
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
          box = doc().querySelector(".move-feedback-box-content");
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
      results.push(`${id}: acc ${payload.accuracy} moves ${moves.length} unlabeled ${moves.filter((m) => !m.cls).length}`);
    } catch (e) {
      results.push(`${id}: error ${e.message}`);
    } finally {
      f.remove();
    }
  }
  return results.join("\n");
})(IDS)
