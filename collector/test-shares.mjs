// Tests hors ligne des parts de marché lues à la source (Counterpoint, TrendForce) : lecture, contrôles, repli.
import assert from "node:assert/strict";
import { parseHbm, parseFoundry, parseList, isFoundryTitle, collectShares, COUNTERPOINT_URL, TRENDFORCE_LIST } from "./shares.mjs";

const tbl = (rows) => "<table><thead><tr>" + rows[0].map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" + rows.slice(1).map((r) => "<tr>" + r.map((c) => `<td><p>${c}</p></td>`).join("") + "</tr>").join("") + "</tbody></table>";
const H = ["Market Share", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];
const dram = tbl([H, ["Samsung", "33%", "33%", "36%", "38%", "38%"], ["SK Hynix", "39%", "33%", "32%", "29%", "25%"], ["Micron", "22%", "26%", "22%", "22%", "24%"], ["CXMT", "4%", "5%", "8%", "8%", "10%"], ["Nanya", "1%", "1%", "2%", "2%", "2%"]]);
const hbm = (last = ["50%", "33%", "18%"], head = "Q2 2026") => tbl([[...H.slice(0, 5), head], ["SK Hynix", "64%", "56%", "57%", "58%", last[0]], ["Samsung", "15%", "23%", "22%", "21%", last[1]], ["Micron", "21%", "21%", "21%", "21%", last[2]]]);
const page = (...t) => "<html><body><nav>menu</nav><article>" + t.join("<hr>") + "</article></body></html>";

// Counterpoint : le tableau HBM est reconnu (pas la DRAM), dans n'importe quel ordre
let r = parseHbm(page(dram, hbm()));
assert.equal(r.key, "2026Q2"); assert.deepEqual(r.values, { "sk hynix": 50, samsung: 33, micron: 18 });
assert.equal(parseHbm(page(hbm(), dram)).key, "2026Q2");
assert.throws(() => parseHbm(page(dram)), /introuvable/, "DRAM seule : on ne prend pas la DRAM pour du HBM");
assert.throws(() => parseHbm(page(hbm(["70%", "33%", "18%"]))), /somme/, "somme absurde refusée");
assert.throws(() => parseHbm(page(hbm(["n/a", "33%", "18%"]))), /illisible/);
assert.throws(() => parseHbm(page(hbm(undefined, "Dernier"))), /illisible/, "en-tête inattendu refusé");
assert.throws(() => parseHbm("<html>coquille vide</html>"), /introuvable/);

// TrendForce : le classement est dans le texte
const rel = (extra = "") => `<h1>Global Foundry Revenue 3Q26</h1><p>TrendForce&rsquo;s research shows the top 10 foundries rose 4.1% QoQ to US$55.7 billion in 3Q26. TSMC maintained its lead with 3Q26 revenue nearing $42.0 billion, a 4.5% increase QoQ, capturing a 73.1% market share. Samsung Foundry ranked second, with revenue of $3.30 billion, up 1.2% QoQ, with its market share declining from 5.9% to 5.7%. SMIC ranked third, with revenue exceeding $3.1 billion, up 3.0% QoQ, raising its market share to 5.5%. UMC maintained fourth place with a 3.9% market share. ${extra}</p>`;
let f = parseFoundry(rel());
assert.equal(f.key, "2026Q3"); assert.deepEqual(f.values, { TSMC: 73.1, Samsung: 5.7, SMIC: 5.5, UMC: 3.9 }, "« de 5,9 % à 5,7 % » : on prend la valeur d'arrivée, pas celle de départ");
assert.throws(() => parseFoundry(rel().replace("capturing a 73.1% market share", "capturing the market")), /TSMC/, "part introuvable : échec, pas de devinette");
assert.throws(() => parseFoundry(rel().replace("a 3.9% market share", "a 1.8% QoQ rise")), /UMC/);
assert.throws(() => parseFoundry(rel().replace("73.1%", "13.1%")), /en tête|douteuse/);
assert.throws(() => parseFoundry("<p>Rien sur les fonderies</p>"), /trimestre/);

// liste TrendForce
const li = (d, id, t) => `<div><a href="/presscenter/news/${d}-${id}.html"><h3>${t}</h3></a></div>`;
const list1 = page(li("20261216", 13400, "Global TV Shipments Decline in 4Q26, Says TrendForce"), li("20261212", 13395, "DRAM Prices Rise, Says TrendForce"));
const FT = "Global Foundry Revenue Reaches US$55.7 Billion in 3Q26 as TSMC Extends Lead, Says TrendForce";
const list2 = page(li("20261209", 13390, FT), li("20260909", 13225, "Global Foundry Revenue Approaches US$53.49 Billion in 2Q26 as SMIC Narrows Market Share Gap with Samsung, Says TrendForce"));
const pl = parseList(list2); assert.equal(pl.length, 2); assert.equal(pl[0].url, "https://www.trendforce.com/presscenter/news/20261209-13390.html");
assert.ok(isFoundryTitle(FT)); assert.ok(!isFoundryTitle("DRAM Prices Rise in 3Q26, Says TrendForce"));

// collectShares : scénario complet
const base = () => ({ as_of: "16 nov. 2026", note: "n", charts: [
  { id: "hbm", auto: true, title: "HBM", period: "T2 2026", period_key: "2026Q2", checked_at: "2026-11-16T18:00:00.000Z", url: COUNTERPOINT_URL, segments: [{ label: "SK hynix", pct: 50 }, { label: "Samsung", pct: 33 }, { label: "Micron", pct: 18 }] },
  { id: "foundry", auto: true, title: "Fonderies", period: "T2 2026", period_key: "2026Q2", checked_at: "2026-11-16T18:00:00.000Z", url: "https://x/old", segments: [{ label: "TSMC", pct: 72.5 }, { label: "Samsung", pct: 5.9 }, { label: "SMIC", pct: 5.4 }, { label: "UMC", pct: 3.9 }, { label: "Autres", pct: 12.3 }] },
  { id: "owners", title: "Manuel", period: "T4 2025", segments: [{ label: "Google", pct: 24.8 }] },
] });
const calls = [];
const mk = (pages, fail) => async (url) => {
  calls.push(String(url));
  if (fail) throw new Error("réseau");
  const body = pages[url];
  return body == null ? { ok: false, status: 404, text: async () => "" } : { ok: true, status: 200, text: async () => body };
};
const noSleep = async () => {};
const pagesQ3 = { [COUNTERPOINT_URL]: page(dram, hbm(["45%", "38%", "17%"], "Q3 2026")), [TRENDFORCE_LIST]: list1, [TRENDFORCE_LIST + "?page=2"]: list2, "https://www.trendforce.com/presscenter/news/20261209-13390.html": rel() };
const dec = Date.parse("2026-12-12T09:00:00Z");

let out = await collectShares({ prev: base(), fetchImpl: mk(pagesQ3), now: dec, sleep: noSleep });
const by = (o, id) => o.doc.charts.find((c) => c.id === id);
assert.equal(out.summary.refreshed, true);
assert.equal(by(out, "hbm").period, "T3 2026"); assert.deepEqual(by(out, "hbm").segments, [{ label: "SK hynix", pct: 45 }, { label: "Samsung", pct: 38 }, { label: "Micron", pct: 17 }]);
const fo = by(out, "foundry");
assert.equal(fo.period, "T3 2026"); assert.equal(fo.url, "https://www.trendforce.com/presscenter/news/20261209-13390.html", "le lien pointe vers le nouveau communiqué");
assert.deepEqual(fo.segments.map((s) => s.label), ["TSMC", "Samsung", "SMIC", "UMC", "Autres"]); assert.equal(fo.segments.at(-1).pct, 11.8, "« Autres » = 100 − les quatre premiers");
assert.equal(by(out, "owners").segments[0].pct, 24.8, "un camembert manuel n'est jamais touché");
assert.equal(by(out, "hbm").check_error, undefined);

// SMIC dépasse Samsung : l'ordre est recalculé, aucun ordre n'est supposé
const swap = rel().replace("declining from 5.9% to 5.7%", "declining to 5.2%");
out = await collectShares({ prev: base(), fetchImpl: mk({ ...pagesQ3, "https://www.trendforce.com/presscenter/news/20261209-13390.html": swap }), now: dec, sleep: noSleep });
assert.deepEqual(by(out, "foundry").segments.map((s) => s.label).slice(0, 3), ["TSMC", "SMIC", "Samsung"]);

// avant la date probable du classement : on ne cherche pas, on ne touche à rien
calls.length = 0;
out = await collectShares({ prev: base(), fetchImpl: mk(pagesQ3), now: Date.parse("2026-11-16T20:00:00Z"), sleep: noSleep });
assert.equal(by(out, "foundry").period, "T2 2026"); assert.equal(out.summary.charts.foundry, "pas de nouvelle publication");
assert.ok(!calls.some((u) => u.startsWith(TRENDFORCE_LIST)), "aucune requête TrendForce hors période");

// échec réseau : anciens chiffres conservés + alerte, puis pas de martelage du site
out = await collectShares({ prev: base(), fetchImpl: mk({}, true), now: dec, sleep: noSleep });
assert.equal(by(out, "hbm").period, "T2 2026"); assert.equal(by(out, "hbm").segments[0].pct, 50);
assert.match(by(out, "hbm").check_error, /réseau/); assert.match(out.summary.charts.hbm, /^erreur/);
assert.equal(by(out, "hbm").checked_at, "2026-11-16T18:00:00.000Z", "la date de dernière lecture réussie ne bouge pas");
calls.length = 0;
const again = await collectShares({ prev: out.doc, fetchImpl: mk(pagesQ3), now: dec + 3600e3, sleep: noSleep });
assert.equal(calls.length, 0, "une heure après un échec : pas de nouvelle requête");
assert.match(again.summary.charts.hbm, /ignoré/);
const later = await collectShares({ prev: out.doc, fetchImpl: mk(pagesQ3), now: dec + 7 * 3600e3, sleep: noSleep });
assert.equal(by(later, "hbm").period, "T3 2026"); assert.equal(by(later, "hbm").check_error, undefined, "reprise après six heures, alerte levée");

// page modifiée / trimestre antérieur : refus
out = await collectShares({ prev: base(), fetchImpl: mk({ [COUNTERPOINT_URL]: page(dram) }), now: dec, sleep: noSleep });
assert.match(by(out, "hbm").check_error, /introuvable/); assert.equal(by(out, "hbm").segments[1].pct, 33);
const prevQ3 = base(); prevQ3.charts[0].period_key = "2026Q3"; prevQ3.charts[0].period = "T3 2026";
out = await collectShares({ prev: prevQ3, fetchImpl: mk({ [COUNTERPOINT_URL]: page(dram, hbm()) }), now: dec, sleep: noSleep });
assert.match(by(out, "hbm").check_error, /antérieur/); assert.equal(by(out, "hbm").period, "T3 2026");

// communiqué illisible : TrendForce reste sur l'ancien chiffre
out = await collectShares({ prev: base(), fetchImpl: mk({ ...pagesQ3, "https://www.trendforce.com/presscenter/news/20261209-13390.html": "<p>Contenu changé</p>" }), now: dec, sleep: noSleep });
assert.equal(by(out, "foundry").period, "T2 2026"); assert.match(by(out, "foundry").check_error, /trimestre/);
// fichier absent : rien n'est inventé
assert.equal((await collectShares({ prev: null, fetchImpl: mk({}), now: dec, sleep: noSleep })).doc, null);
console.log("Tests parts de marché : OK");
