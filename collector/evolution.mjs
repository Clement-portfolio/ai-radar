// Section « Évolution » de Marché : courbes et camemberts calculés automatiquement à la source.
// Règle : une lecture n'écrase l'ancien résultat que si tous ses contrôles passent ; sinon l'ancien reste, avec sa date et une alerte.
// Les courbes « semi-auto » (utilisateurs, trafic web, revenu annualisé) ne sont pas touchées ici : leurs points viennent de la revue du lundi.
import zlib from "node:zlib";
import { SEC_COMPANIES, CAPEX, REVENUE, getConcept, quarterly } from "./sec.mjs";
import { parseHbmHistory, COUNTERPOINT_URL } from "./shares.mjs";

const UA = "Mozilla/5.0 (compatible; AIRadar/1.0)";
const DAY = 86400000, HOUR = 3600000;
const EPOCH = "https://epoch.ai/data/";
const CENSUS_URL = "https://www.census.gov/hfp/btos/downloads/National.xlsx";
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const qLabel = (end) => `T${Math.ceil((+end.slice(5, 7)) / 3)} ${end.slice(0, 4)}`;

// ───────────────────────── lecture de fichiers ─────────────────────────

/** CSV (guillemets, virgules et retours à la ligne dans les champs) → tableau d'objets. */
export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** Archive zip (méthodes « stocké » et « deflate ») → Map nom → Buffer. Suffit pour un .xlsx. */
export function unzip(buf) {
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error("archive zip invalide");
  const n = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16);
  const files = new Map();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("archive zip corrompue");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), data = buf.subarray(start, start + csize);
    if (method === 0) files.set(name, data); else if (method === 8) files.set(name, zlib.inflateRawSync(data)); else throw new Error("compression zip non gérée : " + method);
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const unesc = (t) => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const colIndex = (L) => [...L].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** .xlsx → { nomDeFeuille: [[cellules]] } (textes et nombres bruts). */
export function readXlsx(buf) {
  const z = unzip(buf), txt = (n) => (z.get(n) ? z.get(n).toString("utf8") : "");
  const strings = [...txt("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const rels = Object.fromEntries([...txt("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s([^>]*?)\/?>/g)].map((m) => { const a = attrs(m[1]); return [a.Id, a.Target]; }));
  const out = {};
  for (const m of txt("xl/workbook.xml").matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const a = attrs(m[1]), target = rels[a["r:id"]];
    if (!target) continue;
    const xml = txt("xl/" + String(target).replace(/^\/?(xl\/)?/, ""));
    const rows = [];
    for (const r of xml.matchAll(/<row\s[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells = [];
      for (const c of (r[1] || "").matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ca = attrs(c[1]), ref = String(ca.r || "").match(/^([A-Z]+)/); if (!ref) continue;
        const v = (c[2] || "").match(/<v>([\s\S]*?)<\/v>/), is = (c[2] || "").match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
        let val = null;
        if (ca.t === "s" && v) val = strings[+v[1]] ?? null; else if (ca.t === "inlineStr" && is) val = unesc(is[1]); else if (v) val = ca.t === "str" ? unesc(v[1]) : isNaN(+v[1]) ? unesc(v[1]) : +v[1];
        cells[colIndex(ref[1])] = val;
      }
      rows.push(cells);
    }
    out[a.name] = rows;
  }
  return out;
}

const excelDate = (v) => (typeof v === "number" ? iso(Date.UTC(1899, 11, 30) + Math.round(v) * DAY) : /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : null);

// ───────────────────────── calculs ─────────────────────────

const completeEnds = (rows, now) => {
  const ends = new Map();
  for (const r of rows) {
    const e = r["End date"]; if (!/^\d{4}-\d{2}-\d{2}$/.test(e || "")) continue;
    const o = ends.get(e) || { n: 0, inc: false }; o.n++; if (String(r.Incomplete || "").trim()) o.inc = true; ends.set(e, o);
  }
  return [...ends].filter(([e, o]) => !o.inc && Date.parse(e) <= now).map(([e]) => e).sort();
};
// Néoclouds : Epoch n'isole que CoreWeave ; Nebius et IREN sont dans « Other ». On les en sort avec une estimation datée au 31 déc. 2025 (même date que le fichier) :
// - Nebius : 170 MW de puissance active fin 2025 (résultats du T4 2025) × l'équivalent H100 par MW de CoreWeave (Epoch ÷ 850 MW actifs fin 2025) ;
// - IREN : parc annoncé en sept. 2025 (1 900 H100/H200 ; 19 100 B200/B300 ; 1 200 GB300 ; 1 100 MI350X), les puces Blackwell et MI350X valant ≈ 2,3 H100 (même rapport de débit FP8 que la méthode d'Epoch). Borne haute : tout n'était pas en service fin 2025.
export const NEO = { end: "2025-12-31", cwMW: 850, nebiusMW: 170, irenOld: 1900, irenNew: 19100 + 1200 + 1100, blackwellH100e: 2.3 };
const NEO_LINKS = [
  { t: "CoreWeave : 850 MW actifs fin 2025 (Epoch, FAQ)", u: "https://epoch.ai/data/ai-chip-owners-documentation/faq" },
  { t: "Nebius : 170 MW actifs fin 2025 (résultats T4 2025)", u: "https://www.businesswire.com/news/home/20260212534404/en/" },
  { t: "IREN : parc de 23 000 GPU annoncé (sept. 2025)", u: "https://iren.com/resources/blog/iren-ai-cloudstrengthens-leadership-with-nvidiablackwell-deployment" },
];
const sumBy = (rows, end, key) => {
  const t = new Map();
  for (const r of rows) if (r["End date"] === end) t.set(r[key], (t.get(r[key]) || 0) + (parseFloat(r["Compute estimate in H100e (median)"]) || 0));
  return t;
};

/** Qui possède le compute : parc cumulé (équivalents H100) au dernier trimestre complet. Les néoclouds (CoreWeave mesuré par Epoch, Nebius et IREN estimés) forment un seul segment. */
export function ownersPie(csv, now) {
  const rows = parseCsv(csv), ends = completeEnds(rows, now), end = ends[ends.length - 1];
  if (!end) throw new Error("aucun trimestre complet dans le fichier Epoch");
  if (now - Date.parse(end) > 460 * DAY) throw new Error("dernier trimestre complet trop ancien : " + end); // ce fichier-là a du retard : fin 2025 vue en nov. 2026
  const t = sumBy(rows, end, "Owner"), T = [...t.values()].reduce((a, b) => a + b, 0);
  if (!(T > 1e6)) throw new Error("total de compute improbable : " + T);
  const five = ["Google", "Microsoft", "Amazon", "Meta", "Oracle"];
  for (const n of five) if (!(t.get(n) > 0)) throw new Error("propriétaire absent : " + n);
  const cw = t.get("CoreWeave") || 0;
  let neo = null;
  if (cw > 0 && end === NEO.end) {
    const perMW = cw / NEO.cwMW, nebius = NEO.nebiusMW * perMW, iren = NEO.irenOld + NEO.irenNew * NEO.blackwellH100e;
    neo = { coreweave: cw, nebius, iren, pct: round((100 * (cw + nebius + iren)) / T), perMW };
  }
  const neoPct = neo ? neo.pct : round((100 * cw) / T);
  const segs = [...five.map((n) => ({ label: n, pct: round((100 * t.get(n)) / T) })), ...(cw > 0 ? [{ label: neo ? "Néoclouds (CoreWeave, Nebius, IREN)" : "Néoclouds (CoreWeave)", pct: neoPct }] : [])].sort((a, b) => b.pct - a.pct);
  const rest = round(100 - segs.reduce((a, s) => a + s.pct, 0));
  if (segs.reduce((a, s) => a + s.pct, 0) < 40) throw new Error("part des cinq géants improbable");
  return { end, segments: [...segs, { label: "Autres propriétaires", pct: Math.max(0, rest) }], total: T, neo };
}

const fmtK = (v) => Math.round(v / 1e3).toLocaleString("fr-FR").replace(/\u202f/g, " ") + " 000";
/** Légende, liens et limites du camembert : méthode des néoclouds écrite en clair, avec les chiffres calculés. */
export function ownersNote(r) {
  if (!r.neo) return { caveat: "Estimations d'Epoch, pas des déclarations des sociétés. Dernier trimestre complet du fichier. Seul CoreWeave est isolé par Epoch ; Nebius, Lambda, Crusoe et les autres sont dans « Autres propriétaires », comme xAI (SpaceX) et les clients chinois." };
  const n = r.neo, pc = (v) => (100 * v / r.total).toFixed(1).replace(".", ",");
  return {
    links: NEO_LINKS,
    caveat: `Estimations d'Epoch, pas des déclarations des sociétés ; dernier trimestre complet du fichier. Néoclouds = CoreWeave ${pc(n.coreweave)} % (mesuré par Epoch) + Nebius ${pc(n.nebius)} % + IREN ${pc(n.iren)} % (estimés ici, retirés de « Autres »). Nebius : 170 MW actifs fin 2025 × ${Math.round(n.perMW)} équivalents H100 par MW (ratio de CoreWeave : ${fmtK(n.coreweave)} équivalents H100 pour 850 MW). IREN : parc annoncé en septembre 2025 (23 000 GPU, dont 21 400 Blackwell ou MI350X comptés ≈ 2,3 H100) ; tout n'était pas encore en service fin 2025, donc borne haute. Non comptés : Lambda, Crusoe, Nscale, Together, Fluidstack… (pas de parc publié ; des estimations de presse parlent de quelques dizaines de milliers de GPU chacun), donc la vraie part des néoclouds est un peu plus haute. Confiance : faible à moyenne pour Nebius et IREN.`,
  };
}

/** Évolution de la part du compute détenue par chacun des cinq géants, trimestre complet par trimestre complet. */
export function ownersShare(csv, now, last = 8) {
  const rows = parseCsv(csv), ends = completeEnds(rows, now).slice(-last);
  if (ends.length < 4) throw new Error("moins de quatre trimestres complets");
  if (now - Date.parse(ends[ends.length - 1]) > 460 * DAY) throw new Error("dernier trimestre complet trop ancien : " + ends[ends.length - 1]);
  const five = ["Google", "Microsoft", "Amazon", "Meta", "Oracle"], byEnd = ends.map((e) => { const t = sumBy(rows, e, "Owner"), T = [...t.values()].reduce((a, b) => a + b, 0); return { e, t, T }; });
  for (const q of byEnd) { if (!(q.T > 1e5)) throw new Error("total de compute improbable : " + q.e); for (const n of five) if (!(q.t.get(n) > 0)) throw new Error("propriétaire absent : " + n + " (" + q.e + ")"); }
  const series = five.map((n) => ({ name: n, points: byEnd.map((q) => ({ d: q.e, v: round((100 * q.t.get(n)) / q.T) })) }));
  series.push({ name: "Autres propriétaires", dashed: true, points: byEnd.map((q) => ({ d: q.e, v: round(100 - five.reduce((a, n) => a + (100 * q.t.get(n)) / q.T, 0)) })) });
  if (series.some((x) => x.points.some((p) => p.v < 0 || p.v > 100))) throw new Error("part hors 0–100");
  return { series, last: ends[ends.length - 1] };
}

/** Frontière de capacités (Epoch Capabilities Index) : meilleur score atteint à ce jour, par groupe de modèles. */
const frontier = (rows, pick) => {
  let m = -Infinity; const out = [];
  for (const r of rows.filter(pick).sort((a, b) => a.date.localeCompare(b.date))) if (r.eci > m) { m = r.eci; out.push({ d: r.date, v: r.eci, model: r.model }); }
  return out;
};
const frontierAt = (f, d) => { let v = null; for (const p of f) if (p.d <= d) v = p.v; return v; };
const monthEnds = (from, to) => { const out = []; let y = +from.slice(0, 4), m = +from.slice(5, 7); for (;;) { const e = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); if (e > to) break; out.push(e); if (++m > 12) { m = 1; y++; } } return out; };

/** Écarts de capacités par mois : États-Unis moins Chine, modèles fermés moins modèles ouverts (points d'ECI). */
export function eciGaps(csv, now) {
  const rows = parseCsv(csv).map((r) => ({ model: r.Model, date: r.date, eci: parseFloat(r.eci), country: r["Country (of organization)"], group: r["Accessibility group"] })).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.eci > 0);
  if (rows.length < 100) throw new Error("fichier ECI trop court : " + rows.length);
  const last = rows.map((r) => r.date).sort().pop();
  if (now - Date.parse(last) > 75 * DAY) throw new Error("dernier modèle ECI trop ancien : " + last);
  const us = frontier(rows, (r) => /^United States/.test(r.country)), cn = frontier(rows, (r) => r.country === "China"), closed = frontier(rows, (r) => r.group === "Closed weights"), open = frontier(rows, (r) => r.group === "Open weights");
  if (!us.length || !cn.length || !closed.length || !open.length) throw new Error("frontière ECI vide");
  const gap = (a, b) => {
    const start = [a[0].d, b[0].d].sort().pop(), days = [...monthEnds(start, last), ...(monthEnds(start, last).slice(-1)[0] === last ? [] : [last])], pts = [];
    for (const d of days) { const x = frontierAt(a, d), y = frontierAt(b, d); if (x != null && y != null) pts.push({ d, v: round(x - y) }); }
    if (pts.length < 12) throw new Error("écart ECI : moins de douze points");
    if (pts.some((p) => Math.abs(p.v) > 80)) throw new Error("écart ECI improbable");
    return pts;
  };
  const f = (a) => ({ model: a[a.length - 1].model, v: a[a.length - 1].v });
  return { last, usCn: gap(us, cn), openClosed: gap(closed, open), leaders: { us: f(us), cn: f(cn), closed: f(closed), open: f(open) } };
}

/** Coût pour atteindre un niveau de performance fixe (GPQA Diamond, 75 % ajusté du hasard = 81,25 % brut) : le moins cher observé à chaque date de relevé de prix. */
export function priceAtPerformance(csv, now, threshold = 0.8125) {
  const rows = parseCsv(csv).filter((r) => r.benchmark === "gpqa" && /^\d{4}-\d{2}-\d{2}$/.test(r.price_date));
  if (rows.length < 500) throw new Error("fichier de coûts trop court : " + rows.length);
  const best = new Map();
  for (const r of rows) {
    const a = parseFloat(r.acc), c = parseFloat(r.cost_per_task_usd);
    if (!(a >= threshold) || !(c > 0)) continue;
    const b = best.get(r.model); if (!b || c < b.c) best.set(r.model, { c, d: r.price_date });
  }
  const list = [...best].map(([model, o]) => ({ model, ...o })).sort((a, b) => a.d.localeCompare(b.d) || a.c - b.c);
  if (list.length < 15) throw new Error("trop peu de modèles au seuil : " + list.length);
  const pts = []; let m = Infinity;
  for (const o of list) if (o.c < m) { m = o.c; pts.push({ d: o.d, v: +o.c.toPrecision(3), src: o.model }); }
  if (pts.length < 5) throw new Error("courbe de coût trop courte");
  if (now - Date.parse(list[list.length - 1].d) > 150 * DAY) throw new Error("dernier relevé de prix trop ancien : " + list[list.length - 1].d);
  if (pts[0].v / pts[pts.length - 1].v < 10) throw new Error("baisse de coût improbable");
  return { points: pts, last: list[list.length - 1].d };
}

const DESIGNERS = [["Nvidia", "Nvidia"], ["Google", "Google (TPU)"], ["Amazon", "Amazon (Trainium)"], ["AMD", "AMD"], ["Huawei", "Huawei"]];
/** Qui conçoit les puces : compute vendu sur le dernier trimestre complet, par concepteur. */
export function designersPie(csv, now) {
  const rows = parseCsv(csv), ends = completeEnds(rows, now), end = ends[ends.length - 1];
  if (!end) throw new Error("aucun trimestre complet dans le fichier Epoch");
  if (now - Date.parse(end) > 300 * DAY) throw new Error("dernier trimestre complet trop ancien : " + end);
  const t = sumBy(rows, end, "Chip manufacturer"), T = [...t.values()].reduce((a, b) => a + b, 0);
  if (!(T > 1e5)) throw new Error("total vendu improbable : " + T);
  if (!(t.get("Nvidia") > 0)) throw new Error("Nvidia absent");
  const segs = DESIGNERS.filter(([k]) => t.get(k) > 0).map(([k, l]) => ({ label: l, pct: round((100 * t.get(k)) / T) }));
  const rest = round(100 - segs.reduce((a, s) => a + s.pct, 0));
  if (rest > 0.4) segs.push({ label: "Autres", pct: rest });
  return { end, segments: segs, total: T };
}

/** Compute IA vendu par trimestre et par concepteur (millions d'équivalents H100), trimestres complets seulement. */
export function salesCurve(csv, now, last = 9) {
  const rows = parseCsv(csv), ends = completeEnds(rows, now).slice(-last);
  if (ends.length < 4) throw new Error("moins de quatre trimestres complets");
  const series = DESIGNERS.map(([k, l]) => ({ name: l, points: ends.map((e) => ({ d: e, v: round((sumBy(rows, e, "Chip manufacturer").get(k) || 0) / 1e6, 2) })) }));
  if (!series[0].points.every((p) => p.v > 0)) throw new Error("ventes Nvidia nulles sur un trimestre complet");
  return { series, last: ends[ends.length - 1] };
}

/** Records du compute d'entraînement (FLOP) : à chaque date, le plus gros modèle publié jusqu'ici. */
/** Pays d'une ligne : « us » ou « cn » seulement si tous les pays cités sont les mêmes (sinon null : consortium ou inconnu). */
export function countryOf(raw) {
  const set = new Set(String(raw || "").split(",").map((x) => x.trim()).filter(Boolean));
  if (set.size !== 1) return null;
  const c = [...set][0];
  return c === "United States of America" ? "us" : c === "China" ? "cn" : null;
}

export function trainRecords(csv, now, from = "2018-01-01", country = null, min = 6) {
  const rows = parseCsv(csv).map((r) => ({ d: String(r["Publication date"] || "").slice(0, 10), m: r.Model, v: parseFloat(r["Training compute (FLOP)"]), c: countryOf(r["Country (of organization)"]) }))
    .filter((r) => (!country || r.c === country) && /^\d{4}-\d{2}-\d{2}$/.test(r.d) && r.v > 0 && r.v < 1e30 && Date.parse(r.d) <= now + DAY).sort((a, b) => a.d.localeCompare(b.d));
  let cur = 0; const rec = [];
  for (const r of rows) if (r.v > cur) { cur = r.v; if (r.d >= from) rec.push({ d: r.d, v: r.v, name: r.m }); }
  if (rec.length < min) throw new Error("trop peu de records lisibles" + (country ? " (" + country + ")" : "") + " : " + rec.length);
  return rec;
}

/** BTOS (Census) : part des entreprises américaines qui déclarent utiliser l'IA, par vague de deux semaines. */
export function btosSeries(buf, now) {
  const wb = readXlsx(buf), est = wb["Response Estimates"], dts = wb["Collection and Reference Dates"];
  if (!est || !dts) throw new Error("feuilles attendues absentes du fichier BTOS");
  const head = est[0] || [], waves = head.map((h, i) => ({ h: String(h), i })).filter((c) => /^\d{6}$/.test(c.h));
  if (waves.length < 10) throw new Error("colonnes de vagues introuvables");
  const dh = dts[0] || [], iS = dh.indexOf("Smpdt"), iE = dh.indexOf("Col End");
  if (iS < 0 || iE < 0) throw new Error("dates de collecte introuvables");
  const endOf = new Map(dts.slice(1).map((r) => [String(r[iS]), excelDate(r[iE])]).filter((x) => x[1]));
  const find = (re) => est.find((r) => r && re.test(String(r[1] || "")) && String(r[3]) === "Yes");
  const rowNow = find(/^In the last two weeks, did this business use .*(Intelligence|AI)\b/i), rowNext = find(/^During the next six months, do you think this business will be using/i);
  if (!rowNow) throw new Error("question « utilise l'IA » introuvable");
  const pts = (row) => waves.map((c) => { const m = String(row[c.i] ?? "").match(/^(\d+(?:\.\d+)?)%$/); return m && endOf.get(c.h) ? { d: endOf.get(c.h), v: +m[1] } : null; }).filter(Boolean).sort((a, b) => a.d.localeCompare(b.d));
  const a = pts(rowNow); if (a.length < 10) throw new Error("série BTOS trop courte : " + a.length);
  if (a.some((p) => p.v < 0 || p.v > 100)) throw new Error("valeur BTOS hors 0–100");
  if (now - Date.parse(a[a.length - 1].d) > 75 * DAY) throw new Error("dernière vague BTOS trop ancienne : " + a[a.length - 1].d);
  const series = [{ name: "Utilisent l'IA (deux dernières semaines)", points: a }];
  if (rowNext) { const b = pts(rowNext); if (b.length >= 10) series.push({ name: "Prévoient de l'utiliser dans six mois (déclaré)", points: b, dashed: true }); }
  return { series, question: String(rowNow[1]).slice(0, 160) };
}

/** Capex trimestriel et capex ÷ revenus de chaque géant, depuis les données XBRL de la SEC. */
export async function secCurves({ ua, fetchImpl, sleep, now, companies = SEC_COMPANIES, last = 8 }) {
  if (!ua) throw new Error("SEC_USER_AGENT absente");
  const ctx = { ua, fetchImpl, sleep }, best = async (c, concepts) => {
    let b = null;
    for (const concept of concepts) {
      const q = quarterly(await getConcept(c, concept, ctx)); await sleep(150);
      if (q.length && (!b || q[q.length - 1].end > b[b.length - 1].end || (q[q.length - 1].end === b[b.length - 1].end && q.length > b.length))) b = q;
    }
    return b;
  };
  const cut = iso(now - 3.2 * 365 * DAY), capex = [], ratio = [], ko = [];
  for (const c of companies) {
    try {
      const cx = (await best(c, CAPEX) || []).filter((q) => q.end >= cut && q.value > 0), rv = (await best(c, REVENUE) || []).filter((q) => q.end >= cut && q.value > 0);
      if (cx.length < 4) throw new Error("moins de quatre trimestres de capex");
      if (now - Date.parse(cx[cx.length - 1].end) > 200 * DAY) throw new Error("capex trop ancien : " + cx[cx.length - 1].end);
      capex.push({ name: c.name, points: cx.slice(-last).map((q) => ({ d: q.end, v: round(q.value / 1e9) })) });
      const rp = [];
      for (const q of cx) { const r = rv.find((x) => Math.abs(Date.parse(x.end) - Date.parse(q.end)) <= 5 * DAY); if (r) { const p = (100 * q.value) / r.value; if (p > 0 && p < 300) rp.push({ d: q.end, v: round(p) }); } }
      if (rp.length >= 4) ratio.push({ name: c.name, points: rp.slice(-last) });
    } catch (e) { ko.push(`${c.name} : ${e.message}`); }
  }
  if (capex.length < 3) throw new Error("lecture SEC insuffisante (" + ko.join(" ; ") + ")");
  return { capex, ratio, ko };
}

// ───────────────────────── orchestration ─────────────────────────

const META = {
  ownersShare: { kind: "curve", etage: 1, rank: 1, title: "Part du compute IA détenue par chaque géant", unit: "% du parc cumulé (équivalents H100)", source: "Epoch AI (AI Chip Owners)", url: "https://epoch.ai/data/ai-chip-owners", caveat: "Estimations d'Epoch, pas des déclarations des sociétés ; trimestres complets du fichier seulement (les plus récents y sont incomplets). Les néoclouds (CoreWeave, Nebius, IREN, Lambda, Crusoe…) ne sont pas isolés ici : Epoch ne suit que CoreWeave, et leur part est donnée dans le camembert voisin. « Autres propriétaires » les contient donc, avec xAI (SpaceX), les clients chinois, etc." },
  owners: { kind: "pie", etage: 1, rank: 1, title: "Qui possède le compute IA", metric: "Parc cumulé de puces IA détenu (équivalents H100)", source: "Epoch AI (AI Chip Owners), complété pour Nebius et IREN", url: "https://epoch.ai/data/ai-chip-owners", confidence: "moyenne", caveat: "Estimations d'Epoch, pas des déclarations des sociétés. Dernier trimestre complet du fichier (les trimestres plus récents y sont incomplets)." },
  designers: { kind: "pie", etage: 1, rank: 2, title: "Qui conçoit les puces IA", metric: "Part de la puissance de calcul vendue, par concepteur de puces", source: "Epoch AI (AI Chip Sales)", url: "https://epoch.ai/data/ai-chip-sales", confidence: "haute", caveat: "Calcul sur le dernier trimestre complet du fichier Epoch. Estimations : les fabricants ne publient pas leurs volumes ; Trainium est la moins fiable." },
  sales: { kind: "curve", etage: 1, rank: 2, title: "Compute IA vendu chaque trimestre", unit: "millions d'équivalents H100", source: "Epoch AI (AI Chip Sales)", url: "https://epoch.ai/data/ai-chip-sales", caveat: "Estimations d'Epoch ; seuls les trimestres complets sont tracés. Cambricon (moins de 1 %) n'est pas tracé." },
  capex: { kind: "curve", etage: 4, rank: 1, title: "Capex trimestriel des cinq géants", unit: "milliards de dollars", source: "SEC (dépôts 10-K et 10-Q)", url: "https://www.sec.gov/edgar/search/", caveat: "Dépenses d'investissement déclarées (immobilisations corporelles). Les trimestres des sociétés ne coïncident pas : Oracle clôt en août, novembre, février et mai. Chaque trimestre est publié ou calculé par différence de cumuls, jamais estimé." },
  hbm: { kind: "curve", etage: 1, rank: 3, title: "Parts du marché HBM, cinq trimestres", unit: "% du chiffre d'affaires HBM", source: "Counterpoint Research", url: COUNTERPOINT_URL, caveat: "Parts relues sur le tableau de la page Counterpoint ; arrondis publiés (la somme peut différer de 100 %)." },
  train: { kind: "curve", etage: 2, rank: 1, title: "Plus gros entraînement : USA vs Chine", unit: "FLOP (échelle logarithmique)", scale: "log", source: "Epoch AI (AI Models)", url: "https://epoch.ai/data/ai-models", caveat: "Chaque marche est un nouveau record du pays parmi les modèles recensés par Epoch. Seuls les modèles dont tous les laboratoires sont du même pays sont comptés. Beaucoup de laboratoires ne publient pas leur compute : le vrai maximum peut être plus haut, surtout en Chine. Données Epoch AI, licence CC-BY 4.0." },
  eci_gap: { kind: "curve", etage: 2, rank: 2, title: "Écart de capacités : USA – Chine et fermés – ouverts", unit: "points d'ECI (écart entre les meilleurs modèles)", source: "Epoch AI (Epoch Capabilities Index)", url: "https://epoch.ai/benchmarks/eci", caveat: "L'ECI est un score composite de dizaines de tests. Chaque courbe donne, à chaque fin de mois, l'écart entre le meilleur modèle d'un groupe et celui de l'autre (plus c'est haut, plus le premier a d'avance). Les deux courbes se ressemblent parce que presque tous les modèles ouverts de pointe sont chinois et presque tous les modèles américains de pointe sont fermés. Un point d'écart ne se traduit pas en mois de retard de façon fixe. Données Epoch AI, licence CC-BY 4.0." },
  price_perf: { kind: "curve", etage: 2, rank: 3, title: "Combien coûte une bonne réponse, à performance égale ?", unit: "dollars par question difficile (GPQA Diamond), échelle logarithmique : chaque graduation vaut dix fois moins", scale: "log", fmt: "usd", source: "Epoch AI et D. Roodman (inference-cost)", url: "https://epoch.ai/publications/the-plunging-price-of-thought", caveat: "Chaque point est un nouveau record : le modèle le moins cher à atteindre le même score (75 % ajusté du hasard, soit 81,25 % de bonnes réponses) à la date où son prix a été relevé. On mesure le coût par question, pas par token, parce que les modèles de raisonnement consomment beaucoup plus de tokens : c'est le coût réel pour un résultat identique. Prix relevés sur OpenRouter ou chez les éditeurs ; les dates sont celles des relevés, pas des lancements." },
  btos: { kind: "curve", etage: 3, rank: 3, title: "Entreprises américaines qui utilisent l'IA (Census)", unit: "% de toutes les entreprises", source: "U.S. Census Bureau (BTOS)", url: "https://www.census.gov/hfp/btos/data_downloads", caveat: "Enquête représentative de toutes les entreprises américaines (pas seulement les clientes d'une plateforme), une vague toutes les deux semaines ; la question posée est : l'entreprise a-t-elle utilisé l'IA dans l'une de ses fonctions au cours des deux dernières semaines (pas : a-t-elle un abonnement payant). À ne pas comparer directement à l'indice Ramp (autre population, autre définition). Rupture de série : Census a changé la formulation de la question en novembre 2025 ; seuls les points de la nouvelle formulation sont tracés, les anciens ne sont pas comparables." },
};

const due = (p, now) => !p?.checked_at || (p.check_error ? now - Date.parse(p.attempted_at || p.checked_at) >= 6 * HOUR : now - Date.parse(p.checked_at) >= 20 * HOUR);

/**
 * Relit les séries automatiques (chacune à son rythme : 20 h après un succès, 6 h après un échec) et renvoie le document complet.
 * Les éléments « semi » du document précédent sont recopiés tels quels.
 */
export async function collectEvolution({ prev = null, ua, fetchImpl = fetch, now = Date.now(), sleep = (t) => new Promise((r) => setTimeout(r, t)), log = () => {} } = {}) {
  const prevItems = new Map([...(prev?.curves || []), ...(prev?.pies || [])].map((x) => [x.id, x]));
  const cache = new Map(), tasks = {}, alerts = [];
  const get = async (url) => {
    if (!cache.has(url)) cache.set(url, (async () => {
      let err;
      for (let a = 0; a < 2; a++) {
        try { const r = await fetchImpl(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(90000), redirect: "follow" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer ? Buffer.from(await r.arrayBuffer()) : Buffer.from(await r.text()); }
        catch (e) { err = e; await sleep(1500); }
      }
      throw err;
    })());
    return cache.get(url);
  };
  const text = async (u) => (await get(u)).toString("utf8");
  const stamp = new Date(now).toISOString();
  const work = {
    owners: async () => { const r = ownersPie(await text(EPOCH + "ai_chip_owners_cumulative_by_designer.csv"), now); return { period: `Fin ${qLabel(r.end)}`, period_key: r.end, segments: r.segments, ...ownersNote(r) }; },
    designers: async () => { const r = designersPie(await text(EPOCH + "ai_chip_sales_timelines_by_chip.csv"), now); return { period: qLabel(r.end), period_key: r.end, segments: r.segments }; },
    ownersShare: async () => { const r = ownersShare(await text(EPOCH + "ai_chip_owners_cumulative_by_designer.csv"), now); return { series: r.series, last_point: r.last }; },
    eci_gap: async () => { const r = eciGaps(await text(EPOCH + "eci_scores.csv"), now); return { series: [{ name: "États-Unis moins Chine", points: r.usCn }, { name: "Fermés moins ouverts", points: r.openClosed, dashed: true }], last_point: r.last }; },
    price_perf: async () => { const r = priceAtPerformance(await text("https://raw.githubusercontent.com/droodman/inference-cost/main/data/cost_truncated_curves.csv"), now); return { series: [{ name: "Coût le plus bas observé", points: r.points, step: true }], last_point: r.last }; },
    sales: async () => { const r = salesCurve(await text(EPOCH + "ai_chip_sales_timelines_by_chip.csv"), now); return { series: r.series, last_point: r.last }; },
    train: async () => { const t = await text(EPOCH + "all_ai_models.csv"); return { series: [{ name: "États-Unis", points: trainRecords(t, now, "2018-01-01", "us"), step: true }, { name: "Chine", points: trainRecords(t, now, "2018-01-01", "cn", 4), step: true, dashed: true }] }; },
    hbm: async () => ({ series: parseHbmHistory(await text(COUNTERPOINT_URL)) }),
    btos: async () => { const r = btosSeries(await get("https://www.census.gov/hfp/btos/downloads/National.xlsx"), now); return { series: r.series, wording: r.question }; },
  };
  let sec = null;
  const secOnce = async () => (sec ||= secCurves({ ua, fetchImpl, sleep, now }));
  work.capex = async () => ({ series: (await secOnce()).capex });
  const out = new Map();
  for (const id of Object.keys(META)) {
    const p = prevItems.get(id);
    if (p && !due(p, now)) { out.set(id, p); tasks[id] = "déjà à jour"; continue; }
    try {
      const res = await work[id]();
      out.set(id, { id, ...META[id], ...res, checked_at: stamp, attempted_at: stamp, auto: true });
      tasks[id] = "ok";
    } catch (e) {
      const msg = String(e.message || e).slice(0, 200);
      out.set(id, { ...(p || { id, ...META[id], series: [], segments: undefined, auto: true }), check_error: msg, attempted_at: stamp, checked_at: p?.checked_at || stamp });
      tasks[id] = "échec : " + msg;
      alerts.push(`Évolution « ${META[id].title} » : lecture impossible, ancien résultat conservé (${msg})`);
    }
  }
  // les éléments manuels / semi-automatiques sont recopiés tels quels, dans l'ordre précédent
  const keep = (list) => (list || []).filter((x) => !META[x.id]);
  const all = [...out.values()];
  const doc = {
    as_of: prev?.as_of || null,
    note: prev?.note || null,
    curves: [...keep(prev?.curves), ...all.filter((x) => x.kind === "curve")],
    pies: [...keep(prev?.pies), ...all.filter((x) => x.kind === "pie")],
  };
  const refreshed = Object.values(tasks).filter((t) => t === "ok").length;
  if (refreshed) doc.updated_at = stamp; else if (prev?.updated_at) doc.updated_at = prev.updated_at;
  log(`Évolution : ${refreshed} lue(s), ${Object.values(tasks).filter((t) => t === "déjà à jour").length} déjà à jour, ${alerts.length} échec(s)`);
  return { doc, summary: { refreshed: refreshed > 0, tasks }, alerts };
}

/** Mise en page de series.json : une courbe ou un camembert par ligne (différences Git lisibles). */
export function fmtSeries(d) {
  const { curves, pies, ...head } = d;
  return JSON.stringify(head).slice(0, -1) + ',\n"curves":[\n' + (curves || []).map((c) => JSON.stringify(c)).join(",\n") + '\n],\n"pies":[\n' + (pies || []).map((c) => JSON.stringify(c)).join(",\n") + "\n]}\n";
}
