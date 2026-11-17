// Tests du « Briefing du jour » (hors réseau).
import assert from "node:assert/strict";
import { pickStories, relatedFor, validateStories, makeFocus } from "./focus.mjs";

const now = Date.parse("2026-11-16T12:00:00Z");
const H = 3600e3, D = 24 * H;
const mk = (id, ageH, title, summary, o = {}) => ({ id, ts: new Date(now - ageH * H).toISOString(), title, summary, source: "S" + id, country: "US", category: "puces", layer: "Puces", importance: 3, confidence: "moyenne", ...o });
const items = [
  // une grande histoire : trois médias, dont un article de plus de 3 jours (évolution d'une news de la semaine)
  mk("a", 3, "Nvidia livre sa nouvelle puce Rubin aux clients cloud", "Nvidia annonce la livraison de Rubin, 3 fois plus rapide."),
  mk("a2", 30, "Nvidia commence la livraison de la puce Rubin aux clients cloud", "Les premiers clients cloud reçoivent Rubin."),
  mk("a3", 90, "Nvidia confirme la livraison de la puce Rubin aux clients cloud", "Livraison de Rubin lancée chez Nvidia aux clients cloud."),
  mk("a0", 20 * 24, "Nvidia dévoile la puce Rubin pour les centres de données", "Rubin doit succéder à Blackwell chez Nvidia.", { importance: 2 }),
  mk("a1", 60 * 24, "Nvidia confirme que Rubin arrivera avant la fin de l'année", "Calendrier de Rubin avancé.", { importance: 2 }),
  mk("b", 5, "Les États-Unis durcissent les licences d'exportation de puces vers la Chine", "Washington impose des licences pour l'accès à distance.", { category: "regul" }),
  mk("c", 6, "OpenAI lève 40 milliards de dollars", "Un tour de table de 40 milliards de dollars.", { category: "capex" }),
  mk("d", 7, "Un petit sujet mineur sur la mode", "Rien à voir.", { importance: 1, category: "adoption" }),
  mk("e", 200, "Vieille actualité de plus de sept jours sur la fonderie", "Trop ancienne.", { category: "puces" }),
];
for (let k = 0; k < 25; k++) items.push(mk("f" + k, 8 + k, `Autre sujet distinct numéro ${k} mot${k}x mot${k}y mot${k}z`, `Résumé ${k}.`, { importance: 1, category: "adoption" }));

// sélection par histoire : articles du même sujet regroupés, importance haute d'abord, plus de 7 jours exclus, mineurs exclus
const st = pickStories(items, now, 3);
assert.equal(st.length, 3);
assert.ok(st.every((s) => s.lead.importance >= 2), "histoires importantes seulement");
const rubin = st.find((s) => s.lead.id.startsWith("a"));
assert.deepEqual(rubin.items.map((a) => a.id).sort(), ["a", "a2", "a3"], "trois articles du même sujet regroupés, dont un vieux de plusieurs jours");
assert.equal(rubin.media, 3, "médias distincts comptés");
assert.ok(!st.some((s) => s.items.some((a) => a.id === "e")), "plus de 7 jours : exclu");
assert.ok(!st.some((s) => s.items.some((a) => a.id === "d")), "article mineur exclu");

// plusieurs histoires du même pays et du même sujet : permis (un malus léger seulement, jamais d'exclusion)
const same = [mk("g1", 2, "Alpha chute en bourse après les résultats trimestriels", "Alpha recule.", { category: "capex" }), mk("g2", 3, "Bêta grimpe grâce à un contrat cloud géant", "Bêta monte.", { category: "capex" }), mk("g3", 4, "Gamma annonce une levée de fonds record", "Gamma lève.", { category: "capex" })];
assert.equal(pickStories(same, now, 3).length, 3, "trois histoires de la même catégorie et du même pays");

// remise en contexte : articles plus anciens sur le même sujet seulement
const rel = relatedFor(rubin, items, now);
assert.deepEqual(rel.map((o) => o.id), ["a1", "a0"], "plus anciens, même sujet, du plus ancien au plus récent");
assert.deepEqual(relatedFor(st.find((s) => s.lead.id === "b"), items, now), [], "aucun article lié : pas de contexte");

// validation
const arts = rubin.items.map((a, m) => ({ a: m + 1, title: a.title, summary: a.summary }));
const inputs = [{ i: 1, articles: arts, background: [{ j: 1, title: items[4].title, summary: items[4].summary }, { j: 2, title: items[3].title, summary: items[3].summary }] }];
const T = { i: 1, head: "Nvidia livre Rubin à ses clients cloud", b1: "La puce est 3 fois plus rapide.", b2: "Rubin devait succéder à Blackwell.", b3: "Le calendrier de Rubin est tenu malgré une puce 3 fois plus rapide.", ctx: [2], head_en: "Nvidia ships Rubin to cloud customers", b1_en: "The chip is 3 times faster.", b2_en: "Rubin was meant to succeed Blackwell.", b3_en: "Rubin is on schedule despite a chip 3 times faster." };
const good = validateStories([T], inputs);
assert.equal(good[0].bullets.length, 3); assert.equal(good[0].bullets_en.length, 3); assert.deepEqual(good[0].ctx, [2]);
assert.equal(validateStories([{ ...T, b1: "Gain de 777 % attendu." }], inputs), null, "nombre inventé : histoire rejetée");
assert.equal(validateStories([{ ...T, b3: "Trois fois plus rapide." }], inputs), null, "nombre en toutes lettres : rejeté");
assert.equal(validateStories([{ ...T, b1: "" }], inputs), null, "première puce vide : rejeté");
assert.equal(validateStories([{ ...T, head: "x".repeat(200) }], inputs), null, "titre trop long : rejeté");
const badEn = validateStories([{ ...T, b1_en: "A gain of 777% expected." }], inputs);
assert.equal(badEn[0].bullets_en, null, "anglais avec chiffre inventé : retiré, le français reste");
assert.equal(validateStories([{ ...T, b1: "川普訪華" }], inputs), null, "écriture non latine : rejeté");
assert.deepEqual(validateStories([{ ...T, ctx: [9] }], inputs)[0].ctx, [], "source de contexte inconnue : ignorée");

// puces facultatives et formules creuses : b3 creux ou vide retiré, b2 vide retiré, b1 creux rejeté
const f1 = validateStories([{ ...T, b3: "Cela veut dire que le calendrier est tenu." }], inputs);
assert.equal(f1[0].bullets.length, 2, "« Cela veut dire » : puce retirée");
assert.equal(f1[0].bullets_en.length, 2, "l'anglais suit le français");
for (const filler of ["Cela signifie que tout va bien.", "Cela montre que le calendrier est tenu.", "Cela pourrait compter.", "Autrement dit, c'est tenu.", "En clair, Rubin arrive.", "Concrètement, rien ne change.", "Ça veut dire que Rubin arrive."]) assert.equal(validateStories([{ ...T, b3: filler }], inputs)[0].bullets.length, 2, "formule creuse retirée : " + filler);
assert.equal(validateStories([{ ...T, b3: "" , b3_en: "" }], inputs)[0].bullets.length, 2, "pas d'analyse : pas de puce");
assert.equal(validateStories([{ ...T, b2: "", b2_en: "", ctx: [2] }], inputs)[0].bullets.length, 2, "pas de second fait : pas de puce");
assert.deepEqual(validateStories([{ ...T, b2: "", b2_en: "", ctx: [2] }], inputs)[0].ctx, [], "sans puce de contexte, pas de source de contexte");
assert.equal(validateStories([{ ...T, b1: "Cela veut dire que Rubin arrive." }], inputs), null, "première puce creuse : histoire rejetée");
assert.equal(validateStories([{ ...T, b3_en: "This means that the schedule holds." }], inputs)[0].bullets.length, 2, "anglais creux : puce retirée des deux langues");

// regroupement : deux sujets sans rapport ne sont jamais réunis, même avec quelques mots communs
const mix = [
  mk("w1", 2, "OpenAI lance un portefeuille numérique pour les agents IA des centres de données", "OpenAI et ses agents.", { category: "modeles", layer: "Applications" }),
  mk("w2", 3, "Le portefeuille numérique d'OpenAI permet aux agents IA de payer", "Agents IA et paiements.", { category: "modeles", layer: "Applications" }),
  mk("l1", 4, "Le refroidissement liquide direct gagne les centres de données IA haute densité", "Refroidissement des centres de données IA.", { category: "energie", layer: "Datacenters" }),
  mk("l2", 5, "Refroidissement liquide : les centres de données IA haute densité l'adoptent", "Refroidissement liquide direct.", { category: "energie", layer: "Datacenters" }),
];
const stm = pickStories(mix, now, 5);
assert.equal(stm.length, 2, "deux sujets distincts");
assert.ok(stm.every((s) => s.items.every((a) => a.category === s.lead.category)), "aucune histoire ne mélange deux catégories");

// génération, conservation, régénération
let calls = 0;
const gen = (inp) => { calls++; return inp.map((x) => ({ i: x.i, head: "Titre " + "ABCDEFGH"[x.i], b1: "Détail.", b2: "Contexte sans annonce.", b3: "Analyse tirée des articles.", ctx: x.background.length ? [1] : [], head_en: "Title " + "ABCDEFGH"[x.i], b1_en: "Detail.", b2_en: "Context.", b3_en: "It could matter." })); };
let r1 = await makeFocus({ items, now, prev: null, generate: gen, modelName: () => "m" });
assert.equal(r1.regenerated, true); assert.equal(calls, 1); assert.equal(r1.doc.stories.length, 5);
assert.ok(r1.doc.stories.every((s) => s.ids.length >= 1 && s.bullets.length >= 2 && s.bullets_en.length === s.bullets.length && s.ts));
assert.ok(r1.doc.stories.some((s) => s.ids.length === 3), "les sources de l'histoire sont gardées (médias distincts)");
let r2 = await makeFocus({ items, now: now + H, prev: r1.doc, generate: gen });
assert.equal(r2.regenerated, false); assert.equal(calls, 1, "mêmes histoires : aucun nouvel appel");
let r3 = await makeFocus({ items, now: now + 7 * H, prev: r1.doc, generate: gen });
assert.equal(r3.regenerated, true, "plus de 6 h : régénéré"); assert.equal(calls, 2);
const items2 = [...items, mk("z", 0.5, "Événement majeur tout neuf sur les centres de données", "Un événement.", { category: "energie" }), mk("z2", 0.4, "Événement majeur tout neuf pour les centres de données", "Un événement.", { category: "energie" })];
let r4 = await makeFocus({ items: items2, now, prev: r1.doc, generate: gen });
assert.equal(r4.regenerated, true, "nouvelle histoire : régénéré");
const r5 = await makeFocus({ items, now: now + 8 * H, prev: r1.doc, generate: () => null });
assert.equal(r5.regenerated, false); assert.equal(r5.doc.stories.length, 5, "Gemini indisponible : dernier briefing conservé");
const r6 = await makeFocus({ items, now: now + 8 * H, prev: r1.doc, generate: () => [{ i: 1, head: "x", b1: "Gain de 999 %", b2: "y", b3: "z", ctx: [], head_en: "", b1_en: "", b2_en: "", b3_en: "" }] });
assert.equal(r6.regenerated, false); assert.match(r6.reason, /rejeté/);
const oldDoc = { items: [{ id: "a", why: "ancien format" }] };
const r7 = await makeFocus({ items, now, prev: oldDoc, generate: gen });
assert.equal(r7.regenerated, true, "ancien format de document : remplacé");
console.log("Tests « Briefing du jour » : OK");
