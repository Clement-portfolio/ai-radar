# AI Radar

Site de veille sur l'IA : actualités classées par pays, état du marché, infrastructure, course USA–Chine.

## Fonctionnement
- **Agent de collecte** (`collector/`, GitHub Actions toutes les 3 h) : lit ~44 flux RSS, Google News (11 éditions), GDELT, NewsData.io, Hacker News, Hugging Face, arXiv, SEC EDGAR et le Federal Register ; dédoublonne ; Gemini classe (pays, thème, importance, couche) et résume en français ; les données sont enregistrées dans `public/data/`.
- **Site** (`server.js` + `public/`, hébergé sur Render) : sert le site et lit les dernières données directement sur GitHub (cache de 2 min). Ouvrir le site ou cliquer sur « Actualiser » ne lance aucune collecte : elle tourne uniquement sur GitHub Actions.
- `public/data/market.json`, `layers.json`, `race.json` : état du marché, couches et course USA–Chine. Rédigés à la main avec sources, **pas mis à jour automatiquement**.

## Configuration
| Où | Nom | Rôle |
|---|---|---|
| GitHub › Settings › Secrets › Actions | `GEMINI_API_KEY`, `NEWSDATA_API_KEY` | classement et NewsData |
| GitHub › Settings › Variables › Actions | `SEC_USER_AGENT` | ex. `AI Radar contact@exemple.com` (exigé par la SEC) |
| GitHub › Settings › Variables › Actions | `SITE_URL` | adresse du site Render, pour l'empêcher de s'endormir (ping toutes les 10 min) |
| Render › Environment | aucune variable obligatoire | le serveur ne fait que servir le site |

## Commandes
`npm test` (hors ligne) · `npm run collect` · `npm start`
