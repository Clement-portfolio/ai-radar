// What's Going On? — traduction anglaise des textes des pages de données (marché, couches, USA–Chine, courbes).
// Produit public/data/en.json : { "texte français exact": "English text" }. Aucune dépendance.
import { digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";

const FR_MARK = /[éèêàùôîçœâû]|(^|[^\p{L}])(le|la|les|des|du|un|une|et|en|sur|pour|par|qui|est|sont|ce|cette|plus|pas|dans|avec|au|aux|ou|ne|se|son|sa|ses|à|chaque|relayé|relayée|cité|fin|selon|entre|vers)(?![\p{L}])/iu;
const SKIP_KEYS = new Set(["url", "id", "d", "date", "as_of", "href", "u", "key", "kind", "color", "model"]);
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

/** Tous les textes français affichés par les pages de données (valeurs de chaînes, sans liens ni identifiants). */
export function collectStrings(docs) {
  const out = new Set();
  const walk = (o, k) => {
    if (typeof o === "string") {
      const s = norm(o);
      if (s.length >= 4 && !SKIP_KEYS.has(k) && !/^https?:\/\//.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s) && /\p{L}{3}/u.test(s) && FR_MARK.test(s)) out.add(s);
    } else if (Array.isArray(o)) o.forEach((x) => walk(x, k));
    else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) walk(v, kk);
  };
  for (const d of docs) walk(d, "");
  return out;
}

export const I18N_SYSTEM = `Tu traduis du français vers l'anglais des textes courts d'un site d'actualité sur l'intelligence artificielle (marché, puces, énergie, capex). Pour chaque texte (i, fr), renvoie en = la traduction anglaise fidèle, naturelle, sans rien ajouter ni retirer.
Règles : conserve exactement tous les chiffres, noms propres, sigles et symboles (≈, >, <, ↗, %, ·, —). Unités : « Md$ » devient « bn$ », « Md¥ » devient « bn¥ », « T$ » devient « tn$ », « M » (million) reste « M ». Les nombres français s'écrivent à l'anglaise (1,5 devient 1.5 ; 1 000 devient 1,000). Dates : « 15 oct. 2026 » devient « 15 Oct 2026 ». « T3 2026 » devient « Q3 2026 ».
Réponds uniquement par un tableau JSON, un objet par texte, avec le même champ i.`;
export const I18N_SCHEMA = { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, en: { type: "STRING" } }, required: ["i", "en"] } };

/** Une traduction est valide si elle garde les mêmes chiffres (dans le même ordre), reste en écriture latine et n'est pas vide. */
export function validEn(fr, en) {
  const e = norm(en);
  if (!e || e.length > fr.length * 2.5 + 40 || foreignScript(e)) return false;
  const a = digitsOf(fr), b = digitsOf(e);
  return a.length === b.length && a.every((x, k) => x === b[k]);
}

/**
 * Complète `prev` (texte → anglais) pour les textes encore absents, par lots ; renvoie le nouveau dictionnaire.
 * `generate(inputs)` appelle le modèle (ou null s'il est indisponible).
 */
export async function translateData({ docs, prev, generate, batch = 50, rounds = 3 }) {
  const dict = { ...(prev || {}) };
  const all = collectStrings(docs);
  const cleaned = Object.fromEntries(Object.entries(dict).filter(([k]) => all.has(k)));
  let todo = [...all].filter((s) => !(s in cleaned)).sort();
  const left0 = todo.length;
  let added = 0, reason = todo.length ? "" : "rien à traduire";
  if (todo.length && !generate) reason = "Gemini indisponible";
  for (let r = 0; r < rounds && todo.length && generate; r++) {
    const inputs = todo.slice(0, batch).map((fr, i) => ({ i, fr }));
    let res = null;
    try { res = await generate(inputs); } catch { res = null; }
    if (!Array.isArray(res)) { reason = "Gemini indisponible"; break; }
    let n = 0;
    for (const x of res) { const inp = inputs[Number(x?.i)]; if (inp && validEn(inp.fr, x.en)) { cleaned[inp.fr] = norm(x.en); n++; } }
    added += n;
    // un texte refusé ne bloque pas les suivants : on le retire de la file de ce passage
    const done = new Set(inputs.map((x) => x.fr));
    todo = todo.filter((s) => !done.has(s));
    if (!n) { reason = "aucune traduction valide"; break; }
  }
  if (!reason) reason = `${added} textes traduits`;
  const sorted = Object.fromEntries(Object.entries(cleaned).sort(([a], [b]) => a.localeCompare(b)));
  return { dict: sorted, added, left: Math.max(0, all.size - Object.keys(sorted).length), total: all.size, reason, changed: JSON.stringify(sorted) !== JSON.stringify(prev || {}), left0 };
}
