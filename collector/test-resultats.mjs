// Tests des communiqués de résultats (SEC), réservés aux chiffres clés (hors réseau).
import assert from "node:assert/strict";
import { htmlText, exhibitLink, pressText, collectResults } from "./resultats.mjs";

const now = Date.parse("2026-11-18T16:15:00Z");
const primary = `<html><body><p>Item 2.02 Results.</p><table><tr><td>99.1</td><td><a href="q3pr.htm">Press Release, dated November 17, 2026, entitled "Financial Results"</a></td></tr><tr><td>99.2</td><td><a href="cfo.htm">CFO Commentary</a></td></tr></table></body></html>`;
const exhibit = `<html><head><style>.x{}</style></head><body><p>EX-99.1 2 q3pr.htm EX-99.1 Document</p><p>NVIDIA Announces Financial Results</p><ul><li>&#8226; Revenue of $115.8 billion, up 103% from a year ago</li></ul><p>Diluted earnings per share were $2.70&#160;for the quarter.</p></body></html>`;
assert.equal(htmlText("<p>a&nbsp;b &amp; c</p><script>x()</script>"), "a b & c");
assert.equal(exhibitLink(primary, "main.htm"), "q3pr.htm", "le lien du communiqué (pièce 99.1) est choisi, pas le commentaire");
assert.equal(exhibitLink('<a href="https://x.com/a.htm">x</a><a href="only.htm">only</a>', "main.htm"), "only.htm", "lien relatif seulement");
assert.equal(exhibitLink("<p>rien</p>", "main.htm"), null);
const pt = pressText(exhibit);
assert.ok(pt.summary.startsWith("NVIDIA Announces Financial Results"), "en-tête technique retiré");
assert.match(pt.summary, /\$115\.8 billion, up 103%/); assert.match(pt.summary, /\$2\.70 for the quarter/);
assert.equal(pressText("<p>Exhibit 99.1 Microsoft Announces Results</p>").summary, "Microsoft Announces Results");
assert.equal(pressText("<p>" + "x".repeat(5000) + "</p>", 100).summary.length, 100);

const subs = (rows) => ({ filings: { recent: { form: rows.map((r) => r[0]), items: rows.map((r) => r[1]), filingDate: rows.map((r) => r[2]), acceptanceDateTime: rows.map((r) => r[2] + "T21:05:00.000Z"), accessionNumber: rows.map((r) => r[3]), primaryDocument: rows.map(() => "main.htm") } } });
const calls = [];
const http = async (u) => {
  calls.push(u);
  if (u.includes("CIK0001045810")) return subs([["8-K", "2.02,9.01", "2026-11-17", "0001045810-26-000088"], ["8-K", "5.02,9.01", "2026-11-12", "0001045810-26-000082"], ["4", "", "2026-11-06", "0001197647-26-000013"], ["8-K", "2.02", "2026-06-01", "0001045810-26-000001"]]);
  if (u.includes("CIK0000789019")) throw new Error("HTTP 503");
  if (u.endsWith("/main.htm")) return primary;
  if (u.endsWith("/q3pr.htm")) return exhibit;
  throw new Error("URL inattendue " + u);
};
const cfg = { edgarResults: { lookbackDays: 35, keepDays: 40, companies: [{ name: "Nvidia", cik: "1045810" }, { name: "Microsoft", cik: "789019" }] } };
const env = { SEC_USER_AGENT: "Test contact@example.com" };
const r = await collectResults({ cfg, env, http, now, prev: null, pause: 0 });
assert.equal(r.added, 1, "seul le 8-K de résultats (point 2.02) récent est retenu : ni le point 5.02, ni le formulaire 4, ni le 8-K de juin");
assert.equal(r.failed, 1, "un échec sur une entreprise n'arrête pas les autres");
const it = r.doc.items[0];
assert.equal(it.figonly, true); assert.equal(it.confidence, "haute"); assert.equal(it.importance, 3);
assert.equal(it.source, "Nvidia (communiqué de résultats, SEC)");
assert.equal(it.url, "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3pr.htm");
assert.equal(it.title, "Communiqué officiel de résultats trimestriels de Nvidia");
assert.match(it.summary, /115\.8 billion/); assert.equal(it.ts, "2026-11-17T21:05:00.000Z");
// déjà connu : pas de nouvel appel au communiqué ; ancien : purgé
const n0 = calls.length;
const r2 = await collectResults({ cfg, env, http, now: now + 1000, prev: r.doc, pause: 0 });
assert.equal(r2.added, 0); assert.equal(r2.doc.items.length, 1);
assert.ok(!calls.slice(n0).some((u) => u.endsWith("q3pr.htm")), "communiqué déjà stocké : non retéléchargé");
const r3 = await collectResults({ cfg, env, http, now: now + 60 * 86400000, prev: r.doc, pause: 0 });
assert.equal(r3.doc.items.length, 0, "au-delà de 40 jours : retiré");
// sans contact SEC ou sans configuration : rien, sans erreur
assert.equal((await collectResults({ cfg, env: {}, http, now, prev: null })).added, 0);
assert.equal((await collectResults({ cfg: {}, env, http, now, prev: null })).added, 0);
console.log("Tests communiqués de résultats : OK");
