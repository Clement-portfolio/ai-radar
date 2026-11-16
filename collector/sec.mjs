// Capex et revenus déclarés par les géants américains, lus dans les données XBRL de la SEC (api officielle).
// Rien n'est estimé : chaque chiffre vient d'un dépôt 10-K / 10-Q identifié (date de période, date de dépôt, lien).
export const SEC_COMPANIES = [
  { name: "Microsoft", cik: "789019" },
  { name: "Alphabet", cik: "1652044" },
  { name: "Amazon", cik: "1018724" },
  { name: "Meta", cik: "1326801" },
  { name: "Oracle", cik: "1341439" },
];
const CAPEX = ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"];
const REVENUE = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"];

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

async function getConcept(c, concept, { ua, fetchImpl, sleep }) {
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

async function metric(c, concepts, ctx, nowMs) {
  let best = null;
  for (const concept of concepts) {
    const t = trailing(await getConcept(c, concept, ctx));
    await ctx.sleep(150);
    if (!t || !(t.value > 0)) continue;
    if (nowMs - ms(t.end) > 600 * DAY) continue; // balise abandonnée
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
export async function collectSec({ ua, fetchImpl = fetch, prev = null, now = Date.now(), companies = SEC_COMPANIES, maxAgeH = 20, sleep = (t) => new Promise((r) => setTimeout(r, t)), log = () => {} } = {}) {
  if (!ua) return { doc: prev, summary: { refreshed: false, reason: "SEC_USER_AGENT absente" } };
  const ctx = { ua, fetchImpl, sleep }, prevBy = new Map((prev?.companies || []).map((c) => [String(c.cik), c]));
  const out = [], ko = []; let ok = 0, skipped = 0;
  for (const c of companies) {
    const p = prevBy.get(String(c.cik));
    const fresh = (m) => m?.fetched_at && now - Date.parse(m.fetched_at) < maxAgeH * 3600e3;
    if (p && fresh(p.capex) && fresh(p.revenue)) { out.push(p); skipped++; continue; }
    try {
      const capex = await metric(c, CAPEX, ctx, now), revenue = await metric(c, REVENUE, ctx, now);
      if (!capex && !revenue) throw new Error("aucune donnée XBRL exploitable");
      out.push({ name: c.name, cik: String(c.cik), capex: capex || p?.capex || null, revenue: revenue || p?.revenue || null });
      ok++;
    } catch (e) { ko.push(`${c.name} : ${e.message}`); if (p) out.push(p); }
  }
  log(`SEC XBRL : ${ok} société(s) lue(s), ${skipped} déjà à jour, ${ko.length} échec(s)`);
  const doc = out.length ? { updated_at: ok ? new Date(now).toISOString() : prev?.updated_at || null, companies: out } : prev;
  return { doc, summary: { refreshed: ok > 0, ok, skipped, ko } };
}
