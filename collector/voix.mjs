// Voix : ce que disent les dirigeants de l'IA. Presse (Google Actualités) et vidéos (chaînes YouTube vérifiées).
// Règle : un titre n'est retenu que si la personne en est le sujet qui parle (« X says… », « …, says X », citation) ou si la vidéo porte son nom.
// Rien n'est inventé ni résumé : titre du média, date, média, lien.
export const VOIX_RULES = { days: 30, perPerson: 8, perQuery: 30 };

// w : influence (1,6 = voix majeure, 0,6 = élu ou conseiller de second plan) ; sert au classement des déclarations de la Une.
// cat : dirigeants (PDG, y compris chaîne de l'IA) · cadres (CFO, CTO, président, conseil) · chercheurs · pouvoirs publics · investisseurs et analystes.
// Les intitulés sont écrits à la main (vérifiés le 18 nov. 2026) ; `watch: false` coupe l'alerte de changement de poste quand l'intitulé vient d'être mis à jour.
export const PEOPLE = [
  { id: "sam-altman", w: 1.6, cat: "dirigeants", n: "Sam Altman", role: "PDG d'OpenAI", co: "OpenAI", actor: "openai", re: /\bAltman\b/ },
  { id: "dario-amodei", w: 1.6, cat: "dirigeants", n: "Dario Amodei", role: "PDG d'Anthropic", co: "Anthropic", actor: null, re: /(?<!Daniela )\bAmodei\b/ },
  { id: "jensen-huang", w: 1.6, cat: "dirigeants", n: "Jensen Huang", role: "Fondateur de Nvidia, ancien PDG (démission le 12 nov. 2026)", co: "Nvidia", actor: "nvidia", re: /\bJensen\b|\bHuang\b/, watch: false },
  { id: "elon-musk", w: 1.6, cat: "dirigeants", n: "Elon Musk", role: "PDG de Tesla et de SpaceX (qui a absorbé xAI)", co: "SpaceX / xAI", actor: null, re: /\bMusk\b/, q: '"Elon Musk" (xAI OR Grok OR "AI" OR OpenAI OR Nvidia)' },
  { id: "satya-nadella", w: 1.6, cat: "dirigeants", n: "Satya Nadella", role: "PDG de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bNadella\b/ },
  { id: "sundar-pichai", w: 1.6, cat: "dirigeants", n: "Sundar Pichai", role: "PDG d'Alphabet (Google)", co: "Alphabet", actor: "alphabet", re: /\bPichai\b/ },
  { id: "demis-hassabis", w: 1.6, cat: "dirigeants", n: "Demis Hassabis", role: "PDG de Google DeepMind", co: "Google DeepMind", actor: "alphabet", re: /\bHassabis\b/ },
  { id: "mark-zuckerberg", w: 1.6, cat: "dirigeants", n: "Mark Zuckerberg", role: "PDG de Meta", co: "Meta", actor: "meta", re: /\bZuckerberg\b/ },
  { id: "lisa-su", w: 1.6, cat: "dirigeants", n: "Lisa Su", role: "PDG d'AMD", co: "AMD", actor: "amd", re: /\bLisa Su\b/ },
  { id: "hock-tan", w: 1.6, cat: "dirigeants", n: "Hock Tan", role: "PDG de Broadcom", co: "Broadcom", actor: "broadcom", re: /\bHock Tan\b/ },
  { id: "cc-wei", w: 1.6, cat: "dirigeants", n: "C.C. Wei", role: "PDG de TSMC", co: "TSMC", actor: "tsmc", re: /\bC\.?\s?C\.? Wei\b/, q: '"C.C. Wei" TSMC' },
  { id: "andy-jassy", w: 1.6, cat: "dirigeants", n: "Andy Jassy", role: "PDG d'Amazon", co: "Amazon", actor: "amazon", re: /\bJassy\b/ },
  { id: "mustafa-suleyman", cat: "dirigeants", n: "Mustafa Suleyman", role: "Directeur de Microsoft AI", co: "Microsoft", actor: "microsoft", re: /\bSuleyman\b/ },
  { id: "lip-bu-tan", w: 1.6, cat: "dirigeants", n: "Lip-Bu Tan", role: "PDG d'Intel", co: "Intel", actor: "intel-foundry", re: /\bLip-Bu Tan\b/ },
  { id: "clay-magouyrk", cat: "dirigeants", n: "Clay Magouyrk", role: "Co-PDG d'Oracle", co: "Oracle", actor: null, re: /\bMagouyrk\b/ },
  { id: "sanjay-mehrotra", cat: "dirigeants", n: "Sanjay Mehrotra", role: "PDG de Micron", co: "Micron", actor: "micron", re: /\bMehrotra\b/ },
  { id: "christophe-fouquet", cat: "dirigeants", n: "Christophe Fouquet", role: "PDG d'ASML", co: "ASML", actor: "asml", re: /\bFouquet\b/ },
  { id: "kwak-noh-jung", cat: "dirigeants", n: "Kwak Noh-jung", role: "PDG de SK hynix", co: "SK hynix", actor: "sk-hynix", re: /\bKwak Noh[- ]?jung\b/ },
  { id: "michael-intrator", cat: "dirigeants", n: "Michael Intrator", role: "PDG de CoreWeave", co: "CoreWeave", actor: null, re: /\bIntrator\b/ },
  { id: "alex-karp", cat: "dirigeants", n: "Alex Karp", role: "PDG de Palantir", co: "Palantir", actor: null, re: /\bKarp\b/ },
  { id: "robin-li", cat: "dirigeants", n: "Robin Li", role: "PDG de Baidu", co: "Baidu", actor: null, re: /\bRobin Li\b/, q: '"Robin Li" Baidu' },
  { id: "larry-ellison", cat: "cadres", n: "Larry Ellison", role: "Président et directeur technique d'Oracle", co: "Oracle", actor: null, re: /\bEllison\b/, q: '"Larry Ellison" (Oracle OR AI OR OpenAI OR Stargate)' },
  { id: "colette-kress", cat: "cadres", n: "Colette Kress", role: "Directrice financière et PDG par intérim de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bKress\b/ },
  { id: "harvey-jones", cat: "cadres", n: "Harvey C. Jones", role: "Président du conseil de Nvidia", co: "Nvidia", actor: "nvidia", re: /\bHarvey (?:C\. )?Jones\b/, q: '"Harvey Jones" Nvidia' },
  { id: "greg-brockman", cat: "cadres", n: "Greg Brockman", role: "Cofondateur et président d'OpenAI", co: "OpenAI", actor: "openai", re: /\bBrockman\b/ },
  { id: "sarah-friar", cat: "cadres", n: "Sarah Friar", role: "Directrice financière d'OpenAI", co: "OpenAI", actor: "openai", re: /\bSarah Friar\b/ },
  { id: "kevin-scott", cat: "cadres", n: "Kevin Scott", role: "Directeur technique de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bKevin Scott\b/, q: '"Kevin Scott" Microsoft' },
  { id: "brad-smith", cat: "cadres", n: "Brad Smith", role: "Vice-président et président de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bBrad Smith\b/, q: '"Brad Smith" Microsoft' },
  { id: "ruth-porat", cat: "cadres", n: "Ruth Porat", role: "Présidente et directrice des investissements d'Alphabet", co: "Alphabet", actor: "alphabet", re: /\bPorat\b/ },
  { id: "geoffrey-hinton", cat: "chercheurs", n: "Geoffrey Hinton", role: "Prix Nobel, pionnier de l'apprentissage profond", co: "", actor: null, re: /\bHinton\b/ },
  { id: "yoshua-bengio", cat: "chercheurs", n: "Yoshua Bengio", role: "Chercheur, pionnier de l'apprentissage profond", co: "", actor: null, re: /\bBengio\b/ },
  { id: "yann-lecun", cat: "chercheurs", n: "Yann LeCun", role: "Président exécutif d'AMI Labs, ancien de Meta", co: "AMI Labs", actor: null, re: /\bLeCun\b/ },
  { id: "ilya-sutskever", cat: "chercheurs", n: "Ilya Sutskever", role: "Cofondateur de Safe Superintelligence, ancien d'OpenAI", co: "SSI", actor: null, re: /\bSutskever\b/ },
  { id: "andrej-karpathy", cat: "chercheurs", n: "Andrej Karpathy", role: "Chercheur, ancien d'OpenAI et de Tesla", co: "", actor: null, re: /\bKarpathy\b/ },
  { id: "fei-fei-li", cat: "chercheurs", n: "Fei-Fei Li", role: "Chercheuse, cofondatrice de World Labs", co: "World Labs", actor: null, re: /\bFei-Fei Li\b/ },
  { id: "mira-murati", cat: "chercheurs", n: "Mira Murati", role: "Fondatrice de Thinking Machines Lab, ancienne CTO d'OpenAI", co: "Thinking Machines Lab", actor: null, re: /\bMurati\b/ },
  { id: "arthur-mensch", cat: "chercheurs", n: "Arthur Mensch", role: "PDG de Mistral AI", co: "Mistral AI", actor: null, re: /\bMensch\b/ },
  { id: "donald-trump", w: 1.6, cat: "pouvoirs", n: "Donald Trump", role: "Président des États-Unis", co: "", actor: null, re: /\bTrump\b/, q: '"Trump" (AI OR "artificial intelligence" OR Nvidia OR chips OR "data centers")' },
  { id: "david-sacks", cat: "pouvoirs", n: "David Sacks", role: "Coprésident du PCAST, ancien conseiller IA et crypto de la Maison-Blanche", co: "", actor: null, re: /\bDavid Sacks\b/, q: '"David Sacks" AI' },
  { id: "howard-lutnick", cat: "pouvoirs", n: "Howard Lutnick", role: "Secrétaire américain au Commerce", co: "", actor: null, re: /\bLutnick\b/, q: '"Lutnick" (chips OR AI OR Nvidia OR export OR semiconductor)' },
  { id: "henna-virkkunen", cat: "pouvoirs", n: "Henna Virkkunen", role: "Vice-présidente exécutive de la Commission européenne (souveraineté technologique)", co: "", actor: null, re: /\bVirkkunen\b/ },
  { id: "scott-bessent", w: 1.6, cat: "pouvoirs", n: "Scott Bessent", role: "Secrétaire américain au Trésor", co: "", actor: null, re: /\bBessent\b/, q: '"Bessent" (AI OR Nvidia OR chips OR semiconductor OR tariffs)' },
  { id: "michael-kratsios", w: 0.6, cat: "pouvoirs", n: "Michael Kratsios", role: "Directeur du bureau de la science et de la technologie de la Maison-Blanche (OSTP)", co: "", actor: null, re: /\bKratsios\b/ },
  { id: "ted-cruz", w: 0.6, cat: "pouvoirs", n: "Ted Cruz", role: "Sénateur républicain, président de la commission Commerce du Sénat", co: "", actor: null, re: /\bTed Cruz\b|\b(?:Sen\.|Senator) Cruz\b/, q: '"Ted Cruz" (AI OR "artificial intelligence" OR chatbot OR Nvidia)' },
  { id: "maria-cantwell", w: 0.6, cat: "pouvoirs", n: "Maria Cantwell", role: "Sénatrice démocrate, première démocrate de la commission Commerce", co: "", actor: null, re: /\bCantwell\b/, q: '"Maria Cantwell" AI' },
  { id: "mark-warner", w: 0.6, cat: "pouvoirs", n: "Mark Warner", role: "Sénateur démocrate de Virginie", co: "", actor: null, re: /\bMark Warner\b|\b(?:Sen\.|Senator) Warner\b/, q: '"Mark Warner" (AI OR "artificial intelligence" OR chips)' },
  { id: "josh-hawley", w: 0.6, cat: "pouvoirs", n: "Josh Hawley", role: "Sénateur républicain du Missouri", co: "", actor: null, re: /\bHawley\b/, q: '"Josh Hawley" (AI OR "artificial intelligence" OR chatbot)' },
  { id: "elizabeth-warren", w: 0.6, cat: "pouvoirs", n: "Elizabeth Warren", role: "Sénatrice démocrate, première démocrate de la commission Banques", co: "", actor: null, re: /\bElizabeth Warren\b|\b(?:Sen\.|Senator) Warren\b/, q: '"Elizabeth Warren" (Nvidia OR AI OR chips OR "data centers")' },
  { id: "jay-obernolte", w: 0.6, cat: "pouvoirs", n: "Jay Obernolte", role: "Représentant républicain de Californie, président de la sous-commission Recherche et Technologie", co: "", actor: null, re: /\bObernolte\b/ },
  { id: "john-moolenaar", w: 0.6, cat: "pouvoirs", n: "John Moolenaar", role: "Représentant républicain du Michigan, commission spéciale sur la Chine", co: "", actor: null, re: /\bMoolenaar\b/, q: '"Moolenaar" (chips OR AI OR Nvidia OR China OR export)' },
  { id: "bill-ackman", cat: "investisseurs", n: "Bill Ackman", role: "Fondateur et PDG de Pershing Square", co: "", actor: null, re: /\bAckman\b/ },
  { id: "michael-burry", cat: "investisseurs", n: "Michael Burry", role: "Investisseur (« The Big Short »), auteur de la newsletter Cassandra Unchained", co: "", actor: null, re: /\bBurry\b/ },
  { id: "dan-ives", cat: "investisseurs", n: "Dan Ives", role: "Analyste technologie (Wedbush Securities)", co: "", actor: null, re: /\bDan Ives\b/, q: '"Dan Ives"' },
  { id: "stacy-rasgon", cat: "investisseurs", n: "Stacy Rasgon", role: "Analyste semi-conducteurs (Bernstein)", co: "", actor: null, re: /\bRasgon\b/ },
  { id: "gil-luria", cat: "investisseurs", n: "Gil Luria", role: "Analyste (D.A. Davidson)", co: "", actor: null, re: /\bLuria\b/, q: '"Gil Luria"' },
  { id: "ming-chi-kuo", cat: "investisseurs", n: "Ming-Chi Kuo", role: "Analyste de la chaîne d'approvisionnement technologique (TF International Securities)", co: "", actor: null, re: /\bKuo\b/, q: '"Ming-Chi Kuo"' },
  { id: "cathie-wood", cat: "investisseurs", n: "Cathie Wood", role: "Fondatrice d'ARK Invest", co: "", actor: null, re: /\bCathie Wood\b/ },
  { id: "masayoshi-son", cat: "investisseurs", n: "Masayoshi Son", role: "Fondateur et PDG de SoftBank", co: "", actor: null, re: /\bMasayoshi Son\b/ },
  { id: "marc-andreessen", cat: "investisseurs", n: "Marc Andreessen", role: "Cofondateur du fonds Andreessen Horowitz", co: "", actor: null, re: /\bAndreessen\b/ },
  { id: "stanley-druckenmiller", cat: "investisseurs", n: "Stanley Druckenmiller", role: "Investisseur (Duquesne Family Office)", co: "", actor: null, re: /\bDruckenmiller\b/ },
  { id: "ray-dalio", cat: "investisseurs", n: "Ray Dalio", role: "Fondateur de Bridgewater Associates", co: "", actor: null, re: /\bDalio\b/, q: '"Ray Dalio" (AI OR bubble OR Nvidia OR market)' },
  { id: "jim-chanos", cat: "investisseurs", n: "Jim Chanos", role: "Investisseur vendeur à découvert (Kynikos)", co: "", actor: null, re: /\bChanos\b/, q: '"Jim Chanos" (AI OR Nvidia OR "data center" OR bubble)' },
  // --- Ajouts : dirigeants et figures d'entreprise ---
  { id: "john-ternus", cat: "dirigeants", n: "John Ternus", role: "PDG d'Apple (depuis le 1er sept. 2026)", co: "Apple", actor: null, re: /\bTernus\b/, q: '"John Ternus" (AI OR Apple OR Siri OR chips)' },
  { id: "tim-cook", cat: "cadres", n: "Tim Cook", role: "Président exécutif du conseil d'Apple, ancien PDG (jusqu'au 31 août 2026)", co: "Apple", actor: null, re: /\bTim Cook\b/, q: '"Tim Cook" (AI OR "Apple Intelligence" OR Siri OR chips OR tariffs)', topic: true },
  { id: "jeff-bezos", cat: "dirigeants", n: "Jeff Bezos", role: "Fondateur d'Amazon, co-PDG de Project Prometheus", co: "Project Prometheus", actor: "amazon", re: /\bBezos\b/, q: '"Jeff Bezos" (AI OR Prometheus OR Amazon OR "Blue Origin")', topic: true },
  { id: "michael-dell", cat: "dirigeants", n: "Michael Dell", role: "Fondateur et PDG de Dell Technologies", co: "Dell", actor: null, re: /\bMichael Dell\b/, q: '"Michael Dell" (AI OR Nvidia OR servers OR "data center")', topic: true },
  { id: "liang-wenfeng", cat: "dirigeants", n: "Liang Wenfeng", role: "Fondateur de DeepSeek", co: "DeepSeek", actor: null, re: /\bLiang Wenfeng\b/ },
  { id: "aravind-srinivas", cat: "dirigeants", n: "Aravind Srinivas", role: "PDG de Perplexity", co: "Perplexity", actor: null, re: /\bSrinivas\b/, q: '"Aravind Srinivas" Perplexity' },
  { id: "aidan-gomez", cat: "dirigeants", n: "Aidan Gomez", role: "PDG de Cohere", co: "Cohere", actor: null, re: /\bAidan Gomez\b/ },
  { id: "tareq-amin", cat: "dirigeants", n: "Tareq Amin", role: "PDG de Humain (Arabie saoudite)", co: "Humain", actor: "humain", re: /\bTareq Amin\b/ },
  { id: "gwynne-shotwell", cat: "dirigeants", n: "Gwynne Shotwell", role: "Présidente de SpaceX", co: "SpaceX", actor: null, re: /\bShotwell\b/, q: '"Gwynne Shotwell" (SpaceX OR xAI OR AI OR Starlink)', topic: true },
  { id: "sergey-brin", cat: "cadres", n: "Sergey Brin", role: "Cofondateur de Google", co: "Alphabet", actor: "alphabet", re: /\bSergey Brin\b/, q: '"Sergey Brin" (AI OR Gemini OR Google)', topic: true },
  { id: "eric-schmidt", cat: "cadres", n: "Eric Schmidt", role: "Ancien PDG de Google, investisseur et conseiller en IA", co: "", actor: null, re: /\bEric Schmidt\b/, q: '"Eric Schmidt" (AI OR "artificial intelligence" OR China OR chips)', topic: true },
  { id: "bill-gates", cat: "cadres", n: "Bill Gates", role: "Cofondateur de Microsoft", co: "Microsoft", actor: "microsoft", re: /\bBill Gates\b/, q: '"Bill Gates" (AI OR "artificial intelligence")', topic: true },
  { id: "pat-gelsinger", cat: "cadres", n: "Pat Gelsinger", role: "Ancien PDG d'Intel, président exécutif de Gloo", co: "Gloo", actor: null, re: /\bGelsinger\b/, q: '"Pat Gelsinger" (AI OR Intel OR Nvidia OR chips)', topic: true },
  { id: "jeff-dean", cat: "cadres", n: "Jeff Dean", role: "Directeur scientifique de Google (Google DeepMind et Google Research)", co: "Google DeepMind", actor: "alphabet", re: /\bJeff Dean\b/, q: '"Jeff Dean" (Google OR Gemini OR AI)' },
  { id: "alexandr-wang", cat: "cadres", n: "Alexandr Wang", role: "Directeur de l'IA de Meta (Meta Superintelligence Labs), cofondateur de Scale AI", co: "Meta", actor: "meta", re: /\bAlexandr Wang\b|\bAlex Wang\b/, q: '"Alexandr Wang" (Meta OR "Scale AI" OR superintelligence)' },
  // --- Ajouts : OpenAI, Anthropic et leurs cofondateurs ---
  { id: "mark-chen", cat: "cadres", n: "Mark Chen", role: "Directeur de la recherche d'OpenAI", co: "OpenAI", actor: "openai", re: /\bMark Chen\b/, q: '"Mark Chen" OpenAI' },
  { id: "jakub-pachocki", cat: "chercheurs", n: "Jakub Pachocki", role: "Scientifique en chef d'OpenAI", co: "OpenAI", actor: "openai", re: /\bPachocki\b/ },
  { id: "brad-lightcap", cat: "cadres", n: "Brad Lightcap", role: "Ancien directeur des opérations d'OpenAI, parti fonder une société (août 2026)", co: "", actor: null, re: /\bLightcap\b/ },
  { id: "daniela-amodei", cat: "cadres", n: "Daniela Amodei", role: "Cofondatrice et présidente d'Anthropic", co: "Anthropic", actor: null, re: /\bDaniela Amodei\b/ },
  { id: "jack-clark", cat: "cadres", n: "Jack Clark", role: "Cofondateur d'Anthropic, responsable de l'intérêt public (Anthropic Institute)", co: "Anthropic", actor: null, re: /\bJack Clark\b/, q: '"Jack Clark" Anthropic' },
  { id: "jared-kaplan", cat: "chercheurs", n: "Jared Kaplan", role: "Cofondateur et directeur scientifique d'Anthropic", co: "Anthropic", actor: null, re: /\bJared Kaplan\b/, q: '"Jared Kaplan" Anthropic' },
  { id: "krishna-rao", cat: "cadres", n: "Krishna Rao", role: "Directeur financier d'Anthropic", co: "Anthropic", actor: null, re: /\bKrishna Rao\b/, q: '"Krishna Rao" Anthropic' },
  { id: "mike-krieger", cat: "cadres", n: "Mike Krieger", role: "Cofondateur d'Instagram, codirige Anthropic Labs", co: "Anthropic", actor: null, re: /\bMike Krieger\b/, q: '"Mike Krieger" Anthropic' },
  { id: "jan-leike", cat: "chercheurs", n: "Jan Leike", role: "Chercheur en alignement chez Anthropic, ancien d'OpenAI", co: "Anthropic", actor: null, re: /\bJan Leike\b/ },
  // --- Ajouts : cofondateurs de labos (dont partis) ---
  { id: "john-schulman", cat: "chercheurs", n: "John Schulman", role: "Cofondateur d'OpenAI, directeur scientifique de Thinking Machines Lab", co: "Thinking Machines Lab", actor: null, re: /\bJohn Schulman\b/, q: '"John Schulman" (AI OR "Thinking Machines" OR OpenAI)' },
  { id: "igor-babuschkin", cat: "chercheurs", n: "Igor Babuschkin", role: "Cofondateur de xAI (parti en août 2025), fonde un fonds de capital-risque", co: "", actor: null, re: /\bBabuschkin\b|\bBabushkin\b/ },
  { id: "jimmy-ba", cat: "chercheurs", n: "Jimmy Ba", role: "Cofondateur de xAI (parti en février 2026), professeur à Toronto", co: "", actor: null, re: /\bJimmy Ba\b/, q: '"Jimmy Ba" (xAI OR AI)' },
  { id: "tony-wu", cat: "chercheurs", n: "Tony Wu", role: "Cofondateur de xAI (parti en février 2026)", co: "", actor: null, re: /\bTony Wu\b|\bYuhuai Wu\b/, q: '"Tony Wu" (xAI OR AI OR reasoning)' },
  { id: "guillaume-lample", cat: "chercheurs", n: "Guillaume Lample", role: "Cofondateur de Mistral AI", co: "Mistral AI", actor: null, re: /\bGuillaume Lample\b/ },
  { id: "noam-shazeer", cat: "chercheurs", n: "Noam Shazeer", role: "Chercheur chez Google (Gemini), cofondateur de Character.AI", co: "Google DeepMind", actor: "alphabet", re: /\bShazeer\b/ },
  { id: "emad-mostaque", cat: "chercheurs", n: "Emad Mostaque", role: "Fondateur de Stability AI, ancien PDG", co: "", actor: null, re: /\bMostaque\b/ },
  { id: "kai-fu-lee", cat: "chercheurs", n: "Kai-Fu Lee", role: "Fondateur de 01.AI, ancien président de Google Chine", co: "01.AI", actor: null, re: /\bKai-Fu Lee\b/ },
  // --- Ajouts : experts de l'IA ---
  { id: "andrew-ng", cat: "chercheurs", n: "Andrew Ng", role: "Fondateur de DeepLearning.AI et de Landing AI, professeur à Stanford", co: "", actor: null, re: /\bAndrew Ng\b/, q: '"Andrew Ng" (AI OR agents OR "deep learning")' },
  { id: "stuart-russell", cat: "chercheurs", n: "Stuart Russell", role: "Professeur à Berkeley, spécialiste de la sécurité de l'IA", co: "", actor: null, re: /\bStuart Russell\b/, q: '"Stuart Russell" AI' },
  { id: "gary-marcus", cat: "chercheurs", n: "Gary Marcus", role: "Chercheur, critique de l'IA générative", co: "", actor: null, re: /\bGary Marcus\b/ },
  { id: "ethan-mollick", cat: "chercheurs", n: "Ethan Mollick", role: "Professeur à Wharton, spécialiste de l'usage de l'IA", co: "", actor: null, re: /\bEthan Mollick\b/ },
  { id: "max-tegmark", cat: "chercheurs", n: "Max Tegmark", role: "Physicien au MIT, cofondateur du Future of Life Institute", co: "", actor: null, re: /\bTegmark\b/, q: '"Max Tegmark" AI' },
  { id: "eliezer-yudkowsky", cat: "chercheurs", n: "Eliezer Yudkowsky", role: "Chercheur en sécurité de l'IA (MIRI)", co: "", actor: null, re: /\bYudkowsky\b/ },
  { id: "timnit-gebru", cat: "chercheurs", n: "Timnit Gebru", role: "Fondatrice du DAIR Institute, ancienne de Google", co: "", actor: null, re: /\bGebru\b/ },
  // --- Ajouts : pouvoirs publics ---
  { id: "sriram-krishnan", w: 0.8, cat: "pouvoirs", n: "Sriram Krishnan", role: "Ancien conseiller IA de la Maison-Blanche (parti fin juin 2026)", co: "", actor: null, re: /\bSriram Krishnan\b/, q: '"Sriram Krishnan" AI' },
  { id: "emmanuel-macron", cat: "pouvoirs", n: "Emmanuel Macron", role: "Président de la République française", co: "", actor: null, re: /\bMacron\b/, q: '"Macron" (AI OR "artificial intelligence" OR "intelligence artificielle" OR Mistral)' },
  { id: "ursula-von-der-leyen", w: 0.8, cat: "pouvoirs", n: "Ursula von der Leyen", role: "Présidente de la Commission européenne", co: "", actor: null, re: /\bvon der Leyen\b/, q: '"von der Leyen" (AI OR "artificial intelligence" OR "AI Act" OR gigafactories)' },
  // --- Ajouts : investisseurs et analystes ---
  { id: "yasir-al-rumayyan", cat: "investisseurs", n: "Yasir Al-Rumayyan", role: "Gouverneur du fonds souverain saoudien PIF", co: "PIF", actor: null, re: /\bAl-Rumayyan\b/, q: '"Al-Rumayyan" (AI OR Humain OR PIF)' },
  { id: "dylan-patel", cat: "investisseurs", n: "Dylan Patel", role: "Fondateur de SemiAnalysis", co: "SemiAnalysis", actor: null, re: /\bDylan Patel\b/, q: '"Dylan Patel" SemiAnalysis' },
  { id: "gavin-baker", cat: "investisseurs", n: "Gavin Baker", role: "Investisseur (Atreides Management)", co: "", actor: null, re: /\bGavin Baker\b/ },
  { id: "reid-hoffman", cat: "investisseurs", n: "Reid Hoffman", role: "Cofondateur de LinkedIn, investisseur (Greylock)", co: "", actor: null, re: /\bReid Hoffman\b/, q: '"Reid Hoffman" AI' },
  { id: "peter-thiel", cat: "investisseurs", n: "Peter Thiel", role: "Cofondateur de Palantir, investisseur", co: "", actor: null, re: /\bPeter Thiel\b/, q: '"Peter Thiel" (AI OR Palantir OR Nvidia OR bubble)' },
  { id: "vinod-khosla", cat: "investisseurs", n: "Vinod Khosla", role: "Fondateur de Khosla Ventures", co: "", actor: null, re: /\bVinod Khosla\b/, q: '"Vinod Khosla" AI' },
  { id: "chamath-palihapitiya", cat: "investisseurs", n: "Chamath Palihapitiya", role: "Fondateur de Social Capital", co: "", actor: null, re: /\bChamath\b/, q: '"Chamath Palihapitiya" (AI OR Nvidia OR OpenAI OR bubble)' },
  { id: "larry-fink", cat: "investisseurs", n: "Larry Fink", role: "PDG de BlackRock", co: "", actor: null, re: /\bLarry Fink\b/, q: '"Larry Fink" (AI OR infrastructure OR "data centers")' },
  // --- Ajouts : responsables américains (nov. 2026) — ceux qui décident (signent, votent, bloquent) ---
  { id: "jay-clayton", w: 1.3, cat: "pouvoirs", n: "Jay Clayton", role: "Directeur du renseignement national, chef de la « Super Intelligence Force » (tsar de l'IA depuis le 4 oct. 2026)", co: "", actor: null, re: /\bJay Clayton\b|\bDNI Clayton\b/, q: '"Jay Clayton" (AI OR "Super Intelligence" OR "artificial intelligence")' },
  { id: "jeffrey-kessler", cat: "pouvoirs", n: "Jeffrey Kessler", role: "Sous-secrétaire au Commerce pour l'industrie et la sécurité (BIS, contrôle des exportations de puces)", co: "", actor: null, re: /\bJeffrey Kessler\b|\bUnder Secretary Kessler\b/, q: '"Jeffrey Kessler" (BIS OR "export controls" OR chips OR Nvidia)' },
  { id: "chris-wright", cat: "pouvoirs", n: "Chris Wright", role: "Secrétaire américain à l'Énergie", co: "", actor: null, re: /\bChris Wright\b/, q: '"Chris Wright" (energy OR "data centers" OR AI OR grid)' },
  { id: "laura-swett", w: 0.8, cat: "pouvoirs", n: "Laura Swett", role: "Présidente de la FERC (régulateur fédéral de l'énergie)", co: "", actor: null, re: /\bSwett\b/, q: '"Laura Swett" FERC (data centers OR grid OR "large load")' },
  { id: "john-thune", w: 0.8, cat: "pouvoirs", n: "John Thune", role: "Sénateur républicain, chef des républicains au Sénat", co: "", actor: null, re: /\bThune\b/, q: '"Thune" (AI OR "artificial intelligence" OR preemption)' },
  { id: "amy-klobuchar", w: 0.6, cat: "pouvoirs", n: "Amy Klobuchar", role: "Sénatrice démocrate du Minnesota, coauteure du texte sénatorial sur l'IA", co: "", actor: null, re: /\bKlobuchar\b/, q: '"Klobuchar" (AI OR "artificial intelligence")' },
  { id: "stephen-miller", cat: "pouvoirs", n: "Stephen Miller", role: "Chef de cabinet de la Maison-Blanche (depuis le 9 nov. 2026, succède à Susie Wiles)", co: "", actor: null, re: /\bStephen Miller\b/, q: '"Stephen Miller" (AI OR "artificial intelligence" OR "Super Intelligence" OR Nvidia OR chips)' },
  { id: "chuck-schumer", w: 0.8, cat: "pouvoirs", n: "Chuck Schumer", role: "Sénateur démocrate de New York, chef des démocrates au Sénat", co: "", actor: null, re: /\bSchumer\b/, q: '"Schumer" (AI OR "artificial intelligence" OR Nvidia OR chips)' },
  { id: "frank-pallone", w: 0.6, cat: "pouvoirs", n: "Frank Pallone", role: "Représentant démocrate du New Jersey, premier démocrate de la commission Énergie et Commerce de la Chambre", co: "", actor: null, re: /\bPallone\b/, q: '"Pallone" (AI OR "artificial intelligence" OR "data centers")' },
  // --- Ceux qui influencent (conseillent, écrivent les textes) ---
  { id: "kevin-hassett", w: 0.8, cat: "pouvoirs", n: "Kevin Hassett", role: "Directeur du Conseil économique national (Maison-Blanche)", co: "", actor: null, re: /\bHassett\b/, q: '"Kevin Hassett" (AI OR "artificial intelligence" OR productivity)' },
  { id: "sean-cairncross", w: 0.8, cat: "pouvoirs", n: "Sean Cairncross", role: "Directeur national de la cybersécurité (Maison-Blanche)", co: "", actor: null, re: /\bCairncross\b/, q: '"Cairncross" (AI OR "artificial intelligence" OR cyber)' },
  { id: "andrew-ferguson", w: 0.8, cat: "pouvoirs", n: "Andrew Ferguson", role: "Président de la Commission fédérale du commerce (FTC), vice-président de la « Super Intelligence Force »", co: "", actor: null, re: /\bAndrew Ferguson\b/, q: '"Andrew Ferguson" FTC (AI OR chatbots OR antitrust)' },
  { id: "emil-michael", w: 0.8, cat: "pouvoirs", n: "Emil Michael", role: "Sous-secrétaire à la Défense pour la recherche et l'ingénierie, directeur technique du Pentagone", co: "", actor: null, re: /\bEmil Michael\b/, q: '"Emil Michael" (AI OR Pentagon OR Anthropic OR drones)' },
  { id: "scott-kupor", w: 0.8, cat: "pouvoirs", n: "Scott Kupor", role: "Directeur de l'OPM (personnel fédéral), ancien associé d'Andreessen Horowitz", co: "", actor: null, re: /\bKupor\b/, q: '"Scott Kupor" (AI OR OPM)' },
  { id: "marsha-blackburn", w: 0.6, cat: "pouvoirs", n: "Marsha Blackburn", role: "Sénatrice républicaine du Tennessee, auteure d'un projet de loi sur l'IA", co: "", actor: null, re: /\bBlackburn\b/, q: '"Blackburn" (AI OR "artificial intelligence" OR "AI Act")' },
  { id: "gavin-newsom", w: 0.8, cat: "pouvoirs", n: "Gavin Newsom", role: "Gouverneur démocrate de Californie", co: "", actor: null, re: /\bNewsom\b/, q: '"Newsom" (AI OR "artificial intelligence" OR preemption)' },
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
export const TOPIC = /\b(?:A\.?I\.?|artificial intelligence|chatbots?|Nvidia|OpenAI|Anthropic|Gemini|ChatGPT|Claude|xAI|Grok|chips?|semiconductors?|GPUs?|data ?cent(?:er|re)s?|Huang|Microsoft|Alphabet|Google|Meta|AMD|Broadcom|TSMC|Micron|Intel|Oracle|CoreWeave|Palantir|SoftBank|Samsung|SK hynix|ASML|hyperscalers?|robots?|robotics|super ?intelligence|preempt\w*|export controls?|large loads?|AI Act|tech(?:nology)?)\b/i;
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
        if (p.watch !== false && ts > Date.parse(ROLES_AS_OF + "T23:59:59Z") && p.re.test(title) && CHANGE.test(title)) alerts.get(p.id).set(canon(x.link), { ts: new Date(ts).toISOString(), title, url: x.link, source: x.source || "Presse" });
        if ((p.cat === "pouvoirs" || p.cat === "investisseurs" || p.topic) && !TOPIC.test(title)) continue;
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
        for (const p of PEOPLE) if (p.re.test(x.title)) add(p, { ts: new Date(ts).toISOString(), title: x.title, url: x.link, source: c.name, kind: "video" });
      }
    } catch (e) { failed++; log(`Voix ${c.name} : ${String(e.message || e).slice(0, 80)}`); }
  }
  const people = PEOPLE.map((p) => ({
    id: p.id, cat: p.cat, w: p.w ?? 1, n: p.n, role: p.role, co: p.co, actor: p.actor,
    alerts: [...alerts.get(p.id).values()].filter((a) => Date.parse(a.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 2),
    items: [...byPerson.get(p.id).values()].filter((it) => Date.parse(it.ts) >= cutoff).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, VOIX_RULES.perPerson),
  }));
  const total = people.reduce((s, p) => s + p.items.length, 0);
  return { doc: { v: 1, generated_at: new Date(now).toISOString(), people }, summary: { added, failed, total, reason: failed >= PEOPLE.length + CHANNELS.length ? "toutes les sources en échec" : "" } };
}

export const VOIX_SYSTEM = `Tu traduis en français des titres d'articles de presse et de vidéos sur l'intelligence artificielle. Pour chaque titre (i, en), renvoie fr = la traduction française fidèle, naturelle, au même niveau d'affirmation (« says » reste une déclaration, « warns » un avertissement, pas plus fort ni plus faible).
Règles : conserve exactement les chiffres, noms propres, sociétés, sigles et produits ; ne rajoute aucune information ; garde les guillemets s'il y en a. Réponds uniquement par un tableau JSON, un objet par titre, avec le même champ i.`;
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
    const a = digits(it.title), b = digits(fr);
    if (a.length !== b.length || !a.every((x, k) => x === b[k])) continue;
    it.title_fr = fr; n++;
  }
  return { changed: n, reason: n ? `${n} titre(s) traduit(s)` : "aucune traduction valide" };
}

/* ---------- Déclarations brûlantes du jour (Une) : classement mécanique, sans IA ---------- */
export const HOT_RULES = { hours: 48, top: 3, weight: { dirigeants: 1, pouvoirs: 1, cadres: 0.8, chercheurs: 0.8, investisseurs: 0.7 }, strong: 1.3, sim: 0.4 };
const STRONG = /\b(?:warns?|warned|resign\w*|slams?|admits?|predicts?|reveals?|vows?|rejects?|denies|demands?|urges?|calls? for|shorts?|sells?|sold|downgrades?|insists?|blasts?|accuses?)\b/i;
const STOP = new Set("the a an of to in on for and or at by with as is are was be it its this that from after says said say will would about over into than not has have had who his her their".split(" "));
const toks = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i ? i / (a.size + b.size - i) : 0; };

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
    const rec = age <= 12 ? 1 : age <= 24 ? 0.8 : 0.5;
    const score = rec * (1 + Math.log2(Math.max(1, media.size))) * (R.weight[x.p.cat] || 0.7) * (x.p.w ?? 1) * (STRONG.test(x.it.title) ? R.strong : 1);
    const cur = best.get(x.p.id);
    if (!cur || score > cur.score) best.set(x.p.id, { score: +score.toFixed(2), id: x.p.id, n: x.p.n, role: x.p.role, actor: x.p.actor, ts: x.it.ts, title: x.it.title, title_fr: x.it.title_fr || "", url: x.it.url, source: x.it.source, kind: x.it.kind, outlets: media.size });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.ts.localeCompare(a.ts)).slice(0, R.top);
}
