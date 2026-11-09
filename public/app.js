(function(){
"use strict";
var COUNTRIES=[["ALL","Tous"],["US","États-Unis"],["CN","Chine"],["EU","Europe"],["GULF","Golfe"],["OTHER","Autres"]];
var CLABEL={US:"États-Unis",CN:"Chine",EU:"Europe",GULF:"Golfe",OTHER:"Autres",UK:"Royaume-Uni"};
var CATS={modeles:"Modèles",puces:"Puces",energie:"Énergie",capex:"Capex & finance",regul:"Régulation",adoption:"Adoption",recherche:"Recherche"};
var TABS=["une","actualites","marche","infrastructure","usa-chine","methode"];
var FILTERED={"une":1,"actualites":1,"marche":1};
var S={feed:[],market:null,layers:null,race:null,status:null,country:"ALL",cat:"ALL",top:false,tab:"une",layerSort:"pile",open:{},limit:60,run:null};

function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function link(u){return /^https?:\/\//.test(u||"")?u:"#"}
function ago(iso){if(!iso)return"jamais";var m=Math.round((Date.now()-new Date(iso).getTime())/60000);if(m<1)return"à l'instant";if(m<60)return"il y a "+m+" min";var h=Math.round(m/60);if(h<24)return"il y a "+h+" h";return"il y a "+Math.round(h/24)+" j"}
function fmtDay(iso){return new Date(iso).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}
function fmtTime(iso){return new Date(iso).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})}
function ctag(c){return '<span class="tag c-'+esc(c)+'">'+esc(CLABEL[c]||c)+'</span>'}
function conf(c){return '<span class="conf '+esc(c)+'"><i></i>Confiance '+esc(c)+'</span>'}
function imp(n){return '<span class="imp" title="Importance '+n+'/3">'+[1,2,3].map(function(i){return'<i class="'+(i<=n?'f':'')+'"></i>'}).join("")+'</span>'}
function srcLinks(a){return (a||[]).map(function(s){return'<a href="'+esc(link(s.u))+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>'}).join("")}

function getJSON(p){return fetch(p+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(p+" "+r.status);return r.json()})}

function loadData(){
  return Promise.all([getJSON("data/feed.json"),getJSON("data/market.json"),getJSON("data/layers.json"),getJSON("data/race.json"),getJSON("data/status.json")]).then(function(r){
    S.feed=(r[0].items||[]).slice().sort(function(a,b){return b.ts.localeCompare(a.ts)});
    S.market=r[1];S.layers=r[2];S.race=r[3];S.status=r[4];
  });
}
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
function triggerRefresh(force){
  return fetch("api/refresh"+(force?"?force=1":""),{method:"POST"}).then(function(r){return r.ok?r.json():null}).catch(function(){return null});
}
function pollStatus(deadline){
  return fetch("api/status",{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).catch(function(){return null}).then(function(s){
    if(s&&s.running&&Date.now()<deadline)return wait(4000).then(function(){return pollStatus(deadline)});
    return s;
  });
}
function setStatus(kind,txt,title){
  var cls=kind==="ok"?"":(kind==="err"?"err":"stale");
  $("status").innerHTML='<span class="dot '+cls+'"></span>'+esc(txt);
  $("status").title=title||"";
}
function freshness(extra){
  var u=S.status&&S.status.updated_at;
  var stale=u&&(Date.now()-new Date(u).getTime())>6*3600*1000;
  var errs=(S.status&&S.status.last_run&&S.status.last_run.errors)||[];
  setStatus(stale||errs.length?"stale":"ok","Données "+ago(u)+(S.status&&S.status.mode==="seed"?" · jeu initial":"")+(extra||""),errs.join(" · "));
}
function busy(on){
  var b=$("refresh");b.classList.toggle("loading",on);b.disabled=on;$("refreshLabel").textContent=on?"Collecte en cours…":"Mettre à jour";
}
function refresh(force){
  if(S.run)return S.run;
  S.run=loadData().then(function(){freshness();renderAll()}).catch(function(e){setStatus("err","Données indisponibles");console.error(e)})
  .then(function(){return triggerRefresh(force)})
  .then(function(r){
    if(r&&r.running){
      busy(true);setStatus("stale","Collecte en cours… (1 à 5 min)");
      return pollStatus(Date.now()+8*60000).then(function(st){
        return loadData().then(function(){freshness(st&&st.added!=null?" · +"+st.added+" articles":"");renderAll()});
      });
    }
    if(r&&r.skipped&&force){var el=$("status");el.title=r.skipped}
  }).catch(function(e){console.error(e)}).then(function(){busy(false);S.run=null});
  return S.run;
}

/* filters */
function byCountry(x){return S.country==="ALL"||x.country===S.country}
function renderChips(){
  $("chips").innerHTML=COUNTRIES.map(function(c){return'<button class="chip'+(S.country===c[0]?' on':'')+'" data-c="'+c[0]+'">'+c[1]+'</button>'}).join(" ");
}

/* views */
function storyHTML(it,cls){
  return '<article class="'+(cls||"story")+'"><div class="meta">'+ctag(it.country)+'<span class="cat">'+esc(CATS[it.category]||it.category)+'</span></div>'+
  '<h4>'+esc(it.title)+'</h4><p>'+esc(it.summary)+'</p><div class="meta"><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(it.source)+'</a><span>'+esc(fmtDay(it.ts).replace(/^\S+\s/,""))+'</span>'+conf(it.confidence)+'</div></article>';
}
function rUne(){
  var items=S.feed.filter(byCountry);
  var el=$("v-une");
  if(!items.length){el.innerHTML='<div class="empty">Aucune actualité pour ce filtre.</div>';return}
  var ranked=items.slice().sort(function(a,b){return (b.importance-a.importance)||b.ts.localeCompare(a.ts)});
  var lead=ranked[0];
  var rest=items.filter(function(x){return x.id!==lead.id}).sort(function(a,b){return (b.importance-a.importance)||b.ts.localeCompare(a.ts)}).slice(0,6);
  var tiles=(S.market.tiles||[]).slice(0,5);
  var top=S.layers.layers.slice().sort(function(a,b){return b.tension-a.tension}).slice(0,3);
  var rows=S.race.rows,us=rows.filter(function(r){return r.lead>0}).length,cn=rows.filter(function(r){return r.lead<0}).length;
  el.innerHTML='<div class="home"><div>'+
    '<article class="lead"><div class="meta"><span class="kicker">À la une</span>'+ctag(lead.country)+'<span class="cat">'+esc(CATS[lead.category]||lead.category)+'</span></div>'+
    '<h3>'+esc(lead.title)+'</h3><p>'+esc(lead.summary)+'</p><div class="meta"><a href="'+esc(link(lead.url))+'" target="_blank" rel="noopener">'+esc(lead.source)+'</a><span>'+esc(fmtDay(lead.ts))+'</span>'+conf(lead.confidence)+'</div></article>'+
    '<hr class="rule thick"><div class="subgrid">'+rest.map(function(i){return storyHTML(i)}).join("")+'</div>'+
    '<button class="more" data-go="actualites">Toutes les actualités →</button></div>'+
    '<aside class="rail">'+
      '<div class="box"><h5>Chiffres clés</h5>'+tiles.map(function(t){return'<div class="fig"><span>'+esc(t.label)+'</span><b>'+esc(t.value)+'</b></div>'}).join("")+'<button class="more" data-go="marche">État du marché →</button></div>'+
      '<div class="box"><h5>Goulots les plus tendus</h5>'+top.map(function(l){return'<div style="padding:8px 0;border-bottom:1px solid var(--rule)"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:5px"><span>'+esc(l.name)+'</span><span class="small">'+esc(l.tension_label)+'</span></div>'+meter(l.tension)+'</div>'}).join("")+'<button class="more" data-go="infrastructure">Toute la pile →</button></div>'+
      '<div class="box"><h5>Course USA–Chine</h5><div class="score" style="margin:0 0 14px;gap:22px"><div><div class="n us" style="font-size:44px">'+us+'</div><div class="lb">avance USA</div></div><div><div class="n cn" style="font-size:44px">'+cn+'</div><div class="lb">avance Chine</div></div></div>'+raceRows(true)+'<button class="more" data-go="usa-chine">Détail par couche →</button></div>'+
    '</aside></div>';
}

function rFeed(){
  var el=$("v-actualites");
  var cats=[["ALL","Toutes"]].concat(Object.keys(CATS).map(function(k){return[k,CATS[k]]}));
  var items=S.feed.filter(byCountry).filter(function(x){return S.cat==="ALL"||x.category===S.cat}).filter(function(x){return!S.top||x.importance>=3});
  var h='<h2 class="sec">Actualités</h2><p class="lede">Les informations collectées, classées par pays et par thème, de la plus récente à la plus ancienne. La confiance indique la solidité de la source.</p>'+
   '<div class="toolbar">'+cats.map(function(c){return'<button class="chip'+(S.cat===c[0]?' on':'')+'" data-cat="'+c[0]+'">'+c[1]+'</button>'}).join("")+'<span class="sp"></span><button class="chip'+(S.top?' on':'')+'" data-top="1">Essentiel seulement</button></div>';
  if(!items.length)h+='<div class="empty">Aucune actualité pour ces filtres.</div>';
  var day="";var total=items.length;items=items.slice(0,S.limit);
  items.forEach(function(it){
    var d=it.ts.slice(0,10);
    if(d!==day){day=d;h+='<div class="day">'+esc(fmtDay(it.ts))+'</div>'}
    h+='<article class="item i'+it.importance+'"><div class="time">'+esc(fmtTime(it.ts))+'</div><div><div class="meta">'+ctag(it.country)+'<span class="cat">'+esc(CATS[it.category]||it.category)+'</span>'+imp(it.importance)+'<span>'+esc(it.layer||"")+'</span></div><h4>'+esc(it.title)+'</h4><p>'+esc(it.summary)+'</p><div class="meta"><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(it.source)+' ↗</a>'+conf(it.confidence)+'</div></div></article>';
  });
  if(total>items.length)h+='<div style="text-align:center;padding:24px 0"><button class="btn" data-more="1">Voir '+Math.min(60,total-items.length)+' articles de plus ('+(total-items.length)+' restants)</button></div>';
  el.innerHTML=h;
}

function rMarket(){
  var m=S.market,el=$("v-marche");
  var maxUS=250;
  var cu=m.capex_us.map(function(c){
    var lo=c.low/maxUS*100,hi=c.high/maxUS*100;
    var val=c.low===c.high?c.low:c.low+"–"+c.high;
    var fill=c.low===c.high?'<div class="fill" style="width:'+hi+'%"></div>':'<div class="fill" style="width:'+lo+'%"></div><div class="rng" style="left:'+lo+'%;width:'+(hi-lo)+'%"></div>';
    return'<div class="bar"><div class="nm">'+esc(c.name)+'</div><div class="track">'+fill+'</div><div class="val">'+val+' Md$</div><div class="nt">'+esc(c.note)+' · <a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+'</a>, '+esc(c.as_of)+'</div></div>';
  }).join("");
  var cc=m.capex_cn.map(function(c){return'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.value)+'</td><td>'+esc(c.note)+' <a href="'+esc(link(c.url))+'" target="_blank" rel="noopener" class="small">'+esc(c.source)+'</a></td></tr>'}).join("");
  var rev=m.revenue.filter(byCountry);
  var maxR=Math.max.apply(null,m.revenue.map(function(r){return r.num}));
  var rv=rev.length?rev.map(function(r){return'<div class="bar"><div class="nm">'+esc(r.name)+'</div><div class="track"><div class="fill'+(r.country==="CN"?' cn':'')+'" style="width:'+Math.max(2,r.num/maxR*100)+'%"></div></div><div class="val">'+esc(r.value)+' Md$</div><div class="nt">'+esc(r.note)+' · <a href="'+esc(link(r.url))+'" target="_blank" rel="noopener">'+esc(r.source)+'</a>, '+esc(r.as_of)+' · '+conf(r.confidence)+'</div></div>'}).join(""):'<div class="empty">Aucune donnée de revenus pour ce pays.</div>';
  var act=m.actors.filter(byCountry);
  el.innerHTML='<h2 class="sec">Marché</h2><p class="lede">Qui dépense, qui gagne de l\'argent, qui compte. Chiffres sourcés ; la date et la source figurent sous chaque donnée.</p>'+
   '<div class="tiles">'+m.tiles.map(function(t){return'<div class="tile"><div class="l">'+esc(t.label)+'</div><div class="v">'+esc(t.value)+'</div><div class="s">'+esc(t.sub)+'</div><div class="src"><a href="'+esc(link(t.u))+'" target="_blank" rel="noopener">'+esc(t.src)+'</a></div></div>'}).join("")+'</div>'+
   '<div class="two"><div class="panel"><span class="kicker">Qui dépense</span><h3>Capex 2026, États-Unis</h3><div class="sub">Guidance annuelle, en milliards de dollars. Zone claire = fourchette.</div>'+cu+'</div>'+
   '<div class="panel"><span class="kicker">Qui dépense</span><h3>Capex, Chine</h3><div class="sub">Montants en yuans, comparables au capex américain à un facteur de 5 à 7 près.</div><table class="table"><thead><tr><th>Société</th><th>Montant</th><th>Détail</th></tr></thead><tbody>'+cc+'</tbody></table></div></div>'+
   '<div class="two"><div class="panel"><span class="kicker">Qui gagne</span><h3>Revenus de l\'IA</h3><div class="sub">Run-rate annualisé, en milliards de dollars.</div>'+rv+'</div>'+
   '<div class="note"><b>À lire avant de comparer.</b> '+esc(m.caveat)+'</div></div>'+
   '<hr class="rule thick" style="margin-top:34px"><span class="kicker">Qui compte</span><h3 style="font-family:var(--serif);font-size:22px;margin:2px 0 6px">Principaux acteurs</h3>'+
   (act.length?'<table class="table"><thead><tr><th>Acteur</th><th>Pays</th><th>Rôle</th><th>Repère</th></tr></thead><tbody>'+act.map(function(a){return'<tr><td>'+esc(a.name)+'</td><td>'+ctag(a.country)+'</td><td>'+esc(a.role)+'</td><td>'+esc(a.note)+' <a class="small" href="'+esc(link(a.u))+'" target="_blank" rel="noopener">'+esc(a.src)+'</a></td></tr>'}).join("")+'</tbody></table>':'<div class="empty">Aucun acteur pour ce filtre.</div>');
}

function meter(t){
  var cls=t>=7?"":(t>=5?"m":"l");
  var s='';for(var i=1;i<=10;i++)s+='<i class="'+(i<=t?'f':'')+'"></i>';
  return'<div class="meter '+cls+'">'+s+'</div>';
}
function rInfra(){
  var L=S.layers.layers.slice();
  if(S.layerSort==="tension")L.sort(function(a,b){return b.tension-a.tension});else L.sort(function(a,b){return a.order-b.order});
  var el=$("v-infrastructure");
  el.innerHTML='<h2 class="sec">Infrastructure</h2><p class="lede">La pile de l\'IA, des applications à l\'énergie. Pour chaque couche : qui domine, où ça coince, et à quel point (tension de 0 à 10, estimation éditoriale).</p>'+
   '<div class="toolbar"><button class="chip'+(S.layerSort==="pile"?' on':'')+'" data-ls="pile">Ordre de la pile</button><button class="chip'+(S.layerSort==="tension"?' on':'')+'" data-ls="tension">Par tension</button></div><div class="stack">'+
   L.map(function(l){
     var open=S.open["l"+l.id]?" open":"";
     return'<div class="layer'+open+'"><button class="lhead" data-toggle="l'+esc(l.id)+'"><span class="lnum">'+l.order+'</span><span class="lname">'+esc(l.name)+'</span><span class="lstat">'+esc(l.key_stat)+'</span><span class="lm">'+meter(l.tension)+'<span class="mlabel"><span>Tension</span><span>'+esc(l.tension_label)+' · '+l.tension+'/10</span></span></span><span class="chev">›</span></button>'+
      '<div class="lbody"><div class="leaders">'+l.leaders.map(function(x){return'<span class="leader c-'+esc(x.c)+'">'+esc(x.n)+'</span>'}).join("")+'</div><p>'+esc(l.note)+'</p><div class="srcs">'+srcLinks(l.sources)+'</div></div></div>';
   }).join("")+'</div>';
}

function bar(lead){
  var w=Math.abs(lead)/2*50;
  if(lead===0)return'<div class="div"><div class="gl"></div></div>';
  return'<div class="div"><div class="gl"></div><div class="b '+(lead>0?'us':'cn')+'" style="width:'+w+'%"></div></div>';
}
function trendTxt(r){
  if(r.trend===0)return"→ écart stable";
  if(r.trend>0)return r.lead>=0?"↗ les États-Unis creusent l'écart":"↗ les États-Unis rattrapent";
  return r.lead<=0?"↘ la Chine creuse l'écart":"↘ la Chine rattrape";
}
function raceRows(compact){
  var rows=S.race.rows.slice().sort(function(a,b){return b.lead-a.lead});
  var h='<div class="'+(compact?'compact':'')+'">';
  if(!compact)h+='<div class="axis"><span>Couche</span><div class="ends"><span>← Avance Chine</span><span>Avance USA →</span></div><span>Tendance</span><span></span></div>';
  rows.forEach(function(r){
    var open=(!compact&&S.open["r"+r.id])?" open":"";
    h+='<div class="rrow'+open+'"><'+(compact?'div':'button')+' class="rhead" '+(compact?'':'data-toggle="r'+esc(r.id)+'"')+'><span class="rlayer">'+esc(r.layer)+'</span>'+bar(r.lead)+(compact?'':'<span class="trend">'+esc(trendTxt(r))+'</span><span class="chev">›</span>')+'</'+(compact?'div':'button')+'>';
    if(!compact)h+='<div class="rbody"><div class="cmp"><div><h6 class="c-US">États-Unis</h6><p>'+esc(r.us)+'</p></div><div><h6 class="c-CN">Chine</h6><p>'+esc(r.cn)+'</p></div></div><p class="nt">'+esc(r.note)+'</p><div class="meta">'+conf(r.confidence)+'</div><div class="srcs" style="margin-top:8px">'+srcLinks(r.sources)+'</div></div>';
    h+='</div>';
  });
  return h+'</div>';
}
function rRace(){
  var rows=S.race.rows,us=rows.filter(function(r){return r.lead>0}).length,cn=rows.filter(function(r){return r.lead<0}).length,eq=rows.length-us-cn;
  $("v-usa-chine").innerHTML='<h2 class="sec">USA–Chine</h2><p class="lede">'+esc(S.race.summary)+'</p>'+
   '<div class="score"><div><div class="n us">'+us+'</div><div class="lb">couches : avance USA</div></div><div><div class="n cn">'+cn+'</div><div class="lb">couches : avance Chine</div></div>'+(eq?'<div><div class="n" style="color:var(--mute)">'+eq+'</div><div class="lb">à égalité</div></div>':'')+'</div>'+
   raceRows(false)+'<div class="note"><b>Méthode.</b> '+esc(S.race.method)+'</div>';
}

function health(){
  var lr=S.status&&S.status.last_run;if(!lr||!lr.sources)return"";
  var ok=lr.sources.filter(function(x){return x.ok}),ko=lr.sources.filter(function(x){return!x.ok});
  var kinds={};lr.sources.forEach(function(x){var k=kinds[x.kind]||(kinds[x.kind]={ok:0,ko:0,n:0});x.ok?k.ok++:k.ko++;k.n+=x.n});
  var lab={rss:"Flux RSS",googlenews:"Google News",gdelt:"GDELT",newsdata:"NewsData.io",hn:"Hacker News",hf:"Hugging Face",arxiv:"arXiv",edgar:"SEC EDGAR",fedreg:"Federal Register"};
  return'<hr class="rule thick" style="margin-top:34px"><span class="kicker">Santé de la collecte</span><p class="lede" style="margin:6px 0 14px">Dernier passage : '+esc(ago(lr.started_at))+', '+lr.duration_s+' s · '+ok.length+' sources sur '+lr.sources.length+' répondent · '+lr.added+' articles ajoutés'+(lr.model?' · classement par '+esc(lr.model):'')+'.</p>'+
   (lr.errors&&lr.errors.length?'<div class="note" style="margin:0 0 16px"><b>Alertes.</b> '+lr.errors.map(esc).join(' · ')+'</div>':'')+
   '<table class="table"><thead><tr><th>Type</th><th>Sources actives</th><th>Articles bruts</th></tr></thead><tbody>'+Object.keys(kinds).map(function(k){var x=kinds[k];return'<tr><td>'+esc(lab[k]||k)+'</td><td>'+x.ok+' / '+(x.ok+x.ko)+'</td><td>'+x.n+'</td></tr>'}).join("")+'</tbody></table>'+
   (ko.length?'<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Sources en échec ('+ko.length+')</summary><div class="small" style="padding:8px 0;columns:2">'+ko.map(function(x){return esc(x.name)+' — '+esc(x.err||"erreur")}).join('<br>')+'</div></details>':'');
}
function rMethod(){
  var seen={},list=[];
  function add(t,u){if(u&&!seen[u]){seen[u]=1;list.push([t,u])}}
  S.layers.layers.forEach(function(l){l.sources.forEach(function(s){add(s.t,s.u)})});
  S.race.rows.forEach(function(r){r.sources.forEach(function(s){add(s.t,s.u)})});
  S.feed.forEach(function(f){add(f.source,f.url)});
  list.sort(function(a,b){return a[0].localeCompare(b[0])});
  $("v-methode").innerHTML='<h2 class="sec">Méthode et sources</h2><p class="lede">Ce que ce site fait, ce qu\'il ne fait pas, et d\'où viennent les chiffres.</p>'+
   '<div class="method"><div><span class="kicker">Fonctionnement</span><ol class="steps"><li><b>Collecte</b><span>Un agent récupère toutes les deux heures les flux de presse et de newsletters spécialisées dans le monde.</span></li><li><b>Classement</b><span>Chaque article reçoit un pays, un thème, une importance de 1 à 3, une couche de la pile et un résumé en français.</span></li><li><b>Publication</b><span>Les données sont enregistrées dans le dépôt GitHub puis affichées ici. À l\'ouverture et via « Mettre à jour », le site recharge les dernières données.</span></li></ol></div>'+
   '<div><span class="kicker">Lire avec prudence</span><ol class="steps"><li><b>Confiance</b><span>Haute : document primaire (SEC, communiqué). Moyenne : presse ou newsletter. Faible : titre non vérifié.</span></li><li><b>Estimations</b><span>Les scores USA–Chine et les tensions des couches sont des estimations éditoriales, pas des mesures.</span></li><li><b>Run-rates</b><span>Les revenus des laboratoires privés ne sont pas audités et ne sont pas calculés de la même façon.</span></li></ol></div></div>'+
   health()+
   '<hr class="rule thick" style="margin-top:34px"><span class="kicker">Sources citées ('+list.length+')</span><div class="src-list">'+list.map(function(s){return'<a href="'+esc(link(s[1]))+'" target="_blank" rel="noopener">'+esc(s[0])+' ↗</a>'}).join("")+'</div>';
}

function renderAll(){
  if(!S.market)return;
  renderChips();rUne();rFeed();rMarket();rInfra();rRace();rMethod();
}
function show(tab){
  if(TABS.indexOf(tab)<0)tab="une";
  S.tab=tab;
  TABS.forEach(function(t){$("v-"+t).classList.toggle("on",t===tab)});
  [].forEach.call(document.querySelectorAll(".tab"),function(b){b.classList.toggle("on",b.getAttribute("data-tab")===tab)});
  $("filter").style.visibility=FILTERED[tab]?"visible":"hidden";
  window.scrollTo(0,0);
}
function go(tab){if(location.hash!=="#"+tab)location.hash=tab;else show(tab)}

document.addEventListener("click",function(e){
  var t=e.target.closest("[data-tab],[data-c],[data-cat],[data-top],[data-ls],[data-toggle],[data-go],[data-more]");if(!t)return;
  if(t.hasAttribute("data-tab"))return go(t.getAttribute("data-tab"));
  if(t.hasAttribute("data-go"))return go(t.getAttribute("data-go"));
  if(t.hasAttribute("data-more")){S.limit+=60;rFeed();return}
  if(t.hasAttribute("data-c")){S.country=t.getAttribute("data-c");S.limit=60;renderAll();return}
  if(t.hasAttribute("data-cat")){S.cat=t.getAttribute("data-cat");S.limit=60;renderAll();return}
  if(t.hasAttribute("data-top")){S.top=!S.top;S.limit=60;renderAll();return}
  if(t.hasAttribute("data-ls")){S.layerSort=t.getAttribute("data-ls");renderAll();return}
  if(t.hasAttribute("data-toggle")){var k=t.getAttribute("data-toggle");S.open[k]=!S.open[k];t.parentNode.classList.toggle("open",!!S.open[k])}
});
$("refresh").addEventListener("click",function(){refresh(true)});
window.addEventListener("hashchange",function(){show(location.hash.slice(1))});
$("today").textContent=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
show(location.hash.slice(1));
refresh(false);
})();
