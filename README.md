# AI Radar

Site de veille sur l'IA : actualités classées par pays, état du marché, infrastructure, course USA–Chine.

## Fonctionnement
- **Agent de collecte** (`collector/`, GitHub Actions toutes les 2 h) : lit ~44 flux RSS, Google News (11 éditions), GDELT, NewsData.io, Hacker News, Hugging Face, arXiv, SEC EDGAR et le Federal Register ; dédoublonne ; Gemini classe (pays, thème, importance, couche) et résume en français ; les données sont enregistrées dans `public/data/`.
- **Site** (`server.js` + `public/`, hébergé sur Render) : sert le site. À l'ouverture et via « Mettre à jour », le serveur relance la même collecte en arrière-plan si les données ont plus de 30 min.
- `public/data/market.json`, `layers.json`, `race.json` : état du marché, couches et course USA–Chine. Rédigés à la main avec sources, **pas mis à jour automatiquement**.

## Configuration
| Où | Nom | Rôle |
|---|---|---|
| GitHub › Settings › Secrets › Actions | `GEMINI_API_KEY`, `NEWSDATA_API_KEY` | classement et NewsData |
| GitHub › Settings › Variables › Actions | `SEC_USER_AGENT` | ex. `AI Radar contact@exemple.com` (exigé par la SEC) |
| Render › Environment | `GEMINI_API_KEY`, `NEWSDATA_API_KEY`, `SEC_USER_AGENT` | collecte à la demande |

## Commandes
`npm test` (hors ligne) · `npm run collect` · `npm start`
