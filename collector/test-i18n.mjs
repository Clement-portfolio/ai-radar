// Tests de la traduction des données (hors réseau).
import assert from "node:assert/strict";
import { collectStrings, validEn, translateData } from "./i18n.mjs";

const docs = [{ tiles: [{ name: "Nvidia", note: "Demande IA supérieure à l'offre ; capex 2026 de 60–64 Md$", url: "https://x.example/a", as_of: "15 oct. 2026", source: "SEC (10-K et 10-Q)" }], title: "Qui dépense le plus en capex", n: 12 }, { x: "Anthropic", y: ["Part du marché · T2 2026", "ok"] }];
const s = collectStrings(docs);
assert.deepEqual([...s].sort(), ["Demande IA supérieure à l'offre ; capex 2026 de 60–64 Md$", "Part du marché · T2 2026", "Qui dépense le plus en capex", "SEC (10-K et 10-Q)"].sort(), "textes français seulement, sans noms propres, liens ni dates");

assert.equal(validEn("capex 2026 de 60–64 Md$", "2026 capex of 60–64 bn$"), true);
assert.equal(validEn("capex 2026 de 60–64 Md$", "2026 capex of 70–74 bn$"), false, "chiffres changés : refusé");
assert.equal(validEn("de 1,5 Md$", "of 1.5 bn$"), true, "séparateur décimal différent : accepté");
assert.equal(validEn("Qui dépense", "谁花钱"), false);
assert.equal(validEn("Qui dépense", ""), false);

let calls = 0;
const gen = (inp) => { calls++; return inp.map((x) => ({ i: x.i, en: x.fr.startsWith("Qui") ? "Who spends the most on capex" : x.fr.startsWith("SEC") ? "SEC (10-K and 10-Q)" : x.fr.startsWith("Part") ? "Market share · Q2 2026" : "AI demand above supply; 2026 capex of 99–64 bn$" })); };
let r = await translateData({ docs, prev: { "texte disparu": "gone" }, generate: gen, batch: 50, rounds: 3 });
assert.equal(r.dict["Qui dépense le plus en capex"], "Who spends the most on capex");
assert.equal(r.dict["Demande IA supérieure à l'offre ; capex 2026 de 60–64 Md$"], undefined, "traduction avec chiffre inventé : refusée");
assert.equal(r.dict["texte disparu"], undefined, "texte qui n'existe plus : retiré");
assert.equal(r.added, 3); assert.equal(r.left, 1);
const r2 = await translateData({ docs, prev: r.dict, generate: gen });
assert.equal(r2.added, 0, "déjà traduits : le texte refusé est retenté mais reste refusé");
assert.equal((await translateData({ docs, prev: r.dict, generate: null })).reason, "Gemini indisponible");
assert.equal((await translateData({ docs: [{ a: "Nvidia" }], prev: {}, generate: gen })).reason, "rien à traduire");
const rb = await translateData({ docs, prev: {}, generate: (inp) => inp.map((x) => ({ i: x.i, en: x.fr })), batch: 2, rounds: 1 });
assert.equal(rb.added, 2, "lots : un seul lot de 2 par tour");
console.log("Tests traduction des données : OK");
