// Résumé du jour : un court paragraphe de synthèse rédigé par l'IA à partir des actualités regroupées, des déclarations et des posts X.
// Régénéré environ 2 fois par jour (au plus une fois toutes les `everyH` heures) ; sinon le précédent est conservé, tant qu'il est récent.
import { digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";

export const RESUME_RULES = { everyH: 11, maxAgeH: 30, hours: 24, stories: 8, voix: 3, xPosts: 4, minStories: 2, min: 220, max: 900 };

export const RESUME_SYSTEM = `Tu rédiges, pour un site d'actualité sur l'intelligence artificielle, le résumé du jour : UN seul paragraphe de synthèse, neutre et factuel, pour un lecteur pressé.
Tu reçois les actualités des dernières 24 h (histoires déjà rédigées, déclarations de dirigeants, posts d'experts sur X). Renvoie :
- fr : un paragraphe en français de 3 à 5 phrases (500 à 800 caractères), qui dit l'essentiel : les 3 ou 4 faits qui comptent le plus aujourd'hui, reliés si un lien existe. Pour une déclaration ou un post, nomme son auteur (« selon… », « X affirme que… »).
- en : le même paragraphe en anglais.
Règles : n'utilise que les informations fournies ; aucun chiffre, nom, société ou date absent des textes ; écris les nombres en chiffres ; aucun conseil, aucune prédiction, aucun jugement, aucune formule accrocheuse ; pas de liste, pas de titre, pas de markdown. ${UNITS_RULE} Réponds uniquement par un tableau JSON d'un seul objet avec les champs i (toujours 0), fr et en.`;
export const RESUME_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, fr: { type: "STRING" }, en: { type: "STRING" } }, required: ["i", "fr", "en"] },
};
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Matière première : histoires regroupées (les plus couvertes d'abord), déclarations du jour, posts X importants. */
export function resumeInputs({ stories, voix, x, now }) {
  const R = RESUME_RULES, since = now - R.hours * 36e5;
  const st = (stories?.stories || [])
    .filter((s) => s.head && s.summary && Date.parse(s.ts) >= since)
    .sort((a, b) => (b.media - a.media) || (b.imp - a.imp) || b.ts.localeCompare(a.ts))
    .slice(0, R.stories).map((s) => ({ titre: s.head, detail: s.summary, medias: s.media }));
  const vx = (voix?.hot || []).slice(0, R.voix).map((h) => ({ personne: h.n, role: h.role, declaration: h.title_fr || h.title }));
  const xs = (x?.items || [])
    .filter((p) => (p.priority === "P1" || p.priority === "P2") && p.title && Date.parse(p.ts) >= since)
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)).slice(0, R.xPosts).map((p) => ({ post: p.title }));
  return { actualites: st, declarations: vx, posts_x: xs };
}

/** Renvoie { doc, reason, regenerated } ; `doc` reste le précédent si rien ne justifie une nouvelle rédaction ou si la rédaction échoue. */
export async function buildResume({ prev, stories, voix, x, now, generate }) {
  const R = RESUME_RULES, age = prev?.generated_at ? (now - Date.parse(prev.generated_at)) / 36e5 : Infinity;
  if (prev?.text && age < R.everyH) return { doc: prev, regenerated: false, reason: `à jour (${age.toFixed(1)} h)` };
  const inp = resumeInputs({ stories, voix, x, now });
  if (inp.actualites.length < R.minStories) return { doc: prev && age < R.maxAgeH ? prev : null, regenerated: false, reason: "pas assez d'actualités récentes" };
  if (!generate) return { doc: prev && age < R.maxAgeH ? prev : null, regenerated: false, reason: "Gemini indisponible" };
  let res = null;
  try { res = await generate([{ i: 0, ...inp }]); } catch { res = null; }
  const r = Array.isArray(res) ? res.find((o) => Number(o?.i) === 0) || res[0] : null;
  const keepPrev = (reason) => ({ doc: prev && age < R.maxAgeH ? prev : null, regenerated: false, reason });
  if (!r) return keepPrev("Gemini indisponible");
  const all = JSON.stringify(inp);
  const pool = new Set(digitsOf(stripAmounts(all)));
  const ok = (t, lang) => digitsOf(stripAmounts(t)).every((d) => pool.has(d)) && unitsOk(all, t, lang, false);
  const fr = clean(r.fr), en = clean(r.en);
  if (fr.length < R.min || fr.length > R.max || foreignScript(fr) || !ok(fr, "fr")) return keepPrev("rédaction rejetée (longueur, écriture ou chiffres)");
  const doc = { v: 1, generated_at: new Date(now).toISOString(), text: normalizeFr(all, fr), n: inp.actualites.length };
  if (en.length >= R.min && en.length <= R.max + 120 && !foreignScript(en) && ok(en, "en")) doc.text_en = en;
  return { doc, regenerated: true, reason: `rédigé à partir de ${inp.actualites.length} actualité(s), ${inp.declarations.length} déclaration(s), ${inp.posts_x.length} post(s) X` };
}
