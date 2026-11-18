// Voix : ce que disent les dirigeants de l'IA. Presse (Google Actualités) et vidéos (chaînes YouTube vérifiées).
// Règle : un titre n'est retenu que si la personne en est le sujet qui parle (« X says… », « …, says X », citation) ou si la vidéo porte son nom.
// Rien n'est inventé ni résumé : titre du média, date, média, lien.
export const VOIX_RULES = { days: 30, perPerson: 8, perQuery: 30 };

// cat : dirigeants (PDG, y compris chaîne de l'IA) · cadres (CFO, CTO, président, conseil) · chercheurs · pouvoirs publics · investisseurs et analystes.
// Les intitulés sont écrits à la main (vérifiés le 18 nov. 2026) ; `watch: false` coupe l'alerte de changement de poste quand l'intitulé vient d'être mis à jour.
export const PEOPLE = [
  { id: "sam-altman", cat: "dirigeants", n: "Sam Altman", role: "PDG d'OpenAI", co: "OpenAI", actor: "openai", re: /\bAltman\b/ },
  { id: "dario-amodei", cat: "dirigeants", n: "Dario Amodei", role: "PDG d'Anthropic", co: "Anthropic", actor: null, re: /\bAmodei\b/ },
  { id: "jensen-huang", cat: "dirigeants", n: "Jensen Huang", role: "Fondateur de Nvidia, ancien PDG (démission le 12 nov. 2026)", co: "Nvidia", actor: "nvidia", re: /\bJensen\b|\bHuang\b/, watch: false },
  { id: "elon-musk", cat: "dirigeants", n: "Elon Musk", role: "Fondateur de xAI, PDG de Tesla", co: "xAI", actor: null, re: /\bMusk\b/, q: '"Elon Musk" (xAI OR Grok OR "AI" OR OpenAI OR Nvidia)' },
  { id: "satya-nadella", cat: "dirigeants", n: "Satya Nadella", role: "PDG de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bNadella\b/ },
  { id: "sundar-pichai", cat: "dirigeants", n: "Sundar Pichai", role: "PDG d'Alphabet (Google)", co: "Alphabet", actor: "alphabet", re: /\bPichai\b/ },
  { id: "demis-hassabis", cat: "dirigeants", n: "Demis Hassabis", role: "PDG de Google DeepMind", co: "Google DeepMind", actor: "alphabet", re: /\bHassabis\b/ },
  { id: "mark-zuckerberg", cat: "dirigeants", n: "Mark Zuckerberg", role: "PDG de Meta", co: "Meta", actor: "meta", re: /\bZuckerberg\b/ },
  { id: "lisa-su", cat: "dirigeants", n: "Lisa Su", role: "PDG d'AMD", co: "AMD", actor: "amd", re: /\bLisa Su\b/ },
  { id: "hock-tan", cat: "dirigeants", n: "Hock Tan", role: "PDG de Broadcom", co: "Broadcom", actor: "broadcom", re: /\bHock Tan\b/ },
  { id: "cc-wei", cat: "dirigeants", n: "C.C. Wei", role: "PDG de TSMC", co: "TSMC", actor: "tsmc", re: /\bC\.?\s?C\.? Wei\b/, q: '"C.C. Wei" TSMC' },
  { id: "andy-jassy", cat: "dirigeants", n: "Andy Jassy", role: "PDG d'Amazon", co: "Amazon", actor: "amazon", re: /\bJassy\b/ },
  { id: "mustafa-suleyman", cat: "dirigeants", n: "Mustafa Suleyman", role: "Directeur de Microsoft AI", co: "Microsoft", actor: "microsoft", re: /\bSuleyman\b/ },
  { id: "lip-bu-tan", cat: "dirigeants", n: "Lip-Bu Tan", role: "PDG d'Intel", co: "Intel", actor: "intel-foundry", re: /\bLip-Bu Tan\b/ },
  { id: "clay-magouyrk", cat: "dirigeants", n: "Clay Magouyrk", role: "Co-PDG d'Oracle", co: "Oracle", actor: null, re: /\bMagouyrk\b/ },
  { id: "sanjay-mehrotra", cat: "dirigeants", n: "Sanjay Mehrotra", role: "PDG de Micron", co: "Micron", actor: "micron", re: /\bMehrotra\b/ },
  { id: "christophe-fouquet", cat: "dirigeants", n: "Christophe Fouquet", role: "PDG d'ASML", co: "ASML", actor: "asml", re: /\bFouquet\b/ },
  { id: "kwak-noh-jung", cat: "dirigeants", n: "Kwak Noh-jung", role: "PDG de SK hynix", co: "SK hynix", actor: "sk-hynix", re: /\bKwak Noh[- ]?jung\b/ },
  { id: "michael-intrator", cat: "dirigeants", n: "Michael Intrator", role: "PDG de CoreWeave", co: "CoreWeave", actor: null, re: /\bIntrator\b/ },
  { id: "alex-karp", cat: "dirigeants", n: "Alex Karp", role: "PDG de Palantir", co: "Palantir", actor: null, re: /\bKarp\b/ },
  { id: "robin-li", cat: "dirigeants", n: "Robin Li", role: "PDG de Baidu", co: "Baidu", actor: null, re: /\bRobin Li\b/, q: '"Robin Li" Baidu' },
  { id: "larry-ellison", cat: "cadres", n: "Larry Ellison", role: "Président et directeur technique d'Oracle", co: "Oracle", actor: null, re: /\bEllison\b/, q: '"Larry Ellison" (Oracle OR AI OR OpenAI OR Stargate)' },
  { id: "colette-kress", cat: "cadres", n: "Colette Kress", role: "Directrice financière et PDG par intérim de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bKress\b/ },
  { id: "harvey-jones", cat: "cadres", n: "Harvey C. Jones", role: "Président du conseil de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bHarvey (?:C\. )?Jones\b/, q: '"Harvey Jones" Nvidia' },
  { id: "greg-brockman", cat: "cadres", n: "Greg Brockman", role: "Cofondateur et président d'OpenAI", co: "OpenAI", actor: "openai", re: /\bBrockman\b/ },
  { id: "sarah-friar", cat: "cadres", n: "Sarah Friar", role: "Directrice financière d'OpenAI", co: "OpenAI", actor: "openai", re: /\bSarah Friar\b/ },
  { id: "kevin-scott", cat: "cadres", n: "Kevin Scott", role: "Directeur technique de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bKevin Scott\b/, q: '"Kevin Scott" Microsoft' },
  { id: "brad-smith", cat: "cadres", n: "Brad Smith", role: "Vice-président et président de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bBrad Smith\b/, q: '"Brad Smith" Microsoft' },
  { id: "ruth-porat", cat: "cadres", n: "Ruth Porat", role: "Présidente et directrice des investissements d'Alphabet", co: "Alphabet", actor: "alphabet", re: /\bPorat\b/ },
  { id: "geoffrey-hinton", cat: "chercheurs", n: "Geoffrey Hinton", role: "Prix Nobel, pionnier de l'apprentissage profond", co: "", actor: null, re: /\bHinton\b/ },
  { id: "yoshua-bengio", cat: "chercheurs", n: "Yoshua Bengio", role: "Chercheur, pionnier de l'apprentissage profond", co: "", actor: null, re: /\bBengio\b/ },
  { id: "yann-lecun", cat: "chercheurs", n: "Yann LeCun", role: "Président exécutif d'AMI Labs, ancien de Meta", co: "AMI Labs", actor: null, re: /\bLeCun\b/ },
  { id: "ilya-sutskever", cat: "chercheurs", n: "Ilya Sutskever", role: "Cofondateur de Safe Superintelligence, ancien d'OpenAI", co: "SSI", actor: null, re: /\bSutskever\b/ },
  { id: "andrej-karpathy", cat: "chercheurs", n: "Andrej Karpathy", role: "Chercheur, ancien d'OpenAI et de Tesla", co: "", actor: null, re: /\bKarpathy\b/ },
  { id: "fei-fei-li", cat: "chercheurs", n: "Fei-Fei Li", role: "Chercheuse, cofondatrice de World Labs", co: "World Labs", actor: null, re: /\bFei-Fei Li\b/ },
  { id: "mira-murati", cat: "chercheurs", n: "Mira Murati", role: "Fondatrice de Thinking Machines Lab, ancienne CTO d'OpenAI", co: "Thinking Machines Lab", actor: null, re: /\bMurati\b/ },
  { id: "arthur-mensch", cat: "chercheurs", n: "Arthur Mensch", role: "PDG de Mistral AI", co: "Mistral AI", actor: null, re: /\bMensch\b/ },
  { id: "donald-trump", cat: "pouvoirs", n: "Donald Trump", role: "Président des États-Unis", co: "", actor: null, re: /\bTrump\b/, q: '"Trump" (AI OR "artificial intelligence" OR Nvidia OR chips OR "data centers")' },
  { id: "david-sacks", cat: "pouvoirs", n: "David Sacks", role: "Coprésident du PCAST, ancien conseiller IA et crypto de la Maison-Blanche", co: "", actor: null, re: /\bDavid Sacks\b/, q: '"David Sacks" AI' },
  { id: "howard-lutnick", cat: "pouvoirs", n: "Howard Lutnick", role: "Secrétaire américain au Commerce", co: "", actor: null, re: /\bLutnick\b/, q: '"Lutnick" (chips OR AI OR Nvidia OR export OR semiconductor)' },
  { id: "henna-virkkunen", cat: "pouvoirs", n: "Henna Virkkunen", role: "Vice-présidente exécutive de la Commission européenne (souveraineté technologique)", co: "", actor: null, re: /\bVirkkunen\b/ },
  { id: "scott-bessent", cat: "pouvoirs", n: "Scott Bessent", role: "Secrétaire américain au Trésor", co: "", actor: null, re: /\bBessent\b/, q: '"Bessent" (AI OR Nvidia OR chips OR semiconductor OR tariffs)' },
  { id: "michael-kratsios", cat: "pouvoirs", n: "Michael Kratsios", role: "Directeur du bureau de la science et de la technologie de la Maison-Blanche (OSTP)", co: "", actor: null, re: /\bKratsios\b/ },
  { id: "ted-cruz", cat: "pouvoirs", n: "Ted Cruz", role: "Sénateur républicain, président de la commission Commerce du Sénat", co: "", actor: null, re: /\bTed Cruz\b|\b(?:Sen\.|Senator) Cruz\b/, q: '"Ted Cruz" (AI OR "artificial intelligence" OR chatbot OR Nvidia)' },
  { id: "maria-cantwell", cat: "pouvoirs", n: "Maria Cantwell", role: "Sénatrice démocrate, première démocrate de la commission Commerce", co: "", actor: null, re: /\bCantwell\b/, q: '"Maria Cantwell" AI' },
  { id: "mark-warner", cat: "pouvoirs", n: "Mark Warner", role: "Sénateur démocrate de Virginie", co: "", actor: null, re: /\bMark Warner\b|\b(?:Sen\.|Senator) Warner\b/, q: '"Mark Warner" (AI OR "artificial intelligence" OR chips)' },
  { id: "josh-hawley", cat: "pouvoirs", n: "Josh Hawley", role: "Sénateur républicain du Missouri", co: "", actor: null, re: /\bHawley\b/, q: '"Josh Hawley" (AI OR "artificial intelligence" OR chatbot)' },
  { id: "elizabeth-warren", cat: "pouvoirs", n: "Elizabeth Warren", role: "Sénatrice démocrate, première démocrate de la commission Banques", co: "", actor: null, re: /\bElizabeth Warren\b|\b(?:Sen\.|Senator) Warren\b/, q: '"Elizabeth Warren" (Nvidia OR AI OR chips OR "data centers")' },
  { id: "jay-obernolte", cat: "pouvoirs", n: "Jay Obernolte", role: "Représentant républicain de Californie, président de la sous-commission Recherche et Technologie", co: "", actor: null, re: /\bObernolte\b/ },
  { id: "ted-lieu", cat: "pouvoirs", n: "Ted Lieu", role: "Représentant démocrate de Californie", co: "", actor: null, re: /\bTed Lieu\b|\b(?:Rep\.|Representative) Lieu\b/, q: '"Ted Lieu" AI' },
  { id: "john-moolenaar", cat: "pouvoirs", n: "John Moolenaar", role: "Représentant républicain du Michigan, commission spéciale sur la Chine", co: "", actor: null, re: /\bMoolenaar\b/, q: '"Moolenaar" (chips OR AI OR Nvidia OR China OR export)' },
  { id: "bill-ackman", cat: "investisseurs", n: "Bill Ackman", role: "Fondateur et PDG de Pershing Square", co: "", actor: null, re: /\bAckman\b/ },
  { id: "michael-burry", cat: "investisseurs", n: "Michael Burry", role: "Investisseur (« The Big Short »), auteur de la newsletter Cassandra Unchained", co: "", actor: null, re: /\bBurry\b/ },
  { id: "dan-ives", cat: "investisseurs", n: "Dan Ives", role: "Analyste technologie (Wedbush Securities)", co: "", actor: null, re: /\bDan Ives\b/, q: '"Dan Ives"' },
  { id: "stacy-rasgon", cat: "investisseurs", n: "Stacy Rasgon", role: "Analyste semi-conducteurs (Bernstein)", co: "", actor: null, re: /\bRasgon\b/ },
  { id: "gil-luria", cat: "investisseurs", n: "Gil Luria", role: "Analyste (D.A. Davidson)", co: "", actor: null, re: /\bLuria\b/, q: '"Gil Luria"' },
  { id: "ming-chi-kuo", cat: "investisseurs", n: "Ming-Chi Kuo", role: "Analyste de la chaîne d'approvisionnement technologique (TF International Securities)", co: "", actor: null, re: /\bKuo\b/, q: '"Ming-Chi Kuo"' },
  { id: "cathie-wood", cat: "investisseurs", n: "Cathie Wood", role: "Fondatrice d'ARK Invest", co: "", actor: null, re: /\bCathie Wood\b/ },
  { id: "masayoshi-son", cat: "investisseurs", n: "Masayoshi Son", role: "Fondateur et PDG de SoftBank", co: "", actor: null, re: /\bMasayoshi Son\b/ },
  { id: "marc-andreessen", cat: "investisseurs", n: "Marc Andreessen", role: "Cofondateur du fonds Andreessen Horowitz", co: "", actor: null, re: /\bAndreessen\b/ },
  { id: "stanley-druckenmiller", cat: "investisseurs", n: "Stanley Druckenmiller", role: "Investisseur (Duquesne Family Office)", co: "", actor: null, re: /\bDruckenmiller\b/ },
  { id: "ray-dalio", cat: "investisseurs", n: "Ray Dalio", role: "Fondateur de Bridgewater Associates", co: "", actor: null, re: /\bDalio\b/, q: '"Ray Dalio" (AI OR bubble OR Nvidia OR market)' },
  { id: "jim-chanos", cat: "investisseurs", n: "Jim Chanos", role: "Investisseur vendeur à découvert (Kynikos)", co: "", actor: null, re: /\bChanos\b/, q: '"Jim Chanos" (AI OR Nvidia OR "data center" OR bubble)' },
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
// Pour les investisseurs et analystes, une prise de position compte aussi : achat, vente, pari, relèvement ou abaissement d'objectif.
export const INVEST_CUE = "buys?|bought|sells?|sold|shorts?|shorted|bets?|dumps?|dumped|trims?|adds?|boosts?|raises?|cuts?|lowers?|upgrades?|downgrades?|initiates?|reiterates?|backs?|stakes?|invests?|exits?|loads?|doubles?|piles?";
// Pouvoirs publics et investisseurs parlent de tout : on ne garde que ce qui touche à l'IA, aux puces, aux datacenters et aux grandes sociétés de l'IA.
export const TOPIC = /\b(?:A\.?I\.?|artificial intelligence|chatbots?|Nvidia|OpenAI|Anthropic|Gemini|ChatGPT|Claude|xAI|Grok|chips?|semiconductors?|GPUs?|data ?cent(?:er|re)s?|Huang|Microsoft|Alphabet|Google|Meta|AMD|Broadcom|TSMC|Micron|Intel|Oracle|CoreWeave|Palantir|SoftBank|Samsung|SK hynix|ASML|hyperscalers?|robots?|robotics|superintelligence|tech(?:nology)?)\b/i;
const cueRe = new RegExp(`\\b(?:${CUE})\\b`, "i");

/** La personne est-elle celle qui parle dans ce titre ? */
export function isStatement(title, re, extra = "") {
  const CUEX = extra ? `${CUE}|${extra}` : CUE;
  const t = String(title).replace(/\s+/g, " ").trim();
  const m = re.exec(t);
  if (!m) return false;
  // « Meta AI predicts… », « Grok says… » : c'est un chatbot qui parle, pas la personne
  if (/\b(?:Meta AI|ChatGPT|Grok|Gemini|Claude|Copilot|Siri|AI (?:predicts|says|thinks))\b/i.test(t.slice(m.index + m[0].length).split(/[:,|]/)[0])) return false;
  const before = t.slice(0, m.index), after = t.slice(m.index + m[0].length);
  // « X says … » : le verbe suit le nom (au plus six mots entre les deux : titre, sociétés, etc.)
  const cueAfter = new RegExp(`^((?:[\\w.'’-]+\\W+){0,6}?)(?:${CUEX})\\b`, "i").exec(after.replace(/^['’]s\b/, "").trim());
  if (cueAfter && /(?:^|\s)(?:to|will|would|not|never|could)\s*$/i.test(cueAfter[1])) return false;
  if (cueAfter && /\b(?:he|she|they|who|which)\b/i.test(cueAfter[1])) return false; // nouveau sujet : « Bessent blames Lutnick’s Commerce as he slams… »
  if (new RegExp(`^(?:[\\w.'’-]+\\W+){0,6}?(?:${CUEX})\\b`, "i").test(after.replace(/^['’]s\b/, "").trim()) && !/^\s*(?:,|’s|'s)?\s*(?:lawyers?|critics?|rivals?)\b/i.test(after)) {
    // le nom ne doit pas être complément d'un autre sujet qui parle (« Trump says Altman… », « Analysts say Huang… »)
    if (!new RegExp(`\\b(?:${CUEX})\\s+(?:that\\s+)?(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  }
  // « …, says X » / « — X says » / « | X : »
  if (new RegExp(`[,–—|:-]\\s*(?:${CUEX})\\s+(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  // « Musk : "…" » : le nom ouvre le titre, suivi de deux-points puis d'une citation
  if (/^\s*:\s*['"‘“]/.test(after) && before.trim().length < 12) return true;
  return false;
}

const CHANGE = /\b(?:resign\w*|steps? down|stepping down|ousted|fired|replaced|appointed|names? (?:new |a new )?(?:ceo|chief|chair)|succeed\w*|retir\w*|quits?|departure|leaves|exits?)\b/i;
export const ROLES_AS_OF = "2026-11-18";
const DAY = 864e5;
async function withRetry(fn, sleep) { try { return await fn(); } catch (e) { if (!/429|5\d\d|abort|timeout/i.test(String(e.message || e))) throw e; await sleep(5000); return fn(); } }
const canon = (u) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^utm_|^oc$|^hl$|^gl$|^ceid$/.test(k)) x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return String(u); } };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * collectVoix({ http, parseFeed, now, prev, log }) → { doc, summary }
 * `http(url)` renvoie le texte ; une personne ou une chaîne en échec n'arrête pas les autres.
 */
export async function collectVoix({ http, parseFeed, now, prev, log = () => {}, pause = 1000, sleep = (t) => new Promise((r) => setTimeout(r, t)) }) {
  const cutoff = now - VOIX_RULES.days * DAY;
  const byPerson = new Map(PEOPLE.map((p) => [p.id, new Map()]));
  for (const p of prev?.people || []) if (byPerson.has(p.id)) for (const it of p.items || []) byPerson.get(p.id).set(canon(it.url), it);
  const alerts = new Map(PEOPLE.map((p) => [p.id, new Map()]));
  for (const p of prev?.people || []) if (alerts.has(p.id)) for (const a of p.alerts || []) alerts.get(p.id).set(canon(a.url), a);
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
        // Google ajoute « - Média » en fin de titre : on retire exactement le nom du média annoncé, sinon le dernier segment
        const sfx = x.source && x.title.endsWith(" - " + x.source) ? " - " + x.source : null;
        const title = (sfx ? x.title.slice(0, -sfx.length) : x.title.replace(/\s+-\s+[^-]{2,40}$/, "")).trim();
        // alerte de poste : un titre récent annonce peut-être un changement (démission, nomination…) pour cette personne
        if (p.watch !== false && ts > Date.parse(ROLES_AS_OF + "T23:59:59Z") && p.re.test(title) && CHANGE.test(title)) alerts.get(p.id).set(canon(x.link), { ts: new Date(ts).toISOString(), title, url: x.link, source: x.source || "Presse" });
        if ((p.cat === "pouvoirs" || p.cat === "investisseurs") && !TOPIC.test(title)) continue;
        if (!isStatement(title, p.re, p.cat === "investisseurs" ? INVEST_CUE : "")) continue;
        add(p, { ts: new Date(ts).toISOString(), title, url: x.link, source: String(x.source || "").split(/\s[-–|]\s/)[0] || (x.title.match(/\s-\s([^-]{2,40})$/) || [])[1] || "Presse", kind: "presse" });
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
    id: p.id, cat: p.cat, n: p.n, role: p.role, co: p.co, actor: p.actor,
    alerts: [...alerts.get(p.id).values()].filter((a) => Date.parse(a.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 2),
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
