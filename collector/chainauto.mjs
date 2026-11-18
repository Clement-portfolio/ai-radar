// Fiches marché de l'infrastructure (chain.json) : fraîcheur des graphiques et mise à jour automatique des séries lisibles à la source.
// Règles : jamais d'estimation ; un nouveau trimestre n'est ajouté que si TOUTES les séries du graphique l'ont, et que les contrôles passent
// (derniers trimestres déjà affichés = chiffres de la source à 3 % près, valeur positive, rapport au trimestre précédent plausible).
// Sinon le graphique reste tel quel et la raison est renvoyée. Les séries hors périmètre (segments, sociétés étrangères) ne reçoivent que l'alerte de fraîcheur.
import { REVENUE, getConcept, quarterly } from "./sec.mjs";

const DAY = 86400000;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const frDate = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const lastDay = (y, q) => Date.UTC(y, q * 3, 0); // fin du trimestre calendaire q de l'année y

/** « T3 26 » → numéro de trimestre (2026×4 + 2) ; l'inverse. */
export const idxOf = (label) => { const m = /^T([1-4]) (\d\d)$/.exec(label || ""); return m ? (2000 + +m[2]) * 4 + (+m[1] - 1) : null; };
export const labelOf = (i) => `T${(i % 4) + 1} ${String(Math.floor(i / 4)).slice(2)}`;
export const longLabel = (i) => `T${(i % 4) + 1} ${Math.floor(i / 4)}`;

/**
 * Trimestre calendaire d'une fin de période : celle qui tombe de 7 jours avant à 45 jours après la fin du trimestre.
 * Un exercice décalé d'un mois (Nvidia, Credo : octobre 2024, 1ᵉʳ août 2026) est donc rattaché au trimestre calendaire précédent, comme dans les graphiques.
 */
export function qOfEnd(end) {
  const d = Date.parse(end + "T00:00:00Z"), y0 = +end.slice(0, 4);
  for (let y = y0 - 1; y <= y0; y++) for (let q = 1; q <= 4; q++) { const qe = lastDay(y, q); if (d >= qe - 7 * DAY && d < qe + 45 * DAY) return y * 4 + (q - 1); }
  return null;
}

/** Dernier trimestre dont la publication est attendue : fin du trimestre + délai (jours). */
export function dueIdx(nowMs, lag = 50) {
  let best = null; const y0 = new Date(nowMs).getUTCFullYear();
  for (let y = y0 - 1; y <= y0; y++) for (let q = 1; q <= 4; q++) if (lastDay(y, q) + lag * DAY <= nowMs) { const i = y * 4 + (q - 1); if (best == null || i > best) best = i; }
  return best;
}

/** Graphiques dont le dernier trimestre est antérieur au dernier trimestre attendu. */
export function staleCharts(chain, nowMs) {
  const out = [];
  for (const [key, f] of Object.entries(chain.fm || {})) {
    const c = f.chart; if (!c) continue;
    const last = idxOf(c.x[c.x.length - 1]), due = dueIdx(nowMs, c.lag ?? 50);
    if (last != null && due != null && last < due) out.push({ key, name: f.name, last: labelOf(last), due: labelOf(due), auto: !!c.auto });
  }
  return out;
}

const within = (a, b, tol) => b > 0 && Math.abs(a - b) / b <= tol;

function setWindow(f, labelsIdx, byName, asOf, src) {
  const c = f.chart, n = c.x.length, oldFirst = idxOf(c.x[0]), shift = labelsIdx[0] - oldFirst;
  c.x = labelsIdx.map(labelOf);
  for (const s of c.ser) {
    const v = byName[s.n]; if (!v) continue;
    s.v = v;
    s.hol = (s.hol || []).map((i) => i - shift).filter((i) => i >= 0 && i < n);
  }
  c.as_of = asOf;
  const last = labelsIdx[n - 1];
  if (f.pie) {
    for (const it of f.pie.items) if (byName[it.n]) it.v = byName[it.n][n - 1];
    f.pie.m = String(f.pie.m || "").replace(/^T[1-4] \d{4}/, longLabel(last));
    f.pie.as_of = asOf;
    if (src) { f.pie.src = src.t; f.pie.u = src.u; }
  }
}

/** Fiche alimentée par une courbe de series.json (ex. capex trimestriel des quatre géants). */
function fromSeries(key, f, a, series) {
  const curve = series?.curves?.find((x) => x.id === a.curve);
  if (!curve) return { skip: "courbe " + a.curve + " absente" };
  const n = f.chart.x.length, byName = {}; let dates = null;
  for (const [name, from] of Object.entries(a.map)) {
    const pts = (curve.series.find((s) => s.name === from)?.points || []).slice(-n);
    if (pts.length < n) return { skip: `${from} : moins de ${n} points` };
    const d = pts.map((p) => p.d);
    if (dates && d.join() !== dates.join()) return { skip: "les séries n'ont pas les mêmes dates" };
    dates = d; byName[name] = pts.map((p) => p.v);
  }
  const idx = dates.map(qOfEnd);
  if (idx.some((i) => i == null) || idx.some((i, k) => k && i !== idx[k - 1] + 1)) return { skip: "trimestres non consécutifs" };
  for (const v of Object.values(byName)) if (v.some((x) => !(x > 0))) return { skip: "valeur nulle ou négative" };
  const same = f.chart.x.join() === idx.map(labelOf).join() && f.chart.ser.every((s) => !byName[s.n] || s.v.join() === byName[s.n].join());
  if (same) return { same: true };
  const last = dates[n - 1];
  setWindow(f, idx, byName, frDate(last), { t: "SEC (dépôts 10-Q et 10-K), via la courbe « Capex trimestriel »", u: curve.url && /^https:/.test(curve.url) ? curve.url : "https://www.sec.gov/edgar/search/" });
  if (f.pie) f.pie.m = f.pie.m.replace(/≈ \d+ Md\$/, "≈ " + Math.round(f.pie.items.reduce((s, i) => s + i.v, 0)) + " Md$");
  const tot = (k) => Math.round(f.chart.ser.reduce((s, x) => s + x.v[k], 0));
  f.chart.note = String(f.chart.note || "").replace(/(\d+) Md\$ au T\d \d{4}, (\d+) Md\$ au T\d \d{4}/, `${tot(0)} Md$ au ${longLabel(idx[0])}, ${tot(n - 1)} Md$ au ${longLabel(idx[n - 1])}`);
  return { changed: [labelOf(idx[n - 1])] };
}

/** Fiche alimentée par les revenus trimestriels XBRL de la SEC (sociétés entières, en dollars). */
async function fromSec(key, f, a, ctx, nowMs) {
  const c = f.chart, n = c.x.length, lastIdx = idxOf(c.x[n - 1]), next = lastIdx + 1;
  const nextEnd = lastDay(Math.floor(next / 4), (next % 4) + 1);
  if (nextEnd + 20 * DAY > nowMs) return { skip: "trimestre suivant trop récent pour être publié" };
  const q = {};
  for (const [name, cik] of Object.entries(a.sec)) {
    let best = null;
    for (const concept of REVENUE) {
      const arr = quarterly(await getConcept({ cik }, concept, ctx)); await ctx.sleep(150);
      if (arr.length && (!best || arr[arr.length - 1].end > best[best.length - 1].end)) best = arr;
    }
    if (!best) return { skip: `${name} : aucune donnée XBRL` };
    q[name] = new Map(best.map((e) => [qOfEnd(e.end), e]));
  }
  let add = 0;
  for (let i = next; i < next + 4; i++) { if (Object.keys(a.sec).every((nm) => q[nm].has(i))) add++; else break; }
  if (!add) return { skip: "trimestre suivant pas encore publié pour toutes les sociétés" };
  const labels = [...Array(n + add)].map((_, k) => lastIdx - (n - 1) + k).slice(add), byName = {}; let filed = "";
  for (const s of c.ser) {
    if (!(s.n in a.sec)) return { skip: `série « ${s.n} » sans source automatique` };
    const m = q[s.n];
    for (const k of [n - 1, n - 2]) {
      const e = m.get(lastIdx - (n - 1 - k)); if (!e) continue;
      if (!within(round(e.value / 1e9), s.v[k], 0.03)) return { skip: `${s.n} : ${c.x[k]} affiché ${s.v[k]} ≠ SEC ${round(e.value / 1e9)}` };
    }
    if (!m.has(lastIdx)) return { skip: `${s.n} : dernier trimestre affiché introuvable à la SEC` };
    const extra = [];
    for (let i = next; i < next + add; i++) {
      const e = m.get(i), v = round(e.value / 1e9), prev = extra.length ? extra[extra.length - 1] : s.v[n - 1];
      if (!(v > 0) || v / prev < 0.4 || v / prev > 3) return { skip: `${s.n} : ${labelOf(i)} = ${v} Md$ hors de la plage plausible (précédent ${prev})` };
      extra.push(v); if (e.filed > filed) filed = e.filed;
    }
    byName[s.n] = [...s.v, ...extra].slice(add);
  }
  setWindow(f, labels, byName, frDate(filed), null);
  return { changed: labels.slice(-add).map(labelOf) };
}

/**
 * Met à jour les fiches de chain.json qui déclarent `chart.auto`. Renvoie { chain, changes, skipped, stale }.
 * `chain` d'entrée n'est pas modifié.
 */
export async function updateChain({ chain, series = null, ua = null, fetchImpl = fetch, now = Date.now(), sleep = (t) => new Promise((r) => setTimeout(r, t)), log = () => {} }) {
  const out = JSON.parse(JSON.stringify(chain)), changes = [], skipped = [];
  const ctx = ua ? { ua, fetchImpl, sleep } : null;
  for (const [key, f] of Object.entries(out.fm || {})) {
    const a = f.chart?.auto; if (!a) continue;
    try {
      let r;
      if (a.from) r = fromSeries(key, f, a.from, series);
      else if (a.sec) r = ctx ? await fromSec(key, f, a, ctx, now) : { skip: "SEC_USER_AGENT absente" };
      else r = { skip: "type de mise à jour inconnu" };
      if (r.changed) { changes.push({ key, added: r.changed }); log(`Fiche « ${key} » : ${r.changed.join(", ")} ajouté`); }
      else if (r.skip) skipped.push({ key, reason: r.skip });
    } catch (e) { skipped.push({ key, reason: String(e.message || e).slice(0, 120) }); }
  }
  return { chain: changes.length ? out : chain, changes, skipped, stale: staleCharts(changes.length ? out : chain, now) };
}
