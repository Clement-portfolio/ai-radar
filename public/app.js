(function(){
"use strict";
var COUNTRIES=[["ALL","Tous"],["US","États-Unis"],["CN","Chine"],["EU","Europe"],["GULF","Golfe"],["OTHER","Autres"]];
var CLABEL={US:"États-Unis",CN:"Chine",EU:"Europe",GULF:"Golfe",OTHER:"Autres",UK:"Royaume-Uni"};
var CATS={modeles:"Modèles",puces:"Puces",energie:"Énergie",capex:"Finance",politique:"Politique",regul:"Régulation",adoption:"Adoption",recherche:"Recherche"};
var TABS=["une","actualites","marche","infrastructure","usa-chine","methode"];
var S={lang:"fr",feed:[],brief:null,sec:null,market:null,layers:null,race:null,status:null,country:"ALL",cat:"ALL",top:false,tab:"une",layerSort:"pile",open:{},limit:120,run:null,fo:null,focus:null};

try{var ql=new URLSearchParams(location.search).get("lang")||localStorage.getItem("lang");if(ql==="en"||ql==="fr")S.lang=ql}catch(e){}
function isEn(){return S.lang==="en"}
function loc(){return isEn()?"en-GB":"fr-FR"}
/* texte d'un article dans la langue choisie (retombe sur le français si la version anglaise n'existe pas encore) */
function tx(o,k){return(isEn()&&o[k+"_en"])||o[k]}
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function link(u){u=u||"";if(/^https:\/\/news\.google\.com\/(rss\/)?(articles|read)\//.test(u))return"/go?u="+encodeURIComponent(u);return /^https?:\/\//.test(u)?u:"#"}
function ago(iso){
  if(isEn()){if(!iso)return"never";var m=Math.round((Date.now()-new Date(iso).getTime())/60000);if(m<1)return"just now";if(m<60)return m+" min ago";var h=Math.round(m/60);if(h<24)return h+" h ago";return Math.round(h/24)+" d ago"}
  if(!iso)return"jamais";var m=Math.round((Date.now()-new Date(iso).getTime())/60000);if(m<1)return"à l'instant";if(m<60)return"il y a "+m+" min";var h=Math.round(m/60);if(h<24)return"il y a "+h+" h";return"il y a "+Math.round(h/24)+" j"}
function fmtDay(iso){return new Date(iso).toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}
function fmtTime(iso){return new Date(iso).toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})}
function ctag(c){return '<span class="tag c-'+esc(c)+'">'+esc(CLABEL[c]||c)+'</span>'}
function conf(c){var L={haute:'Source primaire',moyenne:'Presse',faible:'Non vérifié'};return '<span class="conf '+esc(c)+'"><i></i>'+(L[c]||esc(c))+'</span>'}
function imp(n){return '<span class="imp" title="Importance '+n+'/3">'+[1,2,3].map(function(i){return'<i class="'+(i<=n?'f':'')+'"></i>'}).join("")+'</span>'}
function cdot(c){var L={haute:'Source primaire',moyenne:'Presse',faible:'Non vérifié'};return '<i class="cd '+esc(c)+'" title="'+esc(L[c]||c)+'"></i>'}
function rowHTML(it){
  var k='f'+it.id,open=S.open[k]?' open':'';
  return '<div class="row i'+it.importance+open+'"><span class="time">'+esc(fmtTime(it.ts))+'</span>'+ctag(it.country)+
   '<a class="ttl" href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(tx(it,'title'))+'</a>'+
   '<span class="rsrc">'+esc(it.source)+cdot(it.confidence)+'</span>'+
   '<button class="rtog" data-toggle="'+esc(k)+'" aria-label="Afficher le résumé">›</button>'+(it.why?'<p class="rwhy">'+esc(tx(it,'why'))+'</p>':'')+
   '<div class="sum"><p>'+(it.summary?esc(tx(it,'summary')):'Résumé indisponible : ouvrez l\'article.')+(it.pending?' <i class="small">(titre d\'origine, non classé par l\'IA)</i>':'')+'</p><div class="meta"><span class="cat">'+esc(CATS[it.category]||it.category)+'</span>'+(it.layer?'<span>'+esc(it.layer)+'</span>':'')+imp(it.importance)+conf(it.confidence)+'<a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">Lire sur '+esc(it.source)+' ↗</a></div></div></div>';
}
function srcLinks(a){return (a||[]).map(function(s){return'<a href="'+esc(link(s.u))+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>'}).join("")}

function getJSON(p){return fetch(p+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(p+" "+r.status);return r.json()})}

function loadData(){
  return Promise.all([getJSON("data/feed.json"),getJSON("data/market.json"),getJSON("data/layers.json"),getJSON("data/race.json"),getJSON("data/status.json"),getJSON("data/brief.json").catch(function(){return null}),getJSON("data/sec.json").catch(function(){return null}),getJSON("data/shares.json").catch(function(){return null}),getJSON("data/series.json").catch(function(){return null}),getJSON("data/focus.json").catch(function(){return null}),getJSON("data/en.json").catch(function(){return {}}),getJSON("data/indicators.json").catch(function(){return null}),getJSON("data/outlook.json").catch(function(){return null})]).then(function(r){
    S.feed=(r[0].items||[]).slice().sort(function(a,b){return b.ts.localeCompare(a.ts)});
    S.market=r[1];S.layers=r[2];S.race=r[3];S.status=r[4];S.brief=r[5];S.sec=r[6];S.shares=r[7];S.series=r[8];S.focus=r[9];S.ind=r[11];S.outlook=r[12];if(window.I18N)I18N.extra(r[10]);
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
  setStatus(stale||errs.length?"stale":"ok",(u?"Dernière mise à jour "+ago(u):"Aucune mise à jour")+(S.status&&S.status.mode==="seed"?" · jeu initial":"")+(extra||""),errs.join(" · "));
}
function toast(txt){var t=$("toast");t.textContent=txt;t.classList.add("on");clearTimeout(toast.k);toast.k=setTimeout(function(){t.classList.remove("on")},2200)}
function refresh(){
  if(S.run)return S.run;
  var was=S.status&&S.status.updated_at;$("ptr").classList.add("spin","show");
  S.run=loadData().then(function(){freshness();renderAll();var now=S.status&&S.status.updated_at;toast(was&&now&&now!==was?"Nouvelles données":"Déjà à jour")}).catch(function(e){setStatus("err","Données indisponibles");console.error(e);toast("Échec de l'actualisation")})
  .then(function(){var p=$("ptr");p.classList.remove("spin","show");p.style.transform="";S.run=null});
  return S.run;
}
/* tirer vers le bas depuis le haut de la page = actualiser */
(function(){
  var y0=null,dy=0,p=$("ptr");
  window.addEventListener("touchstart",function(e){y0=(window.scrollY<=0&&e.touches.length===1)?e.touches[0].clientY:null;dy=0},{passive:true});
  window.addEventListener("touchmove",function(e){
    if(y0===null||S.run)return;
    dy=e.touches[0].clientY-y0;
    if(dy<=0){p.classList.remove("show");return}
    var k=Math.min(dy,110);p.classList.add("show");p.style.transform="translate(-50%,"+(k*0.6)+"px) rotate("+(k*3)+"deg)";p.style.opacity=Math.min(1,k/70);
  },{passive:true});
  window.addEventListener("touchend",function(){
    if(y0===null)return;
    var go=dy>=80;y0=null;
    if(go){p.style.opacity="";refresh()}else{p.classList.remove("show");p.style.transform="";p.style.opacity=""}
  },{passive:true});
})();

/* filters */
function byCountry(x){return S.country==="ALL"||x.country===S.country}

/* views */
function storyHTML(it,cls){
  return '<article class="'+(cls||"story")+'"><div class="meta">'+ctag(it.country)+'<span class="cat">'+esc(CATS[it.category]||it.category)+'</span></div>'+
  '<h4>'+esc(tx(it,'title'))+'</h4><p>'+esc(tx(it,'summary'))+'</p><div class="meta"><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(it.source)+'</a><span>'+esc(fmtDay(it.ts).replace(/^\S+\s/,""))+'</span>'+conf(it.confidence)+'</div></article>';
}
function essHTML(it,n){
  return '<article class="e"><span class="n">'+(n<10?"0":"")+n+'</span><div><h3><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(tx(it,'title'))+'</a></h3>'+
   (it.summary?'<p>'+esc(tx(it,'summary'))+'</p>':'')+
   '<div class="meta">'+ctag(it.country)+'<span class="cat">'+esc(CATS[it.category]||it.category)+'</span><span>'+esc(it.source)+'</span>'+conf(it.confidence)+'<span>'+esc(ago(it.ts))+'</span></div></div></article>';
}
function rUne(){
  var el=$("v-une"),byId={};
  S.feed.forEach(function(x){byId[x.id]=x});
  var u=S.status&&S.status.updated_at;
  var F=S.focus,st=((F&&F.stories)||[]).map(function(s){
    var arts=(s.ids||[]).map(function(id){return byId[id]}).filter(Boolean);
    return arts.length?{s:s,arts:arts,ctx:(s.ctx_ids||[]).map(function(id){return byId[id]}).filter(Boolean)}:null;
  }).filter(Boolean);
  var h='<div class="col"><h1 class="page">Aujourd\'hui</h1><div class="stamp"><span>'+esc(fmtDay(u||new Date().toISOString()))+'</span><span>Données '+esc(ago(u))+'</span></div>';
  h+='<section class="focus"><h2>Briefing du jour</h2>';
  if(st.length){
    h+='<ol class="bl">'+st.map(function(x){
      var s=x.s,lead=x.arts[0],en=isEn()&&s.head_en&&s.bullets_en&&s.bullets_en.length===3;
      var head=en?s.head_en:s.head,bl=en?s.bullets_en:s.bullets;
      return'<li><div class="meta">'+ctag(lead.country)+'<span class="cat">'+esc(CATS[lead.category]||lead.category)+'</span><span>'+esc(ago(s.ts||lead.ts))+'</span></div>'+
       '<h3 class="bt">'+esc(head)+'</h3>'+
       '<ul class="b3">'+bl.map(function(b){return'<li>'+esc(b)+'</li>'}).join("")+'</ul>'+
       '<div class="by"><span class="bylab">Sources</span>'+x.arts.map(function(a){return'<a href="'+esc(link(a.url))+'" target="_blank" rel="noopener">'+esc(a.source)+' ↗</a>'}).join("")+x.ctx.map(function(c){return'<a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(fmtD(c.ts))+' · '+esc(c.source)+' ↗</a>'}).join("")+'</div></li>';
    }).join("")+'</ol>';
  }else{
    var top=S.feed.filter(function(x){return!x.pending}).slice().sort(function(a,b){return (b.importance-a.importance)||b.ts.localeCompare(a.ts)}).slice(0,5);
    h+='<p class="small" style="padding:6px 0 0">Le briefing est rédigé par l\'IA à chaque collecte. En attendant, voici les articles les plus importants.</p>'+
      (top.length?'<ol class="bl">'+top.map(function(it){return'<li><div class="meta">'+ctag(it.country)+'<span class="cat">'+esc(CATS[it.category]||it.category)+'</span><span>'+esc(ago(it.ts))+'</span></div><h3 class="bt"><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(tx(it,'title'))+'</a></h3>'+(it.summary?'<ul class="b3"><li>'+esc(tx(it,'summary'))+'</li></ul>':'')+'<div class="by"><span class="bylab">Sources</span><a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">'+esc(it.source)+' ↗</a></div></li>'}).join("")+'</ol>':'<div class="empty">Aucune actualité pour le moment.</div>');
  }
  h+='</section><button class="more" data-go="actualites">Toutes les actualités →</button></div>';
  el.innerHTML=h;
}

function rFeed(){
  var el=$("v-actualites");
  var cats=[["ALL","Toutes"]].concat(Object.keys(CATS).map(function(k){return[k,CATS[k]]}));
  var items=S.feed.filter(byCountry).filter(function(x){return S.cat==="ALL"||x.category===S.cat}).filter(function(x){return!S.top||x.importance>=3});
  var cn=COUNTRIES.filter(function(c){return c[0]===S.country})[0][1],cl=S.cat==="ALL"?"Toutes":CATS[S.cat];
  var panel="";
  if(S.fo==="pays")panel='<div class="fpanel">'+COUNTRIES.map(function(c){return'<button class="chip'+(S.country===c[0]?' on':'')+'" data-c="'+c[0]+'">'+c[1]+'</button>'}).join("")+'</div>';
  if(S.fo==="cat")panel='<div class="fpanel">'+cats.map(function(c){return'<button class="chip'+(S.cat===c[0]?' on':'')+'" data-cat="'+c[0]+'">'+c[1]+'</button>'}).join("")+'</div>';
  var h='<h2 class="sec">Actualités</h2><p class="lede">Les informations collectées, de la plus récente à la plus ancienne. Cliquez sur un titre pour lire l\'article.</p>'+
   '<div class="toolbar frow"><button class="chip fb'+(S.fo==="pays"?' open':'')+(S.country!=="ALL"?' set':'')+'" data-fo="pays">Pays : '+esc(cn)+' <span>▾</span></button><button class="chip fb'+(S.fo==="cat"?' open':'')+(S.cat!=="ALL"?' set':'')+'" data-fo="cat">Catégorie : '+esc(cl)+' <span>▾</span></button><span class="sp"></span><button class="chip'+(S.top?' on':'')+'" data-top="1">Essentiel seulement</button></div>'+panel;
  if(!items.length)h+='<div class="empty">Aucune actualité pour ces filtres.</div>';
  var dayCount={};items.forEach(function(x){var d=x.ts.slice(0,10);dayCount[d]=(dayCount[d]||0)+1});var day="";var total=items.length;items=items.slice(0,S.limit);
  items.forEach(function(it){
    var d=it.ts.slice(0,10);
    if(d!==day){day=d;h+='<div class="day">'+esc(fmtDay(it.ts))+' <span>'+(dayCount[d]||0)+' articles</span></div>'}
    h+=rowHTML(it);
  });
  if(total>items.length)h+='<div style="text-align:center;padding:24px 0"><button class="btn" data-more="1">Voir '+Math.min(120,total-items.length)+' articles de plus ('+(total-items.length)+' restants)</button></div>';
  el.innerHTML=h;
}

function rMarket(){
  var m=S.market,el=$("v-marche");
  var maxUS=250;
  var cu=m.capex_us.map(function(c){
    var lo=c.low/maxUS*100,hi=c.high/maxUS*100;
    var val=c.low===c.high?c.low:c.low+"–"+c.high;
    var fill=c.low===c.high?'<div class="fill" style="width:'+hi+'%"></div>':'<div class="fill" style="width:'+lo+'%"></div><div class="rng" style="left:'+lo+'%;width:'+(hi-lo)+'%"></div>';
    return'<tr><td>'+esc(c.name)+'</td><td><div class="cv">'+val+' Md$</div><div class="track">'+fill+'</div></td><td>'+esc(c.note)+' <a href="'+esc(link(c.url))+'" target="_blank" rel="noopener" class="small">'+esc(c.source)+'</a>, '+esc(c.as_of)+'</td></tr>';
  }).join("");
  var cc=m.capex_cn.map(function(c){return'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.value)+'</td><td>'+esc(c.note)+' <a href="'+esc(link(c.url))+'" target="_blank" rel="noopener" class="small">'+esc(c.source)+'</a></td></tr>'}).join("");
  var rev=m.revenue.slice();
  var maxR=Math.max.apply(null,m.revenue.map(function(r){return r.num}));
  var rv=rev.length?rev.map(function(r){return'<div class="bar"><div class="nm">'+esc(r.name)+'</div><div class="track"><div class="fill'+(r.country==="CN"?' cn':'')+'" style="width:'+Math.max(2,r.num/maxR*100)+'%"></div></div><div class="val">'+esc(r.value)+' Md$</div><div class="nt">'+esc(r.note)+' · <a href="'+esc(link(r.url))+'" target="_blank" rel="noopener">'+esc(r.source)+'</a>, '+esc(r.as_of)+' · '+conf(r.confidence)+'</div></div>'}).join(""):'<div class="empty">Aucune donnée de revenus pour ce pays.</div>';
  var act=m.actors.slice();
  var det='<div class="two"><div class="panel"><span class="kicker">Qui dépense</span><h3>Capex 2026, États-Unis</h3><div class="sub">Guidance annuelle, en milliards de dollars. Zone claire = fourchette.</div><table class="table cx"><colgroup><col style="width:24%"><col style="width:26%"><col></colgroup><thead><tr><th>Société</th><th>Guidance</th><th>Détail</th></tr></thead><tbody>'+cu+'</tbody></table></div>'+
   '<div class="panel"><span class="kicker">Qui dépense</span><h3>Capex, Chine</h3><div class="sub">Montants en yuans, comparables au capex américain à un facteur de 5 à 7 près.</div><table class="table cx"><colgroup><col style="width:24%"><col style="width:26%"><col></colgroup><thead><tr><th>Société</th><th>Montant</th><th>Détail</th></tr></thead><tbody>'+cc+'</tbody></table></div></div>'+
   '<div class="two"><div class="panel"><span class="kicker">Qui gagne</span><h3>Revenus de l\'IA</h3><div class="sub">Run-rate annualisé, en milliards de dollars.</div>'+rv+'</div>'+
   '<div class="note"><b>À lire avant de comparer.</b> '+esc(m.caveat)+'</div></div>'+
   secPanel()+'<hr class="rule thick" style="margin-top:34px"><span class="kicker">Qui compte</span><h3 style="font-family:var(--serif);font-size:22px;margin:2px 0 6px">Principaux acteurs</h3>'+
   (act.length?'<table class="table"><thead><tr><th>Acteur</th><th>Pays</th><th>Rôle</th><th>Repère</th></tr></thead><tbody>'+act.map(function(a){return'<tr><td>'+esc(a.name)+'</td><td>'+ctag(a.country)+'</td><td>'+esc(a.role)+'</td><td>'+esc(a.note)+' <a class="small" href="'+esc(link(a.u))+'" target="_blank" rel="noopener">'+esc(a.src)+'</a></td></tr>'}).join("")+'</tbody></table>':'<div class="empty">Aucun acteur pour ce filtre.</div>');
  el.innerHTML='<h2 class="sec">Marché</h2><p class="lede">Qui dépense, qui gagne de l\'argent, qui compte. Chiffres sourcés ; la date et la source figurent sous chaque donnée.</p>'+
   '<div class="tiles">'+m.tiles.map(function(t){return'<div class="tile"><div class="l">'+esc(t.label)+'</div><div class="v">'+esc(t.value)+'</div><div class="s">'+esc(t.sub)+'</div><div class="src"><a href="'+esc(link(t.u))+'" target="_blank" rel="noopener">'+esc(t.src)+'</a></div></div>'}).join("")+'</div>'+
   sommaire()+etages()+
   '<details class="details" id="m-details"><summary><span>Détails</span><em>Capex annoncé, revenus, dépôts SEC, principaux acteurs</em></summary>'+det+'</details>';
}


function dcol(i,label){return/^(autres?|other)/i.test(label||"")?"var(--cg)":"var(--c"+(Math.min(i,5)+1)+")"}
function fmtPct(v){return String(v).replace(".",",")+" %"}
function donut(segs){
  var tot=segs.reduce(function(a,x){return a+x.pct},0),R=52,r=32,c=60,a0=-Math.PI/2,out="";
  segs.forEach(function(x,i){
    var a1=a0+x.pct/tot*2*Math.PI,big=(a1-a0)>Math.PI?1:0;
    var P=function(rad,a){return(c+rad*Math.cos(a)).toFixed(2)+" "+(c+rad*Math.sin(a)).toFixed(2)};
    var d=segs.length===1?"":"M"+P(R,a0)+" A"+R+" "+R+" 0 "+big+" 1 "+P(R,a1)+" L"+P(r,a1)+" A"+r+" "+r+" 0 "+big+" 0 "+P(r,a0)+" Z";
    out+='<path d="'+d+'" style="fill:'+dcol(i,x.label)+'" stroke="var(--bg)" stroke-width="1.5"><title>'+esc(x.label)+' : '+fmtPct(x.pct)+'</title></path>';
    a0=a1;
  });
  return'<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Camembert">'+out+'</svg>';
}
function shareFresh(c){
  var days=c.checked_at?Math.floor((Date.now()-new Date(c.checked_at).getTime())/86400000):null;
  var t='';
  if(c.check_error||(days!=null&&days>14))t+='<div class="sf small warn">'+(c.check_error?'Dernière relecture impossible : chiffre conservé, à vérifier.':'Non relu depuis '+days+' jours : à vérifier.')+'</div>';
  return t;
}
function shareCard(c){
  var leg=c.segments.map(function(x,i){return'<li><i style="background:'+dcol(i,x.label)+'"></i><span>'+esc(x.label)+'</span><b>'+fmtPct(x.pct)+'</b></li>'}).join("");
  return'<div class="share"><h4>'+esc(c.title)+'</h4><div class="sm">'+esc(c.metric)+' · '+esc(c.period)+'</div>'+
   '<div class="sbody">'+donut(c.segments)+'<ul class="leg">'+leg+'</ul></div>'+
   '<div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a> '+conf(c.confidence)+'</div><div class="fr">'+shareFresh(c)+'</div>'+
   '<details class="why"><summary>Limites</summary><div class="sc">'+esc(c.caveat)+'</div></details></div>';
}
var ETAGES=[
  [1,"Compute","Qui construit et possède la puissance de calcul ?"],
  [2,"Modèles","Qui fabrique les meilleurs modèles, à quel écart, et à quel prix ?"],
  [3,"Adoption","Qui utilise l\'IA : grand public, entreprises, volume d\'usage ?"],
  [4,"Financement et revenus","Combien est investi, qui le finance, et quels revenus en sortent ?"],
  [5,"Perspectives","Ce qui est prévu, ce qui arrive, et les acteurs émergents."]
];
function sommaire(){
  return'<nav class="toc" aria-label="Sommaire du marché"><span class="kicker">Sommaire</span><ol>'+ETAGES.map(function(e){return'<li><a href="#" data-jump="m-e'+e[0]+'"><b>'+e[0]+'</b> '+esc(e[1])+'<span>'+esc(e[2])+'</span></a></li>'}).join("")+
   '<li><a href="#" data-jump="m-details"><b>+</b> Détails<span>Capex annoncé, revenus, dépôts SEC, principaux acteurs</span></a></li></ol></nav>';
}
function capexPie(){
  var d=S.sec;if(!d||!d.companies)return null;
  var cs=d.companies.filter(function(c){return c.capex&&c.capex.value>0});
  if(cs.length<3)return null;
  var tot=cs.reduce(function(a,c){return a+c.capex.value},0),end=cs.reduce(function(a,c){return c.capex.end>a?c.capex.end:a},"");
  var segs=cs.map(function(c){return{label:c.name,pct:Math.round(1000*c.capex.value/tot)/10}}).sort(function(a,b){return b.pct-a.pct});
  return{id:"capex_geants",etage:4,rank:2,title:"Qui dépense le plus en capex",metric:"Part du capex des cinq géants sur les douze derniers mois",period:"Périodes propres à chaque société, jusqu\'à fin "+fmtD(end),segments:segs,source:"SEC (10-K et 10-Q)",url:"https://www.sec.gov/edgar/search/",confidence:"haute",caveat:"Parts calculées entre ces cinq sociétés seulement : ce n\'est pas leur part du capex mondial. Capex déclaré (immobilisations corporelles) ; les exercices sont décalés (Oracle, Microsoft).",auto:true,checked_at:d.updated_at};
}
function piesFor(pred){
  var out={};
  ((S.shares&&S.shares.charts)||[]).forEach(function(c){if(pred(c))out[c.id]=c});
  ((S.series&&S.series.pies)||[]).forEach(function(c){if(pred(c)&&c.segments&&c.segments.length)out[c.id]=c});
  var k=capexPie();if(k&&pred(k))out[k.id]=k;
  return Object.keys(out).map(function(i){return out[i]}).sort(function(a,b){return(a.rank||9)-(b.rank||9)});
}
var DASH=["","6 3","2 3","8 3 2 3","1 2.5"];
function shortUnit(u){return/%/.test(u)?" %":/dollars/.test(u)?" Md$":/H100/.test(u)?" M H100e":/utilisateurs/.test(u)?" M":/FLOP/.test(u)?" FLOP":""}
function fmtVal(c,v){
  if(c.scale==="log"){var e=Math.floor(Math.log10(v)),m=v/Math.pow(10,e);return String(Math.round(m*10)/10).replace(".",",")+"e"+e}
  var n=Math.abs(v)>=100?Math.round(v):Math.round(v*10)/10;
  return n.toLocaleString(loc())+shortUnit(c.unit)
}
function ms(d){return Date.parse(String(d).slice(0,10)+"T00:00:00Z")}
function fmtM(t){return new Date(t).toLocaleDateString(loc(),{month:"short",year:"2-digit",timeZone:"UTC"})}
function lineChart(c){
  var W=340,H=196,L=40,R=10,T=10,B=24,ser=(c.series||[]).filter(function(x){return x.points&&x.points.length});
  if(!ser.length)return'<div class="empty small">Données en cours de collecte.</div>';
  var log=c.scale==="log",all=[];ser.forEach(function(x){x.points.forEach(function(p){all.push(p)})});
  var t0=Math.min.apply(null,all.map(function(p){return ms(p.d)})),t1=Math.max.apply(null,all.map(function(p){return ms(p.d)}));
  if(t1===t0)t1=t0+86400000*30;
  var vmax=Math.max.apply(null,all.map(function(p){return p.v})),vmin=log?Math.min.apply(null,all.map(function(p){return p.v})):0,y0,y1,ticks=[];
  if(log){y0=Math.floor(Math.log10(vmin));y1=Math.ceil(Math.log10(vmax));if(y1-y0<2)y1=y0+2;var st=Math.ceil((y1-y0)/4);for(var e=y0;e<=y1;e+=st)ticks.push(e)}
  else{var raw=vmax*1.05,mag=Math.pow(10,Math.floor(Math.log10(raw))),cand=[];[mag/10,mag].forEach(function(b){[1,2,2.5,5].forEach(function(k){cand.push(k*b)})});cand.push(mag*10);var stp=cand.filter(function(k){return raw/k<=5})[0]||mag*10;y1=Math.ceil(raw/stp)*stp;y0=0;for(var v=0;v<=y1+1e-9;v+=stp)ticks.push(v)}
  var X=function(t){return L+(t-t0)/(t1-t0)*(W-L-R)},Y=function(v){var q=log?(Math.log10(v)-y0)/(y1-y0):(v-y0)/(y1-y0);return T+(1-q)*(H-T-B)};
  var g='';
  ticks.forEach(function(k){var yy=Y(log?Math.pow(10,k):k).toFixed(1);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" class="gl"/><text x="'+(L-5)+'" y="'+(+yy+3)+'" text-anchor="end" class="ax">'+(log?'1e'+k:(k>=1000?k.toLocaleString("fr-FR"):String(k).replace(".",",")))+'</text>'});
  var xt=[],span=t1-t0,yrsSpan=span/(365.25*86400000),stepM=yrsSpan<=1.3?3:(yrsSpan<=3.3?6:(yrsSpan<=7?12:24));
  var mm0=new Date(t0).getUTCFullYear()*12+new Date(t0).getUTCMonth();
  for(var mm=Math.ceil((mm0+1)/stepM)*stepM;;mm+=stepM){var tt=Date.UTC(Math.floor(mm/12),mm%12,1);if(tt>t1)break;xt.push([tt,stepM>=12?String(Math.floor(mm/12)):fmtM(tt)])}
  xt.forEach(function(x){var xx=X(x[0]).toFixed(1);g+='<line x1="'+xx+'" x2="'+xx+'" y1="'+(H-B)+'" y2="'+(H-B+3)+'" class="gl2"/><text x="'+xx+'" y="'+(H-6)+'" text-anchor="middle" class="ax">'+esc(x[1])+'</text>'});
  var col=function(i){return"var(--c"+(Math.min(i,5)+1)+")"};
  ser.forEach(function(x,i){
    var pts=x.points.slice().sort(function(a,b){return ms(a.d)-ms(b.d)}),d="";
    pts.forEach(function(p,k){var px=X(ms(p.d)).toFixed(1),py=Y(p.v).toFixed(1);d+=(k?(x.step?'H'+px+'V'+py:'L'+px+' '+py):'M'+px+' '+py)});
    if(x.step&&pts.length){d+='H'+(W-R)}
    g+='<path d="'+d+'" fill="none" style="stroke:'+col(i)+'" stroke-width="1.7" stroke-linejoin="round"'+((x.dashed?"4 3":DASH[i])?' stroke-dasharray="'+(x.dashed?"4 3":DASH[i])+'"':'')+'/>';
    var dots=pts.length<=12;
    pts.forEach(function(p,k){if(dots||k===pts.length-1){g+='<circle cx="'+X(ms(p.d)).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="'+(k===pts.length-1?2.8:2)+'" style="fill:'+col(i)+'"><title>'+esc(x.name+(p.name?" — "+p.name:"")+" · "+fmtD(p.d)+" : "+fmtVal(c,p.v)+(p.src?" ("+p.src+")":""))+'</title></circle>'}});
  });
  var leg=ser.map(function(x,i){
    var last=x.points.slice().sort(function(a,b){return ms(a.d)-ms(b.d)}).pop(),ds=x.dashed?"4 3":DASH[i];
    return'<li><svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true"><path d="M0 4H22" style="stroke:'+col(i)+'" stroke-width="2"'+(ds?' stroke-dasharray="'+ds+'"':'')+' fill="none"/></svg><span>'+esc(x.name)+'</span><b>'+esc(fmtVal(c,last.v))+'</b>'+deltaChip(c,x)+'</li>'}).join("");
  return'<svg class="lc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title)+'">'+g+'</svg><ul class="leg lg">'+leg+'</ul>';
}
function deltaChip(c,x){
  var p=x.points.slice().sort(function(a,b){return ms(a.d)-ms(b.d)});
  if(p.length<2)return'<em class="dl"></em>';
  var a=p[p.length-2].v,b=p[p.length-1].v,t;
  if(!(a>0)||a===b)return'<em class="dl"></em>';
  if(c.scale==="log")t="×"+String(Math.round(b/a*10)/10).replace(".",",");
  else if(/%/.test(c.unit||""))t=String(Math.abs(Math.round((b-a)*10)/10)).replace(".",",")+" pt";
  else t=String(Math.abs(Math.round((b/a-1)*100)))+" %";
  if(t==="0 pt"||t==="0 %")return'<em class="dl"></em>';
  return'<em class="dl '+(b>a?"up":"dn")+'" title="Variation depuis le point précédent">'+(b>a?"▲ ":"▼ ")+t+'</em>';
}
function curveFresh(c){
  var all=[];(c.series||[]).forEach(function(x){(x.points||[]).forEach(function(p){all.push(p.d)})});
  var last=all.sort().pop(),t='';
  if(c.auto){
    var days=c.checked_at?Math.floor((Date.now()-new Date(c.checked_at).getTime())/86400000):null;
    t=last?'<div class="sf small">Dernier point : '+esc(fmtD(last))+'</div>':'';
    if(c.check_error||(days!=null&&days>14))t+='<div class="sf small warn">'+(c.check_error?'Dernière relecture impossible : courbe conservée, à vérifier.':'Non relu depuis '+days+' jours : à vérifier.')+'</div>';
  }else{
    var age=last?Math.floor((Date.now()-ms(last))/86400000):null;
    t=last?'<div class="sf small">Dernier point : '+esc(fmtD(last))+'</div>':'';
    if(age!=null&&age>120)t+='<div class="sf small warn">Dernier point vieux de '+age+' jours : à actualiser.</div>';
  }
  return t;
}
function pointList(c){
  if(c.auto)return"";
  var rows=[];(c.series||[]).forEach(function(x){(x.points||[]).slice().sort(function(a,b){return ms(a.d)-ms(b.d)}).forEach(function(p){rows.push('<li><b>'+esc(x.name)+'</b> · '+esc(fmtD(p.d))+' : '+esc(fmtVal(c,p.v))+' · '+(p.url?'<a href="'+esc(link(p.url))+'" target="_blank" rel="noopener">'+esc(p.src||"source")+' ↗</a>':esc(p.src||""))+'</li>')})});
  return rows.length?'<ul class="pl">'+rows.join("")+'</ul>':"";
}
function curveCard(c){
  return'<div class="share curve"><h4>'+esc(c.title)+'</h4><div class="sm">'+esc(c.unit)+'</div><div class="lcw">'+lineChart(c)+'</div>'+
   '<div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a></div><div class="fr">'+curveFresh(c)+'</div>'+
   '<details class="why"><summary>Limites'+(c.auto?'':' et points sourcés')+'</summary><div class="sc">'+esc(c.caveat)+'</div>'+pointList(c)+'</details></div>';
}
function statCard(c){
  return'<div class="share stat1"><h4>'+esc(c.title)+'</h4><div class="bigv">'+esc(c.value)+'</div><div class="sm2">'+esc(c.sub)+'</div>'+
   '<div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a> '+conf(c.confidence)+'</div><div class="fr"><span class="small">'+esc(c.as_of)+'</span></div>'+
   (c.caveat?'<details class="why"><summary>Limites</summary><div class="sc">'+esc(c.caveat)+'</div></details>':'')+'</div>';
}
function nvidiaShare(){
  var p=((S.series&&S.series.pies)||[]).filter(function(x){return x.id==="designers"})[0];if(!p)return null;
  var seg=(p.segments||[]).filter(function(x){return x.label==="Nvidia"})[0];return seg?{pct:seg.pct,period:p.period}:null;
}
function riskCard(r){
  var v=r.value;
  if(r.id==="nvidia"){var n=nvidiaShare();if(!n)return"";v="≈ "+fmtPct(Math.round(n.pct))+" du compute vendu"}
  return'<div class="share stat1"><h4>'+esc(r.title)+'</h4><div class="bigv">'+esc(v)+'</div><div class="sm2">'+esc(r.sub)+'</div><div class="sf"><a href="'+esc(link(r.url))+'" target="_blank" rel="noopener">'+esc(r.source)+' ↗</a></div><div class="fr"><span class="small">'+esc(r.as_of)+'</span></div></div>';
}
function actorCard(a){
  return'<div class="actor"><div class="ah"><h4>'+esc(a.name)+'</h4><span class="mode">'+esc(a.tag)+'</span></div>'+
   '<dl><dt>Ce que c\'est</dt><dd>'+esc(a.what)+'</dd><dt>Pourquoi ça compte</dt><dd>'+esc(a.why)+'</dd><dt>Dernier chiffre</dt><dd>'+esc(a.last)+'</dd><dt class="rk">Risque principal</dt><dd class="rk">'+esc(a.risk)+'</dd></dl>'+
   '<div class="srcs">'+srcLinks(a.sources)+'</div><div class="fr"><span class="small">'+esc(a.as_of)+'</span></div></div>';
}
function outlookHTML(){
  var o=S.outlook;if(!o)return'<div class="empty small">Perspectives indisponibles.</div>';
  var today=new Date().toISOString().slice(0,10),h='<div class="note"><b>Règle.</b> '+esc(o.rule)+'</div>';
  h+='<div class="sgroup">Capex 2027 prévu <em>fourchette d\'analystes, pas des engagements</em></div><div class="cards3">'+
   o.capex2027.map(function(c){return'<div class="share stat1"><h4>'+esc(c.name)+'</h4><div class="bigv">'+esc(c.value)+'</div><div class="sm2">'+esc(c.scope)+'</div><div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a></div><div class="fr"><span class="small">'+esc(c.as_of)+'</span></div></div>'}).join("")+
   (o.gw?statCard({title:o.gw.title,value:o.gw.value,sub:o.gw.sub,as_of:o.gw.as_of,source:o.gw.source,url:o.gw.url,confidence:"moyenne",caveat:o.gw.caveat}):"")+'</div><p class="small mute" style="margin:8px 0 0">'+esc(o.capex_note)+'</p>';
  var cat=(o.catalysts||[]).filter(function(c){return c.date>=new Date(Date.now()-2*86400000).toISOString().slice(0,10)});
  if(cat.length)h+='<div class="sgroup">Prochains catalyseurs <em>seulement les dates publiées</em></div><ul class="cats">'+cat.map(function(c){return'<li><div class="cd">'+esc(c.label)+(c.date===today?' · aujourd\'hui':'')+'</div><div><b>'+esc(c.title)+'</b><p>'+esc(c.detail)+'</p><span class="small mute">'+esc(c.status)+' · </span><span class="srcs inl">'+srcLinks(c.sources)+'</span></div></li>'}).join("")+'</ul><p class="small mute" style="margin:8px 0 0">'+esc(o.catalysts_note)+'</p>';
  h+='<div class="sgroup">Acteurs émergents <em>une fiche courte chacun</em></div><div class="actors">'+(o.actors||[]).map(actorCard).join("")+'</div>';
  var rk=(o.risks||[]).map(riskCard).join("");
  if(rk)h+='<div class="sgroup">Trois indicateurs de risque <em>'+esc(o.risks_note)+'</em></div><div class="cards3">'+rk+'</div>';
  return h;
}
function etages(){
  return ETAGES.map(function(e){
    var pies=piesFor(function(c){return c.etage===e[0]}),cur=((S.series&&S.series.curves)||[]).filter(function(c){return c.etage===e[0]}).sort(function(a,b){return(a.rank||9)-(b.rank||9)}),
        st=((S.ind&&S.ind.stats)||[]).filter(function(c){return c.etage===e[0]}).sort(function(a,b){return(a.rank||9)-(b.rank||9)});
    var h='<section class="etage" id="m-e'+e[0]+'"><span class="kicker">Étage '+e[0]+' sur '+ETAGES.length+'</span><h3 class="sub2">'+esc(e[1])+'</h3><p class="lede" style="margin-bottom:0">'+esc(e[2])+'</p>';
    if(e[0]===5)return h+outlookHTML()+'</section>';
    if(pies.length)h+='<div class="sgroup">Qui domine <em>parts de marché, chaque camembert est une mesure différente</em></div><div class="cards3">'+pies.map(shareCard).join("")+'</div>';
    if(st.length)h+='<div class="sgroup">Chiffres clés <em>une mesure par carte, datée et sourcée</em></div><div class="cards3">'+st.map(statCard).join("")+'</div>';
    if(cur.length)h+='<div class="sgroup">Comment ça évolue <em>courbes dans le temps</em></div><div class="cards3">'+cur.map(curveCard).join("")+'</div>';
    if(!pies.length&&!st.length&&!cur.length)h+='<div class="empty small">Données en cours de collecte.</div>';
    return h+'</section>';
  }).join("");
}
function sharesRace(){
  var cs=piesFor(function(c){return c.tab==="usachine"});
  return cs.length?'<hr class="rule thick" style="margin-top:34px"><span class="kicker">Qui domine</span><h3 class="sub2" style="margin-top:2px">Parts de marché : où est le compute, qui fabrique</h3><div class="cards3">'+cs.map(shareCard).join("")+'</div>':"";
}
function fmtD(iso){return new Date(String(iso).slice(0,10)+"T00:00:00Z").toLocaleDateString(loc(),{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}
function mdUsd(v){return (v/1e9).toFixed(1).replace(".",",")+" Md$"}
function secCell(m){
  if(!m)return '<td><span class="small">indisponible</span></td>';
  var days=Math.floor((Date.now()-new Date(m.fetched_at).getTime())/86400000),stale=days>30;
  return '<td><div class="sv">'+mdUsd(m.value)+'</div><div class="small">'+(m.basis==="ttm"?'12 mois à fin '+esc(fmtD(m.end)):'dernier exercice clos le '+esc(fmtD(m.end))+' (12 mois comparables indisponibles)')+'</div>'+
   '<div class="small"><a href="'+esc(link(m.url))+'" target="_blank" rel="noopener">'+esc(m.form)+' déposé le '+esc(fmtD(m.filed))+' ↗</a></div>'+
   (stale?'<div class="small warn">Non relu depuis '+days+' jours : à vérifier</div>':'')+'</td>';
}
function secPanel(){
  var d=S.sec;if(!d||!d.companies||!d.companies.length)return"";
  var rows=d.companies.map(function(c){
    var ratio=c.capex&&c.revenue&&c.capex.end===c.revenue.end&&c.capex.basis===c.revenue.basis?Math.round(100*c.capex.value/c.revenue.value)+" %":"–";
    return '<tr><td>'+esc(c.name)+'</td>'+secCell(c.capex)+secCell(c.revenue)+'<td class="sv">'+ratio+'</td></tr>';
  }).join("");
  return '<h3 class="sub2">Réalisé : ce que les géants ont déjà dépensé</h3><p class="lede" style="margin-bottom:6px">Capex et revenus des 12 derniers mois, lus automatiquement dans les dépôts officiels à la SEC (10-K et 10-Q). Aucun chiffre n\'est estimé : chacun porte sa période, sa date de dépôt et son lien.</p>'+
   '<table class="table sec"><thead><tr><th>Société</th><th>Capex</th><th>Revenus</th><th>Capex / revenus</th></tr></thead><tbody>'+rows+'</tbody></table>'+
   '<div class="note"><b>À lire avant de comparer.</b> Le capex est la sortie de trésorerie pour immobilisations corporelles telle que déclarée dans les données XBRL ; il n\'inclut pas toujours les contrats de location-financement, d\'où un écart possible avec les guidances ci-dessus. Les exercices sont décalés : Oracle (mai), Microsoft (juin) ; les périodes affichées sont donc propres à chaque société.</div>';
}
function meter(t){
  var cls=t>=8?"hi":(t>=6?"mid":"lo");
  var s='';for(var i=1;i<=10;i++)s+='<i class="'+(i<=t?'f':'')+'"></i>';
  return'<div class="meter '+cls+'">'+s+'</div>';
}
function layerTrend(l){
  var h=(l.history||[]).slice().sort(function(a,b){return a.d.localeCompare(b.d)});
  if(l.tension==null||h.length<2)return"";
  var last=h[h.length-1],prev=null,i;
  for(i=h.length-2;i>=0;i--){if((new Date(last.d)-new Date(h[i].d))>=6*86400000){prev=h[i];break}}
  if(!prev)return"";
  var dlt=l.tension-prev.t,cls=dlt>0?"up":(dlt<0?"down":"flat"),sym=dlt>0?"▲":(dlt<0?"▼":"→");
  return'<span class="trend '+cls+'" title="Tension le '+esc(fmtD(prev.d))+' : '+prev.t+'/10">'+sym+' '+(dlt>0?"+":"")+dlt+' depuis le '+esc(fmtD(prev.d))+'</span>';
}
function layerMeter(l){
  if(l.tension==null)return'<span class="mlabel"><span>Tension</span><span class="tv emerging">'+esc(l.tension_label)+'</span></span>';
  return meter(l.tension)+'<span class="mlabel"><span>Tension</span><span class="tv '+(l.tension>=8?"hi":(l.tension>=6?"mid":"lo"))+'">'+esc(l.tension_label)+' · '+l.tension+'/10</span></span>'+layerTrend(l);
}
function layerExtra(l){
  var h="";
  if(l.capacity)h+='<div class="lcap"><span class="kicker">Capacité</span> '+esc(l.capacity.value)+' <span class="small mute">('+esc(l.capacity.as_of)+', <a href="'+esc(link(l.capacity.url))+'" target="_blank" rel="noopener">'+esc(l.capacity.source)+'</a>)</span></div>';
  if(l.unlock)h+='<div class="lcap"><span class="kicker">Ce qui débloquerait</span> '+esc(l.unlock.text)+' <span class="small mute">(<a href="'+esc(link(l.unlock.url))+'" target="_blank" rel="noopener">'+esc(l.unlock.source)+'</a>)</span></div>';
  return h;
}
function rInfra(){
  var L=S.layers.layers.slice();
  if(S.layerSort==="tension")L.sort(function(a,b){return(b.tension==null?-1:b.tension)-(a.tension==null?-1:a.tension)});else L.sort(function(a,b){return a.order-b.order});
  var el=$("v-infrastructure");
  el.innerHTML='<h2 class="sec">Infrastructure</h2><p class="lede">La pile de l\'IA, des applications à l\'énergie. Pour chaque couche : qui domine, où ça coince, et à quel point (tension de 0 à 10, estimation éditoriale).</p><div class="tleg"><span><i class="hi"></i>Critique (8 à 10)</span><span><i class="mid"></i>Élevé (6 à 7)</span><span><i class="lo"></i>Modéré ou faible (0 à 5)</span></div>'+
   '<div class="toolbar"><button class="chip'+(S.layerSort==="pile"?' on':'')+'" data-ls="pile">Ordre de la pile</button><button class="chip'+(S.layerSort==="tension"?' on':'')+'" data-ls="tension">Par tension</button></div><div class="stack">'+
   L.map(function(l){
     var open=S.open["l"+l.id]?" open":"";
     return'<div class="layer'+open+'"><button class="lhead" data-toggle="l'+esc(l.id)+'"><span class="lnum">'+l.order+'</span><span class="lname">'+esc(l.name)+'</span><span class="lstat">'+esc(l.key_stat)+'</span><span class="lm">'+layerMeter(l)+'</span><span class="chev">›</span></button>'+
      '<div class="lbody"><div class="leaders">'+l.leaders.map(function(x){return'<span class="leader c-'+esc(x.c)+'">'+esc(x.n)+'</span>'}).join("")+'</div><p>'+esc(l.note)+'</p>'+layerExtra(l)+'<div class="srcs">'+srcLinks(l.sources)+'</div></div></div>';
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
   raceRows(false)+'<div class="note"><b>Méthode.</b> '+esc(S.race.method)+'</div>'+sharesRace();
}

function health(){
  var lr=S.status&&S.status.last_run;if(!lr||!lr.sources)return"";
  var ok=lr.sources.filter(function(x){return x.ok}),ko=lr.sources.filter(function(x){return!x.ok});
  var kinds={};lr.sources.forEach(function(x){var k=kinds[x.kind]||(kinds[x.kind]={ok:0,ko:0,n:0});x.ok?k.ok++:k.ko++;k.n+=x.n});
  var lab={rss:"Flux RSS",googlenews:"Google News",gdelt:"GDELT",newsdata:"NewsData.io",hn:"Hacker News",hf:"Hugging Face",arxiv:"arXiv",edgar:"SEC EDGAR",fedreg:"Federal Register"};
  return'<hr class="rule thick" style="margin-top:34px"><span class="kicker">Santé de la collecte</span><p class="lede" style="margin:6px 0 14px">Dernier passage : '+esc(ago(lr.started_at))+', '+lr.duration_s+' s · '+ok.length+' sources sur '+lr.sources.length+' répondent · '+lr.added+' articles ajoutés'+(lr.model?' · classement par '+esc(lr.model):'')+'.</p>'+
   (lr.errors&&lr.errors.length?'<div class="note" style="margin:0 0 16px"><b>Alertes.</b> '+lr.errors.map(esc).join(' · ')+'</div>':'')+
   '<table class="table"><thead><tr><th>Type</th><th>Sources actives</th><th>Articles bruts</th></tr></thead><tbody>'+Object.keys(kinds).map(function(k){var x=kinds[k];return'<tr><td>'+esc(lab[k]||k)+'</td><td>'+x.ok+' / '+(x.ok+x.ko)+'</td><td>'+x.n+'</td></tr>'}).join("")+'</tbody></table>'+
   (lr.yield&&lr.yield.length?'<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Rendement par source : articles gardés / écartés par l\'IA</summary><table class="table" style="margin-top:8px"><thead><tr><th>Source</th><th>Gardés</th><th>Écartés</th><th>Part gardée</th></tr></thead><tbody>'+lr.yield.map(function(y){var t=y.k+y.r;return'<tr><td>'+esc(y.name)+'</td><td>'+y.k+'</td><td>'+y.r+'</td><td>'+(t?Math.round(100*y.k/t)+' %':'–')+'</td></tr>'}).join("")+'</tbody></table></details>':'')+
   (lr.rejected_samples&&lr.rejected_samples.length?'<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Exemples d\'articles écartés ('+lr.rejected_samples.length+' derniers)</summary><div class="small" style="padding:8px 0">'+lr.rejected_samples.map(function(x){return esc(x.ti)+' <span style="color:var(--mute)">— '+esc(x.s)+(x.r?' · '+esc(x.r):'')+'</span>'}).join('<br>')+'</div></details>':'')+
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
   '<div class="method"><div><span class="kicker">Fonctionnement</span><ol class="steps"><li><b>Collecte</b><span>Un agent récupère toutes les trois heures les flux de médias et de sources officielles, dans le monde. Seuls les domaines d\'une liste de confiance sont retenus.</span></li><li><b>Classement</b><span>Chaque article reçoit un pays, un thème, une importance de 1 à 3, une couche de la pile et un résumé en français. Sans IA disponible, le titre d\'origine est publié tel quel.</span></li><li><b>Les 10 essentiels et le brief</b><span>Sélection par importance, fraîcheur, source primaire et nombre de médias qui couvrent le sujet, avec un minimum de diversité par zone et par couche. Le brief en 5 puces est rédigé par l\'IA à partir de ces seuls articles ; une puce dont les chiffres ne figurent pas dans ses sources est écartée.</span></li><li><b>Publication</b><span>Les données sont enregistrées dans le dépôt GitHub puis affichées ici. À chaque ouverture, et via « Actualiser », le site affiche immédiatement les dernières données publiées ; il ne lance aucune collecte.</span></li></ol></div>'+
   '<div><span class="kicker">Lire avec prudence</span><ol class="steps"><li><b>Sources</b><span>Source primaire : document officiel (SEC, registre fédéral, communiqué, blog d\'une entreprise). Presse : média figurant sur une liste de confiance. Les newsletters, blogs personnels et sites de recopie sont écartés.</span></li><li><b>Estimations</b><span>Les scores USA–Chine et les tensions des couches sont des estimations éditoriales, pas des mesures.</span></li><li><b>Run-rates</b><span>Les revenus des laboratoires privés ne sont pas audités et ne sont pas calculés de la même façon.</span></li><li><b>Chiffres de la SEC</b><span>Capex et revenus des cinq géants américains sont relus automatiquement dans les dépôts officiels. Au-delà de 30 jours sans relecture, une alerte s\'affiche. Le reste de la page Marché reste saisi à la main.</span></li><li><b>Revue hebdomadaire</b><span>Chaque lundi, le robot relit les pages saisies à la main à la lumière des articles collectés et propose des mises à jour sourcées. Rien ne change sans validation du propriétaire du site.</span></li><li><b>Parts de marché</b><span>Le HBM (Counterpoint), les fonderies (TrendForce), les propriétaires du compute et les concepteurs de puces (Epoch AI) sont relus automatiquement à la source. Si la page ou le fichier change et que la lecture échoue, l\'ancien chiffre reste affiché avec sa date et une alerte apparaît. Les autres camemberts sont mis à jour à la main.</span></li><li><b>Évolution</b><span>Les courbes marquées « auto » (capex des géants à la SEC, compute vendu et records d\'entraînement chez Epoch AI, parts HBM chez Counterpoint, adoption en entreprise au Census Bureau) sont relues à chaque collecte, avec les mêmes garde-fous. Les courbes « semi-auto » (utilisateurs, trafic web, revenu annualisé) n\'ont pas de source lisible par un robot : la revue du lundi propose de nouveaux points avec leur source, et rien n\'est ajouté sans validation. Chaque point est daté et sourcé.</span></li></ol></div></div>'+
   health()+
   '<hr class="rule thick" style="margin-top:34px"><span class="kicker">Sources citées ('+list.length+')</span><div class="src-list">'+list.map(function(s){return'<a href="'+esc(link(s[1]))+'" target="_blank" rel="noopener">'+esc(s[0])+' ↗</a>'}).join("")+'</div>';
}

function renderAll(){
  if(!S.market)return;
  rUne();rFeed();rMarket();rInfra();rRace();rMethod();
}
function show(tab){
  if(TABS.indexOf(tab)<0)tab="une";
  S.tab=tab;
  TABS.forEach(function(t){$("v-"+t).classList.toggle("on",t===tab)});
  [].forEach.call(document.querySelectorAll(".tab"),function(b){b.classList.toggle("on",b.getAttribute("data-tab")===tab)});
  window.scrollTo(0,0);
}
function go(tab){if(location.hash!=="#"+tab)location.hash=tab;else show(tab)}

function setLang(l){
  S.lang=l==="en"?"en":"fr";
  try{localStorage.setItem("lang",S.lang)}catch(e){}
  if(window.I18N)I18N.set(S.lang);
  [].forEach.call(document.querySelectorAll("[data-lang]"),function(b){b.classList.toggle("on",b.getAttribute("data-lang")===S.lang)});
  if(S.market){freshness();renderAll()}
}
document.addEventListener("click",function(e){
  var lg=e.target.closest("[data-lang]");if(lg){setLang(lg.getAttribute("data-lang"));return}
  var j=e.target.closest("[data-jump]");
  if(j){e.preventDefault();var id=j.getAttribute("data-jump"),el=$(id);if(el){if(el.tagName==="DETAILS")el.open=true;el.scrollIntoView({behavior:"smooth",block:"start"})}return}
  var t=e.target.closest("[data-tab],[data-fo],[data-c],[data-cat],[data-top],[data-ls],[data-toggle],[data-go],[data-more]");if(!t)return;
  if(t.hasAttribute("data-tab"))return go(t.getAttribute("data-tab"));
  if(t.hasAttribute("data-go"))return go(t.getAttribute("data-go"));
  if(t.hasAttribute("data-more")){S.limit+=120;rFeed();return}
  if(t.hasAttribute("data-fo")){var f=t.getAttribute("data-fo");S.fo=S.fo===f?null:f;rFeed();return}
  if(t.hasAttribute("data-c")){S.country=t.getAttribute("data-c");S.limit=120;S.fo=null;renderAll();return}
  if(t.hasAttribute("data-cat")){S.cat=t.getAttribute("data-cat");S.limit=120;S.fo=null;renderAll();return}
  if(t.hasAttribute("data-top")){S.top=!S.top;S.limit=120;renderAll();return}
  if(t.hasAttribute("data-ls")){S.layerSort=t.getAttribute("data-ls");renderAll();return}
  if(t.hasAttribute("data-toggle")){var k=t.getAttribute("data-toggle");S.open[k]=!S.open[k];t.parentNode.classList.toggle("open",!!S.open[k])}
});
window.addEventListener("hashchange",function(){show(location.hash.slice(1))});
setLang(S.lang);
show(location.hash.slice(1));
refresh();
})();
