// Collecte X (Twitter) : deux passages par jour, plafonnés à 28 posts chacun et 55 par jour. Chaque post lu coûte 0,005 $.
// Principes : requêtes « from:a OR from:b » par petits lots (le coût suit les posts renvoyés, pas les appels), retweets et réponses exclus,
// fenêtre depuis le dernier passage, identifiants d'auteurs mémorisés pour ne plus demander les auteurs (« expansions », facturés en plus),
// tri par l'IA (hors coût X), détection de ce que la presse a déjà relayé.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digitsOf } from "./brief.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";
import { foreignScript } from "./translate.mjs";

const DAY = 864e5, H = 3600e3;
export const X_RULES = { retainDays: 30, maxItems: 600, perDay: 40, perRun: 20, minRead: 10, windowH: 26, relayDays: 4, relaySim: 0.25, textMax: 500, longMax: 700 };
export const KINDS = ["annonce", "info", "analyse", "donnee", "rumeur", "autre"];
export const DOMAINS = ["modeles", "calcul", "robotique", "espace", "biologie", "sante", "energie", "securite", "marche", "politique", "autre"];

/* ---------- requêtes ---------- */
export function chunkList(list, n) {
  const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out;
}
function rawQuery(handles, terms = []) {
  const from = "(" + handles.map((h) => "from:" + h).join(" OR ") + ")";
  const kw = terms.length ? " (" + terms.join(" OR ") + ")" : "";
  return from + kw + " -is:retweet -is:reply";
}
export function buildQuery(handles, terms = []) {
  const q = rawQuery(handles, terms);
  if (q.length > 500) throw new Error("requête trop longue");
  return q;
}
function queryChunks(list, terms, limit = 500) {
  const out = []; let part = [];
  for (const h of list) {
    const next = [...part, h];
    if (part.length && rawQuery(next, terms).length > limit) { out.push(part); part = [h]; }
    else part = next;
    if (rawQuery(part, terms).length > limit) throw new Error("les mots-clés dépassent la limite de X");
  }
  if (part.length) out.push(part);
  return out;
}
const SEARCH_CONTEXT = ["AI","artificial intelligence","GPU","GPUs","TPU","TPUs","HBM","memory","DRAM","NAND","inference","training","datacenter","data center","semiconductor","chip","chips","accelerator","silicon","silicon photonics","advanced packaging","CoWoS","AI capex","power capacity","grid connection","cooling","networking","optical interconnect","hyperscaler"];
const DIRECT_AI = ["AI","artificial intelligence","GPU","GPUs","TPU","TPUs","inference","training","datacenter","data center","AI model","AI infrastructure","accelerator","compute","LLM","frontier model"];
const STRATEGIC = ["investment","invests","capex","capacity","supply","shortage","contract","orders","shipment","shipments","production","fab","datacenter","data center","power","gigawatt","megawatt","customer","revenue","earnings","partnership","acquisition","funding","deployment","buildout","HBM","CoWoS","advanced packaging"];
const escapeRe = (s) => String(s).replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
function hasTerm(text, term) {
  const cleanTerm = String(term).replace(/^\$/, "").trim();
  const pattern = cleanTerm.split(/\s+/).map(escapeRe).join("[\\s-]+");
  return new RegExp("(^|[^\\p{L}\\p{N}])" + pattern + "($|[^\\p{L}\\p{N}])", "iu").test(String(text || ""));
}
export function matchRelevance(text, cfg) {
  const source = String(text || "");
  const watchlist = (cfg.watchlist || []).filter((w) => (w.terms || []).some((term) => hasTerm(source, term)));
  const signals = (cfg.priority_terms || []).filter((term) => hasTerm(source, term));
  const aiContext = SEARCH_CONTEXT.some((term) => hasTerm(source, term));
  const directContext = DIRECT_AI.some((term) => hasTerm(source, term));
  const relevantWatchlist = watchlist.filter((w) => w.group === "diversified" ? directContext : aiContext);
  const specificSignals = signals.filter((s) => !["AI","artificial intelligence","FED","Federal Reserve","capex"].includes(s));
  const relevant = relevantWatchlist.length > 0 || specificSignals.length > 0 || (signals.includes("FED") && directContext) || (signals.includes("AI") && signals.length >= 2 && aiContext);
  return { relevant, watchlist: relevantWatchlist.map((w) => w.name), signals, aiContext };
}
export function sourceClass(handle, tier, cfg) {
  const h = String(handle || "").toLowerCase();
  for (const [kind, handles] of Object.entries(cfg.source_classes || {})) if (handles.some((v) => String(v).toLowerCase() === h)) return kind;
  return tier === "t2" ? "executive" : tier === "flux" ? "media" : "specialist";
}
export function scorePost(post, cfg) {
  const cls = post.source_class || sourceClass(post.handle, post.tier, cfg);
  const weight = cfg.source_weights?.[cls] ?? 1;
  const watchHits = post.relevance?.watchlist?.length || 0;
  const signalHits = post.relevance?.signals?.length || 0;
  const strategicHits = STRATEGIC.filter((term) => hasTerm(post.text, term)).length;
  const imp = post.v?.imp || 1;
  const score = imp * 10 + Math.min(10, watchHits * 4) + Math.min(7, signalHits * 1.2) + Math.min(5, strategicHits * 1.5) + weight * 3 + (post.media === 0 ? 2 : 0) + Math.min(3, 0.5 * Math.log10((post.eng || 0) + 1)) + Math.min(4, post.buzz || 0);
  let priority = "P4";
  if (imp >= 2 && watchHits > 0 && strategicHits > 0) priority = "P1";
  else if (imp >= 3 && (watchHits > 0 || signalHits >= 2) && ["analyst","insider","researcher","media"].includes(cls)) priority = "P1";
  else if (imp >= 2 && (watchHits > 0 || signalHits >= 2)) priority = "P2";
  else if (imp >= 2 || watchHits > 0 || signalHits > 0) priority = "P3";
  return { score, priority, source_class: cls, watchlist: post.relevance?.watchlist || [], signals: post.relevance?.signals || [] };
}
/** Seuls les comptes suivis sont interrogés ; watchlist et signaux IA filtrent leurs publications. */
export function dayPlan(cfg, now) {
  const cap = { ...cfg.caps, day: Math.min(cfg.caps.day, cfg.caps.run || cfg.caps.day) };
  const terms = cfg.search_terms || cfg.flux_terms || [];
  const plan = [];
  const add = (name, list, total) => {
    const chunks = queryChunks(list, terms, 500); if (!chunks.length) return;
    const per = Math.max(X_RULES.minRead, Math.floor(total / chunks.length));
    for (const c of chunks) plan.push({ tier: name, handles: c, max: Math.min(100, per), query: buildQuery(c, terms) });
  };
  add("t1", cfg.t1, cap.t1);
  add("t2", cfg.t2, cap.t2);
  add("flux", cfg.flux, cap.flux);
  const slot = Math.floor(now / (12 * H));
  if (plan.length > 1) { const shift = (slot * 3) % plan.length; plan.push(...plan.splice(0, shift)); }
  let sum = plan.reduce((s, p) => s + p.max, 0);
  for (let i = plan.length - 1; i >= 0 && sum > cap.day; i--) { const cut = Math.min(plan[i].max - X_RULES.minRead, sum - cap.day); plan[i].max -= cut; sum -= cut; }
  while (sum > cap.day && plan.length) { sum -= plan.pop().max; }
  return plan;
}

/* ---------- appel à X ---------- */
export async function fetchChunk({ fetchImpl, token, query, max, start, base = "https://api.x.com" }) {
  const params = new URLSearchParams({ query, max_results: String(Math.max(X_RULES.minRead, Math.min(100, max))), start_time: new Date(start).toISOString().replace(/\.\d+Z$/, "Z"), "tweet.fields": "created_at,public_metrics,author_id,lang" });
  const r = await fetchImpl(`${base}/2/tweets/search/recent?${params}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await r.text();
  if (!r.ok) { const e = new Error(`X ${r.status} : ${body.slice(0, 160).replace(/\s+/g, " ")}`); e.status = r.status; throw e; }
  const j = JSON.parse(body);
  return { posts: (j.data || []).slice(0, Math.min(100, max)) };
}

/** Pseudos des auteurs inconnus (un « User : Read » à 0,010 $ par compte, une seule fois : le résultat est mémorisé). */
export async function lookupUsers({ fetchImpl, token, ids, base = "https://api.x.com" }) {
  const out = {};
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const r = await fetchImpl(`${base}/2/users?${new URLSearchParams({ ids: part.join(","), "user.fields": "username,name" })}`, { headers: { authorization: `Bearer ${token}` } });
    const body = await r.text();
    if (!r.ok) { const e = new Error(`X ${r.status} (users) : ${body.slice(0, 120).replace(/\s+/g, " ")}`); e.status = r.status; throw e; }
    for (const u of JSON.parse(body).data || []) out[u.id] = { username: u.username, name: u.name || "" };
  }
  return out;
}

/* ---------- tri par l'IA ---------- */
export const X_SYSTEM = `Tu prépares la rubrique « Sur X » d'un site qui suit le développement de l'intelligence artificielle. Priorité aux faits concernant la watchlist et aux analyses d’analystes/insiders ; les comptes officiels, dirigeants et fondateurs sont moins prioritaires. Un post sur Apple ou SpaceX n’est pertinent que s’il concerne explicitement l’IA ou son infrastructure. Distingue une information industrielle structurante (capacité, commandes, contrats, investissement, pénurie, production, énergie/datacenter) d’un benchmark ou d’une annonce mineure : un classement de benchmark n’est pas automatiquement stratégique. Le lecteur veut les IDÉES PRINCIPALES de ce qui compte : informations importantes, informations exclusives, et ce dont la plateforme parle le plus. Pour chaque post (i, author, name, role, source_class, watchlist_hits, signal_hits, text, tier) renvoie :
- keep : true seulement si le post, À LUI SEUL, apporte un fait ou un chiffre précis et compréhensible sur l'IA ou sa chaîne (modèle, produit, résultat, benchmark, puces et calcul, datacenters, robotique, espace lié à l'IA, financement, partenariat, recrutement ou départ marquant, réglementation, donnée chiffrée), ET si son idée principale se dit en une phrase. false pour : humour, autopromotion, publicité, argumentaire commercial sur son propre produit ou sa propre société sans chiffre, benchmark, prix, client ni date vérifiables, lancement sans dire ce qui est lancé (« nous avons lancé X » sans contenu), texte long ou fil dont l'idée ne se résume pas en une phrase, argumentation en plusieurs points, annonce de fil sans contenu (« 🧵 »), remerciement, vœux, concours, opinion sans fait, politique sans lien avec l'IA, sujet sans rapport, post qui renvoie à une image, une vidéo ou un fil absents sans dire ce qu'ils montrent, post dont tu ne peux pas écrire un titre précis (nom, fait, chiffre).
- kind : annonce = l'auteur, ou l'organisation qu'il dirige ou représente, annonce SA PROPRE nouvelle (sortie, lancement précis, partenariat, financement, recrutement, résultat) ; info = l'auteur relaie ou rapporte un fait venant d'un tiers (« FT: … », « BREAKING: … », « selon … », un résultat d'autrui) ; analyse = interprétation, commentaire, estimation ; donnee = chiffre, graphique, benchmark ; rumeur UNIQUEMENT si l'auteur lui-même marque l'incertitude (« j'entends », « selon des sources », « rumeur », « serait »), jamais pour un fait énoncé sans réserve ; sinon autre. Un compte d'analyste ou de média qui rapporte la nouvelle d'un autre = info, jamais annonce.
- domain, un de : modeles, calcul (puces, mémoire, serveurs, datacenters), robotique, espace, biologie, sante, energie, securite, marche (bourse, valorisation, résultats, flux financiers : à réserver aux posts de marché dont l'IA est le sujet), politique, autre.
- imp : 1 à 3. 3 = fait important ou rare, de première main ; 2 = utile ; 1 = anecdotique. Peu de 3.
- title_fr : UNE phrase en français (140 caractères au plus) qui dit ce que le post affirme, au discours rapporté (« X annonce que… », « Y estime que… »), sans guillemets, sans rien ajouter, qui NOMME le sujet précis. Désigne l'auteur par son champ name (jamais par son @pseudo si name est donné ; sinon le @pseudo sans arobase), jamais « un auteur » ni « un utilisateur ». Même niveau d'affirmation que l'auteur : une rumeur reste une rumeur. Le champ role n'est qu'un contexte pour toi : n'écris jamais dans le titre une société, un titre ou une affiliation qui ne figure pas dans le post.
- title_en : la même phrase en anglais.
- text_fr : traduction française fidèle et complète du post (600 caractères au plus ; recopie le texte s'il est déjà en français).
Règles : n'ajoute aucun chiffre, nom ou résultat absent du post ; recopie les chiffres exactement comme dans le post, sans conversion, sans arrondi, sans changer le séparateur ; ne mets de guillemets que si l'auteur cite quelqu'un. ${UNITS_RULE}
Réponds uniquement par un tableau JSON, un objet par post, avec le même champ i.`;
export const X_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { i: { type: "INTEGER" }, keep: { type: "BOOLEAN" }, kind: { type: "STRING", enum: KINDS }, domain: { type: "STRING", enum: DOMAINS }, imp: { type: "INTEGER" }, title_fr: { type: "STRING" }, title_en: { type: "STRING" }, text_fr: { type: "STRING" } },
    required: ["i", "keep", "kind", "domain", "imp", "title_fr", "title_en", "text_fr"],
  },
};
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
export const plainText = (t) => clean(String(t || "").replace(/https?:\/\/\S+/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));

/** Valide la réponse du modèle pour un post : un texte n'est gardé que si ses chiffres et unités viennent du post. */
export function applyRow(r, inp) {
  const src = inp.text;
  const flat = (t) => String(t).replace(/(?<=\d)[,.\u00a0\u202f ](?=\d{3}(?!\d))/g, "");
  const pool = new Set(digitsOf(stripAmounts(flat(src))));
  const ok = (s, lang, strict) => digitsOf(stripAmounts(flat(s))).every((d) => pool.has(d)) && unitsOk(src, s, lang, strict);
  const out = { keep: r.keep !== false };
  const tf = normalizeFr(src, clean(r.title_fr));
  if (tf && tf.length <= 200 && !foreignScript(tf) && ok(tf, "fr", true)) out.title = tf;
  const te = clean(r.title_en);
  if (te && te.length <= 220 && !foreignScript(te) && ok(te, "en", true)) out.title_en = te;
  const xf = normalizeFr(src, clean(r.text_fr));
  if (xf && xf.length <= 600 && !foreignScript(xf) && ok(xf, "fr", false)) out.text_fr = xf;
  out.kind = KINDS.includes(r.kind) ? r.kind : "autre";
  out.domain = DOMAINS.includes(r.domain) ? r.domain : "autre";
  out.imp = Math.max(1, Math.min(3, Math.round(+r.imp) || 1));
  return out;
}

/* ---------- relais par la presse ---------- */
const STOP = new Set("this that with from have been were will would about their there which after before into than also more most just only over when what your they them then some such like been being does doing done very much many".split(" "));
const toks = (t) => new Set(String(t || "").toLowerCase().replace(/https?:\/\/\S+|@\w+/g, " ").replace(/[^a-z0-9\s$.%]/g, " ").split(/\s+/).map((w) => w.replace(/^[.$]+|[.]+$/g, "")).filter((w) => (w.length > 3 || /\d/.test(w)) && !STOP.has(w)));
/** Nombre de médias différents, dans le fil du site, qui parlent de la même chose que ce post (3 mots rares en commun et recouvrement suffisant). */
export function pressRelay(post, feed, now) {
  const a = toks(post.text); if (a.size < 4) return 0;
  const t0 = Date.parse(post.ts), media = new Set();
  for (const it of feed) {
    const ts = Date.parse(it.ts); if (!(ts >= t0 - X_RULES.relayDays * DAY) || ts > now + H) continue;
    const b = toks((it.orig || "") + " " + (it.title_en || "") + " " + (it.title || ""));
    let i = 0; for (const w of a) if (b.has(w)) i++;
    if (i >= 3 && i / Math.min(a.size, b.size) >= X_RULES.relaySim) media.add(it.source);
  }
  return media.size;
}


/** Choix du jour : par importance, mais varié — au plus 2 posts par compte, 3 sur le marché, jamais deux fois le même propos ; les posts que la presse n'a pas relayés et les comptes de l'étage 1 passent devant. */
export function pickDay(rows, n = X_RULES.perRun) {
  const left = rows.map((f) => ({ f, t: toks(f.text) })), out = [], byAuthor = {}, byDomain = {};
  const base = (f) => f.score ?? (f.v.imp * 10 + (f.media === 0 ? 3 : 0) + (f.tier === "t1" ? 3 : f.tier === "t2" ? 1 : 0) + Math.min(5, 1.5 * Math.log10((f.eng || 0) + 1)) + Math.min(4, 2 * (f.buzz || 0)));
  while (out.length < n && left.length) {
    let bi = -1, bs = -1e9;
    left.forEach((x, k) => {
      const a = x.f.handle || x.f.aid;
      if ((byAuthor[a] || 0) >= 3 || (x.f.v.domain === "marche" && (byDomain.marche || 0) >= 3)) return;
      if (out.some((o) => { const i = [...x.t].filter((w) => o.t.has(w)).length; return i >= 4 && i / Math.min(x.t.size, o.t.size) >= 0.6; })) return;
      const sc = base(x.f) - 6 * (byAuthor[a] || 0) - (x.f.v.domain === "marche" ? 3 * (byDomain.marche || 0) : 0);
      if (sc > bs) { bs = sc; bi = k; }
    });
    if (bi < 0) break;
    const x = left.splice(bi, 1)[0], a = x.f.handle || x.f.aid;
    byAuthor[a] = (byAuthor[a] || 0) + 1; byDomain[x.f.v.domain] = (byDomain[x.f.v.domain] || 0) + 1; out.push(x);
  }
  return out.map((x) => x.f);
}

/* ---------- collecte ---------- */
/**
 * @param {object} o
 *  cfg        contenu de x-accounts.json
 *  fetchImpl  fetch
 *  token      Bearer token X
 *  generate   generate(inputs) → tableau ou null ; absent = posts publiés sans tri (étage 1 seulement, « non classé »)
 *  prev       document précédent (x.json)
 *  feed       articles du site (pour détecter le relais par la presse)
 *  now        horodatage (ms)
 *  force      ignore le garde-fou « déjà lu aujourd'hui »
 */
export async function collectX({ cfg, fetchImpl, token, generate, prev, feed = [], now = Date.now(), log = () => {}, force = false, base, sleep = (t) => new Promise((r) => setTimeout(r, t)) }) {
  const prevItems = Array.isArray(prev?.items) ? prev.items : [];
  const ids = { ...(prev?.ids || {}) };
  const usage = { days: { ...(prev?.usage?.days || {}) }, months: { ...(prev?.usage?.months || {}) }, userMonths: { ...(prev?.usage?.userMonths || {}) } };
  const dayKey = new Date(now).toISOString().slice(0, 10), monthKey = dayKey.slice(0, 7);
  const readToday = usage.days[dayKey] || 0, readMonth = usage.months[monthKey] || 0;
  const stats = { ...(prev?.stats || {}) };
  const profiles = { ...(prev?.profiles || {}) };
  const whoLow = Object.fromEntries(Object.entries(cfg.who || {}).map(([h, v]) => [h.toLowerCase(), v]));
  const rep = { read: 0, kept: 0, added: 0, calls: 0, reason: "", errors: [] };
  const daily = cfg.caps.day;
  const perRun = cfg.caps.run || daily;
  if (!token) return { doc: prev || null, summary: { ...rep, reason: "X non configuré (secret X_BEARER_TOKEN absent)" } };
  if (!force && readToday >= daily) return { doc: prev || null, summary: { ...rep, reason: `plafond du jour déjà atteint (${readToday}/${daily})` } };
  if (readMonth >= cfg.caps.month) return { doc: prev || null, summary: { ...rep, reason: `plafond du mois atteint (${readMonth}/${cfg.caps.month})` } };

  const lastRun = prev?.last_run_ts ? Date.parse(prev.last_run_ts) : 0;
  const start = Math.max(now - 7 * DAY + 60e3, lastRun ? lastRun - 10 * 60e3 : now - X_RULES.windowH * H);
  const budget = Math.floor(Math.min(perRun, daily - (force ? 0 : readToday), cfg.caps.month - readMonth) / X_RULES.minRead) * X_RULES.minRead;
  let plan = dayPlan(cfg, now);
  { let left = budget; plan = plan.filter((p) => { if (left < X_RULES.minRead) return false; p.max = Math.floor(Math.min(p.max, left) / X_RULES.minRead) * X_RULES.minRead; if (p.max < X_RULES.minRead) return false; left -= p.max; return true; }); }
  const known = new Set(prevItems.map((x) => x.id));
  const raw = [];
  for (const p of plan) {
    let got;
    try { got = await fetchChunk({ fetchImpl, token, query: p.query, max: p.max, start, base }); rep.calls++; }
    catch (e) {
      rep.errors.push(String(e.message).slice(0, 160)); log("X : " + e.message);
      if ([401, 402, 403, 429].includes(e.status)) break; // accès, crédit ou limite : inutile d'insister
      continue;
    }
    rep.read += got.posts.length;
    for (const post of got.posts) raw.push({ ...post, tier: p.tier });
    log(`X : ${got.posts.length} post(s) lus (${p.tier}) | ${p.query.slice(0, 90)}`);
    await sleep(1100);
  }
  usage.days[dayKey] = readToday + rep.read; usage.months[monthKey] = readMonth + rep.read;
  for (const d of Object.keys(usage.days)) if (now - Date.parse(d) > 40 * DAY) delete usage.days[d];

  // auteurs : identifiant → pseudo (mémorisé : chaque compte n'est demandé qu'une fois)
  let byId = Object.fromEntries(Object.entries(ids).map(([n, id]) => [id, n]));
  const unknownIds = [...new Set(raw.map((p) => p.author_id).filter((a) => a && (!byId[a] || (!profiles[byId[a]] && !whoLow[byId[a]]?.name))))];
  if (unknownIds.length) {
    const userMonth = usage.userMonths[monthKey] || 0;
    const userBudget = Math.max(0, (cfg.caps.user_month ?? 100) - userMonth);
    const toLookup = unknownIds.slice(0, userBudget);
    if (toLookup.length) {
      try {
        for (const [id, u] of Object.entries(await lookupUsers({ fetchImpl, token, ids: toLookup, base }))) { ids[u.username.toLowerCase()] = id; if (u.name) profiles[u.username.toLowerCase()] = { name: u.name }; }
        byId = Object.fromEntries(Object.entries(ids).map(([n, id]) => [id, n])); rep.users = toLookup.length;
        usage.userMonths[monthKey] = userMonth + toLookup.length;
      } catch (e) { rep.errors.push(String(e.message).slice(0, 160)); log("X : " + e.message); }
    }
  }
  const handleCase = Object.fromEntries([...cfg.t1, ...cfg.t2, ...cfg.flux].map((h) => [h.toLowerCase(), h]));
  const fresh = [], seen = new Set();
  for (const p of raw) {
    if (known.has(p.id) || seen.has(p.id)) continue; seen.add(p.id);
    const low = byId[p.author_id]; const handle = low ? handleCase[low] || low : null;
    const full = plainText(p.text); if (!full) continue;
    const text = full;
    const m = p.public_metrics || {};
    fresh.push({ id: p.id, handle, aid: p.author_id, tier: p.tier, source_class: sourceClass(handle, p.tier, cfg), ts: p.created_at, text: text.slice(0, X_RULES.textMax), long: full.length > X_RULES.longMax, lang: p.lang, eng: (m.like_count || 0) + 2 * (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0) });
  }
  for (const f of fresh) { const s = stats[f.handle || f.aid] ||= { read: 0, kept: 0 }; s.read++; s.last = f.ts > (s.last || "") ? f.ts : s.last; }
  for (const f of fresh) f.relevance = matchRelevance(f.text, cfg);

  // tri par l'IA : on garde ce qui apporte un contenu concret (les textes trop longs pour être résumés ne sont pas envoyés)
  const items = new Map(prevItems.map((x) => [x.id, x]));
  let classified = 0, ai = false;
  const cand = fresh.filter((f) => !f.long && f.relevance?.relevant);
  rep.long = fresh.filter((f) => f.long).length;
  rep.filtered = fresh.length - rep.long - cand.length;
  const who = (f) => { const l = String(f.handle || "").toLowerCase(); return { name: whoLow[l]?.name || profiles[l]?.name || "", role: whoLow[l]?.en || "" }; };
  const mk = (f, k, extra) => ({ i: k, author: "@" + (f.handle || "?"), ...who(f), source_class: f.source_class, watchlist_hits: f.relevance?.watchlist || [], signal_hits: f.relevance?.signals || [], text: f.text, tier: f.tier, ...extra });
  if (cand.length && generate) {
    for (let i = 0; i < cand.length; i += 25) {
      const part = cand.slice(i, i + 25);
      const inputs = part.map((f, k) => mk(f, k));
      let res = null; try { res = await generate(inputs); } catch { res = null; }
      if (!Array.isArray(res)) { rep.reason = "Gemini indisponible"; break; }
      ai = true;
      for (const row of res) {
        const f = part[Number(row?.i)]; if (!f) continue;
        const v = applyRow(row, inputs[Number(row.i)]); f.done = true; classified++;
        if (!v.keep) continue;
        f.v = v;
      }
    }
    // un seul nouvel essai pour les posts retenus dont le titre ou la traduction a été refusé par le contrôle des chiffres
    const again = cand.filter((f) => f.v && (!f.v.title || !f.v.text_fr));
    if (again.length) {
      const inputs = again.map((f, k) => mk(f, k, { retry: true }));
      let res = null; try { res = await generate(inputs); } catch { res = null; }
      if (Array.isArray(res)) for (const row of res) {
        const f = again[Number(row?.i)]; if (!f) continue;
        const v = applyRow(row, inputs[Number(row.i)]);
        f.v.title ||= v.title; f.v.title_en ||= v.title_en; f.v.text_fr ||= v.text_fr;
      }
    }
  }
  const noAI = !generate || rep.reason === "Gemini indisponible";
  const rows = [];
  rep.dropped = 0;
  for (const f of cand) {
    if (f.v) { if (!f.v.title || !f.v.text_fr) { rep.dropped++; continue; } rows.push(f); } // sans titre ni traduction fiables : on ne publie pas le texte brut en anglais
    else if (noAI && !f.done && f.tier === "t1" && f.handle) rows.push({ ...f, v: { kind: "autre", domain: "autre", imp: 1, pending: true } });
  }
  // « ce qui se dit le plus » : le même propos chez plusieurs comptes différents le même jour
  for (const f of rows) {
    Object.assign(f, scorePost(f, cfg));
    const a = toks(f.text); const au = new Set();
    for (const g of fresh) { if (g === f || (g.handle || g.aid) === (f.handle || f.aid)) continue; const b = toks(g.text); let i = 0; for (const w of a) if (b.has(w)) i++; if (i >= 3 && i / Math.min(a.size, b.size) >= 0.3) au.add(g.handle || g.aid); }
    f.buzz = au.size;
  }
  for (const f of rows) f.media = pressRelay(f, feed, now);
  for (const f of pickDay(rows)) {
    const media = f.media;
    const it = { id: f.id, priority: f.priority, priority_score: Math.round(f.score), source_class: f.source_class, watchlist: f.watchlist, signals: f.signals, url: f.handle ? `https://x.com/${f.handle}/status/${f.id}` : `https://x.com/i/status/${f.id}`, handle: f.handle || "", tier: f.tier, ts: f.ts, text: f.text, kind: f.v.kind, domain: f.v.domain, imp: f.v.imp, media, eng: f.eng };
    if (f.v.title) it.title = f.v.title; else if (!f.v.pending) it.title_fr_missing = true;
    if (f.v.title_en) it.title_en = f.v.title_en;
    if (f.v.text_fr) it.text_fr = f.v.text_fr;
    if (f.v.pending) it.pending = true;
    items.set(f.id, it); rep.added++;
    const s = stats[f.handle || f.aid]; if (s) s.kept++;
  }
  rep.kept = rows.length;
  const cutoff = now - X_RULES.retainDays * DAY;
  const list = [...items.values()].filter((x) => Date.parse(x.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, X_RULES.maxItems);
  const ok = rep.read > 0 || !rep.errors.length;
  const whoOut = {};
  for (const h of [...cfg.t1, ...cfg.t2, ...cfg.flux]) { const v = (cfg.who || {})[h] || {}, e = { name: v.name || profiles[h.toLowerCase()]?.name || "", fr: v.fr || "", en: v.en || "" }; if (e.name || e.fr) whoOut[h] = e; }
  const doc = { v: 1, generated_at: new Date(now).toISOString(), last_run_ts: ok && rep.calls ? new Date(now).toISOString() : prev?.last_run_ts || null, items: list, ids, usage, stats, profiles, who: whoOut };
  if (!rep.reason) rep.reason = rep.errors.length && !rep.read ? "aucun post lu : " + rep.errors[0] : `${rep.read} post(s) lus, ${rep.kept} retenu(s), ${rep.added} publié(s)${rep.filtered ? `, ${rep.filtered} hors watchlist/signaux IA` : ""}${rep.dropped ? `, ${rep.dropped} écarté(s) sans titre fiable` : ""}${rep.long ? `, ${rep.long} trop long(s)` : ""}${ai ? "" : " (sans tri IA)"}`;
  return { doc, summary: { ...rep, month: usage.months[monthKey], classified } };
}

/** Comptes qui n'ont rien donné en lecture sur la durée (à remplacer, ou pseudo erroné). */
export function silentAccounts(cfg, doc) {
  const s = doc?.stats || {};
  return [...cfg.t1, ...cfg.t2, ...cfg.flux].filter((h) => !(s[h]?.read > 0));
}

/* ---------- exécution (GitHub Actions) ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const DATA = process.env.DATA_DIR || path.join(dir, "..", "public", "data");
  const readJ = async (f, d) => { try { return JSON.parse(await fs.readFile(path.join(DATA, f), "utf8")); } catch { return d; } };
  const cfg = JSON.parse(await fs.readFile(path.join(dir, "x-accounts.json"), "utf8"));
  const prev = await readJ("x.json", null);
  const feed = (await readJ("feed.json", { items: [] })).items || [];
  const state = await readJ("state.json", {});
  let generate = null;
  if (process.env.GEMINI_API_KEY) {
    const { makeClassifier } = await import("./collect.mjs");
    const pacific = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
    const clf = await makeClassifier(process.env, fetch, (m) => console.log(m), state.gemini?.date === pacific ? state.gemini.dead : []);
    generate = async (inputs) => (clf.state.fatal ? null : clf.call(inputs, { system: X_SYSTEM, schema: X_SCHEMA }));
  }
  const r = await collectX({ cfg, fetchImpl: fetch, token: process.env.X_BEARER_TOKEN, generate, prev, feed, now: Date.now(), log: console.log, force: process.env.X_FORCE === "1" });
  console.log(`X : ${r.summary.reason}${r.summary.month != null ? ` · mois : ${r.summary.month}/${cfg.caps.month}` : ""}`);
  if (r.doc && r.doc !== prev) await fs.writeFile(path.join(DATA, "x.json"), JSON.stringify(r.doc));
  const quiet = silentAccounts(cfg, r.doc);
  if (r.doc && quiet.length && quiet.length < 40) console.log(`Comptes sans aucun post lu à ce jour : ${quiet.join(", ")}`);
  if (r.summary.errors?.length && !r.summary.read) process.exitCode = 1;
}
