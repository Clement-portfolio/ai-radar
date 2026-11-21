// What's Going On? — serveur web (Render). Sert le site et les données.
// La collecte tourne uniquement sur GitHub Actions (toutes les 3 h) ; ici, on ne fait que servir les dernières données
// (lues sur GitHub avec un cache court, sinon celles du dernier déploiement). Ouvrir le site ne lance aucune collecte.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isGnewsUrl, resolveOne } from "./collector/gnews.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const PORT = +process.env.PORT || 3000;
const DATA_URL = (process.env.DATA_SOURCE_URL || "https://raw.githubusercontent.com/Clement-portfolio/ai-radar/main/public/data/").replace(/\/?$/, "/");
const CACHE_MS = (+process.env.DATA_CACHE_S || 120) * 1000;
const DATA_FILES = new Set(["feed.json", "market.json", "layers.json", "race.json", "status.json", "brief.json", "focus.json", "chiffres.json", "acteurs.json", "voix.json", "recherche.json", "sec.json", "shares.json", "series.json", "indicators.json", "outlook.json", "chain.json", "en.json", "watch.json", "watchlist.json", "datacenters.json", "fabs.json", "dc-extra.json"]);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8" };

const cache = new Map(); // nom -> { at, buf }
const inflight = new Map();

/** Dernière version publiée sur GitHub ; en cas d'échec, dernière copie connue, puis fichiers du déploiement. */
async function readData(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.buf;
  if (!inflight.has(name)) {
    inflight.set(name, (async () => {
      try {
        const r = await fetch(DATA_URL + name, { signal: AbortSignal.timeout(5000), headers: { "cache-control": "no-cache" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        JSON.parse(buf.toString("utf8")); // refuse une réponse tronquée ou une page d'erreur
        cache.set(name, { at: Date.now(), buf });
        return buf;
      } catch (e) {
        console.error(`données ${name} : ${e.message}`);
        if (hit) return hit.buf;
        try { return await fs.readFile(path.join(PUBLIC, "data", name)); } catch { return null; }
      } finally { inflight.delete(name); }
    })());
  }
  return inflight.get(name);
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", ...headers });
  res.end(body);
}

const IMG = new Map(); // illustrations des acteurs : nom -> { at, buf|null }
const GO = new Map(); // lien Google News → adresse réelle (mémoire du serveur)
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);

    if (p === "/healthz") return send(res, 200, "ok", { "content-type": MIME[".txt"] });
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");

    // Lien Google News → article du média : Google bloque les adresses de GitHub, mais pas ce serveur, et seulement au clic.
    if (p === "/go") {
      const g = url.searchParams.get("u") || "";
      if (!isGnewsUrl(g)) return send(res, 400, "Lien non pris en charge");
      let to = GO.get(g);
      if (!to) { try { to = await resolveOne(g); GO.set(g, to); if (GO.size > 3000) GO.delete(GO.keys().next().value); } catch (e) { console.error("go:", e.message); to = g; } }
      return send(res, 302, "", { location: to, "cache-control": "no-store" });
    }

    if (p.startsWith("/data/")) {
      const name = p.slice(6);
      if (!DATA_FILES.has(name)) return send(res, 404, "Not found");
      const buf = await readData(name);
      return buf ? send(res, 200, buf, { "content-type": MIME[".json"], "cache-control": "no-store" }) : send(res, 404, "Not found");
    }

    // Illustrations des acteurs : lues sur GitHub (déposer un fichier suffit, sans redéployer), sinon celles du déploiement.
    const im = p.match(/^\/img\/actors\/([a-z0-9-]+\.(jpg|jpeg|png|webp))$/);
    if (im) {
      const hit = IMG.get(im[1]);
      let buf = hit && Date.now() - hit.at < 600000 ? hit.buf : undefined;
      if (buf === undefined) {
        try {
          const r = await fetch(DATA_URL.replace(/data\/$/, "") + "img/actors/" + im[1], { signal: AbortSignal.timeout(5000) });
          buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
        } catch { buf = null; }
        if (!buf) { try { buf = await fs.readFile(path.join(PUBLIC, "img", "actors", im[1])); } catch { buf = null; } }
        IMG.set(im[1], { at: Date.now(), buf });
      }
      return buf ? send(res, 200, buf, { "content-type": MIME["." + im[2]], "cache-control": "public, max-age=600" }) : send(res, 404, "Not found");
    }

    const rel = p === "/" ? "/index.html" : p;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden");
    if (file.startsWith(path.join(PUBLIC, "data") + path.sep)) return send(res, 404, "Not found");
    try {
      const buf = await fs.readFile(file);
      return send(res, 200, buf, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    } catch { return send(res, 404, "Not found"); }
  } catch (e) { console.error(e); send(res, 500, "Erreur serveur"); }
});

server.listen(PORT, () => console.log(`What's Going On? sur le port ${PORT}`));
// Réchauffe le cache : la première ouverture du site n'attend pas GitHub.
for (const n of DATA_FILES) readData(n);
