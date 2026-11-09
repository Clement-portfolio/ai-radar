// Test hors ligne : sources et Gemini simulés.
import fs from "node:fs/promises"; import os from "node:os"; import path from "node:path";
import assert from "node:assert/strict";
import { run, parseFeed, canonicalUrl } from "./collect.mjs";

const now = Date.parse("2026-11-09T15:00:00Z");
const rss = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Nvidia unveils new AI chip &amp; HBM4 plan]]></title><link>https://ex.com/a?utm_source=x</link><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><description>&lt;p&gt;Big news on GPUs.&lt;/p&gt;</description></item>
<item><title>Recette de cuisine du jour</title><link>https://ex.com/cook</link><pubDate>Mon, 09 Nov 2026 11:00:00 GMT</pubDate></item>
<item><title>Old story about AI</title><link>https://ex.com/old</link><pubDate>Mon, 01 Jan 2026 11:00:00 GMT</pubDate></item>
</channel></rss>`;
const atom = `<feed><entry><title>Paper on LLM scaling</title><link rel="alternate" href="https://arxiv.org/abs/1"/><published>2026-11-09T10:00:00Z</published><summary>We study LLM scaling.</summary></entry></feed>`;
const gn = `<rss><channel><item><title>Nvidia unveils new AI chip and HBM4 plan - Reuters</title><link>https://news.google.com/rss/articles/XYZ</link><pubDate>Mon, 09 Nov 2026 12:05:00 GMT</pubDate><source url="https://reuters.com">Reuters</source></item></channel></rss>`;
let geminiCalls = 0;
const fetchImpl = async (url, init = {}) => {
  const u = String(url); const ok = (body, status = 200) => ({ ok: status < 400, status, text: async () => typeof body === "string" ? body : JSON.stringify(body) });
  if (u.includes("generativelanguage")) {
    geminiCalls++;
    if (u.includes("gemini-3.5-flash")) return ok({ error: { message: "model not found" } }, 404);
    const list = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    assert.ok(init.headers["x-goog-api-key"], "clé dans l'en-tête");
    const res = list.map((x) => ({ i: x.i, relevant: !/cuisine/i.test(x.title), title_fr: "FR " + x.title, summary_fr: "Résumé " + x.title, country: /Nvidia/.test(x.title) ? "US" : "OTHER", category: /LLM/.test(x.title) ? "recherche" : "puces", importance: 3, layer: "Puces" }));
    return ok({ candidates: [{ content: { parts: [{ text: JSON.stringify(res) }] } }] });
  }
  if (u.includes("news.google.com")) return ok(gn);
  if (u.includes("arxiv.org")) return ok(atom);
  if (u.includes("gdeltproject")) return ok({ articles: [{ url: "https://cn.example/ai", title: "DeepSeek releases new AI model", seendate: "20261109T130000Z", domain: "cn.example", language: "English", sourcecountry: "China" }] });
  if (u.includes("newsdata.io")) { assert.ok(init.headers["X-ACCESS-KEY"]); return ok({ status: "success", results: [{ link: "https://ae.example/x", title: "Humain expands AI datacenter", description: "d", pubDate: "2026-11-09 09:00:00", source_name: "Gulf News", language: "english" }] }); }
  if (u.includes("hn.algolia")) return ok({ hits: [] });
  if (u.includes("huggingface.co/api")) return ok([{ paper: { id: "2611.1", title: "A paper", summary: "s", upvotes: 99, publishedAt: "2026-11-09T01:00:00Z" } }]);
  if (u.includes("data.sec.gov")) return ok({ filings: { recent: { form: ["8-K", "4"], filingDate: ["2026-11-08", "2026-11-08"], accessionNumber: ["0001-26-1", "0001-26-2"], primaryDocument: ["d.htm", "e.htm"], primaryDocDescription: ["8-K", ""], items: ["2.02,9.01", ""] } } });
  if (u.includes("federalregister")) return ok({ results: [] });
  if (u.endsWith("rss.xml") || u.includes("feed") || u.includes("rss") || u.includes("atom")) return u.includes("openai") ? ok(rss) : ok(`<rss><channel></channel></rss>`);
  return ok("", 404);
};

assert.deepEqual(parseFeed(rss).map((x) => x.title)[0], "Nvidia unveils new AI chip & HBM4 plan");
assert.equal(canonicalUrl("https://www.Ex.com/a/?utm_source=x#f"), "https://ex.com/a");

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "radar-"));
await fs.cp(new URL("../public/data/", import.meta.url), dir, { recursive: true });
const before = JSON.parse(await fs.readFile(path.join(dir, "feed.json"), "utf8")).items.length;
const cfgFile = path.join(dir, "src.json");
const cfg = JSON.parse(await fs.readFile(new URL("./sources.json", import.meta.url), "utf8"));
cfg.gdelt.queries = cfg.gdelt.queries.slice(0, 1); cfg.newsdata.countries = ["ae"]; cfg.hackernews.queries = ["AI"]; cfg.edgar.companies = cfg.edgar.companies.slice(0, 1);
cfg.googleNews.editions = cfg.googleNews.editions.slice(0, 1); cfg.googleNews.queries = ["artificial intelligence"];
await fs.writeFile(cfgFile, JSON.stringify(cfg));
process.env.GEMINI_MIN_GAP_MS = "1";
const logs = [];
const s = await run({ dataDir: dir, sourcesFile: cfgFile, fetchImpl, now, env: { ...process.env, GEMINI_API_KEY: "k", NEWSDATA_API_KEY: "n", SEC_USER_AGENT: "test", GEMINI_MIN_GAP_MS: "1" }, log: (m) => logs.push(m) });
const feed = JSON.parse(await fs.readFile(path.join(dir, "feed.json"), "utf8")).items;
console.log(logs.join("\n"));
console.log("ajoutés:", feed.length - before, "| appels Gemini:", geminiCalls, "| modèle:", s.last_run.model);
for (const it of feed.slice(0, 7)) console.log(" -", it.ts.slice(0, 16), it.country, it.category, it.confidence, "|", it.title, "|", it.source);
assert.ok(feed.some((x) => x.title.includes("Nvidia")), "article RSS classé");
assert.equal(feed.filter((x) => /Nvidia unveils/.test(x.title)).length, 1, "doublon RSS/Google News fusionné");
assert.ok(!feed.some((x) => /cuisine/.test(x.title)), "hors sujet écarté");
assert.ok(!feed.some((x) => /Old story/.test(x.title)), "article trop ancien écarté");
assert.ok(feed.some((x) => x.source.startsWith("SEC EDGAR") && x.confidence === "haute"), "EDGAR haute confiance");
assert.ok(feed.some((x) => x.category === "recherche"), "recherche");
assert.ok(s.last_run.model === "gemini-2.5-flash", "bascule de modèle après 404");
// 2e passage : rien de nouveau, pas de doublon
const s2 = await run({ dataDir: dir, sourcesFile: cfgFile, fetchImpl, now, env: { ...process.env, GEMINI_API_KEY: "k", NEWSDATA_API_KEY: "n", GEMINI_MIN_GAP_MS: "1" }, log: () => {} });
const feed2 = JSON.parse(await fs.readFile(path.join(dir, "feed.json"), "utf8")).items;
assert.equal(feed2.length, feed.length, "idempotent");
assert.equal(s2.last_run.added, 0);
// hors ligne : le flux existant n'est pas écrasé et updated_at ne bouge pas
const off = await run({ dataDir: dir, sourcesFile: cfgFile, fetchImpl: async () => { throw new Error("offline"); }, now, env: { GEMINI_API_KEY: "k", GEMINI_MIN_GAP_MS: "1" }, log: () => {} });
assert.equal(off.updated_at, s2.updated_at); assert.ok(off.last_run.errors.includes("aucune source n'a répondu"));
assert.equal(JSON.parse(await fs.readFile(path.join(dir, "feed.json"), "utf8")).items.length, feed.length);
console.log("TOUS LES TESTS PASSENT");
