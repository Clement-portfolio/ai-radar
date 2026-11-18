// Tests des fiches de l'infrastructure : trimestres, fraîcheur, mise à jour automatique (SEC simulée, hors réseau).
import fs from "node:fs";
import assert from "node:assert/strict";
import { qOfEnd, idxOf, labelOf, dueIdx, staleCharts, updateChain, frDate } from "./chainauto.mjs";

const chain = JSON.parse(fs.readFileSync(new URL("../public/data/chain.json", import.meta.url), "utf8"));
const series = JSON.parse(fs.readFileSync(new URL("../public/data/series.json", import.meta.url), "utf8"));
const L = (e) => labelOf(qOfEnd(e));

// fin de période → trimestre calendaire (exercices décalés rattachés au trimestre précédent)
assert.equal(L("2024-10-27"), "T3 24"); assert.equal(L("2025-08-02"), "T2 25"); assert.equal(L("2026-01-31"), "T4 25");
assert.equal(L("2026-09-30"), "T3 26"); assert.equal(L("2025-12-28"), "T4 25"); assert.equal(L("2026-03-31"), "T1 26");
assert.equal(frDate("2026-11-04"), "4 nov. 2026");
// trimestre attendu : fin du trimestre + délai
assert.equal(labelOf(dueIdx(Date.parse("2026-11-18T12:00:00Z"), 50)), "T2 26");
assert.equal(labelOf(dueIdx(Date.parse("2026-11-20T12:00:00Z"), 50)), "T3 26");
assert.equal(labelOf(dueIdx(Date.parse("2026-11-20T12:00:00Z"), 75)), "T2 26");
// fraîcheur sur les vraies fiches : rien d'en retard le 18 nov. 2026, la fiche fonderie l'est le 20 nov.
assert.deepEqual(staleCharts(chain, Date.parse("2026-11-18T12:00:00Z")).map((s) => s.key), []);
const st = staleCharts(chain, Date.parse("2026-11-20T12:00:00Z"));
assert.ok(st.some((s) => s.key === "fab" && s.last === "T2 26" && s.due === "T3 26"), "fonderie en retard le 20 nov.");
assert.ok(!st.some((s) => s.key === "net"), "réseau (Nvidia décalé) pas encore en retard avec 75 jours");
assert.ok(!st.some((s) => s.key === "cool"), "refroidissement à jour");

// SEC simulée : trimestres de Vertiv, nVent et Modine, avec un nouveau T4 26
const cool = chain.fm.cool.chart;
const stub = (extra, mutate) => async (url) => {
  const m = /CIK(\d+)\/us-gaap\/(\w+)\.json/.exec(String(url));
  const byCik = { "0001674101": "Vertiv", "0001720635": "nVent", "0000067347": "Modine" };
  const name = m && byCik[m[1]];
  if (!name || m[2] !== "RevenueFromContractWithCustomerExcludingAssessedTax") return { ok: false, status: 404, text: async () => "{}" };
  const s = cool.ser.find((x) => x.n === name);
  const ends = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
  const rows = s.v.slice(1).map((v, i) => ({ end: ends[i], val: Math.round(v * 1e9) }));
  if (extra) rows.push({ end: "2026-12-31", val: Math.round(s.v[7] * 1.1 * 1e9) });
  if (mutate) mutate(name, rows);
  const facts = rows.map((r) => { const d = new Date(Date.parse(r.end) - 89 * 86400000).toISOString().slice(0, 10); return { start: d, end: r.end, val: r.val, form: "10-Q", filed: r.end === "2026-12-31" ? "2027-02-12" : "2026-10-30", accn: "x" }; });
  return { ok: true, status: 200, text: async () => JSON.stringify({ units: { USD: facts } }) };
};
const base = { chain, series, ua: "t", sleep: async () => {}, now: Date.parse("2027-02-20T12:00:00Z") };
let r = await updateChain({ ...base, fetchImpl: stub(true) });
assert.deepEqual(r.changes, [{ key: "cool", added: ["T4 26"] }]);
const c2 = r.chain.fm.cool;
assert.equal(c2.chart.x.join(), "T1 25,T2 25,T3 25,T4 25,T1 26,T2 26,T3 26,T4 26", "fenêtre glissée d'un trimestre");
assert.equal(c2.chart.ser[0].v.length, 8); assert.equal(c2.chart.ser[0].v[7], Math.round(cool.ser[0].v[7] * 1.1 * 1e4) / 1e4);
assert.equal(c2.pie.items[0].v, c2.chart.ser[0].v[7], "camembert = dernier point");
assert.ok(c2.pie.m.startsWith("T4 2026"), "libellé du camembert : " + c2.pie.m);
assert.equal(c2.chart.as_of, "12 févr. 2027"); assert.equal(chain.fm.cool.chart.x[7], "T3 26", "entrée non modifiée");
// pas de nouveau trimestre publié : rien ne change
r = await updateChain({ ...base, fetchImpl: stub(false) });
assert.equal(r.changes.length, 0); assert.ok(r.skipped.some((s) => s.key === "cool"));
// trimestre suivant trop récent : on ne cherche même pas
r = await updateChain({ ...base, now: Date.parse("2027-01-05T00:00:00Z"), fetchImpl: async () => { throw new Error("pas d'appel réseau attendu"); } });
assert.ok(r.skipped.some((s) => s.key === "cool" && /trop récent/.test(s.reason)));
// contrôle : un trimestre déjà affiché qui ne correspond plus à la SEC bloque la mise à jour
r = await updateChain({ ...base, fetchImpl: stub(true, (n, rows) => { if (n === "Vertiv") rows[6].val *= 1.2; }) });
assert.equal(r.changes.length, 0); assert.ok(r.skipped.some((s) => s.key === "cool" && /≠ SEC/.test(s.reason)), JSON.stringify(r.skipped));
// contrôle : une valeur aberrante (× 5) est refusée
r = await updateChain({ ...base, fetchImpl: stub(true, (n, rows) => { if (n === "Modine") rows[7].val *= 5; }) });
assert.equal(r.changes.length, 0); assert.ok(r.skipped.some((s) => /plage plausible/.test(s.reason)));
// sans identifiant SEC : jamais d'appel, jamais de changement
r = await updateChain({ ...base, ua: null, fetchImpl: async () => { throw new Error("non"); } });
assert.equal(r.changes.length, 0);

// fiche alimentée par la courbe capex : identique aujourd'hui, puis nouveau trimestre dans la courbe
r = await updateChain({ chain, series, now: Date.parse("2026-11-18T00:00:00Z") });
assert.ok(!r.changes.some((c) => c.key === "dc"), "capex déjà synchronisé");
const s2 = JSON.parse(JSON.stringify(series)), cx = s2.curves.find((c) => c.id === "capex");
for (const n of ["Amazon", "Alphabet", "Microsoft", "Meta"]) cx.series.find((s) => s.name === n).points.push({ d: "2026-12-31", v: 80 });
r = await updateChain({ chain, series: s2, now: Date.parse("2027-02-20T00:00:00Z") });
const dc = r.chain.fm.dc;
assert.deepEqual(r.changes, [{ key: "dc", added: ["T4 26"] }]);
assert.equal(dc.chart.x[7], "T4 26"); assert.equal(dc.chart.x[0], "T1 25"); assert.equal(dc.pie.items.find((i) => i.n === "Amazon").v, 80);
assert.ok(dc.pie.m.startsWith("T4 2026") && dc.pie.m.includes("≈ 320 Md$"), dc.pie.m);
assert.match(dc.chart.note, /Md\$ au T1 2025, 320 Md\$ au T4 2026/);
// dates différentes entre sociétés : rien
cx.series.find((s) => s.name === "Meta").points.pop();
r = await updateChain({ chain, series: s2, now: Date.parse("2027-02-20T00:00:00Z") });
assert.equal(r.changes.length, 0);
console.log("test-chainauto : OK");
