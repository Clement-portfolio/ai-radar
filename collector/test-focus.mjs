// Tests du « Briefing du jour » (hors réseau).
import assert from "node:assert/strict";
import { pickStories, relatedFor, validateStories, selectDistinct, makeFocus, FOCUS_RULES } from "./focus.mjs";

const now = Date.parse("2026-11-16T12:00:00Z");
const H = 3600e3, D = 24 * H;
const mk = (id, ageH, title, summary, o = {}) => ({ id, ts: new Date(now - ageH * H).toISOString(), title, summary, source: "S" + id, country: "US", category: "puces", layer: "Puces", importance: 3, confidence: "moyenne", ...o });
const items = [
  // une grande histoire : trois médias, dont un article de plus de 3 jours (évolution d'une news de la semaine)
  mk("a", 3, "Nvidia livre sa nouvelle puce Rubin aux clients cloud", "Nvidia annonce la livraison de Rubin, 3 fois plus rapide."),
  mk("a2", 30, "Nvidia commence la livraison de la puce Rubin aux clients cloud", "Les premiers clients cloud reçoivent Rubin."),
  mk("a3", 90, "Nvidia confirme la livraison de la puce Rubin aux clients cloud", "Livraison de Rubin lancée chez Nvidia aux clients cloud."),
  mk("a0", 20 * 24, "Nvidia dévoile la puce Rubin pour les centres de données", "Rubin doit succéder à Blackwell chez Nvidia.", { importance: 2 }),
  mk("a1", 60 * 24, "Nvidia confirme que Rubin arrivera avant la fin de l'année", "Calendrier de Rubin avancé.", { importance: 2 }),
  mk("b", 5, "Les États-Unis durcissent les licences d'exportation de puces vers la Chine", "Washington impose des licences pour l'accès à distance.", { category: "regul" }),
  mk("c", 6, "OpenAI lève 40 milliards de dollars", "Un tour de table de 40 milliards de dollars.", { category: "capex" }),
  mk("d", 7, "Un petit sujet mineur sur la mode", "Rien à voir.", { importance: 1, category: "adoption" }),
  mk("e", 200, "Vieille actualité de plus de sept jours sur la fonderie", "Trop ancienne.", { category: "puces" }),
];
for (let k = 0; k < 25; k++) items.push(mk("f" + k, 8 + k, `Autre sujet distinct numéro ${k} mot${k}x mot${k}y mot${k}z`, `Résumé ${k}.`, { importance: 1, category: "adoption" }));

// sélection par histoire : articles du même sujet regroupés, importance haute d'abord, plus de 7 jours exclus, mineurs exclus
const st = pickStories(items, now, 3, 2);
assert.equal(st.length, 3);
assert.ok(st.every((s) => s.lead.importance >= 2), "histoires importantes seulement");
const rubin = st.find((s) => s.lead.id.startsWith("a"));
assert.deepEqual(rubin.items.map((a) => a.id).sort(), ["a", "a2", "a3"], "trois articles du même sujet regroupés, dont un vieux de plusieurs jours");
assert.equal(rubin.media, 3, "médias distincts comptés");
assert.ok(!st.some((s) => s.items.some((a) => a.id === "e")), "plus de 7 jours : exclu");
assert.ok(!st.some((s) => s.items.some((a) => a.id === "d")), "article mineur exclu");

// plusieurs histoires du même pays et du même sujet : permis (un malus léger seulement, jamais d'exclusion)
const same = [mk("g1", 2, "Alpha chute en bourse après les résultats trimestriels", "Alpha recule.", { category: "capex" }), mk("g2", 3, "Bêta grimpe grâce à un contrat cloud géant", "Bêta monte.", { category: "capex" }), mk("g3", 4, "Gamma annonce une levée de fonds record", "Gamma lève.", { category: "capex" })];
assert.equal(pickStories(same, now, 3, 2).length, 3, "trois histoires de la même catégorie et du même pays");

// remise en contexte : articles plus anciens sur le même sujet seulement
const rel = relatedFor(rubin, items, now);
assert.deepEqual(rel.map((o) => o.id), ["a1", "a0"], "plus anciens, même sujet, du plus ancien au plus récent");
assert.deepEqual(relatedFor(st.find((s) => s.lead.id === "b"), items, now), [], "aucun article lié : pas de contexte");

// règles ancrées en dur
assert.deepEqual([FOCUS_RULES.stories, FOCUS_RULES.minBullets, FOCUS_RULES.maxBullets], [3, 2, 4], "3 actualités, 2 à 4 puces");

// validation : titre + 2 à 4 puces utiles, chacune d'un type connu
const arts = rubin.items.map((a, m) => ({ a: m + 1, title: a.title, summary: a.summary }));
const inputs = [{ i: 1, articles: arts, background: [{ j: 1, title: items[4].title, summary: items[4].summary }, { j: 2, title: items[3].title, summary: items[3].summary }] }];
const B = (kind, text, text_en, ctx = []) => ({ kind, text, text_en, ctx });
const T = { i: 1, head: "Nvidia livre Rubin à ses clients cloud", head_en: "Nvidia ships Rubin to cloud customers", bullets: [
  B("detail", "La puce est 3 fois plus rapide que la précédente.", "The chip is 3 times faster than the previous one."),
  B("contexte", "Rubin devait succéder à Blackwell, selon l'annonce de décembre.", "Rubin was meant to succeed Blackwell.", [2]),
  B("explication", "Les premiers clients cloud reçoivent Rubin avant le grand public.", "The first cloud customers receive Rubin before the public."),
] };
const good = validateStories([T], inputs);
assert.equal(good[0].bullets.length, 3); assert.deepEqual(good[0].kinds, ["detail", "contexte", "explication"]); assert.equal(good[0].bullets_en.length, 3); assert.deepEqual(good[0].ctx, [2]);
assert.ok(good[0].head_en);
const withB = (bullets, extra = {}) => validateStories([{ ...T, bullets, ...extra }], inputs);

// une puce qui répète le titre est retirée ; il reste les autres
const rep = withB([...T.bullets.slice(0, 2), B("detail", "Nvidia livre Rubin aux clients cloud.", "x")]);
assert.equal(rep[0].bullets.length, 2, "puce qui répète le titre : retirée");
// un détail sans nombre ni nom propre nouveau : retiré
assert.equal(withB([...T.bullets.slice(0, 2), B("detail", "Les clients obtiennent aujourd'hui leurs machines dédiées.", "x")])[0].bullets.length, 2, "détail sans fait nouveau : retiré");
// la même information dite deux fois : la seconde est retirée
assert.equal(withB([T.bullets[0], T.bullets[1], B("detail", "Cette puce est 3 fois plus rapide que la précédente.", "x")])[0].bullets.length, 2, "doublon entre puces : retiré");
// type inconnu, nombre inventé, nombre en toutes lettres, formule creuse : puce retirée
for (const bad of [B("analyse", "Une puce de type inconnu avec 3 mentions.", "x"), B("detail", "Un gain de 777 % est attendu chez Nvidia.", "x"), B("detail", "Trois fois plus rapide, selon Nvidia.", "x"), B("explication", "Cela veut dire que Rubin arrive vite.", "x"), B("explication", "Concrètement, rien ne change pour Nvidia.", "x")]) assert.equal(withB([...T.bullets.slice(0, 2), bad])[0].bullets.length, 2, "puce retirée : " + bad.text);
// anglais creux : puce retirée dans les deux langues
assert.equal(withB([...T.bullets.slice(0, 2), B("explication", "Les premiers clients cloud reçoivent Rubin avant le grand public.", "This means that the schedule holds.")])[0].bullets.length, 2, "anglais creux : puce retirée");
// contexte sans article plus ancien cité : retiré
assert.equal(withB([T.bullets[0], B("contexte", "Rubin devait succéder à Blackwell, selon l'annonce de décembre.", "x", []), T.bullets[2]])[0].bullets.length, 2, "contexte sans source ancienne : retiré");
// pas plus de 4 puces
assert.equal(withB([...T.bullets, B("explication", "Le calendrier annoncé pour la fin de l'année est avancé.", "x"), B("explication", "Blackwell reste proposée aux acheteurs plus lents.", "x")])[0].bullets.length, 4, "4 puces au plus");
// moins de 2 puces utiles : histoire rejetée
assert.equal(withB([T.bullets[0]]), null, "une seule puce : histoire rejetée");
assert.equal(withB([T.bullets[0], B("detail", "Nvidia livre Rubin à ses clients cloud.", "x")]), null, "une seule puce utile : histoire rejetée");
assert.equal(withB(T.bullets, { head: "x".repeat(200) }), null, "titre trop long : rejeté");
assert.equal(withB(T.bullets, { head: "Gain de 777 % pour Nvidia" }), null, "nombre inventé dans le titre : rejeté");
assert.equal(withB(T.bullets, { head: "川普訪華" }), null, "écriture non latine : rejeté");
assert.equal(withB(T.bullets, { head: "" }), null, "titre vide : rejeté");
// anglais sans chiffre inventé : le français reste, l'anglais est retiré
const badEn = withB([T.bullets[0], { ...T.bullets[1], text_en: "A gain of 777% expected." }, T.bullets[2]]);
assert.equal(badEn[0].bullets.length, 3); assert.equal(badEn[0].bullets_en, null, "anglais invalide : retiré, le français reste");

// 3 histoires DISTINCTES : même dossier ou article en commun, écarté
const cands = [{ items: [{ id: "x1" }] }, { items: [{ id: "x2" }] }, { items: [{ id: "x1" }, { id: "x3" }] }, { items: [{ id: "x4" }] }, { items: [{ id: "x5" }] }];
const V = (i, head) => ({ i, head, bullets: ["b", "c"], kinds: ["detail", "detail"], ctx: [], head_en: null, bullets_en: null });
const sel = selectDistinct([V(1, "Nvidia arrête ses ventes de puces avancées en Chine"), V(2, "La Chine menace de représailles face aux restrictions sur les puces"), V(3, "Un tout autre sujet mais un article partagé"), V(4, "Les centres de données américains consomment plus d'électricité qu'un pays"), V(5, "Le portefeuille numérique de ChatGPT permet aux agents de payer")], cands);
assert.deepEqual(sel.map((s) => s.i), [1, 4, 5], "même dossier (puces et Chine) et article partagé écartés ; 3 histoires gardées");
assert.equal(selectDistinct([V(1, "Alpha"), V(2, "Bêta")], cands).length, 2, "moins de 3 : on rend ce qui existe");

// sélection : une histoire trop proche d'une histoire déjà retenue n'est pas proposée
const sag = [
  mk("s1", 2, "Nvidia cesse de vendre des puces IA avancées à la Chine", "Nvidia stoppe.", { category: "puces", layer: "Puces", country: "US" }),
  mk("s2", 3, "Nvidia cessera de vendre des puces IA avancées à la Chine, selon Bloomberg", "Nvidia stoppe.", { category: "puces", layer: "Puces", country: "US" }),
  mk("s3", 4, "Pékin menace de représailles contre les restrictions américaines sur les puces IA avancées vendues à la Chine", "La Chine réagit.", { category: "politique", layer: "Régulation", country: "CN" }),
  mk("s4", 5, "Les centres de données américains consomment plus d'électricité qu'un pays de taille moyenne", "Énergie.", { category: "energie", layer: "Énergie", country: "US" }),
];
const dis = pickStories(sag, now, 6);
assert.ok(dis.length >= 2 && !(dis.some((x) => x.items.some((a) => a.id === "s1")) && dis.some((x) => x.items.some((a) => a.id === "s3"))), "la réaction à une mesure et la mesure ne sont pas deux candidates");

// regroupement : deux sujets sans rapport ne sont jamais réunis, même avec quelques mots communs
const mix = [
  mk("w1", 2, "OpenAI lance un portefeuille numérique pour les agents IA des centres de données", "OpenAI et ses agents.", { category: "modeles", layer: "Applications" }),
  mk("w2", 3, "Le portefeuille numérique d'OpenAI permet aux agents IA de payer", "Agents IA et paiements.", { category: "modeles", layer: "Applications" }),
  mk("l1", 4, "Le refroidissement liquide direct gagne les centres de données IA haute densité", "Refroidissement des centres de données IA.", { category: "energie", layer: "Datacenters" }),
  mk("l2", 5, "Refroidissement liquide : les centres de données IA haute densité l'adoptent", "Refroidissement liquide direct.", { category: "energie", layer: "Datacenters" }),
];
const stm = pickStories(mix, now, 5, 2);
assert.equal(stm.length, 2, "deux sujets distincts");
assert.ok(stm.every((s) => s.items.every((a) => a.category === s.lead.category)), "aucune histoire ne mélange deux catégories");

// génération, conservation, régénération
let calls = 0;
const gen = (inp) => { calls++; return inp.map((x) => ({ i: x.i, head: "Titre " + ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"][x.i], head_en: "Title " + ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"][x.i], bullets: [B("detail", `Détail ${["zulu", "yankee", "xray", "whisky", "victor", "uniform", "tango"][x.i]} sur les sites choisis, selon Orion.`, "Detail."), B("explication", `Explication ${["sierra", "romeo", "quebec", "papa", "oscar", "november", "mike"][x.i]} sur le calendrier annoncé.`, "Explanation.")] })); };
const itemsA = items.filter((i) => !i.id.startsWith("f"));
let r1 = await makeFocus({ items, now, prev: null, generate: gen, modelName: () => "m" });
assert.equal(r1.regenerated, true); const c1 = calls; assert.ok(c1 >= 3 && c1 <= 6, "une requête par histoire, arrêt dès 3 valides"); assert.equal(r1.doc.stories.length, 3, "exactement 3 actualités");
assert.equal(r1.doc.v, 2); assert.equal(r1.doc.rules.stories, 3);
assert.ok(r1.doc.stories.every((s) => s.ids.length >= 1 && s.bullets.length >= 2 && s.bullets.length <= 4 && s.bullets_en.length === s.bullets.length && s.kinds.length === s.bullets.length && s.ts));
let r2 = await makeFocus({ items, now: now + H, prev: r1.doc, generate: gen });
assert.equal(r2.regenerated, false); assert.equal(calls, c1, "mêmes histoires : aucun nouvel appel");
let r3 = await makeFocus({ items, now: now + 7 * H, prev: r1.doc, generate: gen });
assert.equal(r3.regenerated, true, "plus de 6 h : régénéré"); assert.ok(calls > c1);
const items2 = [...items, mk("z", 0.5, "Événement majeur tout neuf sur les centres de données", "Un événement.", { category: "energie" }), mk("z2", 0.4, "Événement majeur tout neuf pour les centres de données", "Un événement.", { category: "energie" })];
let r4 = await makeFocus({ items: items2, now, prev: r1.doc, generate: gen });
assert.equal(r4.regenerated, true, "nouvelle histoire : régénéré");
const r5 = await makeFocus({ items, now: now + 8 * H, prev: r1.doc, generate: () => null });
assert.equal(r5.regenerated, false); assert.equal(r5.doc.stories.length, 3, "Gemini indisponible : dernier briefing conservé");
const r6 = await makeFocus({ items, now: now + 8 * H, prev: r1.doc, generate: () => [{ i: 1, head: "Titre", head_en: "", bullets: [B("detail", "Gain de 999 %", ""), B("detail", "Autre 888 %", "")] }] });
assert.equal(r6.regenerated, false); assert.match(r6.reason, /rejeté/);
// moins de 3 histoires distinctes valides : on garde l'ancien briefing à 3 histoires
const r8 = await makeFocus({ items, now: now + 8 * H, prev: r1.doc, generate: (inp) => (inp[0].i === 1 ? gen(inp) : []) });
assert.equal(r8.regenerated, false); assert.match(r8.reason, /moins de 3/); assert.equal(r8.doc.stories.length, 3);
// sans ancien briefing, on publie ce qui existe plutôt que rien
const r9 = await makeFocus({ items, now, prev: null, generate: (inp) => (inp[0].i <= 2 ? gen(inp) : []) });
assert.equal(r9.regenerated, true); assert.equal(r9.doc.stories.length, 2);
// 2 histoires valides et un briefing de plus de 18 h : on publie les 2 fraîches plutôt que 3 de la veille
const r11 = await makeFocus({ items, now: now + 20 * H, prev: r1.doc, generate: (inp) => (inp[0].i <= 2 ? gen(inp) : []) });
assert.equal(r11.regenerated, true); assert.equal(r11.doc.stories.length, 2, "briefing périmé remplacé par 2 histoires");
// le modèle renvoie plus d'histoires que nécessaire : les 3 premières valides sont retenues, les suivantes servent de réserve
const r12 = await makeFocus({ items, now: now + 20 * H, prev: r1.doc, generate: (inp) => (inp[0].i === 1 ? [{ i: 1, head: "", head_en: "", bullets: [] }] : gen(inp)) });
assert.equal(r12.doc.stories.length, 3, "une histoire invalide ne bloque plus le briefing");
assert.ok(Array.isArray(r12.diag) && r12.diag.length >= 1, "raisons de rejet conservées");
const oldDoc = { items: [{ id: "a", why: "ancien format" }] };
const r7 = await makeFocus({ items, now, prev: oldDoc, generate: gen });
assert.equal(r7.regenerated, true, "ancien format de document : remplacé");
// ancien briefing à 5 histoires (sans « v ») : régénéré même si rien n'a changé
const legacy = { generated_at: new Date(now).toISOString(), sig: r1.doc.sig, stories: Array.from({ length: 5 }, () => ({ ids: ["a"], head: "h", bullets: ["b", "c"] })) };
const r10 = await makeFocus({ items, now: now + H, prev: legacy, generate: gen });
assert.equal(r10.regenerated, true); assert.equal(r10.doc.stories.length, 3, "5 anciennes histoires remplacées par 3");
console.log("Tests « Briefing du jour » : OK");
