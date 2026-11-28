// Mode Finance : pour chaque société cotée de la chaîne IA qui a des chiffres SEC,
//  1) un libellé haussier / neutre / baissier PAR ARTICLE, toujours rattaché à la société nommée (jamais un libellé flottant) ;
//  2) trois scénarios (baissier / de base / haussier) bâtis uniquement sur des faits sourcés : chiffres SEC, articles libellés, contexte macro.
// Aucun objectif de cours, aucune probabilité, aucun conseil : chaque point renvoie à son article ou à son chiffre.
import { digitsOf } from "./brief.mjs";
import { foreignScript } from "./translate.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";
import { nameRe } from "./acteurs.mjs";

export const FIN_RULES = { days: 30, perCompany: 12, keepLabels: 40, labelBatch: 40, maxLabelCalls: 3, tries: 2, minLabeled: 3, minNew: 2, regenH: 20, maxCases: 6, whyMax: 140, pointMax: 170, pointsMax: 3, tone: 0.25, macro: 4 };
const STANCES = ["haussier", "neutre", "baissier"], SCOPES = ["societe", "secteur", "macro"];
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
const DAY = 864e5, HOUR = 36e5;

export const LABEL_SYSTEM = `Tu classes des articles de presse pour la page « Finance » d'un site sur l'infrastructure de l'intelligence artificielle. Pour chaque article (i, societe, titre, resume), juge ce qu'il implique pour l'activité de CETTE société (ses revenus, sa demande, ses coûts, ses risques, sa position concurrentielle), pas pour son cours de bourse.
Renvoie :
- stance : « haussier » si l'article apporte un élément favorable à l'activité de la société, « baissier » s'il apporte un élément défavorable, « neutre » s'il ne change rien de clair, s'il est mitigé ou s'il ne concerne pas la société de façon importante.
- scope : « societe » si l'article parle de la société elle-même, « secteur » s'il parle de son secteur ou de ses concurrents, « macro » s'il parle de l'économie, des taux, du commerce ou de la réglementation.
- why : une phrase française de 140 caractères au plus qui dit pourquoi, en reprenant uniquement ce que disent le titre et le résumé.
Règles : aucun chiffre, nom ou date absent du texte ; aucune prédiction ; en cas de doute, « neutre ». ${UNITS_RULE} Réponds uniquement par un tableau JSON, un objet par article, avec le même champ i.`;
export const LABEL_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, stance: { type: "STRING", enum: STANCES }, scope: { type: "STRING", enum: SCOPES }, why: { type: "STRING" } }, required: ["i", "stance", "scope", "why"] },
};

export const CASES_SYSTEM = `Tu rédiges, pour la page « Finance » d'un site sur l'infrastructure de l'intelligence artificielle, trois scénarios pour une société cotée : baissier, de base, haussier. Pour chaque société (i, nom, faits), les faits sont des éléments sourcés, chacun avec une référence (ref) : « f… » = chiffres officiels, « n… » = articles déjà classés, « m… » = contexte macro.
Renvoie, pour chaque société, trois listes de 1 à 3 points chacune (bear, base, bull). Chaque point a :
- t : une phrase française de 170 caractères au plus ;
- ref : la référence du fait unique sur lequel il s'appuie (une des références fournies).
Sens : bull = ce qui pourrait jouer en faveur de la société si les faits favorables se confirment ; bear = ce qui pourrait jouer contre elle ; base = ce qui se dégage de l'ensemble si la tendance actuelle se poursuit.
Règles : n'utilise que les faits fournis ; aucun chiffre, nom ou date absent de ces faits ; aucun objectif de cours, aucune probabilité, aucun conseil d'achat ou de vente, aucune formule accrocheuse ; ton neutre, au conditionnel quand c'est une hypothèse. ${UNITS_RULE} Réponds uniquement par un tableau JSON, un objet par société, avec les champs i, bear, base, bull.`;
const POINT = { type: "OBJECT", properties: { t: { type: "STRING" }, ref: { type: "STRING" } }, required: ["t", "ref"] };
export const CASES_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, bear: { type: "ARRAY", items: POINT }, base: { type: "ARRAY", items: POINT }, bull: { type: "ARRAY", items: POINT } }, required: ["i", "bear", "base", "bull"] },
};

const fmtMoney = (v) => { const a = Math.abs(v); return a >= 1e9 ? `${(v / 1e9).toFixed(1).replace(".", ",")} Md$` : `${Math.round(v / 1e6).toLocaleString("fr-FR")} M$`; };
const pct = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")} %`;
const dFr = (d) => { const [y, m, j] = String(d).slice(0, 10).split("-"); return `${+j}/${+m}/${y}`; };

/** Chiffres officiels de la fiche → faits numérotés (f1, f2…), reformulés mécaniquement (aucune IA). */
export function fundamentals(fin) {
  const out = [];
  const q = fin?.quarter;
  if (q?.value) out.push({ k: "f1", text: `Revenus du trimestre clos le ${dFr(q.end)} : ${fmtMoney(q.value)}${q.yoy != null ? ` (${pct(q.yoy)} sur un an${q.qoq != null ? `, ${pct(q.qoq)} sur le trimestre` : ""})` : ""}.`, url: q.url || "", src: q.src || "SEC" });
  if (fin?.ttm?.value) out.push({ k: "f2", text: `Revenus sur les douze derniers mois (au ${dFr(fin.ttm.end)}) : ${fmtMoney(fin.ttm.value)}.`, url: q?.url || "", src: "SEC" });
  if (fin?.capex?.value) out.push({ k: "f3", text: `Investissements (capex) sur douze mois (au ${dFr(fin.capex.end)}) : ${fmtMoney(fin.capex.value)}${fin.ttm?.value ? `, soit ${Math.round((fin.capex.value / fin.ttm.value) * 100)} % des revenus` : ""}.`, url: fin.capex.url || "", src: `SEC (${fin.capex.form || "dépôt"})` });
  return out;
}

/** Ton des articles libellés : comptes sur 30 jours et indice net (haussiers − baissiers) / total. */
export function tone(labels, now) {
  const L = labels.filter((l) => now - Date.parse(l.ts) <= FIN_RULES.days * DAY);
  const c = { haussier: 0, neutre: 0, baissier: 0 };
  for (const l of L) c[l.stance]++;
  const n = L.length, net = n ? (c.haussier - c.baissier) / n : 0;
  return { ...c, n, net: +net.toFixed(2), label: n < FIN_RULES.minLabeled ? "peu d'articles" : net >= FIN_RULES.tone ? "haussière" : net <= -FIN_RULES.tone ? "baissière" : "mitigée" };
}

/** Articles du fil qui nomment la société (30 jours, les plus récents d'abord). */
export function companyArticles(actor, feed, now) {
  const re = nameRe([actor.n]);
  return (feed?.items || [])
    .filter((i) => (i.importance || 1) >= 1 && now - Date.parse(i.ts) <= FIN_RULES.days * DAY && re.test(`${i.title} ${i.summary || ""}`))
    .sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, FIN_RULES.perCompany);
}

export function macroFacts(outlook, now = Date.now()) {
  const out = [], today = new Date(now).toISOString().slice(0, 10);
  for (const c of (outlook?.catalysts || []).filter((c) => !c.date || String(c.date) >= today)) out.push(`${c.kind || "Rendez-vous"} : ${c.title}${c.detail ? " — " + c.detail : ""}`.slice(0, 320));
  for (const r of outlook?.risks || []) out.push(`Risque : ${r.title}${r.value ? " — " + r.value : ""}${r.sub ? ". " + r.sub : ""}`.slice(0, 320));
  return out.slice(0, FIN_RULES.macro).map((text, i) => ({ k: "m" + (i + 1), text }));
}

/**
 * buildFinance({ acteurs, feed, outlook, prev, now, generateLabels, generateCases }) → { doc, reason, stats }
 * Le périmètre = les acteurs qui ont des chiffres SEC. Les libellés déjà posés ne sont jamais refaits ; les scénarios ne sont réécrits
 * que s'il y a au moins `minNew` nouveaux articles libellés (ou de nouveaux chiffres) depuis la dernière rédaction.
 */
export async function buildFinance({ acteurs, feed, outlook, prev, now, generateLabels, generateCases }) {
  const R = FIN_RULES, actors = (acteurs?.actors || []).filter((a) => a.fin && (a.fin.quarter || a.fin.ttm));
  if (!actors.length) return { doc: prev || null, reason: "aucune société avec chiffres SEC", stats: {} };
  const prevBy = new Map((prev?.companies || []).map((c) => [c.id, c]));
  const cos = actors.map((a) => {
    const p = prevBy.get(a.id);
    return { id: a.id, n: a.n, c: a.c, labels: (p?.labels || []).filter((l) => now - Date.parse(l.ts) <= R.days * DAY), tries: { ...(p?.tries || {}) }, cases: p?.cases || null, _arts: companyArticles(a, feed, now), fund: fundamentals(a.fin) };
  });

  // 1) libellés : seulement les articles pas encore classés
  const todo = [];
  for (const co of cos) {
    const have = new Set(co.labels.map((l) => l.id));
    for (const it of co._arts) if (!have.has(it.id) && (co.tries[it.id] || 0) < R.tries) todo.push({ co, it });
  }
  todo.sort((a, b) => b.it.ts.localeCompare(a.it.ts));
  let labeled = 0, rejected = 0, calls = 0;
  if (generateLabels) {
    for (let off = 0; off < todo.length && calls < R.maxLabelCalls; off += R.labelBatch, calls++) {
      const batch = todo.slice(off, off + R.labelBatch);
      const inputs = batch.map((b, i) => ({ i, societe: b.co.n, titre: b.it.title, resume: String(b.it.summary || "").slice(0, 260) }));
      let res = null;
      try { res = await generateLabels(inputs); } catch { res = null; }
      if (!Array.isArray(res)) break;
      const seen = new Set();
      for (const r of res) {
        const b = batch[Number(r?.i)], inp = inputs[Number(r?.i)];
        if (!b || seen.has(r.i)) continue;
        seen.add(r.i);
        b.co.tries[b.it.id] = (b.co.tries[b.it.id] || 0) + 1;
        const why = clean(r.why), src = `${inp.titre} ${inp.resume}`;
        const pool = new Set(digitsOf(stripAmounts(src)));
        if (!STANCES.includes(r.stance) || !SCOPES.includes(r.scope) || !why || why.length > R.whyMax || foreignScript(why) || !digitsOf(stripAmounts(why)).every((d) => pool.has(d)) || !unitsOk(src, why, "fr", false)) { rejected++; continue; }
        b.co.labels.push({ id: b.it.id, ts: b.it.ts, title: b.it.title, title_en: b.it.title_en || "", source: b.it.source, url: b.it.url, stance: r.stance, scope: r.scope, why: normalizeFr(src, why) });
        labeled++;
      }
    }
  }
  for (const co of cos) { co.labels = co.labels.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, R.keepLabels); const keep = new Set(co._arts.map((x) => x.id)); for (const k of Object.keys(co.tries)) if (!keep.has(k) && !co.labels.some((l) => l.id === k)) delete co.tries[k]; }

  // 2) scénarios : sociétés avec assez d'articles libellés et de la nouveauté, les plus anciennes d'abord
  const macro = macroFacts(outlook, now);
  const sigOf = (co) => JSON.stringify([co.fund.map((f) => f.text), co.labels.slice(0, 8).map((l) => l.id)]);
  const due = cos.filter((co) => {
    const L = co.labels.filter((l) => now - Date.parse(l.ts) <= R.days * DAY);
    if (L.length < R.minLabeled) return false;
    if (!co.cases) return true;
    if ((now - Date.parse(co.cases.at)) / HOUR < R.regenH) return false;
    const used = new Set(co.cases.ids || []);
    return L.filter((l) => !used.has(l.id)).length >= R.minNew || co.cases.sig !== sigOf(co);
  }).sort((a, b) => (Date.parse(a.cases?.at) || 0) - (Date.parse(b.cases?.at) || 0)).slice(0, R.maxCases);
  let written = 0;
  if (generateCases && due.length) {
    const inputs = due.map((co, i) => {
      const L = co.labels.filter((l) => now - Date.parse(l.ts) <= R.days * DAY).slice(0, 8);
      return { i, nom: co.n, faits: [...co.fund.map((f) => ({ ref: f.k, texte: f.text })), ...L.map((l, k) => ({ ref: "n" + (k + 1), texte: `${l.title} (${l.source}) — classé ${l.stance} : ${l.why}` })), ...macro.map((m) => ({ ref: m.k, texte: m.text }))], _L: L };
    });
    let res = null;
    try { res = await generateCases(inputs.map(({ _L, ...x }) => x)); } catch { res = null; }
    if (Array.isArray(res)) for (const r of res) {
      const inp = inputs[Number(r?.i)]; if (!inp) continue;
      const co = due[inp.i], refs = new Map(inp.faits.map((f) => [f.ref, f.texte])), all = inp.faits.map((f) => f.texte).join(" ");
      const pool = new Set(digitsOf(stripAmounts(all)));
      const okPts = (arr) => (Array.isArray(arr) ? arr : []).map((p) => ({ t: clean(p?.t), ref: clean(p?.ref) }))
        .filter((p) => p.t && p.t.length <= R.pointMax && refs.has(p.ref) && !foreignScript(p.t) && digitsOf(stripAmounts(p.t)).every((d) => pool.has(d)) && unitsOk(all, p.t, "fr", false))
        .slice(0, R.pointsMax).map((p) => ({ t: normalizeFr(all, p.t), ref: p.ref }));
      const bear = okPts(r.bear), base = okPts(r.base), bull = okPts(r.bull);
      if (!bear.length || !base.length || !bull.length) continue; // trois scénarios ou rien : on garde les précédents
      co.cases = { at: new Date(now).toISOString(), bear, base, bull, ids: inp._L.map((l) => l.id), refs: inp._L.map((l, k) => ["n" + (k + 1), l.id]), sig: sigOf(co) };
      written++;
    }
  }

  const doc = { v: 1, generated_at: new Date(now).toISOString(), note: "Scénarios et libellés rédigés par IA à partir de sources citées ; ce ne sont ni des prévisions ni un conseil en investissement.", companies: cos.map((co) => ({ id: co.id, n: co.n, c: co.c, tone: tone(co.labels, now), fund: co.fund, labels: co.labels, tries: co.tries, cases: co.cases })) };
  doc.macro = macro;
  const same = prev && JSON.stringify({ ...prev, generated_at: 0 }) === JSON.stringify({ ...doc, generated_at: 0 });
  return { doc: same ? prev : doc, reason: `${cos.length} société(s) ; ${labeled} libellé(s) posé(s)${rejected ? `, ${rejected} rejeté(s)` : ""} ; ${written} scénario(s) rédigé(s)`, stats: { labeled, rejected, written, todo: todo.length, due: due.length } };
}
