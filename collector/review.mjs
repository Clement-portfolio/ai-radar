// Revue hebdomadaire des pages saisies à la main (Marché, Infrastructure, USA–Chine).
// Le robot ne modifie RIEN : il propose, à partir des seuls articles déjà collectés, des mises à jour sourcées,
// publiées dans une issue GitHub. Clément valide en commentant « /appliquer 1 3 » ou « /appliquer tout ».
import fs from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { digitsOf, hasNumberWords } from "./brief.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "public", "data");
const DAY = 86400000;

/** Champs que le robot peut proposer de modifier, par type d'élément. Les jugements éditoriaux (tension, avance) sont exclus. */
export const KINDS = {
  tiles: { file: "market", path: "tiles", fields: ["value", "sub"], numeric: [], src: ["src", "u"], title: "Marché › Chiffres clés", name: (x) => x.label },
  capex_us: { file: "market", path: "capex_us", fields: ["low", "high", "note"], numeric: ["low", "high"], src: ["source", "url"], asOf: "as_of", title: "Marché › Capex États-Unis", name: (x) => x.name },
  capex_cn: { file: "market", path: "capex_cn", fields: ["value", "note"], numeric: [], src: ["source", "url"], asOf: "as_of", title: "Marché › Capex Chine", name: (x) => x.name },
  revenue: { file: "market", path: "revenue", fields: ["value", "num", "note"], numeric: ["num"], src: ["source", "url"], asOf: "as_of", title: "Marché › Revenus", name: (x) => x.name },
  actors: { file: "market", path: "actors", fields: ["note"], numeric: [], src: ["src", "u"], title: "Marché › Acteurs", name: (x) => x.name },
  layers: { file: "layers", path: "layers", fields: ["key_stat", "note"], numeric: [], sources: true, title: "Infrastructure", name: (x) => x.name },
  race: { file: "race", path: "rows", fields: ["us", "cn", "note"], numeric: [], sources: true, title: "USA–Chine", name: (x) => x.layer },
};
const GROUPS = { market: ["tiles", "capex_us", "capex_cn", "revenue", "actors"], layers: ["layers"], race: ["race"] };

export const REVIEW_SYSTEM = `Tu relis des pages d'un radar sur l'IA et son économie, saisies à la main. On te donne (1) des éléments {k, name, fields} avec leur valeur actuelle, (2) des articles récents numérotés {i, title, summary, source, ts}.
Propose une mise à jour d'un élément UNIQUEMENT si un article apporte un chiffre ou un fait plus récent, plus précis ou contradictoire pour CE MÊME élément.
- La nouvelle valeur doit mesurer la même grandeur, pour la même entité, que l'actuelle (ex. run-rate d'OpenAI → nouveau run-rate d'OpenAI). Ne remplace jamais un indicateur ou une description par un autre sujet, même chiffré.
- N'invente rien. Aucun chiffre, nom ou fait absent des articles cités. Ne complète pas avec tes connaissances.
- Ne propose que les champs fournis dans fields. Garde le format et la langue (français) de la valeur actuelle ; les champs low, high et num sont des nombres en milliards de dollars, écrits sans unité.
- Écris les nombres en chiffres, jamais en toutes lettres. Pas de prédiction ni d'opinion.
- Cite 1 à 3 articles par proposition (numéros i dans sources) et explique en une phrase (reason) ce qui change.
- Si rien ne justifie un changement, réponds par un tableau vide.
Réponds uniquement par un tableau JSON d'objets {k, changes:[{field, value}], sources, reason}.`;

export const REVIEW_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { k: { type: "STRING" }, changes: { type: "ARRAY", items: { type: "OBJECT", properties: { field: { type: "STRING" }, value: { type: "STRING" } }, required: ["field", "value"] } }, sources: { type: "ARRAY", items: { type: "INTEGER" } }, reason: { type: "STRING" } }, required: ["k", "changes", "sources", "reason"] },
};

export const POINT_SYSTEM = `Tu mets à jour des courbes d'un radar sur l'IA. On te donne (1) des séries {k, name, unit, last_date, last_value}, (2) des articles récents numérotés {i, title, summary, source, ts}.
Propose UN nouveau point pour une série UNIQUEMENT si un article donne, pour CE MÊME indicateur et la même entité, une mesure plus récente que last_date.
- La date (YYYY-MM-DD) est celle de la mesure si l'article la donne (fin de mois ou date d'annonce), sinon la date de l'article.
- La valeur est un nombre dans l'unité de la série (ex. milliards de dollars, millions d'utilisateurs, % ). Convertis si besoin, sans inventer.
- N'invente rien : le nombre doit figurer dans les articles cités. Ne mélange pas deux mesures différentes (hebdomadaire contre mensuel, revenu contre run-rate).
- Cite 1 à 3 articles (numéros i dans sources) et explique en une phrase (reason).
- Si rien ne justifie un nouveau point, réponds par un tableau vide.
Réponds uniquement par un tableau JSON d'objets {k, date, value, sources, reason}.`;
export const POINT_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { k: { type: "STRING" }, date: { type: "STRING" }, value: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } }, reason: { type: "STRING" } }, required: ["k", "date", "value", "sources"] },
};

/** Séries des courbes semi-automatiques : clé « point:id:indice de série ». */
export function flattenPoints(series) {
  const out = [];
  for (const c of series?.curves || []) {
    if (c.auto !== false) continue;
    (c.series || []).forEach((s, si) => {
      const last = [...(s.points || [])].sort((a, b) => a.d.localeCompare(b.d)).pop();
      if (last) out.push({ k: `point:${c.id}:${si}`, kind: "point", name: `${c.title} › ${s.name}`, unit: c.unit, last });
    });
  }
  return out;
}

/** Nouveau point : date postérieure au dernier, valeur plausible dont les chiffres figurent dans les articles cités. */
export function validatePoints(raw, items, articles, now = Date.now()) {
  if (!Array.isArray(raw)) return [];
  const byK = new Map(items.map((x) => [x.k, x])), out = [], seen = new Set(), trim = (d) => d.replace(/0+$/, "") || "0";
  for (const p of raw) {
    const it = byK.get(String(p?.k)); if (!it || seen.has(it.k)) continue;
    const src = [...new Set((Array.isArray(p.sources) ? p.sources : []).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= articles.length).slice(0, 3);
    const d = String(p.date || "").slice(0, 10), raws = String(p.value ?? ""), v = Number(raws.replace(/\s/g, "").replace(",", "."));
    if (!src.length || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !(Date.parse(d) > Date.parse(it.last.d)) || Date.parse(d) > now + DAY) continue;
    if (!(v > 0) || hasNumberWords(raws)) continue;
    if (v < it.last.v / 4 || v > it.last.v * 4) continue; // unité probablement confondue
    if (/%/.test(it.unit) && v > 100) continue;
    const ev = src.map((n) => articles[n - 1]), known = set(digitsOf(ev.map((a) => a.title + " " + a.summary).join(" ")).map(trim));
    if (digitsOf(raws).some((x) => !known.has(trim(x)))) continue;
    seen.add(it.k);
    out.push({ k: it.k, kind: "point", label: `Évolution › ${it.name}`, point: { d, v }, changes: [{ field: "nouveau point", old: `${it.last.d} : ${it.last.v}`, new: `${d} : ${v}` }], reason: norm(p.reason).slice(0, 240), evidence: ev.map((a) => ({ title: a.title, source: a.source, url: a.url, ts: a.ts })) });
  }
  return out;
}

/** Liste plate des éléments révisables : clé « kind:index ». */
export function flatten(files) {
  const out = [];
  for (const [kind, def] of Object.entries(KINDS)) {
    (files[def.file]?.[def.path] || []).forEach((x, i) => out.push({ k: `${kind}:${i}`, kind, i, name: def.name(x), fields: Object.fromEntries(def.fields.filter((f) => x[f] != null).map((f) => [f, x[f]])) }));
  }
  return out;
}

/** Articles récents, importants, jamais ceux qui n'ont pas été classés par l'IA. */
export function pickArticles(feed, now, days = 10, cap = 120) {
  return feed.filter((a) => !a.pending && a.importance >= 2 && now - Date.parse(a.ts) < days * 86400000)
    .sort((a, b) => (b.importance - a.importance) || b.ts.localeCompare(a.ts)).slice(0, cap)
    .map((a, n) => ({ i: n + 1, id: a.id, title: a.title, summary: a.summary || "", source: a.source, url: a.url, ts: a.ts }));
}

const words = (t) => new Set(String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]{4,}/g) || []);
/** Un texte proposé doit rester sur le même sujet : au moins un mot de la valeur actuelle ou du nom de l'élément. */
const sameSubject = (oldText, name, newText) => { const ref = new Set([...words(oldText), ...words(name)]); if (!ref.size) return true; const n = words(newText); return [...ref].some((w) => n.has(w)); };
const norm = (v) => String(v ?? "").trim();
const set = (s) => new Set(s);

/** Ne garde que les propositions complètes, sourcées, dont tout nouveau nombre figure dans les articles cités. */
export function validate(raw, items, articles) {
  if (!Array.isArray(raw)) return [];
  const byK = new Map(items.map((x) => [x.k, x])), out = [], seen = new Set();
  for (const p of raw) {
    const it = byK.get(String(p?.k)); if (!it || seen.has(it.k)) continue;
    const def = KINDS[it.kind];
    const src = [...new Set((Array.isArray(p.sources) ? p.sources : []).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= articles.length).slice(0, 3);
    if (!src.length) continue;
    const ev = src.map((n) => articles[n - 1]), evDigits = set(digitsOf(ev.map((a) => a.title + " " + a.summary).join(" ")));
    const changes = [];
    for (const c of Array.isArray(p.changes) ? p.changes : []) {
      const field = String(c?.field), value = norm(c?.value), old = norm(it.fields[field]);
      if (!def.fields.includes(field) || !value || value.length > 300 || value === old) continue;
      if (def.numeric.includes(field) && !(Number.isFinite(Number(value.replace(",", "."))) && Number(value.replace(",", ".")) > 0)) continue;
      if (def.numeric.includes(field) && hasNumberWords(value)) continue;
      if (!def.numeric.includes(field) && old && !sameSubject(old, it.name, value)) continue;
      const oldDigits = set(digitsOf(old));
      if (digitsOf(value).some((d) => !oldDigits.has(d) && !evDigits.has(d))) continue;
      changes.push({ field, old: it.fields[field] ?? null, new: def.numeric.includes(field) ? Number(value.replace(",", ".")) : value });
    }
    if (!changes.length) continue;
    const lo = changes.find((c) => c.field === "low")?.new ?? it.fields.low, hi = changes.find((c) => c.field === "high")?.new ?? it.fields.high;
    if (lo != null && hi != null && lo > hi) continue;
    seen.add(it.k);
    out.push({ k: it.k, label: `${def.title} › ${it.name}`, changes, reason: norm(p.reason).slice(0, 240), evidence: ev.map((a) => ({ title: a.title, source: a.source, url: a.url, ts: a.ts })) });
  }
  return out;
}

const frDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Applique les propositions retenues. Une proposition dont la valeur actuelle a changé depuis (autre mise à jour) est ignorée.
 * Renvoie { applied:[n], skipped:[{n,why}] } ; `files` ({market, layers, race}) est modifié en place.
 */
export function applyProposals(files, proposals, pick, today = new Date()) {
  const applied = [], skipped = [], touched = new Set();
  proposals.forEach((p, idx) => {
    const n = idx + 1; if (pick && !pick.includes(n)) return;
    if (p.point) {
      const [, id, si] = p.k.split(":"), ser = files.series?.curves?.find((c) => c.id === id)?.series?.[+si];
      if (!ser) return skipped.push({ n, why: "courbe introuvable" });
      if (ser.points.some((q) => q.d >= p.point.d)) return skipped.push({ n, why: "un point plus récent existe déjà" });
      const e = p.evidence[0]; ser.points.push({ d: p.point.d, v: p.point.v, src: e.source, url: e.url });
      touched.add("series"); applied.push(n); return;
    }
    const [kind, i] = p.k.split(":"), def = KINDS[kind], item = def && files[def.file]?.[def.path]?.[+i];
    if (!item) return skipped.push({ n, why: "élément introuvable" });
    if (p.changes.some((c) => norm(item[c.field]) !== norm(c.old))) return skipped.push({ n, why: "la valeur a changé depuis la proposition" });
    for (const c of p.changes) item[c.field] = c.new;
    const ev = p.evidence[0];
    if (def.src) { item[def.src[0]] = ev.source; item[def.src[1]] = ev.url; }
    if (def.sources) { item.sources = item.sources || []; for (const e of p.evidence) if (!item.sources.some((s) => s.u === e.url)) item.sources.push({ t: e.source, u: e.url }); }
    if (def.asOf) item[def.asOf] = frDate(ev.ts);
    touched.add(def.file); applied.push(n);
  });
  for (const f of touched) if (files[f]) files[f].as_of = frDate(today);
  return { applied, skipped, touched: [...touched] };
}

// Même mise en forme que les fichiers saisis à la main (une ligne par élément) : différences lisibles dans Git.
export function fmt(o, compactEnd = false) {
  const ent = Object.entries(o), isArr = ([, v]) => Array.isArray(v), first = ent.findIndex(isArr), lastArr = ent.map(isArr).lastIndexOf(true);
  const head = ent.slice(0, first);
  let out = "{" + head.map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)},`).join("") + (head.length > 1 ? "\n" : "");
  ent.slice(first).forEach(([k, v], i) => { out += `${JSON.stringify(k)}:[\n` + v.map((x) => JSON.stringify(x)).join(",\n") + (first + i === lastArr ? (compactEnd ? "]}" : "\n]}") : "],\n"); });
  return out + "\n";
}

const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
export const dec = (s) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
const cell = (v) => String(v ?? "–").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Corps de l'issue : lisible par Clément, avec la charge utile cachée que lit /appliquer. */
export function renderIssue(proposals, day) {
  const lines = [`Revue hebdomadaire des pages saisies à la main, ${day}. **${proposals.length} proposition(s)**, déduites des seuls articles collectés ces 10 derniers jours. Rien n'est modifié tant que tu n'as pas validé.`, "",
    "**Pour valider :** commente `/appliquer 1 3` (les numéros voulus) ou `/appliquer tout`. Les numéros non cités sont ignorés.", ""];
  proposals.forEach((p, i) => {
    lines.push(`### ${i + 1}. ${p.label}`, "");
    for (const c of p.changes) lines.push(`- **${c.field}** : ${cell(c.old)} → **${cell(c.new)}**`);
    lines.push("", `Pourquoi : ${p.reason}`, `Sources : ` + p.evidence.map((e) => `[${e.source} — ${e.title.slice(0, 90)}](${e.url})`).join(" · "), "");
  });
  lines.push(`<!--radar-proposals:${enc(proposals)}-->`);
  return lines.join("\n");
}

export function parseCommand(body) {
  const m = String(body || "").trim().match(/^\/appliquer\s*(.*)$/i); if (!m) return null;
  if (/^tout\b/i.test(m[1])) return "all";
  const nums = (m[1].match(/\d+/g) || []).map(Number); return nums.length ? nums : null;
}

export async function review({ files, feed, generate, now = Date.now(), log = () => {} }) {
  const items = flatten(files), articles = pickArticles(feed, now);
  log(`Revue : ${items.length} éléments, ${articles.length} articles récents`);
  if (articles.length < 10) return { proposals: [], note: "trop peu d'articles récents" };
  const proposals = []; let failed = 0;
  for (const kinds of Object.values(GROUPS)) {
    const sub = items.filter((x) => kinds.includes(x.kind));
    const raw = await generate({ items: sub.map(({ k, name, fields }) => ({ k, name, fields })), articles: articles.map(({ i, title, summary, source, ts }) => ({ i, title, summary, source, ts })) });
    if (raw == null) { failed++; continue; }
    proposals.push(...validate(raw, sub, articles));
  }
  if (files.series) {
    const pts = flattenPoints(files.series);
    if (pts.length) {
      const raw = await generate({ mode: "points", items: pts.map(({ k, name, unit, last }) => ({ k, name, unit, last_date: last.d, last_value: last.v })), articles: articles.map(({ i, title, summary, source, ts }) => ({ i, title, summary, source, ts })) });
      if (raw == null) failed++; else proposals.push(...validatePoints(raw, pts, articles, now));
    }
  }
  return { proposals: proposals.slice(0, 15), failed };
}

/* ---------- exécution (GitHub Actions) ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { makeClassifier } = await import("./collect.mjs");
  const read = async (f) => JSON.parse(await fs.readFile(path.join(DATA, f), "utf8"));
  const files = { market: await read("market.json"), layers: await read("layers.json"), race: await read("race.json"), series: await read("series.json").catch(() => null) };
  const feed = (await read("feed.json")).items;
  const state = await read("state.json").catch(() => ({}));
  if (!process.env.GEMINI_API_KEY) { console.log("GEMINI_API_KEY absente : revue annulée"); process.exit(0); }
  const pacific = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
  const clf = await makeClassifier(process.env, fetch, (m) => console.log(m), state.gemini?.date === pacific ? state.gemini.dead : []);
  const generate = async (input) => (clf.state.fatal ? null : input.mode === "points" ? clf.call({ items: input.items, articles: input.articles }, { system: POINT_SYSTEM, schema: POINT_SCHEMA }) : clf.call(input, { system: REVIEW_SYSTEM, schema: REVIEW_SCHEMA }));
  const r = await review({ files, feed, generate, log: console.log });
  console.log(`Propositions retenues : ${r.proposals.length}${r.failed ? ` (${r.failed} appel(s) IA en échec)` : ""}${r.note ? " · " + r.note : ""}`);
  const out = process.env.REVIEW_OUT || "/tmp/review-body.md";
  if (r.proposals.length) await fs.writeFile(out, renderIssue(r.proposals, new Date().toISOString().slice(0, 10)));
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `count=${r.proposals.length}\nbody=${out}\n`);
}
