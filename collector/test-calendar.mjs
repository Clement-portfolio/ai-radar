// Calendrier : lecture du prix « Oui » des paris, conservation des valeurs en cas d'échec.
import assert from "node:assert/strict";
import { yesPct, refreshCalendar } from "./calendar.mjs";
const ev = { markets: [
  { question: "Will the Fed increase interest rates by 25 bps after the December 2026 meeting?", outcomes: '["Yes","No"]', outcomePrices: '["0.915","0.085"]' },
  { question: "Will there be no change in Fed interest rates after the December 2026 meeting?", outcomes: '["No","Yes"]', outcomePrices: '["0.97","0.03"]' },
] };
assert.equal(yesPct(ev, "increase interest rates by 25 bps"), 91.5);
assert.equal(yesPct(ev, "no change in Fed"), 3);
assert.equal(yesPct(ev, "introuvable"), null);
const doc = () => ({ catalysts: [{ title: "Fed", probs: [{ label: "Hausse", p: 10, poll: { slug: "a", match: "increase" } }, { label: "Statu quo", p: 5, poll: { slug: "a", match: "no change" } }] }, { title: "sans pari" }] });
let calls = 0;
const ok = async () => { calls++; return { ok: true, json: async () => [ev] }; };
let d = doc(), r = await refreshCalendar({ doc: d, fetchImpl: ok, now: Date.parse("2026-11-17T10:00:00Z") });
assert.equal(r.changed, 2); assert.equal(calls, 1, "un seul appel par événement"); assert.equal(d.catalysts[0].probs[0].p, 91.5); assert.equal(d.catalysts[0].probs_at, "2026-11-17T10:00Z"); assert.equal(d.catalysts[1].probs_at, undefined);
d = doc(); r = await refreshCalendar({ doc: d, fetchImpl: async () => ({ ok: false, status: 503 }) });
assert.equal(r.errors.length, 2); assert.equal(d.catalysts[0].probs[0].p, 10, "valeur conservée si le service ne répond pas"); assert.equal(d.catalysts[0].probs_at, undefined);
console.log("Tests calendrier : OK");
