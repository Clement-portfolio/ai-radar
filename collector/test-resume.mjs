import assert from "node:assert/strict";
import { buildResume, resumeInputs, RESUME_RULES } from "./resume.mjs";

const now = Date.parse("2026-11-28T12:00:00Z"), iso = (h) => new Date(now - h * 36e5).toISOString();
const stories = { stories: [
  { id: "a", head: "Des puces Nvidia Blackwell découvertes dans un centre en Chine", summary: "Deux sociétés chinoises auraient installé du matériel Nvidia restreint à Shanghai, selon Bloomberg.", media: 5, imp: 3, ts: iso(3) },
  { id: "b", head: "Singapour discute des restrictions américaines sur les puces IA", summary: "Singapour échange avec ses entreprises technologiques sur les nouveaux contrôles.", media: 2, imp: 2, ts: iso(5) },
  { id: "c", head: "Ancienne histoire", summary: "Trop vieille pour compter.", media: 9, imp: 3, ts: iso(60) },
  { id: "d", head: "", summary: "", media: 4, imp: 3, ts: iso(2) },
] };
const voix = { hot: [{ n: "Jensen Huang", role: "PDG de Nvidia", title: "Huang says demand is strong", title_fr: "Jensen Huang affirme que la demande reste forte" }] };
const x = { items: [{ priority: "P1", priority_score: 40, title: "SemiAnalysis annonce Trainium sur InferenceX.", ts: iso(4) }, { priority: "P4", priority_score: 99, title: "Hors sujet", ts: iso(1) }] };

const inp = resumeInputs({ stories, voix, x, now });
assert.equal(inp.actualites.length, 2, "ni vieille histoire ni histoire sans texte");
assert.equal(inp.actualites[0].medias, 5, "les plus couvertes d'abord");
assert.equal(inp.posts_x.length, 1, "P4 écarté");

const good = "Selon Bloomberg, des puces Nvidia Blackwell restreintes ont été installées dans un centre de données de Shanghai par deux sociétés chinoises. Dans le même temps, Singapour échange avec ses entreprises technologiques pour faire face aux nouveaux contrôles américains sur les puces d'IA. Jensen Huang affirme que la demande reste forte, tandis que SemiAnalysis annonce l'arrivée de Trainium sur InferenceX.";
const goodEn = "According to Bloomberg, two Chinese companies installed restricted Nvidia Blackwell chips at a data center in Shanghai. Meanwhile, Singapore is talking with its tech companies about the new US controls on AI chips. Jensen Huang says demand remains strong, while SemiAnalysis announces Trainium is now on InferenceX.";
let calls = 0;
const gen = (txt, en = goodEn) => async () => { calls++; return [{ i: 0, fr: txt, en }]; };

let r = await buildResume({ prev: null, stories, voix, x, now, generate: gen(good) });
assert.equal(r.regenerated, true); assert.equal(r.doc.generated_at, new Date(now).toISOString()); assert.ok(r.doc.text_en);

// récent : aucun appel
const before = calls;
r = await buildResume({ prev: r.doc, stories, voix, x, now: now + 3 * 36e5, generate: gen(good) });
assert.equal(calls, before, "pas de nouvel appel avant 11 h"); assert.equal(r.regenerated, false);

// chiffre inventé : rejeté, on garde le précédent
const prev = { v: 1, generated_at: iso(12), text: "ancien" };
r = await buildResume({ prev, stories, voix, x, now, generate: gen(good.replace("deux sociétés", "47 sociétés")) });
assert.equal(r.regenerated, false); assert.equal(r.doc, prev, "chiffre absent des sources : précédent conservé");

// trop court / Gemini en panne / précédent trop vieux
r = await buildResume({ prev, stories, voix, x, now, generate: gen("Trop court.") });
assert.equal(r.regenerated, false);
r = await buildResume({ prev: { ...prev, generated_at: iso(RESUME_RULES.maxAgeH + 1) }, stories, voix, x, now, generate: null });
assert.equal(r.doc, null, "résumé trop ancien : retiré");
r = await buildResume({ prev: null, stories: { stories: [] }, voix, x, now, generate: gen(good) });
assert.equal(r.doc, null); assert.match(r.reason, /pas assez/);
console.log("test-resume : OK");
