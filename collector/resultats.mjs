// What's Going On? — communiqués de résultats officiels (SEC, 8-K point 2.02), réservés aux « chiffres clés » de la Une.
// Ces textes n'entrent JAMAIS dans le fil Actualités ni dans le briefing : ils alimentent seulement le choix des chiffres clés
// (collect.mjs les range dans chiffres-src.json). Rien n'est estimé : le texte est celui du communiqué déposé par l'entreprise. Aucune dépendance.
import crypto from "node:crypto";

const DAY = 86400000;
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", bull: "•" };
const decode = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
export const htmlText = (h) => decode(String(h).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

/** Lien du communiqué (pièce 99.1) dans le 8-K : le lien dont le texte voisin parle de « press release » ou de « 99.1 », sinon le premier lien .htm. */
export function exhibitLink(html, primary) {
  const links = [...String(html).matchAll(/<a\s[^>]*href="([^"#]+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi)].filter((m) => m[1] !== primary && !/^https?:/i.test(m[1]));
  if (!links.length) return null;
  const hit = links.find((m) => /press release|99\.1/i.test(htmlText(String(html).slice(Math.max(0, m.index - 600), m.index + m[0].length + 200))));
  return (hit || links[0])[1];
}

/** Extrait d'un communiqué : l'en-tête technique du dépôt (« EX-99.1 2 fichier.htm EX-99.1 Document », « Exhibit 99.1 ») est retiré. */
export function pressText(html, max = 2200) {
  let t = htmlText(html);
  for (let k = 0; k < 4; k++) t = t.replace(/^(EX-99\.\d+\s+\d+\s+\S+\.htm\s+|EX-99\.\d+\s+|Document\s+|Exhibit 99\.\d+\s+)/i, "");
  return { summary: t.slice(0, max) };
}

/**
 * Lit, pour chaque entreprise, les 8-K à point 2.02 (résultats) des `lookbackDays` derniers jours, ouvre le communiqué et l'ajoute à `prev`.
 * `http(url, opts)` renvoie le texte (ou le JSON avec opts.json). Un échec sur une entreprise n'arrête pas les autres.
 */
export async function collectResults({ cfg, env, http, now, prev, log = () => {}, pause = 250 }) {
  const C = cfg?.edgarResults;
  const base = { v: 1, items: Array.isArray(prev?.items) ? prev.items : [] };
  if (!C) return { doc: base, added: 0, failed: 0, reason: "aucune source de résultats configurée" };
  if (!env.SEC_USER_AGENT) return { doc: base, added: 0, failed: 0, reason: "SEC_USER_AGENT absente" };
  const hdr = { "user-agent": env.SEC_USER_AGENT };
  const known = new Set(base.items.map((i) => i.acc));
  const cutoff = now - C.lookbackDays * DAY;
  let added = 0, failed = 0;
  for (const c of C.companies) {
    try {
      const j = await http(`https://data.sec.gov/submissions/CIK${String(c.cik).padStart(10, "0")}.json`, { json: true, headers: { ...hdr, accept: "application/json" } });
      const r = j.filings?.recent || {};
      for (let i = 0; i < (r.form || []).length; i++) {
        if (r.form[i] !== "8-K" || !String(r.items?.[i] || "").split(",").map((x) => x.trim()).includes("2.02")) continue;
        const day = Date.parse(r.filingDate[i] + "T12:00:00Z");
        if (!(day >= cutoff) || day > now + DAY) continue;
        const acc = String(r.accessionNumber[i]);
        if (known.has(acc)) continue;
        const dir = `https://www.sec.gov/Archives/edgar/data/${+c.cik}/${acc.replace(/-/g, "")}/`;
        const link = exhibitLink(await http(dir + r.primaryDocument[i], { headers: hdr }), r.primaryDocument[i]);
        if (!link) { failed++; continue; }
        const { summary } = pressText(await http(dir + link, { headers: hdr, timeout: 30000 }));
        if (!/\d/.test(summary)) { failed++; continue; }
        const title = `Communiqué officiel de résultats trimestriels de ${c.name}`;
        const ts = /^\d{4}-\d\d-\d\dT/.test(r.acceptanceDateTime?.[i] || "") ? new Date(r.acceptanceDateTime[i]).toISOString() : new Date(day).toISOString();
        base.items.push({ id: sha(dir + link), acc, ts, title, summary, source: `${c.name} (communiqué de résultats, SEC)`, url: dir + link, confidence: "haute", importance: 3, figonly: true });
        known.add(acc); added++;
        await sleep(pause);
      }
    } catch (e) { failed++; log(`Résultats ${c.name} : ${String(e.message || e).slice(0, 100)}`); }
    await sleep(pause);
  }
  base.items = base.items.filter((i) => now - Date.parse(i.ts) < (C.keepDays || 40) * DAY).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 200);
  return { doc: base, added, failed, reason: `${added} communiqué(s) ajouté(s)${failed ? `, ${failed} échec(s)` : ""}` };
}
