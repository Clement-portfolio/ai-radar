// What's Going On? — version Cloudflare Workers (gratuit, sans mise en veille). Même comportement que server.js :
// pages statiques (dossier public/), données lues sur GitHub avec cache court, lien Google News résolu au clic, illustrations.
import { isGnewsUrl, resolveOne } from "./collector/gnews.mjs";

const DATA_URL = "https://raw.githubusercontent.com/Clement-portfolio/ai-radar/main/public/data/";
const IMG_URL = "https://raw.githubusercontent.com/Clement-portfolio/ai-radar/main/public/img/actors/";
const DATA_FILES = new Set(["feed.json", "fast-feed.json", "market.json", "layers.json", "race.json", "status.json", "brief.json", "focus.json", "chiffres.json", "acteurs.json", "voix.json", "voix-fast.json", "stories.json", "recherche.json", "x.json", "sec.json", "shares.json", "series.json", "indicators.json", "outlook.json", "chain.json", "en.json", "watch.json", "watchlist.json", "datacenters.json", "fabs.json", "dc-extra.json"]);
const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const GO = new Map(); // lien Google News → adresse réelle (mémoire de l'instance)

const text = (code, body, extra = {}) => new Response(body, { status: code, headers: { ...SEC, "content-type": "text/plain; charset=utf-8", ...extra } });

async function data(name, env) {
  try {
    const r = await fetch(DATA_URL + name, { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 120, cacheEverything: true } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = await r.arrayBuffer();
    JSON.parse(new TextDecoder().decode(buf)); // refuse une réponse tronquée ou une page d'erreur
    return buf;
  } catch (e) {
    console.error(`données ${name} : ${e.message}`);
    const a = await env.ASSETS.fetch(new Request("https://assets.local/data/" + name)); // copie du dernier déploiement
    return a.ok ? await a.arrayBuffer() : null;
  }
}

export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url), p = decodeURIComponent(url.pathname);
      if (p === "/healthz") return text(200, "ok");
      if (req.method !== "GET" && req.method !== "HEAD") return text(405, "Method Not Allowed");

      if (p === "/go") {
        const g = url.searchParams.get("u") || "";
        if (!isGnewsUrl(g)) return text(400, "Lien non pris en charge");
        let to = GO.get(g);
        if (!to) { try { to = await resolveOne(g); GO.set(g, to); if (GO.size > 3000) GO.delete(GO.keys().next().value); } catch (e) { console.error("go:", e.message); to = g; } }
        return new Response(null, { status: 302, headers: { ...SEC, location: to, "cache-control": "no-store" } });
      }

      if (p.startsWith("/data/")) {
        const name = p.slice(6);
        if (!DATA_FILES.has(name)) return text(404, "Not found");
        const buf = await data(name, env);
        return buf ? new Response(buf, { headers: { ...SEC, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }) : text(404, "Not found");
      }

      const im = p.match(/^\/img\/actors\/([a-z0-9-]+\.(jpg|jpeg|png|webp))$/);
      if (im) {
        try {
          const r = await fetch(IMG_URL + im[1], { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 600, cacheEverything: true } });
          if (r.ok) return new Response(r.body, { headers: { ...SEC, "content-type": r.headers.get("content-type") || "image/png", "cache-control": "public, max-age=600" } });
        } catch {}
        return env.ASSETS.fetch(req); // sinon, illustration du déploiement
      }
      return env.ASSETS.fetch(req);
    } catch (e) { console.error(e); return text(500, "Erreur serveur"); }
  },
};
