// Tests de « À retenir » (hors réseau).
import assert from "node:assert/strict";
import { pickFocus, relatedFor, validateFocus, makeFocus } from "./focus.mjs";

const now = Date.parse("2026-11-16T12:00:00Z");
const H = 3600e3, D = 24 * H;
const mk = (id, ageH, title, summary, o = {}) => ({ id, ts: new Date(now - ageH * H).toISOString(), title, summary, source: "S" + id, country: "US", category: "puces", layer: "Puces", importance: 3, confidence: "haute", ...o });
const items = [
  mk("a", 3, "Nvidia livre sa nouvelle puce Rubin aux clients cloud", "Nvidia annonce la livraison de Rubin, 3 fois plus rapide.", { category: "puces" }),
  mk("a0", 20 * 24, "Nvidia dévoile la puce Rubin pour les centres de données", "Rubin doit succéder à Blackwell chez Nvidia.", { importance: 2 }),
  mk("a1", 60 * 24, "Nvidia confirme que Rubin arrivera avant la fin de l'année", "Calendrier de Rubin avancé.", { importance: 2 }),
  mk("b", 5, "Les États-Unis durcissent les licences d'exportation de puces vers la Chine", "Washington impose des licences pour l'accès à distance.", { category: "regul", layer: "Régulation" }),
  mk("c", 6, "OpenAI lève 40 milliards de dollars", "Un tour de table de 40 milliards de dollars.", { category: "capex", layer: "Financement" }),
  mk("d", 7, "Un petit sujet mineur sur la mode", "Rien à voir.", { importance: 1, category: "adoption" }),
];
for (let k = 0; k < 25; k++) items.push(mk("f" + k, 8 + k, `Autre sujet distinct numéro ${k} mot${k}x mot${k}y mot${k}z`, `Résumé ${k}.`, { importance: 1, category: "adoption" }));

// sélection : importance haute, une catégorie par place, pas de mineur
const picks = pickFocus(items, now, 3);
assert.ok(picks.length >= 2 && picks.length <= 3 && picks.every((p) => p.importance >= 2), "2 à 3 actualités importantes");
assert.equal(new Set(picks.map((p) => p.category)).size, picks.length, "catégories distinctes");

// remise en contexte : articles plus anciens sur le même sujet seulement
const rel = relatedFor(items[0], items, now);
assert.deepEqual(rel.map((o) => o.id), ["a1", "a0"], "plus anciens, même sujet, du plus ancien au plus récent");
assert.deepEqual(relatedFor(items[3], items, now), [], "aucun article lié : pas de contexte");

// validation : nombres vérifiés, contexte retiré s'il invente
const inputs = [{ i: 1, title: items[0].title, summary: items[0].summary, background: [{ j: 1, title: items[2].title, summary: items[2].summary }, { j: 2, title: items[1].title, summary: items[1].summary }] }];
const good = validateFocus([{ i: 1, why: "Les clients cloud reçoivent une puce 3 fois plus rapide.", context: "Rubin avait été annoncée pour succéder à Blackwell.", ctx: [2] }], inputs);
assert.equal(good[0].context.startsWith("Rubin"), true);
assert.equal(validateFocus([{ i: 1, why: "Gain de 777 % attendu.", context: "", ctx: [] }], inputs), null, "nombre inventé dans le pourquoi : rejeté");
const badCtx = validateFocus([{ i: 1, why: "Une puce plus rapide.", context: "Lancée en 1999 déjà.", ctx: [1] }], inputs);
assert.equal(badCtx[0].context, "", "contexte inventé : retiré, le pourquoi reste");
assert.equal(validateFocus([{ i: 1, why: "Trois fois plus rapide.", context: "", ctx: [] }], inputs), null, "nombre en toutes lettres : rejeté");
assert.equal(validateFocus([{ i: 1, why: "Une puce plus rapide.", context: "Avant.", ctx: [9] }], inputs)[0].context, "", "source de contexte inconnue : contexte retiré");

// génération, conservation, régénération
let calls = 0;
const gen = (inp) => { calls++; return inp.map((x) => ({ i: x.i, why: "Pourquoi c'est important.", context: x.background.length ? "Contexte." : "", ctx: x.background.length ? [1] : [] })); };
const r1 = await makeFocus({ items, now, prev: null, generate: gen, modelName: () => "m" });
assert.ok(r1.regenerated && r1.doc.items.length >= 2 && r1.doc.items.every((x) => x.why), "généré");
assert.ok(r1.doc.items.some((x) => x.context && x.ctx_ids.length), "contexte avec identifiants d'articles");
const r2 = await makeFocus({ items, now: now + H, prev: r1.doc, generate: gen });
assert.ok(!r2.regenerated && calls === 1, "inchangé : pas d'appel");
const r3 = await makeFocus({ items, now: now + 7 * H, prev: r1.doc, generate: null });
assert.ok(!r3.regenerated && r3.doc.items.length === r1.doc.items.length, "Gemini indisponible : conservé");
const r4 = await makeFocus({ items, now: now + 7 * H, prev: r1.doc, generate: () => [{ i: 1, why: "Gain de 999 %.", context: "", ctx: [] }] });
assert.ok(!r4.regenerated, "réponse non conforme : conservé");
console.log("Tests « À retenir » : OK");
