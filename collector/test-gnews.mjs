import assert from "node:assert/strict";
import { isGnewsUrl, decodeLegacy, decodeOnline, resolveGoogleLinks } from "./gnews.mjs";

// identifiant ancien : adresse en clair
const legacyId = Buffer.concat([Buffer.from([0x08, 0x13, 0x22, 25]), Buffer.from("https://example.com/a?b=c"), Buffer.from([0xd2, 0x01, 0x00])]).toString("base64url");
assert.equal(decodeLegacy(legacyId), "https://example.com/a?b=c");
// identifiant récent : « AU_yqL… » → nécessite Google
const modernId = Buffer.concat([Buffer.from([0x08, 0x13, 0x22, 0xc8, 0x01]), Buffer.from("AU_yqLabcdef".padEnd(200, "x")), Buffer.from([0xd2, 0x01, 0x00])]).toString("base64url");
assert.equal(decodeLegacy(modernId), null);
assert.ok(isGnewsUrl("https://news.google.com/rss/articles/" + modernId + "?oc=5"));
assert.ok(!isGnewsUrl("https://www.reuters.com/x"));

// Google simulé : page de l'article puis batchexecute
const real = "https://www.reuters.com/world/china/x?a=b&c=d";
const inner = JSON.stringify(["garturlres", real, 1]);
const line = JSON.stringify([["wrb.fr", "Fbv4je", inner, null, null, null, "generic"]]);
let calls = [];
const fakeFetch = async (url, opt = {}) => {
  calls.push(url);
  if (url.includes("batchexecute")) { assert.match(decodeURIComponent(opt.body), /garturlreq/); return { ok: true, status: 200, text: async () => `)]}'\n\n${line.length}\n${line}\n57\n[["e",4,null,null,131]]` }; }
  return { ok: true, status: 200, text: async () => '<c-wiz><div jscontroller="x" data-n-a-sg="SIG123" data-n-a-ts="1700000000"></div></c-wiz>' };
};
assert.equal(await decodeOnline(modernId, fakeFetch), real);

const items = [
  { id: "1", ts: "2026-11-17T05:00:00Z", url: "https://news.google.com/rss/articles/" + modernId },
  { id: "2", ts: "2026-11-17T06:00:00Z", url: "https://news.google.com/rss/articles/" + legacyId },
  { id: "3", ts: "2026-11-17T07:00:00Z", url: "https://www.cnbc.com/x" },
];
const sleep = async () => {};
let r = await resolveGoogleLinks({ items, fetchImpl: fakeFetch, sleep });
assert.equal(items[0].url, real); assert.equal(items[1].url, "https://example.com/a?b=c"); assert.equal(items[2].url, "https://www.cnbc.com/x");
assert.equal(r.changed, 2); assert.equal(r.left, 0);

// plafond et HTTP 429 : on s'arrête sans rien casser
const many = Array.from({ length: 5 }, (_, i) => ({ id: "m" + i, ts: "2026-11-17T0" + i + ":00:00Z", url: "https://news.google.com/rss/articles/" + modernId + i }));
const f429 = async () => ({ ok: false, status: 429, text: async () => "" });
r = await resolveGoogleLinks({ items: many, fetchImpl: f429, sleep });
assert.equal(r.tried, 1); assert.match(r.reason, /429/); assert.ok(many.every((m) => m.url.includes("news.google.com")));
const capped = Array.from({ length: 5 }, (_, i) => ({ id: "c" + i, ts: "2026-11-17T0" + i + ":00:00Z", url: "https://news.google.com/rss/articles/" + modernId + i }));
r = await resolveGoogleLinks({ items: capped, fetchImpl: fakeFetch, sleep, max: 2 });
assert.equal(r.tried, 2); assert.equal(r.left, 3);
// un article qui échoue 3 fois n'est plus retenté
const bad = [{ id: "b", ts: "2026-11-17T01:00:00Z", url: "https://news.google.com/rss/articles/" + modernId }];
const fbad = async () => ({ ok: true, status: 200, text: async () => "<html></html>" });
for (let i = 0; i < 4; i++) r = await resolveGoogleLinks({ items: bad, fetchImpl: fbad, sleep });
assert.equal(bad[0].gn_try, 3); assert.equal(r.tried, 0);
console.log("Tests liens Google News : OK");
