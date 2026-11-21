// Tests des « Chiffres clés » de la Une (hors réseau).
import assert from "node:assert/strict";
import { figureCandidates, validateFigures, pickFigures, makeFigures, scopeOf, FIG_RULES, compactMoney } from "./chiffres.mjs";

const now = Date.parse("2026-11-18T16:00:00Z");
const H = 3600e3, D = 24 * H;
const mk = (id, ageH, title, summary = "", o = {}) => ({ id, ts: new Date(now - ageH * H).toISOString(), title, summary, source: "S" + id, url: "https://ex.com/" + id, importance: 3, confidence: "moyenne", ...o });
assert.equal(FIG_RULES.count, 3, "3 chiffres clés");
assert.deepEqual([scopeOf(new Date(now - 5 * H).toISOString(), now), scopeOf(new Date(now - 3 * D).toISOString(), now), scopeOf(new Date(now - 20 * D).toISOString(), now), scopeOf(new Date(now - 40 * D).toISOString(), now)], ["day", "week", "month", null]);

const items = [
  mk("n1", 3, "Nvidia : revenus de 115,8 milliards de dollars au T3", "Revenus records, au-dessus des attentes des analystes."),
  mk("n2", 6, "L'action Nvidia gagne 4 % après les résultats", "Hausse après publication."),
  mk("w1", 60, "Isomorphic Labs lève 5 milliards de dollars", "Série C de la filiale IA de Google."),
  mk("w2", 90, "30 entreprises d'IA dépassent 10 milliards de dollars de valorisation", "Le secteur atteint des sommets."),
  mk("w3", 100, "Amazon et Google détiendront 30 % d'Anthropic", "Avant son introduction en Bourse."),
  mk("m1", 15 * 24, "Les centres de données américains consomment 4 % de l'électricité", "Étude de l'AIE.", {}),
  mk("old", 50 * 24, "Vieux chiffre de 99 milliards", "Trop ancien."),
  mk("nonum", 2, "Sujet sans aucun chiffre", "Rien."),
  mk("low", 2, "Détail mineur à 12 %", "Mineur.", { importance: 1 }),
];
const cands = figureCandidates(items, now);
assert.deepEqual(cands.map((c) => c.id), ["n1", "n2", "w1", "w2", "w3", "m1"], "articles chiffrés importants des 31 derniers jours, les plus frais d'abord ; ni vieux, ni sans chiffre, ni mineurs");

const inputs = cands.map((c, k) => ({ a: k + 1, id: c.id, ts: c.ts, title: c.title, summary: c.summary, source: c.source, url: "https://ex.com/" + c.id, conf: c.confidence }));
const F = (o) => ({ title: "Nvidia : revenus du trimestre", value: "115,8 Md$", sub: "Revenus records, au-dessus des attentes des analystes.", ids: [1], title_en: "Nvidia: quarterly revenue", value_en: "$115.8B", sub_en: "Record revenue, above analyst expectations.", ...o });
const ok = validateFigures([F({})], inputs, now);
assert.equal(ok.length, 1); assert.equal(ok[0].scope, "day"); assert.deepEqual(ok[0].ids, ["n1"]); assert.ok(ok[0].title_en);
assert.deepEqual(ok[0].links, [{ t: "Sn1", u: "https://ex.com/n1" }], "le lien de la source est gardé dans le chiffre"); assert.equal(ok[0].conf, "moyenne");
const bad = (o) => validateFigures([F(o)], inputs, now);
assert.equal(bad({ value: "130 Md$" }), null, "valeur absente des articles cités : rejetée");
assert.equal(bad({ value: "beaucoup" }), null, "valeur sans chiffre : rejetée");
assert.equal(bad({ sub: "Revenus en hausse de 77 % sur un an." }), null, "nombre inventé dans le texte : rejeté");
assert.equal(bad({ sub: "Trois fois plus que prévu." }), null, "nombre en toutes lettres : rejeté");
assert.equal(bad({ sub: "Cela montre que la demande est forte." }), null, "formule creuse : rejetée");
assert.equal(bad({ sub: "Nvidia : revenus du trimestre." }), null, "texte qui répète le titre : rejeté");
assert.equal(bad({ ids: [99] }), null, "article inconnu : rejeté");
assert.equal(bad({ ids: [] }), null, "aucun article : rejeté");
assert.equal(bad({ title: "x".repeat(90) }), null, "titre trop long : rejeté");
assert.equal(bad({ value_en: "$77B" })[0].title_en, null, "anglais avec chiffre inventé : retiré, le français reste");
// milliers : « 1 000 » en français, « 1,000 » en anglais
const big = [{ a: 1, id: "g", ts: new Date(now - 2 * D).toISOString(), title: "Le financement circulaire de l'IA dépasse 1 000 milliards de dollars", summary: "Alerte du FMI." }];
const gg = validateFigures([{ title: "Financement circulaire", value: "plus de 1 000 Md$", sub: "Alerte lancée par le FMI sur ce montant.", ids: [1], title_en: "Circular financing", value_en: "over $1,000B", sub_en: "IMF warning about this amount." }], big, now);
assert.ok(gg[0].value_en, "1 000 et 1,000 sont le même nombre"); assert.equal(gg[0].scope, "week");
// double : même article, même valeur ou même sujet
const dup = validateFigures([F({}), F({ title: "Autre titre sur les revenus", sub: "Un second texte complètement différent." }), F({ ids: [2], value: "4 %", title: "Nvidia : revenus du trimestre en Bourse", sub: "Hausse après publication." })], inputs, now);
assert.equal(dup.length, 1, "même article, même valeur, même sujet : un seul chiffre");
assert.equal(validateFigures([F({ ids: [6], value: "4 %", title: "Électricité des centres de données", sub: "Étude de l'AIE sur la consommation." })], inputs, now)[0].scope, "month");

// composition : règle jour / semaine / mois
const f = (k, scope) => ({ k, title: "t" + k, value: "v" + k, sub: "s", ids: ["i" + k], scope, ts: "x" });
const scopes = (arr) => arr.map((x) => x.scope).join(",");
assert.equal(scopes(pickFigures([f(0, "day"), f(1, "day"), f(2, "week"), f(3, "week")])), "day,day,week", "jour + semaine + complément : 1 jour au moins, 1 semaine au moins");
assert.equal(scopes(pickFigures([f(0, "day"), f(1, "week"), f(2, "week"), f(3, "week")])), "day,week,week");
assert.equal(scopes(pickFigures([f(0, "week"), f(1, "week"), f(2, "week"), f(3, "week")])), "week,week,week", "pas de chiffre du jour : 3 chiffres de la semaine");
assert.equal(scopes(pickFigures([f(0, "week"), f(1, "week"), f(2, "month"), f(3, "month")])), "week,week,month", "pas assez de chiffres de la semaine : on complète par le mois");
assert.equal(scopes(pickFigures([f(0, "week"), f(1, "month"), f(2, "month")])), "week,month,month");
assert.equal(scopes(pickFigures([f(0, "day"), f(1, "month"), f(2, "month")])), "day,month,month", "jour sans semaine : le mois fait office de semaine");
assert.equal(scopes(pickFigures([f(3, "week"), f(1, "day"), f(2, "day")])), "day,day,week", "au moins un chiffre de la semaine s'il existe, même moins bien classé");
assert.equal(pickFigures([f(0, "day"), f(1, "day"), f(2, "day"), f(3, "day")]).length, 3, "jamais plus de 3");
assert.equal(pickFigures([f(0, "day")]).length, 1, "moins de 3 disponibles : on rend ce qui existe");

// génération, conservation, mise à jour quotidienne
let calls = 0;
const mkRes = (ids) => ids.map((a, n) => ({ title: ["Revenus trimestriels records", "Levée de fonds géante", "Valorisation des licornes", "Part du capital détenue", "Hausse en Bourse"][n], value: ["115,8 Md$", "4 %", "5 milliards de dollars", "30 %", "10 milliards de dollars"][a - 1] || "4 %", sub: `Précision ${["zulu", "yankee", "xray", "whisky", "victor"][n]} donnée par la presse.`, ids: [a], title_en: "Figure " + ["alpha", "bravo", "charlie", "delta", "echo"][n], value_en: "v", sub_en: "Detail " + ["zulu", "yankee", "xray", "whisky", "victor"][n] }));
const gen = (inp) => { calls++; assert.ok(inp.length >= 6 && inp[0].date && !inp[0].id && !inp[0].url && !inp[0].conf, "les articles partent avec numéro et date, sans identifiant ni lien internes"); return mkRes([1, 3, 4, 2, 5]); };
const r1 = await makeFigures({ items, now, prev: null, generate: gen, modelName: () => "m" });
assert.equal(r1.regenerated, true); assert.equal(calls, 1); assert.equal(r1.doc.figures.length, 3, "3 chiffres clés");
assert.equal(r1.doc.day, "2026-11-18");
assert.ok(r1.doc.figures.every((x) => x.links.length >= 1 && x.conf), "chaque chiffre garde ses liens et sa confiance");
assert.deepEqual(r1.doc.figures.map((x) => x.scope), ["day", "week", "week"]);
const r2 = await makeFigures({ items, now: now + 2 * H, prev: r1.doc, generate: gen });
assert.equal(r2.regenerated, false); assert.equal(calls, 1, "même jour, 3 chiffres dont un du jour : aucun nouvel appel");
const r3 = await makeFigures({ items, now: now + 9 * H, prev: r1.doc, generate: gen });
assert.equal(r3.regenerated, true, "jour suivant : mis à jour"); assert.equal(calls, 2);
// sans chiffre du jour et plus de 6 h : on retente (un chiffre du jour a pu arriver)
const noDay = { ...r1.doc, figures: r1.doc.figures.map((x) => ({ ...x, scope: "week", ts: new Date(now - 3 * D).toISOString() })) };
assert.equal((await makeFigures({ items, now: now + 3 * H, prev: noDay, generate: gen })).regenerated, false, "sans chiffre du jour mais moins de 6 h : conservé");
assert.equal((await makeFigures({ items, now: now + 7 * H, prev: { ...noDay, generated_at: new Date(now).toISOString() }, generate: gen })).regenerated, true, "sans chiffre du jour et plus de 6 h : retenté");
const r5 = await makeFigures({ items, now: now + 9 * H, prev: r1.doc, generate: () => null });
assert.equal(r5.regenerated, false); assert.equal(r5.doc.figures.length, 3, "Gemini indisponible : derniers chiffres conservés");
const r6 = await makeFigures({ items, now: now + 9 * H, prev: r1.doc, generate: () => mkRes([1]).map((x) => ({ ...x, value: "999 %" })) });
assert.equal(r6.regenerated, false); assert.match(r6.reason, /rejetés/);
assert.equal((await makeFigures({ items: [mk("q", 2, "Rien de chiffré", "")], now, prev: null, generate: gen })).regenerated, false, "aucun article chiffré : rien à publier");
assert.equal(compactMoney("225 milliards de dollars"), "225 Md$");
assert.equal(compactMoney("1 500 milliards de dollars"), "1 500 Md$");
assert.equal(compactMoney("1,5 milliard d'euros"), "1,5 Md€");
assert.equal(compactMoney("300 millions de dollars"), "300 M$");
assert.equal(compactMoney("92,3 Md$"), "92,3 Md$");
assert.equal(compactMoney("+4 %"), "+4 %");
console.log("Tests « Chiffres clés » : OK");
