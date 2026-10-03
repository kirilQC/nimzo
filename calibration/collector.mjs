// Tiny local sink: chess.com review data scraped in the browser is POSTed here as text/plain JSON.
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.end();
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (body) { appendFileSync("chesscom-reviews.jsonl", body.trim() + "\n"); console.log("got", body.slice(0, 80)); }
    res.end("ok");
  });
}).listen(8765, () => console.log("collector on 8765"));
