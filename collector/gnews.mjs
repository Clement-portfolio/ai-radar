// Liens Google News (news.google.com/rss/articles/…) → adresse réelle de l'article.
// Google affiche parfois « We're sorry… automated queries » au clic : on remplace donc le lien par celui du média.
// Deux appels à Google par article (page de l'article, puis batchexecute) : plafonné par collecte, arrêt au premier HTTP 429.

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const isGnewsUrl = (u) => { try { const x = new URL(u); return x.hostname === "news.google.com" && /\/(rss\/)?(articles|read)\//.test(x.pathname); } catch { return false; } };
const gnId = (u) => { const p = new URL(u).pathname.split("/").filter(Boolean); return p[p.length - 1]; };

// Anciens identifiants : l'adresse est écrite en clair dans l'identifiant.
export function decodeLegacy(id) {
  let b; try { b = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64"); } catch { return null; }
  if (b.length < 6 || b[0] !== 0x08 || b[1] !== 0x13 || b[2] !== 0x22) return null;
  b = b.subarray(3);
  if (b.length > 2 && b[b.length - 3] === 0xd2 && b[b.length - 2] === 0x01 && b[b.length - 1] === 0x00) b = b.subarray(0, b.length - 3);
  let off = 1; if (b[0] >= 0x80) off = 2;
  const s = b.subarray(off).toString("utf8");
  return /^https?:\/\//.test(s) ? s : null; // « AU_yqL… » : identifiant récent, il faut interroger Google
}

export async function decodeOnline(id, fetchImpl, timeout = 15000) {
  const get = async (url) => { const r = await fetchImpl(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(timeout) }); if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); };
  let html;
  try { html = await get(`https://news.google.com/articles/${id}`); } catch (e) { if (/429/.test(e.message)) throw e; html = await get(`https://news.google.com/rss/articles/${id}`); }
  const sg = /data-n-a-sg="([^"]+)"/.exec(html), ts = /data-n-a-ts="([^"]+)"/.exec(html);
  if (!sg || !ts) throw new Error("signature absente");
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts[1]},"${sg[1]}"]`;
  const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));
  const r = await fetchImpl("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": UA }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const txt = await r.text();
  let url = null;
  for (const line of txt.split("\n")) { // ligne de données : [["wrb.fr","Fbv4je","[\"garturlres\",\"https://…\",1]",…]]
    if (!line.startsWith("[[")) continue;
    try { const inner = JSON.parse(JSON.parse(line)[0][2]); if (inner[0] === "garturlres") { url = inner[1]; break; } } catch {}
  }
  if (!url) throw new Error("réponse inattendue");
  if (!/^https?:\/\//.test(url)) throw new Error("adresse invalide");
  return url;
}

// Un seul lien (utilisé par le serveur au moment du clic).
export async function resolveOne(url, fetchImpl = fetch) {
  if (!isGnewsUrl(url)) throw new Error("pas un lien Google News");
  const id = gnId(url);
  return decodeLegacy(id) || (await decodeOnline(id, fetchImpl));
}

// Remplace sur place les liens Google News des articles (les plus récents d'abord).
export async function resolveGoogleLinks({ items, fetchImpl = fetch, max = 60, maxTries = 3, sleep = (t) => new Promise((r) => setTimeout(r, t)), spacing = 400, log = () => {} }) {
  const out = { changed: 0, tried: 0, failed: 0, left: 0, reason: "" };
  const todo = items.filter((it) => isGnewsUrl(it.url)).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  for (const it of todo) { // décodage local d'abord (gratuit)
    let u = null; try { u = decodeLegacy(gnId(it.url)); } catch {}
    if (u) { it.url = u; out.changed++; }
  }
  const rest = todo.filter((it) => isGnewsUrl(it.url) && (it.gn_try || 0) < maxTries);
  for (const it of rest) {
    if (out.tried >= max) break;
    out.tried++;
    try {
      const u = await decodeOnline(gnId(it.url), fetchImpl);
      it.url = u; delete it.gn_try; out.changed++;
    } catch (e) {
      out.failed++; it.gn_try = (it.gn_try || 0) + 1; out.reason = String(e.message || e).slice(0, 80);
      if (/429/.test(out.reason)) { out.reason = "Google limite les requêtes (HTTP 429)"; break; }
    }
    await sleep(spacing);
  }
  out.left = items.filter((it) => isGnewsUrl(it.url)).length;
  if (!out.reason) out.reason = out.changed ? `${out.changed} lien(s) remplacé(s)` : "rien à faire";
  log("Liens Google News : " + out.reason + (out.left ? ` (restent ${out.left})` : ""));
  return out;
}
