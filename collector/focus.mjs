// What's Going On? — « Briefing du jour » : les grandes histoires du moment (sur 7 jours, pas seulement du jour),
// chacune avec un titre, 3 puces (détail, contexte, implications) et ses sources. Aucune dépendance.
import { hasNumberWords, digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";

const H = 3600e3, DAY = 24 * H;

function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
}
function shared(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; return i; }
function sim(a, b) { const i = shared(a, b); return i >= 3 ? i / (a.size + b.size - i) : 0; }
function overlap(a, b) { const i = shared(a, b); return i >= 2 ? i / Math.min(a.size, b.size) : 0; }

/**
 * Regroupe les articles récents qui parlent du même sujet. Une « histoire » = un groupe ;
 * elle monte avec l'importance, le nombre de médias différents qui la couvrent et sa fraîcheur (lente : 8 points perdus en 4 jours).
 */
export function pickStories(items, now, n = 5) {
  let pool = items.filter((i) => !i.pending && now - Date.parse(i.ts) < 7 * DAY && Date.parse(i.ts) < now + H && i.importance >= 2);
  if (pool.length < 8) pool = items.filter((i) => !i.pending && Date.parse(i.ts) < now + H && (now - Date.parse(i.ts) < 2 * DAY || (i.importance >= 2 && now - Date.parse(i.ts) < 7 * DAY)));
  const tok = new Map(pool.map((i) => [i.id, tokens(i.title + " " + (i.summary || ""))]));
  const groups = [];
  for (const it of [...pool].sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)))) {
    const g = groups.find((g) => sim(tok.get(it.id), tok.get(g.items[0].id)) >= 0.2 || g.items.some((o) => sim(tok.get(it.id), tok.get(o.id)) >= 0.35));
    if (g) g.items.push(it); else groups.push({ items: [it] });
  }
  const scored = groups.map((g) => {
    const arts = g.items.slice().sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)));
    const media = new Set(arts.map((a) => a.source));
    const newest = Math.max(...arts.map((a) => Date.parse(a.ts)));
    const score = arts[0].importance * 10 + Math.min(6, 1.5 * (media.size - 1)) + Math.max(0, 8 - ((now - newest) / H) / 12) + (arts.some((a) => a.confidence === "haute") ? 2 : 0);
    return { lead: arts[0], items: arts, media: media.size, newest, score };
  }).sort((a, b) => b.score - a.score);
  // choix glouton : un léger malus pour un sujet de même catégorie déjà retenu (la couverture prime, sans l'imposer)
  const out = [];
  while (out.length < n && scored.length) {
    let bi = 0, bs = -1e9;
    scored.forEach((x, k) => { const sc = x.score - 2.5 * out.filter((o) => o.lead.category === x.lead.category).length; if (sc > bs) { bs = sc; bi = k; } });
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

export const FOCUS_SYSTEM = `Tu rédiges le « Briefing du jour » d'un site d'actualité sur l'intelligence artificielle et son économie, pour un lecteur non spécialiste. On te donne des histoires numérotées (i) ; chacune regroupe des articles récents sur le même sujet (articles : a, title, summary, source, date) et parfois des articles plus anciens (background : j).
Pour chaque histoire, renvoie en français :
- head : le titre principal, une phrase d'actualité claire, 110 caractères maximum, sans point final.
- b1 : ce qui s'est passé, avec les faits précis des articles. 200 caractères maximum.
- b2 : ce qu'il faut savoir de ce qui s'est passé avant, d'après UNIQUEMENT le background (indique les numéros j utilisés dans ctx). S'il n'y a pas de background, donne à la place un second fait distinct tiré des articles. N'écris jamais « Contexte », « Avant » ni aucun mot qui annonce le contexte : va droit au fait. 200 caractères maximum.
- b3 : ce que cela implique ou laisse penser, ton interprétation prudente (« cela pourrait », « cela montre que »), sans prédiction chiffrée ni conseil d'investissement. 200 caractères maximum.
- head_en, b1_en, b2_en, b3_en : les mêmes textes traduits fidèlement en anglais.
Règles impératives :
- Les trois puces apportent trois informations différentes et ne répètent pas le titre.
- N'utilise AUCUN chiffre, date, nom propre ou fait absent des articles fournis. N'invente rien, ne complète pas avec tes connaissances.
- Écris tous les nombres en chiffres, jamais en toutes lettres.
- Pas d'opinion politique : décris les positions des acteurs sans prendre parti.
Réponds uniquement par un tableau JSON, un objet par histoire, avec le même champ i.`;

export const FOCUS_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" }, head: { type: "STRING" }, b1: { type: "STRING" }, b2: { type: "STRING" }, b3: { type: "STRING" }, ctx: { type: "ARRAY", items: { type: "INTEGER" } },
      head_en: { type: "STRING" }, b1_en: { type: "STRING" }, b2_en: { type: "STRING" }, b3_en: { type: "STRING" },
    },
    required: ["i", "head", "b1", "b2", "b3", "ctx", "head_en", "b1_en", "b2_en", "b3_en"],
  },
};

const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
const LIM = { head: 130, b: 260 };

/** Garde chaque histoire dont aucun chiffre n'est absent des articles fournis ; l'anglais est retiré s'il ne suit pas. */
export function validateStories(arr, inputs, diag = []) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const r of arr) {
    const inp = inputs.find((x) => x.i === Number(r?.i));
    if (!inp) { diag.push("numéro d'histoire inconnu"); continue; }
    const bg = inp.background || [];
    const ctx = [...new Set((Array.isArray(r.ctx) ? r.ctx : []).map(Number))].filter((j) => bg.some((b) => b.j === j));
    const own = inp.articles.map((a) => `${a.title} ${a.summary}`).join(" ");
    const poolAll = new Set(digitsOf(own + " " + bg.map((b) => `${b.title} ${b.summary}`).join(" ")));
    const head = clean(r.head), bullets = [clean(r.b1), clean(r.b2), clean(r.b3)];
    if (!head || head.length > LIM.head || bullets.some((b) => !b || b.length > LIM.b)) { diag.push(`histoire ${inp.i} : texte vide ou trop long (titre ${head.length}, puces ${bullets.map((b) => b.length).join("/")})`); continue; }
    const bad = [head, ...bullets].find((t) => hasNumberWords(t) || foreignScript(t) || digitsOf(t).some((d) => !poolAll.has(d)));
    if (bad) { diag.push(`histoire ${inp.i} : nombre ou écriture non conforme (« ${bad.slice(0, 60)} »)`); continue; }
    const en = [clean(r.head_en), clean(r.b1_en), clean(r.b2_en), clean(r.b3_en)];
    const enOk = en.every((t, k) => t && t.length <= (k ? LIM.b + 40 : LIM.head + 20) && !foreignScript(t) && digitsOf(t).every((d) => poolAll.has(d)));
    out.push({ i: inp.i, head, bullets, ctx, head_en: enOk ? en[0] : null, bullets_en: enOk ? en.slice(1) : null });
  }
  return out.length ? out : null;
}

/**
 * Produit focus.json (le briefing). `generate(inputs)` appelle le modèle (ou null si indisponible).
 * Régénéré si les histoires retenues ou leurs articles changent, ou si le document a plus de 6 h ; sinon le précédent est conservé.
 */
export async function makeFocus({ items, now, prev, generate, modelName }) {
  const stories = pickStories(items, now);
  const sig = stories.map((s) => s.items.map((a) => a.id).sort().join("+"));
  const base = prev && Array.isArray(prev.stories) ? prev : { generated_at: null, model: null, sig: [], stories: [] };
  if (!stories.length) return { doc: base, regenerated: false, reason: "aucune histoire importante" };
  const same = base.stories.length && Array.isArray(base.sig) && sig.length === base.sig.length && sig.every((x, k) => base.sig[k] === x);
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
  const ok = validateStories(res, inputs, diag);
  if (!ok) return { doc: base, regenerated: false, reason: res ? "briefing rejeté : " + (diag.slice(0, 3).join(" ; ") || (Array.isArray(res) ? "réponse vide" : "réponse invalide")) : "Gemini indisponible : dernier briefing conservé" };
  const keep = ok.sort((a, b) => a.i - b.i);
  return {
    doc: {
      generated_at: new Date(now).toISOString(), model: modelName ? modelName() : null, sig,
      stories: keep.map((r) => {
        const s = stories[r.i - 1], inp = inputs[r.i - 1], media = new Set(), ids = [];
        for (const a of s.items) { if (media.has(a.source)) continue; media.add(a.source); ids.push(a.id); if (ids.length >= 4) break; }
        return { ids, head: r.head, bullets: r.bullets, head_en: r.head_en, bullets_en: r.bullets_en, ctx_ids: r.ctx.map((j) => inp.background.find((b) => b.j === j).id), ts: new Date(s.newest).toISOString() };
      }),
    },
    regenerated: true, reason: "briefing régénéré",
  };
}
