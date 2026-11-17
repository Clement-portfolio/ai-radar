// Garde-fous sur les pages de données : pas de source faible, chiffres OpenAI cohérents, pas de mention périmée.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => fs.readFileSync(path.join(D, f + ".json"), "utf8");
const WEAK = ["fourweekmba.com", "besthub.dev", "news.ycombinator.com", "badgoodbetter.substack.com"];
let fails = 0; const ko = (m) => { fails++; console.error("  ✗ " + m); };
for (const f of ["market", "layers", "race", "series", "shares", "indicators", "outlook", "chain"]) {
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

// schéma de l'infrastructure (chain.json) : blocs, pièces, fiches marché datées et sourcées, camembert = dernier point du graphique
const chain = JSON.parse(read("chain"));
{
  const isUrl2 = (u) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);
  const ids = chain.blocks.map((b) => b.id);
  if (new Set(ids).size !== ids.length) ko("chain : identifiants de bloc en double");
  for (const [k, p] of Object.entries(chain.parts)) if (!ids.includes(p.b)) ko(`chain : la pièce « ${k} » pointe vers un bloc inconnu (${p.b})`);
  for (const [b, part] of Object.entries(chain.bmk)) { if (!ids.includes(b)) ko(`chain : bmk « ${b} » n'est pas un bloc`); if (!chain.parts[part]) ko(`chain : bmk « ${b} » → pièce inconnue ${part}`); }
  for (const [part, key] of Object.entries(chain.fmap)) { if (!chain.parts[part]) ko(`chain : fmap « ${part} » n'est pas une pièce`); if (!chain.fm[key]) ko(`chain : fmap « ${part} » → fiche inconnue ${key}`); }
  for (const [part, m] of Object.entries(chain.mkt)) for (const id of [m.s, m.d].filter(Boolean)) if (!chain.u[id]) ko(`chain : mkt « ${part} » → série inconnue ${id}`);
  for (const [id, u] of Object.entries(chain.u)) if (!u.as_of || !u.src || !isUrl2(u.items ? u.u : u.url)) ko(`chain : série « ${id} » sans date, source ou lien`);
  for (const [key, f] of Object.entries(chain.fm)) {
    if (f.pie && (!f.pie.as_of || !f.pie.src || !isUrl2(f.pie.u))) ko(`chain : fiche « ${key} », camembert sans date, source ou lien`);
    if (f.rev && (!f.rev.as_of || !f.rev.src || !isUrl2(f.rev.url))) ko(`chain : fiche « ${key} », revenus sans date, source ou lien`);
    for (const e of f.evid || []) if (!e.as_of || !e.src || !isUrl2(e.u)) ko(`chain : fiche « ${key} », chiffre « ${e.v} » sans date, source ou lien`);
    const c = f.chart;
    if (c) {
      for (const s of c.srcs || []) if (!isUrl2(s[1])) ko(`chain : fiche « ${key} », source de graphique sans lien https`);
      const names = c.ser.map((x) => x.n);
      for (const x of c.ser) if (x.v.length !== c.x.length) ko(`chain : fiche « ${key} », série « ${x.n} » : ${x.v.length} points pour ${c.x.length} trimestres`);
      if (f.pie) {
        const last = c.ser.map((x) => x.v[c.x.length - 1]), tot = last.reduce((a, b) => a + b, 0);
        for (const it of f.pie.items) {
          const i = names.indexOf(it.n);
          if (i >= 0 && Math.abs(last[i] / tot * 100 - it.v) > 0.15) ko(`chain : « ${it.n} » ${it.v} % dans le camembert ≠ ${(last[i] / tot * 100).toFixed(1)} % au dernier point du graphique`);
        }
      }
    }
    if (f.pie && f.chart) { const t = f.pie.items.reduce((a, i) => a + i.v, 0); if (Math.abs(t - 100) > 1.5) ko(`chain : fiche « ${key} », camembert : somme ${t.toFixed(1)} % (attendu ≈ 100)`); }
  }
}

// indicateurs et perspectives : chaque chiffre porte une date, une source et un lien https
const ind = JSON.parse(read("indicators")), out = JSON.parse(read("outlook"));
const isUrl = (u) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);
for (const x of ind.stats) {
  if (!x.value || !x.title) ko(`indicators : « ${x.id} » sans titre ou sans valeur`);
  if (!x.as_of || !x.source || !isUrl(x.url)) ko(`indicators : « ${x.id} » sans date, source ou lien`);
  if (x.links && !x.links.every((l) => l.t && isUrl(l.u))) ko(`indicators : « ${x.id} » a un lien de source invalide`);
  if (!(x.etage >= 1 && x.etage <= 5)) ko(`indicators : « ${x.id} » étage invalide`);
}
for (const k of ["catalysts"]) for (const x of out[k] || []) if (!x.as_of && !x.date) ko(`outlook.${k} : entrée sans date`);
for (const c of out.catalysts || []) {
  if (!(c.sources || []).length || !c.sources.every((s) => isUrl(s.u))) ko(`outlook : catalyseur « ${c.title} » sans source valide`);
  for (const p of c.probs || []) {
    if (!(p.p >= 0 && p.p <= 100) || !p.label) ko(`outlook : probabilité invalide pour « ${c.title} »`);
    if (p.poll && !(c.sources || []).some((s) => /polymarket\.com\/event\//.test(s.u))) ko(`outlook : « ${c.title} » a une probabilité sans lien vers son marché`);
  }
}
for (const a of out.actors || []) {
  for (const f of ["what", "why", "risk", "image"]) if (!a[f]) ko(`outlook : acteur « ${a.name} » sans « ${f} »`);
  if (!["satellite", "orbit", "racks", "cloud", "chip", "moon"].includes(a.icon)) ko(`outlook : acteur « ${a.name} » sans pictogramme valide`);
  if (!isUrl(a.website)) ko(`outlook : acteur « ${a.name} » sans site officiel (https)`);
  if (!/^[a-z0-9-]+$/.test(a.image || "")) ko(`outlook : acteur « ${a.name} » : nom d'image invalide`);
  if (!(a.figures || []).length || !a.figures.every((f) => f.v && f.l)) ko(`outlook : acteur « ${a.name} » sans chiffres clés valides`);
  if (!(a.sources || []).length || !a.sources.every((s) => isUrl(s.u || s.url))) ko(`outlook : acteur « ${a.name} » sans source`);
}
const lay = JSON.parse(read("layers")).layers;
for (const l of lay) for (const h of l.history || []) if (!/^\d{4}-\d{2}-\d{2}$/.test(h.d)) ko(`layers : historique de « ${l.id} » mal daté`);
if (lay.find((l) => l.emerging) && lay.find((l) => l.emerging).tension != null) ko("layers : une couche émergente ne doit pas avoir de note de tension");
if (fails) { console.error(`test-data : ${fails} échec(s)`); process.exit(1); }
console.log("test-data : OK");
