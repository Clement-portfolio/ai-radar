// What's Going On? — « Chiffres clés » de la Une : 3 chiffres, tirés UNIQUEMENT des articles collectés (jamais calculés ni de mémoire),
// chacun avec un petit texte de contexte. Règle de composition ancrée en dur (pickFigures) :
// au moins un chiffre des dernières 24 h s'il y en a, plus au moins un chiffre de la semaine ; sans chiffre du jour, 3 chiffres de la semaine ;
// pas assez de chiffres de la semaine, on complète avec le mois. Mise à jour une fois par jour. Aucune dépendance.
import { hasNumberWords, digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";

const H = 3600e3, DAY = 24 * H;
export const FIG_RULES = { count: 3, fromModel: 8, dayH: 24, weekD: 7, monthD: 31, maxArticles: 2, titleOverlap: 0.3 };

function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
}
function shared(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; return i; }
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
/** Chiffres d'un texte, en recollant les milliers (« 1 000 » = « 1,000 » = « 1000 ») pour comparer les écritures française et anglaise. */
const nd = (s) => digitsOf(String(s).replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, "$1"));

/** « day » (24 h), « week » (7 jours), « month » (31 jours) selon l'article le plus récent qui porte le chiffre ; null au-delà. */
export function scopeOf(ts, now) {
  const age = now - Date.parse(ts);
  if (!(age > -H)) return null;
  return age <= FIG_RULES.dayH * H ? "day" : age <= FIG_RULES.weekD * DAY ? "week" : age <= FIG_RULES.monthD * DAY ? "month" : null;
}

/** Articles récents (31 jours) importants, avec au moins un chiffre dans le titre ou le résumé : les plus frais d'abord. */
export function figureCandidates(items, now) {
  const pool = items.filter((i) => !i.pending && i.importance >= 2 && scopeOf(i.ts, now) && /\d/.test(`${i.title} ${i.summary || ""}`));
  const by = (sc) => pool.filter((i) => scopeOf(i.ts, now) === sc).sort((a, b) => (b.importance - a.importance) || b.ts.localeCompare(a.ts));
  return [...by("day").slice(0, 30), ...by("week").slice(0, 25), ...by("month").slice(0, 10)];
}

export const FIG_SYSTEM = `Tu choisis les « chiffres clés » d'un site d'actualité sur l'intelligence artificielle et son économie, pour un lecteur non spécialiste. On te donne des articles numérotés (a, date, title, summary, source).
Renvoie jusqu'à 8 chiffres clés, du plus marquant au moins marquant. Chaque chiffre est tiré d'un ou deux articles (ids = leurs numéros a) et mesure UNE chose : un résultat financier, un montant levé ou investi, un gain ou une perte de valeur en Bourse, une capacité, un volume, une part de marché, un nombre d'utilisateurs. Deux chiffres ne portent jamais sur le même sujet ni sur le même article. Préfère les chiffres des 24 dernières heures, mais renvoie aussi des chiffres plus anciens de la semaine et du mois. Certains articles sont des communiqués de résultats officiels d'entreprises, en anglais : pour un résultat d'entreprise, le chiffre vedette (value) est le CHIFFRE D'AFFAIRES du trimestre avec sa variation par rapport au TRIMESTRE PRÉCÉDENT (« Q/Q » dans le communiqué), jamais le bénéfice par action. Dans sub, donne d'abord la comparaison avec le trimestre précédent (montant précédent et variation) puis la variation sur un an ; le BPA n'est qu'un élément de contexte en fin de phrase. Si le communiqué ne donne pas la variation sur le trimestre précédent, utilise la variation sur un an. Écris en français.
Pour chacun, en français :
- title : ce que mesure le chiffre, 70 caractères maximum (ex. « Nvidia : revenus du trimestre »).
- value : le chiffre tel qu'il est écrit dans l'article, avec son unité, 40 caractères maximum (ex. « 115,8 Md$ » ou « +4 % »). Écris toujours les montants avec l'unité abrégée (« Md$ », « M$ », « Md€ », « M€ »), jamais « milliards de dollars » en toutes lettres.
- sub : une ou deux phrases de contexte ou de détail, 230 caractères maximum, qui apprennent quelque chose que title et value ne disent pas (comparaison, attentes, cause, période). Ne répète pas le titre.
- title_en, value_en, sub_en : les mêmes textes traduits fidèlement en anglais.
Règles impératives :
- value doit figurer dans le titre ou le résumé d'un article cité. Ne calcule rien toi-même (pas de somme, de différence ni de pourcentage).
- N'utilise AUCUN autre chiffre, date, nom propre ou fait absent des articles cités. N'invente rien, ne complète pas avec tes connaissances.
- Écris tous les nombres en chiffres, jamais en toutes lettres.
- Aucune formule d'introduction (« Cela veut dire », « Cela montre », « Autrement dit »). Pas d'opinion, de prédiction ni de conseil d'investissement.
Réponds uniquement par un tableau JSON.`;

export const FIG_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" }, value: { type: "STRING" }, sub: { type: "STRING" }, ids: { type: "ARRAY", items: { type: "INTEGER" } },
      title_en: { type: "STRING" }, value_en: { type: "STRING" }, sub_en: { type: "STRING" },
    },
    required: ["title", "value", "sub", "ids", "title_en", "value_en", "sub_en"],
  },
};

const FILLER = /^\s*(cela|ça)\s+(veut|signifie|montre|laisse|pourrait|suggère|indique|prouve|confirme|illustre|souligne)\b|^\s*(autrement dit|en clair|concrètement|en résumé|bref)\b|^\s*(this|that)\s+(means|shows|suggests|could|might|indicates)\b|^\s*(in other words|in short|basically)\b/i;

/**
 * Valide les chiffres renvoyés par le modèle. Un chiffre est écarté s'il : cite un article inconnu, a une valeur sans chiffre ou dont les chiffres
 * ne figurent pas dans les articles cités, contient dans ses textes un nombre absent de ces articles (ou en toutes lettres), a un sous-texte qui répète
 * le titre, vient d'articles de plus de 31 jours, ou double un chiffre déjà retenu (même article, même valeur ou même sujet).
 * `inputs` : les articles envoyés au modèle ({a, id, ts, title, summary, source, url, conf}).
 */
export function validateFigures(arr, inputs, now, diag = []) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  arr.forEach((r, k) => {
    const ids = [...new Set((Array.isArray(r?.ids) ? r.ids : []).map(Number))].filter((a) => inputs.some((x) => x.a === a)).slice(0, FIG_RULES.maxArticles);
    const arts = ids.map((a) => inputs.find((x) => x.a === a));
    const title = clean(r?.title), value = compactMoney(clean(r?.value)), sub = clean(r?.sub);
    const tag = `chiffre ${k + 1}`;
    if (!arts.length) return diag.push(`${tag} : aucun article cité valide`);
    if (!title || title.length > 80 || !value || value.length > 45 || !sub || sub.length > 260) return diag.push(`${tag} : texte vide ou trop long`);
    const pool = new Set(nd(arts.map((a) => `${a.title} ${a.summary}`).join(" ")));
    const vd = nd(value);
    if (!vd.length || vd.some((d) => !pool.has(d))) return diag.push(`${tag} : la valeur « ${value} » ne figure pas dans les articles cités`);
    const okText = (x) => !hasNumberWords(x) && !foreignScript(x) && nd(x).every((d) => pool.has(d));
    if (![title, sub].every(okText) || hasNumberWords(value) || FILLER.test(sub)) return diag.push(`${tag} : nombre ou écriture non conforme`);
    const tt = tokens(title);
    if (tt.size && 1 - shared(tokens(sub), tt) / Math.max(1, tokens(sub).size) < 0.5) return diag.push(`${tag} : le texte répète le titre`);
    const newest = arts.reduce((m, a) => (a.ts > m ? a.ts : m), arts[0].ts), scope = scopeOf(newest, now);
    if (!scope) return diag.push(`${tag} : articles trop anciens`);
    const idsReal = arts.map((a) => a.id);
    const dup = out.find((o) => o.ids.some((id) => idsReal.includes(id)) || o.vd === vd.join("-") || shared(tokens(o.title), tt) >= 2 && shared(tokens(o.title), tt) / Math.min(tokens(o.title).size, tt.size) >= FIG_RULES.titleOverlap);
    if (dup) return diag.push(`${tag} : double « ${dup.title.slice(0, 40)} »`);
    const en = { title_en: clean(r.title_en), value_en: clean(r.value_en), sub_en: clean(r.sub_en) };
    const enOk = en.title_en && en.value_en && en.sub_en && en.title_en.length <= 90 && en.sub_en.length <= 290 && [en.title_en, en.value_en, en.sub_en].every((x) => !foreignScript(x) && nd(x).every((d) => pool.has(d)));
    out.push({ k, title, value, sub, ids: idsReal, links: arts.filter((a) => a.url).map((a) => ({ t: a.source, u: a.url })), conf: arts.some((a) => a.conf === "haute") ? "haute" : "moyenne", scope, ts: newest, vd: vd.join("-"), title_en: enOk ? en.title_en : null, value_en: enOk ? en.value_en : null, sub_en: enOk ? en.sub_en : null });
  });
  return out.length ? out : null;
}

const SCOPE_RANK = { day: 0, week: 1, month: 2 };
/**
 * Compose les 3 chiffres selon la règle : avec au moins un chiffre des 24 h, on prend le meilleur chiffre du jour et le meilleur de la semaine
 * (à défaut du mois), puis on complète par les meilleurs jour/semaine ; sans chiffre du jour, ce sont 3 chiffres de la semaine ;
 * s'il en manque, on complète avec le mois. Affichage : jour, semaine, mois.
 */
export function pickFigures(valid, n = FIG_RULES.count) {
  const by = (sc) => valid.filter((f) => f.scope === sc).sort((a, b) => a.k - b.k);
  const day = by("day"), week = by("week"), month = by("month");
  const out = [];
  const take = (f) => { if (f && !out.includes(f) && out.length < n) out.push(f); };
  if (day.length) { take(day[0]); take(week[0] || month[0]); }
  for (const f of [...day, ...week].sort((a, b) => a.k - b.k)) take(f);
  for (const f of month) take(f);
  return out.sort((a, b) => (SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]) || (a.k - b.k));
}

/**
 * Produit chiffres.json. `generate(inputs)` appelle le modèle (ou null si indisponible). Une mise à jour par jour (jour UTC) : le document du jour
 * est conservé une fois complet (3 chiffres), sauf s'il n'a aucun chiffre des 24 h et a plus de 6 h (un chiffre du jour a pu arriver depuis).
 */
export async function makeFigures({ items, now, prev, generate, modelName }) {
  const day = new Date(now).toISOString().slice(0, 10);
  const base = prev && Array.isArray(prev.figures) ? prev : { v: 1, day: null, generated_at: null, model: null, figures: [] };
  const cands = figureCandidates(items, now);
  if (!cands.length) return { doc: base, regenerated: false, reason: "aucun article chiffré récent" };
  const age = base.generated_at ? now - Date.parse(base.generated_at) : Infinity;
  const hasDay = base.figures.some((f) => scopeOf(f.ts, now) === "day");
  if (base.v === 1 && base.day === day && base.figures.length === FIG_RULES.count && (hasDay || age <= 6 * H)) return { doc: base, regenerated: false, reason: "chiffres du jour déjà publiés" };
  if (!generate) return { doc: base, regenerated: false, reason: "Gemini indisponible : derniers chiffres conservés" };
  const inputs = cands.map((c, k) => ({ a: k + 1, id: c.id, ts: c.ts, title: c.title, summary: c.summary || "", source: c.source, url: c.url, conf: c.confidence }));
  let res = null;
  try { res = await generate(inputs.map(({ id, ts, url, conf, ...x }) => ({ ...x, date: ts.slice(0, 16).replace("T", " ") }))); } catch { res = null; }
  const diag = [];
  const valid = validateFigures(res, inputs, now, diag);
  if (!valid) return { doc: base, regenerated: false, reason: res ? "chiffres rejetés : " + (diag.slice(0, 3).join(" ; ") || "réponse vide") : "Gemini indisponible : derniers chiffres conservés" };
  const picked = pickFigures(valid);
  if (picked.length < FIG_RULES.count && base.day === day && base.figures.length > picked.length) return { doc: base, regenerated: false, reason: `seulement ${picked.length} chiffre(s) valide(s) : chiffres du jour conservés` };
  return {
    doc: { v: 1, day, generated_at: new Date(now).toISOString(), model: modelName ? modelName() : null, figures: picked.map(({ k, vd, ...f }) => f) },
    regenerated: true, reason: picked.length < FIG_RULES.count ? `chiffres régénérés (${picked.length} sur ${FIG_RULES.count})` : "chiffres régénérés",
  };
}

/** « 225 milliards de dollars » → « 225 Md$ », « 300 millions d'euros » → « 300 M€ » : une seule écriture des montants dans « Chiffres du jour ». */
export function compactMoney(v) {
  return String(v).replace(/(\d[\d\u00a0\u202f .,]*\d|\d)\s*(milliards?|millions?)\s+(?:de|d['’])\s*(dollars?|euros?)/gi, (_, n, u, c) => `${n.trim()} ${/^milliard/i.test(u) ? "Md" : "M"}${/^dollar/i.test(c) ? "$" : "€"}`);
}
