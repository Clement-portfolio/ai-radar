// Calendrier des six prochains mois : met à jour les probabilités (prix des paris sur Polymarket) dans outlook.json.
// Tout est facultatif : si Polymarket ne répond pas, les dernières valeurs restent affichées avec leur date.
import fs from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";

const API = "https://gamma-api.polymarket.com/events?slug=";

/** Prix du « Oui » (en %) du marché de l'événement `slug` dont la question contient `match`. */
export function yesPct(event, match) {
  const m = (event?.markets || []).find((x) => String(x.question || "").includes(match));
  if (!m) return null;
  let prices, outs;
  try { prices = JSON.parse(m.outcomePrices); outs = JSON.parse(m.outcomes || '["Yes","No"]'); } catch { return null; }
  const i = Math.max(0, outs.indexOf("Yes")), v = Number(prices[i]);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? Math.round(v * 1000) / 10 : null;
}

export async function refreshCalendar({ doc, fetchImpl = fetch, now = Date.now(), log = () => {} }) {
  const cache = new Map(), errors = []; let changed = 0;
  for (const c of doc.catalysts || []) {
    let touched = false;
    for (const pr of c.probs || []) {
      if (!pr.poll) continue;
      try {
        if (!cache.has(pr.poll.slug)) {
          const r = await fetchImpl(API + encodeURIComponent(pr.poll.slug), { signal: AbortSignal.timeout(10000) });
          if (!r.ok) throw new Error("HTTP " + r.status);
          cache.set(pr.poll.slug, (await r.json())[0]);
        }
        const v = yesPct(cache.get(pr.poll.slug), pr.poll.match);
        if (v == null) throw new Error("marché introuvable");
        if (v !== pr.p) { pr.p = v; changed++; }
        touched = true;
      } catch (e) { errors.push(`${pr.poll.slug} : ${e.message}`); log(`calendrier ${pr.poll.slug} : ${e.message}`); }
    }
    if (touched) c.probs_at = new Date(now).toISOString().slice(0, 16) + "Z";
  }
  return { changed, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "outlook.json");
  const doc = JSON.parse(await fs.readFile(f, "utf8"));
  const res = await refreshCalendar({ doc, log: console.log });
  await fs.writeFile(f, JSON.stringify(doc, null, 1) + "\n");
  console.log(`calendrier : ${res.changed} probabilité(s) mise(s) à jour, ${res.errors.length} erreur(s)`);
}
