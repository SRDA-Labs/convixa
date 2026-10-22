import http from "node:http";
import { createHealth, log } from "@convixa/shared";

const port = Number(process.env.PORT || 3101);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    const body = JSON.stringify(createHealth("notifier"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
    return;
  }

  if (req.method === "POST" && req.url === "/notify") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      log("notifier", `received notify payload bytes=${raw.length}`);
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ accepted: true }));
    });
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  log("notifier", `listening on :${port}`);
});
