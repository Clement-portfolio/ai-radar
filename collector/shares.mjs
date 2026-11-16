// Parts de marché relues automatiquement à la source : HBM (Counterpoint) et fonderies (TrendForce).
// Règle : un chiffre n'est remplacé que si la lecture passe tous les contrôles ; sinon l'ancien chiffre reste, avec sa date et une alerte.
export const COUNTERPOINT_URL = "https://counterpointresearch.com/en/insights/global-dram-and-hbm-market-share";
export const TRENDFORCE_LIST = "https://www.trendforce.com/presscenter/news";
const UA = "Mozilla/5.0 (compatible; AIRadar/1.0)";
const DAY = 86400000, HOUR = 3600000;

const strip = (h) => String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();
const keyOf = (q, y) => `${y}Q${q}`;
const labelOf = (key) => `T${key.slice(5)} ${key.slice(0, 4)}`;
const nextKey = (key) => { const y = +key.slice(0, 4), q = +key.slice(5); return q === 4 ? keyOf(1, y + 1) : keyOf(q + 1, y); };
const quarterEnd = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5) * 3, 0); // dernier jour du trimestre
const num = (s) => parseFloat(String(s).replace(",", "."));

/** Tableaux HTML → { header:[…], rows:[[…]] } (texte brut). */
export function parseTables(html) {
  return [...String(html).matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => {
    const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[hd][\s\S]*?<\/t[hd]>/gi)].map((c) => strip(c[0])));
    return { header: rows[0] || [], rows: rows.slice(1) };
  });
}

/** Historique du tableau HBM : les cinq dernières colonnes « Qn yyyy », une série par fournisseur. */
export function parseHbmHistory(html) {
  const need = ["sk hynix", "samsung", "micron"];
  const t = parseTables(html).find((x) => {
    const names = x.rows.map((r) => (r[0] || "").toLowerCase());
    return need.every((n) => names.includes(n)) && !names.includes("cxmt") && !names.includes("nanya");
  });
  if (!t) throw new Error("tableau HBM introuvable (la page a changé ?)");
  const cols = t.header.map((h, i) => ({ i, m: String(h).match(/^Q([1-4])\s*(\d{4})$/i) })).filter((c) => c.m).slice(-5);
  if (cols.length < 3) throw new Error("moins de trois trimestres lisibles dans le tableau HBM");
  const names = { "sk hynix": "SK hynix", samsung: "Samsung", micron: "Micron" };
  const series = need.map((n) => ({ name: names[n], points: [] }));
  for (const c of cols) {
    const d = new Date(quarterEnd(keyOf(+c.m[1], +c.m[2]))).toISOString().slice(0, 10);
    let sum = 0;
    need.forEach((n, k) => {
      const row = t.rows.find((r) => (r[0] || "").toLowerCase() === n);
      const m = (row?.[c.i] || "").match(/^(\d+(?:[.,]\d+)?)\s*%$/);
      if (!m) throw new Error(`valeur illisible pour ${n} (${c.m[0]})`);
      const v = num(m[1]); sum += v; series[k].points.push({ d, v });
    });
    if (sum < 98 || sum > 102) throw new Error(`somme des parts HBM douteuse pour ${c.m[0]} : ${sum}`);
  }
  return series;
}

/** Tableau HBM de Counterpoint : celui qui contient SK Hynix, Samsung et Micron mais ni CXMT ni Nanya (c'est la DRAM). */
export function parseHbm(html) {
  const need = ["sk hynix", "samsung", "micron"];
  const t = parseTables(html).find((x) => {
    const names = x.rows.map((r) => (r[0] || "").toLowerCase());
    return need.every((n) => names.includes(n)) && !names.includes("cxmt") && !names.includes("nanya");
  });
  if (!t) throw new Error("tableau HBM introuvable (la page a changé ?)");
  const last = t.header[t.header.length - 1] || "";
  const m = last.match(/Q([1-4])\s*(\d{4})/i);
  if (!m) throw new Error("colonne du dernier trimestre illisible : « " + last + " »");
  const values = {};
  for (const n of need) {
    const row = t.rows.find((r) => (r[0] || "").toLowerCase() === n);
    const c = (row[row.length - 1] || "").match(/^(\d+(?:[.,]\d+)?)\s*%$/);
    if (!c) throw new Error("valeur illisible pour " + n);
    values[n] = num(c[1]);
  }
  const vals = Object.values(values), sum = vals.reduce((a, b) => a + b, 0);
  if (vals.some((v) => !(v > 0 && v < 100))) throw new Error("part hors bornes");
  if (sum < 98 || sum > 102) throw new Error("somme des parts HBM = " + sum + " % (attendu ≈ 100)");
  return { key: keyOf(m[1], m[2]), values };
}

const COMPANIES = [["TSMC", /\bTSMC\b/], ["Samsung", /\bSamsung\b/], ["SMIC", /\bSMIC\b/], ["UMC", /\bUMC\b/]];
/** Part de marché citée dans une phrase ; null si ambigu (on préfère échouer que se tromper). */
function shareIn(sentence) {
  let m = sentence.match(/(\d+(?:\.\d+)?)%\s+(?:market\s+)?share/i);
  if (m) return num(m[1]);
  m = sentence.match(/share[\s\S]{0,80}?\bto\s+(\d+(?:\.\d+)?)%/i);
  if (m) return num(m[1]);
  if (!/\bfrom\b/i.test(sentence)) { m = sentence.match(/share[^%]{0,40}?(\d+(?:\.\d+)?)%/i); if (m) return num(m[1]); }
  return null;
}
/** Communiqué TrendForce sur les fonderies : le classement est dans le texte, pas dans un tableau. */
export function parseFoundry(html) {
  const text = strip(html);
  const pm = text.match(/\b([1-4])Q(\d{2})\b/);
  if (!pm) throw new Error("trimestre introuvable dans le communiqué");
  const sentences = text.split(/(?<=[a-z0-9%)])\.\s+(?=[A-Z])/);
  const values = {};
  for (const [name, re] of COMPANIES) {
    for (let i = 0; i < sentences.length && values[name] == null; i++) {
      if (!re.test(sentences[i])) continue;
      let v = shareIn(sentences[i]);
      // la part est parfois dans la phrase suivante, qui commence par « Its market share… » (c'est le cas du communiqué du T2 2026)
      const nx = sentences[i + 1];
      if (v == null && nx && /^(Its|Their|The company['’]s)\b/.test(nx) && /share/i.test(nx)) v = shareIn(nx);
      if (v != null) values[name] = v;
    }
    if (values[name] == null) throw new Error("part de " + name + " introuvable ou ambiguë");
  }
  const vals = Object.values(values), sum = vals.reduce((a, b) => a + b, 0);
  if (vals.some((v) => !(v > 0 && v < 100))) throw new Error("part hors bornes");
  if (values.TSMC !== Math.max(...vals) || values.TSMC < 30) throw new Error("TSMC n'est pas en tête : lecture douteuse");
  if (sum < 60 || sum >= 100) throw new Error("somme des quatre parts = " + sum + " %");
  return { key: keyOf(pm[1], 2000 + +pm[2]), values };
}

/** Communiqués de la liste TrendForce : [{url,title}] dans l'ordre d'affichage. */
export function parseList(html, base = "https://www.trendforce.com") {
  return [...String(html).matchAll(/<a[^>]+href="([^"]*\/presscenter\/news\/\d{8}-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: m[1].startsWith("http") ? m[1] : base + m[1], title: strip(m[2]) })).filter((x) => x.title);
}
export const isFoundryTitle = (t) => /foundr/i.test(t) && /(revenue|ranking|market share)/i.test(t) && /\b[1-4]Q\d{2}\b/.test(t);
const titleKey = (t) => { const m = t.match(/\b([1-4])Q(\d{2})\b/); return m ? keyOf(m[1], 2000 + +m[2]) : null; };

async function getText(url, fetchImpl, sleep) {
  let err;
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetchImpl(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(30000), redirect: "follow" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) { err = e; await sleep(1500); }
  }
  throw err;
}

function apply(chart, parsed, labelMap, url, nowIso, restLabel) {
  const segs = chart.segments.filter((s) => s.label !== restLabel).map((s) => ({ label: s.label, pct: parsed.values[labelMap(s.label)] }));
  if (segs.some((s) => s.pct == null)) throw new Error("segment sans valeur");
  segs.sort((a, b) => b.pct - a.pct);
  if (restLabel) { const rest = Math.round((100 - segs.reduce((a, s) => a + s.pct, 0)) * 10) / 10; segs.push({ label: restLabel, pct: rest }); }
  chart.segments = segs; chart.period = labelOf(parsed.key); chart.period_key = parsed.key; chart.url = url; chart.checked_at = nowIso;
}

const CHARTS = {
  hbm: { interval: 20 * HOUR, retry: 6 * HOUR },
  foundry: { interval: 20 * HOUR, retry: 6 * HOUR },
};

export async function collectShares({ prev, fetchImpl = fetch, now = Date.now(), sleep = (t) => new Promise((r) => setTimeout(r, t)), log = () => {}, maxPages = 15 } = {}) {
  const summary = { refreshed: false, charts: {} };
  if (!prev || !Array.isArray(prev.charts)) return { doc: null, summary: { ...summary, reason: "fichier absent" } };
  const doc = JSON.parse(JSON.stringify(prev)), nowIso = new Date(now).toISOString();
  const by = (id) => doc.charts.find((c) => c.id === id);
  const due = (c, cfg) => !c.attempted_at || now - Date.parse(c.attempted_at) >= (c.check_error ? cfg.retry : cfg.interval);

  const run = async (id, fn) => {
    const c = by(id); if (!c || !c.auto) return;
    if (!due(c, CHARTS[id])) { summary.charts[id] = "ignoré (lu récemment)"; return; }
    c.attempted_at = nowIso;
    try {
      const r = await fn(c);
      if (r === "attente") { delete c.check_error; summary.charts[id] = "pas de nouvelle publication"; return; }
      delete c.check_error; summary.refreshed = true; summary.charts[id] = "ok : " + c.period;
    } catch (e) {
      c.check_error = String(e.message || e).slice(0, 200); summary.charts[id] = "erreur : " + c.check_error;
      log(`Parts de marché (${id}) : ${c.check_error}`);
    }
  };

  await run("hbm", async (c) => {
    const html = await getText(COUNTERPOINT_URL, fetchImpl, sleep);
    const p = parseHbm(html);
    if (c.period_key && p.key < c.period_key) throw new Error("trimestre lu (" + p.key + ") antérieur à celui affiché (" + c.period_key + ")");
    apply(c, p, (l) => l.toLowerCase(), COUNTERPOINT_URL, nowIso, null);
  });

  await run("foundry", async (c) => {
    const wanted = nextKey(c.period_key || "2000Q1");
    if (c.period_key && now < quarterEnd(wanted) + 60 * DAY) return "attente"; // le classement du trimestre suivant sort environ 70 jours après sa clôture
    let found = null;
    for (let page = 1; page <= maxPages && !found; page++) {
      const html = await getText(page === 1 ? TRENDFORCE_LIST : `${TRENDFORCE_LIST}?page=${page}`, fetchImpl, sleep);
      found = parseList(html).find((x) => isFoundryTitle(x.title) && titleKey(x.title) > (c.period_key || ""));
      if (!found) await sleep(500);
    }
    if (!found) return "attente";
    const p = parseFoundry(await getText(found.url, fetchImpl, sleep));
    if (p.key !== titleKey(found.title)) throw new Error("trimestre du texte (" + p.key + ") différent de celui du titre");
    apply(c, p, (l) => l, found.url, nowIso, "Autres");
  });

  return { doc, summary };
}
