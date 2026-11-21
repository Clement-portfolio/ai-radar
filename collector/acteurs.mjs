// Fiches « Acteurs » : assemblées sans IA à partir de données déjà sourcées (chain.json, sec-acteurs.json, feed.json).
// Rien n'est estimé : un champ sans source reste vide et n'est pas affiché (clients principaux : aucune source collectée à ce jour).
import crypto from "node:crypto";

export const ACTEURS_RULES = { news: 5, newsDays: 45, minImportance: 1, maxNameLen: 40 };

/** Pays du siège, quand chain.json ne donne que « OTHER » ou « EU » (données éditoriales stables, pas des chiffres). */
export const SIEGE = {
  TSMC: "Taïwan", ASE: "Taïwan", SPIL: "Taïwan", UMC: "Taïwan", Unimicron: "Taïwan", MediaTek: "Taïwan",
  Samsung: "Corée du Sud", "SK hynix": "Corée du Sud",
  Tower: "Israël", Celestica: "Canada",
  Arm: "Royaume-Uni",
  ASML: "Pays-Bas", "Siemens Energy": "Allemagne", "Siemens EDA": "Allemagne", "AT&S": "Autriche",
  ABB: "Suisse", "Hitachi Energy": "Suisse",
  Nittobo: "Japon", Ibiden: "Japon", "Mitsubishi Heavy Industries": "Japon", "Mitsubishi Electric": "Japon", "Sumitomo Electric": "Japon",
  Humain: "Arabie saoudite", G42: "Émirats arabes unis",
  Nebius: "Pays-Bas", IREN: "Australie",
};
const PAYS = { US: "États-Unis", CN: "Chine", EU: "Europe", GULF: "Golfe", JP: "Japon", UK: "Royaume-Uni", OTHER: "Autres" };

const ALIAS = { Google: "Alphabet", "Samsung Foundry": "Samsung", "Tower Semiconductor": "Tower" };
const TERMS = { "Moonshot AI": ["Moonshot AI", "Kimi"], "Zhipu AI": ["Zhipu AI", "Zhipu", "Z.ai"], Alphabet: ["Alphabet", "Google"], Meta: ["Meta"], Microsoft: ["Microsoft"], Amazon: ["Amazon", "AWS"], Samsung: ["Samsung"], Nvidia: ["Nvidia"] };

export const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Noms qui sont aussi des mots courants : on exige la casse exacte (ou le sigle en majuscules) pour ne pas les prendre pour l'entreprise. */
const AMBIGUOUS = new Set(["Arm", "Meta", "Credo", "Tower", "Coherent", "ASE", "Eaton", "IREN"]);
/** Nom d'acteur isolé dans un texte : pas collé à une autre lettre (évite « AMD » dans « AMDOCS »). */
export const nameRe = (names) => {
  const amb = names.some((n) => AMBIGUOUS.has(n));
  const list = amb ? [...new Set(names.flatMap((n) => [n, n.toUpperCase()]))] : names;
  return new RegExp("(?<![\\p{L}\\p{N}])(" + list.map(esc).join("|") + ")(?![\\p{L}\\p{N}])", amb ? "u" : "iu");
};

/** Entrée de chain.json → acteur(s) : « A, B » devient deux acteurs ; « Nom (précision) » garde la précision comme contexte. */
export function parseActor(raw) {
  const parts = String(raw.n).split(/\s*,\s*/).filter(Boolean);
  return parts.map((p) => {
    const m = p.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    let base = (m ? m[1] : p).trim(), via = m ? m[2].trim() : "";
    if (ALIAS[base]) { via = via || base; base = ALIAS[base]; }
    if (base === "Samsung Foundry") base = "Samsung";
    return { name: base, via, c: raw.c };
  });
}

/** Chiffre d'affaires du trimestre, variation sur le trimestre précédent et sur un an, tels qu'écrits dans un communiqué en anglais (« revenue … of $115.8 billion, up 20% from the previous quarter and up 103% from a year ago »). */
export function parseRelease(text) {
  const m = String(text).match(/revenue[^.$]{0,100}?of \$\s?([\d.,]+)\s*(billion|million)[^.]{0,40}?up (\d+(?:\.\d+)?)%\s+from the (?:previous|prior) quarter and up (\d+(?:\.\d+)?)%\s+from a year ago/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (!(num > 0)) return null;
  const value = Math.round(num * (/billion/i.test(m[2]) ? 1e9 : 1e6));
  const e = String(text).match(/quarter ended ([A-Z][a-z]+ \d{1,2}, \d{4})/);
  const end = e ? new Date(e[1] + " UTC").toISOString().slice(0, 10) : "";
  return { value, qoq: +m[3], yoy: +m[4], end };
}

const fmtPct = (x) => (Math.round(x * 10) / 10).toString().replace(".", ",");

export function buildActeurs({ chain, feed, sec, releases = [], fiches = {}, now = Date.now() }) {
  const by = new Map();
  const get = (a) => {
    const id = slug(a.name);
    if (!by.has(id)) by.set(id, { id, n: a.name, c: a.c, pays: SIEGE[a.name] || PAYS[a.c] || a.c, roles: [], figs: [], markets: [], backlog: [], news: [] });
    return by.get(id);
  };
  const blocks = new Map((chain.blocks || []).map((b) => [b.id, b]));
  for (const b of chain.blocks || []) {
    for (const s of b.subs || []) {
      const names = new Set();
      for (const raw of s.actors || []) for (const a of parseActor(raw)) {
        const o = get(a); names.add(o.id);
        if (!o.roles.some((r) => r.block === b.name && r.sub === s.name)) o.roles.push({ block: b.name, blockId: b.id, sub: s.name, why: s.why || "", via: a.via || "" });
      }
      for (const f of s.figs || []) {
        for (const id of names) {
          const o = by.get(id);
          if (!nameRe([o.n, ...(TERMS[o.n] || [])]).test(`${f.l} ${f.v}`)) continue;
          const row = { v: f.v, l: f.l, as_of: f.as_of || "", src: f.src || "", u: f.u || "" };
          (/carnet|backlog|commande|réservation/i.test(f.l) ? o.backlog : o.figs).push(row);
        }
      }
    }
  }
  // Parts de marché publiées : camemberts de chain.json où l'acteur figure (le libellé COMMENCE par son nom). Chaque camembert garde tous ses concurrents.
  const pies = [];
  for (const u of Object.values(chain.u || {})) if (Array.isArray(u.items)) pies.push({ t: u.t, items: u.items, as_of: u.as_of, src: u.src, u: u.u || u.url, total: null, su: u.su || "" });
  for (const f of Object.values(chain.fm || {})) if (f.pie?.items) pies.push({ t: f.pie.t, items: f.pie.items, as_of: f.pie.as_of, src: f.pie.src, u: f.pie.u, total: f.pie.items.reduce((s, i) => s + (+i.v || 0), 0), m: f.pie.m });
  const NOT_SHARE = /investissement|capex|dépenses|gigawatts|visites|poids de la hbm/i, AGG = /^(autres?|reste|puces sur mesure|fabricants chinois|trois premiers)/i;
  const seen = new Set();
  for (const p of pies) {
    for (const it of p.items) {
      for (const o of by.values()) {
        if (!new RegExp("^" + esc(o.n) + "(?![\\p{L}\\p{N}])", "iu").test(it.n)) continue;
        const k = `${o.id}|${p.t}|${p.src}`;
        if (seen.has(k)) continue; seen.add(k);
        const carnet = /carnet/i.test(p.t);
        if (carnet) {
          const unit = p.su === "GW" || /GW/.test(it.n) ? " GW" : "";
          const val = String(it.v).replace(".", ",") + unit;
          if (!o.backlog.some((b) => b.v.replace(/\s/g, "") === val.replace(/\s/g, "") && /\d/.test(b.v))) o.backlog.push({ v: val, l: `${p.t} (${it.n})`, as_of: p.as_of || "", src: p.src || "", u: p.u || "" });
          continue;
        }
        if (NOT_SHARE.test(p.t)) continue;
        const tot = p.total && p.total > 0 ? p.total : null;
        const items = p.items.map((x) => ({ n: x.n.replace(/\s*\([^)]*\)\s*$/, "").trim() || x.n, v: tot ? Math.round((x.v / tot) * 1000) / 10 : +x.v, self: x === it }));
        const mine = items.find((x) => x.self);
        const top = !AGG.test(it.n) && p.items.every((x) => x === it || AGG.test(x.n) || x.v <= it.v);
        o.markets.push({ t: p.t, m: p.m || "", items, as_of: p.as_of || "", src: p.src || "", u: p.u || "", calc: !!tot, pct: mine.v, top });
      }
    }
  }
  // Un chiffre déjà affiché comme part ou comme carnet n'est pas répété dans « chiffres clés ».
  const lead = (v) => { const m = String(v).replace(/\s/g, "").replace(",", ".").match(/\d+(\.\d+)?/); return m ? +m[0] : null; };
  for (const o of by.values()) {
    const taken = new Set([...o.markets.map((x) => lead(x.pct)), ...o.backlog.map((x) => lead(x.v))].filter((x) => x != null));
    o.figs = o.figs.filter((f) => { const n = lead(f.v); return n == null || !taken.has(n); });
    const seenS = new Set();
    o.markets = o.markets.filter((x) => { const k = `${x.pct}|${x.as_of}`; if (seenS.has(k)) return false; seenS.add(k); return true; });
    const seenB = new Set();
    o.backlog = o.backlog.filter((b) => { const k = String(lead(b.v)) + "|" + /GW/.test(b.v); if (seenB.has(k)) return false; seenB.add(k); return true; });
  }
  // Chiffres SEC : dernier trimestre (avec variations calculées par nous sur les trimestres publiés), investissement sur 12 mois, carnet (RPO).
  const sy = new Map(((sec && sec.companies) || []).map((c) => [slug(c.name), c]));
  for (const o of by.values()) {
    const c = sy.get(o.id);
    const fin = {};
    if (c) {
      const q = c.revenue?.quarters || [];
      const last = q[q.length - 1];
      if (last) {
        const near = (days) => q.find((x) => Math.abs(Date.parse(x.end) - (Date.parse(last.end) - days * 864e5)) <= 12 * 864e5);
        const prev = near(91), yago = near(365);
        fin.quarter = { end: last.end, value: last.value, qoq: prev ? Math.round((last.value / prev.value - 1) * 1000) / 10 : null, yoy: yago ? Math.round((last.value / yago.value - 1) * 1000) / 10 : null, prev: prev ? prev.value : null, form: last.form, filed: last.filed, url: c.revenue.url, src: "SEC (" + last.form + ")", calc: true };
      }
      if (c.revenue?.value > 0) fin.ttm = { value: c.revenue.value, end: c.revenue.end, basis: c.revenue.basis };
      if (c.capex?.value > 0) fin.capex = { value: c.capex.value, basis: c.capex.basis, start: c.capex.start || null, end: c.capex.end, form: c.capex.form, url: c.capex.url };
      if (Array.isArray(c.stakes) && c.stakes.length) fin.stakes = c.stakes.map((x) => ({ label: x.label, value: x.value, basis: x.basis, end: x.end, form: x.form }));
      if (c.backlog?.value > 0) fin.backlog = { value: c.backlog.value, end: c.backlog.end, form: c.backlog.form, url: c.backlog.url, kind: "rpo" };
    }
    // Communiqué de résultats plus récent que le dernier dépôt SEC : chiffres lus dans le communiqué quand ils s'y trouvent en toutes lettres, sinon simple mention.
    const rel = releases.find((r) => nameRe([o.n]).test(r.source || ""));
    if (rel && (!fin.quarter || Date.parse(rel.ts) > Date.parse(fin.quarter.filed) + 864e5)) {
      const pr = parseRelease(rel.summary || "");
      const ok = pr && (!fin.quarter || (pr.value / fin.quarter.value > 0.5 && pr.value / fin.quarter.value < 2));
      if (ok) fin.quarter = { end: pr.end, value: pr.value, qoq: pr.qoq, yoy: pr.yoy, prev: null, form: "communiqué", filed: rel.ts.slice(0, 10), url: rel.url, src: "Communiqué de résultats (SEC)", calc: false };
      else fin.pending = { ts: rel.ts, url: rel.url };
    }
    if (!fin.backlog) { const b = o.backlog[0]; if (b) fin.backlog = { text: b.v, label: b.l, as_of: b.as_of, src: b.src, url: b.u, kind: "press" }; }
    if (Object.keys(fin).length) o.fin = fin;
  }
  // Concurrents : les autres acteurs des mêmes sous-couches (chain.json).
  const subs = new Map();
  for (const o of by.values()) for (const r of o.roles) { const k = r.block + " > " + r.sub; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(o.id); }
  for (const o of by.values()) {
    o.rivals = o.roles.map((r) => ({ sub: r.sub, block: r.block, ids: [...subs.get(r.block + " > " + r.sub)].filter((id) => id !== o.id) })).filter((x) => x.ids.length);
  }
  // Données éditoriales sourcées (fiches) : description, positionnement, camemberts et clients ; elles priment sur le calcul automatique.
  for (const o of by.values()) {
    const f = fiches[o.id];
    if (!f) continue;
    if (f.desc) o.desc = f.desc;
    if (f.rank) o.rank = f.rank;
    if (Array.isArray(f.markets)) o.markets = [...f.markets.map((m) => ({ ...m, items: m.items.map((x) => ({ ...x, self: x.self ?? new RegExp("^" + esc(o.n) + "(?![\\p{L}\\p{N}])", "iu").test(x.n) })), calc: false, pct: (m.items.find((x) => x.self ?? new RegExp("^" + esc(o.n) + "(?![\\p{L}\\p{N}])", "iu").test(x.n)) || {}).v })), ...o.markets.filter((a) => !f.markets.some((m) => m.t === a.t))];
    if (Array.isArray(f.clients)) { o.clients = f.clients; o.clients_ranked = f.clients_ranked === true; if (f.clients_note) o.clients_note = f.clients_note; }
  }
  for (const o of by.values()) {
    o.markets = o.markets.slice(0, 3);
    if (!o.rank) { const t = o.markets.find((m) => m.top && !m.calc); if (t) o.rank = { text: "n° 1 : " + t.t.charAt(0).toLowerCase() + t.t.slice(1), src: t.src, u: t.u, as_of: t.as_of, auto: true }; }
  }
  // Dernières actualités du fil qui nomment l'acteur (titre ou résumé), les plus récentes d'abord.
  const items = (feed?.items || []).filter((i) => i.importance >= ACTEURS_RULES.minImportance && now - Date.parse(i.ts) <= ACTEURS_RULES.newsDays * 864e5).sort((a, b) => b.ts.localeCompare(a.ts));
  for (const o of by.values()) {
    const re = nameRe([o.n, ...(TERMS[o.n] || [])]);
    for (const i of items) {
      if (o.news.length >= ACTEURS_RULES.news) break;
      if (re.test(`${i.title} ${i.summary || ""}`)) o.news.push({ id: i.id, ts: i.ts, title: i.title, title_en: i.title_en || "", source: i.source, url: i.url, imp: i.importance });
    }
  }
  // Place dans la chaîne : ce que le bloc alimente et ce dont il dépend.
  for (const o of by.values()) {
    const b0 = blocks.get(o.roles[0]?.blockId);
    o.feeds = (b0?.feeds || []).map((id) => blocks.get(id)?.name).filter(Boolean);
    o.needs = (b0?.needs || []).map((id) => blocks.get(id)?.name).filter(Boolean);
    o.sig = crypto.createHash("sha1").update(JSON.stringify([o.roles, o.figs, o.markets, o.backlog, o.fin, o.news.map((n) => n.id)])).digest("hex").slice(0, 8);
  }
  const actors = [...by.values()].sort((a, b) => a.n.localeCompare(b.n, "fr"));
  return { v: 1, generated_at: new Date(now).toISOString(), chain_as_of: chain.as_of || "", actors };
}
