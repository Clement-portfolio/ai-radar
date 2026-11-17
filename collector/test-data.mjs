// Garde-fous sur les pages de données : pas de source faible, chiffres OpenAI cohérents, pas de mention périmée.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => fs.readFileSync(path.join(D, f + ".json"), "utf8");
const WEAK = ["fourweekmba.com", "besthub.dev", "news.ycombinator.com", "badgoodbetter.substack.com"];
let fails = 0; const ko = (m) => { fails++; console.error("  ✗ " + m); };
for (const f of ["market", "layers", "race", "series", "shares"]) {
  const t = read(f);
  for (const w of WEAK) if (t.toLowerCase().includes(w)) ko(`${f}.json cite une source faible : ${w}`);
}
const market = JSON.parse(read("market")), series = JSON.parse(read("series")), shares = JSON.parse(read("shares"));
const tile = market.tiles.find((t) => /OpenAI/.test(t.label)), rev = market.revenue.find((r) => r.name === "OpenAI");
const curve = series.curves.find((c) => c.id === "runrate").series.find((s) => s.name === "OpenAI").points.slice(-1)[0];
if (rev.num !== curve.v) ko(`OpenAI : revenus ${rev.num} Md$ ≠ dernier point de la courbe ${curve.v} Md$`);
if (!tile.value.includes(String(curve.v))) ko(`OpenAI : tuile « ${tile.value} » ≠ dernier point de la courbe ${curve.v} Md$`);
if (/date non confirmée|attendus? mi-/i.test(read("market"))) ko("market.json : mention de date d'événement non confirmée");
const curveSources = series.curves.map((c) => c.id), pieIds = shares.charts.map((c) => c.id);
if (curveSources.includes("traffic") && pieIds.includes("chat")) ko("parts de trafic des chatbots présentes deux fois (courbe et camembert)");
if (fails) { console.error(`test-data : ${fails} échec(s)`); process.exit(1); }
console.log("test-data : OK");
