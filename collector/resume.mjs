// Résumé du jour : un court paragraphe de synthèse rédigé par l'IA à partir des actualités regroupées, des déclarations et des posts X.
// Régénéré environ 2 fois par jour (au plus une fois toutes les `everyH` heures) ; sinon le précédent est conservé, tant qu'il est récent.
import { digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";

export const RESUME_RULES = { everyH: 11, maxAgeH: 30, hours: 24, stories: 10, voix: 3, xPosts: 4, minStories: 2, min: 300, max: 1000, upcoming: 3, version: 2 };

export const RESUME_SYSTEM = `Tu rédiges, pour un site d'actualité sur l'intelligence artificielle, le résumé du jour : UN seul paragraphe de synthèse, neutre et factuel, pour un lecteur pressé qui n'est pas spécialiste.
Tu reçois les actualités des dernières 24 h (histoires déjà rédigées, avec le nombre de médias qui les reprennent et leur importance), des déclarations de dirigeants, des posts d'experts sur X et les prochains rendez-vous du calendrier. Renvoie :
- fr : un paragraphe en français de 4 à 6 phrases (550 à 900 caractères) ;
- en : le même paragraphe en anglais.
Comment l'écrire :
1. Choisis 4 ou 5 actualités AU MAXIMUM, les plus importantes (beaucoup de médias, importance élevée, conséquences larges). Laisse les autres de côté : ne fais jamais l'inventaire des titres.
2. Ouvre par l'actualité la plus importante et dis en quoi elle compte : l'enjeu, ce qu'elle change ou ce qu'elle confirme, en t'appuyant uniquement sur les détails fournis.
3. Regroupe celles qui vont ensemble (même acteur, même tension, même secteur) et relie-les par un lien explicite (cause, conséquence, contraste, « dans le même temps »). Si deux actualités n'ont rien en commun, ne force pas le lien : traite la seconde en une courte phrase.
4. Remets en contexte quand les données le permettent : un rendez-vous à venir (« avant les résultats de… »), une déclaration qui éclaire un fait. N'invente aucun contexte absent des données.
5. Pour une déclaration ou un post, nomme son auteur (« selon… », « X affirme que… »). Écris un français fluide, jamais télégraphique.
Règles : n'utilise que les informations fournies ; aucun chiffre, nom, société ou date absent des textes ; écris les nombres en chiffres ; aucun conseil, aucune prédiction, aucun jugement, aucune formule accrocheuse ; pas de liste, pas de titre, pas de markdown. ${UNITS_RULE} Réponds uniquement par un tableau JSON d'un seul objet avec les champs i (toujours 0), fr et en.`;
export const RESUME_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, fr: { type: "STRING" }, en: { type: "STRING" } }, required: ["i", "fr", "en"] },
};
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");

/** Matière première : histoires regroupées (les plus couvertes d'abord), déclarations du jour, posts X importants. */
export function resumeInputs({ stories, voix, x, now, outlook }) {
  const R = RESUME_RULES, since = now - R.hours * 36e5;
  const st = (stories?.stories || [])
    .filter((s) => s.head && s.summary && Date.parse(s.ts) >= since)
    .sort((a, b) => (b.media - a.media) || (b.imp - a.imp) || b.ts.localeCompare(a.ts))
    .slice(0, R.stories).map((s) => ({ titre: s.head, detail: s.summary, medias: s.media, importance: s.imp }));
  const vx = (voix?.hot || []).slice(0, R.voix).map((h) => ({ personne: h.n, role: h.role, declaration: h.title_fr || h.title }));
  const xs = (x?.items || [])
    .filter((p) => (p.priority === "P1" || p.priority === "P2") && p.title && Date.parse(p.ts) >= since)
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)).slice(0, R.xPosts).map((p) => ({ post: p.title }));
  const today = new Date(now).toISOString().slice(0, 10);
  const next = (outlook?.catalysts || []).filter((c) => c.title && c.date && String(c.date) >= today).slice(0, R.upcoming).map((c) => ({ date: c.label || c.date, evenement: c.title, detail: String(c.detail || "").slice(0, 220) }));
  return { actualites: st, declarations: vx, posts_x: xs, prochains_rendez_vous: next };
}

/** Renvoie { doc, reason, regenerated } ; `doc` reste le précédent si rien ne justifie une nouvelle rédaction ou si la rédaction échoue. */
export async function buildResume({ prev, stories, voix, x, now, generate, outlook }) {
  const R = RESUME_RULES, age = prev?.generated_at ? (now - Date.parse(prev.generated_at)) / 36e5 : Infinity;
  if (prev?.text && prev.v === R.version && age < R.everyH) return { doc: prev, regenerated: false, reason: `à jour (${age.toFixed(1)} h)` };
  const inp = resumeInputs({ stories, voix, x, now, outlook });
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
  const doc = { v: R.version, generated_at: new Date(now).toISOString(), text: normalizeFr(all, fr), n: inp.actualites.length };
  if (en.length >= R.min && en.length <= R.max + 120 && !foreignScript(en) && ok(en, "en")) doc.text_en = en;
  return { doc, regenerated: true, reason: `rédigé à partir de ${inp.actualites.length} actualité(s), ${inp.declarations.length} déclaration(s), ${inp.posts_x.length} post(s) X` };
}
