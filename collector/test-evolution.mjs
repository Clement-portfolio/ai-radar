// Tests hors ligne de la section Évolution : lecture de CSV et de .xlsx, calculs, contrôles, repli et cadence.
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { parseCsv, unzip, readXlsx, ownersPie, designersPie, salesCurve, trainRecords, btosSeries, secCurves, collectEvolution } from "./evolution.mjs";
import { quarterly } from "./sec.mjs";
import { parseHbmHistory } from "./shares.mjs";

const NOW = Date.parse("2026-11-16T12:00:00Z"), DAY = 86400000;

// ── CSV
const c = parseCsv('A,B,C\n1,"x, y",3\n"deux ""guillemets""","ligne\nsuivante",6\n');
assert.equal(c.length, 2); assert.equal(c[0].B, "x, y"); assert.equal(c[1].A, 'deux "guillemets"'); assert.equal(c[1].B, "ligne\nsuivante");

// ── zip + xlsx construits à la main (une entrée « stockée », une « deflate »)
function zip(files) {
  const loc = [], cen = []; let off = 0;
  for (const [name, [data, method]] of Object.entries(files)) {
    const raw = Buffer.from(data), body = method === 8 ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    loc.push(lh, nm, body); cen.push(ch, nm); off += 30 + nm.length + body.length;
  }
  const cd = Buffer.concat(cen), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(Object.keys(files).length, 8); eo.writeUInt16LE(Object.keys(files).length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cd, eo]);
}
const serial = (d) => (Date.parse(d) - Date.UTC(1899, 11, 30)) / DAY;
function xlsx({ waves = 14, wording = "In the last two weeks, did this business use Super Intelligence or SI (formerly referred to as Artificial Intelligence or AI) in any of its business functions?", oldVals = 0 } = {}) {
  const S = []; const sid = (t) => { let i = S.indexOf(t); if (i < 0) { S.push(t); i = S.length - 1; } return i; };
  const col = (i) => String.fromCharCode(65 + i);
  const smp = Array.from({ length: waves }, (_, k) => String(202517 + k)).reverse(); // plus récente d'abord, comme le vrai fichier
  const cell = (r, i, v, str = true) => v === null ? "" : str ? `<c r="${col(i)}${r}" t="s"><v>${sid(v)}</v></c>` : `<c r="${col(i)}${r}"><v>${v}</v></c>`;
  const row = (r, vals) => `<row r="${r}">${vals.map((v, i) => cell(r, i, v)).join("")}</row>`;
  const val = (k, base) => (base + (waves - 1 - k) * 0.5).toFixed(1) + "%"; // k = rang dans smp (0 = récent)
  const est = [row(1, ["Question ID", "Question", "Answer ID", "Answer", ...smp]),
    row(2, ["3", "Overall, how would you describe this business's current performance?", "1", "Excellent", ...smp.map(() => "12.8%")]),
    row(3, ["7", wording, "1", "Yes", ...smp.map((_, k) => (k >= waves - oldVals ? "." : val(k, 17)))]),
    row(4, ["7", wording, "2", "No", ...smp.map(() => "60.0%")]),
    row(5, ["28", "During the next six months, do you think this business will be using Super Intelligence or SI (formerly referred to as Artificial Intelligence or AI) in any of its business functions?", "1", "Yes", ...smp.map((_, k) => val(k, 21))])].join("");
  const dRows = [`<row r="1">${["Sample Year", "Cycle", "Panel", "Smpdt", "Collection Start", "Col End"].map((h, i) => cell(1, i, h)).join("")}</row>`]
    .concat(smp.slice().reverse().map((w, k) => `<row r="${k + 2}">${cell(k + 2, 3, w)}<c r="F${k + 2}"><v>${serial(new Date(Date.parse("2025-11-02") + k * 14 * DAY).toISOString().slice(0, 10))}</v></c></row>`)).join("");
  const sheet = (rows) => `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;
  const est1 = sheet(est), dts = sheet(dRows);
  return zip({
    "[Content_Types].xml": ["<Types/>", 0],
    "xl/workbook.xml": ['<workbook><sheets><sheet name="Response Estimates" sheetId="1" r:id="rId1"/><sheet name="Collection and Reference Dates" sheetId="2" r:id="rId2"/></sheets></workbook>', 0],
    "xl/_rels/workbook.xml.rels": ['<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>', 0],
    "xl/worksheets/sheet1.xml": [est1, 8],
    "xl/worksheets/sheet2.xml": [dts, 0],
    "xl/sharedStrings.xml": [`<sst>${S.map((t) => `<si><t>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`, 8],
  });
}
const zf = unzip(zip({ "a.txt": ["bonjour", 0], "b/c.txt": ["x".repeat(500), 8] }));
assert.equal(zf.get("a.txt").toString(), "bonjour"); assert.equal(zf.get("b/c.txt").length, 500);
assert.throws(() => unzip(Buffer.from("pas un zip du tout, vraiment pas")), /zip/);
const wb = readXlsx(xlsx());
assert.ok(wb["Response Estimates"] && wb["Collection and Reference Dates"]); assert.equal(wb["Response Estimates"][0][4], "202530");

// ── BTOS : la série, la prévision, l'ordre chronologique malgré l'ordre du fichier
const b = btosSeries(xlsx(), Date.parse("2026-05-20T00:00:00Z"));
assert.equal(b.series.length, 2); assert.equal(b.series[0].points.length, 14);
assert.ok(b.series[0].points.every((p, i, a) => i === 0 || a[i - 1].d < p.d), "dates croissantes");
assert.equal(b.series[0].points[0].v, 17); assert.equal(b.series[0].points[13].v, 23.5);
assert.ok(b.series[1].dashed);
assert.equal(btosSeries(xlsx({ oldVals: 3 }), Date.parse("2026-05-20T00:00:00Z")).series[0].points.length, 11, "« . » = pas de valeur, pas de point");
assert.throws(() => btosSeries(xlsx(), Date.parse("2027-05-20T00:00:00Z")), /trop ancienne/, "fichier abandonné refusé");
assert.throws(() => btosSeries(xlsx({ wording: "Combien de chats ?" }), Date.parse("2026-05-20T00:00:00Z")), /introuvable/, "question changée : échec plutôt que mauvaise ligne");
assert.throws(() => btosSeries(zip({ "x": ["y", 0] }), NOW), /feuilles|zip|introuvable/);

// ── Epoch : propriétaires, concepteurs, ventes
const own = (rows) => "Name,Chip manufacturer,Owner,Start date,End date,Compute estimate in H100e (median),Incomplete\n" + rows.map((r) => r.join(",")).join("\n");
const O = (owner, end, v, inc = "") => ["x", "Nvidia", owner, "2022-01-01", end, v, inc];
const owners5 = (end, scale = 1, inc = "") => [O("Google", end, 24 * scale, inc), O("Microsoft", end, 16 * scale, inc), O("Amazon", end, 12 * scale, inc), O("Meta", end, 11 * scale, inc), O("Oracle", end, 5.5 * scale, inc), O("Other", end, 16 * scale, inc), O("China", end, 5.5 * scale, inc), O("xAI", end, 10 * scale, inc)];
let csv = own([...owners5("2025-12-31", 1e6), ...owners5("2026-03-31", 1e6, "True").slice(0, 3)]);
let r = ownersPie(csv, NOW);
assert.equal(r.end, "2025-12-31", "le trimestre incomplet est ignoré");
assert.deepEqual(r.segments.map((s) => s.label), ["Google", "Microsoft", "Amazon", "Meta", "Oracle", "Autres propriétaires"]);
assert.ok(Math.abs(r.segments.reduce((a, s) => a + s.pct, 0) - 100) < 0.11);
assert.equal(r.segments[0].pct, 24, "Google = 24 sur un total de 100");
assert.throws(() => ownersPie(own(owners5("2025-12-31", 1e6).filter((x) => x[2] !== "Oracle")), NOW), /Oracle/);
assert.throws(() => ownersPie(own(owners5("2024-01-31", 1e6)), NOW), /trop ancien/);
assert.throws(() => ownersPie(own(owners5("2025-12-31", 1e6, "True")), NOW), /aucun trimestre complet/);
const sale = (m, end, v, inc = "") => ["x", m, "2026-01-01", end, inc, v];
const salesCsv = (extra = []) => "Name,Chip manufacturer,Start date,End date,Incomplete,Compute estimate in H100e (median)\n" + [...["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"].flatMap((e, k) => [sale("Nvidia", e, 2e6 + k * 1e5), sale("Google", e, 8e5), sale("AMD", e, 2e5), sale("Amazon", e, 2e5), sale("Huawei", e, 1e5), sale("Cambricon", e, 1e4)]), ...extra].map((x) => x.join(",")).join("\n");
const dsg = designersPie(salesCsv([sale("Nvidia", "2026-09-30", 1e6, "True"), sale("Google", "2026-09-30", 1e6, "True")]), NOW);
assert.equal(dsg.end, "2026-06-30"); assert.equal(dsg.segments[0].label, "Nvidia"); assert.ok(!dsg.segments.find((s) => s.label === "Autres"), "reste inférieur à 0,4 point : pas de tranche « Autres »");
assert.ok(designersPie(salesCsv([sale("Cambricon", "2026-06-30", 3e5)]), NOW).segments.find((s) => s.label === "Autres"), "un reste notable devient « Autres »");
const sc = salesCurve(salesCsv([sale("Nvidia", "2026-09-30", 1e6, "True")]), NOW);
assert.equal(sc.last, "2026-06-30"); assert.equal(sc.series.length, 5); assert.equal(sc.series[0].points.length, 6); assert.equal(sc.series[0].points[0].v, 2);
assert.throws(() => salesCurve("Name,Chip manufacturer,Start date,End date,Incomplete,Compute estimate in H100e (median)\nx,Nvidia,a,2026-06-30,,5", NOW), /quatre/);

// ── records de compute d'entraînement
const mdl = (d, v, n) => `${n},${d},${v}`;
const mcsv = (rows) => "Model,Publication date,Training compute (FLOP)\n" + rows.join("\n");
const rec = trainRecords(mcsv([mdl("2019-02-14", "1.5e21", "GPT-2"), mdl("2020-05-28", "3.1e23", "GPT-3"), mdl("2020-06-01", "1e22", "petit"), mdl("2022-04-04", "2.5e24", "PaLM"), mdl("2023-03-15", "2.1e25", "GPT-4"), mdl("2024-12-01", "9e24", "moins"), mdl("2025-02-17", "3.5e26", "Grok 3"), mdl("2026-09-03", "9.4e26", "GPT-6"), mdl("2027-01-01", "1e28", "futur"), mdl("2025-05-05", "", "vide")]), NOW);
assert.deepEqual(rec.map((x) => x.name), ["GPT-2", "GPT-3", "PaLM", "GPT-4", "Grok 3", "GPT-6"], "uniquement les records, rien dans le futur");
assert.throws(() => trainRecords(mcsv([mdl("2020-05-28", "3.1e23", "GPT-3")]), NOW), /trop peu/);

// ── SEC : trimestres publiés ou différence de cumuls, jamais estimés
const E = (start, end, val, form = "10-Q", filed = "2026-01-01") => ({ start, end, val, form, filed });
const q = quarterly([
  E("2025-07-01", "2025-09-30", 20), E("2025-07-01", "2025-12-31", 45), E("2025-07-01", "2026-03-31", 75),
  E("2024-07-01", "2025-03-31", 66, "10-Q"), E("2024-07-01", "2025-06-30", 88, "10-K"),
  E("2025-07-01", "2025-12-31", 46, "10-Q", "2025-12-30"), // dépôt plus ancien : la valeur la plus récente gagne
]);
assert.deepEqual(q.map((x) => [x.end, x.value]), [["2025-06-30", 22], ["2025-09-30", 20], ["2025-12-31", 25], ["2026-03-31", 30]]);
assert.equal(q[0].basis, "cumul"); assert.equal(q[1].basis, "trimestre");
assert.deepEqual(quarterly([E("2025-07-01", "2025-12-31", 45)]), [], "cumul sans trimestre précédent : rien d'inventé");
assert.deepEqual(quarterly([E("2024-07-01", "2025-06-30", 88, "10-Q")]), [], "un cumul annuel hors 10-K n'est pas utilisé");
// trimestres publiés directement (3 mois) : pas de double compte avec le cumul
const q2 = quarterly([E("2026-01-01", "2026-03-31", 10), E("2026-04-01", "2026-06-30", 12), E("2026-01-01", "2026-06-30", 22)]);
assert.deepEqual(q2.map((x) => x.value), [10, 12]);

// ── SEC → courbes (réponses simulées)
const fq = (vals) => vals.map(([s, e, v, f]) => ({ start: s, end: e, val: v * 1e9, form: f || "10-Q", filed: e.replace(/^(\d{4})-(\d{2})/, (_, y, m) => (+m === 12 ? `${+y + 1}-01` : `${y}-${String(+m + 1).padStart(2, "0")}`)) + "-25" }));
const quarters = [["2025-12-31", 10, 100], ["2026-03-31", 12, 110], ["2026-06-30", 14, 120], ["2026-09-30", 16, 130]];
const secFetch = async (url) => {
  const conc = String(url).match(/us-gaap\/(\w+)\.json/)?.[1];
  const mk = (idx) => ({ ok: true, status: 200, text: async () => JSON.stringify({ units: { USD: fq(quarters.map(([e, c, rv]) => { const s = new Date(Date.parse(e) - 89 * DAY).toISOString().slice(0, 10); return [s, e, idx === 0 ? c : rv]; })) } }) });
  if (conc === "PaymentsToAcquirePropertyPlantAndEquipment") return mk(0);
  if (conc === "Revenues") return mk(1);
  return { ok: false, status: 404, text: async () => "" };
};
const sec = await secCurves({ ua: "t t@t.t", fetchImpl: secFetch, sleep: async () => {}, now: NOW, companies: [{ name: "A", cik: "1" }, { name: "B", cik: "2" }, { name: "C", cik: "3" }] });
assert.equal(sec.capex.length, 3); assert.deepEqual(sec.capex[0].points.map((p) => p.v), [10, 12, 14, 16]);
assert.deepEqual(sec.ratio[0].points.map((p) => p.v), [10, 10.9, 11.7, 12.3], "capex ÷ revenu du même trimestre");
await assert.rejects(secCurves({ ua: "", fetchImpl: secFetch, sleep: async () => {}, now: NOW }), /SEC_USER_AGENT/);
await assert.rejects(secCurves({ ua: "t t@t.t", fetchImpl: async () => ({ ok: false, status: 500, text: async () => "" }), sleep: async () => {}, now: NOW, companies: [{ name: "A", cik: "1" }] }), /insuffisante/);

// ── HBM : cinq trimestres
const tbl = (rows) => "<table><thead><tr>" + rows[0].map((x) => `<th>${x}</th>`).join("") + "</tr></thead><tbody>" + rows.slice(1).map((r) => "<tr>" + r.map((x) => `<td><p>${x}</p></td>`).join("") + "</tr>").join("") + "</tbody></table>";
const H = ["Market Share", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];
const hbmHtml = tbl([H, ["SK Hynix", "64%", "56%", "57%", "58%", "50%"], ["Samsung", "15%", "23%", "22%", "21%", "33%"], ["Micron", "21%", "21%", "21%", "21%", "18%"]]);
const hh = parseHbmHistory("<html>" + hbmHtml + "</html>");
assert.equal(hh.length, 3); assert.equal(hh[0].points.length, 5); assert.equal(hh[0].points[4].d, "2026-06-30"); assert.equal(hh[0].points[4].v, 50);
assert.throws(() => parseHbmHistory("<html>" + tbl([H, ["SK Hynix", "64%", "56%", "57%", "58%", "90%"], ["Samsung", "15%", "23%", "22%", "21%", "33%"], ["Micron", "21%", "21%", "21%", "21%", "18%"]]) + "</html>"), /somme/);

// ── orchestration : tout passe, puis cadence, puis échec avec repli
const ok = (body) => ({ ok: true, status: 200, text: async () => (Buffer.isBuffer(body) ? body.toString("latin1") : body), arrayBuffer: async () => (Buffer.isBuffer(body) ? body : Buffer.from(body)) });
let hits = []; let down = false;
const net = async (url) => {
  const u = String(url); hits.push(u);
  if (down && !u.includes("sec.gov")) return { ok: false, status: 503, text: async () => "" };
  if (u.includes("ai_chip_owners_cumulative")) return ok(csv);
  if (u.includes("ai_chip_sales_timelines")) return ok(salesCsv());
  if (u.includes("all_ai_models")) return ok(mcsv([mdl("2019-02-14", "1.5e21", "A"), mdl("2020-05-28", "3.1e23", "B"), mdl("2022-04-04", "2.5e24", "C"), mdl("2023-03-15", "2.1e25", "D"), mdl("2025-02-17", "3.5e26", "E"), mdl("2026-03-03", "9.4e26", "F")]));
  if (u.includes("counterpoint")) return ok("<html>" + hbmHtml + "</html>");
  if (u.includes("National.xlsx")) return ok(xlsx());
  if (u.includes("data.sec.gov")) return secFetch(u);
  return { ok: false, status: 404, text: async () => "" };
};
const semi = { id: "users", kind: "curve", auto: false, etage: 2, rank: 2, title: "Utilisateurs", series: [{ name: "ChatGPT", points: [{ d: "2025-02-28", v: 400, src: "x", url: "https://x" }] }] };
const prev0 = { as_of: "1 jan.", note: "n", curves: [semi], pies: [] };
const T1 = Date.parse("2026-05-20T12:00:00Z");
let ev = await collectEvolution({ prev: prev0, ua: "t t@t.t", fetchImpl: net, now: T1, sleep: async () => {} });
// BTOS : l'horloge simulée est calée sur la fenêtre des vagues simulées
assert.deepEqual(Object.fromEntries(Object.entries(ev.summary.tasks).filter(([, v]) => v !== "ok")), {}, JSON.stringify(ev.summary.tasks));
assert.equal(ev.doc.curves.filter((x) => x.auto).length, 6); assert.equal(ev.doc.pies.length, 2);
assert.ok(ev.doc.curves.find((x) => x.id === "users"), "la courbe semi-automatique est recopiée telle quelle");
assert.equal(ev.doc.curves.find((x) => x.id === "train").scale, "log");
assert.equal(hits.filter((u) => u.includes("ai_chip_sales_timelines")).length, 1, "un fichier Epoch n'est téléchargé qu'une fois par passage");
// 1 h plus tard : rien n'est relu
hits = []; const ev2 = await collectEvolution({ prev: ev.doc, ua: "t t@t.t", fetchImpl: net, now: T1 + HOUR(1), sleep: async () => {} });
assert.equal(hits.length, 0); assert.ok(Object.values(ev2.summary.tasks).every((v) => v === "déjà à jour"));
// 21 h plus tard, réseau coupé : ancien résultat conservé, alerte, pas de plantage
down = true; hits = [];
const ev3 = await collectEvolution({ prev: ev.doc, ua: "t t@t.t", fetchImpl: net, now: T1 + HOUR(21), sleep: async () => {} });
const kept = ev3.doc.pies.find((x) => x.id === "owners");
assert.deepEqual(kept.segments, ev.doc.pies.find((x) => x.id === "owners").segments, "ancien chiffre conservé");
assert.ok(kept.check_error); assert.equal(kept.checked_at, ev.doc.pies.find((x) => x.id === "owners").checked_at, "la date de dernière lecture réussie ne bouge pas");
assert.ok(ev3.alerts.length >= 6); assert.ok(ev3.doc.curves.find((x) => x.id === "users"));
// 1 h plus tard : pas de nouvelle tentative ; 7 h plus tard : nouvelle tentative, qui réussit
hits = []; await collectEvolution({ prev: ev3.doc, ua: "t t@t.t", fetchImpl: net, now: T1 + HOUR(22), sleep: async () => {} }); assert.equal(hits.filter((u) => !u.includes("sec.gov")).length, 0);
down = false; const ev4 = await collectEvolution({ prev: ev3.doc, ua: "t t@t.t", fetchImpl: net, now: T1 + HOUR(28), sleep: async () => {} });
assert.ok(!ev4.doc.pies.find((x) => x.id === "owners").check_error, "rétablissement : l'alerte disparaît");
// premier passage sans rien en base et réseau coupé : des entrées vides, pas de plantage
down = true; const ev5 = await collectEvolution({ prev: null, ua: "", fetchImpl: net, now: T1, sleep: async () => {} });
assert.equal(ev5.doc.curves.length + ev5.doc.pies.length, 8); assert.ok(ev5.doc.pies.every((x) => x.check_error));
console.log("test-evolution : OK");
function HOUR(n) { return n * 3600000; }
