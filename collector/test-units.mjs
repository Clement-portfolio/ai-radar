// Garde-fou des ordres de grandeur : « trillion » / « billion » ne doivent jamais fausser ni embrouiller une traduction.
import assert from "node:assert/strict";
import { unitsOk, normalizeFr, amountsOf, stripAmounts } from "./units.mjs";
import { translateVoix } from "./voix.mjs";

const EN = "Anthropic to begin public trading at $1.5tn valuation after largest ever IPO";
assert.deepEqual(amountsOf("$1.5tn", "en"), amountsOf("1 500 milliards de dollars", "fr"), "1,5 tn$ = 1 500 milliards");
assert.deepEqual(amountsOf("$1.5 trillion", "en"), [1500000]);
assert.deepEqual(amountsOf("$2bn", "en"), [2000]);
assert.deepEqual(amountsOf("$300m", "en"), [300]);
assert.deepEqual(amountsOf("1,4 T$ et 12 Md$", "fr"), [12000, 1400000]);

// cas de la capture : « 1,5 billion » est ambigu → refusé tel quel, réécrit en milliards
assert.equal(unitsOk(EN, "Anthropic entame sa cotation avec une valorisation de 1,5 billion de dollars", "fr", true), false);
assert.equal(normalizeFr(EN, "valorisation de 1,5 billion de dollars"), "valorisation de 1 500 milliards de dollars");
// « 1,5 trillion » en français = 10^18 : faux d'un facteur 1 000, jamais corrigé
assert.equal(unitsOk(EN, "valorisation de 1,5 trillion de dollars", "fr", true), false);
assert.equal(normalizeFr(EN, "valorisation de 1,5 trillion de dollars"), "valorisation de 1,5 trillion de dollars");
// bonne traduction
assert.equal(unitsOk(EN, "valorisation de 1 500 milliards de dollars", "fr", true), true);
assert.equal(unitsOk(EN, "valorisation de 1 500 milliards de dollars", "fr", true), true);
// confusion milliard / million, montant oublié (titre strict) ou inventé
assert.equal(unitsOk("Nvidia invests $2bn in Synopsys", "Nvidia investit 2 millions de dollars dans Synopsys", "fr", true), false);
assert.equal(unitsOk("Nvidia invests $2bn in Synopsys", "Nvidia investit 2 milliards de dollars dans Synopsys", "fr", true), true);
assert.equal(unitsOk("Nvidia invests $2bn in Synopsys", "Nvidia investit dans Synopsys", "fr", true), false, "titre : montant omis");
assert.equal(unitsOk("Nvidia invests $2bn in Synopsys", "Nvidia investit dans Synopsys", "fr", false), true, "résumé : omission tolérée");
assert.equal(unitsOk("Nvidia invests $2bn in Synopsys", "Nvidia investit 20 milliards dans Synopsys", "fr"), false);
// source déjà en français : « billion » = 10^12 conservé tel quel
assert.equal(unitsOk("Anthropic vaut 1,5 billion de dollars selon le marché", "Anthropic vaut 1,5 billion de dollars", "fr"), true);
// anglais : « billion » = milliard ; une traduction en « 2 billion » depuis « 2 milliards » est juste, depuis « 2 billions » non
assert.equal(unitsOk("Nvidia investit 2 milliards de dollars dans Synopsys", "Nvidia invests $2 billion in Synopsys", "en", true), true);
assert.equal(unitsOk("Nvidia investit 2 milliards de dollars dans Synopsys", "Nvidia invests $2 trillion in Synopsys", "en", true), false);
// source illisible (chinois) : on laisse la vérification des chiffres décider
assert.equal(unitsOk("川普訪華 1.5萬億", "Trump visite la Chine pour 1,5 billion", "fr"), false, "source illisible : « billion » toujours refusé");
assert.equal(unitsOk("川普訪華 1.5萬億", "Trump visite la Chine pour 1,5 milliard", "fr"), true, "source illisible : mêmes chiffres tolérés");
assert.equal(unitsOk("川普訪華", "Trump visite la Chine pour 500 milliards", "fr"), false, "source illisible : montant inventé refusé");
// les dates, versions et pourcentages ne sont pas des montants
assert.equal(stripAmounts("GPT-5 en 2026, +12 % ($500bn)").includes("500"), false);
assert.equal(stripAmounts("GPT-5 en 2026, +12 %").includes("2026"), true);

// translateVoix : « 1,5 billion » corrigé en milliards, « 1,5 trillion » refusé, montant manquant refusé
const doc = { people: [{ items: [{ title: EN }, { title: EN + " (2)" }, { title: "Altman says OpenAI will spend $1.4tn on compute" }, { title: "Huang says Nvidia invests $2bn in Synopsys" }] }] };
const out = await translateVoix({ doc, generate: (inp) => [
  { i: 0, fr: "Anthropic entame sa cotation avec une valorisation de 1,5 billion de dollars" },
  { i: 1, fr: "Anthropic entame sa cotation avec une valorisation de 1,5 trillion de dollars (2)" },
  { i: 2, fr: "Altman : OpenAI dépensera 1 400 milliards de dollars en puissance de calcul" },
  { i: 3, fr: "Huang : Nvidia investit dans Synopsys" },
] });
const it = doc.people[0].items;
assert.equal(it[0].title_fr, "Anthropic entame sa cotation avec une valorisation de 1 500 milliards de dollars");
assert.equal(it[1].title_fr, undefined, "1,5 trillion : refusé, le titre d'origine reste");
assert.equal(it[2].title_fr.includes("1 400 milliards"), true);
assert.equal(it[3].title_fr, undefined, "montant omis : refusé");
assert.equal(out.changed, 2);
console.log("test-units OK");
