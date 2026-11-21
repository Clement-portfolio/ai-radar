// What's Going On? — onglet « Recherche » : papiers, labos de modèles, recherche des hyperscalers, agences.
// Produit public/data/recherche.json. Aucune dépendance. Ne bloque jamais la collecte principale.
// Règle : aucun chiffre, nom ou fait n'est ajouté ; les résumés sont tirés du seul résumé (abstract) de la source.
import crypto from "node:crypto";
import { digitsOf } from "./brief.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";
import { foreignScript } from "./translate.mjs";

export const DOMAINS = ["modeles", "robotique", "biologie", "sante", "espace", "energie", "materiaux", "calcul", "sciences", "securite", "autre"];
export const KINDS = ["journal", "preprint", "frontier", "hyper", "agence"];

const RETAIN_DAYS = 60, REJ_DAYS = 21, MAX_ITEMS = 1200, FIRST_LOOKBACK = 7, LOOKBACK = 4;

/* ---------- lecture des flux ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };
const decode = (s) => String(s || "").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const TAG = /<\/?[a-z][^>]*>/gi;
const strip = (s) => decode(decode(String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(TAG, " ")).replace(TAG, " ")).replace(/\s+/g, " ").trim();
const isoOf = (v) => { const t = Date.parse(String(v || "").trim()); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** Entrées d'un flux RSS ou Atom, avec les champs utiles aux filtres (type, rubrique, DOI). */
export function parseEntries(xml) {
  const out = [];
  for (const b of String(xml || "").match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || []) {
    const tag = (n) => { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i")); return m ? m[1] : ""; };
    let link = "";
    const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
    if (alt) link = alt[1];
    if (!link) { const t = strip(tag("link")); if (t) link = t; }
    if (!link) { const h = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (h) link = h[1]; }
    if (!link) { const g = strip(tag("guid")); if (/^https?:/i.test(g)) link = g; }
    const content = strip(tag("content:encoded") || tag("content")), summ = strip(tag("description") || tag("summary"));
    const doi = strip(tag("prism:doi")) || (strip(tag("dc:identifier")).match(/10\.\d{4,9}\/\S+/) || [])[0] || (decode(link).match(/10\.\d{4,9}\/[^\s?#]+/) || [])[0] || "";
    out.push({
      title: strip(tag("title")), url: decode(link).trim(),
      ts: isoOf(strip(tag("pubDate") || tag("published") || tag("updated") || tag("dc:date") || tag("prism:publicationDate"))),
      abstract: (content.length > summ.length ? content : summ).slice(0, 1500),
      doi, dc_type: strip(tag("dc:type")), section: strip(tag("prism:section")),
    });
  }
  return out.filter((x) => x.title && x.url);
}

/* ---------- tri : bruit, mots-clés, règles de source ---------- */
const JUNK = /^(author correction|publisher correction|correction|erratum|retraction|expression of concern|in this issue|editorial|daily briefing|podcast|obituary|book review|this week|news at a glance)\b|^\[(comment|correspondence|editorial|obituary|department of error|world report|perspectives|viewpoint)/i;
const CORPORATE = /\b(ipo|initial public offering|roadshow|partner(?:ship|s)? with|welcomes|appoint(?:s|ed)?|joins|hires|funding round|raises \$|acquir(?:es|ed|ition)|earnings|quarterly results|webinar|summit|awards?|pricing|subscription|careers?|hiring|office in|expands to|now available in|customer stor(?:y|ies)|case study)\b/i;
const LAB_RESEARCH = /research|model|paper|science|introduc|system card|safety|reasoning|benchmark|robot|discover|agent|open[- ]source|weights|dataset|breakthrough/i;
export const AI_KW = /\b(AI|A\.I\.|artificial intelligence|machine[- ]learning|deep[- ]learning|neural|LLMs?|language models?|foundation models?|generative|transformers?|diffusion models?|reinforcement learning|computer vision|AlphaFold|self-driving|autonomous|robot\w*|agentic|GPT-?\d*|Gemini|Claude|large models?|protein (?:design|structure prediction)|digital twin|surrogate model)\b/i;

export function keep(it, src) {
  const t = it.title;
  if (!t || t.length < 12 || JUNK.test(t)) return false;
  if (["frontier", "hyper", "agence"].includes(src.kind) && CORPORATE.test(t)) return false;
  const [name, ...r] = String(src.filter || "").split(":"), arg = r.join(":");
  if (!name) return true;
  if (name === "doi_contains") return `${it.doi} ${it.url}`.toLowerCase().includes(arg.toLowerCase());
  if (name === "dc_type") return arg.split("|").includes(it.dc_type);
  if (name === "section") return arg.split("|").includes(it.section);
  if (name === "title_prefix") return t.startsWith(arg);
  if (name === "title_contains") return arg.split("|").some((k) => t.toLowerCase().includes(k.toLowerCase()));
  if (name === "not_title") return !t.toLowerCase().includes(arg.toLowerCase());
  if (name === "lab_research") return LAB_RESEARCH.test(t);
  return true;
}

/* ---------- récupération par type de source ---------- */
const DAY = 86400000;
export async function fetchSource(src, { http, since, now, limits = {} }) {
  const sinceMs = since;
  const inWindow = (ts) => !ts || Date.parse(ts) >= sinceMs;
  if (src.type === "rss") {
    return parseEntries(await http(src.url, { retries: 1 })).filter((x) => inWindow(x.ts));
  }
  if (src.type === "gnews") {
    const days = Math.max(1, Math.ceil((now - sinceMs) / DAY));
    const q = encodeURIComponent(`${src.url} when:${days}d`);
    const xml = await http(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { retries: 1 });
    return parseEntries(xml).filter((x) => inWindow(x.ts)).map((x) => ({ ...x, title: x.title.replace(/\s+[-–]\s+[^-–]+$/, ""), abstract: "" }));
  }
  if (src.type === "hf") {
    const out = [], seen = new Set();
    for (let d = new Date(now); d.getTime() >= sinceMs - DAY; d = new Date(d.getTime() - DAY)) {
      let rows = [];
      try { rows = await http(`${src.url}?date=${d.toISOString().slice(0, 10)}&limit=100`, { json: true, retries: 0 }); } catch { rows = []; }
      for (const r of Array.isArray(rows) ? rows : []) {
        const p = r.paper || r; if (!p.id || seen.has(p.id)) continue; seen.add(p.id);
        if ((p.upvotes || 0) < (src.minUpvotes || 0)) continue;
        out.push({ title: strip(p.title || r.title), url: `https://arxiv.org/abs/${p.id}`, ts: isoOf(p.publishedAt || r.publishedAt) || d.toISOString(), abstract: strip(p.summary || r.summary).slice(0, 1500), doi: `10.48550/arxiv.${p.id}`, up: +p.upvotes || 0 });
      }
    }
    return out;
  }
  if (src.type === "arxiv") {
    const out = [];
    for (const cat of src.url.split(",").map((s) => s.trim()).filter(Boolean)) {
      const xml = await http(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent("cat:" + cat)}&sortBy=submittedDate&sortOrder=descending&max_results=${limits.arxivPerCat || 40}`, { retries: 1 });
      for (const e of parseEntries(xml)) {
        const id = (e.url.match(/arxiv\.org\/abs\/([^v\s]+(?:\.\d+)?)/i) || [])[1] || e.url;
        if (!(e.ts ? Date.parse(e.ts) >= sinceMs : true)) continue;
        out.push({ ...e, url: `https://arxiv.org/abs/${id}`, doi: `10.48550/arxiv.${id}`, cat });
      }
    }
    return out;
  }
  if (src.type === "biorxiv") {
    const [server, cats] = src.url.split(":"); const wanted = cats.trim() === "all" ? null : new Set(cats.split(",").map((c) => c.trim().toLowerCase()));
    const out = [], today = new Date(now).toISOString().slice(0, 10), from = new Date(sinceMs).toISOString().slice(0, 10);
    for (let cursor = 0; cursor < (limits.biorxivMax || 1500); ) {
      const j = await http(`https://api.biorxiv.org/details/${server}/${from}/${today}/${cursor}`, { json: true, retries: 1 });
      const rows = j.collection || []; if (!rows.length) break;
      for (const r of rows) {
        if (String(r.version) !== "1") continue;
        if (wanted && !wanted.has(String(r.category || "").toLowerCase())) continue;
        out.push({ title: strip(r.title), url: `https://doi.org/${r.doi}`, ts: isoOf(r.date), abstract: strip(r.abstract).slice(0, 1500), doi: r.doi });
      }
      cursor += rows.length;
    }
    return out;
  }
  throw new Error("type de source inconnu : " + src.type);
}

/* ---------- identité et priorité ---------- */
export function itemId(c) {
  const key = (c.doi || "").toLowerCase() || String(c.url).toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "") || c.title.toLowerCase();
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
}
const normTitle = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const TIER_W = { 1: 50, 2: 35, 3: 18 };
export function preScore(c, now) {
  const age = c.ts ? (now - Date.parse(c.ts)) / DAY : 5;
  return (TIER_W[c.tier] || 18) + Math.min(c.up || 0, 100) * 0.3 + Math.max(0, 8 - age) + (c.abstract ? 2 : 0);
}

/* ---------- classement de secours, sans IA ---------- */
const DOM_RULES = [
  ["sante", /\b(clinical|patient|diagnos\w*|radiolog\w*|medical|hospital|cancer|tumou?r|pathology|drug|therap\w*|FDA|health)\b/i],
  ["biologie", /\b(protein|genom\w*|DNA|RNA|cell|molecul\w*|biolog\w*|enzyme|antibod\w*|single-cell|CRISPR|AlphaFold)\b/i],
  ["espace", /\b(space|satellite|orbit\w*|rocket|mars|lunar|moon|asteroid|telescope|astronom\w*|galax\w*|spacecraft|NASA|ESA)\b/i],
  ["robotique", /\b(robot\w*|humanoid|manipulation|locomotion|self-driving|autonomous (?:vehicle|driving)|drone)\b/i],
  ["energie", /\b(energy|battery|batteries|solar|fusion|grid|climate|weather|carbon|power plant|renewable)\b/i],
  ["materiaux", /\b(materials?|chemistry|chemical|catalys\w*|crystal|alloy|polymer|semiconductor materials)\b/i],
  ["calcul", /\b(GPU|TPU|chip|accelerator|quantum|qubit|compiler|kernel|inference engine|hardware)\b/i],
  ["securite", /\b(safety|alignment|security|jailbreak|red[- ]team|adversarial|misuse|cyber\w*|interpretab\w*)\b/i],
  ["sciences", /\b(physics|mathematic\w*|theorem|proof|geoscience|ecolog\w*|neuroscience|astronomy)\b/i],
  ["modeles", /\b(language models?|LLMs?|reasoning|agents?|multimodal|diffusion|transformer|GPT|Gemini|Claude|Llama|Qwen|Mistral|benchmark|fine-tun\w*|pre-?training)\b/i],
];
export const ruleDomain = (text) => (DOM_RULES.find(([, re]) => re.test(text)) || ["autre"])[0];

/* ---------- IA : pertinence, domaine, importance, titre et résumé FR + EN ---------- */
export const RECH_SYSTEM = `Tu prépares l'onglet « Recherche » d'un site qui suit les percées de l'intelligence artificielle, dans tous les domaines d'application. Pour chaque entrée (i, title = titre d'origine, abstract = résumé d'origine, peut être vide, source, kind), renvoie :
- relevant : true si l'entrée présente un résultat de recherche, une avancée scientifique ou technique, un nouveau modèle ou système, un jalon réglementaire ou d'agence dont l'IA est le sujet ou un outil central. false pour : actualité d'entreprise, événement, prix, recrutement, opinion, marketing de produit, article sans IA. En cas de doute sur un papier ou un billet de labo, mets true.
- domain, un de : modeles (modèles de langage, multimodaux, agents, apprentissage), robotique (robots, véhicules autonomes, drones), biologie (protéines, génomique, cellules, découverte de médicaments), sante (médecine, imagerie, diagnostic, essais cliniques, autorisations sanitaires), espace (spatial, astronomie, observation de la Terre), energie (énergie, réseau électrique, climat, météo), materiaux (matériaux, chimie), calcul (puces, accélérateurs, quantique, logiciels de calcul), sciences (mathématiques, physique, géosciences, neurosciences), securite (sûreté, alignement, cybersécurité, mésusages), autre.
- imp : 1 à 3. 3 = percée majeure et rare (nouveau modèle de pointe ou rapport de sécurité d'un grand labo, résultat dans Nature ou Science qui change un domaine, première autorisation sanitaire d'un système d'IA, résultat mathématique ou scientifique inédit) ; en moyenne moins d'une entrée sur huit. 2 = avancée solide et notable. 1 = travail incrémental ou de niche.
- title_fr : titre en français, fidèle à title (n'ajoute rien).
- title_en : titre en anglais (recopie title s'il est déjà en anglais).
- summary_fr : 1 à 2 phrases en français (260 caractères au plus) qui disent ce qui a été fait ou trouvé, tirées UNIQUEMENT de abstract. Si abstract est vide, summary_fr est une chaîne vide : ne devine rien.
- summary_en : la même chose en anglais (chaîne vide si abstract est vide).
Règles : n'ajoute aucun chiffre, nom, date ou résultat absent des textes fournis ; écris les nombres en chiffres. ${UNITS_RULE}
Réponds uniquement par un tableau JSON, un objet par entrée, avec le même champ i.`;

export const RECH_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { i: { type: "INTEGER" }, relevant: { type: "BOOLEAN" }, domain: { type: "STRING", enum: DOMAINS }, imp: { type: "INTEGER" }, title_fr: { type: "STRING" }, title_en: { type: "STRING" }, summary_fr: { type: "STRING" }, summary_en: { type: "STRING" } },
    required: ["i", "relevant", "domain", "imp", "title_fr", "title_en", "summary_fr", "summary_en"],
  },
};

const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Valide la réponse du modèle pour une entrée : chaque texte n'est gardé que si ses chiffres et unités viennent des textes d'origine. */
export function applyRow(r, inp) {
  const src = `${inp.title} ${inp.abstract}`;
  const pool = new Set(digitsOf(stripAmounts(src)));
  const ok = (s, lang, strict, from) => digitsOf(stripAmounts(s)).every((d) => pool.has(d)) && unitsOk(from, s, lang, strict);
  const out = {};
  const tf = normalizeFr(inp.title, clean(r.title_fr));
  if (tf && tf.length <= 240 && !foreignScript(tf) && ok(tf, "fr", true, inp.title)) out.title = tf;
  const te = clean(r.title_en);
  if (te && te.length <= 260 && !foreignScript(te) && ok(te, "en", true, inp.title)) out.title_en = te;
  if (inp.abstract) {
    const sf = normalizeFr(inp.abstract, clean(r.summary_fr)), se = clean(r.summary_en);
    if (sf && sf.length <= 420 && !foreignScript(sf) && ok(sf, "fr", false, inp.abstract)) out.summary = sf;
    if (se && se.length <= 420 && !foreignScript(se) && ok(se, "en", false, inp.abstract)) out.summary_en = se;
  }
  out.domain = DOMAINS.includes(r.domain) ? r.domain : ruleDomain(src);
  out.imp = Math.max(1, Math.min(3, Math.round(+r.imp) || 1));
  out.relevant = r.relevant !== false;
  return out;
}

/* ---------- collecte ---------- */
/**
 * @param {object} o
 *  sources   liste de sources (recherche-sources.json)
 *  http      http(url, {json, retries}) → texte ou JSON
 *  generate  generate(inputs) → tableau (ou null) ; absent = classement de secours
 *  prev      document précédent
 *  now       horodatage (ms)
 */
export async function collectRecherche({ sources, http, generate, translate, prev, now = Date.now(), log = () => {}, batch = 20, rounds = 2, perSource = 8, limits = {}, sleep = (t) => new Promise((r) => setTimeout(r, t)) }) {
  const prevItems = Array.isArray(prev?.items) ? prev.items : [];
  const rej = Object.fromEntries(Object.entries(prev?.rej || {}).filter(([, t]) => now - t < REJ_DAYS * DAY));
  const since = now - (prevItems.length ? LOOKBACK : FIRST_LOOKBACK) * DAY;
  const report = [], cands = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
    while (cursor < sources.length) {
      const src = sources[cursor++]; let n = 0, err = "";
      try {
        const got = await fetchSource(src, { http, since, now, limits });
        for (const it of got) {
          if (!keep(it, src)) continue;
          if (src.kw && !AI_KW.test(`${it.title} ${it.abstract || ""}`)) continue;
          cands.push({ ...it, sid: src.id, source: src.name, kind: src.kind, tier: src.tier }); n++;
        }
      } catch (e) { err = String(e.message || e).slice(0, 90); }
      report.push({ id: src.id, name: src.name, kind: src.kind, n, ...(err ? { err } : {}), ...(src.verified === false ? { unverified: true } : {}) });
    }
  }));
  report.sort((a, b) => sources.findIndex((s) => s.id === a.id) - sources.findIndex((s) => s.id === b.id));

  // doublons : même identifiant ou même titre (un papier peut venir de deux sources)
  const known = new Map(prevItems.map((x) => [x.id, x])), titles = new Set(prevItems.map((x) => normTitle(x.orig || x.title)));
  const todoPending = new Set(prevItems.filter((x) => x.pending).map((x) => x.id));
  const seen = new Set(), fresh = [];
  for (const c of cands) {
    c.id = itemId(c); const nt = normTitle(c.title);
    if (seen.has(c.id) || seen.has("t:" + nt) || rej[c.id]) continue;
    if (known.has(c.id) && !todoPending.has(c.id)) continue;
    if (!known.has(c.id) && titles.has(nt)) continue;
    seen.add(c.id); seen.add("t:" + nt); fresh.push(c);
  }
  // les plus prometteurs d'abord, avec un plafond par source pour garder de la variété
  fresh.sort((a, b) => preScore(b, now) - preScore(a, now));
  const per = {}, queue = fresh.filter((c) => (per[c.sid] = (per[c.sid] || 0) + 1) <= perSource);
  log(`Recherche : ${cands.length} candidat(s), ${fresh.length} nouveau(x), ${queue.length} en file`);

  const itemOf = (c, extra) => ({ id: c.id, url: c.url, title: c.title, orig: c.title, title_en: undefined, summary: "", source: c.source, sid: c.sid, kind: c.kind, tier: c.tier, ts: c.ts || new Date(now).toISOString(), domain: ruleDomain(`${c.title} ${c.abstract || ""}`), imp: 1, ...(c.up ? { up: c.up } : {}), ...(c.doi ? { doi: c.doi } : {}), ...extra });
  const items = new Map(prevItems.map((x) => [x.id, x]));
  let added = 0, rejected = 0, ai = 0, reason = "";
  const classified = new Set();
  if (!queue.length) reason = "rien de nouveau";
  else if (!generate) reason = "Gemini indisponible";
  for (let r = 0; r < rounds && generate && queue.length; r++) {
    const part = queue.filter((c) => !classified.has(c.id)).slice(0, batch); if (!part.length) break;
    const inputs = part.map((c, i) => ({ i, title: c.title, abstract: c.abstract || "", source: c.source, kind: c.kind }));
    let res = null;
    try { res = await generate(inputs); } catch { res = null; }
    if (!Array.isArray(res)) { reason = "Gemini indisponible"; break; }
    let n = 0;
    for (const row of res) {
      const inp = inputs[Number(row?.i)], c = inp && part[inp.i]; if (!c) continue;
      const v = applyRow(row, inp); classified.add(c.id); n++;
      if (!v.relevant) { rej[c.id] = now; rejected++; items.delete(c.id); continue; }
      const old = items.get(c.id);
      const it = itemOf(c, { domain: v.domain, imp: v.imp });
      it.title = v.title || c.title; it.title_en = v.title_en || (foreignScript(c.title) ? undefined : c.title);
      it.summary = v.summary || ""; if (v.summary_en) it.summary_en = v.summary_en;
      if (!v.title) it.title_fr_missing = true;
      if (!old) added++; items.set(c.id, it); ai++;
    }
    if (!n) { reason = "aucune réponse exploitable"; break; }
  }
  // sans IA (ou entrées restées hors file) : on garde, sous leur titre d'origine, les sources de référence et les papiers très votés
  const noAI = !generate || reason === "Gemini indisponible";
  for (const c of noAI ? fresh : []) {
    if (classified.has(c.id) || items.has(c.id)) continue;
    if (c.tier <= 2 || (c.up || 0) >= 30) { items.set(c.id, itemOf(c, { pending: true })); added++; }
  }
  for (const it of items.values()) if (classified.has(it.id)) delete it.pending;
  // titres restés dans la langue d'origine (le modèle a recopié l'anglais) : une passe de traduction dédiée, y compris pour les entrées déjà publiées
  let titled = 0;
  if (translate) {
    const todo = [...items.values()].filter((x) => !x.tr_tried && !x.pending && x.title && normTitle(x.title) === normTitle(x.orig || x.title) && !foreignScript(x.title) && x.title.length > 12).slice(0, 60);
    if (todo.length) {
      let res = null;
      try { res = await translate(todo.map((it, i) => ({ i, en: it.title }))); } catch { res = null; }
      if (Array.isArray(res)) {
        for (const x of todo) x.tr_tried = true;
        for (const r of res) {
          const it = todo[Number(r?.i)], fr = clean(r?.fr);
          if (!it || !fr || fr.length > it.title.length * 2 + 40 || normTitle(fr) === normTitle(it.title) || foreignScript(fr)) continue;
          const fixed = normalizeFr(it.title, fr);
          if (!digitsOf(stripAmounts(fixed)).every((d) => digitsOf(stripAmounts(it.title)).includes(d)) || !unitsOk(it.title, fixed, "fr", true)) continue;
          if (!it.title_en) it.title_en = it.title;
          it.title = fixed; delete it.title_fr_missing; titled++;
        }
      }
    }
  }
  if (!reason) reason = `${ai} classée(s) par l'IA, ${rejected} écartée(s)${titled ? `, ${titled} titre(s) traduit(s)` : ""}`;

  const cutoff = now - RETAIN_DAYS * DAY;
  const list = [...items.values()].filter((x) => Date.parse(x.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, MAX_ITEMS);
  const doc = { generated_at: new Date(now).toISOString(), items: list, rej: Object.fromEntries(Object.entries(rej).slice(-4000)), sources: report };
  const failed = report.filter((s) => s.err).length;
  return { doc, summary: { total: list.length, added, rejected, ai, sources: report.length, failed, reason } };
}
