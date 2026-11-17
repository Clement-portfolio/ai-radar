// AI Radar — sélection des « 10 essentiels » et brief du jour. Aucune dépendance.
const H = 3600e3;
const ZONES = ["US", "CN", "EU", "GULF"];

function tokens(t) {
  return new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}

/**
 * Les n articles essentiels : score = importance + fraîcheur + source primaire + couverture par plusieurs médias,
 * puis choix glouton avec diversité (une place par zone et par couche avant de compléter par le score).
 */
export function selectTop(items, now, n = 10) {
  let pool = items.filter((i) => !i.pending && now - Date.parse(i.ts) < 48 * H);
  if (pool.length < 20) pool = items.filter((i) => !i.pending && now - Date.parse(i.ts) < 5 * 24 * H);
  const toks = new Map(pool.map((i) => [i.id, tokens(i.title)]));
  let scored = pool.map((it) => {
    const media = new Set([it.source]);
    for (const o of pool) if (o !== it && jaccard(toks.get(it.id), toks.get(o.id)) >= 0.45) media.add(o.source);
    const ageH = (now - Date.parse(it.ts)) / H;
    const score = it.importance * 10 + Math.max(0, 6 - ageH / 8) + (it.confidence === "haute" ? 3 : 0) + Math.min(4, (media.size - 1) * 2);
    return { it, score, media: media.size };
  }).sort((a, b) => b.score - a.score);
  if (scored.filter((s) => s.it.importance >= 2).length >= n) scored = scored.filter((s) => s.it.importance >= 2);

  const picked = []; const zoneN = {}; const layerN = {};
  const can = (x) => !picked.some((p) => jaccard(toks.get(p.it.id), toks.get(x.it.id)) >= 0.45) && (zoneN[x.it.country] || 0) < 4 && (layerN[x.it.layer] || 0) < 3;
  const add = (x) => { picked.push(x); zoneN[x.it.country] = (zoneN[x.it.country] || 0) + 1; layerN[x.it.layer] = (layerN[x.it.layer] || 0) + 1; };
  for (const z of ZONES) { const x = scored.find((s) => s.it.country === z && can(s)); if (x && picked.length < n) add(x); }
  const layers = [...new Set(scored.map((s) => s.it.layer))].filter((l) => l !== "Autre");
  for (const l of layers) { if (picked.length >= n - 2) break; if (layerN[l]) continue; const x = scored.find((s) => s.it.layer === l && can(s) && !picked.includes(s)); if (x) add(x); }
  for (const x of scored) { if (picked.length >= n) break; if (!picked.includes(x) && can(x)) add(x); }
  return picked.sort((a, b) => b.score - a.score).map((x) => ({ id: x.it.id, score: Math.round(x.score * 10) / 10, media: x.media }));
}

export const BRIEF_SYSTEM = `Tu rédiges le brief du jour d'un radar d'actualité sur l'intelligence artificielle et son économie, en français. On te donne des articles numérotés (i, title, summary, source, country, layer).
Écris un briefing, comme un chroniqueur qui résume la journée à voix haute : un paragraphe continu de exactement 5 phrases enchaînées (connecteurs naturels : « Du côté de… », « Par ailleurs », « Enfin »), de la plus importante à la moins importante, dans un français simple et fluide. Chaque phrase est un objet du tableau : elles seront recollées dans l'ordre pour former le paragraphe.
- Chaque phrase : 240 caractères maximum, une seule idée, factuelle, fondée sur 1 à 3 articles, cités par leur numéro i dans le champ sources.
- N'utilise AUCUN chiffre, date, nom propre ou fait absent des articles cités. N'invente rien, ne complète pas avec tes connaissances.
- Écris tous les nombres en chiffres, jamais en toutes lettres (« 7 milliards de dollars », « 60 % », pas « sept milliards » ni « soixante pour cent »).
- Pas de prédiction, pas d'opinion, aucune recommandation d'investissement.
- Varie les sujets : ne consacre pas deux phrases à la même histoire.
- Aucune formule creuse (« Cela veut dire », « Cela signifie », « Autrement dit », « En clair ») : énonce directement le fait.
Réponds uniquement par un tableau JSON de 5 objets {text, sources}.`;

export const BRIEF_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { text: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["text", "sources"] },
};

/** Nombres écrits en toutes lettres (invérifiables) : numéraux, « pour cent », ou million/milliard sans chiffre devant. */
const NUM_WORDS = /(^|[^\p{L}])(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|quarante|cinquante|soixante|cents?|mille|dizaines?|centaines?|milliers)(?![\p{L}])/iu;
export function hasNumberWords(text) {
  const t = String(text).replace(/pour\s+cent/gi, "%").replace(/\d[\d.,\s]*(millions?|milliards?|billions?|trillions?)/gi, "N");
  return NUM_WORDS.test(t) || /(^|[^\p{L}])(millions?|milliards?|billions?|trillions?)(?![\p{L}])/iu.test(t);
}
export const digitsOf = (s) => (String(s).match(/\d[\d.,]*/g) || []).map((x) => x.replace(/[^\d]/g, "")).filter((x) => x.length);

/** Garde les puces dont les sources existent et dont aucun nombre n'est absent des articles cités. */
export function validateBullets(arr, inputs) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const b of arr) {
    const text = String(b?.text || "").trim();
    const src = [...new Set((Array.isArray(b?.sources) ? b.sources : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 1 && i <= inputs.length).slice(0, 3);
    if (!text || text.length > 280 || !src.length || hasNumberWords(text) || /\b(cela|ça)\s+(veut dire|signifie)\b|\b(autrement dit|en clair)\b/i.test(text)) continue;
    const ref = src.map((i) => `${inputs[i - 1].title} ${inputs[i - 1].summary}`).join(" ");
    const known = new Set(digitsOf(ref));
    if (digitsOf(text).some((d) => !known.has(d))) continue;
    out.push({ text, sources: src });
  }
  return out.length >= 3 ? out.slice(0, 5) : null;
}

/**
 * Produit le document brief.json. `generate(inputs)` appelle le modèle (ou null si indisponible).
 * Le brief n'est régénéré que si l'essentiel du jour a changé (3 articles ou plus) ou s'il a plus de 6 h.
 */
export async function makeBrief({ items, now, prev, generate, modelName }) {
  const top = selectTop(items, now);
  const ids = top.map((t) => t.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const base = { generated_at: prev?.generated_at || null, model: prev?.model || null, top, top_at_brief: prev?.top_at_brief || [], bullets: prev?.bullets || [], style: prev?.style || null };
  const prevTop = new Set(prev?.top_at_brief || []);
  const changed = ids.filter((id) => !prevTop.has(id)).length;
  const age = prev?.generated_at ? now - Date.parse(prev.generated_at) : Infinity;
  const need = !base.bullets.length || prev?.style !== "paragraph" || changed >= 3 || age > 6 * H;
  if (!top.length) return { doc: base, regenerated: false, reason: "aucun article récent" };
  if (!need) return { doc: base, regenerated: false, reason: "essentiel inchangé" };
  if (!generate) return { doc: base, regenerated: false, reason: "Gemini indisponible : dernier brief conservé" };
  const inputs = top.map((t, k) => { const it = byId.get(t.id); return { i: k + 1, title: it.title, summary: it.summary || "", source: it.source, country: it.country, layer: it.layer }; });
  let res = null;
  try { res = await generate(inputs); } catch { res = null; }
  const bullets = validateBullets(res, inputs);
  if (!bullets) return { doc: base, regenerated: false, reason: res ? "brief rejeté : puces non conformes aux articles" : "Gemini indisponible : dernier brief conservé" };
  return {
    doc: { style: "paragraph", generated_at: new Date(now).toISOString(), model: modelName ? modelName() : null, top, top_at_brief: ids, bullets: bullets.map((b) => ({ text: b.text, ids: b.sources.map((s) => ids[s - 1]) })) },
    regenerated: true, reason: "brief régénéré",
  };
}
