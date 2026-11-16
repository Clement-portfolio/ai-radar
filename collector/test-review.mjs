// Tests hors ligne de la revue hebdomadaire et de l'application des propositions.
import assert from "node:assert/strict";
import fs from "node:fs";
import { flatten, pickArticles, validate, applyProposals, renderIssue, parseCommand, dec, review, fmt } from "./review.mjs";

const mkFiles = () => ({
  market: { as_of: "9 nov. 2026", tiles: [{ label: "Run-rate Anthropic", value: "> 65 Md$", sub: "fin juillet 2026", src: "Old", u: "https://old.example/a" }],
    capex_us: [{ name: "Amazon", low: 220, high: 220, as_of: "30 oct. 2026", note: "Guidance maintenue", source: "HL", url: "https://hl.example/x" }], capex_cn: [],
    revenue: [{ name: "OpenAI", country: "US", num: 70, value: "≈ 70", as_of: "29 sept. 2026", confidence: "moyenne", note: "Run-rate proche de 70 Md$", source: "Axios", url: "https://axios.example/a" }], actors: [{ name: "Nvidia", country: "US", role: "Puces", note: "Plus de 60 %", src: "AJ", u: "https://aj.example/n" }] },
  layers: { as_of: "9 nov. 2026", layers: [{ id: "apps", name: "Applications", tension: 4, key_stat: "Run-rate cumulé ≈ 105 Md$", note: "Note", sources: [{ t: "S", u: "https://s.example/1" }] }] },
  race: { as_of: "9 nov. 2026", rows: [{ id: "energie", layer: "Énergie", lead: -2, us: "≈ 60 GW", cn: "≈ 540 GW", note: "N", sources: [] }] },
});
const feed = [
  { id: "a1", title: "OpenAI run-rate reaches 80 billion dollars", summary: "OpenAI annualized revenue hit $80B, up from 70B", source: "Reuters", url: "https://reuters.example/oa", ts: "2026-11-15T10:00:00Z", importance: 3 },
  { id: "a2", title: "Amazon raises 2026 capex to 230 billion", summary: "Amazon now guides $230B", source: "CNBC", url: "https://cnbc.example/amz", ts: "2026-11-14T10:00:00Z", importance: 2 },
  { id: "a3", title: "Vieil article", summary: "x", source: "Z", url: "https://z.example", ts: "2026-09-01T10:00:00Z", importance: 3 },
  { id: "a4", title: "Brouillon", summary: "", source: "Z", url: "https://z.example/b", ts: "2026-11-15T09:00:00Z", importance: 3, pending: true },
  { id: "a5", title: "Mineur", summary: "x", source: "Z", url: "https://z.example/c", ts: "2026-11-15T08:00:00Z", importance: 1 },
];
const now = Date.parse("2026-11-16T12:00:00Z");
const files = mkFiles(), items = flatten(files);
assert.deepEqual(items.map((x) => x.k), ["tiles:0", "capex_us:0", "revenue:0", "actors:0", "layers:0", "race:0"]);
const arts = pickArticles(feed, now);
assert.deepEqual(arts.map((a) => a.id), ["a1", "a2"], "récents, importants, classés par IA seulement");

const good = [
  { k: "revenue:0", changes: [{ field: "num", value: "80" }, { field: "value", value: "≈ 80" }, { field: "note", value: "Run-rate proche de 80 Md$" }], sources: [1], reason: "Nouveau run-rate." },
  { k: "capex_us:0", changes: [{ field: "low", value: "230" }, { field: "high", value: "230" }], sources: [2], reason: "Guidance relevée." },
];
let v = validate(good, items, arts);
assert.equal(v.length, 2); assert.equal(v[0].label, "Marché › Revenus › OpenAI"); assert.equal(v[0].changes.find((c) => c.field === "num").new, 80);
// rejets : chiffre inventé, élément inconnu, champ interdit, pas de changement, sans source, low > high, nombre en lettres
const bad = [
  { k: "revenue:0", changes: [{ field: "num", value: "95" }], sources: [1], reason: "inventé" },
  { k: "inconnu:9", changes: [{ field: "note", value: "x" }], sources: [1], reason: "" },
  { k: "layers:0", changes: [{ field: "tension", value: "9" }], sources: [1], reason: "éditorial" },
  { k: "actors:0", changes: [{ field: "note", value: "Plus de 60 %" }], sources: [1], reason: "identique" },
  { k: "tiles:0", changes: [{ field: "value", value: "> 66 Md$" }], sources: [], reason: "sans source" },
  { k: "capex_us:0", changes: [{ field: "low", value: "230" }, { field: "high", value: "220" }], sources: [2], reason: "ordre" },
  { k: "revenue:0", changes: [{ field: "num", value: "quatre-vingts" }], sources: [1], reason: "lettres" },
];
assert.equal(validate(bad, items, arts).length, 0);
// hors sujet : une description remplacée par un autre chiffre (cas réel de la première revue)
const offTopic = [{ k: "tiles:0", changes: [{ field: "sub", value: "financement circulaire de 80 Md$ (FMI)" }], sources: [1], reason: "hors sujet" }];
assert.equal(validate(offTopic, items, arts).length, 0, "changement de sujet rejeté");
assert.equal(validate([{ k: "tiles:0", changes: [{ field: "sub", value: "fin octobre 2026, annualisé à 80 Md$" }], sources: [1], reason: "ok" }], items, arts).length, 0, "aucun mot commun : rejeté");
assert.equal(validate([{ k: "tiles:0", changes: [{ field: "sub", value: "run-rate annualisé à 80 Md$" }], sources: [1], reason: "ok" }], items, arts).length, 1, "même sujet : accepté");
assert.equal(validate("pas un tableau", items, arts).length, 0);

// application
const p = renderIssue(v, "2026-11-16"); const payload = dec(p.match(/<!--radar-proposals:([A-Za-z0-9+/=]+)-->/)[1]);
assert.deepEqual(payload, JSON.parse(JSON.stringify(v))); assert.match(p, /\/appliquer tout/); assert.match(p, /### 1\. Marché › Revenus › OpenAI/);
const f1 = mkFiles(); let r = applyProposals(f1, payload, [1], new Date("2026-11-16T10:00:00Z"));
assert.deepEqual(r.applied, [1]); assert.equal(f1.market.revenue[0].num, 80); assert.equal(f1.market.revenue[0].source, "Reuters"); assert.equal(f1.market.revenue[0].url, "https://reuters.example/oa");
assert.equal(f1.market.revenue[0].as_of, "15 nov. 2026"); assert.equal(f1.market.as_of, "16 nov. 2026"); assert.equal(f1.market.capex_us[0].low, 220, "proposition 2 non choisie");
assert.equal(f1.layers.as_of, "9 nov. 2026", "fichier non touché");
// toutes ; et une valeur modifiée entre-temps est ignorée
const f2 = mkFiles(); f2.market.capex_us[0].low = 225; r = applyProposals(f2, payload, null);
assert.deepEqual(r.applied, [1]); assert.equal(r.skipped[0].n, 2); assert.match(r.skipped[0].why, /a changé/); assert.equal(f2.market.capex_us[0].low, 225);
// sources des couches : ajout sans doublon
const lay = [{ k: "layers:0", label: "Infra", changes: [{ field: "key_stat", old: "Run-rate cumulé ≈ 105 Md$", new: "Run-rate cumulé ≈ 110 Md$" }], reason: "", evidence: [{ title: "t", source: "Reuters", url: "https://reuters.example/oa", ts: "2026-11-15T10:00:00Z" }] }];
const f3 = mkFiles(); applyProposals(f3, [...lay, ...lay], null); assert.equal(f3.layers.layers[0].sources.length, 2); assert.equal(f3.layers.layers[0].key_stat, "Run-rate cumulé ≈ 110 Md$");

// commande
assert.deepEqual(parseCommand("/appliquer 1 3"), [1, 3]); assert.equal(parseCommand("/appliquer tout"), "all"); assert.equal(parseCommand("/appliquer"), null); assert.equal(parseCommand("merci"), null);

// revue complète avec un faux modèle ; un appel en échec n'empêche pas les autres
const many = Array.from({ length: 12 }, (_, i) => ({ ...feed[0], id: "m" + i, title: "OpenAI run-rate reaches 80 billion dollars " + i }));
let calls = 0;
const out = await review({ files, feed: [...many, feed[1]], now, generate: async () => (++calls === 2 ? null : good) });
assert.equal(calls, 3); assert.equal(out.failed, 1); assert.ok(out.proposals.length >= 1 && out.proposals.length <= 15);
assert.deepEqual((await review({ files, feed: [feed[0]], now, generate: async () => good })).proposals, [], "trop peu d'articles : aucune proposition");
// mise en forme identique à celle des fichiers saisis à la main (différences Git minimales)
for (const f of ["market", "layers", "race"]) {
  const txt = fs.readFileSync(new URL(`../public/data/${f}.json`, import.meta.url), "utf8");
  assert.equal(fmt(JSON.parse(txt), /\}\]\}\s*$/.test(txt)), txt, f + ".json : format préservé");
}
console.log("Tests revue : OK");
