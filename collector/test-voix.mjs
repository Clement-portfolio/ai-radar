// Tests hors ligne de « Voix » : seuls les titres où la personne s'exprime sont retenus ; fusion, fenêtre de 30 jours, traduction contrôlée.
import assert from "node:assert/strict";
import { isStatement, collectVoix, translateVoix, hotVoix, annotateVoix, PEOPLE, INVEST_CUE, TOPIC } from "./voix.mjs";
import { parseFeed } from "./collect.mjs";

const R = (n) => PEOPLE.find((p) => p.n === n).re;
const cases = [
  ["Sam Altman says it is hard to imagine AI without Nvidia", "Sam Altman", true],
  ["AI will take jobs, says Dario Amodei", "Dario Amodei", true],
  ["Musk: ‘Critical deals will be lost’ at Nvidia without Huang", "Elon Musk", true],
  ["Andy Jassy Says Nvidia “Will Be Very Strong”", "Andy Jassy", true],
  ["Trump says Jensen Huang should return to Nvidia", "Jensen Huang", false],
  ["Analysts say Satya Nadella is wrong", "Satya Nadella", false],
  ["Mark Zuckerberg’s Meta AI Predicts a Privacy Coin Boom", "Mark Zuckerberg", false],
  ["Sundar Pichai overtakes Satya Nadella to claim top spot", "Sundar Pichai", false],
  ["Lip-Bu Tan: Latest Activity", "Lip-Bu Tan", false],
  ["Intel acquires a startup", "Lip-Bu Tan", false],
  ["Bessent blames Lutnick’s Commerce as he slams Nvidia chip leakage", "Howard Lutnick", false],
  ["Hinton warns of an AI Chernobyl by 2027", "Geoffrey Hinton", true],
];
assert.equal(isStatement("Michael Burry shorts Nvidia again", R("Michael Burry"), INVEST_CUE), true, "investisseur : une prise de position compte");
assert.equal(isStatement("Michael Burry shorts Nvidia again", R("Michael Burry")), false, "dirigeant : pas une déclaration");
assert.equal(isStatement("Warren Buffett says AI is risky", R("Elizabeth Warren")), false, "Warren Buffett n'est pas Elizabeth Warren");
assert.equal(isStatement("Warner Bros says it will cut costs", R("Mark Warner")), false, "Warner Bros n'est pas Mark Warner");
assert.equal(isStatement("Sen. Cruz says AI bill needs a vote", R("Ted Cruz")), true);
assert.equal(TOPIC.test("Ted Cruz explains how the GOP blew it in Texas"), false, "hors sujet IA");
assert.equal(TOPIC.test("Cathie Wood sells $85 million of Nvidia"), true);
assert.equal(TOPIC.test("Ray Dalio warns of a debt fight"), false);
for (const [t, n, e] of cases) assert.equal(isStatement(t, R(n)), e, t);

// collecte : fenêtre de 30 jours, doublons, vidéos par nom, échec isolé
const now = Date.parse("2026-11-18T12:00:00Z"), d = (x) => new Date(now - x * 864e5).toUTCString();
const rss = (items) => `<rss><channel>${items.map((i) => `<item><title>${i.t}</title><link>${i.l}</link><pubDate>${d(i.d)}</pubDate><source url="https://x.example">${i.s || "Média"}</source></item>`).join("")}</channel></rss>`;
const http = async (url) => {
  if (/news\.google\.com/.test(url) && /Altman/.test(decodeURIComponent(url))) return rss([{ t: "Sam Altman says AI is early - Média", l: "https://m.example/a", d: 1 }, { t: "Sam Altman says AI is early - Autre", l: "https://m.example/b", d: 1 }, { t: "Sam Altman warns of old risk", l: "https://m.example/c", d: 40 }, { t: "OpenAI raises money", l: "https://m.example/d", d: 1 }]);
  if (/news\.google\.com/.test(url)) throw new Error("HTTP 404");
  if (/UCSHZKyawb77ixDdsGog4iWA/.test(url)) return rss([{ t: "Dario Amodei: Anthropic, Claude | Lex Fridman Podcast #999", l: "https://youtu.be/v", d: 2 }]);
  throw new Error("HTTP 404");
};
const r = await collectVoix({ http, parseFeed, now, prev: null, sleep: async () => {}, pause: 0 });
const alt = r.doc.people.find((p) => p.id === "sam-altman"), am = r.doc.people.find((p) => p.id === "dario-amodei");
assert.equal(alt.items.length, 1, "doublon de titre fusionné, article de 40 jours et article sans déclaration écartés");
assert.equal(alt.items[0].title, "Sam Altman says AI is early");
assert.equal(am.items.length, 1); assert.equal(am.items[0].kind, "video");
assert.ok(PEOPLE.length >= 100 && PEOPLE.every((p) => p.cat && p.role && p.re), "roster : catégorie, poste et motif pour chacun");
assert.equal(new Set(PEOPLE.map((p) => p.id)).size, PEOPLE.length, "identifiants uniques");
assert.ok(r.summary.failed > 0 && r.summary.total === 2, "un échec n'arrête pas les autres");
// alerte de poste : un titre récent annonçant une démission ou une nomination est signalé (pas pour les titres d'avant la vérification)
const http3 = async (url) => /news\.google\.com/.test(url) && /Sutskever/.test(decodeURIComponent(url)) ? `<rss><channel><item><title>Ilya Sutskever resigns as head of SSI - Média</title><link>https://m.example/z</link><pubDate>${new Date(Date.parse("2026-11-24T12:00:00Z")).toUTCString()}</pubDate></item></channel></rss>` : (() => { throw new Error("HTTP 404"); })();
const r3 = await collectVoix({ http: http3, parseFeed, now: Date.parse("2026-11-25T12:00:00Z"), prev: null, sleep: async () => {}, pause: 0 });
assert.equal(r3.doc.people.find((p) => p.id === "ilya-sutskever").alerts.length, 1, "alerte de changement de poste");
assert.equal(r3.doc.people.find((p) => p.id === "jensen-huang").alerts.length, 0);
// la collecte suivante garde l'historique
const r2 = await collectVoix({ http: async () => { throw new Error("HTTP 500"); }, parseFeed, now: now + 864e5, prev: r.doc, sleep: async () => {}, pause: 0 });
assert.equal(r2.doc.people.find((p) => p.id === "sam-altman").items.length, 1, "historique conservé quand la source échoue");

// traduction : refusée si les chiffres changent
const doc = { people: [{ items: [{ title: "Jassy says 3 deals", url: "u1" }, { title: "Altman says AI is early", url: "u2" }] }] };
const tr = await translateVoix({ doc, generate: async () => [{ i: 0, fr: "Jassy parle de 4 accords" }, { i: 1, fr: "Altman dit que l'IA en est à ses débuts" }] });
assert.equal(tr.changed, 1); assert.equal(doc.people[0].items[0].title_fr, undefined); assert.equal(doc.people[0].items[1].title_fr, "Altman dit que l'IA en est à ses débuts");
// déclarations brûlantes : fraîcheur, reprise par plusieurs médias, une par personne, 48 h maximum, 3 au plus
const H = (id, cat, t, src, h) => ({ id, n: id, cat, role: "r", actor: null, items: [{ ts: new Date(now - h * 36e5).toISOString(), title: t, url: "https://x/" + t + src, source: src }] });
const hdoc = { people: [
  { ...H("a", "dirigeants", "A warns AI bubble will burst soon", "Reuters", 3), items: ["Reuters", "CNBC", "Forbes", "Verge"].map((s, i) => ({ ts: new Date(now - (3 + i) * 36e5).toISOString(), title: "A warns AI bubble will burst soon", url: "https://x/a" + i, source: s })) },
  H("b", "dirigeants", "B says new chip ships next year", "Wired", 2),
  H("c", "investisseurs", "C raises Nvidia price target sharply", "Barrons", 1),
  H("d", "dirigeants", "D says old news from long ago", "Wired", 80),
  H("e", "chercheurs", "E explains transformers to students", "Blog", 5),
] };
const hot = hotVoix(hdoc, now);
assert.equal(hot.length, 3); assert.equal(hot[0].id, "a"); assert.equal(hot[0].outlets, 4, "propos repris par 4 médias");
assert.ok(!hot.some((x) => x.id === "d"), "plus de 48 h : écarté");
assert.equal(new Set(hot.map((x) => x.id)).size, 3, "une déclaration par personne");

// Dario n'est pas Daniela ; propos d'un tiers écarté
const reOf = (id) => PEOPLE.find((p) => p.id === id).re;
assert.equal(isStatement("Daniela Amodei says Anthropic will hire", reOf("dario-amodei")), false, "Daniela n'est pas Dario");
assert.equal(isStatement("Daniela Amodei says Anthropic will hire", reOf("daniela-amodei")), true);
assert.equal(isStatement("Dario Amodei warns of job losses", reOf("dario-amodei")), true);
assert.equal(isStatement("Hire Tim Cook to lead Nvidia, Trump says", reOf("tim-cook")), false, "c'est Trump qui parle");
assert.equal(isStatement("Peter Thiel’s partner Jack Selby warns AI bubble", reOf("peter-thiel")), false, "l'associé parle, pas Thiel");
assert.equal(isStatement("Jeff Bezos says AI could allow three-day workweeks", reOf("jeff-bezos")), true);
assert.ok(PEOPLE.find((p) => p.id === "elon-musk"), "Musk suivi");
assert.ok(PEOPLE.filter((p) => p.topic).every((p) => p.q), "personnalité à sujet large : requête IA obligatoire");

// annotateVoix : « essentiel » = repris par ≥ 2 médias, ou verbe fort d'une voix majeure
const adoc = { people: [
  { id: "x", w: 1.6, items: [{ title: "Altman warns of AI bubble risk", source: "A" }, { title: "Altman warns of AI bubble risk for investors", source: "B" }, { title: "Altman visits Tokyo office", source: "C" }, { title: "Altman rejects Musk claims about nonprofit", source: "D" }] },
  { id: "y", w: 0.8, items: [{ title: "Smith warns about chips", source: "A" }, { title: "Smith opens a new lab", source: "A" }] },
] };
annotateVoix(adoc);
const [a1, a2, a3, a4] = adoc.people[0].items;
assert.equal(a1.m, 2); assert.equal(a1.e, 1, "repris par 2 médias");
assert.equal(a2.m, 2);
assert.equal(a3.m, 1); assert.equal(a3.e, 0, "voix majeure mais verbe neutre");
assert.equal(a4.e, 1, "voix majeure + verbe fort");
assert.equal(adoc.people[1].items[0].e, 0, "voix mineure, un seul média : pas essentiel");
console.log("test-voix (insiders) OK");
console.log("test-voix OK");
