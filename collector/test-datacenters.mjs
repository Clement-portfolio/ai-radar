// Tests hors ligne de la carte des datacenters : lecture du CSV Epoch, étiquettes de confiance, jalons à venir, coordonnées, repli.
import assert from "node:assert/strict";
import { parseCsv, splitTag, firstSource, futureOf, buildDatacenters, collectDatacenters } from "./datacenters.mjs";

// CSV : guillemets, virgules, retours à la ligne et guillemets doublés dans un champ
const rows = parseCsv('Name,Note,N\r\n"A, B","ligne 1\nligne ""2""",3\nC,,4\n');
assert.equal(rows.length, 2); assert.equal(rows[0].Name, "A, B"); assert.equal(rows[0].Note, 'ligne 1\nligne "2"'); assert.equal(rows[1].Note, "");
assert.equal(parseCsv("﻿x,y\n1,2")[0].x, "1", "BOM ignoré");

// Étiquettes de confiance d'Epoch
assert.deepEqual(splitTag("Cipher Mining #confident"), { text: "Cipher Mining", conf: "confident" });
assert.deepEqual(splitTag("OpenAI, Microsoft #likely"), { text: "OpenAI, Microsoft", conf: "likely" });
assert.deepEqual(splitTag(""), { text: "", conf: null });
assert.deepEqual(firstSource("- [Cipher signs deal](https://globenewswire.com/x) - [autre](https://b.com)"), { t: "Cipher signs deal", u: "https://globenewswire.com/x" });
assert.equal(firstSource("- [lien http](http://x.com)"), null, "https seulement");
assert.equal(firstSource("_Sources withheld_"), null);

// Jalons à venir : après aujourd'hui, avec une puissance, triés
const NOW = Date.parse("2026-11-19T00:00:00Z");
const tl = [
  { Date: "2025-06-23", "IT power (MW)": "478", "H100 equivalents": "300151", "Construction status": "passé" },
  { Date: "2028-03-17", "IT power (MW)": "2310", "H100 equivalents": "1746038", "Construction status": "Buildings 19-32 operational" },
  { Date: "2026-12-01", "IT power (MW)": "1244", "H100 equivalents": "818428", "Construction status": "Buildings 17-18" },
  { Date: "2027-05-01", "IT power (MW)": "0", "H100 equivalents": "0", "Construction status": "sans puissance" },
];
const fu = futureOf(tl, NOW);
assert.deepEqual(fu.map((x) => x.d), ["2026-12-01", "2028-03-17"]); assert.equal(fu[1].mw, 2310); assert.equal(fu[0].h100e, 818428);

// Document : sites sans coordonnées comptés, pas affichés ; tri par puissance ; pic seulement s'il dépasse l'existant
const sites = [
  { Name: "Gros Site", Owner: "Amazon #confident", Users: "Anthropic #likely", Country: "United States", "Current power (MW)": "1037", "Current H100 equivalents": "818428.4", "Current total capital cost (2025 USD billions)": "12.34", "Current chip types": "Trainium2", "Selected Sources": "- [Presse](https://ex.com/a)" },
  { Name: "Petit Site", Owner: "Meta", Country: "United States", "Current power (MW)": "100", "Current H100 equivalents": "1000", "Selected Sources": "_withheld_" },
  { Name: "Sans Coordonnées", Country: "France", "Current power (MW)": "5" },
];
const tls = tl.map((r) => ({ ...r, "Data center": "Gros Site" }));
const geo = { "Gros Site": { lat: 41.7, lon: -86.5, prec: "adresse" }, "Petit Site": { lat: 40, lon: -80, prec: "commune" } };
const doc = buildDatacenters({ sites, timelines: tls, geo, now: NOW });
assert.equal(doc.sites.length, 2); assert.equal(doc.unplaced, 1);
assert.deepEqual(doc.sites.map((s) => s.name), ["Gros Site", "Petit Site"]);
const g = doc.sites[0];
assert.equal(g.owner, "Amazon"); assert.equal(g.owner_conf, "confident"); assert.equal(g.users, "Anthropic"); assert.equal(g.mw, 1037); assert.equal(g.cost_bn, 12.3);
assert.equal(g.next.d, "2026-12-01"); assert.equal(g.peak.mw, 2310); assert.equal(g.src.u, "https://ex.com/a");
assert.equal(doc.sites[1].peak, null); assert.equal(doc.sites[1].src, null); assert.equal(doc.sites[1].prec, "commune");
assert.equal(doc.source.license, "CC BY 4.0");

// Collecte : colonnes changées → erreur claire ; coordonnées déjà connues reprises sans nouvelle requête
const csv = (rows) => { const h = Object.keys(rows[0]); return [h.join(","), ...rows.map((r) => h.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n"); };
const many = Array.from({ length: 60 }, (_, i) => ({ Name: "S" + i, Owner: "X", Country: "United States", Address: "", "Current power (MW)": String(100 + i), "Current H100 equivalents": "1", "Current total capital cost (2025 USD billions)": "1", "Selected Sources": "" }));
const seed = Object.fromEntries(many.map((m, i) => [m.Name, { lat: 30 + (i % 10), lon: -90 + i, prec: "commune" }]));
let calls = [];
const fetchOk = async (u) => { calls.push(u); return { ok: true, status: 200, text: async () => (u.includes("timelines") ? csv([{ "Data center": "S0", Date: "2028-01-01", "IT power (MW)": "900", "H100 equivalents": "5", "Construction status": "x" }]) : csv(many)) }; };
const res = await collectDatacenters({ fetchImpl: fetchOk, seed, now: NOW });
assert.equal(res.doc.sites.length, 60); assert.equal(res.summary.geocoded, 0); assert.ok(calls.every((u) => u.startsWith("https://epoch.ai/")), "aucun géocodage quand tout est connu");
assert.equal(res.doc.sites.find((s) => s.name === "S0").peak.mw, 900);
await assert.rejects(() => collectDatacenters({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => "a,b\n1,2" }), now: NOW }), /illisible/);
await assert.rejects(() => collectDatacenters({ fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }), now: NOW }), /503/);
await assert.rejects(() => collectDatacenters({ fetchImpl: fetchOk, seed: {}, now: NOW }), /localisé/, "trop de sites sans coordonnées : on garde l'ancienne carte");
console.log("  datacenters : lecture CSV, étiquettes, jalons, coordonnées, repli OK");
