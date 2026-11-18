// Watchlist d'entreprises par composant de l'infrastructure IA (public/data/watchlist.json)
// → étiquette les articles (groupe + entreprises), écarte le trading, et tient à jour public/data/watch.json,
// lu par l'onglet Infrastructure pour afficher, sous chaque fiche marché, les actualités du composant choisi.
// Règle éditoriale : le site suit l'industrie, pas la Bourse. Cours, objectifs d'analystes, consensus, notations : exclus.

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const L = "(?<![\\p{L}\\p{N}])", R = "(?![\\p{L}\\p{N}])";

/** Un alias commençant par « = » respecte la casse (ex. « =Arm ») ; les autres l'ignorent. */
function aliasRe(a) {
  const cs = a.startsWith("="), t = cs ? a.slice(1) : a;
  return new RegExp(L + esc(t).replace(/\s+/g, "\\s+") + R, cs ? "u" : "iu");
}

export function compileWatchlist(doc) {
  const groups = (doc?.groups || []).map((g) => ({
    id: g.id, name: g.name, parts: g.parts || [], scope: g.scope || "", q: g.q || [],
    kw: g.kw ? new RegExp(g.kw, "iu") : null, cx: g.cx ? new RegExp(g.cx, "iu") : (g.kw ? new RegExp(g.kw, "iu") : null),
    cos: (g.cos || []).map((c) => ({ n: c.n, c: c.c, k: c.k, w: !!c.w, res: [...(c.x ? [] : [c.n]), ...(c.a || [])].map(aliasRe) })),
  }));
  const byPart = {};
  for (const g of groups) for (const p of g.parts) (byPart[p] ||= []).push(g.id);
  return { groups, byId: Object.fromEntries(groups.map((g) => [g.id, g])), byPart, as_of: doc?.as_of || null };
}

// ───────────────────────── trading : à exclure ─────────────────────────
const MOVE = String.raw`(?:surge[sd]?|soar\w*|plunge[sd]?|tumble[sd]?|slump\w*|jump\w*|rall(?:y|ies|ied)|climb\w*|sink\w*|slide\w*|slid|drop\w*|fall\w*|fell|rise[sn]?|rose|gain\w*|sag\w*|dip\w*|crash\w*|spike[sd]?|pop\w*|record high|all-time high)`;
export const TRADING_RE = new RegExp([
  String.raw`\b(?:stocks?|share price|stock price|price targets?|target price|price-target|buy rating|sell rating|hold rating|overweight|underweight|outperform|market cap(?:italization)?|sell-?off|short[- ]sellers?|short interest|dividends?|buybacks?|ETFs?|wall street|nasdaq|s&p ?500|dow jones|bullish|bearish|hedge funds?|top picks?|should you buy|worth buying|buy the dip|penny stock|trading at|premarket|after-hours|price action|technical analysis|EPS|upgrad(?:e|es|ed) (?:to|on)|downgrad(?:e|es|ed) (?:to|on))\b`,
  String.raw`\banalysts?\s+(?:rat\w+|estimates?|forecasts?|consensus|price|target|upgrade|downgrade|say|expect|predict|raise|cut|call|note|see|view)\b`,
  String.raw`\bconsensus (?:estimate|forecast|rating|view|expectations?)\b|\bearnings (?:beat|miss|per share)\b|\bbeats? (?:earnings|estimates|expectations|consensus)\b`,
  String.raw`\bshares?\s+(?:\w+\s+){0,3}${MOVE}\b|\b${MOVE}\s+(?:\w+\s+){0,3}shares\b`,
  String.raw`\b(?:action\s+(?:\S+\s+){0,3}(?:en (?:hausse|baisse|chute|forte)|grimpe|chute|bondit|s'envole|plonge|recule)|cours de bourse|objectif de cours|recommandation d'achat|analystes?|haussier|baissier|séance|la bourse|consensus des analystes|dividendes?)\b`,
].join("|"), "iu");

export const TRADING_DOMAINS = ["seekingalpha.com", "fool.com", "zacks.com", "benzinga.com", "investopedia.com", "tipranks.com", "marketbeat.com", "investorplace.com", "barrons.com", "marketwatch.com", "stocktwits.com", "thestreet.com", "finance.yahoo.com", "investors.com", "247wallst.com", "gurufocus.com", "simplywall.st", "morningstar.com", "tradingview.com", "kiplinger.com", "foxbusiness.com"];

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };

/** Vrai si l'article parle surtout de cours, de notes d'analystes ou de consensus. */
export function isTrading(it) {
  if (it.trading === true) return true;
  const h = hostOf(it.url);
  if (h && TRADING_DOMAINS.some((d) => h === d || h.endsWith("." + d))) return true;
  const t = `${it.title || ""} ${it.orig || ""} ${it.title_en || ""}`;
  return TRADING_RE.test(t);
}

// ───────────────────────── étiquetage ─────────────────────────

/**
 * { g: [identifiants de groupes], cos: [entreprises nommées] }.
 * Les entreprises se cherchent dans le titre seul (un résumé qui cite Nvidia au passage ne rattache pas l'article aux puces) ;
 * les mots-clés sectoriels se cherchent dans le titre et le résumé. Une entreprise « large » (w) ne compte qu'avec le contexte du groupe.
 */
export function tagText(full, W, title = full) {
  const g = [], cos = [];
  for (const grp of W.groups) {
    const hit = grp.cos.filter((c) => c.res.some((re) => re.test(title)) && (!c.w || (grp.cx && grp.cx.test(full))));
    const topic = grp.kw ? grp.kw.test(full) : false;
    if (hit.length || topic) { g.push(grp.id); for (const c of hit) if (!cos.includes(c.n)) cos.push(c.n); }
  }
  return { g, cos };
}
// Noms d'entreprises : titre d'origine (souvent anglais) et sa version anglaise, jamais la traduction française (« Humain » = « humain » en français).
export const titleText = (it) => `${it.orig || it.title || ""} ${it.title_en || ""}`;
export const itemText = (it) => `${it.title || ""} ${titleText(it)} ${it.summary || ""}`;
export const tagItem = (it, W) => tagText(itemText(it), W, titleText(it));

/** Candidat brut (avant classement par l'IA) : retenu pour la watchlist s'il nomme une entreprise ou un sujet suivi, hors trading. */
export function watchCandidateOk(c, W) {
  if (isTrading({ title: c.title, url: c.url })) return false;
  return tagText(`${c.title || ""} ${c.snippet || ""}`, W, c.title || "").g.length > 0;
}

/** Requêtes Google News de la watchlist (une tâche par requête). */
export function watchJobs(W) { return W.groups.flatMap((g) => g.q.map((q) => ({ group: g.id, q }))); }

// ───────────────────────── magasin public/data/watch.json ─────────────────────────
const clip = (s, n) => { const x = String(s || "").trim().replace(/\s+/g, " "); return x.length > n ? x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : x; };
export const PER_GROUP = 20, MAX_AGE_DAYS = 120;
const slim = (it, tag) => ({
  id: it.id, ts: it.ts, title: it.title, ...(it.title_en && it.title_en !== it.title ? { title_en: it.title_en } : {}),
  ...(it.summary ? { summary: clip(it.summary, 200) } : {}), ...(it.summary_en ? { summary_en: clip(it.summary_en, 200) } : {}),
  source: it.source, url: it.url, country: it.country, imp: it.importance || 1, ...(it.confidence ? { conf: it.confidence } : {}), ...(it.category ? { cat: it.category } : {}), ...(it.layer ? { lay: it.layer } : {}), g: tag.g, cos: tag.cos.slice(0, 6), ...(it.pending ? { pending: true } : {}),
});
const score = (x) => Date.parse(x.ts) + (x.imp - 1) * 2 * 86400000;
const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "des", "les", "une", "pour", "dans", "sur", "aux", "avec", "par", "est", "son", "ses", "its", "has", "have", "will", "new", "après", "plus", "que", "qui"]);
const toks = (x) => new Set(String(x.title_en || x.orig || x.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9$%.]+/).filter((w) => (w.length > 2 || /\d/.test(w)) && !STOP.has(w)));
const jac = (a, b) => { let i = 0; for (const t of a) if (b.has(t)) i++; return a.size + b.size - i ? i / (a.size + b.size - i) : 0; };
/** Même nouvelle reprise par plusieurs médias : titres proches, ou même entreprise le même jour avec des mots en commun. Le premier (meilleur score) est gardé. */
export function dedupe(list) {
  const out = [];
  for (const x of list) {
    const tx = toks(x);
    const dup = out.some((y) => { const j = jac(tx, toks(y)); return j >= 0.5 || (j >= 0.25 && x.ts.slice(0, 10) === y.ts.slice(0, 10) && x.cos?.length && y.cos?.length && x.cos[0] === y.cos[0]); });
    if (!dup) out.push(x);
  }
  return out;
}

/**
 * Fusionne les articles étiquetés du flux avec le magasin précédent : les articles restent après leur sortie du flux principal (plafonné à 1 500 articles).
 * Les 20 meilleurs (récents et importants) de chaque groupe sont conservés, 120 jours au plus.
 */
export function buildWatch({ prev, items, W, now = Date.now(), perGroup = PER_GROUP, maxAgeDays = MAX_AGE_DAYS }) {
  const byId = new Map();
  for (const x of prev?.items || []) byId.set(x.id, x);
  let tagged = 0;
  for (const it of items) {
    if (!it.url || !it.title || isTrading(it)) { if (byId.has(it.id) && isTrading(it)) byId.delete(it.id); continue; }
    const tag = tagItem(it, W);
    if (!tag.g.length) continue;
    byId.set(it.id, slim(it, tag)); tagged++;
  }
  // un article déjà stocké mais devenu « trading » (indicateur de l'IA) disparaît
  for (const x of [...byId.values()]) if (isTrading({ title: x.title, orig: "", title_en: x.title_en, url: x.url })) byId.delete(x.id);
  const alive = dedupe([...byId.values()].filter((x) => now - Date.parse(x.ts) < maxAgeDays * 86400000 && x.g?.length).sort((a, b) => score(b) - score(a)));
  const keep = new Set();
  for (const g of W.groups) alive.filter((x) => x.g.includes(g.id)).sort((a, b) => score(b) - score(a)).slice(0, perGroup).forEach((x) => keep.add(x.id));
  const outItems = alive.filter((x) => keep.has(x.id)).sort((a, b) => b.ts.localeCompare(a.ts));
  const counts = {}; for (const g of W.groups) counts[g.id] = outItems.filter((x) => x.g.includes(g.id)).length;
  return {
    doc: {
      updated_at: new Date(now).toISOString(),
      groups: Object.fromEntries(W.groups.map((g) => [g.id, { name: g.name, scope: g.scope, parts: g.parts, n: counts[g.id], cos: g.cos.map((c) => ({ n: c.n, c: c.c, k: c.k })) }])),
      items: outItems,
    },
    summary: { tagged, total: outItems.length, counts },
  };
}
