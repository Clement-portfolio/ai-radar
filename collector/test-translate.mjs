// Tests des traductions (hors réseau).
import assert from "node:assert/strict";
import { foreignScript, nonLatinShare, needsTranslation, applyTranslations, translateMissing } from "./translate.mjs";

assert.equal(foreignScript("川普訪華前，美國推進新規封堵晶片出口漏洞"), true);
assert.equal(foreignScript("日本経済新聞 NVIDIAファン氏退任"), true);
assert.equal(foreignScript("Nvidia livre sa nouvelle puce"), false);
assert.equal(foreignScript("Mistral AI lève 2 Md€ — 川普"), false, "quelques caractères isolés ne déclenchent pas");
assert.ok(nonLatinShare("") === 0);

const mk = (id, ts, title, o = {}) => ({ id, ts, title, orig: o.orig || title, summary: o.summary ?? "Résumé.", ...o });
const items = [
  mk("a", "2026-11-17T02:00:00Z", "川普訪華前，美國推進新規封堵晶片出口漏洞", { summary: "Les États-Unis durcissent les règles avant la visite.", orig: "川普訪華前，美國推進新規封堵晶片出口漏洞" }),
  mk("b", "2026-11-17T01:00:00Z", "Nvidia livre sa puce", { summary: "Livraison de 3 lots.", why: "Les clients cloud reçoivent la puce.", orig: "Nvidia ships its chip" }),
  mk("c", "2026-11-16T01:00:00Z", "Déjà traduit", { title_en: "Already translated" }),
  mk("d", "2026-11-17T03:00:00Z", "Non classé", { pending: true }),
];
assert.deepEqual(items.map(needsTranslation), [true, true, false, false], "titre non latin, version anglaise manquante, déjà faite, non classé");

let seen = null;
const gen = (inp) => { seen = inp; return inp.map((x) => x.i === 0
  ? { i: 0, title_fr: "Avant la visite de Trump en Chine, les États-Unis ferment une faille d'export de puces", title_en: "Before Trump's China trip, the US moves to close a chip export loophole", summary_en: "The US tightens rules before the visit.", why_en: "" }
  : { i: 1, title_fr: "Nvidia livre sa puce", title_en: "Nvidia ships its chip", summary_en: "Delivery of 3 batches.", why_en: "Cloud customers receive the chip." }); };
const r = await translateMissing({ items, generate: gen, max: 40, rounds: 1 });
assert.equal(r.changed, 2);
assert.equal(seen[0].i, 0, "titre non latin traité en premier");
assert.equal(items[0].title.startsWith("Avant la visite"), true, "titre chinois remplacé par le français");
assert.equal(items[0].orig, "川普訪華前，美國推進新規封堵晶片出口漏洞", "titre d'origine conservé");
assert.equal(items[0].title_en.startsWith("Before Trump"), true);
assert.equal(items[1].title, "Nvidia livre sa puce", "titre latin non modifié");
assert.equal(items[1].why_en, "Cloud customers receive the chip.");
assert.equal(items[2].title_en, "Already translated", "article déjà traduit intact");

// chiffre inventé : champ refusé ; titre encore non latin : refusé
const it2 = [mk("e", "2026-11-17T02:00:00Z", "川普訪華", { summary: "Résumé sans chiffre." })];
assert.equal((await translateMissing({ items: it2, generate: (inp) => [{ i: 0, title_fr: "Trump visite la Chine pour 500 milliards", title_en: "Trump visits China", summary_en: "x 999", why_en: "" }], rounds: 1 })).changed, 1);
assert.equal(it2[0].title, "Résumé sans chiffre", "titre français avec chiffre inventé : refusé, le résumé sert de titre");
assert.equal(it2[0].title_en, "Trump visits China");
assert.equal(it2[0].summary_en, undefined, "résumé anglais avec chiffre inventé : refusé");
const it3 = [mk("f", "2026-11-17T02:00:00Z", "川普訪華", { summary: "" })];
assert.equal((await translateMissing({ items: it3, generate: () => [{ i: 0, title_fr: "川普訪華", title_en: "川普訪華", summary_en: "", why_en: "" }], rounds: 1 })).changed, 0, "toujours non latin et sans résumé : rien d'appliqué");
const it4 = [mk("g", "2026-11-17T02:00:00Z", "川普訪華", { summary: "Avant la visite de Trump en Chine, les États-Unis resserrent les règles. Suite du texte." })];
await translateMissing({ items: it4, generate: () => [{ i: 0, title_fr: "川普訪華", title_en: "Trump visits China", summary_en: "", why_en: "" }], rounds: 1 });
assert.equal(it4[0].title, "Avant la visite de Trump en Chine, les États-Unis resserrent les règles", "secours : première phrase du résumé français");
assert.equal((await translateMissing({ items: it3, generate: () => null })).reason, "Gemini indisponible");
console.log("Tests traductions : OK");
