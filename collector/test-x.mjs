import assert from "node:assert/strict";
import fs from "node:fs";
import { pickDay, dayPlan, buildQuery, collectX, applyRow, pressRelay, silentAccounts, chunkList, X_RULES, matchRelevance, sourceClass, scorePost } from "./x.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("./x-accounts.json", import.meta.url), "utf8"));
const now = Date.parse("2026-11-21T18:00:00Z");

// plan : plafond de 100 posts, requêtes sous la limite de X, rotation de l'étage 2, filtre IA sur le flux
const plan = dayPlan(cfg, now), plan2 = dayPlan(cfg, now + 864e5);
assert.ok(plan.reduce((s, p) => s + p.max, 0) <= cfg.caps.run, "plafond par passage");
assert.ok(plan.every((p) => p.query.length <= 500 && p.max >= 10 && p.max <= 100), "requêtes et tailles valides");
assert.ok(plan.every((p) => /-is:retweet -is:reply/.test(p.query)), "retweets et réponses exclus");
const t2a = plan.filter((p) => p.tier === "t2").flatMap((p) => p.handles), t2b = plan2.filter((p) => p.tier === "t2").flatMap((p) => p.handles);
assert.ok(plan.every((p) => p.handles.length > 0), "lots de comptes non vides");
assert.ok(new Set(plan.slice(0,3).map((p)=>p.tier)).size === 3, "les trois familles de sources sont réparties dans le budget");
assert.equal(X_RULES.perRun, 20);
assert.equal(X_RULES.perDay, 40);
assert.ok(plan.every((p) => p.query.includes("TSMC") && p.query.includes("AI")), "watchlist et signaux IA appliqués à chaque compte suivi");
assert.equal(buildQuery(["a", "b"]), "(from:a OR from:b) -is:retweet -is:reply");
assert.equal(chunkList([1, 2, 3, 4, 5], 2).length, 3);


// Watchlist : les publications hors IA des entreprises diversifiées sont exclues.
assert.equal(matchRelevance("SpaceX and Qualcomm launch a terrestrial 5G network", cfg).relevant, false);
assert.equal(matchRelevance("Apple expands AI server capacity for its new model training", cfg).relevant, true);
assert.equal(matchRelevance("Nvidia reports HBM supply constraints for AI accelerators", cfg).relevant, true);
assert.equal(matchRelevance("The FED holds rates steady as inflation cools", cfg).relevant, false);
assert.equal(matchRelevance("Phonic 1.1 leads the Speech to Speech benchmark", cfg).relevant, true);
assert.equal(sourceClass("PhotonCap", "t1", cfg), "analyst");
assert.equal(sourceClass("OpenAI", "t2", cfg), "official");
const ranked = scorePost({handle:"PhotonCap",tier:"t1",text:"TSMC raises CoWoS capacity for AI GPU demand",relevance:{watchlist:["TSMC"],signals:["AI","GPU","CoWoS"]},v:{imp:3},eng:20},cfg);
assert.equal(ranked.priority,"P1");

// réponses simulées de X
let calls = [], usersAsked = 0;
const handles = [...cfg.t1, ...cfg.t2, ...cfg.flux];
const idOf = (h) => String(1000 + handles.indexOf(h));
let seq = 0;
const mkFetch = (status = 200, perCall = 3) => async (url) => {
  const u = new URL(url);
  if (u.pathname === "/2/users") { usersAsked++; const want = u.searchParams.get("ids").split(","); return { ok: true, status: 200, text: async () => JSON.stringify({ data: want.map((id) => ({ id, username: handles[Number(id) - 1000] })) }) }; }
  calls.push(u.searchParams.get("query"));
  if (u.searchParams.get("expansions")) throw new Error("expansions interdites");
  if (status !== 200) return { ok: false, status, text: async () => '{"title":"CreditsDepleted"}' };
  const hs = [...u.searchParams.get("query").matchAll(/from:(\w+)/g)].map((m) => m[1]);
  const data = hs.slice(0, perCall).map((h, k) => ({ id: String(++seq), author_id: idOf(h), created_at: new Date(now - (k + 1) * 3600e3).toISOString(), text: `${h} says Nvidia ships 5000 new GPUs to datacenters this quarter https://t.co/x${seq}`, public_metrics: { like_count: 10, retweet_count: 1, reply_count: 0, quote_count: 0 }, lang: "en" }));
  const body = { data, meta: { result_count: data.length } };
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
const gen = async (inputs) => inputs.map((x) => ({ i: x.i, keep: x.i % 2 === 0, kind: "annonce", domain: "calcul", imp: x.i === 0 ? 3 : 2, title_fr: `${x.author} annonce une livraison de 5000 GPU`, title_en: `${x.author} announces 5000 GPUs shipped`, text_fr: x.text.replace("says", "dit") }));
const sleep = async () => {};

const r1 = await collectX({ cfg, fetchImpl: mkFetch(), token: "T", generate: gen, prev: null, feed: [], now, sleep });
assert.ok(r1.summary.read > 0 && r1.summary.read <= cfg.caps.run, "lecture sous le plafond par passage");
assert.ok(r1.doc.items.length > 0 && r1.doc.items.length <= X_RULES.perDay, "au plus 12 entrées par passage");
assert.ok(r1.doc.items.every((x) => x.handle && /^https:\/\/x\.com\/\w+\/status\/\d+$/.test(x.url)), "pseudo et lien du post");
assert.ok(r1.doc.items.every((x) => x.title && !/["«»]/.test(x.title)), "titre rapporté, sans guillemets");
assert.ok(usersAsked > 0, "premier passage : les pseudos d'auteurs sont demandés (un appel groupé)");
assert.ok(!Object.keys(r1.doc.stats).some((k) => /^\d+$/.test(k)), "statistiques par pseudo, pas par identifiant");
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
assert.ok(usersAsked - ua <= 1, "un seul appel groupé, uniquement pour les nouveaux auteurs (l autre moitié de l étage 2)");
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

// séparateurs de milliers : « 879,868 » devient « 879 868 » sans faire rejeter le titre
assert.equal(applyRow({ keep: true, kind: "annonce", domain: "politique", imp: 3, title_fr: "Les régulateurs autorisent 879 868 puces", title_en: "x", text_fr: "x" }, { text: "US regulators cleared 879,868 chips" }).title, "Les régulateurs autorisent 879 868 puces");

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


// choix du jour : varié (2 posts par compte, 3 sur le marché, pas de doublon de propos)
const mk = (id, h, d, imp, text, extra = {}) => ({ id, handle: h, aid: h, tier: "t1", text, eng: 10, media: 0, v: { imp, domain: d, kind: "annonce" }, ...extra });
const pool = [
  ...[1, 2, 3, 4].map((k) => mk("k" + k, "Kobeissi", "marche", 3, `market selloff number ${k} unique wording ${k}${k} alpha${k} beta${k} gamma${k}`)),
  mk("m1", "a", "marche", 3, "stocks fall sharply alpha omega sigma delta epsilon"), mk("m2", "b", "marche", 3, "equities tumble again zeta theta kappa lambda"),
  mk("d1", "x", "calcul", 2, "Rubin shipments start in Q1 according to supply chain model"), mk("d2", "y", "calcul", 2, "Rubin shipments start in Q1 according to supply chain model today"),
  mk("r1", "z", "robotique", 2, "humanoid production line paused according to people familiar"),
];
const day = pickDay(pool, 12);
assert.ok(day.filter((f) => f.handle === "Kobeissi").length <= 2, "2 posts par compte au plus");
assert.ok(day.filter((f) => f.v.domain === "marche").length <= 3, "3 posts de marché au plus");
assert.ok(!(day.some((f) => f.id === "d1") && day.some((f) => f.id === "d2")), "même propos : une seule fois");
assert.ok(day.some((f) => f.v.domain === "robotique"), "les autres domaines passent");


// noms et rôles : publiés avec le document ; posts trop longs jamais envoyés ; nouvel essai puis écart si le titre reste refusé
{
  assert.ok(r1.doc.who && r1.doc.who.demishassabis?.name === "Demis Hassabis" && /DeepMind/.test(r1.doc.who.demishassabis.fr) && /DeepMind/.test(r1.doc.who.demishassabis.en), "nom et rôle publiés");
  const longText = "Long essay about AI. " + "word ".repeat(200);
  let sent = [], tries = 0;
  const fetchL = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/2/users") return { ok: true, status: 200, text: async () => JSON.stringify({ data: u.searchParams.get("ids").split(",").map((id) => ({ id, username: handles[Number(id) - 1000], name: "Nom " + id })) }) };
    const hs = [...u.searchParams.get("query").matchAll(/from:(\w+)/g)].map((m) => m[1]);
    const data = hs.slice(0, 3).map((h, k) => ({ id: "9" + k + h.length + h, author_id: idOf(h), created_at: new Date(now - 3600e3).toISOString(), text: k === 0 ? longText : k === 1 ? "Nvidia ships 5000 GPUs to datacenters this quarter" : "Anthropic raises 30 billion dollars", public_metrics: {}, lang: "en" }));
    return { ok: true, status: 200, text: async () => JSON.stringify({ data }) };
  };
  const genL = async (inputs) => {
    sent.push(...inputs);
    return inputs.map((x) => {
      const bad = /Nvidia/.test(x.text);
      if (x.retry) tries++;
      return { i: x.i, keep: true, kind: "info", domain: "calcul", imp: 2, title_fr: bad && !x.retry ? "Nvidia livre 9999 GPU" : "Titre sans chiffre faux " + (bad ? "pour Nvidia" : "pour Anthropic 30 milliards de dollars"), title_en: "Title", text_fr: "Traduction " + (bad && !x.retry ? "9999" : "") };
    });
  };
  const rl = await collectX({ cfg: { ...cfg, t1: ["rohanpaul_ai", "sama", "emollick"], t2: [], flux: [] }, fetchImpl: fetchL, token: "T", generate: genL, prev: null, feed: [], now, sleep });
  assert.ok(!sent.some((x) => x.text.startsWith("Long essay")), "post trop long : pas envoyé au modèle");
  assert.ok(sent.some((x) => x.name), "le nom du compte est transmis au modèle");
  assert.ok(tries >= 1, "un nouvel essai pour le titre refusé");
  assert.ok(rl.doc.items.length >= 1 && rl.doc.items.every((x) => x.title && x.text_fr), "jamais d'entrée sans titre ni traduction");
  assert.ok(rl.doc.items.every((x) => x.kind === "info"), "le genre « info » est accepté");
  const genBad = async (inputs) => inputs.map((x) => ({ i: x.i, keep: true, kind: "annonce", domain: "calcul", imp: 2, title_fr: "Chiffre inventé 7777", title_en: "Invented 7777", text_fr: "Texte 7777" }));
  const rb = await collectX({ cfg: { ...cfg, t1: ["rohanpaul_ai", "sama", "emollick"], t2: [], flux: [] }, fetchImpl: fetchL, token: "T", generate: genBad, prev: null, feed: [], now, sleep });
  assert.equal(rb.doc.items.length, 0, "titre toujours refusé après l'essai : l'entrée est écartée");
  assert.ok(rb.summary.dropped >= 1);
}

// comptes muets
assert.ok(silentAccounts(cfg, { stats: { sama: { read: 3 } } }).length === handles.length - 1);
console.log("test-x : OK");
