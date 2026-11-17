// What's Going On? — titres toujours en français (écriture latine) et version anglaise des articles. Aucune dépendance.
import { digitsOf } from "./brief.mjs";

const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ฀-๿぀-ヿ㐀-鿿가-힯]/gu;

/** Part des lettres écrites dans une écriture non latine (chinois, arabe, russe, japonais, coréen…). */
export function nonLatinShare(s) {
  const letters = String(s || "").match(/\p{L}/gu) || [];
  return letters.length ? (String(s).match(NON_LATIN) || []).length / letters.length : 0;
}
export const foreignScript = (s) => nonLatinShare(s) > 0.3;

export const TRANSLATE_SYSTEM = `Tu prépares les textes d'un site d'actualité sur l'intelligence artificielle, en français et en anglais. Pour chaque article (i, title = titre actuel, orig = titre d'origine, summary = résumé en français, why = phrase d'explication en français, peut être vide), renvoie :
- title_fr : le titre en français. Si title est déjà en français (écriture latine), recopie-le à l'identique. Sinon, traduis orig en français. Jamais en chinois, japonais, coréen, arabe, russe ou autre écriture non latine.
- title_en : le titre en anglais, fidèle à orig.
- summary_en : le résumé traduit fidèlement en anglais (chaîne vide si summary est vide).
- why_en : why traduit fidèlement en anglais (chaîne vide si why est vide).
Règles : n'ajoute aucun chiffre, date ou nom absent des textes fournis ; écris les nombres en chiffres.
Réponds uniquement par un tableau JSON, un objet par article, avec le même champ i.`;

export const TRANSLATE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { i: { type: "INTEGER" }, title_fr: { type: "STRING" }, title_en: { type: "STRING" }, summary_en: { type: "STRING" }, why_en: { type: "STRING" } },
    required: ["i", "title_fr", "title_en", "summary_en", "why_en"],
  },
};

const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Un article demande un passage si son titre est dans une autre écriture, ou s'il n'a pas encore de version anglaise. */
export const needsTranslation = (it) => !it.pending && (foreignScript(it.title) || !it.title_en);

/** Applique la réponse du modèle ; chaque champ n'est gardé que si ses chiffres viennent des textes d'origine. */
export function applyTranslations(arr, inputs, byIdx) {
  if (!Array.isArray(arr)) return 0;
  let n = 0;
  for (const r of arr) {
    const inp = inputs.find((x) => x.i === Number(r?.i)); const it = inp && byIdx.get(inp.i);
    if (!it) continue;
    const pool = new Set(digitsOf(`${inp.title} ${inp.orig} ${inp.summary} ${inp.why}`));
    const ok = (s) => digitsOf(s).every((d) => pool.has(d));
    let touched = false;
    if (foreignScript(it.title)) {
      const t = clean(r.title_fr);
      if (t && t.length <= 220 && !foreignScript(t) && ok(t)) { it.title = t; touched = true; }
      else if (it.summary && !foreignScript(it.summary)) { // secours : le résumé français, déjà validé, sert de titre
        const first = clean(it.summary).split(/(?<=[.!?])\s/)[0];
        it.title = first.length <= 150 ? first.replace(/\.$/, "") : first.slice(0, 147).replace(/\s+\S*$/, "") + "…"; touched = true;
      }
    }
    const te = clean(r.title_en);
    if (te && te.length <= 240 && !foreignScript(te) && ok(te)) {
      it.title_en = te; touched = true;
      const se = clean(r.summary_en), we = clean(r.why_en);
      if (se && se.length <= 400 && !foreignScript(se) && ok(se)) it.summary_en = se;
      if (we && it.why && we.length <= 320 && !foreignScript(we) && ok(we)) it.why_en = we;
    }
    if (touched) n++;
  }
  return n;
}

/**
 * Traduit au plus `max` articles par appel, les plus récents d'abord ; titres non latins en priorité.
 * `generate(inputs)` appelle le modèle (ou renvoie null s'il est indisponible). Renvoie le nombre d'articles modifiés.
 */
export async function translateMissing({ items, generate, max = 40, rounds = 1 }) {
  if (!generate) return { changed: 0, reason: "Gemini indisponible" };
  let changed = 0, left = 0;
  for (let r = 0; r < rounds; r++) {
    const todo = items.filter(needsTranslation).sort((a, b) => (foreignScript(b.title) - foreignScript(a.title)) || b.ts.localeCompare(a.ts));
    left = todo.length;
    if (!todo.length) break;
    const batch = todo.slice(0, max);
    const inputs = batch.map((it, i) => ({ i, title: it.title, orig: it.orig || it.title, summary: it.summary || "", why: it.why || "" }));
    const byIdx = new Map(batch.map((it, i) => [i, it]));
    let res = null;
    try { res = await generate(inputs); } catch { res = null; }
    if (!res) return { changed, reason: "Gemini indisponible" };
    const n = applyTranslations(res, inputs, byIdx);
    changed += n;
    if (!n) break;
  }
  return { changed, reason: changed ? `${changed} articles traduits` : "rien à traduire", left: items.filter(needsTranslation).length || left };
}
