// Tests de la watchlist : étiquetage, exclusion du trading, magasin watch.json (hors réseau).
import fs from "node:fs";
import assert from "node:assert/strict";
import { compileWatchlist, tagText, isTrading, watchCandidateOk, watchJobs, buildWatch, dedupe } from "./watch.mjs";

const doc = JSON.parse(fs.readFileSync(new URL("../public/data/watchlist.json", import.meta.url), "utf8"));
const chain = JSON.parse(fs.readFileSync(new URL("../public/data/chain.json", import.meta.url), "utf8"));
const W = compileWatchlist(doc);

// structure : chaque pièce du schéma a au moins un groupe ; identifiants uniques ; requêtes présentes
const ids = doc.groups.map((g) => g.id);
assert.equal(new Set(ids).size, ids.length, "identifiants de groupe uniques");
for (const p of Object.keys(chain.parts)) assert.ok(W.byPart[p]?.length, `pièce « ${p} » sans groupe dans la watchlist`);
for (const g of doc.groups) {
  assert.ok(g.q?.length >= 2 && g.cos.length >= 10 && g.kw, `groupe ${g.id} : requêtes, entreprises et mots-clés requis`);
  assert.ok(g.cos.some((c) => c.k === "k") && g.cos.some((c) => c.k === "e"), `groupe ${g.id} : acteurs clés et émergents`);
  for (const p of g.parts) assert.ok(chain.parts[p], `groupe ${g.id} : pièce inconnue ${p}`);
}
assert.equal(watchJobs(W).length, doc.groups.reduce((a, g) => a + g.q.length, 0));
// entreprises demandées explicitement
const has = (g, n) => doc.groups.find((x) => x.id === g).cos.some((c) => c.n === n);
for (const [g, n] of [["smr", "Oklo"], ["smr", "X-energy"], ["cooling", "Vertiv"], ["models", "OpenAI"], ["models", "Anthropic"], ["models", "Google DeepMind"], ["models", "DeepSeek"], ["models", "Moonshot AI"], ["foundry", "ASML"], ["optics", "Coherent"]]) assert.ok(has(g, n), `${n} absent de ${g}`);

// étiquetage
const tag = (t) => tagText(t, W, t);
assert.deepEqual(tag("Oklo signs fuel deal with Centrus").g, ["smr"]);
assert.ok(tag("Vertiv unveils 800 VDC power architecture").g.includes("cooling"));
assert.ok(tag("Anthropic launches Claude Code for Slack").g.includes("models"));
assert.deepEqual(tag("Claude Monet exhibition opens in Paris").g, [], "« Claude » seul n'est pas Anthropic");
assert.deepEqual(tag("Le jugement humain gagne en importance").g, [], "« humain » n'est pas Humain");
assert.deepEqual(tag("Samsung unveils new Galaxy phone").g, [], "entreprise large sans contexte : pas de rattachement");
assert.ok(tag("Samsung begins HBM4 shipments").g.includes("memory"));
assert.ok(tag("Microsoft to build 2 GW data center campus").g.includes("dcbuild"));
assert.deepEqual(tag("Microsoft reports Azure growth").g, []);
assert.ok(tag("Liquid cooling demand rises").g.includes("cooling"), "mot-clé sectoriel sans nom d'entreprise");

// trading exclu (cours, analystes, consensus), faits d'industrie conservés
for (const t of ["Vertiv stock jumps after record backlog", "Analysts raise price target on Vertiv", "Nvidia shares rise 4% after earnings", "Oklo shares plunge", "Consensus estimate for Micron", "L'action Vertiv en hausse de 5 %", "Objectif de cours relevé pour Vertiv", "Coherent upgraded to buy by analysts"]) assert.ok(isTrading({ title: t }), "trading : " + t);
for (const t of ["Nvidia shares details of Vera Rubin rack", "Vertiv launches liquid cooling ecosystem", "AI demand surges for optical transceivers", "Oklo signs agreement for 12 GW", "TSMC to expand CoWoS capacity"]) assert.ok(!isTrading({ title: t }), "industrie : " + t);
assert.ok(isTrading({ title: "Vertiv launches product", url: "https://seekingalpha.com/news/1" }), "site de trading exclu");
assert.ok(isTrading({ title: "Vertiv launches product", trading: true }), "indicateur de l'IA");
assert.ok(watchCandidateOk({ title: "Oklo signs agreement", url: "https://x.com/a" }, W));
assert.ok(!watchCandidateOk({ title: "Oklo stock soars on analyst upgrade", url: "https://x.com/a" }, W));
assert.ok(!watchCandidateOk({ title: "Recette de cuisine", url: "https://x.com/a" }, W));

// magasin : rattachement, retrait du trading, conservation hors flux, plafond par groupe, dédoublonnage
const now = Date.parse("2026-11-18T12:00:00Z");
const mk = (id, ageD, title, o = {}) => ({ id, ts: new Date(now - ageD * 864e5).toISOString(), title, orig: title, summary: "", source: "S", url: "https://ex.com/" + id, country: "US", importance: 1, ...o });
const items = [mk("a", 1, "Oklo signs agreement with Switch"), mk("b", 1, "Vertiv stock jumps 8%"), mk("c", 2, "Vertiv launches liquid cooling ecosystem"), mk("d", 3, "Cuisine du jour"), mk("e", 2, "Vertiv launches a liquid cooling ecosystem for AI", { source: "Autre" })];
const r1 = buildWatch({ prev: null, items, W, now });
const got = r1.doc.items.map((x) => x.id).sort();
assert.deepEqual(got, ["a", "c"], "trading et hors-sujet exclus, doublon fusionné : " + got);
assert.equal(r1.doc.groups.smr.n, 1);
assert.ok(r1.doc.groups.cooling.cos.some((c) => c.n === "Vertiv" && c.k === "k"));
// article sorti du flux : il reste dans le magasin ; un article trop ancien disparaît
const old = { ...r1.doc.items[0], id: "z", ts: new Date(now - 130 * 864e5).toISOString() };
const r2 = buildWatch({ prev: { items: [...r1.doc.items, old] }, items: [], W, now });
assert.deepEqual(r2.doc.items.map((x) => x.id).sort(), ["a", "c"], "conservation hors flux, purge à 120 jours");
// plafond par groupe
const many = Array.from({ length: 40 }, (_, i) => mk("m" + i, i % 20, `Oklo reactor milestone number ${i} alpha${i} beta${i} gamma${i}`));
const r3 = buildWatch({ prev: null, items: many, W, now });
assert.ok(r3.doc.groups.smr.n <= 20, "20 articles au plus par groupe");
// un article stocké devient « trading » (indicateur) : retiré
const r4 = buildWatch({ prev: r1.doc, items: [{ ...items[0], trading: true }], W, now });
assert.ok(!r4.doc.items.some((x) => x.id === "a"), "article requalifié trading retiré");
// dédoublonnage direct
const dd = dedupe([mk("p", 0, "LS Electric wins $94 million order", { cos: ["LS Electric"] }), mk("q", 0, "LS Electric bags $94 million AI data center order", { cos: ["LS Electric"] }), mk("r", 0, "Hitachi Energy opens factory", { cos: ["Hitachi Energy"] })]);
assert.equal(dd.length, 2, "même commande reprise deux fois");
console.log("watch : OK");

// ───── intégration : un passage complet du collecteur alimente watch.json (sans clé IA : articles publiés tels quels) ─────
import os from "node:os"; import path from "node:path";
import { run } from "./collect.mjs";
const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "watch-"));
const nowI = Date.parse("2026-11-18T12:00:00Z");
const mini = { groups: [{ id: "cooling", name: "Refroidissement", parts: ["cool"], q: ["Vertiv OR nVent liquid cooling"], kw: "liquid[- ]cool", cos: [{ n: "Vertiv", c: "US", k: "k" }, { n: "nVent", c: "US", k: "e" }] }] };
await fs.promises.writeFile(path.join(dir, "watchlist.json"), JSON.stringify(mini));
await fs.promises.writeFile(path.join(dir, "feed.json"), JSON.stringify({ items: [] }));
const srcFile = path.join(dir, "sources.json");
await fs.promises.writeFile(srcFile, JSON.stringify({ rss: [], googleNews: { queries: [], editions: [], maxPerFeed: 5 }, quality: { allowDomains: ["datacenterdynamics.com", "seekingalpha.com", "vertiv.com"], primaryDomains: ["vertiv.com"] } }));
const gnx = `<rss><channel>
<item><title>Vertiv launches liquid cooling ecosystem for AI - DatacenterDynamics</title><link>https://news.google.com/rss/articles/AAA</link><pubDate>Tue, 17 Nov 2026 12:05:00 GMT</pubDate><source url="https://www.datacenterdynamics.com">DatacenterDynamics</source></item>
<item><title>Vertiv stock jumps as analysts raise price target - Seeking Alpha</title><link>https://news.google.com/rss/articles/BBB</link><pubDate>Tue, 17 Nov 2026 13:05:00 GMT</pubDate><source url="https://seekingalpha.com">Seeking Alpha</source></item>
<item><title>nVent wins liquid cooling order - Blog inconnu</title><link>https://news.google.com/rss/articles/CCC</link><pubDate>Tue, 17 Nov 2026 14:05:00 GMT</pubDate><source url="https://random-blog.example">Blog</source></item>
<item><title>Recette de cuisine - DatacenterDynamics</title><link>https://news.google.com/rss/articles/DDD</link><pubDate>Tue, 17 Nov 2026 14:05:00 GMT</pubDate><source url="https://www.datacenterdynamics.com">DatacenterDynamics</source></item>
</channel></rss>`;
const fx = async (url) => ({ ok: true, status: 200, text: async () => (String(url).includes("news.google.com/rss/search") ? gnx : "") });
const st = await run({ dataDir: dir, sourcesFile: srcFile, fetchImpl: fx, now: nowI, env: { PATH: process.env.PATH }, log: () => {} });
const wj = JSON.parse(await fs.promises.readFile(path.join(dir, "watch.json"), "utf8"));
assert.deepEqual(wj.items.map((x) => x.title), ["Vertiv launches liquid cooling ecosystem for AI"], "seul l'article d'industrie d'un média de confiance est rattaché : " + wj.items.map((x) => x.title));
assert.deepEqual(wj.items[0].cos, ["Vertiv"]);
assert.equal(st.last_run.watch.counts.cooling, 1);
console.log("watch intégration : OK");
