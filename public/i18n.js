/* What's Going On? — traduction de l'interface en anglais (FR par défaut).
   Les textes du site sont écrits en français ; en anglais, chaque texte affiché est remplacé à l'écran :
   1) dictionnaire exact, 2) traductions des données (data/en.json, produites par la collecte), 3) règles pour les dates, nombres et phrases à trous.
   Un texte inconnu reste en français. Les articles ont leur propre version anglaise (title_en, summary_en…). */
(function(){
"use strict";
var D={
"Actualités":"News","Marché et infrastructure":"Market & infrastructure","Marché":"Market","Infrastructure":"Infrastructure","USA–Chine":"US–China","Méthode":"Method","Aujourd'hui":"Today","Briefing du jour":"Daily briefing",
"Chargement…":"Loading…","mise à jour automatique":"automatic update","mise à jour automatique ":"automatic update ","toutes les 3 h":"every 3 h","Mise à jour automatique toutes les 3 heures":"Automatic update every 3 hours","Mise à jour toutes les 3 heures":"Update every 3 hours","Aucune mise à jour":"No update yet","Puces IA":"AI chips","Puces IA (Ascend)":"AI chips (Ascend)","Puces IA (GPU et ASIC)":"AI chips (GPU and ASIC)","SEC (10-K et 10-Q) ↗":"SEC (10-K and 10-Q) ↗","SEC (10-K et 10-Q)":"SEC (10-K and 10-Q)",
"Toutes les actualités →":"All news →","Sources":"Sources","Source":"Source","Tous":"All","Toutes":"All","Europe":"Europe","Golfe":"Gulf","Autres":"Other","Chine":"China","États-Unis":"United States","Royaume-Uni":"United Kingdom",
"Modèles":"Models","Puces":"Chips","Énergie":"Energy","Finance":"Finance","Politique":"Politics","Régulation":"Regulation","Adoption":"Adoption","Recherche":"Research",
"Applications":"Applications","Datacenters":"Data centers","Mémoire HBM":"HBM memory","Fonderie":"Foundry","Financement":"Funding","Autre":"Other",
"Source primaire":"Primary source","Presse":"Press","Non vérifié":"Unverified",
"Pays":"Country","Catégorie":"Category","Essentiel seulement":"Essentials only",
"Les informations collectées, de la plus récente à la plus ancienne. Cliquez sur un titre pour lire l'article.":"The collected news, from most recent to oldest. Click a headline to read the article.",
"Aucune actualité pour ces filtres.":"No news for these filters.","Aucune actualité pour le moment.":"No news yet.",
"Le briefing est rédigé par l'IA à chaque collecte. En attendant, voici les articles les plus importants.":"The briefing is written by AI at each collection run. Meanwhile, here are the most important articles.",
"Résumé indisponible : ouvrez l'article.":"Summary unavailable: open the article.","(titre d'origine, non classé par l'IA)":"(original title, not classified by AI)",
"Nouvelles données":"New data","Déjà à jour":"Already up to date","Échec de l'actualisation":"Refresh failed","Données indisponibles":"Data unavailable","Données en cours de collecte.":"Data is being collected.","Courbes en cours de collecte.":"Charts are being collected.",
"Afficher le résumé":"Show summary","Lire sur":"Read on",
"Qui dépense, qui gagne de l'argent, qui compte. Chiffres sourcés ; la date et la source figurent sous chaque donnée.":"Who spends, who makes money, who matters. Sourced figures; the date and source appear under each data point.",
"Marché":"Market","Qui dépense":"Who spends","Qui gagne":"Who earns","Qui compte":"Who matters","Principaux acteurs":"Main players","Détails":"Details","Détail":"Detail",
"Capex annoncé, revenus, dépôts SEC, principaux acteurs":"Announced capex, revenue, SEC filings, main players",
"Capex 2026, États-Unis":"2026 capex, United States","Capex, Chine":"Capex, China","Capex":"Capex","Capex 2026, 5 géants":"2026 capex, 5 giants","Capex / revenus":"Capex / revenue",
"Guidance annuelle, en milliards de dollars. Zone claire = fourchette.":"Annual guidance, in billions of dollars. Light area = range.",
"Montants en yuans, comparables au capex américain à un facteur de 5 à 7 près.":"Amounts in yuan, comparable to US capex within a factor of 5 to 7.",
"Réalisé : ce que les géants ont déjà dépensé":"Actual: what the giants have already spent",
"Capex et revenus des 12 derniers mois, lus automatiquement dans les dépôts officiels à la SEC (10-K et 10-Q). Aucun chiffre n'est estimé : chacun porte sa période, sa date de dépôt et son lien.":"Capex and revenue for the last 12 months, read automatically from official SEC filings (10-K and 10-Q). No figure is estimated: each one carries its period, filing date and link.",
"Société":"Company","Revenus":"Revenue","Revenus de l'IA":"AI revenue","Run-rates":"Run-rates","Acteur":"Player","Rôle":"Role","Montant":"Amount","Publication":"Published","Repère":"Reference",
"À lire avant de comparer.":"Read before comparing.","Chiffres de la SEC":"SEC figures",
"Le capex est la sortie de trésorerie pour immobilisations corporelles telle que déclarée dans les données XBRL ; il n'inclut pas toujours les contrats de location-financement, d'où un écart possible avec les guidances ci-dessus. Les exercices sont décalés : Oracle (mai), Microsoft (juin) ; les périodes affichées sont donc propres à chaque société.":"Capex is the cash outflow for property and equipment as reported in XBRL data; it does not always include finance leases, so it may differ from the guidance above. Fiscal years are offset: Oracle (May), Microsoft (June); the periods shown are therefore specific to each company.",
"Capex et revenus des cinq géants américains sont relus automatiquement dans les dépôts officiels. Au-delà de 30 jours sans relecture, une alerte s'affiche. Le reste de la page Marché reste saisi à la main.":"Capex and revenue of the five US giants are re-read automatically from official filings. After 30 days without a re-read, an alert is shown. The rest of the Market page is still entered by hand.",
"Run-rate annualisé, en milliards de dollars.":"Annualized run-rate, in billions of dollars.",
"Les revenus des laboratoires privés ne sont pas audités et ne sont pas calculés de la même façon.":"Private labs' revenues are not audited and are not calculated the same way.",
"Parts de marché":"Market shares","Parts de marché : où est le compute, qui fabrique":"Market shares: where the compute is, who makes it",
"Qui construit et possède la puissance de calcul ?":"Who builds and owns the computing power?",
"Qui fabrique les modèles, à quelle échelle, et qui les utilise sur le web ?":"Who builds the models, at what scale, and who uses them on the web?",
"Qui utilise l'IA en entreprise, et quel argent y entre ?":"Who uses AI in business, and how much money is flowing in?",
"Qui dépense le plus en capex":"Who spends the most on capex",
"Part du capex des cinq géants sur les douze derniers mois":"Share of the five giants' capex over the last twelve months",
"Parts calculées entre ces cinq sociétés seulement : ce n'est pas leur part du capex mondial. Capex déclaré (immobilisations corporelles) ; les exercices sont décalés (Oracle, Microsoft).":"Shares calculated among these five companies only: not their share of global capex. Reported capex (property and equipment); fiscal years are offset (Oracle, Microsoft).",
"Périodes propres à chaque société, jusqu'à fin":"Periods specific to each company, up to end of",
"Part du chiffre d'affaires HBM":"Share of HBM revenue","Part du chiffre d'affaires des fonderies, tous usages confondus":"Share of foundry revenue, all uses combined",
"Part du marché mondial des infrastructures cloud (chiffre d'affaires)":"Share of the global cloud infrastructure market (revenue)",
"Part du trafic web des sept principaux sites d'IA générative":"Share of web traffic of the seven main generative AI sites",
"Part des dépenses d'API LLM des entreprises":"Share of enterprises' LLM API spending",
"Part de la puissance de calcul vendue, par concepteur de puces":"Share of computing power sold, by chip designer",
"Parc cumulé de puces IA détenu (équivalents H100)":"Cumulative AI chip fleet owned (H100 equivalents)",
"Part des puces IA arrivées dans chaque pays depuis 2022 (équivalents H100)":"Share of AI chips that arrived in each country since 2022 (H100 equivalents)",
"Part des tokens traités par des modèles à poids ouverts ou fermés":"Share of tokens processed by open-weight vs closed models",
"Part gardée":"Share kept","Qui domine":"Who leads",
"Poids ouverts":"Open weights","Poids fermés":"Closed weights","Autres propriétaires":"Other owners","Union européenne":"European Union","Reste du monde":"Rest of world",
"Capex du trimestre divisé par le revenu total du même trimestre : pas seulement le revenu IA, que les sociétés ne publient pas.":"Quarterly capex divided by total revenue of the same quarter: not just AI revenue, which companies do not publish.",
"Calcul installé":"Installed compute","Capex et financement":"Capex and funding","Adoption et argent":"Adoption and money","Applications et adoption":"Applications and adoption","Évolution":"Trends","Comment ça évolue":"How it is evolving",
"Adoption":"Adoption","Financement et revenus":"Funding and revenue","Perspectives":"Outlook","Chiffres clés":"Key figures","une mesure par carte, datée et sourcée":"one measure per card, dated and sourced","Ce que c'est":"What it is","Pourquoi ça compte":"Why it matters","Dernier chiffre":"Latest figure","Risque principal":"Main risk","Acteurs émergents":"Emerging players","une fiche courte chacun":"one short card each","Capex 2027 prévu":"Expected 2027 capex","fourchette d'analystes, pas des engagements":"analyst range, not commitments","Prochains catalyseurs":"Upcoming catalysts","seulement les dates publiées":"published dates only","Trois indicateurs de risque":"Three risk indicators","Capacité":"Capacity","Ce qui débloquerait":"What would unblock it","Émergent":"Emerging","Calcul en orbite":"Orbital compute","Neocloud":"Neocloud","Puces alternatives":"Alternative chips","Laboratoire chinois":"Chinese lab","aujourd'hui":"today","Règle.":"Rule.","Étage 1 sur 3":"Tier 1 of 3","Étage 2 sur 3":"Tier 2 of 3","Étage 3 sur 3":"Tier 3 of 3","courbes dans le temps":"charts over time","parts de marché, chaque camembert est une mesure différente":"market shares, each pie is a different measure",
"Sommaire":"Contents","Capex trimestriel des cinq géants":"Quarterly capex of the five giants","Capex rapporté aux revenus, par géant":"Capex as a share of revenue, by giant",
"Capex trimestriel":"Quarterly capex","Compute IA vendu chaque trimestre":"AI compute sold each quarter","Plus gros entraînement : USA vs Chine":"Largest training run: US vs China",
"Utilisateurs actifs de ChatGPT":"ChatGPT active users","Revenu annualisé d'OpenAI et d'Anthropic":"OpenAI and Anthropic annualized revenue","Parts de trafic web par chatbot":"Web traffic share by chatbot",
"Entreprises américaines qui utilisent l'IA":"US companies using AI","Parts du marché HBM, cinq trimestres":"HBM market shares, five quarters","Camembert":"Pie chart","Sommaire du marché":"Market contents",
"Variation depuis le point précédent":"Change since the previous point",
"La pile de l'IA, des applications à l'énergie. Pour chaque couche : qui domine, où ça coince, et à quel point (tension de 0 à 10, estimation éditoriale).":"The AI stack, from applications to energy. For each layer: who leads, where it is stuck, and how badly (tension from 0 to 10, editorial estimate).",
"Ordre de la pile":"Stack order","Par tension":"By tension","Couche":"Layer","Tension":"Tension","Tendance":"Trend","Type":"Type",
"Critique (8 à 10)":"Critical (8 to 10)","Élevé (6 à 7)":"High (6 to 7)","Modéré ou faible (0 à 5)":"Moderate or low (0 to 5)","Critique":"Critical","Élevé":"High","Modéré":"Moderate","Faible":"Low",
"Classement":"Ranking","couches : avance USA":"layers: US ahead","couches : avance Chine":"layers: China ahead","Avance USA →":"US ahead →","← Avance Chine":"← China ahead",
"→ écart stable":"→ gap stable","↗ les États-Unis creusent l'écart":"↗ the US is widening the gap","↘ la Chine creuse l'écart":"↘ China is widening the gap","↘ la Chine rattrape":"↘ China is catching up","↗ les États-Unis rattrapent":"↗ the US is catching up","à égalité":"level",
"Les scores USA–Chine et les tensions des couches sont des estimations éditoriales, pas des mesures.":"The US–China scores and the layer tensions are editorial estimates, not measurements.",
"Méthode et sources":"Method and sources","Méthode.":"Method.","Ce que ce site fait, ce qu'il ne fait pas, et d'où viennent les chiffres.":"What this site does, what it does not do, and where the figures come from.",
"Fonctionnement":"How it works","Collecte":"Collection","Lire avec prudence":"Read with caution","Limites":"Limits","Limites et points sourcés":"Limits and sourced points","et points sourcés":"and sourced points","Revue hebdomadaire":"Weekly review",
"Un agent récupère toutes les trois heures les flux de médias et de sources officielles, dans le monde. Seuls les domaines d'une liste de confiance sont retenus.":"An agent collects media feeds and official sources worldwide every three hours. Only domains on a trusted list are kept.",
"Chaque article reçoit un pays, un thème, une importance de 1 à 3, une couche de la pile et un résumé en français. Sans IA disponible, le titre d'origine est publié tel quel.":"Each article gets a country, a topic, an importance from 1 to 3, a layer of the stack and a summary in French and English. When AI is unavailable, the original title is published as is.",
"Les 10 essentiels et le brief":"The daily briefing","Les données sont enregistrées dans le dépôt GitHub puis affichées ici. À chaque ouverture, et via « Actualiser », le site affiche immédiatement les dernières données publiées ; il ne lance aucune collecte.":"The data is saved in the GitHub repository and then displayed here. Each time you open the site, and via “Refresh”, it immediately shows the latest published data; it does not start any collection.",
"Sélection par importance, fraîcheur, source primaire et nombre de médias qui couvrent le sujet, avec un minimum de diversité par zone et par couche. Le brief en 5 puces est rédigé par l'IA à partir de ces seuls articles ; une puce dont les chiffres ne figurent pas dans ses sources est écartée.":"Stories are selected by importance, freshness, primary source and the number of outlets covering them, over the last 7 days. The briefing is written by AI from these articles only; any text whose figures do not appear in its sources is discarded.",
"Source primaire : document officiel (SEC, registre fédéral, communiqué, blog d'une entreprise). Presse : média figurant sur une liste de confiance. Les newsletters, blogs personnels et sites de recopie sont écartés.":"Primary source: official document (SEC, Federal Register, press release, company blog). Press: outlet on a trusted list. Newsletters, personal blogs and copy-paste sites are excluded.",
"Chaque lundi, le robot relit les pages saisies à la main à la lumière des articles collectés et propose des mises à jour sourcées. Rien ne change sans validation du propriétaire du site.":"Every Monday, the robot re-reads the hand-entered pages in light of the collected articles and proposes sourced updates. Nothing changes without the site owner's approval.",
"Le HBM (Counterpoint), les fonderies (TrendForce), les propriétaires du compute et les concepteurs de puces (Epoch AI) sont relus automatiquement à la source. Si la page ou le fichier change et que la lecture échoue, l'ancien chiffre reste affiché avec sa date et une alerte apparaît. Les autres camemberts sont mis à jour à la main.":"HBM (Counterpoint), foundries (TrendForce), compute owners and chip designers (Epoch AI) are re-read automatically at the source. If the page or file changes and the read fails, the old figure stays displayed with its date and an alert appears. The other pie charts are updated by hand.",
"Les courbes marquées « auto » (capex des géants à la SEC, compute vendu et records d'entraînement chez Epoch AI, parts HBM chez Counterpoint, adoption en entreprise au Census Bureau) sont relues à chaque collecte, avec les mêmes garde-fous. Les courbes « semi-auto » (utilisateurs, trafic web, revenu annualisé) n'ont pas de source lisible par un robot : la revue du lundi propose de nouveaux points avec leur source, et rien n'est ajouté sans validation. Chaque point est daté et sourcé.":"Charts marked “auto” (giants' capex at the SEC, compute sold and training records at Epoch AI, HBM shares at Counterpoint, enterprise adoption at the Census Bureau) are re-read at every collection, with the same safeguards. “Semi-auto” charts (users, web traffic, annualized revenue) have no robot-readable source: the Monday review proposes new points with their source, and nothing is added without approval. Every point is dated and sourced.",
"Santé de la collecte":"Collection health","Sources actives":"Active sources","Sources en échec":"Failing sources","Flux RSS":"RSS feeds","Articles bruts":"Raw articles","Gardés":"Kept","Écartés":"Rejected","Rendement par source : articles gardés / écartés par l'IA":"Yield by source: articles kept / rejected by AI",
"Exemples d'articles écartés (30 derniers)":"Examples of rejected articles (last 30)","Sources citées":"Sources cited","Courbes dans le temps":"Charts over time",
"Aucun acteur pour ce filtre.":"No player for this filter.","Aucun camembert disponible.":"No pie chart available.","Aucune donnée de revenus pour ce pays.":"No revenue data for this country.",
"Dernière relecture impossible : chiffre conservé, à vérifier.":"Last re-read failed: figure kept, to be checked.","Dernière relecture impossible : courbe conservée, à vérifier.":"Last re-read failed: chart kept, to be checked.",
"What's Going On? · Données collectées automatiquement, classées par IA, à vérifier à la source. Ne constitue pas un conseil en investissement.":"What's Going On? · Data collected automatically, classified by AI, to be checked at the source. Not investment advice.",
"@aria-label:What's Going On? : aller à Aujourd'hui":"@aria-label:What's Going On?: go to Today"
};
/* dictionnaire insensible aux espaces de bord ; les clés avec « @attr: » valent pour les attributs */
var MONTHS={"janv.":"Jan","févr.":"Feb","mars":"Mar","avr.":"Apr","mai":"May","juin":"Jun","juil.":"Jul","août":"Aug","sept.":"Sep","oct.":"Oct","nov.":"Nov","déc.":"Dec"};
var MRE="(janv\\.|févr\\.|mars|avr\\.|mai|juin|juil\\.|août|sept\\.|oct\\.|nov\\.|déc\\.)";
var PH=[ /* phrases à trous et locutions, appliquées dans l'ordre */
 [/^Voir (\d+) articles de plus \((\d+) restants\)$/,"Show $1 more articles ($2 remaining)"],
 [/^Sources citées \((\d+)\)$/,"Sources cited ($1)"],[/^Sources en échec \((\d+)\)$/,"Failing sources ($1)"],[/^Étage (\d) sur (\d)$/,"Tier $1 of $2"],
 [/^(Critique|Modéré|Élevé|Faible) · (\d+\/10)$/,function(m,a,b){return tr(a)+" · "+b}],
 [/^(.{2,70}) : (\d[\d.,\s\u00a0\u202f]*(?: ?%| ?[A-Za-z$¥€]{1,4})?)$/,function(m,a,b){var x=tr(a);return(x===a?a:x)+": "+b}],
 [/^Pays : (.+)$/,function(m,a){return"Country: "+tr(a)}],[/^Catégorie : (.+)$/,function(m,a){return"Category: "+tr(a)}],
 [/^Données il y a (\d+) (min|h|j)$/,function(m,n,u){return"Data "+n+" "+(u==="j"?"d":u)+" ago"}],[/^Données à l'instant$/,"Data just now"],[/^Données jamais$/,"Data never"],
 [/^Données (.+)$/,function(m,a){return"Data "+a}],
 [/^Dernière mise à jour (.+)$/,"Last updated $1"],[/^fin (20\d\d) à (20\d\d)$/,"end of $1 to $2"],[/^fin (.+)$/,"end of $1"],[/\brelay[ée]e? par /g,"relayed by "],
 [/^Dernier point : (.+)$/,"Latest point: $1"],[/^Dernier point vieux de (\d+)$/,"Latest point is $1 old"],
 [/^12 mois à fin (.+)$/,"12 months to end $1"],[/^(10-K|10-Q|8-K|20-F|6-K) déposé le (.+?)( ↗)?$/,"$1 filed $2$3"],[/^dernier exercice clos le (.+)$/,"last fiscal year ended $1"],
 [/^Dernier passage : (.+)$/,function(m,a){return"Last run: "+a.replace(/il y a (\d+) (min|h|j)/g,function(x,n,u){return n+" "+(u==="j"?"d":u)+" ago"}).replace(/ sources sur (\d+) répondent/," sources out of $1 responding").replace(/ articles ajoutés/," articles added").replace(/classement par /,"classified by ")}],
 [/\bpar rapport à\b/g,"vs"],[/\bsur un an\b/g,"year on year"],[/\bsur 3\b/g,"of 3"],[/\bdéposé le\b/g,"filed"],[/ jours : à (actualiser|vérifier)\.?/,function(m,a){return" days: to "+(a==="actualiser"?"update":"check")+"."}]
];
var UNITS=[
 [/\bFin T([1-4]) (\d{4})\b/g,"End Q$1 $2"],[/\bT([1-4]) (\d{4})\b/g,"Q$1 $2"],
 [/\bMd\$/g,"bn$"],[/\bMd¥/g,"bn¥"],[/\bT\$/g,"tn$"],[/\bMd€/g,"bn€"]
];
var NUMRULES=[[/(\d),(\d{1,2})(?!\d)/g,"$1.$2"],[/(\d)[   ](?=\d{3}(?!\d))/g,"$1,"],[/ %/g,"%"]];
var extra={},lang="fr",orig=new WeakMap();
function lookup(core){
  if(Object.prototype.hasOwnProperty.call(D,core))return D[core];
  if(Object.prototype.hasOwnProperty.call(extra,core))return extra[core];
  return null;
}
function months(s){return s.replace(new RegExp("(\\d{1,2}) "+MRE+"( \\d{2,4})?","g"),function(m,d,mo,y){return d+" "+MONTHS[mo]+(y||"")}).replace(new RegExp("\\b"+MRE+" (\\d{2})\\b","g"),function(m,mo,y){return MONTHS[mo]+" "+y}).replace(new RegExp("^"+MRE+"$"),function(m,mo){return MONTHS[mo]})}
function numericish(t){
  /* vrai si, une fois retirés les nombres, unités et mois, il ne reste aucun mot : « 4,83 T$ », « 29 sept. 2026 », « T3 2026 » */
  var r=t.replace(new RegExp(MRE,"g"),"").replace(/\bT[1-4]\b/g,"").replace(/Md\$|Md¥|Md€|T\$|H100e|GW|MW|TW|\be\d+|\bM\b|\bT\b|[\d.,\s\u00a0\u202f%–·:+≈<>\/()↗→←-]/g,"");
  return !/\p{L}{2}/u.test(r);
}
function tr(s){
  var m=/^([\s,·]*)([\s\S]*?)([\s·]*)$/.exec(s),pre=m[1],core=m[2].replace(/\s+/g," "),post=m[3];
  if(!core)return s;
  var arrow="";if(/ ↗$/.test(core)){arrow=" ↗";core=core.slice(0,-2)}
  var hit=lookup(core+arrow);
  if(hit!==null)return pre+hit+post;
  hit=lookup(core);
  if(hit!==null)return pre+hit+arrow+post;
  var t=core,matched=false;
  for(var i=0;i<PH.length;i++){var n=t.replace(PH[i][0],PH[i][1]);if(n!==t){matched=true;t=n}}
  if(matched||numericish(core)){
    for(var u=0;u<UNITS.length;u++)t=t.replace(UNITS[u][0],UNITS[u][1]);
    t=months(t);
    for(var j=0;j<NUMRULES.length;j++)t=t.replace(NUMRULES[j][0],NUMRULES[j][1]);
    var hit2=lookup(t);if(hit2!==null)t=hit2; /* seconde chance (ex. « Pays : Tous ») */
  }
  t+=arrow;
  return t===core+arrow?trLoose(s):pre+t+post;
}
/* texte composé (« libellé · période », « , fin sept. 2026 · ») : chaque morceau est traduit séparément */
function trLoose(s){
  var m=/^([\s,·]*)([\s\S]*?)([\s·]*)$/.exec(s);
  if(!m[2]||(m[1]===""&&m[3]===""&&m[2].indexOf(" · ")<0))return s;
  var t=m[2].split(" · ").map(function(p){return tr(p)}).join(" · ");
  return t===m[2]?s:m[1]+t+m[3];
}
var SKIP=["SCRIPT","STYLE","NOSCRIPT"],ART=".row,.bl,.story,.e";
function inArticle(n){var e=n.nodeType===1?n:n.parentNode;return e&&e.closest&&e.closest(ART)}
function doText(n){
  if(inArticle(n)){
    /* le texte des articles vient du site déjà dans la bonne langue ; seuls les libellés fixes (catégories, sources, dates) passent par le dictionnaire */
    var e=n.parentNode;if(!(e&&(e.classList.contains("cat")||e.classList.contains("tag")||e.classList.contains("conf")||e.classList.contains("bylab")||e.classList.contains("day")||e.tagName==="BUTTON")))return;
  }
  var cur=n.nodeValue,st=orig.get(n);
  if(!st||cur!==st.v&&cur!==st.o){st={o:cur,v:cur};orig.set(n,st)} /* nouveau texte (rendu de l'application) : nouvelle origine */
  var v=lang==="en"?tr(st.o):st.o;
  st.v=v;
  if(v!==cur)n.nodeValue=v;
}
var ATTR=["aria-label","title","placeholder"];
function doAttrs(e){
  for(var i=0;i<ATTR.length;i++){var a=ATTR[i];if(!e.hasAttribute||!e.hasAttribute(a))continue;
    var k="__o_"+a,cur=e.getAttribute(a);if(e[k]===undefined)e[k]=cur;
    var v=lang==="en"?(lookup("@"+a+":"+e[k].replace(/\s+/g," "))||tr(e[k])):e[k];
    if(v&&v!==cur)e.setAttribute(a,v)}
}
function walk(root){
  if(!root)return;
  if(root.nodeType===3){doText(root);return}
  if(root.nodeType!==1||SKIP.indexOf(root.tagName)>=0)return;
  doAttrs(root);
  var w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,null),n;
  while((n=w.nextNode())){if(n.nodeType===3){if(SKIP.indexOf(n.parentNode.tagName)<0)doText(n)}else doAttrs(n)}
}
var busy=false;
var mo=new MutationObserver(function(list){
  if(lang!=="en"||busy)return;busy=true;
  try{list.forEach(function(r){[].forEach.call(r.addedNodes,function(n){walk(n)});if(r.type==="characterData")doText(r.target)})}finally{busy=false}
});
function start(){mo.observe(document.body,{childList:true,subtree:true,characterData:true})}
window.I18N={
  tr:tr,
  get lang(){return lang},
  extra:function(o){extra=o||{};if(lang==="en")walk(document.body)},
  set:function(l){
    lang=l==="en"?"en":"fr";
    document.documentElement.lang=lang;
    document.title=lang==="en"?"What's Going On? — the state of AI, live":"What's Going On? — l'état de l'IA, en continu";
    var md=document.querySelector('meta[name="description"]');if(md)md.setAttribute("content",lang==="en"?"The daily briefing, AI news by country, the market, infrastructure and the US–China race.":"Le briefing du jour, les actualités de l'IA par pays, le marché, l'infrastructure et la course États-Unis–Chine.");
    walk(document.body);
  }
};
if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
})();
