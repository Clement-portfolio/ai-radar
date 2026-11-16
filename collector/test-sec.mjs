// Tests hors ligne du module SEC (XBRL) : calcul des douze derniers mois, choix de balise, échec et fraîcheur.
import assert from "node:assert/strict";
import { trailing, collectSec } from "./sec.mjs";

const e = (start, end, val, form, filed, accn = "0000000001-26-000001") => ({ start, end, val, form, filed, accn });
// exercice civil : 10-K 2025 + 9 mois 2026 − 9 mois 2025
const cal = [e("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01"), e("2026-01-01", "2026-09-30", 90, "10-Q", "2026-10-29", "0000000001-26-000084"), e("2025-01-01", "2025-09-30", 70, "10-Q", "2025-10-29"), e("2026-07-01", "2026-09-30", 40, "10-Q", "2026-10-29"), e("2026-01-01", "2026-06-30", 50, "10-Q", "2026-07-29")];
let t = trailing(cal);
assert.equal(t.value, 120); assert.equal(t.basis, "ttm"); assert.equal(t.end, "2026-09-30"); assert.equal(t.start, "2025-10-01"); assert.equal(t.accn, "0000000001-26-000084", "dépôt le plus récent cité");
// exercice décalé (juillet), premier trimestre : trimestre de 3 mois
const fy = [e("2025-07-01", "2026-06-30", 200, "10-K", "2026-07-30"), e("2026-07-01", "2026-09-30", 60, "10-Q", "2026-10-28"), e("2025-07-01", "2025-09-30", 50, "10-Q", "2025-10-29")];
t = trailing(fy); assert.equal(t.value, 210); assert.equal(t.end, "2026-09-30");
// pas de cumul comparable : dernier exercice, signalé « annual »
t = trailing([e("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01"), e("2026-01-01", "2026-09-30", 90, "10-Q", "2026-10-29")]);
assert.equal(t.basis, "annual"); assert.equal(t.value, 100);
// donnée republiée : on garde le dépôt le plus récent pour une même période
t = trailing([...cal, e("2026-01-01", "2026-09-30", 95, "10-Q/A", "2026-11-05")]); assert.equal(t.value, 125);
assert.equal(trailing([e("2026-01-01", "2026-09-30", 90, "10-Q", "2026-10-29")]), null, "sans 10-K : rien d'inventé");
assert.equal(trailing([]), null);

// collectSec : simulation de l'API
const now = Date.parse("2026-11-16T12:00:00Z"), noSleep = async () => {}; let calls = 0;
const mk = (concepts, fail) => async (url) => {
  calls++;
  if (fail) throw new Error("réseau");
  const m = String(url).match(/CIK(\d+)\/us-gaap\/(\w+)\.json/); const entries = concepts[m[2]];
  return entries ? { ok: true, status: 200, text: async () => JSON.stringify({ units: { USD: entries } }) } : { ok: false, status: 404, text: async () => "" };
};
const old = [e("2019-01-01", "2019-12-31", 5, "10-K", "2020-02-01")];
const concepts = { PaymentsToAcquirePropertyPlantAndEquipment: old, PaymentsToAcquireProductiveAssets: cal, Revenues: cal.map((x) => ({ ...x, val: x.val * 3 })) };
const co = [{ name: "Test Corp", cik: "42" }];
let r = await collectSec({ ua: "x", fetchImpl: mk(concepts), now, companies: co, sleep: noSleep });
const c0 = r.doc.companies[0];
assert.equal(c0.capex.value, 120, "balise abandonnée ignorée, balise récente retenue"); assert.equal(c0.capex.concept, "PaymentsToAcquireProductiveAssets");
assert.equal(c0.revenue.value, 360); assert.match(c0.capex.url, /Archives\/edgar\/data\/42\/000000000126000084\/0000000001-26-000084-index\.htm/); assert.equal(c0.capex.fetched_at, new Date(now).toISOString());
assert.equal(r.summary.ok, 1);
// moins de 20 h plus tard : aucune relecture
calls = 0; r = await collectSec({ ua: "x", fetchImpl: mk(concepts), prev: r.doc, now: now + 3600e3, companies: co, sleep: noSleep });
assert.equal(calls, 0); assert.equal(r.summary.skipped, 1);
// 2 jours plus tard, réseau en panne : l'ancien chiffre est conservé avec sa date d'origine
const prev = r.doc; r = await collectSec({ ua: "x", fetchImpl: mk(concepts, true), prev, now: now + 2 * 86400e3, companies: co, sleep: noSleep });
assert.equal(r.doc.companies[0].capex.value, 120); assert.equal(r.doc.companies[0].capex.fetched_at, new Date(now).toISOString()); assert.equal(r.summary.ko.length, 1); assert.equal(r.summary.refreshed, false);
// sans User-Agent : on ne touche à rien
r = await collectSec({ ua: "", fetchImpl: mk(concepts), prev, now, companies: co, sleep: noSleep });
assert.equal(r.summary.refreshed, false); assert.equal(r.doc, prev);
console.log("Tests SEC : OK");
