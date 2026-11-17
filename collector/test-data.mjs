// Garde-fous sur les pages de données : pas de source faible, chiffres OpenAI cohérents, pas de mention périmée.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => fs.readFileSync(path.join(D, f + ".json"), "utf8");
const WEAK = ["fourweekmba.com", "besthub.dev", "news.ycombinator.com", "badgoodbetter.substack.com"];
let fails = 0; const ko = (m) => { fails++; console.error("  ✗ " + m); };
for (const f of ["market", "layers", "race", "series", "shares", "indicators", "outlook"]) {
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

// indicateurs et perspectives : chaque chiffre porte une date, une source et un lien https
const ind = JSON.parse(read("indicators")), out = JSON.parse(read("outlook"));
const isUrl = (u) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);
for (const x of ind.stats) {
  if (!x.value || !x.title) ko(`indicators : « ${x.id} » sans titre ou sans valeur`);
  if (!x.as_of || !x.source || !isUrl(x.url)) ko(`indicators : « ${x.id} » sans date, source ou lien`);
  if (!(x.etage >= 1 && x.etage <= 5)) ko(`indicators : « ${x.id} » étage invalide`);
}
for (const k of ["capex2027", "catalysts"]) for (const x of out[k] || []) if (!x.as_of && !x.date) ko(`outlook.${k} : entrée sans date`);
for (const a of out.actors || []) {
  for (const f of ["what", "why", "last", "risk"]) if (!a[f]) ko(`outlook : acteur « ${a.name} » sans « ${f} »`);
  if (!(a.sources || []).length || !a.sources.every((s) => isUrl(s.u || s.url))) ko(`outlook : acteur « ${a.name} » sans source`);
}
const lay = JSON.parse(read("layers")).layers;
for (const l of lay) for (const h of l.history || []) if (!/^\d{4}-\d{2}-\d{2}$/.test(h.d)) ko(`layers : historique de « ${l.id} » mal daté`);
if (lay.find((l) => l.emerging) && lay.find((l) => l.emerging).tension != null) ko("layers : une couche émergente ne doit pas avoir de note de tension");
if (fails) { console.error(`test-data : ${fails} échec(s)`); process.exit(1); }
console.log("test-data : OK");
