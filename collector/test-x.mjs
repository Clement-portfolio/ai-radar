import assert from "node:assert/strict";
import fs from "node:fs";
import { dayPlan, buildQuery, collectX, applyRow, pressRelay, silentAccounts, chunkList, X_RULES } from "./x.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("./x-accounts.json", import.meta.url), "utf8"));
const now = Date.parse("2026-11-21T18:00:00Z");

// plan : plafond de 100 posts, requêtes sous la limite de X, rotation de l'étage 2, filtre IA sur le flux
const plan = dayPlan(cfg, now), plan2 = dayPlan(cfg, now + 864e5);
assert.ok(plan.reduce((s, p) => s + p.max, 0) <= cfg.caps.day, "plafond du jour");
assert.ok(plan.every((p) => p.query.length <= 500 && p.max >= 10 && p.max <= 100), "requêtes et tailles valides");
assert.ok(plan.every((p) => /-is:retweet -is:reply/.test(p.query)), "retweets et réponses exclus");
const t2a = plan.filter((p) => p.tier === "t2").flatMap((p) => p.handles), t2b = plan2.filter((p) => p.tier === "t2").flatMap((p) => p.handles);
assert.equal(t2a.length + t2b.length, cfg.t2.length, "l'étage 2 est couvert en 2 jours");
assert.ok(!t2a.some((h) => t2b.includes(h)), "pas de chevauchement entre les 2 jours");
assert.deepEqual(plan.filter((p) => p.tier === "t1").flatMap((p) => p.handles), cfg.t1, "étage 1 lu en entier chaque jour");
assert.ok(plan.filter((p) => p.tier === "flux").every((p) => /\(AI OR /.test(p.query)), "flux filtré par mots-clés IA");
assert.equal(buildQuery(["a", "b"]), "(from:a OR from:b) -is:retweet -is:reply");
assert.equal(chunkList([1, 2, 3, 4, 5], 2).length, 3);

// réponses simulées de X
let calls = [], usersAsked = 0;
const handles = [...cfg.t1, ...cfg.t2, ...cfg.flux];
const idOf = (h) => String(1000 + handles.indexOf(h));
let seq = 0;
const mkFetch = (status = 200, perCall = 3) => async (url) => {
  const u = new URL(url); calls.push(u.searchParams.get("query"));
  if (u.searchParams.get("expansions")) usersAsked++;
  if (status !== 200) return { ok: false, status, text: async () => '{"title":"CreditsDepleted"}' };
  const hs = [...u.searchParams.get("query").matchAll(/from:(\w+)/g)].map((m) => m[1]);
  const data = hs.slice(0, perCall).map((h, k) => ({ id: String(++seq), author_id: idOf(h), created_at: new Date(now - (k + 1) * 3600e3).toISOString(), text: `${h} says Nvidia ships 5000 new GPUs to datacenters this quarter https://t.co/x${seq}`, public_metrics: { like_count: 10, retweet_count: 1, reply_count: 0, quote_count: 0 }, lang: "en" }));
  const body = { data, meta: { result_count: data.length } };
  if (u.searchParams.get("expansions")) body.includes = { users: hs.slice(0, perCall).map((h) => ({ id: idOf(h), username: h })) };
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
const gen = async (inputs) => inputs.map((x) => ({ i: x.i, keep: x.i % 2 === 0, kind: "annonce", domain: "calcul", imp: x.i === 0 ? 3 : 2, title_fr: `${x.author} annonce une livraison de 5000 GPU`, title_en: `${x.author} announces 5000 GPUs shipped`, text_fr: x.text.replace("says", "dit") }));
const sleep = async () => {};

const r1 = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: gen, prev: null, feed: [], now, sleep });
assert.ok(r1.summary.read > 0 && r1.summary.read <= cfg.caps.day, "lecture sous le plafond");
assert.ok(r1.doc.items.length > 0 && r1.doc.items.length <= X_RULES.perDay, "au plus 10 entrées par passage");
assert.ok(r1.doc.items.every((x) => x.handle && /^https:\/\/x\.com\/\w+\/status\/\d+$/.test(x.url)), "pseudo et lien du post");
assert.ok(r1.doc.items.every((x) => x.title && !/["«»]/.test(x.title)), "titre rapporté, sans guillemets");
assert.ok(usersAsked > 0, "premier passage : les identifiants d'auteurs sont demandés");
assert.ok(Object.keys(r1.doc.ids).length > 0 && r1.doc.usage.days["2026-11-21"] === r1.summary.read, "identifiants et lectures mémorisés");
assert.ok(!r1.doc.items.some((x) => /https?:\/\//.test(x.text)), "liens retirés du texte");

// même jour : plafond atteint → aucun appel ; avec force → relit
const c0 = calls.length;
const r2 = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: gen, prev: { ...r1.doc, usage: { ...r1.doc.usage, days: { "2026-11-21": 100 } } }, feed: [], now: now + 600e3, sleep });
assert.equal(calls.length, c0, "plafond du jour : aucun appel");
assert.match(r2.summary.reason, /plafond du jour/);

// lendemain : identifiants connus → plus de demande d'auteurs pour les comptes qui en ont un
const known = r1.doc, ua = usersAsked;
const r3 = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: gen, prev: known, feed: [], now: now + 864e5, sleep });
assert.ok(usersAsked - ua <= calls.length, "pas d'erreur");
assert.ok(r3.doc.items.length >= r1.doc.items.length, "les entrées précédentes sont conservées");
assert.equal(new Set(r3.doc.items.map((x) => x.id)).size, r3.doc.items.length, "pas de doublon");

// crédit épuisé : on s'arrête au premier refus, sans rien casser
calls = [];
const r4 = await collectX({ cfg, fetchImpl: mkFetch(402), token: "T", generate: gen, prev: known, feed: [], now: now + 2 * 864e5, sleep });
assert.equal(calls.length, 1, "arrêt au premier refus 402");
assert.match(r4.summary.reason, /aucun post lu/);
assert.deepEqual(r4.doc.items, known.items, "données précédentes intactes");

// pas de token, plafond mensuel
assert.match((await collectX({ cfg, fetchImpl: mkFetch(), token: "", prev: null, now })).summary.reason, /non configuré/);
const rm = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: gen, prev: { ...known, usage: { days: {}, months: { "2026-11": cfg.caps.month } } }, now: now + 864e5, sleep });
assert.match(rm.summary.reason, /plafond du mois/);

// sans IA : seul l'étage 1 est publié, marqué « en attente », jamais de titre inventé
const r5 = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: null, prev: null, feed: [], now, sleep });
assert.ok(r5.doc.items.length > 0 && r5.doc.items.every((x) => x.pending && x.tier === "t1" && !x.title), "secours sans IA");

// validation du modèle : un chiffre inventé fait rejeter le titre, mais pas le post
const inp = { text: "Nvidia ships 5000 GPUs" };
assert.equal(applyRow({ keep: true, kind: "annonce", domain: "calcul", imp: 3, title_fr: "Nvidia livre 6000 GPU", title_en: "Nvidia ships 5000 GPUs", text_fr: "Nvidia livre 5000 GPU" }, inp).title, undefined);
assert.equal(applyRow({ keep: true, kind: "annonce", domain: "calcul", imp: 3, title_fr: "Nvidia livre 5000 GPU", title_en: "x", text_fr: "x" }, inp).title, "Nvidia livre 5000 GPU");
assert.equal(applyRow({ keep: true, kind: "zzz", domain: "zzz", imp: 9, title_fr: "", title_en: "", text_fr: "" }, inp).kind, "autre");
assert.equal(applyRow({ keep: true, kind: "autre", domain: "autre", imp: 9, title_fr: "", title_en: "", text_fr: "" }, inp).imp, 3);

// relais par la presse : au moins 3 mots rares en commun, autres médias comptés une fois chacun
const post = { text: "Anthropic raises 30 billion at 1750 billion valuation in record IPO debut", ts: "2026-11-21T10:00:00Z" };
const feed = [
  { orig: "Anthropic IPO debut at 1750 billion valuation record", source: "Reuters", ts: "2026-11-21T09:00:00Z" },
  { orig: "Anthropic record IPO debut valuation 1750 billion", source: "Reuters", ts: "2026-11-21T09:30:00Z" },
  { orig: "Anthropic IPO debut record valuation reaches 1750 billion", source: "Bloomberg", ts: "2026-11-21T11:00:00Z" },
  { orig: "Samsung suspends chip shipments to China", source: "CNBC", ts: "2026-11-21T09:00:00Z" },
];
assert.equal(pressRelay(post, feed, Date.parse("2026-11-21T18:00:00Z")), 2, "2 médias différents");
assert.equal(pressRelay({ text: "Totally unrelated robotics humanoid walking demonstration video", ts: post.ts }, feed, Date.parse("2026-11-21T18:00:00Z")), 0);

// comptes muets
assert.ok(silentAccounts(cfg, { stats: { sama: { read: 3 } } }).length === handles.length - 1);
console.log("test-x : OK");
