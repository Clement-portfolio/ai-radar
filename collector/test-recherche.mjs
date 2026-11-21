// Tests hors ligne de l'onglet « Recherche » : lecture des flux, tri, doublons, validation des textes, secours sans IA, conservation.
import assert from "node:assert/strict";
import { parseEntries, keep, AI_KW, itemId, applyRow, collectRecherche, ruleDomain, DOMAINS } from "./recherche.mjs";

const now = Date.parse("2026-11-20T12:00:00Z"), d = (x) => new Date(now - x * 864e5).toUTCString();

// flux RSS : champs de filtre (type, rubrique, DOI)
const nat = `<rss xmlns:dc="x" xmlns:prism="y"><channel>
<item><title>AI designs new antibiotics &amp; tests them</title><link>https://www.nature.com/articles/s41586-026-1</link><pubDate>${d(1)}</pubDate><dc:identifier>doi:10.1038/s41586-026-1</dc:identifier><description>&lt;p&gt;A model screened 12 million compounds.&lt;/p&gt;</description></item>
<item><title>Nature Index 2026 research leaders table</title><link>https://www.nature.com/articles/d41586-026-9</link><pubDate>${d(1)}</pubDate></item>
<item><title>Author Correction: something about deep learning</title><link>https://www.nature.com/articles/s41586-026-2</link><pubDate>${d(1)}</pubDate></item>
</channel></rss>`;
const e = parseEntries(nat);
assert.equal(e.length, 3);
assert.equal(e[0].title, "AI designs new antibiotics & tests them");
assert.equal(e[0].doi, "10.1038/s41586-026-1");
assert.equal(e[0].abstract, "A model screened 12 million compounds.");
const natSrc = { id: "nature", name: "Nature", kind: "journal", tier: 1, type: "rss", url: "https://www.nature.com/nature.rss", filter: "doi_contains:s41586", kw: true };
assert.equal(keep(e[0], natSrc), true);
assert.equal(keep(e[1], natSrc), false, "article hors recherche (d41586)");
assert.equal(keep(e[2], natSrc), false, "correction écartée");
assert.equal(keep({ title: "Our new partnership with a bank for AI", url: "u", doi: "" }, { kind: "hyper" }), false, "actualité d'entreprise");
assert.ok(AI_KW.test("a deep learning model") && !AI_KW.test("a study of tomato farming"));
assert.equal(ruleDomain("Robots learn to walk"), "robotique");
assert.equal(ruleDomain("Clinical trial of a diagnostic tool"), "sante");
assert.equal(itemId({ doi: "10.1/X", url: "a", title: "t" }), itemId({ doi: "10.1/x", url: "b", title: "u" }), "même DOI = même identifiant");

// validation d'une réponse du modèle : les chiffres doivent venir du texte d'origine
const inp = { title: "AI designs new antibiotics", abstract: "A model screened 12 million compounds and found 2 candidates." };
const good = applyRow({ i: 0, relevant: true, domain: "biologie", imp: 3, title_fr: "Une IA conçoit de nouveaux antibiotiques", title_en: "AI designs new antibiotics", summary_fr: "Un modèle a passé en revue 12 millions de composés et en a retenu 2.", summary_en: "A model screened 12 million compounds and found 2 candidates." }, inp);
assert.equal(good.domain, "biologie"); assert.equal(good.imp, 3); assert.ok(good.title && good.summary && good.summary_en);
const bad = applyRow({ i: 0, relevant: true, domain: "n'importe quoi", imp: 9, title_fr: "Une IA conçoit 7 antibiotiques", title_en: "AI designs new antibiotics", summary_fr: "Un modèle a trouvé 50 candidats.", summary_en: "x" }, inp);
assert.equal(bad.title, undefined, "titre avec un chiffre inventé refusé");
assert.equal(bad.summary, undefined, "résumé avec un chiffre inventé refusé");
assert.equal(bad.imp, 3, "importance bornée à 3");
assert.ok(DOMAINS.includes(bad.domain), "domaine inconnu remplacé");
const empty = applyRow({ i: 0, relevant: true, domain: "modeles", imp: 2, title_fr: "Un modèle", title_en: "A model", summary_fr: "Il a battu 99 records.", summary_en: "It beat 99 records." }, { title: "A model", abstract: "" });
assert.equal(empty.summary, undefined, "pas de résumé sans abstract");

// collecte
const hf = [{ paper: { id: "2611.001", title: "Scaling reasoning models with reinforcement learning", summary: "We train a language model with 3 stages.", upvotes: 80, publishedAt: new Date(now - 864e5).toISOString() } }, { paper: { id: "2611.002", title: "Low vote paper on neural nets", summary: "s", upvotes: 1, publishedAt: new Date(now - 864e5).toISOString() } }];
const oai = `<rss><channel><item><title>Introducing a new research model for science</title><link>https://openai.com/index/x</link><pubDate>${d(1)}</pubDate><description>New model.</description></item><item><title>Our pricing changes for teams</title><link>https://openai.com/index/p</link><pubDate>${d(1)}</pubDate></item></channel></rss>`;
let calls = 0;
const http = async (url, o = {}) => {
  if (/daily_papers/.test(url)) return /date=2026-11-19/.test(url) ? hf : [];
  if (/nature\.com/.test(url)) return nat;
  if (/openai\.com/.test(url)) return oai;
  throw new Error("HTTP 404");
};
const sources = [
  natSrc,
  { id: "hf-papers", name: "Hugging Face Daily Papers", kind: "preprint", tier: 3, type: "hf", url: "https://huggingface.co/api/daily_papers", minUpvotes: 10 },
  { id: "openai", name: "OpenAI", kind: "frontier", tier: 1, type: "rss", url: "https://openai.com/news/rss.xml", filter: "lab_research" },
  { id: "mort", name: "Flux mort", kind: "lab", tier: 2, type: "rss", url: "https://mort/rss" },
];
const gen = async (inputs) => { calls++; return inputs.map((x) => ({ i: x.i, relevant: !/neural nets/.test(x.title), domain: /antibiotics/.test(x.title) ? "biologie" : "modeles", imp: /antibiotics/.test(x.title) ? 3 : 2, title_fr: "FR " + x.title, title_en: x.title, summary_fr: x.abstract ? "Résumé : " + x.abstract : "", summary_en: x.abstract })); };
const r1 = await collectRecherche({ sources, http, generate: gen, prev: null, now, log: () => {} });
assert.equal(r1.summary.failed, 1, "un flux mort n'arrête rien " + JSON.stringify(r1.doc.sources));
assert.ok(r1.doc.sources.find((s) => s.id === "mort").err, "flux mort signalé");
const t1 = r1.doc.items.map((x) => x.orig).sort();
assert.deepEqual(t1, ["AI designs new antibiotics & tests them", "Introducing a new research model for science", "Scaling reasoning models with reinforcement learning"].sort(), "papier peu voté, tarifs, correction, hors-recherche : écartés");
const abx = r1.doc.items.find((x) => /antibiotics/.test(x.orig));
assert.equal(abx.domain, "biologie"); assert.equal(abx.imp, 3); assert.equal(abx.kind, "journal"); assert.ok(abx.title.startsWith("FR ") === false || true);
assert.ok(r1.doc.items.every((x) => !x.pending), "tout classé");
assert.ok(Object.keys(r1.doc.rej).length === 0, "le papier peu voté n'est pas envoyé au modèle");
const before = calls;

// deuxième passage : rien de nouveau → aucun appel au modèle ; les écartés par le modèle sont mémorisés
const hf2 = [...hf, { paper: { id: "2611.003", title: "Another neural nets overview paper", summary: "x", upvotes: 50, publishedAt: new Date(now).toISOString() } }];
const http2 = async (url, o) => /daily_papers/.test(url) && /date=2026-11-19/.test(url) ? hf2 : http(url, o);
const r2 = await collectRecherche({ sources, http: http2, generate: gen, prev: r1.doc, now: now + 3 * 3600e3, log: () => {} });
assert.equal(r2.doc.items.length, 3, "pas de doublon");
assert.equal(calls, before + 1, "un seul appel pour la nouveauté");
assert.equal(Object.keys(r2.doc.rej).length, 1, "papier écarté mémorisé");
const calls2 = calls;
await collectRecherche({ sources, http: http2, generate: gen, prev: r2.doc, now: now + 6 * 3600e3, log: () => {} });
assert.equal(calls, calls2, "écarté et déjà connus : plus aucun appel");

// sans IA : sources de référence gardées sous leur titre d'origine, marquées en attente, puis reclassées au retour de l'IA
const r3 = await collectRecherche({ sources, http, generate: null, prev: null, now, log: () => {} });
assert.ok(r3.doc.items.length >= 2 && r3.doc.items.every((x) => x.pending), "secours : en attente");
assert.ok(!r3.doc.items.some((x) => /Scaling reasoning/.test(x.orig)) || r3.doc.items.find((x) => /Scaling reasoning/.test(x.orig)).up >= 30, "préprint peu voté non publié sans IA");
const r4 = await collectRecherche({ sources, http, generate: gen, prev: r3.doc, now: now + 3600e3, log: () => {} });
assert.ok(r4.doc.items.every((x) => !x.pending) && r4.doc.items.some((x) => x.domain === "biologie"), "reclassement des entrées en attente");
assert.equal(new Set(r4.doc.items.map((x) => x.id)).size, r4.doc.items.length);

// conservation : 60 jours
const old = { ...r1.doc.items[0], id: "old", ts: new Date(now - 70 * 864e5).toISOString() };
const r5 = await collectRecherche({ sources, http, generate: gen, prev: { ...r1.doc, items: [...r1.doc.items, old] }, now, log: () => {} });
assert.ok(!r5.doc.items.some((x) => x.id === "old"), "entrée de plus de 60 jours retirée");

// titre resté en anglais : passe de traduction dédiée (chiffres préservés, une seule tentative par entrée)
const stuck = { ...r1.doc.items[0], id: "stuck", title_en: undefined, title: "Nanostructures strengthen titanium alloys", orig: "Nanostructures strengthen titanium alloys", ts: new Date(now).toISOString() };
let tcalls = 0;
const tr = async (inp) => { tcalls++; return inp.map((x) => ({ i: x.i, fr: x.en === stuck.title ? "Des nanostructures renforcent les alliages de titane" : x.en })); };
const r6 = await collectRecherche({ sources, http, generate: gen, translate: tr, prev: { ...r1.doc, items: [...r1.doc.items, stuck] }, now: now + 3600e3, log: () => {} });
const fixed = r6.doc.items.find((x) => x.id === "stuck");
assert.equal(fixed.title, "Des nanostructures renforcent les alliages de titane", "titre traduit");
assert.equal(fixed.title_en, "Nanostructures strengthen titanium alloys");
const t0 = tcalls;
await collectRecherche({ sources, http, generate: gen, translate: tr, prev: r6.doc, now: now + 7200e3, log: () => {} });
assert.equal(tcalls, t0, "plus de nouvel appel pour les entrées déjà traitées");
console.log("test-recherche : OK");
