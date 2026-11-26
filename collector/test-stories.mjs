// Tests hors ligne de « Actualités regroupées » : regroupement prudent, titre et résumé validés, reprise du texte déjà rédigé.
import assert from "node:assert/strict";
import { groupItems, buildStories, summarizeStories } from "./stories.mjs";

const now = Date.parse("2026-11-26T12:00:00Z"), ts = (h) => new Date(now - h * 3600e3).toISOString();
let n = 0;
const it = (title, source, h, o = {}) => ({ id: "a" + ++n, title, orig: o.orig || title, summary: o.summary || "", source, ts: ts(h), importance: 2, category: o.category || "infra", layer: o.layer || "Autre", ...o });
const filler = Array.from({ length: 40 }, (_, k) => it(`Sujet distinct ${k} chronique ${k}x${k} semaine`, "Divers" + k, 30 + k));

// même actualité, médias différents : un groupe ; autre actualité : un autre groupe ou aucun
const a1 = it("Applied Digital signs 18-year hyperscaler lease worth 5.4 billion dollars", "DCD", 5);
const a2 = it("Applied Digital lands hyperscaler lease for 150 MW AI campus, 5.4 billion dollars", "CNBC", 4);
const a3 = it("Applied Digital hyperscaler lease boosts revenue backlog 18 years", "Reuters", 3);
const b1 = it("Megaspeed blacklisted by the US over Nvidia chip smuggling probe", "Reuters", 6, { category: "geo" });
const b2 = it("US blacklists Megaspeed over Nvidia chip smuggling probe", "Nikkei", 5, { category: "geo" });
const c1 = it("Etix launches 23 MW data center in Bangkok", "DCD", 7);
const c2 = it("NTT signs memorandum with B.Grimm for 400 MW data center project", "DCD", 8);
const g = groupItems([...filler, a1, a2, a3, b1, b2, c1, c2], now);
const sets = g.map((x) => x.items.map((i) => i.id).sort().join());
assert.ok(sets.includes([a1, a2, a3].map((i) => i.id).sort().join()), "trois articles sur le même bail : un groupe");
assert.ok(sets.includes([b1, b2].map((i) => i.id).sort().join()), "Megaspeed : un groupe");
assert.equal(g.some((x) => x.items.includes(c1) || x.items.includes(c2)), false, "deux articles du même média, sujets différents : pas de groupe");
assert.equal(g.length, 2, "aucun amalgame avec les autres articles");

// un groupe exige au moins deux médias différents
const s1 = it("Vertiv expands 800VDC power portfolio for AI data centers", "DCD", 2), s2 = it("Vertiv expands 800VDC power portfolio for AI data centers market", "DCD", 1);
assert.equal(groupItems([...filler, s1, s2], now).length, 0, "même média seulement : pas de groupe");

// écart de plus de 72 h : pas de groupe
const o1 = it("Apple removes MiniMax Talkie chatbot from App Store over minors safety", "Reuters", 2), o2 = it("Apple removes MiniMax Talkie chatbot from App Store over minors safety", "SCMP", 100);
assert.equal(groupItems([...filler, o1, o2], now).length, 0, "articles trop éloignés dans le temps");

// reprise du texte déjà rédigé, identifiants stables
const built = buildStories({ items: [...filler, a1, a2, a3], prev: null, now });
assert.equal(built.length, 1); assert.equal(built[0].n, 3); assert.equal(built[0].media, 3);
built[0].head = "Applied Digital signe un bail"; built[0].summary = "Résumé."; built[0].sn = 3;
const again = buildStories({ items: [...filler, a1, a2, a3, it("Applied Digital hyperscaler lease backlog revenue 5.4 billion dollars analysis", "Mint", 1)], prev: { stories: built }, now });
assert.equal(again[0].id, built[0].id, "identifiant conservé quand le groupe grandit");
assert.equal(again[0].head, "Applied Digital signe un bail", "titre déjà rédigé conservé");

// rédaction : validée (chiffres issus des articles), refusée sinon
const byId = new Map([a1, a2, a3].map((i) => [i.id, i]));
const fresh = buildStories({ items: [...filler, a1, a2, a3], prev: null, now });
const good = async (inp) => inp.map((x) => ({ i: x.i, head: "Applied Digital obtient un bail de 5,4 Md$", summary: "Un bail de 18 ans pour 150 MW avec un hyperscaler.", head_en: "Applied Digital lands a $5.4 billion lease", summary_en: "An 18-year lease for 150 MW with a hyperscaler." }));
let r = await summarizeStories({ stories: fresh, byId, generate: good });
assert.equal(r.changed, 1); assert.ok(fresh[0].head && fresh[0].summary && fresh[0].head_en && fresh[0].sn === 3);
const bad = buildStories({ items: [...filler, a1, a2, a3], prev: null, now });
const invented = async (inp) => inp.map((x) => ({ i: x.i, head: "Applied Digital obtient un bail de 9 milliards de dollars", summary: "Un bail de 18 ans.", head_en: "x", summary_en: "y" }));
r = await summarizeStories({ stories: bad, byId, generate: invented });
assert.equal(r.changed, 0, "un chiffre inventé fait refuser la rédaction"); assert.equal(bad[0].head, undefined);
assert.equal((await summarizeStories({ stories: bad, byId, generate: null })).reason, "Gemini indisponible");
assert.equal((await summarizeStories({ stories: bad, byId, generate: async () => null })).changed, 0);

console.log("test-stories OK");
