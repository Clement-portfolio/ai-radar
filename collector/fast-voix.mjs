// Collecte légère d'Insiders Presse : une requête Google News groupée toutes les 5 minutes.
// Le collecteur complet (toutes les personnes, vidéos, alertes et enrichissements) reste exécuté toutes les 3 h.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFeed } from "./collect.mjs";
import { PEOPLE, isStatement, INVEST_CUE, TOPIC, HOT_RULES, STRONG, toks, jac, translateVoix, VOIX_SYSTEM, VOIX_SCHEMA } from "./voix.mjs";
import { makeClassifier } from "./collect.mjs";
const HERE=path.dirname(fileURLToPath(import.meta.url));
const DATA=path.join(HERE,"..","public","data");
const FAST_IDS=new Set(["sam-altman","dario-amodei","elon-musk","satya-nadella","sundar-pichai","demis-hassabis","mark-zuckerberg","jensen-huang","lisa-su","hock-tan","cc-wei","andy-jassy","lip-bu-tan","kwak-noh-jung","michael-intrator","stacy-rasgon","dylan-patel"]);
const DAY=864e5,now=Date.now(),cutoff=now-8*3600e3;
const selected=PEOPLE.filter(p=>FAST_IDS.has(p.id));
const canon=u=>{try{const x=new URL(u);x.hash="";for(const k of [...x.searchParams.keys()])if(/^utm_|^oc$|^hl$|^gl$|^ceid$/.test(k))x.searchParams.delete(k);return x.href.replace(/\/$/,"")}catch{return String(u||"")}};
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
async function read(name,fallback){try{return JSON.parse(await fs.readFile(path.join(DATA,name),"utf8"))}catch{return fallback}}
async function fetchFeed(url){let last;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; AI-Radar/1.0)","accept":"application/rss+xml, application/atom+xml, application/xml, text/xml, */*"},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error("Google News HTTP "+r.status);return parseFeed(await r.text())}catch(e){last=e;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,2500))}}throw last}
const prev=await read("voix-fast.json",{people:[]}),full=await read("voix.json",{people:[]});
const knownFrench=new Map((full.people||[]).flatMap(p=>p.items||[]).filter(it=>it.title_fr).map(it=>[canon(it.url),it.title_fr]));
const byPerson=new Map(selected.map(p=>[p.id,new Map()]));
for(const p of prev.people||[])if(byPerson.has(p.id))for(const it of p.items||[])byPerson.get(p.id).set(canon(it.url),it);
const names=selected.map(p=>'"'+p.n+'"').join(" OR ");
const query='('+names+') (AI OR "artificial intelligence" OR Nvidia OR chips OR datacenter OR compute OR semiconductor OR robotics) when:8h';
const url='https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-US&gl=US&ceid=US%3Aen';
const entries=await fetchFeed(url);let added=0;
for(const x of entries.slice(0,100)){const ts=Date.parse(x.date);if(!Number.isFinite(ts)||ts<cutoff||ts>now+3600000||!x.link||!x.title)continue;
 const suffix=x.source&&x.title.endsWith(" - "+x.source)?" - "+x.source:null;
 const title=(suffix?x.title.slice(0,-suffix.length):x.title.replace(/\s+-\s+[^-]{2,40}$/,"")).trim();
 for(const p of selected){if(!p.re.test(title))continue;if((p.cat==="pouvoirs"||p.cat==="investisseurs"||p.topic)&&!TOPIC.test(title))continue;if(!isStatement(title,p.re,p.cat==="investisseurs"?INVEST_CUE:""))continue;
  const m=byPerson.get(p.id),key=canon(x.link);if(m.has(key)||[...m.values()].some(it=>norm(it.title)===norm(title)))continue;
  m.set(key,{ts:new Date(ts).toISOString(),title,title_fr:knownFrench.get(key)||"",url:x.link,source:String(x.source||"").split(/\s[-–|]\s/)[0]||"Presse",kind:"presse"});added++;
 }}
const people=selected.map(p=>({id:p.id,cat:p.cat,w:p.w??1,n:p.n,role:p.role,co:p.co,actor:p.actor,alerts:[],items:[...byPerson.get(p.id).values()].filter(it=>Date.parse(it.ts)>=now-30*DAY).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,8)}));
// Regroupement : un même propos repris par plusieurs médias n'occupe qu'une ligne ; `m` = médias distincts, `e` = essentielle (comme à la collecte complète).
// Un propos déjà présent dans la collecte complète (même personne, titres proches, moins de 48 h) n'est pas répété ici.
const fullBy=new Map((full.people||[]).map(p=>[p.id,p.items||[]]));
for(const p of people){
 const deep=(fullBy.get(p.id)||[]).map(it=>({t:toks(it.title),ts:Date.parse(it.ts)}));const kept=[];
 for(const it of p.items){const t=toks(it.title),ts=Date.parse(it.ts),src=String(it.source||"").toLowerCase();
  const srcs=new Set([...(it.srcs||[]),src].filter(Boolean));
  const rep=kept.find(r=>Math.abs(Date.parse(r.ts)-ts)<=HOT_RULES.hours*36e5&&jac(r.t,t)>=HOT_RULES.sim);
  if(rep){srcs.forEach(x=>rep.set.add(x));continue}
  if(deep.some(d=>Math.abs(d.ts-ts)<=HOT_RULES.hours*36e5&&jac(d.t,t)>=HOT_RULES.sim))continue;
  kept.push({it,t,ts:it.ts,set:srcs});}
 p.items=kept.map(r=>{const m=Math.max(1,r.set.size);r.it.srcs=[...r.set];r.it.m=m;r.it.e=m>=2||(p.w>=HOT_RULES.strong&&STRONG.test(r.it.title))?1:0;return r.it});
}
// Traduction des titres restants : un appel Gemini groupé, au plus toutes les 10 min (30 min ou 6 h après un échec).
let retryAt=prev.translate_retry_at||"";
if(process.env.GEMINI_API_KEY&&people.some(p=>p.items.some(it=>!it.title_fr))&&now>=(Date.parse(retryAt)||0)){
 try{const cl=await makeClassifier(process.env,fetch,m=>console.log(m));
  if(cl.state.fatal){console.log("Traduction des déclarations ignorée : "+cl.state.error);retryAt=new Date(now+(/quota/i.test(cl.state.error||"")?6*36e5:36e5)).toISOString()}
  else{const r=await translateVoix({doc:{people},generate:inputs=>cl.call(inputs,{system:VOIX_SYSTEM,schema:VOIX_SCHEMA})});console.log("Traduction des déclarations : "+r.reason);retryAt=new Date(now+(r.changed?10:30)*60e3).toISOString()}
 }catch(e){console.log("Traduction des déclarations indisponible : "+String(e.message||e).slice(0,120));retryAt=new Date(now+30*60e3).toISOString()}
}
await fs.mkdir(DATA,{recursive:true});
if(JSON.stringify(people)!==JSON.stringify(prev.people)||retryAt!==(prev.translate_retry_at||""))await fs.writeFile(path.join(DATA,"voix-fast.json"),JSON.stringify({v:1,generated_at:new Date(now).toISOString(),query_count:1,translate_retry_at:retryAt||undefined,people},null,1));
console.log("Insiders Presse rapide : 1 requête Google News, "+entries.length+" résultats, "+added+" nouvelle(s) déclaration(s), "+people.reduce((n,p)=>n+p.items.length,0)+" conservées.");
