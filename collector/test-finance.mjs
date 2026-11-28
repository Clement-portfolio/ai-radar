import assert from "node:assert/strict";
import { buildFinance, fundamentals, tone, companyArticles, macroFacts, FIN_RULES, storyIndex, groupLabels, weekRanking } from "./finance.mjs";

const now = Date.parse("2026-11-28T12:00:00Z"), iso = (d) => new Date(now - d * 864e5).toISOString();
const fin = { quarter: { end: "2026-09-30", value: 127577000000, qoq: 6.5, yoy: 24.7, url: "https://sec.example/q", src: "SEC (10-Q)" }, ttm: { value: 471098000000, end: "2026-09-30" }, capex: { value: 159804000000, end: "2026-09-30", form: "10-Q", url: "https://sec.example/c" } };
const acteurs = { actors: [{ id: "nvidia", n: "Nvidia", c: "US", fin }, { id: "sans-chiffres", n: "Foo", c: "US" }] };
const art = (id, d, title, summary) => ({ id, ts: iso(d), title, summary, importance: 2, source: "Reuters", url: "https://x.example/" + id });
const feed = { items: [
  art("a1", 1, "Nvidia annonce une demande record pour ses puces", "Nvidia indique que la demande dépasse l'offre."),
  art("a2", 2, "Nvidia visée par de nouvelles restrictions à l'export", "Washington durcit les règles pour Nvidia."),
  art("a3", 3, "Nvidia signe un contrat avec un nouveau client", "Le contrat porte sur des serveurs."),
  art("a4", 5, "Nvidia participe à un salon", "Présence au salon."),
  art("old", 60, "Nvidia vieille histoire", "Trop ancienne."),
  art("other", 1, "Amazon investit dans les datacenters", "Rien sur la société suivie."),
] };
const outlook = { catalysts: [{ date: "2026-11-17", kind: "Résultats", title: "Passé", detail: "Déjà passé." }, { date: "2026-12-10", kind: "Banque centrale", title: "Décision de la Fed", detail: "Réunion de décembre." }], risks: [{ title: "Capex contre cash-flow", value: "1,57 $ pour 1 $", sub: "Cinq géants." }] };

// chiffres officiels : reformulés sans IA
const f = fundamentals(fin);
assert.equal(f.length, 3); assert.match(f[0].text, /127,6 Md\$/); assert.match(f[0].text, /\+24,7 %/); assert.match(f[2].text, /34 %/);
assert.deepEqual(fundamentals({}), []);
// articles : société nommée, 30 jours, pas d'autre société
assert.deepEqual(companyArticles(acteurs.actors[0], feed, now).map((x) => x.id), ["a1", "a2", "a3", "a4"]);
// macro : rendez-vous passés écartés
const mf = macroFacts(outlook, now);
assert.equal(mf.length, 2); assert.ok(!mf.some((m) => /Passé/.test(m.text)));

const labelsFor = (stances) => async (inputs) => inputs.map((x, k) => ({ i: x.i, stance: stances[k % stances.length], scope: "societe", why: "L'article le dit : " + x.titre.slice(0, 60) }));
let calls = 0;
const genCases = (pts) => async (inputs) => { calls++; return inputs.map((x) => ({ i: x.i, bear: [pts.bear], base: [pts.base], bull: [pts.bull] })); };
const goodPts = { bear: { t: "De nouvelles restrictions à l'export pourraient peser sur les ventes.", ref: "n2" }, base: { t: "Les revenus du trimestre progressent de 24,7 % sur un an.", ref: "f1" }, bull: { t: "La demande dépasse l'offre, ce qui pourrait soutenir l'activité.", ref: "n1" } };

let r = await buildFinance({ acteurs, feed, outlook, prev: null, now, generateLabels: labelsFor(["haussier", "baissier", "neutre", "haussier"]), generateCases: genCases(goodPts) });
assert.equal(r.doc.companies.length, 1, "seulement les sociétés avec chiffres");
let co = r.doc.companies[0];
assert.equal(co.labels.length, 4); assert.equal(r.stats.labeled, 4); assert.ok(co.cases, "scénarios rédigés");
assert.equal(co.tone.n, 4); assert.equal(co.tone.haussier, 2); assert.equal(co.tone.baissier, 1);
assert.ok(co.labels.every((l) => l.url && l.stance && l.id));
assert.deepEqual(Object.keys(co.cases).filter((k) => ["bear", "base", "bull"].includes(k)), ["bear", "base", "bull"]);

// deuxième passage identique : rien n'est refait, document inchangé
calls = 0; let lc = 0;
const r2 = await buildFinance({ acteurs, feed, outlook, prev: r.doc, now: now + 36e5, generateLabels: async (i) => { lc++; return []; }, generateCases: genCases(goodPts) });
assert.equal(lc, 0, "aucun article neuf : aucun appel de libellés"); assert.equal(calls, 0, "scénarios non réécrits sans nouveauté");

// un chiffre inventé dans un point de scénario : refusé, scénarios précédents conservés
calls = 0;
const feed2 = { items: [...feed.items, art("n1", 0, "Nvidia annonce un partenariat", "Partenariat de long terme."), art("n2", 0.1, "Nvidia ouvre un site", "Nouveau site."), art("n3", 0.2, "Nvidia recrute", "Embauches.")] };
const bad = { ...goodPts, bull: { t: "Les revenus pourraient atteindre 999 milliards de dollars.", ref: "f1" } };
const r3 = await buildFinance({ acteurs, feed: feed2, outlook, prev: r.doc, now: now + 25 * 36e5, generateLabels: labelsFor(["haussier"]), generateCases: genCases(bad) });
assert.equal(r3.doc.companies[0].cases.at, r.doc.companies[0].cases.at, "points invalides : on garde les scénarios précédents");
assert.equal(r3.doc.companies[0].labels.length, 7, "nouveaux libellés ajoutés");

// référence inconnue / ref absente : rejeté
const r4 = await buildFinance({ acteurs, feed, outlook, prev: null, now, generateLabels: labelsFor(["neutre"]), generateCases: genCases({ ...goodPts, base: { t: "Phrase sans source.", ref: "zzz" } }) });
assert.equal(r4.doc.companies[0].cases, null, "un scénario sans source valide : trois scénarios ou rien");

// libellé avec chiffre inventé ou stance invalide : rejeté, essai compté
const r5 = await buildFinance({ acteurs, feed, outlook, prev: null, now, generateLabels: async (inputs) => inputs.map((x) => ({ i: x.i, stance: x.i === 0 ? "super" : "haussier", scope: "societe", why: x.i === 1 ? "Hausse de 87 % annoncée." : "Texte conforme." })), generateCases: null });
assert.equal(r5.stats.rejected, 2); assert.equal(r5.doc.companies[0].labels.length, 2);
assert.equal(Object.keys(r5.doc.companies[0].tries).length, 4, "essais comptés");

// ton
assert.equal(tone([], now).label, "peu d'articles");
let _n = 0; const L = (s, d = 1) => ({ id: "t" + (_n++), stance: s, ts: iso(d) });
assert.equal(tone([L("haussier"), L("haussier"), L("neutre")], now).label, "haussière");
assert.equal(tone([L("baissier"), L("baissier"), L("neutre")], now).label, "baissière");
assert.equal(tone([L("haussier"), L("baissier"), L("neutre")], now).label, "mitigée");
assert.equal(tone([L("haussier", 40), L("haussier", 41), L("haussier", 42)], now).label, "peu d'articles", "articles de plus de 30 jours ignorés");

// sans IA : rien ne casse, libellés existants conservés
const r6 = await buildFinance({ acteurs, feed, outlook, prev: r.doc, now, generateLabels: null, generateCases: null });
assert.equal(r6.doc.companies[0].labels.length, 4);
const r7 = await buildFinance({ acteurs: { actors: [] }, feed, outlook, prev: r.doc, now });
assert.equal(r7.doc, r.doc);
// regroupement : plusieurs articles d'une même histoire = un seul compte
const stories = { stories: [{ id: "S1", ids: ["a1", "a2", "a3"] }, { id: "S2", ids: ["x1", "x2"] }] };
const storyOf = storyIndex(stories);
assert.equal(storyOf("a2"), "S1"); assert.equal(storyOf("zzz"), null);
const mk = (id, stance, d = 1) => ({ id, ts: iso(d), stance, title: "T" + id, source: "Src", url: "https://x/" + id });
const lab = [mk("a1", "haussier"), mk("a2", "haussier"), mk("a3", "haussier"), mk("x1", "haussier"), mk("x2", "baissier"), mk("z", "baissier")];
assert.equal(tone(lab, now).haussier, 4, "sans index : chaque article compte");
const t2 = tone(lab, now, storyOf);
assert.equal(t2.haussier, 1 + 0, "S1 (3 articles haussiers) = 1 histoire haussière ; S2 (1 pour, 1 contre) = neutre");
assert.equal(t2.neutre, 1); assert.equal(t2.baissier, 1); assert.equal(t2.n, 3);
assert.equal(groupLabels(lab, storyOf).find((g) => g.key === "S1").labels.length, 3);
// classement de la semaine : l'entreprise avec le plus d'histoires haussières (pas d'articles)
const A = { id: "A", n: "Alpha", labels: [mk("a1", "haussier"), mk("a2", "haussier"), mk("a3", "haussier")] };           // 3 articles, 1 histoire
const B = { id: "B", n: "Beta", labels: [mk("b1", "haussier"), mk("b2", "haussier"), mk("b3", "neutre")] };              // 2 histoires haussières
const C = { id: "C", n: "Gamma", labels: [mk("c1", "haussier", 9), mk("c2", "haussier", 9), mk("c3", "haussier", 9)] };  // trop ancien pour la semaine
const D = { id: "D", n: "Delta", labels: [] };
const wk = weekRanking({ companies: [A, B, C, D], now, storyOf, days: 7 });
assert.equal(wk.top, "B", "2 histoires haussières battent 3 articles d'une seule histoire");
assert.deepEqual(wk.ranking.map((r) => r.id), ["B", "A"], "sociétés sans actualité de la semaine écartées");
assert.equal(wk.ranking[1].bull, 1); assert.equal(wk.ranking[0].top.length, 2);
assert.equal(weekRanking({ companies: [D], now, storyOf }).top, null);
assert.equal(wk.bear, null, "aucune histoire baissière : pas de perdant");
const F = { id: "F", n: "Fox", labels: [mk("f1", "baissier"), mk("f2", "baissier"), mk("f3", "haussier")] };
const G2 = { id: "G", n: "Golf", labels: [mk("g1", "baissier"), mk("g2", "neutre")] };
const wk2 = weekRanking({ companies: [A, B, F, G2], now, storyOf, days: 7 });
assert.equal(wk2.bear, "F", "2 histoires baissières battent 1"); assert.equal(wk2.top, "B");
assert.equal(wk2.ranking.find((r) => r.id === "F").topBear.length, 2); assert.equal(wk2.ranking.find((r) => r.id === "A").topBear.length, 0);

assert.equal(weekRanking({ companies: [{ id: "E", n: "E", labels: [mk("e1", "baissier")] }], now, storyOf }).top, null, "aucune histoire haussière : pas de gagnant");

// actualités générales (secteur, macro) : libellées une fois, hors sociétés suivies, compactées au-delà de la limite
const gfeed = { items: [...feed.items, art("g1", 1, "La Fed maintient ses taux", "Décision de la banque centrale."), art("g2", 1, "Pénurie d'électricité pour les centres de données", "Le réseau est saturé."), { ...art("g3", 1, "Article mineur", "Peu important."), importance: 1 }] };
const gen = async (inputs) => inputs.map((x) => ({ i: x.i, stance: /Fed/.test(x.titre) ? "neutre" : "baissier", scope: /Fed/.test(x.titre) ? "macro" : "secteur", why: "Selon l'article : " + x.titre.slice(0, 40) }));
const g1 = await buildFinance({ acteurs, feed: gfeed, outlook, prev: null, now, generateLabels: labelsFor(["neutre"]), generateGeneral: gen, generateCases: null, stories });
assert.deepEqual(g1.doc.general.map((l) => l.id).sort(), ["g1", "g2", "other"], "importance 1 et articles de société suivie exclus");
assert.equal(g1.doc.market.macro.n, 1); assert.equal(g1.doc.market.secteur.baissier, 2);
assert.ok(g1.doc.week && Array.isArray(g1.doc.week.ranking));
let gcalls = 0;
const g2 = await buildFinance({ acteurs, feed: gfeed, outlook, prev: g1.doc, now: now + 36e5, generateLabels: labelsFor(["neutre"]), generateGeneral: async () => { gcalls++; return []; }, generateCases: null, stories });
assert.equal(gcalls, 0, "déjà libellées : aucun nouvel appel");
const g3 = await buildFinance({ acteurs, feed: gfeed, outlook, prev: g1.doc, now, generateLabels: null, generateGeneral: null, generateCases: null, stories });
assert.equal(g3.doc.general.length, 3, "sans IA : libellés conservés");
console.log("test-finance : OK");
