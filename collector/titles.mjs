// Titres tronqués à la source : certains médias (Times of India, Benzinga) coupent eux-mêmes leurs titres à 105 caractères dans le flux Google News,
// parfois au milieu d'un mot (« … At this point, I don't kn »). Leur page est fermée aux robots (HTTP 403), le titre complet n'est donc pas récupérable :
// on le termine proprement au dernier mot entier, avec « … », et on le marque (`cut`) pour qu'il soit traduit tel quel.
export const CUT_LEN = 105;
export const CUTTERS = /^(?:the\s+)?(?:times of india|benzinga)$/i;

/** Vrai si le titre vient d'un média connu pour couper à 105 caractères et a exactement cette longueur. */
export const isCutTitle = (title, source) => CUTTERS.test(String(source || "").trim()) && String(title || "").length === CUT_LEN && !/[….!?]$/.test(String(title).trim());

/** Retire le dernier mot (probablement coupé), la ponctuation pendante, et ajoute « … ». */
export function trimCut(title) {
  const t = String(title).trim(), i = t.lastIndexOf(" ");
  const base = (i > 30 ? t.slice(0, i) : t).replace(/[\s,;:–—\-(]+$/, "");
  return base + "…";
}

/** Marque et raccourcit sur place un élément {title, source} ; sans effet s'il l'est déjà ou s'il n'est pas tronqué. Renvoie l'élément. */
export function markCut(it) {
  if (!it || it.cut || !isCutTitle(it.title, it.source)) return it;
  it.title = trimCut(it.title); it.cut = 1;
  if ("title_fr" in it) it.title_fr = ""; // la traduction de l'ancien titre ne vaut plus
  return it;
}

/** Garantit que la traduction d'un titre raccourci se termine, elle aussi, par « … ». */
export const withCutMark = (it, fr) => (it.cut && !/…$/.test(fr) ? fr.replace(/[\s.,;:]+$/, "") + "…" : fr);
