// What's Going On? — « Briefing du jour » : 3 actualités DISTINCTES (pas deux fois le même dossier), chacune avec un titre,
// 2 à 4 puces qui apportent chacune du détail, du contexte ou une explication (jamais une reformulation du titre) et ses sources.
// Règles ancrées en dur dans FOCUS_RULES et vérifiées à chaque génération. Aucune dépendance.
import { hasNumberWords, digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";

const H = 3600e3, DAY = 24 * H;

/** Règles du briefing, appliquées par le code (et non seulement demandées au modèle). */
export const FOCUS_RULES = { stories: 3, candidates: 6, minBullets: 2, maxBullets: 4, kinds: ["detail", "contexte", "explication"], distinctOverlap: 0.22, headOverlap: 0.3 };

function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
}
function shared(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; return i; }
function sim(a, b) { const i = shared(a, b); return i >= 3 ? i / (a.size + b.size - i) : 0; }
const titleToks = (i) => tokens(i.title);
/** Deux articles ne se regroupent que s'ils partagent au moins 2 mots de titre ET la même catégorie ou la même couche. */
function compat(a, b) {
  if (shared(titleToks(a), titleToks(b)) < 2) return false;
  return (a.category && a.category === b.category) || (a.layer && a.layer !== "Autre" && a.layer === b.layer);
}
function overlap(a, b) { const i = shared(a, b); return i >= 2 ? i / Math.min(a.size, b.size) : 0; }

/**
 * Regroupe les articles récents qui parlent du même sujet. Une « histoire » = un groupe ;
 * elle monte avec l'importance, le nombre de médias différents qui la couvrent et sa fraîcheur (lente : 8 points perdus en 4 jours).
 */
export function pickStories(items, now, n = FOCUS_RULES.candidates, distinct = FOCUS_RULES.distinctOverlap) {
  let pool = items.filter((i) => !i.pending && now - Date.parse(i.ts) < 7 * DAY && Date.parse(i.ts) < now + H && i.importance >= 2);
  if (pool.length < 8) pool = items.filter((i) => !i.pending && Date.parse(i.ts) < now + H && (now - Date.parse(i.ts) < 2 * DAY || (i.importance >= 2 && now - Date.parse(i.ts) < 7 * DAY)));
  const tok = new Map(pool.map((i) => [i.id, tokens(i.title + " " + (i.summary || ""))]));
  const groups = [];
  for (const it of [...pool].sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)))) {
    const g = groups.find((g) => compat(it, g.items[0]) && (sim(tok.get(it.id), tok.get(g.items[0].id)) >= 0.2 || g.items.some((o) => compat(it, o) && sim(tok.get(it.id), tok.get(o.id)) >= 0.35)));
    if (g) g.items.push(it); else groups.push({ items: [it] });
  }
  const scored = groups.map((g) => {
    const arts = g.items.slice().sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)));
    const media = new Set(arts.map((a) => a.source));
    const newest = Math.max(...arts.map((a) => Date.parse(a.ts)));
    const score = arts[0].importance * 10 + Math.min(6, 1.5 * (media.size - 1)) + Math.max(0, 8 - ((now - newest) / H) / 12) + (arts.some((a) => a.confidence === "haute") ? 2 : 0);
    return { lead: arts[0], items: arts, media: media.size, newest, score, toks: tokens(arts.map((a) => a.title).join(" ")) };
  }).sort((a, b) => b.score - a.score);
  // choix glouton : un léger malus pour un sujet de même catégorie déjà retenu ; une histoire trop proche d'une histoire déjà retenue
  // (même dossier vu sous un autre angle : une mesure et sa réaction, par exemple) est écartée, jamais proposée deux fois
  const out = [];
  while (out.length < n && scored.length) {
    let bi = -1, bs = -1e9;
    scored.forEach((x, k) => {
      if (out.some((o) => overlap(x.toks, o.toks) >= distinct)) return;
      const sc = x.score - 2.5 * out.filter((o) => o.lead.category === x.lead.category).length;
      if (sc > bs) { bs = sc; bi = k; }
    });
    if (bi < 0) break;
    out.push(scored.splice(bi, 1)[0]);
  }
  return out;
}

/** Articles plus anciens sur le même sujet (jusqu'à 3), pour la remise en contexte. */
export function relatedFor(story, items, now, max = 3) {
  const own = new Set(story.items.map((i) => i.id));
  const t0 = tokens(story.items.map((i) => i.title + " " + (i.summary || "")).join(" ")), oldest = Math.min(...story.items.map((i) => Date.parse(i.ts)));
  const scored = [];
  for (const o of items) {
    if (own.has(o.id) || o.pending) continue;
    const to = Date.parse(o.ts);
    if (!(to < oldest - 6 * H) || now - to > 120 * DAY) continue;
    const s = overlap(tokens(o.title), t0);
    if (s >= 0.4) scored.push({ o, s: s + (o.importance - 1) * 0.05 });
  }
  scored.sort((a, b) => b.s - a.s);
  const seen = new Set(), out = [];
  for (const { o } of scored) { const k = o.title.slice(0, 40); if (seen.has(k)) continue; seen.add(k); out.push(o); if (out.length >= max) break; }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

export const FOCUS_SYSTEM = `Tu rédiges le « Briefing du jour » d'un site d'actualité sur l'intelligence artificielle et son économie, pour un lecteur non spécialiste qui lit vite. On te donne jusqu'à 6 histoires numérotées (i) ; chacune regroupe des articles récents sur le même sujet (articles : a, title, summary, source, date) et parfois des articles plus anciens (background : j).
ÉTAPE 1. Choisis EXACTEMENT 3 histoires, de la plus importante à la moins importante, qui racontent 3 événements DIFFÉRENTS. Deux histoires du même dossier comptent pour une seule (par exemple une mesure et la réaction à cette mesure, ou la même affaire vue sous deux angles) : n'en garde qu'une et ignore l'autre. Si tu ne trouves pas 3 événements différents, renvoie-en moins plutôt que de répéter un sujet.
ÉTAPE 2. Pour chaque histoire retenue, renvoie, en français :
- head : le titre, une phrase d'actualité claire, 110 caractères maximum, sans point final. C'est lui, et lui seul, qui dit l'événement.
- bullets : de 2 à 4 puces. Chaque puce apporte une information NOUVELLE, que ni le titre ni les autres puces ne donnent, et appartient à l'un de ces trois types (champ kind) :
  • "detail" : un fait précis de l'événement qui n'est pas dans le titre (chiffre, montant, date, nom, lieu, condition, calendrier).
  • "contexte" : ce qui s'est passé avant, d'après UNIQUEMENT le background (indique les numéros j utilisés dans ctx). Sans background, pas de puce de ce type.
  • "explication" : le mécanisme ou l'enjeu, tels que les articles les indiquent (pourquoi cette décision, ce qu'elle change et pour qui). N'invente aucune cause.
  Une puce ne reformule JAMAIS le titre, même avec d'autres mots. Mauvais exemple : titre « Nvidia arrête ses ventes de puces avancées en Chine », puce « Nvidia interrompt la commercialisation de ses processeurs vers le marché chinois ». Si les articles ne permettent que 2 puces utiles, n'en écris que 2 ; n'écris jamais une puce pour combler. Va droit au fait, 200 caractères maximum par puce.
- Pour chaque puce, text_en est sa traduction fidèle en anglais ; head_en est celle du titre.
Règles impératives :
- Aucune formule creuse ou d'introduction : ne commence jamais une puce par « Cela veut dire », « Cela signifie », « Cela montre que », « Cela pourrait », « Autrement dit », « En clair », « Concrètement », « Il faut retenir ». Écris directement le fait.
- Titre et puces parlent du même événement. Si un article fourni n'a manifestement rien à voir avec le premier, ignore-le.
- N'utilise AUCUN chiffre, date, nom propre ou fait absent des articles fournis. N'invente rien, ne complète pas avec tes connaissances.
- Écris tous les nombres en chiffres, jamais en toutes lettres.
- Pas d'opinion politique, pas de prédiction, aucun conseil d'investissement : décris les positions des acteurs sans prendre parti.
Réponds uniquement par un tableau JSON, un objet par histoire retenue, avec le même champ i que l'histoire.`;

export const FOCUS_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" }, head: { type: "STRING" }, head_en: { type: "STRING" },
      bullets: { type: "ARRAY", items: { type: "OBJECT", properties: { kind: { type: "STRING", enum: ["detail", "contexte", "explication"] }, text: { type: "STRING" }, text_en: { type: "STRING" }, ctx: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["kind", "text", "text_en", "ctx"] } },
    },
    required: ["i", "head", "head_en", "bullets"],
  },
};

const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
const LIM = { head: 130, b: 260 };
/** Formules creuses d'introduction (français et anglais) : une puce qui en commence par une est écartée. */
export const FILLER = /^\s*(cela|ça|ce qui)\s+(veut|vient de)\s+dire\b|^\s*(cela|ça)\s+(signifie|montre|laisse|pourrait|pourrait|suggère|indique|prouve|confirme|illustre|souligne)\b|^\s*(autrement dit|en d['’]autres termes|en clair|concrètement|il faut (retenir|savoir)|à retenir|en résumé|en somme|bref)\b|^\s*(this|that|which)\s+(means|shows|suggests|could|might|indicates|confirms|highlights|illustrates)\b|^\s*(in other words|in short|basically|put simply|concretely)\b/i;

/** Part des mots (plus de 3 lettres) du texte qui ne figurent pas encore dans `seen` : 0 = tout était déjà dit. */
function novelty(text, seen) { const t = tokens(text); return t.size ? 1 - shared(t, seen) / t.size : 0; }
/** Nombres et noms propres du texte (hors début de phrase) : le signal qu'un fait nouveau est apporté. */
function anchors(text) {
  const out = new Set(digitsOf(text));
  for (const m of String(text).matchAll(/(?<=[\s(«"'’-])[A-ZÀ-ÖØ-Þ][\p{L}\d.-]{2,}/gu)) out.add(m[0].toLowerCase().normalize("NFKD").replace(/\p{M}/gu, ""));
  return out;
}

/**
 * Valide les histoires renvoyées par le modèle. Une histoire est rejetée sans titre valide ou avec moins de 2 puces utiles.
 * Une puce est retirée si elle : n'a pas un type connu, est creuse, trop longue, contient un nombre absent des articles fournis,
 * répète le titre ou une puce précédente (moins de la moitié de mots nouveaux), n'apporte aucun nombre ni nom propre nouveau
 * (types « detail » et « contexte »), ou prétend donner du contexte sans article plus ancien.
 */
export function validateStories(arr, inputs, diag = []) {
  if (!Array.isArray(arr)) return null;
  const { minBullets, maxBullets, kinds } = FOCUS_RULES;
  const out = [];
  for (const r of arr) {
    const inp = inputs.find((x) => x.i === Number(r?.i));
    if (!inp) { diag.push("numéro d'histoire inconnu"); continue; }
    const bg = inp.background || [];
    const own = inp.articles.map((a) => `${a.title} ${a.summary}`).join(" ");
    const pool = new Set(digitsOf(own + " " + bg.map((b) => `${b.title} ${b.summary}`).join(" ")));
    const okText = (x) => !hasNumberWords(x) && !foreignScript(x) && digitsOf(x).every((d) => pool.has(d));
    const head = clean(r.head);
    if (!head || head.length > LIM.head || FILLER.test(head) || !okText(head)) { diag.push(`histoire ${inp.i} : titre vide, trop long, creux ou non conforme`); continue; }
    let seenTok = tokens(head), seenAn = anchors(head);
    const kept = [];
    for (const b of Array.isArray(r.bullets) ? r.bullets : []) {
      if (kept.length >= maxBullets) break;
      const kind = String(b?.kind || ""), text = clean(b?.text), en = clean(b?.text_en);
      const ctx = kind === "contexte" ? [...new Set((Array.isArray(b?.ctx) ? b.ctx : []).map(Number))].filter((j) => bg.some((x) => x.j === j)) : [];
      let why = null;
      if (!kinds.includes(kind)) why = "type inconnu";
      else if (!text || text.length > LIM.b) why = "vide ou trop longue";
      else if (FILLER.test(text) || (en && FILLER.test(en))) why = "formule creuse";
      else if (!okText(text)) why = "nombre ou écriture non conforme";
      else if (kind === "contexte" && !ctx.length) why = "contexte sans article plus ancien";
      else if (novelty(text, seenTok) < 0.5) why = "répète le titre ou une autre puce";
      else if (kind !== "explication" && ![...anchors(text)].some((a) => !seenAn.has(a))) why = "aucun fait nouveau";
      if (why) { diag.push(`histoire ${inp.i} : puce retirée (${why})`); continue; }
      kept.push({ kind, text, en, ctx });
      seenTok = new Set([...seenTok, ...tokens(text)]); seenAn = new Set([...seenAn, ...anchors(text)]);
    }
    if (kept.length < minBullets) { diag.push(`histoire ${inp.i} : moins de ${minBullets} puces utiles`); continue; }
    const he = clean(r.head_en);
    const enOk = !!he && he.length <= LIM.head + 20 && !foreignScript(he) && digitsOf(he).every((d) => pool.has(d)) && kept.every((b) => b.en && b.en.length <= LIM.b + 40 && !foreignScript(b.en) && digitsOf(b.en).every((d) => pool.has(d)));
    out.push({ i: inp.i, head, bullets: kept.map((b) => b.text), kinds: kept.map((b) => b.kind), ctx: [...new Set(kept.flatMap((b) => b.ctx))], head_en: enOk ? he : null, bullets_en: enOk ? kept.map((b) => b.en) : null });
  }
  return out.length ? out : null;
}

/** Garde au plus n histoires VRAIMENT distinctes : aucun article en commun et des titres qui ne parlent pas du même dossier. */
export function selectDistinct(valid, cands, n = FOCUS_RULES.stories, diag = []) {
  const out = [];
  for (const r of [...valid].sort((a, b) => a.i - b.i)) {
    const c = cands[r.i - 1];
    if (!c) continue;
    const ids = new Set(c.items.map((a) => a.id)), ht = tokens(r.head);
    const clash = out.find((o) => o.ids.some((id) => ids.has(id)) || overlap(tokens(o.head), ht) >= FOCUS_RULES.headOverlap);
    if (clash) { diag.push(`histoire ${r.i} : même dossier que « ${clash.head.slice(0, 50)} »`); continue; }
    out.push({ ...r, ids: [...ids] });
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Produit focus.json (le briefing). `generate(inputs)` appelle le modèle (ou null si indisponible).
 * Régénéré si les histoires candidates ou leurs articles changent, ou si le document a plus de 6 h ; sinon le précédent est conservé.
 * Moins de 3 histoires distinctes et valides : l'ancien briefing à 3 histoires est conservé ; à défaut, on publie celles qui existent.
 */
export async function makeFocus({ items, now, prev, generate, modelName }) {
  const stories = pickStories(items, now);
  const sig = stories.map((s) => s.items.map((a) => a.id).sort().join("+"));
  const base = prev && Array.isArray(prev.stories) ? prev : { v: 2, generated_at: null, model: null, sig: [], stories: [] };
  const good = base.v === 2 && base.stories.length === FOCUS_RULES.stories;
  if (!stories.length) return { doc: base, regenerated: false, reason: "aucune histoire importante" };
  const same = good && Array.isArray(base.sig) && sig.length === base.sig.length && sig.every((x, k) => base.sig[k] === x);
  const age = base.generated_at ? now - Date.parse(base.generated_at) : Infinity;
  if (same && age <= 6 * H) return { doc: base, regenerated: false, reason: "histoires retenues inchangées" };
  if (!generate) return { doc: base, regenerated: false, reason: "Gemini indisponible : dernier briefing conservé" };
  const inputs = stories.map((s, k) => ({
    i: k + 1,
    articles: s.items.slice(0, 5).map((a, m) => ({ a: m + 1, title: a.title, summary: a.summary || "", source: a.source, date: a.ts.slice(0, 10) })),
    background: relatedFor(s, items, now).map((o, m) => ({ j: m + 1, id: o.id, date: o.ts.slice(0, 10), title: o.title, summary: o.summary || "", source: o.source })),
  }));
  let res = null;
  try { res = await generate(inputs.map((x) => ({ ...x, background: x.background.map(({ id, ...b }) => b) }))); } catch { res = null; }
  const diag = [];
  const valid = validateStories(res, inputs, diag);
  if (!valid) return { doc: base, regenerated: false, reason: res ? "briefing rejeté : " + (diag.slice(0, 3).join(" ; ") || (Array.isArray(res) ? "réponse vide" : "réponse invalide")) : "Gemini indisponible : dernier briefing conservé" };
  const keep = selectDistinct(valid, stories, FOCUS_RULES.stories, diag);
  if (keep.length < FOCUS_RULES.stories && good) return { doc: base, regenerated: false, reason: `moins de ${FOCUS_RULES.stories} histoires distinctes et valides (${keep.length}) : dernier briefing conservé` };
  if (!keep.length) return { doc: base, regenerated: false, reason: "briefing rejeté : " + (diag.slice(0, 3).join(" ; ") || "aucune histoire distincte") };
  return {
    doc: {
      v: 2, rules: { stories: FOCUS_RULES.stories, min_bullets: FOCUS_RULES.minBullets, max_bullets: FOCUS_RULES.maxBullets },
      generated_at: new Date(now).toISOString(), model: modelName ? modelName() : null, sig,
      stories: keep.map((r) => {
        const s = stories[r.i - 1], inp = inputs[r.i - 1], media = new Set(), ids = [];
        for (const a of s.items) { if (media.has(a.source)) continue; media.add(a.source); ids.push(a.id); if (ids.length >= 4) break; }
        return { ids, head: r.head, bullets: r.bullets, kinds: r.kinds, head_en: r.head_en, bullets_en: r.bullets_en, ctx_ids: r.ctx.map((j) => inp.background.find((b) => b.j === j).id), ts: new Date(s.newest).toISOString() };
      }),
    },
    regenerated: true, reason: keep.length < FOCUS_RULES.stories ? `briefing régénéré (${keep.length} histoire(s) distincte(s) seulement)` : "briefing régénéré",
  };
}
