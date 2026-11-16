// What's Going On? — « Aujourd'hui » : les 5 actualités majeures du jour, en puces, avec « pourquoi c'est important »
// et une remise en contexte tirée UNIQUEMENT des articles déjà collectés. Aucune dépendance.
import { selectTop, hasNumberWords, digitsOf } from "./brief.mjs";

const H = 3600e3, DAY = 24 * H;

function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
}
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i >= 2 ? i / Math.min(a.size, b.size) : 0;
}

/** Jusqu'à n articles majeurs du jour : importance la plus haute d'abord, une seule place par catégorie. */
export function pickFocus(items, now, n = 5) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const top = selectTop(items, now, 15).map((t) => byId.get(t.id)).filter(Boolean);
  const ranked = top.filter((i) => i.importance >= 2).sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)));
  const out = [], cats = new Set();
  for (const it of ranked) { if (out.length >= n) break; if (cats.has(it.category) && ranked.length > n + 1) continue; cats.add(it.category); out.push(it); }
  // Politique et Finance doivent avoir leur place dès qu'une actualité notable existe (sans doublon d'un sujet déjà retenu)
  const must = ["politique", "capex"];
  for (const cat of must) {
    if (out.some((i) => i.category === cat)) continue;
    const cand = items.filter((i) => !i.pending && i.category === cat && i.importance >= 2 && now - Date.parse(i.ts) < 2 * DAY && !out.some((o) => overlap(tokens(o.title), tokens(i.title)) >= 0.35))
      .sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)))[0];
    if (!cand) continue;
    if (out.length >= n) { let k = out.length - 1; while (k >= 0 && must.includes(out[k].category)) k--; if (k < 0) continue; out.splice(k, 1); }
    out.push(cand);
  }
  return out.sort((a, b) => (b.importance - a.importance) || (Date.parse(b.ts) - Date.parse(a.ts)));
}

/** Articles plus anciens sur le même sujet (jusqu'à 4), pour la remise en contexte. */
export function relatedFor(it, items, now, max = 4) {
  const t0 = tokens(it.title + " " + it.summary), tt = Date.parse(it.ts);
  const scored = [];
  for (const o of items) {
    if (o.id === it.id || o.pending) continue;
    const to = Date.parse(o.ts);
    if (!(to < tt - 6 * H) || now - to > 120 * DAY) continue;
    const s = overlap(t0, tokens(o.title + " " + o.summary));
    if (s >= 0.25) scored.push({ o, s: s + (o.importance - 1) * 0.05 });
  }
  scored.sort((a, b) => b.s - a.s);
  const seen = new Set(), out = [];
  for (const { o } of scored) { const k = o.title.slice(0, 40); if (seen.has(k)) continue; seen.add(k); out.push(o); if (out.length >= max) break; }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

export const FOCUS_SYSTEM = `Tu es le rédacteur d'une page « À retenir » d'un site d'actualité sur l'intelligence artificielle et son économie, en français, pour un lecteur non spécialiste. On te donne jusqu'à 5 actualités majeures numérotées (i, title, summary, source, date), chacune avec des articles plus anciens sur le même sujet (background, numérotés j).
Pour chaque actualité, renvoie :
- why : UNE phrase courte (180 caractères maximum) qui dit pourquoi c'est important : l'enjeu, ce que cela change, pour qui. Français simple, sans jargon.
- context : UNE phrase courte (200 caractères maximum) qui remet en contexte : ce qui s'est passé avant, d'après UNIQUEMENT les articles du background. Si le background est vide, laisse la chaîne vide.
- ctx : les numéros j des articles du background utilisés pour le context.
Règles impératives :
- N'utilise AUCUN chiffre, date, nom propre ou fait absent des articles fournis. N'invente rien, ne complète pas avec tes connaissances.
- Écris tous les nombres en chiffres, jamais en toutes lettres.
- Pas de prédiction, aucune recommandation d'investissement, pas d'opinion politique.
Réponds uniquement par un tableau JSON, un objet par actualité, avec le même champ i.`;

export const FOCUS_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { i: { type: "INTEGER" }, why: { type: "STRING" }, context: { type: "STRING" }, ctx: { type: "ARRAY", items: { type: "INTEGER" } } },
    required: ["i", "why", "context", "ctx"],
  },
};

const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Garde, pour chaque actualité, le « pourquoi » et le contexte dont aucun nombre n'est absent des articles fournis. */
export function validateFocus(arr, inputs) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const r of arr) {
    const inp = inputs.find((x) => x.i === Number(r?.i));
    if (!inp) continue;
    const why = clean(r.why);
    const own = `${inp.title} ${inp.summary}`;
    const bg = inp.background || [];
    const pool = new Set(digitsOf(own + " " + bg.map((b) => `${b.title} ${b.summary}`).join(" ")));
    if (!why || why.length > 220 || hasNumberWords(why) || digitsOf(why).some((d) => !pool.has(d))) continue;
    let context = clean(r.context), ctx = [...new Set((Array.isArray(r.ctx) ? r.ctx : []).map(Number))].filter((j) => bg.some((b) => b.j === j));
    if (context) {
      const refs = new Set(digitsOf(bg.filter((b) => ctx.includes(b.j)).map((b) => `${b.title} ${b.summary}`).join(" ")));
      const ownDigits = new Set(digitsOf(own));
      if (!ctx.length || context.length > 260 || hasNumberWords(context) || digitsOf(context).some((d) => !refs.has(d) && !ownDigits.has(d))) { context = ""; ctx = []; }
    } else ctx = [];
    out.push({ i: inp.i, why, context, ctx });
  }
  return out.length ? out : null;
}

/**
 * Produit focus.json. `generate(inputs)` appelle le modèle (ou null si indisponible).
 * Régénéré si les actualités retenues changent ou si le document a plus de 6 h ; sinon le précédent est conservé.
 */
export async function makeFocus({ items, now, prev, generate, modelName }) {
  const picks = pickFocus(items, now);
  const ids = picks.map((p) => p.id);
  const base = prev && Array.isArray(prev.items) ? prev : { generated_at: null, model: null, picks: [], items: [] };
  if (!picks.length) return { doc: base, regenerated: false, reason: "aucune actualité majeure" };
  const same = base.items.length && Array.isArray(base.picks) && ids.length === base.picks.length && ids.every((id, k) => base.picks[k] === id);
  const age = base.generated_at ? now - Date.parse(base.generated_at) : Infinity;
  if (same && age <= 6 * H) return { doc: base, regenerated: false, reason: "actualités retenues inchangées" };
  if (!generate) return { doc: base, regenerated: false, reason: "Gemini indisponible : dernier « À retenir » conservé" };
  const inputs = picks.map((it, k) => ({
    i: k + 1, title: it.title, summary: it.summary || "", source: it.source, date: it.ts.slice(0, 10),
    background: relatedFor(it, items, now).map((o, m) => ({ j: m + 1, id: o.id, date: o.ts.slice(0, 10), title: o.title, summary: o.summary || "", source: o.source })),
  }));
  let res = null;
  try { res = await generate(inputs.map((x) => ({ ...x, background: x.background.map(({ id, ...b }) => b) }))); } catch { res = null; }
  const ok = validateFocus(res, inputs);
  if (!ok) return { doc: base, regenerated: false, reason: res ? "« À retenir » rejeté : texte non conforme aux articles" : "Gemini indisponible : dernier « À retenir » conservé" };
  return {
    doc: {
      generated_at: new Date(now).toISOString(), model: modelName ? modelName() : null, picks: ids,
      items: ok.map((r) => { const inp = inputs[r.i - 1]; return { id: picks[r.i - 1].id, why: r.why, context: r.context, ctx_ids: r.ctx.map((j) => inp.background.find((b) => b.j === j).id) }; }),
    },
    regenerated: true, reason: "« À retenir » régénéré",
  };
}
