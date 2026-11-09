// AI Radar — serveur web (Render). Sert le site, les données, et lance une collecte à la demande.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./collector/collect.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DATA = process.env.RUNTIME_DATA_DIR || path.join(process.env.TMPDIR || "/tmp", "ai-radar-data");
const PORT = +process.env.PORT || 3000;
const TTL_MS = (+process.env.REFRESH_TTL_MIN || 30) * 60000;
const MIN_GAP_MS = 90000;
const DATA_FILES = new Set(["feed.json", "market.json", "layers.json", "race.json", "status.json"]);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".txt": "text/plain; charset=utf-8" };

let running = false, lastStart = 0, lastError = null;

async function readStatus() { try { return JSON.parse(await fs.readFile(path.join(DATA, "status.json"), "utf8")); } catch { return {}; } }

async function startRun() {
  running = true; lastStart = Date.now(); lastError = null;
  run({ dataDir: DATA, log: (m) => console.log("[collecte] " + m) })
    .catch((e) => { lastError = String(e.message || e); console.error(e); })
    .finally(() => { running = false; });
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", ...headers });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { "content-type": MIME[".json"], "cache-control": "no-store" });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);

    if (p === "/healthz") return send(res, 200, "ok", { "content-type": MIME[".txt"] });

    if (p === "/api/status" && req.method === "GET") {
      const s = await readStatus();
      return json(res, 200, { running, updated_at: s.updated_at || null, last_attempt: s.last_attempt || null, errors: lastError ? [lastError] : (s.last_run?.errors || []), added: s.last_run?.added ?? null });
    }

    if (p === "/api/refresh" && req.method === "POST") {
      const force = url.searchParams.get("force") === "1";
      const s = await readStatus();
      const age = s.updated_at ? Date.now() - new Date(s.updated_at).getTime() : Infinity;
      if (running) return json(res, 200, { running: true });
      if (!process.env.GEMINI_API_KEY) return json(res, 200, { running: false, skipped: "GEMINI_API_KEY absente sur le serveur" });
      if (Date.now() - lastStart < MIN_GAP_MS) return json(res, 200, { running: false, skipped: "collecte récente" });
      if (!force && age < TTL_MS) return json(res, 200, { running: false, skipped: "données fraîches" });
      startRun();
      return json(res, 200, { running: true });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");

    // données : dossier d'exécution (collecte à la demande), sinon fichiers du dépôt
    if (p.startsWith("/data/")) {
      const name = p.slice(6);
      if (!DATA_FILES.has(name)) return send(res, 404, "Not found");
      for (const dir of [DATA, path.join(PUBLIC, "data")]) {
        try { return send(res, 200, await fs.readFile(path.join(dir, name)), { "content-type": MIME[".json"], "cache-control": "no-store" }); } catch {}
      }
      return send(res, 404, "Not found");
    }

    let rel = p === "/" ? "/index.html" : p;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden");
    if (file.startsWith(path.join(PUBLIC, "data") + path.sep)) return send(res, 404, "Not found");
    try {
      const buf = await fs.readFile(file);
      return send(res, 200, buf, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    } catch { return send(res, 404, "Not found"); }
  } catch (e) { console.error(e); send(res, 500, "Erreur serveur"); }
});

await fs.mkdir(DATA, { recursive: true });
await fs.cp(path.join(PUBLIC, "data"), DATA, { recursive: true, force: true });
server.listen(PORT, () => console.log(`AI Radar sur le port ${PORT}`));
