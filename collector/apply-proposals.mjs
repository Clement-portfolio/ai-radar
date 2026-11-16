// Applique les propositions validées par Clément (commentaire « /appliquer … » sur l'issue de revue).
// Variables : ISSUE_BODY, COMMENT_BODY. Écrit le compte rendu dans RESULT_FILE (défaut /tmp/apply-result.md).
import fs from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { applyProposals, parseCommand, dec, fmt } from "./review.mjs";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const body = process.env.ISSUE_BODY || "", cmd = parseCommand(process.env.COMMENT_BODY);
const result = process.env.RESULT_FILE || "/tmp/apply-result.md";
const fail = async (m) => { await fs.writeFile(result, m); if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, "changed=0\n"); console.log(m); process.exit(0); };
if (!cmd) await fail("Commande non reconnue. Utilise `/appliquer 1 3` ou `/appliquer tout`.");
const m = body.match(/<!--radar-proposals:([A-Za-z0-9+/=]+)-->/);
if (!m) await fail("Cette issue ne contient pas de propositions du robot.");
const proposals = dec(m[1]);
const files = {};
for (const f of ["market", "layers", "race"]) files[f] = JSON.parse(await fs.readFile(path.join(DATA, f + ".json"), "utf8"));
const pick = cmd === "all" ? null : cmd;
if (pick && pick.some((n) => n < 1 || n > proposals.length)) await fail(`Numéro inexistant : cette revue contient ${proposals.length} proposition(s).`);
const r = applyProposals(files, proposals, pick);
for (const f of r.touched) { const fp = path.join(DATA, f + ".json"), orig = await fs.readFile(fp, "utf8"); await fs.writeFile(fp, fmt(files[f], /\}\]\}\s*$/.test(orig))); }
const msg = [r.applied.length ? `Appliqué : ${r.applied.map((n) => "#" + n).join(", ")}.` : "Rien d'appliqué.", ...r.skipped.map((s) => `Ignoré #${s.n} : ${s.why}.`)].join("\n");
await fs.writeFile(result, msg + (r.applied.length ? "\nLes données sont poussées ; le site se met à jour au prochain déploiement." : ""));
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${r.applied.length}\n`);
console.log(msg);
