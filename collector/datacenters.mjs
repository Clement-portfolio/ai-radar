// Carte des datacenters IA : base « Frontier Data Centers » d'Epoch AI (licence CC BY 4.0, https://epoch.ai/data/data-centers).
// Règles : on ne recopie que ce que la base dit (puissance, puces, propriétaire, dates) ; rien n'est estimé ici.
// Les coordonnées viennent d'OpenStreetMap (Nominatim) ; elles sont gardées d'une collecte à l'autre, et marquées « adresse » ou « commune ».
export const EPOCH_PAGE = "https://epoch.ai/data/data-centers";
export const EPOCH_SITES = "https://epoch.ai/data/data_centers/data_centers.csv";
export const EPOCH_TIMELINES = "https://epoch.ai/data/data_centers/data_center_timelines.csv";
const UA = "whatsgoingonwithai-datacenter-map/1.0 (https://whatsgoingonwithai.com)";
const DAY = 86400000;

/** CSV (RFC 4180 : guillemets, virgules et retours à la ligne dans les champs) → tableau d'objets. */
export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const num = (s) => { const n = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
/** « Cipher Mining #confident » → « Cipher Mining » (les étiquettes de confiance d'Epoch sont gardées à part). */
export function splitTag(s) {
  const m = String(s || "").match(/#(confident|likely|speculative)\b/i);
  return { text: String(s || "").replace(/#\w+/g, "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim(), conf: m ? m[1].toLowerCase() : null };
}
/** Premier lien Markdown de la colonne « Selected Sources » (https uniquement). */
export function firstSource(s) {
  const m = String(s || "").match(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/);
  return m ? { t: m[1].replace(/\s+/g, " ").trim().slice(0, 140), u: m[2] } : null;
}
const slug = (n) => String(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Jalons à venir d'un site : lignes datées après `now`, avec une puissance connue. */
export function futureOf(rows, now) {
  const out = [];
  for (const r of rows) {
    const t = Date.parse(r.Date); if (!Number.isFinite(t) || t <= now) continue;
    const mw = num(r["IT power (MW)"]), h = num(r["H100 equivalents"]); // même mesure que « Current power (MW) » : la puissance informatique (IT)
    if (!(mw > 0)) continue;
    out.push({ d: r.Date, mw: Math.round(mw), h100e: h > 0 ? Math.round(h) : null, note: r["Construction status"].replace(/\s+/g, " ").slice(0, 160) });
  }
  out.sort((a, b) => a.d.localeCompare(b.d));
  return out;
}

/** Document final. `geo` : { nom du site → {lat, lon, prec} }. Les sites sans coordonnées sont comptés, pas affichés. */
export function buildDatacenters({ sites, timelines, geo, now }) {
  const by = new Map();
  for (const r of timelines) { if (!by.has(r["Data center"])) by.set(r["Data center"], []); by.get(r["Data center"]).push(r); }
  const out = []; let unplaced = 0;
  for (const s of sites) {
    const name = s.Name; if (!name) continue;
    const g = geo[name];
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) { unplaced++; continue; }
    const owner = splitTag(s.Owner), users = splitTag(s.Users), project = splitTag(s.Project);
    const fut = futureOf(by.get(name) || [], now);
    const mw = num(s["Current power (MW)"]) || 0, h = num(s["Current H100 equivalents"]) || 0, cost = num(s["Current total capital cost (2025 USD billions)"]);
    const peak = fut.length ? fut[fut.length - 1] : null;
    out.push({
      id: slug(name), name, owner: owner.text || null, owner_conf: owner.conf, users: users.text || null, project: project.text || null,
      country: s.Country || null, lat: g.lat, lon: g.lon, prec: g.prec === "adresse" ? "adresse" : "commune",
      mw: Math.round(mw), h100e: Math.round(h), cost_bn: cost != null ? Math.round(cost * 10) / 10 : null,
      chips: splitTag(s["Current chip types"]).text || null,
      next: fut[0] || null, peak: peak && peak.mw > mw ? peak : null,
      src: firstSource(s["Selected Sources"]),
    });
  }
  out.sort((a, b) => b.mw - a.mw || b.h100e - a.h100e || a.name.localeCompare(b.name));
  return {
    generated_at: new Date(now).toISOString(), as_of: new Date(now).toISOString().slice(0, 10),
    source: { name: "Epoch AI — Frontier Data Centers", url: EPOCH_PAGE, license: "CC BY 4.0", note: "Base non exhaustive, centrée sur les plus grands sites américains et chinois (2024-2028)." },
    unplaced, sites: out,
  };
}

/** Géocodage Nominatim : une requête par seconde, au plus `max` nouveaux sites par collecte. */
export async function geocode(q, { fetchImpl = fetch } = {}) {
  const r = await fetchImpl("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("Nominatim " + r.status);
  const j = await r.json();
  return j[0] ? { lat: +(+j[0].lat).toFixed(4), lon: +(+j[0].lon).toFixed(4) } : null;
}

export async function collectDatacenters({ fetchImpl = fetch, prev, seed = {}, now = Date.now(), log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxGeo = 8 } = {}) {
  const get = async (u) => { const r = await fetchImpl(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000), redirect: "follow" }); if (!r.ok) throw new Error(`${u} → ${r.status}`); return r.text(); };
  const [a, b] = await Promise.all([get(EPOCH_SITES), get(EPOCH_TIMELINES)]);
  const sites = parseCsv(a), timelines = parseCsv(b);
  if (sites.length < 50 || !sites[0].Name || !("Current power (MW)" in sites[0])) throw new Error("base Epoch illisible (colonnes changées ?)");
  if (!timelines.length || !("IT power (MW)" in timelines[0])) throw new Error("calendrier Epoch illisible (colonnes changées ?)");
  const known = Object.fromEntries(((prev && prev.sites) || []).map((s) => [s.name, { lat: s.lat, lon: s.lon, prec: s.prec }]));
  const geo = { ...seed, ...known };
  let n = 0;
  for (const s of sites) {
    if (geo[s.Name] || n >= maxGeo || !s.Address) continue;
    try { const g = await geocode(`${s.Address}, ${s.Country}`, { fetchImpl }); n++; await sleep(1100); if (g) geo[s.Name] = { ...g, prec: "adresse" }; }
    catch (e) { log(`Datacenters : géocodage de « ${s.Name} » impossible (${String(e.message).slice(0, 60)})`); break; }
  }
  const doc = buildDatacenters({ sites, timelines, geo, now });
  if (doc.sites.length < 50) throw new Error(`seulement ${doc.sites.length} site(s) localisé(s) : on garde l'ancienne carte`);
  return { doc, summary: { sites: doc.sites.length, unplaced: doc.unplaced, geocoded: n } };
}
