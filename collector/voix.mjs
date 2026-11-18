// Voix : ce que disent les dirigeants de l'IA. Presse (Google Actualités) et vidéos (chaînes YouTube vérifiées).
// Règle : un titre n'est retenu que si la personne en est le sujet qui parle (« X says… », « …, says X », citation) ou si la vidéo porte son nom.
// Rien n'est inventé ni résumé : titre du média, date, média, lien.
export const VOIX_RULES = { days: 30, perPerson: 8, perQuery: 30 };

export const PEOPLE = [
  { id: "sam-altman", n: "Sam Altman", role: "PDG d'OpenAI", co: "OpenAI", actor: "openai", re: /\bAltman\b/ },
  { id: "dario-amodei", n: "Dario Amodei", role: "PDG d'Anthropic", co: "Anthropic", actor: null, re: /\bAmodei\b/ },
  { id: "jensen-huang", n: "Jensen Huang", role: "Fondateur de Nvidia, ancien PDG (démission le 12 nov. 2026)", co: "Nvidia", actor: "nvidia", re: /\bJensen\b|\bHuang\b/ },
  { id: "colette-kress", n: "Colette Kress", role: "Directrice financière et PDG par intérim de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bKress\b/ },
  { id: "elon-musk", n: "Elon Musk", role: "Fondateur de xAI, PDG de Tesla", co: "xAI", actor: null, re: /\bMusk\b/, q: '"Elon Musk" (xAI OR Grok OR "AI" OR OpenAI OR Nvidia)' },
  { id: "satya-nadella", n: "Satya Nadella", role: "PDG de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bNadella\b/ },
  { id: "sundar-pichai", n: "Sundar Pichai", role: "PDG d'Alphabet (Google)", co: "Alphabet", actor: "alphabet", re: /\bPichai\b/ },
  { id: "demis-hassabis", n: "Demis Hassabis", role: "PDG de Google DeepMind", co: "Google DeepMind", actor: "alphabet", re: /\bHassabis\b/ },
  { id: "mark-zuckerberg", n: "Mark Zuckerberg", role: "PDG de Meta", co: "Meta", actor: "meta", re: /\bZuckerberg\b/ },
  { id: "lisa-su", n: "Lisa Su", role: "PDG d'AMD", co: "AMD", actor: "amd", re: /\bLisa Su\b/ },
  { id: "hock-tan", n: "Hock Tan", role: "PDG de Broadcom", co: "Broadcom", actor: "broadcom", re: /\bHock Tan\b/ },
  { id: "cc-wei", n: "C.C. Wei", role: "PDG de TSMC", co: "TSMC", actor: "tsmc", re: /\bC\.?\s?C\.? Wei\b/, q: '"C.C. Wei" TSMC' },
  { id: "andy-jassy", n: "Andy Jassy", role: "PDG d'Amazon", co: "Amazon", actor: "amazon", re: /\bJassy\b/ },
  { id: "mustafa-suleyman", n: "Mustafa Suleyman", role: "Directeur de Microsoft AI", co: "Microsoft", actor: "microsoft", re: /\bSuleyman\b/ },
  { id: "lip-bu-tan", n: "Lip-Bu Tan", role: "PDG d'Intel", co: "Intel", actor: "intel-foundry", re: /\bLip-Bu Tan\b/ },
];

// chaînes dont les vidéos portent le nom de l'invité ou du dirigeant (identifiants vérifiés sur le flux : auteur du flux = nom de la chaîne)
export const CHANNELS = [
  { id: "UCXZCJLdBC09xxGZ6gcdrc6A", name: "OpenAI (YouTube)" },
  { id: "UCrDwWp7EBBv4NwvScIpBDOA", name: "Anthropic (YouTube)" },
  { id: "UCP7jMXSY2xbc3KCAE0MHQ-A", name: "Google DeepMind (YouTube)" },
  { id: "UCXl4i9dYBrFOabk0xGmbkRA", name: "Dwarkesh Patel (YouTube)" },
  { id: "UCSHZKyawb77ixDdsGog4iWA", name: "Lex Fridman (YouTube)" },
];

const CUE = "says?|said|warns?|warned|predicts?|predicted|tells?|told|expects?|expected|believes?|claims?|argues?|admits?|reveals?|insists?|calls?|slams?|urges?|vows?|interview|keynote|speech|testif\\w+|podcast|speaks?|announces?|unveils?|responds?|defends?|rejects?|dismisses?|sees?|thinks?|hints?|teases?|criticizes?|pushes back|doubles down|reflects?|explains?|addresses?|opens up|confirms?|denies|dit|déclare|affirme|prévient|estime|annonce|juge|assure";
const cueRe = new RegExp(`\\b(?:${CUE})\\b`, "i");

/** La personne est-elle celle qui parle dans ce titre ? */
export function isStatement(title, re) {
  const t = String(title).replace(/\s+/g, " ").trim();
  const m = re.exec(t);
  if (!m) return false;
  // « Meta AI predicts… », « Grok says… » : c'est un chatbot qui parle, pas la personne
  if (/\b(?:Meta AI|ChatGPT|Grok|Gemini|Claude|Copilot|Siri|AI (?:predicts|says|thinks))\b/i.test(t.slice(m.index + m[0].length).split(/[:,|]/)[0])) return false;
  const before = t.slice(0, m.index), after = t.slice(m.index + m[0].length);
  // « X says … » : le verbe suit le nom (au plus six mots entre les deux : titre, sociétés, etc.)
  const cueAfter = new RegExp(`^((?:[\\w.'’-]+\\W+){0,6}?)(?:${CUE})\\b`, "i").exec(after.replace(/^['’]s\b/, "").trim());
  if (cueAfter && /(?:^|\s)(?:to|will|would|not|never|could)\s*$/i.test(cueAfter[1])) return false;
  if (new RegExp(`^(?:[\\w.'’-]+\\W+){0,6}?(?:${CUE})\\b`, "i").test(after.replace(/^['’]s\b/, "").trim()) && !/^\s*(?:,|’s|'s)?\s*(?:lawyers?|critics?|rivals?)\b/i.test(after)) {
    // le nom ne doit pas être complément d'un autre sujet qui parle (« Trump says Altman… », « Analysts say Huang… »)
    if (!new RegExp(`\\b(?:${CUE})\\s+(?:that\\s+)?(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  }
  // « …, says X » / « — X says » / « | X : »
  if (new RegExp(`[,–—|:-]\\s*(?:${CUE})\\s+(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  // « Musk : "…" » : le nom ouvre le titre, suivi de deux-points puis d'une citation
  if (/^\s*:\s*['"‘“]/.test(after) && before.trim().length < 12) return true;
  return false;
}

const DAY = 864e5;
async function withRetry(fn, sleep) { try { return await fn(); } catch (e) { if (!/429|5\d\d|abort|timeout/i.test(String(e.message || e))) throw e; await sleep(5000); return fn(); } }
const canon = (u) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^utm_|^oc$|^hl$|^gl$|^ceid$/.test(k)) x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return String(u); } };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * collectVoix({ http, parseFeed, now, prev, log }) → { doc, summary }
 * `http(url)` renvoie le texte ; une personne ou une chaîne en échec n'arrête pas les autres.
 */
export async function collectVoix({ http, parseFeed, now, prev, log = () => {}, pause = 700, sleep = (t) => new Promise((r) => setTimeout(r, t)) }) {
  const cutoff = now - VOIX_RULES.days * DAY;
  const byPerson = new Map(PEOPLE.map((p) => [p.id, new Map()]));
  for (const p of prev?.people || []) if (byPerson.has(p.id)) for (const it of p.items || []) byPerson.get(p.id).set(canon(it.url), it);
  let added = 0, failed = 0;
  const add = (p, it) => {
    const m = byPerson.get(p.id), k = canon(it.url);
    const dup = [...m.values()].some((x) => norm(x.title) === norm(it.title));
    if (m.has(k) || dup) return;
    m.set(k, it); added++;
  };
  for (const p of PEOPLE) {
    try {
      const q = p.q || `"${p.n}"`;
      const xml = await withRetry(() => http(`https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:14d")}&hl=en-US&gl=US&ceid=${encodeURIComponent("US:en")}`), sleep);
      for (const x of parseFeed(xml).slice(0, VOIX_RULES.perQuery)) {
        const ts = Date.parse(x.date); if (!(ts >= cutoff) || ts > now + DAY) continue;
        const title = x.title.replace(/\s+-\s+[^-]{2,40}$/, "").trim(); // Google ajoute « - Média » en fin de titre
        if (!isStatement(title, p.re)) continue;
        add(p, { ts: new Date(ts).toISOString(), title, url: x.link, source: x.source || (x.title.match(/\s-\s([^-]{2,40})$/) || [])[1] || "Presse", kind: "presse" });
      }
    } catch (e) { failed++; log(`Voix ${p.n} : ${String(e.message || e).slice(0, 80)}`); }
    await sleep(pause);
  }
  for (const c of CHANNELS) {
    try {
      const xml = await http(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`);
      for (const x of parseFeed(xml).slice(0, 15)) {
        const ts = Date.parse(x.date); if (!(ts >= cutoff) || ts > now + DAY) continue;
        for (const p of PEOPLE) if (p.re.test(x.title)) add(p, { ts: new Date(ts).toISOString(), title: x.title, url: x.link, source: c.name, kind: "video" });
      }
    } catch (e) { failed++; log(`Voix ${c.name} : ${String(e.message || e).slice(0, 80)}`); }
  }
  const people = PEOPLE.map((p) => ({
    id: p.id, n: p.n, role: p.role, co: p.co, actor: p.actor,
    items: [...byPerson.get(p.id).values()].filter((it) => Date.parse(it.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, VOIX_RULES.perPerson),
  }));
  const total = people.reduce((s, p) => s + p.items.length, 0);
  return { doc: { v: 1, generated_at: new Date(now).toISOString(), people }, summary: { added, failed, total, reason: failed >= PEOPLE.length + CHANNELS.length ? "toutes les sources en échec" : "" } };
}

export const VOIX_SYSTEM = `Tu traduis en français des titres d'articles de presse et de vidéos sur l'intelligence artificielle. Pour chaque titre (i, en), renvoie fr = la traduction française fidèle, naturelle, au même niveau d'affirmation (« says » reste une déclaration, « warns » un avertissement, pas plus fort ni plus faible).
Règles : conserve exactement les chiffres, noms propres, sociétés, sigles et produits ; ne rajoute aucune information ; garde les guillemets s'il y en a. Réponds uniquement par un tableau JSON, un objet par titre, avec le même champ i.`;
export const VOIX_SCHEMA = { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, fr: { type: "STRING" } }, required: ["i", "fr"] } };

const digits = (s) => String(s).match(/\d+/g) || [];
/** Ajoute `title_fr` aux titres qui n'en ont pas ; refusé si les chiffres changent. `generate(inputs)` appelle le modèle (ou renvoie null). */
export async function translateVoix({ doc, generate, max = 60 }) {
  if (!generate) return { changed: 0, reason: "Gemini indisponible" };
  const todo = doc.people.flatMap((p) => p.items).filter((it) => !it.title_fr).slice(0, max);
  if (!todo.length) return { changed: 0, reason: "rien à traduire" };
  let res = null;
  try { res = await generate(todo.map((it, i) => ({ i, en: it.title }))); } catch { res = null; }
  if (!Array.isArray(res)) return { changed: 0, reason: "Gemini indisponible" };
  let n = 0;
  for (const r of res) {
    const it = todo[Number(r?.i)], fr = String(r?.fr || "").trim().replace(/\s+/g, " ");
    if (!it || !fr || fr.length > it.title.length * 2 + 40) continue;
    const a = digits(it.title), b = digits(fr);
    if (a.length !== b.length || !a.every((x, k) => x === b[k])) continue;
    it.title_fr = fr; n++;
  }
  return { changed: n, reason: n ? `${n} titre(s) traduit(s)` : "aucune traduction valide" };
}
