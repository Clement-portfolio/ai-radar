// Capex et revenus déclarés par les géants américains, lus dans les données XBRL de la SEC (api officielle).
// Rien n'est estimé : chaque chiffre vient d'un dépôt 10-K / 10-Q identifié (date de période, date de dépôt, lien).
export const SEC_COMPANIES = [
  { name: "Microsoft", cik: "789019" },
  { name: "Alphabet", cik: "1652044" },
  { name: "Amazon", cik: "1018724" },
  { name: "Meta", cik: "1326801" },
  { name: "Oracle", cik: "1341439" },
];
// Sociétés cotées de la chaîne de valeur (page « Acteurs ») : leurs chiffres vont dans sec-acteurs.json, jamais dans sec.json
// (sec.json alimente le camembert du capex des cinq géants : l'élargir changerait ce graphique).
export const SEC_ACTORS = [
  { name: "Nvidia", cik: "1045810" }, { name: "AMD", cik: "2488" }, { name: "Broadcom", cik: "1730168" }, { name: "Marvell", cik: "1835632" },
  { name: "Micron", cik: "723125" }, { name: "Intel", cik: "50863" }, { name: "GlobalFoundries", cik: "1709048" }, { name: "Amkor", cik: "1047127" },
  { name: "Microsoft", cik: "789019" }, { name: "Alphabet", cik: "1652044" }, { name: "Amazon", cik: "1018724" }, { name: "Meta", cik: "1326801" },
  { name: "Cisco", cik: "858877" }, { name: "Arista", cik: "1596532" }, { name: "Credo", cik: "1807794" }, { name: "Astera Labs", cik: "1736297" },
  { name: "Coherent", cik: "820318" }, { name: "Lumentum", cik: "1633978" }, { name: "Amphenol", cik: "820313" }, { name: "Vertiv", cik: "1674101" },
  { name: "Eaton", cik: "1551182" }, { name: "GE Vernova", cik: "1996810" }, { name: "Cadence", cik: "813672" }, { name: "Synopsys", cik: "883241" },
  { name: "Oklo", cik: "1849056" }, { name: "NuScale", cik: "1822966" },
  { name: "CoreWeave", cik: "1769628" }, { name: "IREN", cik: "1878848" },
];
// Carnet de commandes contractuel déclaré (RPO = obligations de performance restantes), valeur à une date, pas sur une période.
export const BACKLOG = ["RevenueRemainingPerformanceObligation"];
// Prises de participation et acquisitions (flux de trésorerie) : on ne retient pas « PaymentsToAcquireInvestments », qui mélange titres de trésorerie et participations.
export const STAKES = [
  ["PaymentsToAcquireBusinessesNetOfCashAcquired", "Acquisitions d'entreprises"],
  ["PaymentsToAcquireEquityMethodInvestments", "Participations (mise en équivalence)"],
  ["PaymentsToAcquireOtherInvestments", "Autres placements (titres non cotés)"],
  ["PaymentsToAcquireEquitySecuritiesFvNi", "Actions et titres de capital"],
];
export const CAPEX = ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"];
export const REVENUE = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"];

const DAY = 86400000;
const ms = (d) => Date.parse(d + "T00:00:00Z");
const dur = (e) => Math.round((ms(e.end) - ms(e.start)) / DAY);

/**
 * Douze derniers mois = dernier exercice (10-K) + cumul de l'exercice en cours − même cumul un an plus tôt.
 * Sans cumul comparable, on renvoie le dernier exercice annuel, signalé comme tel.
 */
export function trailing(entries) {
  const byPeriod = new Map();
  for (const e of entries || []) {
    if (!e || !e.start || !e.end || typeof e.val !== "number") continue;
    const k = e.start + "|" + e.end, o = byPeriod.get(k);
    if (!o || String(e.filed) > String(o.filed)) byPeriod.set(k, e);
  }
  const all = [...byPeriod.values()];
  const A = all.filter((e) => dur(e) >= 350 && dur(e) <= 380 && /^10-K/.test(e.form || "")).sort((a, b) => b.end.localeCompare(a.end))[0];
  if (!A) return null;
  const Y = all.filter((e) => e.end > A.end && dur(e) >= 80 && dur(e) < 350).sort((a, b) => b.end.localeCompare(a.end) || dur(b) - dur(a))[0];
  const P = Y && all.find((e) => Math.abs(ms(e.end) - (ms(Y.end) - 365 * DAY)) <= 12 * DAY && Math.abs(dur(e) - dur(Y)) <= 7);
  const pick = (value, basis, start, end, ref) => ({ value, basis, start, end, form: ref.form, filed: ref.filed, accn: ref.accn });
  if (Y && P) return pick(A.val + Y.val - P.val, "ttm", new Date(ms(Y.end) - 365 * DAY + DAY).toISOString().slice(0, 10), Y.end, Y);
  return pick(A.val, "annual", A.start, A.end, A);
}

/** Dernière valeur « à une date » (sans début de période) d'un 10-K ou 10-Q ; la plus récemment déposée l'emporte pour une même date. */
export function latestInstant(entries) {
  const byEnd = new Map();
  for (const e of entries || []) {
    if (!e || !e.end || typeof e.val !== "number" || !/^10-[KQ]/.test(e.form || "")) continue;
    const o = byEnd.get(e.end);
    if (!o || String(e.filed) > String(o.filed)) byEnd.set(e.end, e);
  }
  const L = [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end))[0];
  return L ? { value: L.val, basis: "date", start: null, end: L.end, form: L.form, filed: L.filed, accn: L.accn } : null;
}

export async function getConcept(c, concept, { ua, fetchImpl, sleep }) {
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(c.cik).padStart(10, "0")}/us-gaap/${concept}.json`;
  let err;
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetchImpl(url, { headers: { "user-agent": ua, accept: "application/json" }, signal: AbortSignal.timeout(20000), redirect: "follow" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = JSON.parse(await r.text());
      return j?.units?.USD || null;
    } catch (e) { err = e; await sleep(1500); }
  }
  throw err;
}


/**
 * Valeurs trimestrielles (une par fin de trimestre) : trimestre publié tel quel, sinon cumul de l'exercice moins le cumul précédent
 * (6 mois − 3 mois, 9 mois − 6 mois, exercice 10-K − 9 mois). Rien d'estimé : pas de cumul précédent, pas de trimestre.
 */
export function quarterly(entries) {
  const byPeriod = new Map();
  for (const e of entries || []) {
    if (!e || !e.start || !e.end || typeof e.val !== "number") continue;
    const k = e.start + "|" + e.end, o = byPeriod.get(k);
    if (!o || String(e.filed) > String(o.filed)) byPeriod.set(k, e);
  }
  const all = [...byPeriod.values()], out = new Map();
  const has = (end) => [...out.keys()].some((k) => Math.abs(ms(k) - ms(end)) <= 7 * DAY);
  for (const e of all) if (dur(e) >= 80 && dur(e) <= 100) out.set(e.end, { end: e.end, value: e.val, basis: "trimestre", form: e.form, filed: e.filed });
  const steps = [[170, 190, 90], [260, 280, 180], [350, 380, 270]];
  for (const y of all) {
    for (const [lo, hi, prevDur] of steps) {
      if (dur(y) < lo || dur(y) > hi || (lo === 350 && !/^10-K/.test(y.form || ""))) continue;
      const prev = all.find((p) => p.start === y.start && Math.abs(dur(p) - prevDur) <= 12);
      if (prev && !has(y.end)) out.set(y.end, { end: y.end, value: y.val - prev.val, basis: "cumul", form: y.form, filed: y.filed });
    }
  }
  return [...out.values()].sort((a, b) => a.end.localeCompare(b.end));
}

async function metric(c, concepts, ctx, nowMs, instant = false, withQuarters = false) {
  let best = null;
  for (const concept of concepts) {
    const raw = await getConcept(c, concept, ctx);
    const t0 = instant ? latestInstant(raw) : trailing(raw);
    const t = t0 && withQuarters ? { ...t0, quarters: quarterly(raw).slice(-6) } : t0;
    await ctx.sleep(150);
    if (!t || !(t.value > 0)) continue;
    if (nowMs - ms(t.end) > (instant ? 400 : 600) * DAY) continue; // balise abandonnée
    if (!best || t.end > best.end) best = { ...t, concept };
  }
  if (!best) return null;
  const n = String(best.accn || "");
  return { ...best, fetched_at: new Date(nowMs).toISOString(), url: n ? `https://www.sec.gov/Archives/edgar/data/${+c.cik}/${n.replace(/-/g, "")}/${n}-index.htm` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=10-Q` };
}

/**
 * Met à jour sec.json. Une société déjà lue il y a moins de maxAgeH heures n'est pas relue ;
 * en cas d'échec, l'ancien chiffre est conservé avec sa propre date de lecture (l'interface alerte au-delà de 30 jours).
 */
export async function collectSec({ ua, fetchImpl = fetch, prev = null, now = Date.now(), companies = SEC_COMPANIES, metrics = ["capex", "revenue"], maxAgeH = 20, sleep = (t) => new Promise((r) => setTimeout(r, t)), log = () => {} } = {}) {
  if (!ua) return { doc: prev, summary: { refreshed: false, reason: "SEC_USER_AGENT absente" } };
  const ctx = { ua, fetchImpl, sleep }, prevBy = new Map((prev?.companies || []).map((c) => [String(c.cik), c]));
  const out = [], ko = []; let ok = 0, skipped = 0;
  for (const c of companies) {
    const p = prevBy.get(String(c.cik));
    const fresh = (m) => !Array.isArray(m) && m?.fetched_at && now - Date.parse(m.fetched_at) < maxAgeH * 3600e3;
    // une métrique déjà tentée (même absente) est « fraîche » tant que la société a été lue il y a moins de maxAgeH heures
    const readFresh = p?.read_at && now - Date.parse(p.read_at) < maxAgeH * 3600e3;
    if (p && metrics.every((k) => (k in p) && (p[k] ? (Array.isArray(p[k]) ? readFresh : fresh(p[k])) : readFresh))) { out.push(p); skipped++; continue; }
    try {
      const got = {};
      if (metrics.includes("capex")) got.capex = await metric(c, CAPEX, ctx, now);
      if (metrics.includes("revenue")) got.revenue = await metric(c, REVENUE, ctx, now, false, metrics.includes("stakes"));
      if (metrics.includes("stakes")) {
        const rows = [];
        for (const [concept, label] of STAKES) {
          const t = trailing(await getConcept(c, concept, ctx));
          await ctx.sleep(150);
          if (t && t.value > 0 && now - ms(t.end) <= 600 * DAY) rows.push({ concept, label, value: t.value, basis: t.basis, start: t.start, end: t.end, form: t.form, filed: t.filed });
        }
        got.stakes = rows.length ? rows : null;
      }
      if (metrics.includes("backlog")) got.backlog = await metric(c, BACKLOG, ctx, now, true);
      if (!Object.values(got).some(Boolean)) throw new Error("aucune donnée XBRL exploitable");
      const row = { name: c.name, cik: String(c.cik) };
      for (const k of metrics) row[k] = got[k] || p?.[k] || null;
      if (metrics.includes("backlog") || metrics.length > 2) row.read_at = new Date(now).toISOString();
      out.push(row);
      ok++;
    } catch (e) { ko.push(`${c.name} : ${e.message}`); if (p) out.push(p); }
  }
  log(`SEC XBRL : ${ok} société(s) lue(s), ${skipped} déjà à jour, ${ko.length} échec(s)`);
  const doc = out.length ? { updated_at: ok ? new Date(now).toISOString() : prev?.updated_at || null, companies: out } : prev;
  return { doc, summary: { refreshed: ok > 0, ok, skipped, ko } };
}
