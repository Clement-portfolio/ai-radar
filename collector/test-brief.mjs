// Tests de la sélection des essentiels et du brief (hors réseau).
import assert from "node:assert/strict";
import { selectTop, validateBullets, makeBrief, hasNumberWords } from "./brief.mjs";

const now = Date.parse("2026-11-16T12:00:00Z");
const zones = ["US", "US", "US", "US", "US", "CN", "EU", "GULF", "OTHER"];
const layers = ["Puces", "Modèles", "Datacenters", "Énergie", "Financement", "Régulation", "Fonderie", "Applications"];
const items = [];
for (let k = 0; k < 40; k++) {
  items.push({ id: "id" + k, ts: new Date(now - (k % 20) * 3600e3).toISOString(), title: `Sujet unique numéro ${k} mot${k}a mot${k}b mot${k}c`, summary: `Résumé ${k}. Montant de ${100 + k} milliards.`, source: "Média " + (k % 7),
    country: zones[k % zones.length], layer: layers[k % layers.length], category: "adoption", importance: ["CN", "EU", "GULF"].includes(zones[k % zones.length]) ? 2 + (k % 2) : 1 + (k % 3), confidence: k % 5 === 0 ? "haute" : "moyenne" });
}
// même histoire relayée par deux médias : un seul article retenu, avec bonus de couverture
items.push({ ...items[2], id: "dup", source: "Autre média" });

const top = selectTop(items, now);
assert.equal(top.length, 10, "10 essentiels");
const byId = new Map(items.map((i) => [i.id, i]));
const picked = top.map((t) => byId.get(t.id));
assert.ok(["CN", "EU", "GULF"].every((z) => picked.some((p) => p.country === z)), "chaque zone représentée");
assert.ok(Object.values(picked.reduce((a, p) => ((a[p.country] = (a[p.country] || 0) + 1), a), {})).every((n) => n <= 4), "4 articles maximum par zone");
assert.ok(!(top.some((t) => t.id === "dup") && top.some((t) => t.id === items[2].id)), "même histoire jamais deux fois");
assert.ok(new Set(top.map((t) => t.id)).size === 10, "pas de doublon d'identifiant");

// validation : un chiffre absent des articles cités fait rejeter la puce
const inputs = [{ i: 1, title: "Nvidia investit 500 milliards", summary: "", source: "A" }, { i: 2, title: "Loi sur l'IA adoptée", summary: "Vote de 320 élus", source: "B" }, { i: 3, title: "Nouveau modèle publié", summary: "", source: "C" }, { i: 4, title: "Datacenter annoncé", summary: "", source: "D" }];
const good = [{ text: "Nvidia annonce 500 milliards d'investissements.", sources: [1] }, { text: "Une loi est adoptée par 320 élus.", sources: [2] }, { text: "Un nouveau modèle est publié.", sources: [3] }, { text: "Un datacenter est annoncé.", sources: [4] }];
assert.equal(validateBullets(good, inputs).length, 4);
assert.ok(hasNumberWords("AWS investit sept milliards de dollars") && hasNumberWords("soixante pour cent") && hasNumberWords("Cinq pays signent"), "nombres en lettres détectés");
assert.ok(!hasNumberWords("AWS investit 7 milliards de dollars") && !hasNumberWords("Hausse de 12 pour cent") && !hasNumberWords("3 millions d'utilisateurs"), "chiffres + échelle acceptés");
assert.equal(validateBullets([...good.slice(0, 3), { text: "Nvidia vend cinq millions de puces.", sources: [1] }], inputs).length, 3, "puce à nombre en lettres rejetée");
assert.equal(validateBullets([...good.slice(0, 2), { text: "Nvidia annonce 900 milliards.", sources: [1] }, { text: "Source inexistante.", sources: [9] }], inputs), null, "chiffre inventé et source inconnue rejetés");

// régénération : seulement si l'essentiel change ou si le brief a plus de 6 h
let calls = 0;
const five = (inp) => { calls++; return inp.slice(0, 5).map((x) => ({ text: `Point ${"abcde"[x.i - 1]}.`, sources: [x.i] })); };
const r1 = await makeBrief({ items, now, prev: null, generate: five, modelName: () => "m" });
assert.ok(r1.regenerated && r1.doc.bullets.length === 5 && r1.doc.bullets.every((b) => b.ids.every((id) => byId.has(id))), "brief généré avec identifiants d'articles");
const r2 = await makeBrief({ items, now: now + 3600e3, prev: r1.doc, generate: five });
assert.ok(!r2.regenerated && calls === 1, "essentiel inchangé : pas d'appel Gemini");
const r3 = await makeBrief({ items, now: now + 7 * 3600e3, prev: r1.doc, generate: null });
assert.ok(!r3.regenerated && r3.doc.bullets.length === 5, "Gemini indisponible : dernier brief conservé");
const r4 = await makeBrief({ items, now: now + 7 * 3600e3, prev: r1.doc, generate: () => [{ text: "Invention de 777.", sources: [1] }] });
assert.ok(!r4.regenerated && r4.doc.bullets.length === 5, "réponse non conforme : dernier brief conservé");
console.log("Tests brief : OK");
