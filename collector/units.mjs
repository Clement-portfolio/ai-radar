// What's Going On? — garde-fou sur les ordres de grandeur (million / milliard / « trillion ») entre un texte et sa traduction.
// Piège : « trillion » anglais = 10^12 = « billion » français ; « billion » anglais = 10^9 = « milliard » français.
// Règle du site : en français on n'écrit jamais « billion » ni « trillion » (ambigus), toujours « milliards » (1,5 tn$ = 1 500 milliards).
// Aucune dépendance.

const NUM_EN = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?`;
const NUM_FR = String.raw`(\d{1,3}(?:[\s  ]\d{3})+|\d+)(?:[.,](\d+))?`;
const SP = String.raw`[\s  ]`;
const EN1 = () => new RegExp(String.raw`(?<![\d.,])${NUM_EN}\s?-?(trillion|billion|million|tn|bn|mn)s?\b`, "gi");
const EN2 = () => new RegExp(String.raw`[$€£¥]\s?${NUM_EN}\s?([mbt])\b`, "gi");
const FR1 = () => new RegExp(String.raw`(?<![\d.,])${NUM_FR}${SP}?(trillions?|billions?|milliards?|millions?|Mds?)\b`, "gi");
const FR2 = () => new RegExp(String.raw`(?<![\d.,])${NUM_FR}${SP}?(T)\s?[$€£¥]`, "g");

const SCALE_EN = { trillion: 1e12, tn: 1e12, billion: 1e9, bn: 1e9, million: 1e6, mn: 1e6, t: 1e12, b: 1e9, m: 1e6 };
const SCALE_FR = { trillion: 1e18, billion: 1e12, milliard: 1e9, md: 1e9, million: 1e6, t: 1e12 };
const AMBIG = /\b(?:billions?|trillions?)\b/i;

const FR_WORDS = /(?<![\p{L}])(le|la|les|des|du|de|et|pour|dans|sur|avec|est|une|un|au|aux|en|par|qui|que)(?![\p{L}])/giu;
const EN_WORDS = /(?<![\p{L}])(the|of|and|to|in|for|on|with|is|at|by|as|its|that|from|after|says)(?![\p{L}])/giu;
/** « fr » si le texte est plutôt français, sinon « en » (suffisant pour choisir le sens de « billion »). */
export const langOf = (s) => ((String(s).match(FR_WORDS) || []).length > (String(s).match(EN_WORDS) || []).length ? "fr" : "en");

const toNum = (int, dec, fr) => parseFloat(String(int).replace(fr ? /[\s  ]/g : /,/g, "") + (dec ? "." + dec : ""));

function scan(text, lang) {
  const t = String(text), out = [];
  const push = (m, scale) => out.push({ start: m.index, end: m.index + m[0].length, value: toNum(m[1], m[2], lang === "fr") * scale, word: m[3] || "", raw: (m[1] + (m[2] || "")).replace(/\D/g, "") });
  if (lang === "fr") {
    for (const m of t.matchAll(FR1())) push(m, SCALE_FR[m[3].toLowerCase().replace(/s$/, "")]);
    for (const m of t.matchAll(FR2())) push(m, SCALE_FR.t);
  } else {
    for (const m of t.matchAll(EN1())) push(m, SCALE_EN[m[3].toLowerCase()] || SCALE_EN[m[3].toLowerCase().replace(/s$/, "")]);
    for (const m of t.matchAll(EN2())) push(m, SCALE_EN[m[3].toLowerCase()]);
  }
  return out;
}

/** Montants du texte, en millions (entiers), triés ; « 1.5tn » (EN) et « 1 500 milliards » (FR) donnent tous deux 1500000. */
export const amountsOf = (text, lang) => scan(text, lang).map((a) => Math.round(a.value / 1e6)).sort((x, y) => x - y);

/** Retire les montants avec unité (dans les deux langues) pour que la vérification des chiffres ne compare plus que dates, versions, pourcentages… */
export const stripAmounts = (s) => String(s)
  .replace(EN1(), " ").replace(EN2(), " ").replace(FR1(), " ").replace(FR2(), " ");

/**
 * La traduction `out` (en `outLang`) garde-t-elle les mêmes ordres de grandeur que `src` ?
 * - en français : « billion » / « trillion » interdits (sauf si la source est déjà en français) ;
 * - chaque montant de la traduction doit exister dans la source (même valeur) ;
 * - `strict` : la traduction doit aussi reprendre tous les montants de la source (titres).
 * Si la source n'a aucun montant lisible (chinois, arabe…), les chiffres du montant doivent au moins figurer dans la source.
 */
export function unitsOk(src, out, outLang, strict = false) {
  const sl = langOf(src);
  if (outLang === "fr" && sl !== "fr" && AMBIG.test(out)) return false;
  const a = amountsOf(src, sl), b = amountsOf(out, outLang);
  if (!b.length) return !(strict && a.length);
  if (!a.length) { // source illisible (chinois, arabe…) : les chiffres du montant doivent au moins venir de la source
    const nums = new Set(String(src).match(/\d[\d.,]*/g)?.map((x) => x.replace(/\D/g, "")) || []);
    return scan(out, outLang).every((x) => nums.has(x.raw));
  }
  const rest = [...a];
  for (const x of b) { const i = rest.indexOf(x); if (i < 0) return false; rest.splice(i, 1); }
  return !strict || rest.length === 0;
}

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function fmtFr(valueM) { // valeur en millions → « 1 500 milliards » / « 1,5 milliard » / « 300 millions »
  const bn = valueM / 1000;
  if (bn >= 1) {
    const r = Math.round(bn * 100) / 100, [i, d] = String(r).split(".");
    return `${group(i)}${d ? "," + d : ""} milliard${r >= 2 ? "s" : ""}`;
  }
  return `${group(valueM)} million${valueM >= 2 ? "s" : ""}`;
}

/**
 * Réécrit en « milliards » les « billion(s) » / « trillion(s) » d'une traduction française quand leur valeur correspond
 * bien à un montant de la source (1,5 billion = 1,5 tn$ → « 1 500 milliards »). Un montant qui ne correspond à rien n'est pas touché (il sera refusé).
 */
export function normalizeFr(src, out) {
  const known = new Set(amountsOf(src, langOf(src)));
  const o = String(out);
  const hits = scan(o, "fr").filter((a) => /^(billion|trillion)/i.test(a.word) && known.has(Math.round(a.value / 1e6)));
  let res = o;
  for (const a of hits.sort((x, y) => y.start - x.start)) res = res.slice(0, a.start) + fmtFr(Math.round(a.value / 1e6)) + res.slice(a.end);
  return res;
}

export const UNITS_RULE = "Ordres de grandeur : en anglais « trillion » (tn, T) = 1 000 milliards ; « billion » (bn, B) = 1 milliard. En français n'écris JAMAIS « billion » ni « trillion » (ambigus) : écris toujours en milliards (« $1.5tn » devient « 1 500 milliards de dollars » ; « $2bn » devient « 2 milliards de dollars » ; « $300m » devient « 300 millions de dollars »).";
