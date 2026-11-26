// What's Going On? — « Actualités regroupées » : les articles qui traitent de la même actualité forment une histoire,
// avec UN titre et UN résumé (IA, validés) et la liste de leurs articles. Le regroupement est mécanique (mots des titres, même
// logique que « La une ») ; l'IA n'écrit que le titre et le résumé des groupes de 2 articles ou plus. Aucune dépendance.
import { tokens, shared, sim } from "./focus.mjs";
import { digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";

const H = 3600e3, DAY = 24 * H;
/** days : âge maximal des articles regroupés ; spanH : écart maximal entre deux articles d'un même groupe ; maxAI : groupes rédigés par collecte. */
export const STORY_RULES = { days: 5, spanH: 72, minItems: 2, maxItems: 20, simMin: 0.26, rareMin: 6, rareShare: 0.006, maxAI: 30, aiItems: 6, regen: 2, headMax: 130, sumMax: 300 };

const enSum = (i) => i.summary_en || (i.pending ? i.summary : "") || "";

/** Regroupe les articles (les non classés du flux rapide compris) ; renvoie les groupes d'au moins `minItems` articles, le premier de chaque groupe étant le plus important. */
export function groupItems(items, now) {
  const R = STORY_RULES;
  const pool = items.filter((i) => i && i.id && i.title && Date.parse(i.ts) < now + H && now - Date.parse(i.ts) < R.days * DAY);
  const T = new Map(pool.map((i) => [i.id, tokens(i.orig || i.title)]));
  const F = new Map(pool.map((i) => [i.id, tokens((i.orig || i.title) + " " + enSum(i))]));
  // un mot est « rare » s'il figure dans peu de titres : deux articles ne se regroupent que s'ils partagent au moins un mot rare
  // (Megaspeed, thérapie, grâce…) en plus de leurs mots communs (Nvidia, Huang, centre de données…), ce qui évite les amalgames.
  const df = new Map();
  for (const t of T.values()) for (const w of t) df.set(w, (df.get(w) || 0) + 1);
  const rareMax = Math.max(R.rareMin, Math.round(R.rareShare * pool.length));
  const rare = (w) => df.get(w) <= rareMax;
  const compat = (a, b) => {
    const ta = T.get(a.id), tb = T.get(b.id);
    let k = 0, r = 0;
    for (const w of ta) if (tb.has(w)) { k++; if (rare(w)) r++; }
    return k >= 2 && r >= 1 && (k >= 3 || (a.category && a.category === b.category) || (a.layer && a.layer !== "Autre" && a.layer === b.layer));
  };
  const near = (a, b) => Math.abs(Date.parse(a.ts) - Date.parse(b.ts)) <= R.spanH * H;
  const groups = [];
  for (const it of [...pool].sort((a, b) => ((b.importance || 1) - (a.importance || 1)) || (Date.parse(b.ts) - Date.parse(a.ts)))) {
    const g = groups.find((g) => g.items.length < R.maxItems && near(it, g.items[0]) && compat(it, g.items[0]) && sim(F.get(it.id), F.get(g.items[0].id)) >= R.simMin);
    if (g) g.items.push(it); else groups.push({ items: [it] });
  }
  // une histoire exige au moins deux médias différents : deux articles du même média ne confirment rien (et recoupent souvent des communiqués types)
  return groups.filter((g) => g.items.length >= R.minItems && new Set(g.items.map((i) => i.source)).size >= 2);
}

/** Histoires du moment ; le titre et le résumé déjà rédigés sont repris du fichier précédent (le groupe qui partage le plus d'articles). */
export function buildStories({ items, prev, now }) {
  const prevBy = new Map();
  for (const s of (prev && prev.stories) || []) for (const id of s.ids || []) prevBy.set(id, s);
  const used = new Set();
  return groupItems(items, now).map((g) => {
    const arts = g.items.slice().sort((a, b) => b.ts.localeCompare(a.ts));
    const ids = arts.map((a) => a.id);
    const votes = new Map();
    for (const id of ids) { const p = prevBy.get(id); if (p) votes.set(p, (votes.get(p) || 0) + 1); }
    let best = null, bv = 0;
    for (const [p, v] of votes) if (v > bv) { best = p; bv = v; }
    const oldest = arts[arts.length - 1].id;
    const id = best && !used.has(best.id) ? best.id : oldest;
    used.add(id);
    const s = { id, lead: g.items[0].id, ids, n: ids.length, media: new Set(arts.map((a) => a.source)).size, imp: Math.max(...arts.map((a) => a.importance || 1)), ts: arts[0].ts };
    if (best && best.head) for (const k of ["head", "head_en", "summary", "summary_en", "sn"]) if (best[k] != null) s[k] = best[k];
    return s;
  }).sort((a, b) => b.ts.localeCompare(a.ts));
}

export const STORY_SYSTEM = `Tu rédiges, pour un site d'actualité sur l'intelligence artificielle, UN titre et UN résumé pour chaque groupe d'articles qui traitent de la même actualité. Pour chaque groupe (i, articles = titres, médias et résumés), renvoie :
- head : un titre français factuel et neutre, 110 caractères au plus, qui dit ce qui s'est passé (qui, quoi). Aucune formule accrocheuse.
- summary : 1 à 2 phrases en français, 260 caractères au plus, avec l'essentiel et un détail utile, sans répéter le titre.
- head_en, summary_en : les mêmes en anglais.
Règles : n'utilise que les informations des articles fournis ; aucun chiffre, nom ou date absent des textes ; écris les nombres en chiffres. ${UNITS_RULE} Si les articles ne parlent pas tous du même événement, décris seulement ce qu'ils ont en commun. Réponds uniquement par un tableau JSON, un objet par groupe, avec le même champ i.`;
export const STORY_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, head: { type: "STRING" }, summary: { type: "STRING" }, head_en: { type: "STRING" }, summary_en: { type: "STRING" } }, required: ["i", "head", "summary", "head_en", "summary_en"] },
};
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Rédige (par un seul appel) le titre et le résumé des groupes qui n'en ont pas, ou dont le nombre d'articles a doublé ; chaque texte n'est gardé que si ses chiffres viennent des articles. */
export async function summarizeStories({ stories, byId, generate }) {
  const R = STORY_RULES;
  if (!generate) return { changed: 0, reason: "Gemini indisponible" };
  const todo = stories.filter((s) => !s.head || s.n >= (s.sn || s.n) * R.regen).sort((a, b) => (b.n - a.n) || b.ts.localeCompare(a.ts)).slice(0, R.maxAI);
  if (!todo.length) return { changed: 0, reason: "rien à rédiger" };
  const inputs = todo.map((s, i) => ({
    i,
    articles: s.ids.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => ((b.importance || 1) - (a.importance || 1)) || b.ts.localeCompare(a.ts)).slice(0, R.aiItems).map((a) => ({ title: a.title, source: a.source, summary: (a.summary || "").slice(0, 240) })),
  }));
  let res = null;
  try { res = await generate(inputs); } catch { res = null; }
  if (!Array.isArray(res)) return { changed: 0, reason: "Gemini indisponible" };
  let n = 0;
  for (const r of res) {
    const idx = Number(r?.i), s = todo[idx], inp = inputs[idx];
    if (!s || !inp) continue;
    const all = inp.articles.map((a) => `${a.title} ${a.summary}`).join(" ");
    const pool = new Set(digitsOf(stripAmounts(all)));
    const ok = (t, lang) => digitsOf(stripAmounts(t)).every((d) => pool.has(d)) && unitsOk(all, t, lang, false);
    const head = clean(r.head), sum = clean(r.summary);
    if (!head || !sum || head.length > R.headMax || sum.length > R.sumMax || foreignScript(head) || foreignScript(sum) || !ok(head, "fr") || !ok(sum, "fr")) continue;
    s.head = normalizeFr(all, head); s.summary = normalizeFr(all, sum); s.sn = s.n;
    const he = clean(r.head_en), se = clean(r.summary_en);
    if (he && se && he.length <= R.headMax + 20 && se.length <= R.sumMax + 40 && !foreignScript(he) && !foreignScript(se) && ok(he, "en") && ok(se, "en")) { s.head_en = he; s.summary_en = se; } else { delete s.head_en; delete s.summary_en; }
    n++;
  }
  return { changed: n, reason: n ? `${n} histoire(s) rédigée(s)` : "aucune rédaction valide" };
}
