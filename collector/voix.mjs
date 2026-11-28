// Voix : ce que disent les dirigeants de l'IA. Presse (Google Actualités) et vidéos (chaînes YouTube vérifiées).
// Règle : un titre n'est retenu que si la personne en est le sujet qui parle (« X says… », « …, says X », citation) ou si la vidéo porte son nom.
// Rien n'est inventé ni résumé : titre du média, date, média, lien.
import { markCut, withCutMark } from "./titles.mjs";
import { unitsOk, normalizeFr, stripAmounts, UNITS_RULE } from "./units.mjs";
export const VOIX_RULES = { days: 30, perPerson: 8, perQuery: 30 };

// w : influence (1,6 = voix majeure, 0,6 = élu ou conseiller de second plan) ; sert au classement des déclarations de la Une.
// cat : dirigeants (PDG, y compris chaîne de l'IA) · cadres (CFO, CTO, président, conseil) · chercheurs · pouvoirs publics · investisseurs et analystes.
// Les intitulés sont écrits à la main (vérifiés le 18 nov. 2026) ; `watch: false` coupe l'alerte de changement de poste quand l'intitulé vient d'être mis à jour.
export const PEOPLE = [
  { id: "sam-altman", w: 1.6, cat: "dirigeants", n: "Sam Altman", role: "PDG d'OpenAI", co: "OpenAI", actor: "openai", re: /\bAltman\b/ },
  { id: "dario-amodei", w: 1.6, cat: "dirigeants", n: "Dario Amodei", role: "PDG d'Anthropic", co: "Anthropic", actor: null, re: /(?<!Daniela )\bAmodei\b/ },
  { id: "elon-musk", w: 1.6, cat: "dirigeants", n: "Elon Musk", role: "PDG de Tesla et de SpaceX", co: "SpaceX / xAI", actor: null, re: /\bMusk\b/, q: '"Elon Musk" (xAI OR Grok OR "AI" OR OpenAI OR Nvidia)', topic: true },
  { id: "satya-nadella", w: 1.6, cat: "dirigeants", n: "Satya Nadella", role: "PDG de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bNadella\b/ },
  { id: "sundar-pichai", w: 1.6, cat: "dirigeants", n: "Sundar Pichai", role: "PDG d'Alphabet (Google)", co: "Alphabet", actor: "alphabet", re: /\bPichai\b/ },
  { id: "demis-hassabis", w: 1.6, cat: "dirigeants", n: "Demis Hassabis", role: "PDG de Google DeepMind", co: "Google DeepMind", actor: "alphabet", re: /\bHassabis\b/ },
  { id: "mark-zuckerberg", w: 1.6, cat: "dirigeants", n: "Mark Zuckerberg", role: "PDG de Meta", co: "Meta", actor: "meta", re: /\bZuckerberg\b/, q: '"Mark Zuckerberg" (AI OR Meta OR superintelligence OR "data center")', topic: true },
  { id: "lisa-su", w: 1.6, cat: "dirigeants", n: "Lisa Su", role: "PDG d'AMD", co: "AMD", actor: "amd", re: /\bLisa Su\b/ },
  { id: "hock-tan", w: 1.6, cat: "dirigeants", n: "Hock Tan", role: "PDG de Broadcom", co: "Broadcom", actor: "broadcom", re: /\bHock Tan\b/ },
  { id: "cc-wei", w: 1.6, cat: "dirigeants", n: "C.C. Wei", role: "PDG de TSMC", co: "TSMC", actor: "tsmc", re: /\bC\.?\s?C\.? Wei\b/, q: '"C.C. Wei" TSMC' },
  { id: "andy-jassy", w: 1.6, cat: "dirigeants", n: "Andy Jassy", role: "PDG d'Amazon", co: "Amazon", actor: "amazon", re: /\bJassy\b/ },
  { id: "mustafa-suleyman", cat: "dirigeants", n: "Mustafa Suleyman", role: "Directeur de Microsoft AI", co: "Microsoft", actor: "microsoft", re: /\bSuleyman\b/ },
  { id: "lip-bu-tan", w: 1.6, cat: "dirigeants", n: "Lip-Bu Tan", role: "PDG d'Intel", co: "Intel", actor: "intel-foundry", re: /\bLip-Bu Tan\b/ },
  { id: "christophe-fouquet", cat: "dirigeants", n: "Christophe Fouquet", role: "PDG d'ASML", co: "ASML", actor: "asml", re: /\bFouquet\b/ },
  { id: "kwak-noh-jung", cat: "dirigeants", n: "Kwak Noh-jung", role: "PDG de SK hynix", co: "SK hynix", actor: "sk-hynix", re: /\bKwak Noh[- ]?jung\b/ },
  { id: "michael-intrator", cat: "dirigeants", n: "Michael Intrator", role: "PDG de CoreWeave", co: "CoreWeave", actor: null, re: /\bIntrator\b/ },
  { id: "alex-karp", cat: "dirigeants", n: "Alex Karp", role: "PDG de Palantir", co: "Palantir", actor: null, re: /\bKarp\b/ },
  { id: "robin-li", cat: "dirigeants", n: "Robin Li", role: "PDG de Baidu", co: "Baidu", actor: null, re: /\bRobin Li\b/, q: '"Robin Li" Baidu' },
  { id: "colette-kress", cat: "cadres", n: "Colette Kress", role: "DAF et PDG par intérim de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bKress\b/ },
  { id: "greg-brockman", cat: "cadres", n: "Greg Brockman", role: "Cofondateur et président d'OpenAI", co: "OpenAI", actor: "openai", re: /\bBrockman\b/ },
  { id: "sarah-friar", cat: "cadres", n: "Sarah Friar", role: "Directrice financière d'OpenAI", co: "OpenAI", actor: "openai", re: /\bSarah Friar\b/ },
  { id: "ruth-porat", cat: "cadres", n: "Ruth Porat", role: "Présidente et CIO d'Alphabet", co: "Alphabet", actor: "alphabet", re: /\bPorat\b/ },
  { id: "geoffrey-hinton", cat: "chercheurs", n: "Geoffrey Hinton", role: "Prix Nobel, pionnier du deep learning", co: "", actor: null, re: /\bHinton\b/ },
  { id: "yann-lecun", cat: "chercheurs", n: "Yann LeCun", role: "Président exécutif d'AMI Labs, ex-Meta", co: "AMI Labs", actor: null, re: /\bLeCun\b/ },
  { id: "fei-fei-li", cat: "chercheurs", n: "Fei-Fei Li", role: "Chercheuse, cofondatrice de World Labs", co: "World Labs", actor: null, re: /\bFei-Fei Li\b/ },
  { id: "donald-trump", w: 1.6, cat: "pouvoirs", n: "Donald Trump", role: "Président des États-Unis", co: "", actor: null, re: /\bTrump\b/, q: '"Trump" (AI OR "artificial intelligence" OR Nvidia OR chips OR "data centers")' },
  { id: "david-sacks", cat: "pouvoirs", n: "David Sacks", role: "Coprésident du PCAST, ancien conseiller IA", co: "", actor: null, re: /\bDavid Sacks\b/, q: '"David Sacks" AI' },
  { id: "scott-bessent", w: 1.6, cat: "pouvoirs", n: "Scott Bessent", role: "Secrétaire américain au Trésor", co: "", actor: null, re: /\bBessent\b/, q: '"Bessent" (AI OR Nvidia OR chips OR semiconductor OR tariffs)' },
  { id: "maria-cantwell", w: 0.6, cat: "pouvoirs", n: "Maria Cantwell", role: "Sénatrice démocrate, commission Commerce", co: "", actor: null, re: /\bCantwell\b/, q: '"Maria Cantwell" AI' },
  { id: "josh-hawley", w: 0.6, cat: "pouvoirs", n: "Josh Hawley", role: "Sénateur républicain du Missouri", co: "", actor: null, re: /\bHawley\b/, q: '"Josh Hawley" (AI OR "artificial intelligence" OR chatbot)' },
  { id: "elizabeth-warren", w: 0.6, cat: "pouvoirs", n: "Elizabeth Warren", role: "Sénatrice démocrate, commission Banques", co: "", actor: null, re: /\bElizabeth Warren\b|\b(?:Sen\.|Senator) Warren\b/, q: '"Elizabeth Warren" (Nvidia OR AI OR chips OR "data centers")' },
  { id: "john-moolenaar", w: 0.6, cat: "pouvoirs", n: "John Moolenaar", role: "Représentant républicain, commission sur la Chine", co: "", actor: null, re: /\bMoolenaar\b/, q: '"Moolenaar" (chips OR AI OR Nvidia OR China OR export)' },
  { id: "bill-ackman", cat: "investisseurs", n: "Bill Ackman", role: "Fondateur et PDG de Pershing Square", co: "", actor: null, re: /\bAckman\b/ },
  { id: "michael-burry", cat: "investisseurs", n: "Michael Burry", role: "Investisseur (« The Big Short »)", co: "", actor: null, re: /\bBurry\b/ },
  { id: "stacy-rasgon", cat: "investisseurs", n: "Stacy Rasgon", role: "Analyste semi-conducteurs (Bernstein)", co: "", actor: null, re: /\bRasgon\b/ },
  { id: "gil-luria", cat: "investisseurs", n: "Gil Luria", role: "Analyste (D.A. Davidson)", co: "", actor: null, re: /\bLuria\b/, q: '"Gil Luria"' },
  { id: "ming-chi-kuo", cat: "investisseurs", n: "Ming-Chi Kuo", role: "Analyste de la chaîne d'approvisionnement tech", co: "", actor: null, re: /\bKuo\b/, q: '"Ming-Chi Kuo"' },
  { id: "masayoshi-son", cat: "investisseurs", n: "Masayoshi Son", role: "Fondateur et PDG de SoftBank", co: "", actor: null, re: /\bMasayoshi Son\b/ },
  { id: "marc-andreessen", cat: "investisseurs", n: "Marc Andreessen", role: "Cofondateur d'Andreessen Horowitz", co: "", actor: null, re: /\bAndreessen\b/ },
  { id: "jim-chanos", cat: "investisseurs", n: "Jim Chanos", role: "Vendeur à découvert (Kynikos)", co: "", actor: null, re: /\bChanos\b/, q: '"Jim Chanos" (AI OR Nvidia OR "data center" OR bubble)' },
  // --- Ajouts : dirigeants et figures d'entreprise ---
  { id: "jeff-bezos", cat: "dirigeants", n: "Jeff Bezos", role: "Fondateur d'Amazon, co-PDG de Prometheus", co: "Project Prometheus", actor: "amazon", re: /\bBezos\b/, q: '"Jeff Bezos" (AI OR Prometheus OR Amazon OR "Blue Origin")', topic: true },
  { id: "aidan-gomez", cat: "dirigeants", n: "Aidan Gomez", role: "PDG de Cohere", co: "Cohere", actor: null, re: /\bAidan Gomez\b/ },
  { id: "eric-schmidt", cat: "cadres", n: "Eric Schmidt", role: "Ancien PDG de Google, investisseur en IA", co: "", actor: null, re: /\bEric Schmidt\b/, q: '"Eric Schmidt" (AI OR "artificial intelligence" OR China OR chips)', topic: true },
  { id: "bill-gates", cat: "cadres", n: "Bill Gates", role: "Cofondateur de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bBill Gates\b/, q: '"Bill Gates" (AI OR "artificial intelligence")', topic: true },
  { id: "pat-gelsinger", cat: "cadres", n: "Pat Gelsinger", role: "Ancien PDG d'Intel, président de Gloo", co: "Gloo", actor: null, re: /\bGelsinger\b/, q: '"Pat Gelsinger" (AI OR Intel OR Nvidia OR chips)', topic: true },
  { id: "jeff-dean", cat: "cadres", n: "Jeff Dean", role: "Directeur scientifique de Google", co: "Google DeepMind", actor: "alphabet", re: /\bJeff Dean\b/, q: '"Jeff Dean" (Google OR Gemini OR AI)' },
  // --- Ajouts : OpenAI, Anthropic et leurs cofondateurs ---
  { id: "daniela-amodei", cat: "cadres", n: "Daniela Amodei", role: "Cofondatrice et présidente d'Anthropic", co: "Anthropic", actor: null, re: /\bDaniela Amodei\b/ },
  { id: "jack-clark", cat: "cadres", n: "Jack Clark", role: "Cofondateur d'Anthropic", co: "Anthropic", actor: null, re: /\bJack Clark\b/, q: '"Jack Clark" Anthropic' },
  // --- Ajouts : cofondateurs de labos (dont partis) ---
  { id: "kai-fu-lee", cat: "chercheurs", n: "Kai-Fu Lee", role: "Fondateur de 01.AI, ex-Google Chine", co: "01.AI", actor: null, re: /\bKai-Fu Lee\b/ },
  // --- Ajouts : experts de l'IA ---
  { id: "stuart-russell", cat: "chercheurs", n: "Stuart Russell", role: "Professeur à Berkeley, sécurité de l'IA", co: "", actor: null, re: /\bStuart Russell\b/, q: '"Stuart Russell" AI' },
  // --- Ajouts : pouvoirs publics ---
  // --- Ajouts : investisseurs et analystes ---
  { id: "dylan-patel", cat: "investisseurs", n: "Dylan Patel", role: "Fondateur de SemiAnalysis", co: "SemiAnalysis", actor: null, re: /\bDylan Patel\b/, q: '"Dylan Patel" SemiAnalysis' },
  { id: "peter-thiel", cat: "investisseurs", n: "Peter Thiel", role: "Cofondateur de Palantir, investisseur", co: "", actor: null, re: /\bPeter Thiel\b/, q: '"Peter Thiel" (AI OR Palantir OR Nvidia OR bubble)' },
  { id: "vinod-khosla", cat: "investisseurs", n: "Vinod Khosla", role: "Fondateur de Khosla Ventures", co: "", actor: null, re: /\bVinod Khosla\b/, q: '"Vinod Khosla" AI' },
  { id: "chamath-palihapitiya", cat: "investisseurs", n: "Chamath Palihapitiya", role: "Fondateur de Social Capital", co: "", actor: null, re: /\bChamath\b/, q: '"Chamath Palihapitiya" (AI OR Nvidia OR OpenAI OR bubble)' },
  // --- Ajouts : responsables américains (nov. 2026) — ceux qui décident (signent, votent, bloquent) ---
  { id: "jay-clayton", w: 1.3, cat: "pouvoirs", n: "Jay Clayton", role: "Directeur du renseignement national, tsar de l'IA", co: "", actor: null, re: /\bJay Clayton\b|\bDNI Clayton\b/, q: '"Jay Clayton" (AI OR "Super Intelligence" OR "artificial intelligence")' },
  { id: "chuck-schumer", w: 0.8, cat: "pouvoirs", n: "Chuck Schumer", role: "Sénateur de New York, chef des démocrates", co: "", actor: null, re: /\bSchumer\b/, q: '"Schumer" (AI OR "artificial intelligence" OR Nvidia OR chips)' },
  // --- Ceux qui influencent (conseillent, écrivent les textes) ---
  { id: "kevin-hassett", w: 0.8, cat: "pouvoirs", n: "Kevin Hassett", role: "Directeur du Conseil économique national", co: "", actor: null, re: /\bHassett\b/, q: '"Kevin Hassett" (AI OR "artificial intelligence" OR productivity)' },
  { id: "gavin-newsom", w: 0.8, cat: "pouvoirs", n: "Gavin Newsom", role: "Gouverneur démocrate de Californie", co: "", actor: null, re: /\bNewsom\b/, q: '"Newsom" (AI OR "artificial intelligence" OR preemption)' },
  { id: "rahul-patil", cat: "cadres", n: "Rahul Patil", role: "Directeur technique d'Anthropic", co: "Anthropic", actor: null, re: /\bRahul Patil\b/, q: "\"Rahul Patil\" Anthropic" },
  { id: "matt-garman", cat: "dirigeants", n: "Matt Garman", role: "PDG d'AWS (Amazon Web Services)", co: "Amazon", actor: "amazon", re: /\bGarman\b/, q: "\"Matt Garman\" (AWS OR AI OR Amazon)" },
  { id: "rene-haas", cat: "dirigeants", n: "Rene Haas", role: "PDG d'Arm", co: "Arm", actor: "arm", re: /\bRene Haas\b/, q: "\"Rene Haas\" Arm" },
  { id: "mike-sicilia", cat: "dirigeants", n: "Mike Sicilia", role: "Co-PDG d'Oracle", co: "Oracle", actor: null, re: /\bSicilia\b/, q: "\"Mike Sicilia\" Oracle" },
  { id: "kevin-warsh", w: 1.3, cat: "pouvoirs", n: "Kevin Warsh", role: "Président de la Réserve fédérale", co: "", actor: null, re: /\bWarsh\b/, q: "\"Warsh\" Fed (AI OR \"artificial intelligence\" OR \"super intelligence\")" },
  { id: "brad-gerstner", cat: "investisseurs", n: "Brad Gerstner", role: "Fondateur d'Altimeter Capital", co: "", actor: null, re: /\bGerstner\b/, q: "\"Brad Gerstner\" (AI OR Nvidia OR OpenAI)" },
  { id: "jamie-dimon", cat: "investisseurs", n: "Jamie Dimon", role: "PDG de JPMorgan Chase", co: "", actor: null, re: /\bDimon\b/, q: "\"Jamie Dimon\" AI" },
  { id: "david-solomon", cat: "investisseurs", n: "David Solomon", role: "PDG de Goldman Sachs", co: "", actor: null, re: /\bDavid Solomon\b/, q: "\"David Solomon\" Goldman (AI OR \"artificial intelligence\")" },
  { id: "jon-gray", cat: "investisseurs", n: "Jon Gray", role: "Président et COO de Blackstone", co: "", actor: null, re: /\bJon Gray\b/, q: "\"Jon Gray\" Blackstone (AI OR \"data centers\")" },
  { id: "marc-rowan", cat: "investisseurs", n: "Marc Rowan", role: "PDG d'Apollo Global Management", co: "", actor: null, re: /\bMarc Rowan\b/, q: "\"Marc Rowan\" Apollo (AI OR \"data centers\")" },
  { id: "howard-marks", cat: "investisseurs", n: "Howard Marks", role: "Cofondateur d'Oaktree Capital", co: "", actor: null, re: /\bHoward Marks\b/, q: "\"Howard Marks\" (AI OR bubble)" },
  { id: "vivek-arya", cat: "investisseurs", n: "Vivek Arya", role: "Analyste semi-conducteurs (BofA Securities)", co: "", actor: null, re: /\bVivek Arya\b/, q: "\"Vivek Arya\" (Nvidia OR AI OR semiconductors)" },
  { id: "brent-thill", cat: "investisseurs", n: "Brent Thill", role: "Analyste logiciels (Jefferies)", co: "", actor: null, re: /\bBrent Thill\b/, q: "\"Brent Thill\" (AI OR software)" },
  { id: "palmer-luckey", cat: "dirigeants", n: "Palmer Luckey", role: "Fondateur d'Anduril (défense)", co: "Anduril", actor: null, re: /\bLuckey\b/, q: "\"Palmer Luckey\" (AI OR Anduril OR autonomous)" },
  { id: "gary-gensler", w: 0.8, cat: "pouvoirs", n: "Gary Gensler", role: "Ancien président de la SEC, prof. au MIT", co: "", actor: null, re: /\bGensler\b/, q: "\"Gary Gensler\" (AI OR \"artificial intelligence\")" },
  { id: "arvind-krishna", cat: "dirigeants", n: "Arvind Krishna", role: "PDG d'IBM", co: "IBM", actor: null, re: /\bArvind Krishna\b/, q: "\"Arvind Krishna\" IBM (AI OR quantum)" },
  { id: "jd-vance", w: 1.3, cat: "pouvoirs", n: "JD Vance", role: "Vice-président des États-Unis", co: "", actor: null, re: /\b(?:JD|J\.D\.) Vance\b|\b(?:Vice President|VP) Vance\b/, q: "\"JD Vance\" (AI OR \"artificial intelligence\" OR chips OR \"data centers\")" },
  { id: "marco-rubio", w: 0.8, cat: "pouvoirs", n: "Marco Rubio", role: "Secrétaire d'État américain", co: "", actor: null, re: /\bRubio\b/, q: "\"Rubio\" (AI OR chips OR Nvidia OR \"artificial intelligence\")" },
  { id: "dwarkesh-patel", cat: "investisseurs", n: "Dwarkesh Patel", role: "Animateur du podcast Dwarkesh", co: "", actor: null, re: /\bDwarkesh Patel\b/, q: "\"Dwarkesh Patel\" AI" },
  { id: "benedict-evans", cat: "investisseurs", n: "Benedict Evans", role: "Analyste indépendant de la tech", co: "", actor: null, re: /\bBenedict Evans\b/, q: "\"Benedict Evans\" AI" },
  { id: "nathan-lambert", cat: "chercheurs", n: "Nathan Lambert", role: "Chercheur à Ai2", co: "Ai2", actor: null, re: /\bNathan Lambert\b/, q: "\"Nathan Lambert\" (AI OR Ai2 OR OLMo)" },
  { id: "xi-jinping", cat: "pouvoirs", n: "Xi Jinping", role: "Président de la Chine", co: "", actor: null, re: /\bXi Jinping\b|\bPresident Xi\b/, q: "\"Xi Jinping\" (AI OR \"artificial intelligence\" OR chips OR Nvidia)" },
  { id: "chey-tae-won", cat: "dirigeants", n: "Chey Tae-won", role: "Président du groupe SK", co: "SK", actor: "sk-hynix", re: /\bChey Tae[- ]won\b/, q: "\"Chey Tae-won\" (AI OR SK OR Nvidia OR HBM)", topic: true },
  { id: "wang-xingxing", cat: "dirigeants", n: "Wang Xingxing", role: "Fondateur d'Unitree (robots humanoïdes)", co: "Unitree", actor: null, re: /\bWang Xingxing\b/, q: "\"Wang Xingxing\" Unitree" },
  { id: "pony-ma", cat: "dirigeants", n: "Pony Ma", role: "PDG de Tencent", co: "Tencent", actor: null, re: /\bPony Ma\b|\bMa Huateng\b/, q: "\"Pony Ma\" (AI OR Tencent)", topic: true },
  { id: "young-liu", cat: "dirigeants", n: "Young Liu", role: "Président de Foxconn (Hon Hai)", co: "Foxconn", actor: null, re: /\bYoung Liu\b/, q: "\"Young Liu\" Foxconn (AI OR Nvidia)" },
  { id: "jay-y-lee", cat: "dirigeants", n: "Jay Y. Lee", role: "Président de Samsung Electronics", co: "Samsung", actor: "samsung", re: /\bJay Y\. Lee\b|\bLee Jae-yong\b/, q: "\"Jay Y. Lee\" OR \"Lee Jae-yong\" Samsung", topic: true },
  { id: "joe-tsai", cat: "dirigeants", n: "Joe Tsai", role: "Président d'Alibaba", co: "Alibaba", actor: "alibaba", re: /\bJoe Tsai\b/, q: "\"Joe Tsai\" Alibaba (AI OR capex)" },
  { id: "eddie-wu", cat: "dirigeants", n: "Eddie Wu", role: "PDG d'Alibaba", co: "Alibaba", actor: "alibaba", re: /\bEddie Wu\b/, q: "\"Eddie Wu\" Alibaba (AI OR cloud)" },
  { id: "mukesh-ambani", cat: "dirigeants", n: "Mukesh Ambani", role: "Président de Reliance Industries (Inde)", co: "Reliance", actor: null, re: /\bAmbani\b/, q: "\"Mukesh Ambani\" (AI OR Jio OR \"data center\")", topic: true },
  { id: "tahnoon-bin-zayed", cat: "investisseurs", n: "Tahnoon bin Zayed", role: "Président de MGX et de G42 (Émirats)", co: "G42", actor: "g42", re: /\bTahnoon\b/, q: "\"Tahnoon bin Zayed\" (AI OR G42 OR MGX)" },
  { id: "austan-goolsbee", w: 0.8, cat: "pouvoirs", n: "Austan Goolsbee", role: "Président de la Fed de Chicago", co: "", actor: null, re: /\bGoolsbee\b/, q: "\"Goolsbee\" (AI OR \"artificial intelligence\" OR productivity)" },
  { id: "michael-barr", w: 0.8, cat: "pouvoirs", n: "Michael Barr", role: "Gouverneur de la Réserve fédérale", co: "", actor: null, re: /\bMichael Barr\b/, q: "\"Michael Barr\" Fed (AI OR \"artificial intelligence\")" },
  { id: "christopher-waller", w: 0.8, cat: "pouvoirs", n: "Christopher Waller", role: "Gouverneur de la Réserve fédérale", co: "", actor: null, re: /\bWaller\b/, q: "\"Waller\" Fed (AI OR \"artificial intelligence\")" },
  { id: "mary-daly", w: 0.8, cat: "pouvoirs", n: "Mary Daly", role: "Présidente de la Fed de San Francisco", co: "", actor: null, re: /\bMary Daly\b/, q: "\"Mary Daly\" Fed (AI OR \"artificial intelligence\")" },
  { id: "tom-lee", cat: "investisseurs", n: "Tom Lee", role: "Cofondateur de Fundstrat Global Advisors", co: "", actor: null, re: /\bTom Lee\b/, q: "\"Tom Lee\" Fundstrat (AI OR Nvidia)" },
  { id: "mohamed-el-erian", cat: "investisseurs", n: "Mohamed El-Erian", role: "Économiste, conseiller d'Allianz", co: "", actor: null, re: /\bEl-Erian\b/, q: "\"El-Erian\" (AI OR bubble OR \"artificial intelligence\")" },
  { id: "dan-niles", cat: "investisseurs", n: "Dan Niles", role: "Fondateur de Niles Investment Management", co: "", actor: null, re: /\bDan Niles\b/, q: "\"Dan Niles\" (AI OR Nvidia)" },
  { id: "jeffrey-gundlach", cat: "investisseurs", n: "Jeffrey Gundlach", role: "PDG de DoubleLine Capital", co: "", actor: null, re: /\bGundlach\b/, q: "\"Gundlach\" (AI OR bubble OR Nvidia)" },
  { id: "aaron-levie", cat: "dirigeants", n: "Aaron Levie", role: "PDG de Box", co: "Box", actor: null, re: /\bLevie\b/, q: "\"Aaron Levie\" (AI OR Box)" },
  { id: "jamieson-greer", w: 0.8, cat: "pouvoirs", n: "Jamieson Greer", role: "Représentant américain au Commerce", co: "", actor: null, re: /\bJamieson Greer\b/, q: "\"Jamieson Greer\" (chips OR AI OR Nvidia OR semiconductors)" },
  { id: "bernie-sanders", w: 0.8, cat: "pouvoirs", n: "Bernie Sanders", role: "Sénateur indépendant du Vermont", co: "", actor: null, re: /\bBernie Sanders\b|\bSen\. Sanders\b/, q: "\"Bernie Sanders\" (AI OR \"artificial intelligence\")" },
];

// chaînes dont les vidéos portent le nom de l'invité ou du dirigeant (identifiants vérifiés sur le flux : auteur du flux = nom de la chaîne)
export const CHANNELS = [
  { id: "UCXZCJLdBC09xxGZ6gcdrc6A", name: "OpenAI (YouTube)" },
  { id: "UCrDwWp7EBBv4NwvScIpBDOA", name: "Anthropic (YouTube)" },
  { id: "UCP7jMXSY2xbc3KCAE0MHQ-A", name: "Google DeepMind (YouTube)" },
  { id: "UCXl4i9dYBrFOabk0xGmbkRA", name: "Dwarkesh Patel (YouTube)" },
  { id: "UCSHZKyawb77ixDdsGog4iWA", name: "Lex Fridman (YouTube)" },
];

const CUE = "says?|said|warns?|warned|predicts?|predicted|tells?|told|expects?|expected|believes?|claims?|argues?|admits?|reveals?|insists?|calls?|slams?|urges?|vows?|interview|keynote|speech|testif\\w+|podcast|speaks?|announces?|unveils?|responds?|defends?|rejects?|dismisses?|sees?|thinks?|hints?|teases?|criticizes?|pushes back|doubles down|reflects?|explains?|addresses?|opens up|confirms?|denies|dit|déclare|affirme|prévient|estime|annonce|juge|assure";
// Pour les investisseurs et analystes, une prise de position compte aussi : achat, vente, pari, relèvement ou abaissement d'objectif.
export const INVEST_CUE = "buys?|bought|sells?|sold|shorts?|shorted|bets?|dumps?|dumped|trims?|adds?|boosts?|raises?|cuts?|lowers?|upgrades?|downgrades?|initiates?|reiterates?|backs?|stakes?|invests?|exits?|loads?|doubles?|piles?";
// Pouvoirs publics et investisseurs parlent de tout : on ne garde que ce qui touche à l'IA, aux puces, aux datacenters et aux grandes sociétés de l'IA.
export const TOPIC = /\b(?:A\.?I\.?|artificial intelligence|chatbots?|Nvidia|OpenAI|Anthropic|Gemini|ChatGPT|Claude|xAI|Grok|chips?|semiconductors?|GPUs?|data ?cent(?:er|re)s?|Huang|Microsoft|Alphabet|Google|Meta|AMD|Broadcom|TSMC|Micron|Intel|Oracle|CoreWeave|Palantir|SoftBank|Samsung|SK hynix|ASML|hyperscalers?|robots?|robotics|singularity|AGI|LLMs?|compute|HBM|DRAM|Optimus|self-driving|FSD|Tencent|Alibaba|Baidu|DeepSeek|super ?intelligence|preempt\w*|export controls?|large loads?|AI Act|tech(?:nology)?)\b/i;
// Garde-fou de dernier recours, pour tout le monde : un titre qui parle de société, de guerre ou de faits divers sans rien d'IA est écarté.
export const OFFTOPIC = /\b(?:Taliban|Afghan\w*|women|girls|abortion|transgender|Gaza|Hamas|Ukraine|Putin|election|campaign|immigra\w*|deport\w*|racis\w*|murder|rape|shooting|assassinat\w*|Epstein|divorce|girlfriend|pregnan\w*|vaccine|religion|church|Pope|Israel|Iran|war)\b/i;
/** Le titre a-t-il sa place sur un site consacré à l'IA ? (utilisé à la collecte et pour purger les anciennes entrées) */
export function onTopic(p, title) {
  const ai = TOPIC.test(title);
  if ((p.cat === "pouvoirs" || p.cat === "investisseurs" || p.topic) && !ai) return false;
  return ai || !OFFTOPIC.test(title);
}
const cueRe = new RegExp(`\\b(?:${CUE})\\b`, "i");

/** La personne est-elle celle qui parle dans ce titre ? */
export function isStatement(title, re, extra = "") {
  const CUEX = extra ? `${CUE}|${extra}` : CUE;
  const t = String(title).replace(/\s+/g, " ").trim();
  const m = re.exec(t);
  if (!m) return false;
  // « Meta AI predicts… », « Grok says… » : c'est un chatbot qui parle, pas la personne
  if (/\b(?:Meta AI|ChatGPT|Grok|Gemini|Claude|Copilot|Siri|AI (?:predicts|says|thinks))\b/i.test(t.slice(m.index + m[0].length).split(/[:,|]/)[0])) return false;
  const before = t.slice(0, m.index), after = t.slice(m.index + m[0].length);
  // « X says … » : le verbe suit le nom (au plus six mots entre les deux : titre, sociétés, etc.)
  const cueAfter = new RegExp(`^((?:[\\w.'’-]+\\W+){0,6}?)(?:${CUEX})\\b`, "i").exec(after.replace(/^['’]s\b/, "").trim());
  if (cueAfter && /(?:^|\s)(?:to|will|would|not|never|could)\s*$/i.test(cueAfter[1])) return false;
  if (cueAfter && /,\s+[A-Z][\w.'’-]*\s+(?:[A-Z][\w.'’-]*\s+)*$/.test(cueAfter[1])) return false; // « Hire Tim Cook to lead Nvidia, Trump says » : c'est Trump qui parle
  if (/^['’]s\s+(?:longtime\s+|former\s+|ex-)?(?:partner|colleague|friend|rival|lawyer|critic|cofounder|co-founder|wife|husband|son|daughter|brother|sister|aide|advis[eo]r|successor|replacement|ally|allies)\b/i.test(after.trim())) return false; // « Peter Thiel’s partner Jack Selby warns » : l'associé parle, pas lui
  if (cueAfter && /\b(?:he|she|they|who|which)\b/i.test(cueAfter[1])) return false; // nouveau sujet : « Bessent blames Lutnick’s Commerce as he slams… »
  if (new RegExp(`^(?:[\\w.'’-]+\\W+){0,6}?(?:${CUEX})\\b`, "i").test(after.replace(/^['’]s\b/, "").trim()) && !/^\s*(?:,|’s|'s)?\s*(?:lawyers?|critics?|rivals?)\b/i.test(after)) {
    // le nom ne doit pas être complément d'un autre sujet qui parle (« Trump says Altman… », « Analysts say Huang… »)
    if (!new RegExp(`\\b(?:${CUEX})\\s+(?:that\\s+)?(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  }
  // « …, says X » / « — X says » / « | X : »
  if (new RegExp(`[,–—|:-]\\s*(?:${CUEX})\\s+(?:[\\w.'’-]+\\W+){0,4}$`, "i").test(before)) return true;
  // « Musk : "…" » : le nom ouvre le titre, suivi de deux-points puis d'une citation
  if (/^\s*:\s*['"‘“]/.test(after) && before.trim().length < 12) return true;
  return false;
}

const CHANGE = /\b(?:resign\w*|steps? down|stepping down|ousted|fired|replaced|appointed|names? (?:new |a new )?(?:ceo|chief|chair)|succeed\w*|retir\w*|quits?|departure|leaves|exits?)\b/i;
export const ROLES_AS_OF = "2026-11-18";
const DAY = 864e5;
async function withRetry(fn, sleep) { try { return await fn(); } catch (e) { if (!/429|5\d\d|abort|timeout/i.test(String(e.message || e))) throw e; await sleep(5000); return fn(); } }
const canon = (u) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^utm_|^oc$|^hl$|^gl$|^ceid$/.test(k)) x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return String(u); } };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * collectVoix({ http, parseFeed, now, prev, log }) → { doc, summary }
 * `http(url)` renvoie le texte ; une personne ou une chaîne en échec n'arrête pas les autres.
 */
export async function collectVoix({ http, parseFeed, now, prev, log = () => {}, pause = 1000, sleep = (t) => new Promise((r) => setTimeout(r, t)) }) {
  const cutoff = now - VOIX_RULES.days * DAY;
  const byPerson = new Map(PEOPLE.map((p) => [p.id, new Map()]));
  for (const p of prev?.people || []) if (byPerson.has(p.id)) for (const it of p.items || []) byPerson.get(p.id).set(canon(it.url), it);
  const alerts = new Map(PEOPLE.map((p) => [p.id, new Map()]));
  for (const p of prev?.people || []) if (alerts.has(p.id)) for (const a of p.alerts || []) alerts.get(p.id).set(canon(a.url), a);
  let added = 0, failed = 0;
  const add = (p, it) => {
    markCut(it);
    const m = byPerson.get(p.id), k = canon(it.url);
    const dup = [...m.values()].some((x) => norm(x.title) === norm(it.title));
    if (m.has(k) || dup) return;
    m.set(k, it); added++;
  };
  for (const p of PEOPLE) {
    try {
      const q = p.q || `"${p.n}"`;
      const xml = await withRetry(() => http(`https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:14d")}&hl=en-US&gl=US&ceid=${encodeURIComponent("US:en")}`), sleep);
      for (const x of parseFeed(xml).slice(0, VOIX_RULES.perQuery)) {
        const ts = Date.parse(x.date); if (!(ts >= cutoff) || ts > now + DAY) continue;
        // Google ajoute « - Média » en fin de titre : on retire exactement le nom du média annoncé, sinon le dernier segment
        const sfx = x.source && x.title.endsWith(" - " + x.source) ? " - " + x.source : null;
        const title = (sfx ? x.title.slice(0, -sfx.length) : x.title.replace(/\s+-\s+[^-]{2,40}$/, "")).trim();
        // alerte de poste : un titre récent annonce peut-être un changement (démission, nomination…) pour cette personne
        if (p.watch !== false && ts > Date.parse(ROLES_AS_OF + "T23:59:59Z") && p.re.test(title) && CHANGE.test(title)) alerts.get(p.id).set(canon(x.link), markCut({ ts: new Date(ts).toISOString(), title, url: x.link, source: x.source || "Presse" }));
        if (!onTopic(p, title)) continue;
        if (!isStatement(title, p.re, p.cat === "investisseurs" ? INVEST_CUE : "")) continue;
        add(p, { ts: new Date(ts).toISOString(), title, url: x.link, source: String(x.source || "").split(/\s[-–|]\s/)[0] || (x.title.match(/\s-\s([^-]{2,40})$/) || [])[1] || "Presse", kind: "presse" });
      }
    } catch (e) { failed++; log(`Voix ${p.n} : ${String(e.message || e).slice(0, 80)}`); }
    await sleep(pause);
  }
  for (const c of CHANNELS) {
    try {
      const xml = await http(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`);
      for (const x of parseFeed(xml).slice(0, 15)) {
        const ts = Date.parse(x.date); if (!(ts >= cutoff) || ts > now + DAY) continue;
        for (const p of PEOPLE) if (p.re.test(x.title) && onTopic(p, x.title)) add(p, { ts: new Date(ts).toISOString(), title: x.title, url: x.link, source: c.name, kind: "video" });
      }
    } catch (e) { failed++; log(`Voix ${c.name} : ${String(e.message || e).slice(0, 80)}`); }
  }
  const people = PEOPLE.map((p) => ({
    id: p.id, cat: p.cat, w: p.w ?? 1, n: p.n, role: p.role, co: p.co, actor: p.actor,
    alerts: [...alerts.get(p.id).values()].filter((a) => Date.parse(a.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 2),
    items: [...byPerson.get(p.id).values()].filter((it) => Date.parse(it.ts) >= cutoff && onTopic(p, it.title)).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, VOIX_RULES.perPerson),
  }));
  for (const p of people) { p.items.forEach(markCut); p.alerts.forEach(markCut); } // anciens éléments déjà enregistrés tronqués
  const total = people.reduce((s, p) => s + p.items.length, 0);
  return { doc: { v: 1, generated_at: new Date(now).toISOString(), people }, summary: { added, failed, total, reason: failed >= PEOPLE.length + CHANNELS.length ? "toutes les sources en échec" : "" } };
}

export const VOIX_SYSTEM = `Tu traduis en français des titres d'articles de presse et de vidéos sur l'intelligence artificielle. Pour chaque titre (i, en), renvoie fr = la traduction française fidèle, naturelle, au même niveau d'affirmation (« says » reste une déclaration, « warns » un avertissement, pas plus fort ni plus faible).
Règles : conserve exactement les chiffres, noms propres, sociétés, sigles et produits ; ne rajoute aucune information ; garde les guillemets s'il y en a. ${UNITS_RULE} Réponds uniquement par un tableau JSON, un objet par titre, avec le même champ i.`;
export const VOIX_SCHEMA = { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, fr: { type: "STRING" } }, required: ["i", "fr"] } };

const digits = (s) => String(s).match(/\d+/g) || [];
/** Ajoute `title_fr` aux titres qui n'en ont pas ; refusé si les chiffres changent. `generate(inputs)` appelle le modèle (ou renvoie null). */
export async function translateVoix({ doc, generate, max = 140 }) {
  if (!generate) return { changed: 0, reason: "Gemini indisponible" };
  const todo = doc.people.flatMap((p) => p.items).filter((it) => !it.title_fr).slice(0, max);
  if (!todo.length) return { changed: 0, reason: "rien à traduire" };
  let res = null;
  try { res = await generate(todo.map((it, i) => ({ i, en: it.title }))); } catch { res = null; }
  if (!Array.isArray(res)) return { changed: 0, reason: "Gemini indisponible" };
  let n = 0;
  for (const r of res) {
    const it = todo[Number(r?.i)], fr = String(r?.fr || "").trim().replace(/\s+/g, " ");
    if (!it || !fr || fr.length > it.title.length * 2 + 40) continue;
    const fixed = normalizeFr(it.title, fr);
    const a = digits(stripAmounts(it.title)), b = digits(stripAmounts(fixed));
    if (a.length !== b.length || !a.every((x, k) => x === b[k]) || !unitsOk(it.title, fixed, "fr", true)) continue;
    it.title_fr = withCutMark(it, fixed); n++;
  }
  return { changed: n, reason: n ? `${n} titre(s) traduit(s)` : "aucune traduction valide" };
}

/* ---------- Déclarations brûlantes du jour (Une) : classement mécanique, sans IA ---------- */
export const HOT_RULES = { hours: 48, half: 9, top: 3, weight: { dirigeants: 1, pouvoirs: 1, cadres: 0.8, chercheurs: 0.8, investisseurs: 0.7 }, strong: 1.3, sim: 0.4 };
export const STRONG = /\b(?:warns?|warned|resign\w*|slams?|admits?|predicts?|reveals?|vows?|rejects?|denies|demands?|urges?|calls? for|shorts?|sells?|sold|downgrades?|insists?|blasts?|accuses?)\b/i;
const STOP = new Set("the a an of to in on for and or at by with as is are was be it its this that from after says said say will would about over into than not has have had who his her their".split(" "));
export const toks = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
export const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i ? i / (a.size + b.size - i) : 0; };

/**
 * Annote chaque déclaration : `m` = nombre de médias distincts qui reprennent le même propos de la même personne,
 * `e` = 1 si elle est « essentielle » (reprise par au moins 2 médias, ou verbe fort d'une personne d'influence majeure).
 */
export function annotateVoix(doc) {
  const R = HOT_RULES;
  for (const p of doc.people) {
    const T = p.items.map((it) => toks(it.title));
    const w = p.w ?? 1;
    p.items.forEach((it, i) => {
      const media = new Set([String(it.source || "").toLowerCase()]);
      p.items.forEach((o, k) => { if (k !== i && jac(T[i], T[k]) >= R.sim) media.add(String(o.source || "").toLowerCase()); });
      it.m = media.size;
      it.e = it.m >= 2 || (w >= R.strong && STRONG.test(it.title)) ? 1 : 0;
    });
  }
  return doc;
}

/**
 * Calcule `doc.hot` : au plus HOT_RULES.top déclarations, une par personne, des dernières 48 h.
 * Score = fraîcheur × (1 + log2(médias qui reprennent le propos)) × poids de la catégorie × verbe fort.
 */
export function hotVoix(doc, now) {
  const R = HOT_RULES, all = doc.people.flatMap((p) => p.items.map((it) => ({ p, it, t: toks(it.title) })));
  const best = new Map();
  for (const x of all) {
    const age = (now - Date.parse(x.it.ts)) / 36e5;
    if (!(age >= 0) || age > R.hours) continue;
    const media = new Set(all.filter((y) => y.p.id === x.p.id && Math.abs(Date.parse(y.it.ts) - Date.parse(x.it.ts)) <= R.hours * 36e5 && jac(x.t, y.t) >= R.sim).map((y) => String(y.it.source).toLowerCase()));
    const rec = Math.pow(0.5, age / HOT_RULES.half); // fraîcheur : le poids est divisé par 2 toutes les `half` heures
    const score = rec * (1 + Math.log2(Math.max(1, media.size))) * (R.weight[x.p.cat] || 0.7) * (x.p.w ?? 1) * (STRONG.test(x.it.title) ? R.strong : 1);
    const cur = best.get(x.p.id);
    if (!cur || score > cur.score) best.set(x.p.id, { score: +score.toFixed(2), id: x.p.id, n: x.p.n, role: x.p.role, actor: x.p.actor, ts: x.it.ts, title: x.it.title, title_fr: x.it.title_fr || "", url: x.it.url, source: x.it.source, kind: x.it.kind, outlets: media.size });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.ts.localeCompare(a.ts)).slice(0, R.top);
}
