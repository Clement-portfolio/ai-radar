// AI Radar — collecteur. Aucune dépendance (Node >= 20).
// Usage : node collector/collect.mjs   (variables : GEMINI_API_KEY, NEWSDATA_API_KEY, SEC_USER_AGENT)
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const COUNTRIES = ["US", "CN", "EU", "GULF", "OTHER"];
const CATEGORIES = ["modeles", "puces", "energie", "capex", "regul", "adoption", "recherche"];
const LAYERS = ["Applications", "Modèles", "Datacenters", "Puces", "Mémoire HBM", "Fonderie", "Énergie", "Financement", "Régulation", "Recherche", "Autre"];
const CONF = { primary: "haute", press: "moyenne" };
const TIER_RANK = { primary: 0, press: 1, aggregator: 2 };

const AI_RE = /\b(AI|A\.I\.|artificial intelligence|machine learning|deep learning|LLMs?|GPT-?\d*|OpenAI|Anthropic|Claude|Gemini|DeepSeek|Qwen|Mistral|Nvidia|GPUs?|TPUs?|HBM\d*|TSMC|data ?cent(?:er|re)s?|chatbots?|neural|generative|foundation models?|semiconductors?|chips?|inference|agentic|copilot|Ascend|Moonshot|Kimi|xAI|Grok|Llama|hyperscalers?|gigawatts?)\b/i;
const AI_CJK = /人工智能|人工智慧|大模型|大語言模型|算力|芯片|晶片|半導體|半导体|인공지능|반도체|人工知能|半導体|الذكاء الاصطناعي|KI-|künstliche Intelligenz|intelligence artificielle/;

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const domainIn = (host, list) => !!host && list.some((d) => host === d || host.endsWith("." + d));
const DISCOVERY = new Set(["googlenews", "gdelt", "newsdata", "hn"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ---------- utilitaires ---------- */
export function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
export function stripTags(s) {
  return decodeEntities(decodeEntities(s)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
export function canonicalUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|ref_|mc_|cmp|cid$|at_)/i.test(k)) x.searchParams.delete(k);
    let p = x.pathname.replace(/\/+$/, "");
    return (x.protocol + "//" + x.host.toLowerCase().replace(/^www\./, "") + p + (x.search || "")).toLowerCase();
  } catch { return String(u || "").toLowerCase(); }
}
function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}
function parseDate(s, fallback) {
  if (!s) return fallback;
  let v = String(s).trim();
  if (/^\d{8}T\d{6}Z$/.test(v)) v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`;
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) v = v.replace(" ", "T") + "Z";
  const d = new Date(v);
  return isNaN(d) ? fallback : d.toISOString();
}

/* ---------- parseur RSS / Atom ---------- */
export function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const tag = (n) => {
      const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"));
      return m ? m[1] : "";
    };
    let link = "";
    const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
    if (alt) link = alt[1];
    if (!link) { const t = tag("link"); if (t.trim()) link = stripTags(t); }
    if (!link) { const h = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (h) link = h[1]; }
    if (!link) { const g = tag("guid"); if (/^https?:/i.test(g.trim())) link = g.trim(); }
    const src = b.match(/<source([^>]*)>([\s\S]*?)<\/source>/i);
    out.push({
      title: stripTags(tag("title")),
      link: decodeEntities(link).trim(),
      date: stripTags(tag("pubDate") || tag("published") || tag("updated") || tag("dc:date")),
      summary: stripTags(tag("description") || tag("summary") || tag("content:encoded") || tag("content")).slice(0, 600),
      source: src ? stripTags(src[2]) : "",
      sourceUrl: src ? ((src[1].match(/url=["']([^"']+)["']/i) || [])[1] || "") : "",
    });
  }
  return out.filter((x) => x.title && x.link);
}

/* ---------- HTTP ---------- */
function makeHttp(fetchImpl) {
  return async function http(url, { headers = {}, timeout = 20000, retries = 1, json = false } = {}) {
    let err;
    for (let a = 0; a <= retries; a++) {
      try {
        const r = await fetchImpl(url, { headers: { "user-agent": UA, accept: json ? "application/json" : "application/rss+xml, application/atom+xml, application/xml, text/xml, */*", ...headers }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        if (json) { try { return JSON.parse(text); } catch { throw new Error("réponse non JSON : " + text.slice(0, 80).replace(/\s+/g, " ")); } }
        return text;
      } catch (e) { err = e; if (a < retries) await sleep(1500 * (a + 1)); }
    }
    throw err;
  };
}

/* ---------- collecte ---------- */
async function pool(items, n, fn) {
  const res = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

async function collectAll(cfg, env, http, now, log) {
  const cands = []; const health = [];
  const add = (name, kind, ok, n, err) => health.push({ name, kind, ok, n, err: err ? String(err.message || err).slice(0, 140) : undefined });

  // RSS
  await pool(cfg.rss, 6, async (s) => {
    try {
      const items = parseFeed(await http(s.url, { retries: 1 })).slice(0, 25);
      for (const it of items) cands.push({ url: it.link, title: it.title, snippet: it.summary, date: it.date, source: s.name, tier: s.tier, hint: s.hint, filter: s.filter, via: "rss", domain: hostOf(it.link) });
      add(s.name, "rss", true, items.length);
    } catch (e) { add(s.name, "rss", false, 0, e); }
  });

  // Google News RSS
  const gn = cfg.googleNews;
  if (gn) {
    const jobs = [];
    for (const ed of gn.editions) for (const q of (ed.queries || gn.queries)) jobs.push({ ed, q });
    await pool(jobs, 4, async ({ ed, q }) => {
      const name = `Google News ${ed.name} · ${q}`;
      try {
        const u = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=${ed.hl}&gl=${ed.gl}&ceid=${encodeURIComponent(ed.ceid)}`;
        const items = parseFeed(await http(u)).slice(0, gn.maxPerFeed || 12);
        for (const it of items) {
          const m = it.title.match(/^(.*) - ([^-]+)$/);
          cands.push({ url: it.link, title: m ? m[1] : it.title, snippet: "", date: it.date, source: it.source || (m ? m[2] : "Google News"), tier: "press", via: "googlenews", edition: ed.gl, domain: hostOf(it.sourceUrl) });
        }
        add(name, "googlenews", true, items.length);
      } catch (e) { add(name, "googlenews", false, 0, e); }
    });
  }

  // GDELT (1 requête / 5 s)
  if (cfg.gdelt) {
    let gFails = 0;
    for (const g of cfg.gdelt.queries) {
      const name = `GDELT ${g.label}`;
      if (gFails >= 2) { add(name, "gdelt", false, 0, "ignoré (GDELT indisponible)"); continue; }
      try {
        const u = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(g.q)}&mode=artlist&maxrecords=${cfg.gdelt.maxrecords || 75}&format=json&sort=datedesc&timespan=${env.GDELT_TIMESPAN || cfg.gdelt.timespan || "6h"}`;
        let j;
        try { j = await http(u, { json: true, retries: 0 }); } catch (e) { await sleep(7000); j = await http(u, { json: true, retries: 0 }); }
        const arts = j.articles || [];
        for (const a of arts) cands.push({ url: a.url, title: a.title, snippet: "", date: a.seendate, source: a.domain, tier: "press", via: "gdelt", lang: a.language, edition: a.sourcecountry, domain: String(a.domain || hostOf(a.url)).toLowerCase().replace(/^www\./, "") });
        gFails = 0; add(name, "gdelt", true, arts.length);
      } catch (e) { gFails++; add(name, "gdelt", false, 0, e); }
      await sleep(5500);
    }
  }

  // NewsData.io
  if (cfg.newsdata && env.NEWSDATA_API_KEY) {
    const nd = cfg.newsdata; let used = env.__ndUsed || 0; let stop = false;
    for (const c of nd.countries) {
      const name = `NewsData ${c.toUpperCase()}`;
      if (stop) { add(name, "newsdata", false, 0, "interrompu"); continue; }
      if (used >= (nd.dailyCreditCap || 180)) { add(name, "newsdata", false, 0, "plafond quotidien atteint"); continue; }
      try {
        const u = `https://newsdata.io/api/1/latest?q=${encodeURIComponent(nd.q)}&country=${c}&size=10`;
        const j = await http(u, { json: true, retries: 0, headers: { "X-ACCESS-KEY": env.NEWSDATA_API_KEY } });
        used++; env.__ndUsedOut = used;
        if (j.status !== "success") { const msg = j.results?.message || j.results?.code || "erreur"; if (/rate|limit|quota/i.test(msg)) stop = true; throw new Error(msg); }
        for (const a of j.results || []) cands.push({ url: a.link, title: a.title, snippet: (a.description || "").slice(0, 500), date: a.pubDate, source: a.source_name || a.source_id || "NewsData", tier: "press", via: "newsdata", lang: a.language, edition: c.toUpperCase(), domain: hostOf(a.link) });
        add(name, "newsdata", true, (j.results || []).length);
      } catch (e) { used++; env.__ndUsedOut = used; if (/HTTP 429|HTTP 401|HTTP 403/.test(String(e.message))) stop = true; add(name, "newsdata", false, 0, e); }
    }
  } else if (cfg.newsdata) add("NewsData", "newsdata", false, 0, "NEWSDATA_API_KEY absente");

  // Hacker News
  if (cfg.hackernews) {
    const since = Math.floor(now / 1000) - 2 * 86400;
    for (const q of cfg.hackernews.queries) {
      const name = `Hacker News · ${q}`;
      try {
        const u = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=${encodeURIComponent(`points>${cfg.hackernews.minPoints},created_at_i>${since}`)}&hitsPerPage=${cfg.hackernews.perQuery}`;
        const j = await http(u, { json: true });
        for (const h of j.hits || []) cands.push({ url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title, snippet: `${h.points} points sur Hacker News`, date: h.created_at, source: "Hacker News", tier: "press", via: "hn", domain: hostOf(h.url) });
        add(name, "hn", true, (j.hits || []).length);
      } catch (e) { add(name, "hn", false, 0, e); }
    }
  }

  // Hugging Face Daily Papers
  if (cfg.huggingfaceDailyPapers) {
    try {
      const j = await http(`https://huggingface.co/api/daily_papers?limit=${cfg.huggingfaceDailyPapers.limit}`, { json: true });
      let n = 0;
      for (const x of j) {
        const p = x.paper || x; if ((p.upvotes || 0) < cfg.huggingfaceDailyPapers.minUpvotes) continue; n++;
        cands.push({ url: `https://huggingface.co/papers/${p.id}`, title: p.title || x.title, snippet: stripTags(p.summary || x.summary || "").slice(0, 500), date: p.publishedAt || x.publishedAt, source: "Hugging Face Papers", tier: "press", via: "hf", research: true });
      }
      add("Hugging Face Daily Papers", "hf", true, n);
    } catch (e) { add("Hugging Face Daily Papers", "hf", false, 0, e); }
  }

  // arXiv
  if (cfg.arxiv) {
    try {
      const sq = cfg.arxiv.categories.map((c) => `cat:${c}`).join("+OR+");
      const items = parseFeed(await http(`https://export.arxiv.org/api/query?search_query=${sq}&sortBy=submittedDate&sortOrder=descending&max_results=${cfg.arxiv.max}`, { timeout: 30000 }));
      for (const it of items) cands.push({ url: it.link, title: it.title.replace(/\s+/g, " "), snippet: it.summary, date: it.date, source: "arXiv", tier: "primary", via: "arxiv", research: true });
      add("arXiv", "arxiv", true, items.length);
    } catch (e) { add("arXiv", "arxiv", false, 0, e); }
  }

  // SEC EDGAR
  if (cfg.edgar && !env.SEC_USER_AGENT) add("SEC EDGAR", "edgar", false, 0, "SEC_USER_AGENT absente (la SEC exige un contact dans l'en-tête User-Agent)");
  else if (cfg.edgar) {
    const ua = env.SEC_USER_AGENT;
    const cutoff = now - cfg.edgar.lookbackDays * 86400000;
    for (const c of cfg.edgar.companies) {
      const name = `SEC ${c.name}`;
      try {
        const j = await http(`https://data.sec.gov/submissions/CIK${String(c.cik).padStart(10, "0")}.json`, { json: true, headers: { "user-agent": ua, accept: "application/json" } });
        const r = j.filings?.recent || {}; let n = 0;
        for (let i = 0; i < (r.form || []).length; i++) {
          if (!cfg.edgar.forms.includes(r.form[i])) continue;
          const d = new Date(r.filingDate[i] + "T12:00:00Z"); if (d.getTime() < cutoff) continue; n++;
          const acc = String(r.accessionNumber[i]).replace(/-/g, "");
          cands.push({ url: `https://www.sec.gov/Archives/edgar/data/${+c.cik}/${acc}/${r.primaryDocument[i]}`, title: `${c.name} files ${r.form[i]}${r.primaryDocDescription?.[i] ? " — " + r.primaryDocDescription[i] : ""}`, snippet: `Form ${r.form[i]} filed ${r.filingDate[i]} by ${c.name}${r.items?.[i] ? "; 8-K items " + r.items[i] + " (2.02 = results of operations, 1.01 = material agreement, 7.01/8.01 = other events, 5.02 = officer changes)" : ""}.`, date: d.toISOString(), source: `SEC EDGAR (${c.name})`, tier: "primary", hint: c.hint, via: "edgar" });
        }
        add(name, "edgar", true, n);
      } catch (e) { add(name, "edgar", false, 0, e); }
      await sleep(250);
    }
  }

  // Federal Register
  if (cfg.federalRegister) {
    try {
      const j = await http(`https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(cfg.federalRegister.term)}&order=newest&per_page=${cfg.federalRegister.perPage}`, { json: true });
      for (const d of j.results || []) cands.push({ url: d.html_url, title: d.title, snippet: stripTags(d.abstract || "") + (d.agencies?.length ? " Agence : " + d.agencies.map((a) => a.name).join(", ") : ""), date: d.publication_date, source: "Federal Register", tier: "primary", hint: "US", via: "fedreg" });
      add("Federal Register", "fedreg", true, (j.results || []).length);
    } catch (e) { add("Federal Register", "fedreg", false, 0, e); }
  }
  return { cands, health };
}

/* ---------- Gemini ---------- */
const SYSTEM = `Tu es l'analyste d'un radar d'actualité sur l'intelligence artificielle et son économie. Pour chaque article fourni (champ i, source, title, snippet, date), renvoie un objet JSON.
Règles :
- relevant : true seulement si l'article porte sur l'IA, les puces/mémoire/fonderie pour l'IA, les datacenters ou l'énergie pour l'IA, le financement/les résultats d'acteurs de l'IA, ou la régulation de l'IA. Sinon false.
- relevant = false aussi pour : newsletters, digests ou récapitulatifs hebdomadaires, listes « top N », tutoriels, contenus promotionnels ou de référencement, conseils boursiers, et billets d'opinion sans fait nouveau. Seuls comptent les articles qui rapportent un fait, une décision, un chiffre, un produit ou une analyse sourcée.
- title_fr : titre en français, fidèle à l'original, sans ajout.
- summary_fr : 1 à 2 phrases en français, 260 caractères maximum, UNIQUEMENT à partir des faits présents dans le titre et l'extrait. N'ajoute aucun chiffre, aucune date, aucun nom absent du texte. Si l'extrait est vide, reformule le titre.
- country : pays de l'acteur principal dont parle l'information (pas le pays du média). US, CN, EU (Europe, Royaume-Uni inclus), GULF (Arabie saoudite, Émirats, Qatar...), OTHER (Taïwan, Corée, Japon, Inde, reste du monde).
- category : modeles (modèles, labos, produits), puces (GPU, ASIC, mémoire, fonderie, export), energie (électricité, réseau, refroidissement), capex (investissements, levées de fonds, résultats, valorisations, bourse), regul (lois, règles, procès, contrôles à l'export), adoption (usages, revenus, déploiements), recherche (articles scientifiques).
- importance : 3 = événement majeur (nouveau modèle de pointe, résultats ou investissement supérieur à 1 Md$, décision réglementaire ou restriction à l'export majeure, pénurie ou goulot structurel) ; 2 = notable ; 1 = mineur ou redondant.
- layer : Applications, Modèles, Datacenters, Puces, Mémoire HBM, Fonderie, Énergie, Financement, Régulation, Recherche ou Autre.
Réponds uniquement par un tableau JSON, un objet par article, avec le même champ i.`;

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" }, relevant: { type: "BOOLEAN" }, title_fr: { type: "STRING" }, summary_fr: { type: "STRING" },
      country: { type: "STRING", enum: COUNTRIES }, category: { type: "STRING", enum: CATEGORIES },
      importance: { type: "INTEGER" }, layer: { type: "STRING", enum: LAYERS },
    },
    required: ["i", "relevant", "title_fr", "summary_fr", "country", "category", "importance", "layer"],
  },
};

// modèles Flash réellement disponibles pour cette clé (les anciens sont retirés régulièrement)
async function discoverModels(env, fetchImpl) {
  const r = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = JSON.parse(await r.text());
  const ver = (n) => +(n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1];
  return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini-[\d.]+-flash/.test(m.name) && !/image|tts|live|audio|embed|robotics|computer|exp|thinking|8b/.test(m.name))
    .map((m) => m.name.replace(/^models\//, ""))
    .sort((a, b) => (ver(b) - ver(a)) || (/preview/.test(a) - /preview/.test(b)) || (/lite/.test(a) - /lite/.test(b)));
}
async function makeClassifier(env, fetchImpl, log, deadInit = []) {
  let models = (env.GEMINI_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  let discovered = null;
  if (!models.length) {
    try { discovered = await discoverModels(env, fetchImpl); } catch (e) { discovered = []; log("Gemini · liste des modèles indisponible : " + e.message); }
    models = discovered.slice(0, 8);
    if (!models.length) models = ["gemini-3.5-flash"];
  }
  let last = 0, calls = 0; const minGap = +env.GEMINI_MIN_GAP_MS || 4500; const backoff = +env.GEMINI_BACKOFF_MS || 8000;
  const dead = new Set(deadInit.filter((m) => models.includes(m))); // modèles sans quota ou retirés : écartés pour la journée
  const state = { error: null, model: null, fatal: false, diag: [], dead, get calls() { return calls; } };
  const note = (m) => { log("Gemini · " + m); if (state.diag.length < 40) state.diag.push(m); };
  if (discovered) state.diag.push("modèles disponibles : " + (discovered.slice(0, 10).join(", ") || "aucun détecté"));
  if (dead.size) state.diag.push("écartés aujourd'hui (quota ou retirés) : " + [...dead].join(", "));
  const exhausted = () => { state.error = "quota Gemini épuisé sur tous les modèles (le quota gratuit se renouvelle vers 11 h, heure d'Arabie saoudite)"; state.fatal = true; return null; };
  // Une saturation 5xx est passagère : on passe au modèle suivant, puis on refait un tour après une pause.
  async function call(list) {
    let k = 0, cycles = 0, tries = 0;
    while (true) {
      while (k < models.length && dead.has(models[k])) k++;
      if (k >= models.length) {
        if (models.every((m) => dead.has(m))) return exhausted();
        if (cycles < 2) { cycles++; await sleep(backoff * cycles); k = 0; tries = 0; continue; }
        state.error = "Gemini saturé (erreur 5xx) sur tous les modèles disponibles"; return null;
      }
      const wait = last + minGap - Date.now(); if (wait > 0) await sleep(wait);
      last = Date.now(); calls++;
      const model = models[k];
      let r, body;
      try {
        r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(60000),
          body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(list) }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: SCHEMA } }),
        });
        body = await r.text();
      } catch (e) { note(`${model} : réseau (${e.message})`); k++; tries = 0; continue; }
      if (r.ok) {
        try {
          const j = JSON.parse(body); const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          const arr = JSON.parse(txt); if (!Array.isArray(arr)) throw new Error("pas un tableau");
          state.model = model; state.error = null; return arr;
        } catch (e) { note(`${model} : réponse illisible (${e.message})`); k++; tries = 0; continue; }
      }
      const msg = body.slice(0, 600).replace(/\s+/g, " ");
      note(`${model} : HTTP ${r.status} ${msg.slice(0, r.status === 429 ? 450 : 140)}`);
      if (/API_KEY_INVALID|API key not valid/i.test(body)) { state.error = "clé Gemini invalide (API_KEY_INVALID)"; state.fatal = true; return null; }
      if (r.status === 429) {
        const m = body.match(/"retryDelay":\s*"(\d+)/); const delay = m ? +m[1] : 30;
        if (/PerDay|per day|limit: 0/i.test(body) || delay > 70 || tries >= 2) { dead.add(model); k++; tries = 0; continue; }
        tries++; await sleep((delay + 2) * 1000); continue;
      }
      if (r.status === 403 && /API key|PERMISSION|leaked/i.test(body)) { state.error = "clé Gemini refusée : " + msg; state.fatal = true; return null; }
      if (r.status === 404 || r.status === 400 || r.status === 403) { dead.add(model); k++; tries = 0; continue; }
      k++; tries = 0; // 5xx
    }
  }
  return { call, state };
}

/* ---------- classement de secours, sans IA (titre d'origine conservé) ---------- */
const GULF_DOM = /thenationalnews|arabnews|saudigazette|gulfnews|khaleejtimes|zawya|aljazeera|alarabiya|spa\.gov\.sa|wam\.ae|aawsat|argaam|arabianbusiness|agbi/;
export function ruleClassify(c) {
  const t = `${c.title} ${c.snippet || ""}`; const d = c.domain || "";
  let country = c.hint && COUNTRIES.includes(c.hint) ? c.hint : null;
  if (!country) {
    if (/\.(cn|hk)$/.test(d) || /scmp|caixin|xinhua|chinadaily|globaltimes|cgtn|yicai|36kr|technode|pandaily|kr-asia|sixthtone|thepaper|chinatalk/.test(d) || /DeepSeek|Qwen|Alibaba|Baidu|Huawei|Tencent|Moonshot|Kimi|ByteDance|SMIC|China|Chinese|Beijing/i.test(t)) country = "CN";
    else if (GULF_DOM.test(d) || /Humain|G42|Saudi|\bUAE\b|Emirates|Abu Dhabi|Qatar|Gulf/i.test(t)) country = "GULF";
    else if (/\.(fr|de|uk|eu|it|es|nl)$/.test(d) || /euractiv|euronews|sifted|handelsblatt|lemonde|lesechos/.test(d) || /Mistral|ASML|European|\bEU\b|Brussels|Europe|\bUK\b|Britain/i.test(t)) country = "EU";
    else if (/\.(jp|kr|tw|in|sg)$/.test(d) || /nikkei|koreaherald|straitstimes|channelnewsasia|taipei|focustaiwan|digitimes|hindu|livemint/.test(d) || /Japan|Korea|Taiwan|India|Singapore|TSMC|Samsung|SK hynix/i.test(t)) country = "OTHER";
    else country = "US";
  }
  const category = c.research ? "recherche"
    : /HBM|TSMC|foundry|semiconductor|\bchips?\b|GPUs?|Nvidia|export control|Blackwell|Ascend/i.test(t) ? "puces"
    : /electric|\bpower\b|energy|nuclear|gigawatt|\bgrid\b|cooling|turbine/i.test(t) ? "energie"
    : /billion|funding|raises?|valuation|capex|earnings|revenue|\bIPO\b|invest|stock|shares/i.test(t) ? "capex"
    : /regulat|\blaws?\b|\bact\b|\bban\b|lawsuit|court|policy|commission|sanction|tariff/i.test(t) ? "regul"
    : /model|GPT|Claude|Gemini|Llama|Qwen|DeepSeek|launch|release|unveil/i.test(t) ? "modeles" : "adoption";
  const layer = /HBM/i.test(t) ? "Mémoire HBM" : /TSMC|foundry/i.test(t) ? "Fonderie" : /data ?cent/i.test(t) ? "Datacenters"
    : { puces: "Puces", energie: "Énergie", capex: "Financement", regul: "Régulation", recherche: "Recherche", modeles: "Modèles", adoption: "Applications" }[category];
  return { country, category, layer };
}

/* ---------- exécution ---------- */
export async function run(opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || fetch;
  const log = opts.log || ((m) => console.log(m));
  const dataDir = opts.dataDir || path.join(HERE, "..", "public", "data");
  const cfg = JSON.parse(await fs.readFile(opts.sourcesFile || path.join(HERE, "sources.json"), "utf8"));
  const nowMs = opts.now || Date.now();
  const started = Date.now();
  const http = makeHttp(fetchImpl);
  const readJson = async (f, d) => { try { return JSON.parse(await fs.readFile(path.join(dataDir, f), "utf8")); } catch { return d; } };

  const feedDoc = await readJson("feed.json", { items: [] });
  const state = await readJson("state.json", {});
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const nd = state.newsdata && state.newsdata.date === today ? state.newsdata : { date: today, n: 0 };
  const e2 = { ...env, __ndUsed: nd.n };
  log("Collecte des sources…");
  const { cands, health } = await collectAll(cfg, e2, http, nowMs, log);
  if (e2.__ndUsedOut != null) nd.n = e2.__ndUsedOut;

  const okCount = health.filter((h) => h.ok).length;
  log(`Sources : ${okCount}/${health.length} répondent, ${cands.length} candidats bruts`);

  // filtrage, âge, dédoublonnage
  const maxAge = (+env.MAX_AGE_DAYS || 4) * 86400000;
  const known = new Set(); const knownTok = [];
  for (const it of feedDoc.items) {
    known.add(canonicalUrl(it.url)); known.add(it.id);
    if (nowMs - new Date(it.ts).getTime() < 10 * 86400000) { knownTok.push(tokens(it.title)); if (it.orig) knownTok.push(tokens(it.orig)); }
  }
  const rejected = state.rejected || {};
  for (const [k, ts] of Object.entries(rejected)) if (nowMs - ts > 30 * 86400000) delete rejected[k];
  const Q = cfg.quality || {}; const allow = Q.allowDomains || []; const blockPaths = Q.blockPaths || [];
  const fresh = []; const seen = new Set(); let untrusted = 0;
  for (const c of cands) {
    if (!c.url || !c.title) continue;
    if (DISCOVERY.has(c.via) && allow.length && !domainIn(c.domain, allow)) { untrusted++; continue; }
    if (blockPaths.some((b) => `${c.domain}${(() => { try { return new URL(c.url).pathname; } catch { return ""; } })()}`.includes(b))) { untrusted++; continue; }
    const cu = canonicalUrl(c.url); const id = sha(cu);
    if (known.has(cu) || known.has(id) || rejected[id] || seen.has(cu)) continue;
    const text = `${c.title} ${c.snippet || ""}`;
    if ((c.filter || c.via === "gdelt" || c.via === "googlenews") && !(AI_RE.test(text) || AI_CJK.test(text))) continue;
    const ts = parseDate(c.date, new Date(nowMs).toISOString());
    if (nowMs - new Date(ts).getTime() > maxAgeFor(c, maxAge)) continue;
    if (new Date(ts).getTime() > nowMs + 86400000) continue;
    if (knownTok.some((k) => jaccard(k, tokens(c.title)) >= 0.6)) { rejected[id] = nowMs; continue; }
    seen.add(cu);
    fresh.push({ ...c, id, ts, cu, tok: tokens(c.title) });
  }
  fresh.sort((a, b) => b.ts.localeCompare(a.ts));
  const uniq = [];
  for (const c of fresh) {
    if (uniq.some((u) => jaccard(u.tok, c.tok) >= 0.6)) continue;
    uniq.push(c);
  }
  // file d'attente équilibrée : plafonds par source et par type (évite qu'arXiv ou un blog n'occupe tout)
  const cap = +env.MAX_CLASSIFY || 200;
  const KIND_CAP = { arxiv: 8, hf: 5, fedreg: 8, hn: 8 }; const perSource = +env.MAX_PER_SOURCE || 8;
  const cntSrc = {}, cntKind = {}; const queue = [];
  for (const c of uniq) {
    if (queue.length >= cap) break;
    const ks = String(c.source).toLowerCase();
    if ((cntSrc[ks] || 0) >= perSource || (cntKind[c.via] || 0) >= (KIND_CAP[c.via] ?? 999)) continue;
    cntSrc[ks] = (cntSrc[ks] || 0) + 1; cntKind[c.via] = (cntKind[c.via] || 0) + 1; queue.push(c);
  }
  // articles publiés sans IA lors d'un passage précédent : on retente leur classement en priorité
  const pendingOld = feedDoc.items.filter((x) => x.pending).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 100)
    .map((x) => ({ id: x.id, url: x.url, title: x.orig || x.title, snippet: x.summary || "", source: x.source, ts: x.ts, tier: x.confidence === "haute" ? "primary" : "press", conf: x.confidence, domain: hostOf(x.url), pendingOld: true, research: x.category === "recherche" }));
  queue.unshift(...pendingOld);
  log(`À classer : ${queue.length} (sur ${uniq.length} nouveaux uniques ; ${untrusted} écartés car média hors liste de confiance)`);

  // classement Gemini
  const added = []; let rejectedNow = 0; let classifier = null; let calls = 0; const handled = new Set(); const dropIds = new Set();
  if (queue.length && env.GEMINI_API_KEY) {
    const pacificDay = new Date(nowMs - 8 * 3600e3).toISOString().slice(0, 10);
    const gs = state.gemini && state.gemini.date === pacificDay ? state.gemini : { date: pacificDay, dead: [] };
    classifier = await makeClassifier(env, fetchImpl, log, gs.dead);
    const BATCH = +env.GEMINI_BATCH || 50; const maxCalls = +env.GEMINI_MAX_CALLS || 3;
    const batches = []; for (let b = 0; b < queue.length; b += BATCH) batches.push(queue.slice(b, b + BATCH));
    const failed = []; const maxTotal = maxCalls + 2; const budgetMs = (+env.RUN_BUDGET_S || 840) * 1000; let consecFail = 0;
    for (let bi = 0; bi < batches.length || (failed.length && calls < maxTotal); bi++) {
      const slice = bi < batches.length ? batches[bi] : failed.shift();
      if (Date.now() - started > budgetMs) { log("Budget de temps atteint : arrêt du classement"); classifier.state.diag.push("budget de temps atteint, reste à classer au prochain passage"); break; }
      if (!slice || calls >= maxTotal || (bi < batches.length && calls >= maxCalls)) break;
      const res = await classifier.call(slice.map((c, i) => ({ i, source: c.source, title: c.title, snippet: (c.snippet || "").slice(0, 400), date: c.ts.slice(0, 10) })));
      calls++;
      if (!res) {
        log("Gemini : " + classifier.state.error);
        if (classifier.state.fatal || ++consecFail >= 2) break;
        if (!slice.retried) { slice.retried = true; failed.push(slice); }
        await sleep(+env.GEMINI_PAUSE_MS || 30000);
        continue;
      }
      consecFail = 0;
      const by = new Map(res.map((r) => [r.i, r]));
      slice.forEach((c, i) => {
        const r = by.get(i); if (!r) return;
        handled.add(c.id);
        if (!r.relevant) { rejected[c.id] = nowMs; rejectedNow++; if (c.pendingOld) dropIds.add(c.id); return; }
        const conf = c.conf || ((c.tier === "primary" || domainIn(c.domain, Q.primaryDomains || [])) ? "haute" : "moyenne");
        const country = COUNTRIES.includes(r.country) ? r.country : (c.hint && COUNTRIES.includes(c.hint) ? c.hint : "OTHER");
        added.push({
          id: c.id, ts: c.ts, title: (r.title_fr || c.title).trim(), orig: c.title.slice(0, 200), summary: (r.summary_fr || "").trim().slice(0, 300),
          country, category: CATEGORIES.includes(r.category) ? r.category : (c.research ? "recherche" : "adoption"),
          importance: Math.min(3, Math.max(1, Math.round(r.importance) || 1)), layer: LAYERS.includes(r.layer) ? r.layer : "Autre",
          source: c.source, url: c.url, confidence: conf,
        });
      });
    }
  } else if (queue.length) log("GEMINI_API_KEY absente : aucun article classé");

  // secours : les articles non classés par l'IA sont publiés tels quels (titre d'origine), à reclasser plus tard
  let fallback = 0;
  for (const c of queue) {
    if (handled.has(c.id) || c.pendingOld) continue;
    if (!(AI_RE.test(`${c.title} ${c.snippet || ""}`) || AI_CJK.test(`${c.title} ${c.snippet || ""}`))) continue;
    const rc = ruleClassify(c);
    added.push({ id: c.id, ts: c.ts, title: c.title.trim(), orig: c.title.slice(0, 200), summary: (c.snippet || "").slice(0, 260), country: rc.country, category: rc.category, importance: 1, layer: rc.layer, source: c.source, url: c.url, confidence: (c.tier === "primary" || domainIn(c.domain, Q.primaryDomains || [])) ? "haute" : "moyenne", pending: true });
    fallback++;
  }

  // fusion et purge
  const byId = new Map();
  for (const it of [...feedDoc.items, ...added]) byId.set(it.id, it);
  for (const id of dropIds) byId.delete(id);
  const keep = [...byId.values()].filter((it) => nowMs - new Date(it.ts).getTime() < (it.importance >= 3 ? 180 : it.importance === 2 ? 120 : 45) * 86400000)
    .sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 1500);

  const status = await readJson("status.json", {});
  const errors = [];
  if (okCount === 0) errors.push("aucune source n'a répondu");
  if (classifier?.state.error) errors.push(classifier.state.error);
  if (!env.GEMINI_API_KEY) errors.push("GEMINI_API_KEY absente");
  const lastRun = {
    started_at: new Date(started).toISOString(), duration_s: Math.round((Date.now() - started) / 1000),
    candidates: cands.length, new_unique: uniq.length, queued: queue.length, classified_calls: calls, model: classifier?.state.model || null,
    added: added.length, fallback, rejected: rejectedNow, total_items: keep.length, errors, gemini: classifier?.state.diag || [], sources: health,
  };
  const out = { ...status, last_run: lastRun, last_attempt: new Date().toISOString(), mode: "live" };
  if (okCount > 0) out.updated_at = new Date().toISOString();
  if (!opts.dry) {
    await fs.mkdir(dataDir, { recursive: true });
    if (okCount > 0 && (added.length || keep.length !== feedDoc.items.length)) await fs.writeFile(path.join(dataDir, "feed.json"), JSON.stringify({ items: keep }, null, 1));
    await fs.writeFile(path.join(dataDir, "state.json"), JSON.stringify({ newsdata: nd, rejected, gemini: classifier ? { date: new Date(nowMs - 8 * 3600e3).toISOString().slice(0, 10), dead: [...classifier.state.dead] } : state.gemini }));
    await fs.writeFile(path.join(dataDir, "status.json"), JSON.stringify(out, null, 1));
  }
  log(`Terminé : +${added.length} articles, ${rejectedNow} écartés, ${keep.length} au total, ${errors.length} alerte(s)`);
  return out;
}
function maxAgeFor(c, base) { return c.via === "edgar" || c.via === "fedreg" ? 8 * 86400000 : base; }

if (import.meta.url === `file://${process.argv[1]}`) {
  run({ dry: process.argv.includes("--dry") }).then((s) => { if (s.last_run.errors.length) console.log("Alertes :", s.last_run.errors.join(" | ")); }).catch((e) => { console.error(e); process.exit(1); });
}
