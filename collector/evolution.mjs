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
const sumBy = (rows, end, key) => {
  const t = new Map();
  for (const r of rows) if (r["End date"] === end) t.set(r[key], (t.get(r[key]) || 0) + (parseFloat(r["Compute estimate in H100e (median)"]) || 0));
  return t;
};

/** Qui possède le compute : parc cumulé (équivalents H100) au dernier trimestre complet. */
export function ownersPie(csv, now) {
  const rows = parseCsv(csv), ends = completeEnds(rows, now), end = ends[ends.length - 1];
  if (!end) throw new Error("aucun trimestre complet dans le fichier Epoch");
  if (now - Date.parse(end) > 460 * DAY) throw new Error("dernier trimestre complet trop ancien : " + end); // ce fichier-là a du retard : fin 2025 vue en nov. 2026
  const t = sumBy(rows, end, "Owner"), T = [...t.values()].reduce((a, b) => a + b, 0);
  if (!(T > 1e6)) throw new Error("total de compute improbable : " + T);
  const five = ["Google", "Microsoft", "Amazon", "Meta", "Oracle"];
  for (const n of five) if (!(t.get(n) > 0)) throw new Error("propriétaire absent : " + n);
  const segs = five.map((n) => ({ label: n, pct: round((100 * t.get(n)) / T) })).sort((a, b) => b.pct - a.pct);
  const rest = round(100 - segs.reduce((a, s) => a + s.pct, 0));
  if (segs.reduce((a, s) => a + s.pct, 0) < 40) throw new Error("part des cinq géants improbable");
  return { end, segments: [...segs, { label: "Autres propriétaires", pct: Math.max(0, rest) }], total: T };
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
export function trainRecords(csv, now, from = "2018-01-01") {
  const rows = parseCsv(csv).map((r) => ({ d: String(r["Publication date"] || "").slice(0, 10), m: r.Model, v: parseFloat(r["Training compute (FLOP)"]) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.d) && r.v > 0 && r.v < 1e30 && Date.parse(r.d) <= now + DAY).sort((a, b) => a.d.localeCompare(b.d));
  let cur = 0; const rec = [];
  for (const r of rows) if (r.v > cur) { cur = r.v; if (r.d >= from) rec.push({ d: r.d, v: r.v, name: r.m }); }
  if (rec.length < 6) throw new Error("trop peu de records lisibles : " + rec.length);
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
  owners: { kind: "pie", etage: 1, rank: 1, title: "Qui possède le compute IA", metric: "Parc cumulé de puces IA détenu (équivalents H100)", source: "Epoch AI (AI Chip Owners)", url: "https://epoch.ai/data/ai-chip-owners", confidence: "moyenne", caveat: "Estimations d'Epoch, pas des déclarations des sociétés. Dernier trimestre complet du fichier (les trimestres plus récents y sont incomplets). « Autres » = reste : xAI, CoreWeave, clients chinois, etc." },
  designers: { kind: "pie", etage: 1, rank: 2, title: "Qui conçoit les puces IA", metric: "Part de la puissance de calcul vendue, par concepteur de puces", source: "Epoch AI (AI Chip Sales)", url: "https://epoch.ai/data/ai-chip-sales", confidence: "haute", caveat: "Calcul sur le dernier trimestre complet du fichier Epoch. Estimations : les fabricants ne publient pas leurs volumes ; Trainium est la moins fiable." },
  sales: { kind: "curve", etage: 1, rank: 2, title: "Compute IA vendu chaque trimestre", unit: "millions d'équivalents H100", source: "Epoch AI (AI Chip Sales)", url: "https://epoch.ai/data/ai-chip-sales", caveat: "Estimations d'Epoch ; seuls les trimestres complets sont tracés. Cambricon (moins de 1 %) n'est pas tracé." },
  capex: { kind: "curve", etage: 1, rank: 1, title: "Capex trimestriel des cinq géants", unit: "milliards de dollars", source: "SEC (dépôts 10-K et 10-Q)", url: "https://www.sec.gov/edgar/search/", caveat: "Dépenses d'investissement déclarées (immobilisations corporelles). Les trimestres des sociétés ne coïncident pas : Oracle clôt en août, novembre, février et mai. Chaque trimestre est publié ou calculé par différence de cumuls, jamais estimé." },
  hbm: { kind: "curve", etage: 1, rank: 3, title: "Parts du marché HBM, cinq trimestres", unit: "% du chiffre d'affaires HBM", source: "Counterpoint Research", url: COUNTERPOINT_URL, caveat: "Parts relues sur le tableau de la page Counterpoint ; arrondis publiés (la somme peut différer de 100 %)." },
  train: { kind: "curve", etage: 2, rank: 1, title: "Compute d'entraînement du plus gros modèle", unit: "FLOP (échelle logarithmique)", scale: "log", source: "Epoch AI (AI Models)", url: "https://epoch.ai/data/ai-models", caveat: "Chaque point est un nouveau record parmi les modèles recensés par Epoch ; beaucoup de laboratoires ne publient pas leur compute, donc le vrai maximum peut être plus haut. Données Epoch AI, licence CC-BY 4.0." },
  btos: { kind: "curve", etage: 3, rank: 1, title: "Entreprises américaines qui utilisent l'IA", unit: "% des entreprises", source: "U.S. Census Bureau (BTOS)", url: "https://www.census.gov/hfp/btos/data_downloads", caveat: "Enquête auprès des entreprises américaines, une vague toutes les deux semaines. Rupture de série : Census a changé la formulation de la question en novembre 2025 ; seuls les points de la nouvelle formulation sont tracés, les anciens ne sont pas comparables." },
  capex_rev: { kind: "curve", etage: 3, rank: 2, title: "Capex rapporté aux revenus, par géant", unit: "% du revenu trimestriel", source: "SEC (dépôts 10-K et 10-Q)", url: "https://www.sec.gov/edgar/search/", caveat: "Capex du trimestre divisé par le revenu total du même trimestre : pas seulement le revenu IA, que les sociétés ne publient pas." },
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
    owners: async () => { const r = ownersPie(await text(EPOCH + "ai_chip_owners_cumulative_by_designer.csv"), now); return { period: `Fin ${qLabel(r.end)}`, period_key: r.end, segments: r.segments }; },
    designers: async () => { const r = designersPie(await text(EPOCH + "ai_chip_sales_timelines_by_chip.csv"), now); return { period: qLabel(r.end), period_key: r.end, segments: r.segments }; },
    sales: async () => { const r = salesCurve(await text(EPOCH + "ai_chip_sales_timelines_by_chip.csv"), now); return { series: r.series, last_point: r.last }; },
    train: async () => ({ series: [{ name: "Plus gros compute d'entraînement connu", points: trainRecords(await text(EPOCH + "all_ai_models.csv"), now), step: true }] }),
    hbm: async () => ({ series: parseHbmHistory(await text(COUNTERPOINT_URL)) }),
    btos: async () => { const r = btosSeries(await get("https://www.census.gov/hfp/btos/downloads/National.xlsx"), now); return { series: r.series, wording: r.question }; },
  };
  let sec = null;
  const secOnce = async () => (sec ||= secCurves({ ua, fetchImpl, sleep, now }));
  work.capex = async () => ({ series: (await secOnce()).capex });
  work.capex_rev = async () => ({ series: (await secOnce()).ratio });
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
