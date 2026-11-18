// Tests hors ligne des fiches acteurs : parsing, règles de rang et de parts, fiches curées, cohérence du seed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseActor, parseRelease, nameRe, slug, buildActeurs } from "./acteurs.mjs";

// noms ambigus : sensibles à la casse
assert.ok(nameRe(["Arm"]).test("Arm unveils a new core") && !nameRe(["Arm"]).test("the arm of the robot"), "Arm sensible à la casse");
assert.ok(nameRe(["Meta"]).test("Meta signs a deal") && !nameRe(["Meta"]).test("a meta-analysis"), "Meta sensible à la casse");
assert.equal(slug("SK hynix"), "sk-hynix");

// communiqué de résultats
const r = parseRelease("NVIDIA today reported revenue for the quarter ended October 25, 2026, of $115.8 billion, up 20% from the previous quarter and up 103% from a year ago.");
assert.ok(r, "communiqué lu"); assert.deepEqual([r.value, r.qoq, r.yoy, r.end], [115.8e9, 20, 103, "2026-10-25"]);
assert.equal(parseRelease("Rien de chiffré ici."), null, "texte sans chiffre : rien d'inventé");

// seed : cohérence de chaque fiche
const doc = JSON.parse(fs.readFileSync(new URL("../public/data/acteurs.json", import.meta.url), "utf8"));
assert.ok(doc.actors.length >= 60);
const ids = new Set(doc.actors.map((a) => a.id)); assert.equal(ids.size, doc.actors.length, "identifiants uniques");
for (const a of doc.actors) {
  assert.ok(a.n && a.pays && a.roles.length, a.id + " : nom, pays, rôle");
  assert.ok((a.markets || []).length <= 3, a.id + " : 3 camemberts au plus");
  for (const m of a.markets || []) { assert.ok(m.src && m.u, a.id + " : part sourcée"); assert.ok(m.items.every((x) => x.v >= 0 && x.v <= 100), a.id + " : parts en %"); }
  assert.ok(a.news.length <= 5);
  for (const g of a.rivals || []) for (const id of g.ids) assert.ok(ids.has(id) && id !== a.id, a.id + " : concurrent connu et différent");
  const q = a.fin && a.fin.quarter; if (q) { assert.ok(q.value > 0 && q.url && q.end, a.id + " : trimestre sourcé et daté"); }
  for (const c of a.clients || []) assert.ok(c.src && c.u, a.id + " : client sourcé");
  if (a.rank) assert.ok(a.rank.src && a.rank.u, a.id + " : rang sourcé");
}
const nv = doc.actors.find((a) => a.id === "nvidia");
assert.equal(nv.fin.quarter.value > 1e11, true, "Nvidia : trimestre > 100 Md$");
assert.equal(doc.actors.find((a) => a.id === "tsmc").clients_ranked, true);
assert.equal(doc.actors.find((a) => a.id === "nvidia").clients_ranked, false, "Nvidia : ordre non publié");
console.log("test-acteurs OK");
