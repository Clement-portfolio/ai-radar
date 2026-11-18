// Tests hors ligne de « Voix » : seuls les titres où la personne s'exprime sont retenus ; fusion, fenêtre de 30 jours, traduction contrôlée.
import assert from "node:assert/strict";
import { isStatement, collectVoix, translateVoix, PEOPLE } from "./voix.mjs";
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
assert.ok(PEOPLE.length >= 40 && PEOPLE.every((p) => p.cat && p.role && p.re), "roster : catégorie, poste et motif pour chacun");
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
console.log("test-voix OK");
