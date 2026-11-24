// Flux rapide : publication des nouvelles actualités sans Gemini ni enrichissements.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseFeed, ruleClassify, isHubPage, makeClassifier } from "./collect.mjs";
import { translateMissing, TRANSLATE_SYSTEM, TRANSLATE_SCHEMA, foreignScript } from "./translate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "public", "data");
const UA = "Mozilla/5.0 (compatible; AI-Radar/1.0)";
const AI = /\b(AI|artificial intelligence|machine learning|deep learning|LLM|GPT|OpenAI|Anthropic|Claude|Gemini|DeepSeek|Qwen|Mistral|Nvidia|GPU|TPU|HBM|TSMC|data ?cent(?:er|re)s?|generative|semiconductor|chip|inference|hyperscaler|gigawatt)\b/i;
const AI_CJK = /人工智能|人工智慧|大模型|大語言模型|算力|芯片|晶片|半導體|半导体|인공지능|반도체|人工知能|الذكاء الاصطناعي/i;
const SOURCES = new Set([
  "OpenAI","Google DeepMind","Google AI","NVIDIA blog","AWS Machine Learning","Hugging Face blog",
  "TechCrunch IA","The Verge IA","Ars Technica","MIT Technology Review IA","CNBC Tech",
  "DatacenterDynamics","The Next Platform","Semiconductor Engineering","EE Times","Epoch AI",
  "Mistral AI","Arab News","Nikkei Asia","Digitimes","TrendForce","Data Center Knowledge",
  "ZDNet IA","ServeTheHome","IEEE Spectrum"
]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./,""); } catch { return ""; } };
const canonical = u => { try { const x=new URL(u); x.hash=""; for(const k of [...x.searchParams.keys()]) if(/^(utm_|fbclid|gclid|ref$|ref_|mc_|cmp|cid$|at_)/i.test(k)) x.searchParams.delete(k); return (x.protocol+"//"+x.host.toLowerCase().replace(/^www\./,"")+x.pathname.replace(/\/+$/,"")+(x.search||"")).toLowerCase(); } catch { return String(u||"").toLowerCase(); } };
const idOf = u => crypto.createHash("sha1").update(canonical(u)).digest("hex").slice(0,12);
async function fetchText(url) {
  const r=await fetch(url,{headers:{"user-agent":UA,accept:"application/rss+xml, application/atom+xml, application/xml, text/xml, */*"},signal:AbortSignal.timeout(12000),redirect:"follow"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.text();
}
async function pool(items,n,fn) {
  let i=0; await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;try{await fn(items[k]);}catch(e){console.log(items[k].name+": "+e.message)}}}));
}
const cfg=JSON.parse(await fs.readFile(path.join(HERE,"sources.json"),"utf8"));
const previous=JSON.parse(await fs.readFile(path.join(DATA,"fast-feed.json"),"utf8").catch(()=>"{\"items\":[]}"));
const main=JSON.parse(await fs.readFile(path.join(DATA,"feed.json"),"utf8").catch(()=>"{\"items\":[]}"));
const known=new Set([...main.items,...previous.items].flatMap(x=>[x.id,canonical(x.url)]));
const cands=[];
const feeds=cfg.rss.filter(s=>SOURCES.has(s.name));
await pool(feeds,8,async s=>{
  const entries=parseFeed(await fetchText(s.url)).slice(0,18);
  for(const e of entries){
    if(!e.title||!e.link) continue;
    const text=e.title+" "+e.summary;
    if((s.filter||true)&&!(AI.test(text)||AI_CJK.test(text))) continue;
    const url=e.link, id=idOf(url), domain=hostOf(url);
    if(known.has(id)||known.has(canonical(url))) continue;
    const ts=Number.isFinite(Date.parse(e.date))?new Date(e.date).toISOString():new Date().toISOString();
    const age=Date.now()-Date.parse(ts);
    if(age>72*3600000||age< -3600000) continue;
    const c={title:e.title,url,domain,hint:s.hint,snippet:e.summary};
    if(isHubPage(c)) continue;
    const rc=ruleClassify(c);
    cands.push({id,ts,title:e.title.trim(),orig:e.title.trim().slice(0,200),summary:(e.summary||"").slice(0,260),country:rc.country,category:rc.category,importance:1,layer:rc.layer,source:s.name,url,confidence:s.tier==="primary"?"haute":"moyenne",pending:true});
  }
});
const merged=new Map();
for(const item of [...previous.items,...cands]) merged.set(item.id,item);
const items=[...merged.values()].filter(x=>Date.now()-Date.parse(x.ts)<72*3600000).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,400);

// Traduction anglaise en lots, sans ralentir la collecte RSS : au plus un appel Gemini toutes les 30 minutes.
const translationStatePath=path.join(DATA,"fast-translation.json");
const translationState=JSON.parse(await fs.readFile(translationStatePath,"utf8").catch(()=>"{}"));
const now=Date.now();
const lastAttempt=Date.parse(translationState.last_attempt_at||"");
const untranslated=items.filter(x=>!x.title_fr||foreignScript(x.title)).slice(0,30);
if(process.env.GEMINI_API_KEY&&untranslated.length&&(!Number.isFinite(lastAttempt)||now-lastAttempt>=30*60*1000)){
  translationState.last_attempt_at=new Date(now).toISOString();
  try{
    const clones=untranslated.map(x=>({...x,pending:false,title_en:x.title_fr?x.title_en:""}));
    const classifier=await makeClassifier(process.env,fetch,(m)=>console.log(m));
    if(!classifier.state.fatal){
      const result=await translateMissing({
        items:clones,
        generate:inputs=>classifier.call(inputs,{system:TRANSLATE_SYSTEM,schema:TRANSLATE_SCHEMA}),
        max:30,
        rounds:1
      });
      const byId=new Map(clones.map(x=>[x.id,x]));
      for(const item of untranslated){
        const translated=byId.get(item.id);
        if(!translated)continue;
        for(const key of ["title","title_fr","title_en","summary_en","why_en"])if(translated[key])item[key]=translated[key];
      }
      console.log("Traduction rapide : "+result.reason);
    }else console.log("Traduction rapide ignorée : "+classifier.state.error);
  }catch(e){console.log("Traduction rapide indisponible : "+String(e.message||e).slice(0,160));}
  await fs.writeFile(translationStatePath,JSON.stringify(translationState,null,1));
}
await fs.mkdir(DATA,{recursive:true});
await fs.writeFile(path.join(DATA,"fast-feed.json"),JSON.stringify({generated_at:new Date().toISOString(),items},null,1));
console.log("Flux rapide : "+feeds.length+" sources, "+cands.length+" nouvelles actualités, "+items.length+" conservées.");
