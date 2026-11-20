(function(){
"use strict";
var COUNTRIES=[["ALL","Tous"],["US","États-Unis"],["CN","Chine"],["EU","Europe"],["GULF","Golfe"],["OTHER","Autres"]];
var CLABEL={US:"États-Unis",CN:"Chine",EU:"Europe",GULF:"Golfe",OTHER:"Autres",UK:"Royaume-Uni"};
var CATS={modeles:"Modèles",puces:"Puces",energie:"Énergie",capex:"Finance",politique:"Politique",regul:"Régulation",adoption:"Adoption",recherche:"Recherche"};
var TABS=["une","actualites","marche","infrastructure","carte","acteurs","methode"];
var S={lang:"fr",feed:[],brief:null,sec:null,market:null,layers:null,race:null,status:null,country:"ALL",cat:"ALL",top:false,tab:"une",layerSort:"pile",open:{},limit:120,run:null,fo:null,focus:null,figs:null,acteurs:null,voix:null,vc:"ALL",vv:"flux",vfo:null,vq:"",ve:false,vlimit:80,actor:null,aq:"",ab:"ALL",arv:false};

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
function fmtDay(iso){return new Date(iso).toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function dayKey(iso){return new Date(iso).toLocaleDateString("sv-SE")}
function fmtTime(iso){return new Date(iso).toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit"})}
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
   '<div class="sum">'+(it.pending?'<p><i class="small">(titre d\'origine, non classé par l\'IA)</i></p>':'')+'<div class="meta"><span class="cat">'+esc(CATS[it.category]||it.category)+'</span>'+(it.layer?'<span>'+esc(it.layer)+'</span>':'')+imp(it.importance)+conf(it.confidence)+'<a href="'+esc(link(it.url))+'" target="_blank" rel="noopener">Lire sur '+esc(it.source)+' ↗</a></div></div></div>';
}
function srcLinks(a){return (a||[]).map(function(s){return'<a href="'+esc(link(s.u))+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>'}).join("")}

function getJSON(p){return fetch(p+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(p+" "+r.status);return r.json()})}

function loadData(){
  return Promise.all([getJSON("data/feed.json"),getJSON("data/market.json"),getJSON("data/layers.json"),getJSON("data/race.json"),getJSON("data/status.json"),getJSON("data/brief.json").catch(function(){return null}),getJSON("data/sec.json").catch(function(){return null}),getJSON("data/shares.json").catch(function(){return null}),getJSON("data/series.json").catch(function(){return null}),getJSON("data/focus.json").catch(function(){return null}),getJSON("data/en.json").catch(function(){return {}}),getJSON("data/indicators.json").catch(function(){return null}),getJSON("data/outlook.json").catch(function(){return null}),getJSON("data/chiffres.json").catch(function(){return null}),getJSON("data/acteurs.json").catch(function(){return null}),getJSON("data/voix.json").catch(function(){return null})]).then(function(r){
    S.feed=(r[0].items||[]).slice().sort(function(a,b){return b.ts.localeCompare(a.ts)});
    S.market=r[1];S.layers=r[2];S.race=r[3];S.status=r[4];S.brief=r[5];S.sec=r[6];S.shares=r[7];S.series=r[8];S.focus=r[9];S.ind=r[11];S.outlook=r[12];S.figs=r[13];S.acteurs=r[14];S.voix=r[15];if(window.I18N)I18N.extra(r[10]);
  });
}
function setStatus(kind,txt,title){
  var cls=kind==="ok"?"":(kind==="err"?"err":"stale");
  $("status").innerHTML=kind==="ok"?"":'<span class="dot '+cls+'"></span>';
  $("status").title=kind==="ok"?"":(txt+(title?" · "+title:""));
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
var ARW='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
function arrowA(href,label,ext){return'<a class="arw" href="'+esc(href)+'"'+(ext?' target="_blank" rel="noopener"':'')+' aria-label="'+esc(label)+'">'+ARW+'</a>'}
function tHead(eb,ttl){return'<div class="thead"><span class="eb">'+esc(eb)+'</span><h2>'+esc(ttl)+'</h2></div>'}
function cta(go,label){return'<div class="tcta"><button class="pill" data-go="'+esc(go)+'">'+esc(label)+'</button></div>'}
function rUne(){
  var el=$("v-une"),byId={};
  S.feed.forEach(function(x){byId[x.id]=x});
  var u=S.status&&S.status.updated_at,en=isEn();
  var F=S.focus,st=((F&&F.stories)||[]).map(function(s){
    var arts=(s.ids||[]).map(function(id){return byId[id]}).filter(Boolean);
    return arts.length?{s:s,arts:arts}:null;
  }).filter(Boolean).slice(0,3);
  if(!st.length)st=S.feed.filter(function(x){return!x.pending}).slice().sort(function(a,b){return (b.importance-a.importance)||b.ts.localeCompare(a.ts)}).slice(0,3).map(function(it){return{s:{head:tx(it,'title'),bullets:it.summary?[tx(it,'summary')]:[]},arts:[it]}});
  var h='<section class="hero"><span class="hdate">'+esc(fmtDay(u||new Date().toISOString()))+'</span><h1>'+(en?'AI, today.':'L’IA, aujourd’hui.')+'</h1><p>'+(en?'What happened, who said it, and what the numbers say.':'Ce qui s’est passé, qui l’a dit, et ce que disent les chiffres.')+'</p></section>';
  h+='<section class="tile">'+tHead(en?'Top stories':'La une',en?'The three stories of the day.':'Les trois histoires du jour.')+'<div class="tgrid3">'+st.map(function(x,i){
    var s=x.s,lead=x.arts[0],ok=en&&s.head_en&&s.bullets_en&&s.bullets_en.length===(s.bullets||[]).length;
    var head=ok?s.head_en:s.head,bl=(ok?s.bullets_en:s.bullets)||[];
    return'<article class="tcard"><span class="kick">0'+(i+1)+' · '+esc(CLABEL[lead.country]||lead.country)+' · '+esc(CATS[lead.category]||lead.category)+'</span><h3>'+esc(head)+'</h3>'+(bl[0]?'<p>'+esc(bl[0])+'</p>':'')+
     '<div class="tfoot"><span>'+esc(x.arts.slice(0,3).map(function(a){return a.source}).join(", "))+' · '+esc(ago(s.ts||lead.ts))+'</span>'+arrowA(link(lead.url),en?'Read':'Lire l’histoire',true)+'</div></article>';
  }).join("")+'</div>'+cta("actualites",en?'All news':'Toutes les actualités')+'</section>';
  var H=((S.voix&&S.voix.hot)||[]).slice(0,3);
  if(H.length)h+='<section class="tile dark">'+tHead('Insiders',en?'What they say.':'Ce qu’ils disent.')+'<div class="tgrid3">'+H.map(function(n){
    return'<figure class="tcard q"><blockquote>« '+esc(!en&&n.title_fr?n.title_fr:n.title)+' »</blockquote><figcaption class="tfoot"><span class="who"><b>'+esc(n.n)+'</b><span>'+esc(n.role)+' · '+esc(ago(n.ts))+'</span></span>'+arrowA(link(n.url),en?'Open':'Voir la déclaration',true)+'</figcaption></figure>';
  }).join("")+'</div>'+cta("acteurs/voix",en?'See Insiders':'Voir les Insiders')+'</section>';
  var fs=((S.figs&&S.figs.figures)||[]).slice(0,3);
  if(fs.length)h+='<section class="tile">'+tHead(en?'Key figures':'Chiffres du jour',en?'Three numbers to remember.':'Trois chiffres à retenir.')+'<div class="tnums">'+fs.map(function(f){
    var ok=en&&f.title_en&&f.value_en;
    return'<div class="tnum"><span class="v">'+esc(ok?f.value_en:f.value)+'</span><span class="l">'+esc(ok?f.title_en:f.title)+'</span><span class="s">'+esc(figScope(f.ts))+' · '+esc(fmtD(f.ts))+'</span></div>';
  }).join("")+'</div>'+cta("marche",en?'See the market':'Voir le marché')+'</section>';
  var L=((S.layers&&S.layers.layers)||[]).filter(function(l){return l.tension!=null}).slice().sort(function(a,b){return b.tension-a.tension}).slice(0,3);
  h+='<div class="duo">';
  h+='<section class="tile half">'+tHead('Infrastructure',en?'Where it’s tight.':'Là où ça coince.')+'<div class="tlist2">'+L.map(function(l){return'<div class="tli"><span>'+esc(tx(l,'name'))+'</span><b class="t'+(l.tension>=8?'hi':l.tension>=6?'mid':'lo')+'">'+l.tension+'/10</b></div>'}).join("")+'<span class="tnote">'+(en?'Estimated tension, 0 to 10 (editorial).':'Tension estimée de 0 à 10, estimation éditoriale.')+'</span></div>'+
     '<div class="hfoot"><button class="tlink" data-go="infrastructure">'+(en?'Explore infrastructure':'Explorer l’infrastructure')+' ›</button><button class="arw lg" data-go="infrastructure" aria-label="Infrastructure">'+ARW+'</button></div></section>';
  h+='<section class="tile half">'+tHead(en?'Map':'Carte',en?'Where the compute is.':'Où est la puissance de calcul.')+'<div class="tglobe"><img src="img/globe-mini.svg" alt="" width="210" height="210"></div>'+
     '<div class="hfoot"><button class="tlink" data-go="carte">'+(en?'Explore the map':'Explorer la carte')+' ›</button><button class="arw lg" data-go="carte" aria-label="'+(en?'Map':'Carte')+'">'+ARW+'</button></div></section>';
  h+='</div>';
  el.innerHTML=h;
}
function voixHtml(){
  var H=(S.voix&&S.voix.hot)||[];
  if(!H.length)return"";
  return'<section class="vhot"><div class="sgroup">Voix <em>les déclarations les plus reprises des dernières 48 h</em></div>'+H.map(function(n){
    var meta=[n.outlets>1?n.outlets+' médias':'',n.kind==="video"?'Vidéo':n.source,ago(n.ts)].filter(Boolean).join(' · ');
    return'<div class="vh"><div class="vhn"><b>'+esc(n.n)+'</b><span class="small">'+esc(n.role)+'</span></div><a class="vht" href="'+esc(link(n.url))+'" target="_blank" rel="noopener">'+esc(!isEn()&&n.title_fr?n.title_fr:n.title)+'</a><div class="small">'+esc(meta)+'</div></div>';
  }).join("")+'<a class="vall small" href="#acteurs/voix">Toutes les voix →</a></section>';
}
/* Chiffres clés de la Une : même carte que les chiffres du Marché ; la portée (24 h, semaine, mois) se recalcule à l'affichage */
function figScope(ts){var a=Date.now()-Date.parse(ts);return a<=864e5?"Dernières 24 h":a<=7*864e5?"Cette semaine":"Ce mois-ci"}
function figCard(f,byId){
  var en=isEn()&&f.title_en&&f.value_en&&f.sub_en,arts=(f.ids||[]).map(function(id){return byId[id]}).filter(Boolean);
  var ls=(f.links&&f.links.length)?f.links:arts.map(function(a){return{t:a.source,u:a.url}});
  var hi=f.conf?f.conf==="haute":arts.some(function(a){return a.confidence==="haute"});
  var src=ls.map(function(l){return'<a href="'+esc(link(l.u))+'" target="_blank" rel="noopener">'+esc(l.t)+' ↗</a>'}).join("");
  return'<div class="share stat1"><h4>'+esc(en?f.title_en:f.title)+'</h4><div class="bigv">'+esc(en?f.value_en:f.value)+'</div><div class="sm2">'+esc(en?f.sub_en:f.sub)+'</div>'+
   '<div class="sf">'+src+(ls.length?' '+conf(hi?"haute":"moyenne"):'')+'</div><div class="fr"><span class="small"><span>'+esc(figScope(f.ts))+'</span> · <span>'+esc(fmtD(f.ts))+'</span></span></div></div>';
}
function figsHtml(byId){
  var fs=(S.figs&&S.figs.figures)||[];
  if(!fs.length)return"";
  return'<section class="figs"><div class="sgroup">Chiffres clés <em>du jour et de la semaine, chacun daté et sourcé</em></div><div class="cards3">'+fs.map(function(f){return figCard(f,byId)}).join("")+'</div></section>';
}

function rFeed(){
  var el=$("v-actualites");el.classList.toggle("essmode",!!S.top);
  var cats=[["ALL","Toutes"]].concat(Object.keys(CATS).map(function(k){return[k,CATS[k]]}));
  var items=S.feed.filter(byCountry).filter(function(x){return S.cat==="ALL"||x.category===S.cat}).filter(function(x){return!S.top||x.importance>=3});
  var dupF=voixDupFn(),nDup=0;items=items.filter(function(x){if(dupF(x)){nDup++;return false}return true});
  var cn=COUNTRIES.filter(function(c){return c[0]===S.country})[0][1],cl=S.cat==="ALL"?"Toutes":CATS[S.cat];
  var panel="";
  if(S.fo==="pays")panel='<div class="fpanel">'+COUNTRIES.map(function(c){return'<button class="chip'+(S.country===c[0]?' on':'')+'" data-c="'+c[0]+'">'+c[1]+'</button>'}).join("")+'</div>';
  if(S.fo==="cat")panel='<div class="fpanel">'+cats.map(function(c){return'<button class="chip'+(S.cat===c[0]?' on':'')+'" data-cat="'+c[0]+'">'+c[1]+'</button>'}).join("")+'</div>';
  var h='<h2 class="sec">Actualités</h2><p class="lede">Les informations collectées, de la plus récente à la plus ancienne. Cliquez sur un titre pour lire l\'article.</p>'+
   '<div class="toolbar frow"><button class="chip fb'+(S.fo==="pays"?' open':'')+(S.country!=="ALL"?' set':'')+'" data-fo="pays">Pays : '+esc(cn)+' <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button><button class="chip fb'+(S.fo==="cat"?' open':'')+(S.cat!=="ALL"?' set':'')+'" data-fo="cat">Catégorie : '+esc(cl)+' <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button><span class="sp"></span><button class="chip'+(S.top?' on':'')+'" data-top="1">Essentiel seulement</button></div>'+panel;
  if(nDup)h+='<p class="small vdn"><a href="#acteurs/voix">'+nDup+' article(s) déjà dans Insiders, non répétés ici →</a></p>';
  if(!items.length)h+='<div class="empty">Aucune actualité pour ces filtres.</div>';
  var dayCount={};items.forEach(function(x){var d=dayKey(x.ts);dayCount[d]=(dayCount[d]||0)+1});var day="";var total=items.length;items=items.slice(0,S.limit);
  items.forEach(function(it){
    var d=dayKey(it.ts);
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
  var det='<div class="two"><div class="panel"><span class="kicker">Qui dépense</span><h3>Capex 2026, États-Unis</h3><div class="sub">Guidance annuelle, en milliards de dollars. Zone claire = fourchette.</div><table class="table cx"><colgroup><col style="width:24%"><col style="width:26%"><col></colgroup><thead><tr><th>Société</th><th>Guidance</th><th>Détail</th></tr></thead><tbody>'+cu+'</tbody></table></div>'+
   '<div class="panel"><span class="kicker">Qui dépense</span><h3>Capex, Chine</h3><div class="sub">Montants en yuans, comparables au capex américain à un facteur de 5 à 7 près.</div><table class="table cx"><colgroup><col style="width:24%"><col style="width:26%"><col></colgroup><thead><tr><th>Société</th><th>Montant</th><th>Détail</th></tr></thead><tbody>'+cc+'</tbody></table></div></div>'+
   '<div class="two"><div class="panel"><span class="kicker">Qui gagne</span><h3>Revenus de l\'IA</h3><div class="sub">Run-rate annualisé, en milliards de dollars.</div>'+rv+'</div>'+
   '<div class="note"><b>À lire avant de comparer.</b> '+esc(m.caveat)+'</div></div>'+
   secPanel();
  el.innerHTML='<h2 class="sec">Marché</h2><p class="lede">Qui dépense, qui gagne de l\'argent, qui compte. Chiffres sourcés ; la date et la source figurent sous chaque donnée.</p>'+
   '<div class="tiles">'+m.tiles.map(function(t){return'<div class="tile"><div class="l">'+esc(t.label)+'</div><div class="v">'+esc(t.value)+'</div><div class="s">'+esc(t.sub)+'</div><div class="src"><a href="'+esc(link(t.u))+'" target="_blank" rel="noopener">'+esc(t.src)+'</a></div></div>'}).join("")+'</div>'+
   sommaire()+etages()+
   '<details class="details sec2" id="m-details"><summary><span>Détails</span><em>Capex annoncé, revenus, dépôts SEC</em></summary>'+det+'</details>';
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
   '<div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a> '+conf(c.confidence)+'</div>'+(c.links&&c.links.length?'<div class="srcs">'+srcLinks(c.links)+'</div>':'')+'<div class="fr">'+shareFresh(c)+'</div>'+
   '<details class="why"><summary>Limites</summary><div class="sc">'+esc(c.caveat)+'</div></details></div>';
}
var ETAGES=[
  [1,"Compute","Qui construit et possède la puissance de calcul ?"],
  [2,"Modèles","Qui fabrique les meilleurs modèles, à quel écart, et à quel prix ?"],
  [3,"Adoption","Qui utilise l\'IA : grand public, entreprises, volume d\'usage ?"],
  [4,"Financement et revenus","Combien est investi, qui le finance, et quels revenus en sortent ?"],
  [5,"Perspectives et risques","Ce qui est prévu, ce qui arrive et les risques."]
];
function sommaire(){
  return'<nav class="toc" aria-label="Sommaire du marché"><span class="kicker">Sommaire</span><ol>'+ETAGES.map(function(e){return'<li><a href="#" data-jump="m-e'+e[0]+'"><b>'+e[0]+'</b> '+esc(e[1])+'<span>'+esc(e[2])+'</span></a></li>'}).join("")+
   '<li><a href="#" data-jump="m-cal"><b>+</b> Calendrier<span>Six prochains mois, probabilité de chaque événement</span></a></li><li><a href="#" data-jump="m-actors"><b>+</b> Acteurs<span>Principaux acteurs</span></a></li><li><a href="#" data-jump="m-race"><b>+</b> USA–Chine<span>Qui est devant, couche par couche</span></a></li><li><a href="#" data-jump="m-details"><b>+</b> Détails<span>Capex annoncé, revenus, dépôts SEC</span></a></li></ol></nav>';
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
function shortUnit(u){return/%/.test(u)?" %":/dollars/.test(u)?" Md$":/H100/.test(u)?" M H100e":/utilisateurs/.test(u)?" M":/FLOP/.test(u)?" FLOP":/TWh/.test(u)?" TWh":""}
function fmtUsd(v){return(v>=100?Math.round(v):v>=1?Math.round(v*100)/100:+v.toPrecision(2)).toLocaleString(loc(),{maximumFractionDigits:6})+" $"}
function fmtVal(c,v){
  if(c.fmt==="usd")return fmtUsd(v);
  if(c.scale==="log"){var e=Math.floor(Math.log10(v)),m=v/Math.pow(10,e);return String(Math.round(m*10)/10).replace(".",",")+"e"+e}
  var n=Math.abs(v)>=100?Math.round(v):Math.round(v*10)/10;
  return n.toLocaleString(loc())+shortUnit(c.unit)
}
function ms(d){return Date.parse(String(d).slice(0,10)+"T00:00:00Z")}
function fmtM(t){return new Date(t).toLocaleDateString(loc(),{month:"short",year:"2-digit",timeZone:"UTC"})}
function lineChart(c){
  var W=340,H=196,L=c.fmt==="usd"?58:40,R=10,T=10,B=24,ser=(c.series||[]).filter(function(x){return x.points&&x.points.length});
  if(!ser.length)return'<div class="empty small">Données en cours de collecte.</div>';
  var log=c.scale==="log",all=[];ser.forEach(function(x){x.points.forEach(function(p){all.push(p)})});
  var t0=Math.min.apply(null,all.map(function(p){return ms(p.d)})),t1=Math.max.apply(null,all.map(function(p){return ms(p.d)}));
  if(t1===t0)t1=t0+86400000*30;
  var vmax=Math.max.apply(null,all.map(function(p){return p.v})),vmin=log?Math.min.apply(null,all.map(function(p){return p.v})):0,y0,y1,ticks=[];
  if(log){y0=Math.floor(Math.log10(vmin));y1=Math.ceil(Math.log10(vmax));if(y1-y0<2)y1=y0+2;var st=Math.ceil((y1-y0)/4);for(var e=y0;e<=y1;e+=st)ticks.push(e)}
  else{var raw=vmax*1.05,mag=Math.pow(10,Math.floor(Math.log10(raw))),cand=[];[mag/10,mag].forEach(function(b){[1,2,2.5,5].forEach(function(k){cand.push(k*b)})});cand.push(mag*10);var stp=cand.filter(function(k){return raw/k<=5})[0]||mag*10;y1=Math.ceil(raw/stp)*stp;y0=0;for(var v=0;v<=y1+1e-9;v+=stp)ticks.push(v)}
  var X=function(t){return L+(t-t0)/(t1-t0)*(W-L-R)},Y=function(v){var q=log?(Math.log10(v)-y0)/(y1-y0):(v-y0)/(y1-y0);return T+(1-q)*(H-T-B)};
  var g='';
  ticks.forEach(function(k){var yy=Y(log?Math.pow(10,k):k).toFixed(1);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" class="gl"/><text x="'+(L-5)+'" y="'+(+yy+3)+'" text-anchor="end" class="ax">'+(log?(c.fmt==='usd'?fmtUsd(Math.pow(10,k)):'1e'+k):(k>=1000?k.toLocaleString("fr-FR"):String(k).replace(".",",")))+'</text>'});
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
  if(c.fmt==="usd")t=String(Math.abs(Math.round((b/a-1)*100)))+" %";
  else if(c.scale==="log")t="×"+String(Math.round(b/a*10)/10).replace(".",",");
  else if(/%/.test(c.unit||""))t=String(Math.abs(Math.round((b-a)*10)/10)).replace(".",",")+" pt";
  else t=String(Math.abs(Math.round((b/a-1)*100)))+" %";
  if(t==="0 pt"||t==="0 %")return'<em class="dl"></em>';
  return'<em class="dl '+(b>a?"up":"dn")+'" title="Variation depuis le point précédent">'+(b>a?"▲ ":"▼ ")+t+'</em>';
}
function curveFresh(c){
  if(c.asof_note)return'<div class="sf small">'+esc(c.asof_note)+'</div>';
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
   (c.links&&c.links.length?'<div class="sf">'+srcLinks(c.links)+' '+conf(c.confidence)+'</div>':'<div class="sf"><a href="'+esc(link(c.url))+'" target="_blank" rel="noopener">'+esc(c.source)+' ↗</a> '+conf(c.confidence)+'</div>')+'<div class="fr"><span class="small">'+esc(c.as_of)+'</span></div>'+
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
var ICONS={
 satellite:'<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="27" y="27" width="10" height="10" transform="rotate(45 32 32)"/><path d="M14 22l10 10-6 6-10-10z"/><path d="M50 42L40 32l6-6 10 10z"/><path d="M12 52c8 0 14-6 14-14M12 58c11 0 20-9 20-20"/></svg>',
 orbit:'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="7"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(-25 32 32)"/><circle cx="53" cy="22" r="3"/></svg>',
 racks:'<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="8" width="18" height="48"/><rect x="36" y="8" width="18" height="48"/><path d="M10 20h18M10 32h18M10 44h18M36 20h18M36 32h18M36 44h18"/><path d="M15 14h4M15 26h4M15 38h4M15 50h4M41 14h4M41 26h4M41 38h4M41 50h4"/></svg>',
 cloud:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 40a9 9 0 0 1 1-18 12 12 0 0 1 23-2 10 10 0 0 1 3 20z"/><path d="M22 48v8M32 48v8M42 48v8"/></svg>',
 chip:'<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="40" height="40"/><rect x="22" y="22" width="20" height="20"/><path d="M20 12V5M32 12V5M44 12V5M20 59v-7M32 59v-7M44 59v-7M12 20H5M12 32H5M12 44H5M59 20h-7M59 32h-7M59 44h-7"/></svg>',
 moon:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M44 8a24 24 0 1 0 12 30A20 20 0 0 1 44 8z"/><path d="M46 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></svg>'
};
function actorCard(a){
  var ok=/^https:\/\//.test(a.website||"");
  var fig=(a.figures||[]).map(function(f){return'<li><b>'+esc(f.v)+'</b><span>'+esc(f.l)+'</span></li>'}).join("");
  return'<article class="actor"><div class="aph" role="img" aria-label="'+esc(a.name)+'"><span class="aic">'+(ICONS[a.icon]||ICONS.chip)+'</span>'+
   (a.image?'<img class="aimg" data-b="'+esc(a.image)+'" data-n="0" src="img/actors/'+esc(a.image)+'.jpg" alt="" loading="lazy">':'')+'</div>'+
   '<div class="ah"><h4>'+esc(a.name)+'</h4><span class="mode">'+esc(a.tag)+'</span></div>'+
   '<p class="awhat">'+esc(a.what)+'</p>'+
   '<div class="arow"><span class="lbl">Pourquoi ça compte</span><p>'+esc(a.why)+'</p></div>'+
   '<div class="arow"><span class="lbl">Chiffres clés <i>'+esc(a.as_of)+'</i></span><ul class="afig">'+fig+'</ul></div>'+
   '<div class="arow rk"><span class="lbl">Risque d\'exécution</span><p>'+esc(a.risk)+'</p></div>'+
   '<div class="afoot">'+(ok?'<a class="site" href="'+esc(a.website)+'" target="_blank" rel="noopener">Site officiel ↗</a>':'')+
   '<details class="srcd"><summary>Sources</summary><div class="srcs">'+srcLinks(a.sources)+'</div></details></div></article>';
}
// Illustrations : public/img/actors/<nom>.jpg, .jpeg, .webp ou .png ; à défaut, le pictogramme reste affiché.
document.addEventListener("error",function(e){
  var im=e.target;if(!im||!im.classList||!im.classList.contains("aimg"))return;
  var ex=["jpg","jpeg","webp","png"],n=+im.getAttribute("data-n")+1;
  if(n<ex.length){im.setAttribute("data-n",n);im.src="img/actors/"+im.getAttribute("data-b")+"."+ex[n]}else im.remove();
},true);
function mainActorsHTML(){
  var act=((S.market&&S.market.actors)||[]).slice();
  return'<div class="sgroup">Principaux acteurs <em>qui compte aujourd\'hui</em></div>'+(act.length?'<table class="table"><thead><tr><th>Acteur</th><th>Pays</th><th>Rôle</th><th>Repère</th></tr></thead><tbody>'+act.map(function(a){return'<tr><td>'+esc(a.name)+'</td><td>'+ctag(a.country)+'</td><td>'+esc(a.role)+'</td><td>'+esc(a.note)+' <a class="small" href="'+esc(link(a.u))+'" target="_blank" rel="noopener">'+esc(a.src)+'</a></td></tr>'}).join("")+'</tbody></table>':'<div class="empty">Aucun acteur pour ce filtre.</div>');
}
function pctTxt(p){return p<1?"< 1 %":Math.round(p).toLocaleString(loc())+" %"}
function timeline(cat,today){
  var t0=ms(today),t1=t0+183*86400000,span=t1-t0,rows=[],lanes=[],i;
  cat=cat.filter(function(c){return ms(c.date)<=t1}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0});
  var dots=cat.map(function(c,n){
    var x=Math.max(0,Math.min(100,(ms(c.date)-t0)/span*100)),l=0;
    while(lanes[l]!=null&&x-lanes[l]<3.4)l++;
    lanes[l]=x;
    return'<span class="tdot" style="left:'+x.toFixed(2)+'%;top:'+(l*20+2)+'px" title="'+esc(c.label+" : "+c.title)+'">'+(n+1)+'</span>';
  }).join("");
  var ticks="",d=new Date(t0);d=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
  for(;d<=t1;){var dd=new Date(d);ticks+='<span class="tmon" style="left:'+((d-t0)/span*100).toFixed(2)+'%">'+esc(dd.toLocaleDateString(loc(),{month:"short",timeZone:"UTC"})+(dd.getUTCMonth()===0?" "+dd.getUTCFullYear():""))+'</span>';d=Date.UTC(dd.getUTCFullYear(),dd.getUTCMonth()+1,1)}
  var ax='<div class="tax" style="height:'+(lanes.length*20+34)+'px"><span class="tmon tnow" style="left:0">aujourd\'hui</span>'+ticks+'<div class="tline" style="top:'+(lanes.length*20+6)+'px"></div>'+dots+'</div>';
  var li=cat.map(function(c,n){
    var pr=(c.probs||[]).slice().sort(function(a,b){return b.p-a.p});
    var pb=pr.length?pr.map(function(q,k){return'<div class="tpr'+(k?' sec':'')+'"><span>'+esc(q.label)+'</span><b>'+pctTxt(q.p)+'</b><i><u style="width:'+Math.max(1,Math.round(q.p))+'%"></u></i></div>'}).join("")+(c.probs_at?'<span class="small mute">Pari Polymarket au '+esc(fmtD(c.probs_at))+'</span>':''):'<span class="small mute">Pas de probabilité publiée</span>';
    return'<li><span class="tn">'+(n+1)+'</span><div class="tdt">'+esc(c.label)+(c.date===today?' · aujourd\'hui':'')+'<span class="tk">'+esc(c.kind||"")+'</span></div><div class="tbd"><b>'+esc(c.title)+'</b><p>'+esc(c.detail)+'</p><span class="small mute">'+esc(c.status)+' · </span><span class="srcs inl">'+srcLinks(c.sources)+'</span></div><div class="tpb">'+pb+'</div></li>';
  }).join("");
  return'<div class="tl">'+ax+'<ol class="tlist">'+li+'</ol></div>';
}
function outlookHTML(){
  var o=S.outlook;if(!o)return'<div class="empty small">Perspectives indisponibles.</div>';
  var today=new Date().toISOString().slice(0,10),h='';
  var rk=(o.risks||[]).map(riskCard).join("");
  if(rk)h+='<div class="sgroup">Trois indicateurs de risque <em>'+esc(o.risks_note)+'</em></div><div class="cards3">'+rk+'</div>';
  var cat=(o.catalysts||[]).filter(function(c){return c.date>=new Date(Date.now()-2*86400000).toISOString().slice(0,10)});
  if(cat.length)h+='<details class="details sec2" id="m-cal"><summary><span>Calendrier des six prochains mois</span><em>événements datés, avec la probabilité de chacun</em></summary>'+timeline(cat,today)+'<p class="small mute" style="margin:8px 0 0">'+esc(o.catalysts_note)+'</p></details>';
  h+='<details class="details sec2" id="m-actors"><summary><span>Acteurs</span><em>principaux acteurs</em></summary>'+mainActorsHTML()+'<div class="sgroup">Acteurs émergents <em>six sociétés à suivre</em></div><div class="actors">'+(o.actors||[]).map(actorCard).join("")+'</div></details>';
  h+='<details class="details sec2" id="m-race"><summary><span>USA–Chine</span><em>qui est devant, couche par couche</em></summary>'+raceHtml()+'</details>';
  return h;
}
function etages(){
  return ETAGES.map(function(e){
    var pies=piesFor(function(c){return c.etage===e[0]}),cur=((S.series&&S.series.curves)||[]).filter(function(c){return c.etage===e[0]}).sort(function(a,b){return(a.rank||9)-(b.rank||9)}),
        st=((S.ind&&S.ind.stats)||[]).filter(function(c){return c.etage===e[0]}).sort(function(a,b){return(a.rank||9)-(b.rank||9)});
    var h='<section class="etage" id="m-e'+e[0]+'"><span class="kicker">Étage '+e[0]+' sur '+ETAGES.length+'</span><h3 class="sub2">'+esc(e[1])+'</h3><p class="lede" style="margin-bottom:0">'+esc(e[2])+'</p>';
    if(e[0]===5&&S.outlook&&S.outlook.rule)h+='<div class="note"><b>Règle.</b> '+esc(S.outlook.rule)+'</div>';
    if(pies.length)h+='<div class="sgroup">Qui domine <em>parts de marché, chaque camembert est une mesure différente</em></div><div class="cards3">'+pies.map(shareCard).join("")+'</div>';
    if(st.length)h+='<div class="sgroup">Chiffres clés <em>une mesure par carte, datée et sourcée</em></div><div class="cards3">'+st.map(statCard).join("")+'</div>';
    if(cur.length)h+='<div class="sgroup">Comment ça évolue <em>courbes dans le temps</em></div><div class="cards3">'+cur.map(curveCard).join("")+'</div>';
    if(!pies.length&&!st.length&&!cur.length&&e[0]!==5)h+='<div class="empty small">Données en cours de collecte.</div>';
    if(e[0]===5)h+=outlookHTML();
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
  if(l.tension==null)return'<span class="mlabel"><span>Tension estimée</span><span class="tv emerging">'+esc(l.tension_label)+'</span></span>';
  return meter(l.tension)+'<span class="mlabel"><span>Tension estimée</span><span class="tv '+(l.tension>=8?"hi":(l.tension>=6?"mid":"lo"))+'">'+esc(l.tension_label)+' · '+l.tension+'/10</span></span>'+layerTrend(l);
}
function layerExtra(l){
  var h="";
  if(l.capacity)h+='<div class="lcap"><span class="kicker">Capacité</span> '+esc(l.capacity.value)+' <span class="small mute">('+esc(l.capacity.as_of)+', <a href="'+esc(link(l.capacity.url))+'" target="_blank" rel="noopener">'+esc(l.capacity.source)+'</a>)</span></div>';
  if(l.unlock)h+='<div class="lcap"><span class="kicker">Ce qui débloquerait</span> '+esc(l.unlock.text)+' <span class="small mute">(<a href="'+esc(link(l.unlock.url))+'" target="_blank" rel="noopener">'+esc(l.unlock.source)+'</a>)</span></div>';
  return h;
}
var chainFrame=null;
function chainSrc(){return"chain.html?lang="+S.lang}
function chainHost(){
  var h=$("chain-host");if(!h)return;
  if(!chainFrame){
    chainFrame=document.createElement("iframe");chainFrame.id="chain-frame";chainFrame.src=chainSrc();chainFrame.title="Schéma interactif d'un datacenter IA, du campus à la puce";chainFrame.setAttribute("scrolling","no");chainFrame.setAttribute("loading","lazy");chainFrame.style.height="900px";
    h.appendChild(chainFrame);
  }
}
function chainLang(){
  if(!chainFrame)return;
  try{var w=chainFrame.contentWindow;if(w&&w.ChainFrame)w.ChainFrame.setLang(S.lang)}catch(e){}
}
var carteFrame=null;
function carteHost(){
  var h=$("carte-host");if(!h)return;
  if(!carteFrame){
    carteFrame=document.createElement("iframe");carteFrame.id="carte-frame";carteFrame.src="carte.html?lang="+S.lang;carteFrame.title="Carte du monde des datacenters et des usines de puces";carteFrame.setAttribute("scrolling","no");carteFrame.setAttribute("loading","lazy");carteFrame.style.height="1200px";
    h.appendChild(carteFrame);
  }
}
function carteLang(){
  if(!carteFrame)return;
  try{var w=carteFrame.contentWindow;if(w&&w.CarteFrame)w.CarteFrame.setLang(S.lang)}catch(e){}
}
window.addEventListener("message",function(e){
  if(e.origin!==location.origin||!e.data)return;
  if(typeof e.data.chainH==="number"&&chainFrame){var h=Math.max(300,Math.min(4000,e.data.chainH));chainFrame.style.height=h+"px"}
  if(typeof e.data.carteH==="number"&&carteFrame){var k=Math.max(300,Math.min(4000,e.data.carteH));carteFrame.style.height=k+"px"}
});
/* Liens entre Infrastructure, Acteurs et Insiders */
var ALIAS={google:"alphabet"};
function nz(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function aMatchName(nm){
  var A=(S.acteurs&&S.acteurs.actors)||[],ps=String(nm).split(/\(|\)/).map(function(x){return nz(x).trim()}).filter(Boolean);
  for(var i=0;i<ps.length;i++){var q=ALIAS[ps[i]]||ps[i];for(var j=0;j<A.length;j++)if(nz(A[j].n)===q||A[j].id===q)return A[j]}
  return null;
}
function leaderHtml(n){
  return String(n).split(/,\s*/).map(function(part){var a=aMatchName(part);return a?'<a href="#acteurs/'+esc(a.id)+'" title="Fiche '+esc(a.n)+'">'+esc(part)+'</a>':esc(part)}).join(", ");
}
function layersOf(a){
  return((S.layers&&S.layers.layers)||[]).filter(function(l){return(l.leaders||[]).some(function(o){return String(o.n).split(/,\s*/).some(function(part){var m=aMatchName(part);return m&&m.id===a.id})})});
}
function tok(t){var o={};String(t||"").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f ]+/g," ").split(/\s+/).forEach(function(w){if(w.length>2)o[w]=1});return o}
function voixDupFn(){
  var sig=[];((S.voix&&S.voix.people)||[]).forEach(function(p){(p.items||[]).forEach(function(n){sig.push(tok(n.title))})});
  return function(it){
    var a=tok(it.orig||it.title_en||it.title),na=Object.keys(a).length;if(na<4)return false;
    for(var i=0;i<sig.length;i++){var b=sig[i],nb=0,inter=0;for(var k in b){nb++;if(a[k])inter++}
      if(inter/(na+nb-inter)>=0.6)return true}
    return false;
  };
}
function rCarte(){
  var el=$("v-carte");if(!el)return;
  if(!$("carte-host"))el.innerHTML='<h2 class="sec">Carte.</h2><p class="lede">Où se trouve la puissance de calcul de l\'IA, et où elle se construit.</p><div id="carte-host"></div>';
  carteHost();
}
function rInfra(){
  var L=S.layers.layers.slice();
  if(S.layerSort==="tension")L.sort(function(a,b){return(b.tension==null?-1:b.tension)-(a.tension==null?-1:a.tension)});else L.sort(function(a,b){return a.order-b.order});
  var el=$("v-infrastructure");
  if(!$("chain-host")){
    el.innerHTML='<h2 class="sec">Infrastructure.</h2><p class="lede">Du réseau électrique à la puce : où ça coince, et à quel point.</p><div id="chain-host"></div>'+
     '<details class="details"><summary>La pile en onze couches <em>vue en liste</em></summary><div id="infra-list"></div></details>';
  }
  chainHost();
  $("infra-list").innerHTML='<div class="tleg"><span><i class="hi"></i>Critique (8 à 10)</span><span><i class="mid"></i>Élevé (6 à 7)</span><span><i class="lo"></i>Modéré ou faible (0 à 5)</span></div>'+
   '<div class="toolbar"><button class="chip'+(S.layerSort==="pile"?' on':'')+'" data-ls="pile">Ordre de la pile</button><button class="chip'+(S.layerSort==="tension"?' on':'')+'" data-ls="tension">Par tension</button></div><div class="stack">'+
   L.map(function(l){
     var open=S.open["l"+l.id]?" open":"";
     return'<div class="layer'+open+'" id="ly-'+esc(l.id)+'"><button class="lhead" data-toggle="l'+esc(l.id)+'"><span class="lnum">'+l.order+'</span><span class="lmain"><span class="lname">'+esc(l.name)+'</span><span class="lstat">'+esc(l.key_stat)+'</span></span><span class="lm">'+layerMeter(l)+'</span><span class="chev">›</span></button>'+
      '<div class="lbody"><div class="leaders">'+l.leaders.map(function(x){return'<span class="leader c-'+esc(x.c)+'">'+leaderHtml(x.n)+'</span>'}).join("")+'</div><p>'+esc(l.note)+'</p>'+layerExtra(l)+'<div class="srcs">'+srcLinks(l.sources)+'</div></div></div>';
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
function raceHtml(){
  var rows=S.race.rows,us=rows.filter(function(r){return r.lead>0}).length,cn=rows.filter(function(r){return r.lead<0}).length,eq=rows.length-us-cn;
  return'<p class="lede">'+esc(S.race.summary)+'</p>'+
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
   '<div class="method"><div><span class="kicker">Fonctionnement</span><ol class="steps"><li><b>Collecte</b><span>Un agent récupère toutes les trois heures les flux de médias et de sources officielles, dans le monde. Seuls les domaines d\'une liste de confiance sont retenus.</span></li><li><b>Classement</b><span>Chaque article reçoit un pays, un thème, une importance de 1 à 3, une couche de la pile et un résumé en français. Sans IA disponible, le titre d\'origine est publié tel quel.</span></li><li><b>Le briefing et les chiffres clés</b><span>Briefing : 3 actualités distinctes (jamais deux fois le même dossier), choisies par importance, fraîcheur, source primaire et nombre de médias qui couvrent le sujet. Chacune a un titre et 2 à 4 puces, qui apportent chacune un détail, un contexte ou une explication, jamais une reformulation du titre. Chiffres clés : 3 chiffres lus dans les articles collectés, dont au moins un des dernières 24 h s\'il y en a et au moins un de la semaine ; sans chiffre du jour, 3 chiffres de la semaine, puis du mois s\'il en manque. Une IA rédige à partir de ces seuls articles ; un texte dont un chiffre ne figure pas dans ses sources est écarté. Mise à jour chaque jour.</span></li><li><b>Publication</b><span>Les données sont enregistrées dans le dépôt GitHub puis affichées ici. À chaque ouverture, et via « Actualiser », le site affiche immédiatement les dernières données publiées ; il ne lance aucune collecte.</span></li></ol></div>'+
   '<div><span class="kicker">Lire avec prudence</span><ol class="steps"><li><b>Sources</b><span>Source primaire : document officiel (SEC, registre fédéral, communiqué, blog d\'une entreprise). Presse : média figurant sur une liste de confiance. Les newsletters, blogs personnels et sites de recopie sont écartés.</span></li><li><b>Estimations</b><span>Les scores USA–Chine et les tensions des couches sont des estimations éditoriales, pas des mesures.</span></li><li><b>Run-rates</b><span>Les revenus des laboratoires privés ne sont pas audités et ne sont pas calculés de la même façon.</span></li><li><b>Chiffres de la SEC</b><span>Capex et revenus des cinq géants américains sont relus automatiquement dans les dépôts officiels. Au-delà de 30 jours sans relecture, une alerte s\'affiche. Le reste de la page Marché reste saisi à la main.</span></li><li><b>Revue hebdomadaire</b><span>Chaque lundi, le robot relit les pages saisies à la main à la lumière des articles collectés et propose des mises à jour sourcées. Rien ne change sans validation du propriétaire du site.</span></li><li><b>Parts de marché</b><span>Le HBM (Counterpoint), les fonderies (TrendForce), les propriétaires du compute et les concepteurs de puces (Epoch AI) sont relus automatiquement à la source. Si la page ou le fichier change et que la lecture échoue, l\'ancien chiffre reste affiché avec sa date et une alerte apparaît. Les autres camemberts sont mis à jour à la main.</span></li><li><b>Évolution</b><span>Les courbes marquées « auto » (capex des géants à la SEC, compute vendu et records d\'entraînement chez Epoch AI, parts HBM chez Counterpoint, adoption en entreprise au Census Bureau) sont relues à chaque collecte, avec les mêmes garde-fous. Les courbes « semi-auto » (utilisateurs, trafic web, revenu annualisé) n\'ont pas de source lisible par un robot : la revue du lundi propose de nouveaux points avec leur source, et rien n\'est ajouté sans validation. Chaque point est daté et sourcé.</span></li></ol></div></div>'+
   health()+
   '<hr class="rule thick" style="margin-top:34px"><span class="kicker">Sources citées ('+list.length+')</span><div class="src-list">'+list.map(function(s){return'<a href="'+esc(link(s[1]))+'" target="_blank" rel="noopener">'+esc(s[0])+' ↗</a>'}).join("")+'</div>';
}

/* ---------- Acteurs : liste et fiche ---------- */
function aMd(v){var b=v/1e9;return b>=1?(Math.round(b*10)/10).toString().replace(".",",")+" Md$":Math.round(v/1e6).toLocaleString(loc())+" M$"}
function aSigned(x){if(x==null)return"";var v=Math.abs(x)>=10?Math.round(x):Math.round(x*10)/10;return(v>0?"+":v<0?"−":"")+String(Math.abs(v)).replace(".",",")+" %"}
function aLink(u,t){return'<a href="'+esc(link(u))+'" target="_blank" rel="noopener">'+esc(t)+' ↗</a>'}
function aById(id){return((S.acteurs&&S.acteurs.actors)||[]).filter(function(a){return a.id===id})[0]}
function aBlocks(){
  var seen={},out=[];((S.acteurs&&S.acteurs.actors)||[]).forEach(function(a){a.roles.forEach(function(r){if(!seen[r.block]){seen[r.block]=1;out.push(r.block)}})});return out;
}
function aCard(a){
  var line=a.rank?a.rank.text:a.roles.map(function(r){return r.sub.replace(/\s*\(.*$/,"")}).filter(function(x,i,l){return l.indexOf(x)===i}).slice(0,2).join(" · ");
  return'<a class="acard" href="#acteurs/'+esc(a.id)+'"><span class="an">'+esc(a.n)+'</span><span class="ap">'+esc(a.pays)+'</span><span class="ar">'+esc(line)+'</span></a>';
}
function aList(){
  var A=S.acteurs.actors,q=S.aq.trim().toLowerCase();
  var list=A.filter(function(a){
    if(S.ab!=="ALL"&&!a.roles.some(function(r){return r.block===S.ab}))return false;
    return !q||(a.n+" "+a.pays+" "+a.roles.map(function(r){return r.sub}).join(" ")).toLowerCase().indexOf(q)>=0;
  });
  return list.length?list.map(aCard).join(""):'<p class="small">Aucun acteur ne correspond.</p>';
}
function aSortMarket(m){
  var self=m.items.filter(function(x){return x.self}),oth=m.items.filter(function(x){return !x.self&&!/^(autres?|reste)/i.test(x.n)}).sort(function(a,b){return b.v-a.v}),aut=m.items.filter(function(x){return !x.self&&/^(autres?|reste)/i.test(x.n)});
  return self.concat(oth,aut);
}
function aMarketCard(m){
  var segs=aSortMarket(m).map(function(x){return{label:x.n,pct:x.v}});
  var leg=segs.map(function(x,i){return'<li><i style="background:'+dcol(i,x.label)+'"></i><span>'+esc(x.label)+'</span><b>'+fmtPct(x.pct)+'</b></li>'}).join("");
  return'<div class="share"><h4>'+esc(m.t)+'</h4><div class="sm">'+esc(m.as_of)+(m.calc?' · part calculée entre les acteurs listés':'')+'</div>'+
   (segs.length>1?'<div class="sbody">'+donut(segs)+'<ul class="leg">'+leg+'</ul></div>':'<div class="bigv" style="margin:14px 0 4px">'+fmtPct(segs[0].pct)+'</div><div class="sm2">'+esc(segs[0].label)+' (seule part publiée, pas de répartition complète)</div>')+
   '<div class="sf">'+aLink(m.u,m.src)+'</div>'+(m.note?'<div class="fr"><span class="small">'+esc(m.note)+'</span></div>':'')+'</div>';
}
function aFinCards(a){
  var f=a.fin||{},h="",q=f.quarter;
  var none=function(t,why){return'<div class="share stat1"><h4>'+t+'</h4><div class="bigv mutev">Non disponible</div><div class="sm2">'+why+'</div></div>'};
  // 1. chiffre d'affaires du dernier trimestre
  if(q){
    var vs=[];if(q.qoq!=null)vs.push(aSigned(q.qoq)+" sur le trimestre précédent");if(q.yoy!=null)vs.push(aSigned(q.yoy)+" sur un an");
    h+='<div class="share stat1"><h4>Chiffre d\'affaires du trimestre</h4><div class="bigv">'+esc(aMd(q.value))+'</div><div class="sm2">'+esc(vs.join(" · ")||"Variation non disponible")+'</div>'+
     '<div class="sf">'+aLink(q.url,q.src)+(q.calc?' <span class="small">variations calculées</span>':'')+'</div><div class="fr"><span class="small">Trimestre clos le '+esc(fmtD(q.end))+'</span></div>'+
     (f.pending?'<div class="sm2" style="margin-top:6px">Des résultats plus récents sont publiés par communiqué ; ils seront ajoutés avec le dépôt SEC.</div>':'')+'</div>';
  }else h+=none("Chiffre d'affaires du trimestre","Pas de dépôt trimestriel exploitable auprès de la SEC pour cette société.");
  // 2. investissement sur 12 mois
  if(f.capex){
    var st=(f.stakes||[]).map(function(x){return esc(x.label)+' : '+esc(aMd(x.value))+' <span class="small">('+(x.basis==="ttm"?"12 mois":"exercice clos le "+esc(fmtD(x.end)))+')</span>'}).join("<br>");
    h+='<div class="share stat1"><h4>Investissement sur 12 mois</h4><div class="bigv">'+esc(aMd(f.capex.value))+'</div><div class="sm2">Investissements en équipements (capex)'+(st?'<br><b>Participations et acquisitions</b><br>'+st:'')+'</div>'+
     '<div class="sf">'+aLink(f.capex.url,"SEC ("+f.capex.form+")")+'</div><div class="fr"><span class="small">'+(f.capex.basis==="ttm"?"12 mois":"Dernier exercice")+' clos le '+esc(fmtD(f.capex.end))+'</span></div></div>';
  }else h+=none("Investissement sur 12 mois","Pas de dépôt trimestriel exploitable auprès de la SEC pour cette société.");
  // 3. carnet de commandes
  var b=f.backlog;
  if(b&&b.kind==="rpo")h+='<div class="share stat1"><h4>Carnet de commandes</h4><div class="bigv">'+esc(aMd(b.value))+'</div><div class="sm2">Contrats signés restant à facturer (RPO), déclarés à la SEC. Les commandes non contractualisées n\'y figurent pas.</div>'+
   '<div class="sf">'+aLink(b.url,"SEC ("+b.form+")")+'</div><div class="fr"><span class="small">Au '+esc(fmtD(b.end))+'</span></div></div>';
  else if(b)h+='<div class="share stat1"><h4>Carnet de commandes</h4><div class="bigv">'+esc(b.text)+'</div><div class="sm2">'+esc(b.label)+'</div><div class="sf">'+aLink(b.url,b.src)+'</div><div class="fr"><span class="small">'+esc(b.as_of)+'</span></div></div>';
  else h+=none("Carnet de commandes","Aucun carnet publié dans une source collectée.");
  return h;
}
function aClients(a){
  if(!a.clients||!a.clients.length)return'<p class="small">Aucune source fiable collectée pour l\'instant.</p>';
  var li=a.clients.map(function(c,i){return'<li><span class="cn">'+(a.clients_ranked?'<b>'+(i+1)+'</b> ':'')+esc(c.n)+'</span>'+(c.v?'<span class="cv">'+esc(c.v)+'</span>':'')+(c.note?'<span class="small cnote">'+esc(c.note)+'</span>':'')+'<span class="small csrc">'+aLink(c.u,c.src)+'</span></li>'}).join("");
  return'<ul class="clist">'+li+'</ul>'+(a.clients_note?'<p class="small">'+esc(a.clients_note)+'</p>':!a.clients_ranked?'<p class="small">Ordre non publié par la société ou par la source.</p>':'');
}
function aNews(a){
  if(!a.news||!a.news.length)return'<p class="small">Aucune actualité récente dans le fil.</p>';
  return a.news.map(function(n){return'<div class="anews"><span class="small">'+esc(new Date(n.ts).toLocaleDateString(loc(),{day:"numeric",month:"short"}))+'</span><a href="'+esc(link(n.url))+'" target="_blank" rel="noopener">'+esc(isEn()&&n.title_en?n.title_en:n.title)+'</a><span class="small">'+esc(n.source)+'</span></div>'}).join("");
}
function aRivals(a){
  if(!a.rivals||!a.rivals.length)return"";
  var body=a.rivals.map(function(r){
    var chips=r.ids.map(function(id){var o=aById(id);return o?'<a class="chip" href="#acteurs/'+esc(id)+'">'+esc(o.n)+'</a>':""}).join("");
    return'<div class="rv"><span class="small">'+esc(r.block)+' · '+esc(r.sub)+'</span><div class="toolbar">'+chips+'</div></div>';
  }).join("");
  return'<div class="rivals"><button class="chip rvbtn'+(S.arv?' on':'')+'" data-arv="1">'+(S.arv?'Masquer les concurrents':'Découvrir les concurrents')+'</button>'+(S.arv?'<div class="rvbody">'+body+'</div>':'')+'</div>';
}
function aFiche(a){
  var blocks=a.roles.map(function(r){return r.block}).filter(function(x,i,l){return l.indexOf(x)===i});
  var h='<a class="back small" href="#acteurs">← Tous les acteurs</a><div class="ahead"><h2 class="sec">'+esc(a.n)+'</h2><span class="small">'+esc(a.pays)+'</span></div>'+
   (a.rank?'<div class="arank">'+esc(a.rank.text)+' <span class="small">('+aLink(a.rank.u,a.rank.src)+(a.rank.as_of?', '+esc(a.rank.as_of):'')+')</span></div>':'')+
   '<div class="toolbar">'+blocks.map(function(b){return'<span class="chip">'+esc(b)+'</span>'}).join("")+'</div>'+
   (a.desc?'<p class="adesc">'+esc(a.desc)+'</p>':'');
  var ly=layersOf(a);
  if(ly.length)h+='<p class="small apile">Dans la pile : '+ly.map(function(l){return'<a href="#infrastructure/'+esc(l.id)+'">'+esc(l.name)+'</a>'}).join(" · ")+'</p>';
  h+='<div class="sgroup">Chiffres clés</div><div class="cards3">'+aFinCards(a)+'</div>';
  h+='<div class="sgroup">Parts de marché <em>sur ses principaux métiers, face aux concurrents</em></div>';
  h+=a.markets&&a.markets.length?'<div class="cards3">'+a.markets.map(aMarketCard).join("")+'</div>':'<p class="small" style="margin-top:12px">Aucune part de marché sourcée pour cet acteur.</p>';
  h+='<div class="sgroup">Clients principaux</div><div style="margin-top:10px">'+aClients(a)+'</div>';
  h+='<div class="sgroup">Actualités</div><div style="margin-top:6px">'+aNews(a)+'</div>';
  h+=aRivals(a);
  return h;
}
function aTabs(on){
  return'<div class="toolbar atabs"><a class="chip'+(on==="co"?' on':'')+'" href="#acteurs">Entreprises</a><a class="chip'+(on==="vx"?' on':'')+'" href="#acteurs/voix">Insiders</a></div>';
}
var VCATS=[["ALL","Tous"],["dirigeants","Dirigeants"],["cadres","Cadres et conseil"],["chercheurs","Chercheurs"],["pouvoirs","Pouvoirs publics"],["investisseurs","Analystes et investisseurs"]];
function vItems(){
  var q=nz(S.vq).trim(),out=[];
  ((S.voix&&S.voix.people)||[]).forEach(function(p){
    if(q&&nz(p.n).indexOf(q)<0)return;
    (p.items||[]).forEach(function(n){out.push({p:p,n:n})});
  });
  return out;
}
function vKey(u){var h=0;u=String(u||"");for(var i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))|0;return"v"+(h>>>0).toString(36)}
function vImp(n){return 1+(n.e?1:0)+((n.m||1)>=3?1:0)}
function vCl(){return VCATS.filter(function(c){return c[0]===(S.vc||"ALL")})[0][1]}
function vBtns(){
  var vo=S.vfo;
  return'<button class="chip fb'+(vo==="vue"?' open':'')+'" data-vfo="vue">Vue : '+(S.vv==="pers"?"Par personne":"Chronologique")+' <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>'+
   '<button class="chip fb'+(vo==="cat"?' open':'')+((S.vc||"ALL")!=="ALL"?' set':'')+'" data-vfo="cat">Catégorie : '+esc(vCl())+' <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button><span class="sp"></span>'+
   '<button class="chip'+(S.ve?' on':'')+'" data-ve="1">Essentiel seulement</button>';
}
function vPanel(){
  var vc=S.vc||"ALL";
  if(S.vfo==="vue")return'<div class="fpanel"><button class="chip'+(S.vv!=="pers"?' on':'')+'" data-vv="flux">Chronologique</button><button class="chip'+(S.vv==="pers"?' on':'')+'" data-vv="pers">Par personne</button></div>';
  if(S.vfo==="cat"){
    var base=vItems().filter(function(x){return!S.ve||x.n.e});
    return'<div class="fpanel">'+VCATS.map(function(c){var k=base.filter(function(x){return c[0]==="ALL"||x.p.cat===c[0]}).length;return'<button class="chip'+(vc===c[0]?' on':'')+'" data-vc="'+c[0]+'">'+c[1]+' ('+k+')</button>'}).join("")+'</div>';
  }
  return"";
}
function vList(){
  var ve=S.ve,vc=S.vc||"ALL",h="";
  var L=vItems().filter(function(x){return(!ve||x.n.e)&&(vc==="ALL"||x.p.cat===vc)});
  if(!L.length)return'<div class="empty">Aucune déclaration pour ces filtres.</div>';
  var ttl=function(n){return esc(!isEn()&&n.title_fr?n.title_fr:n.title)};
  if(S.vv==="pers"){
    var by={},order=[];
    L.forEach(function(x){if(!by[x.p.id]){by[x.p.id]=[];order.push(x.p)}by[x.p.id].push(x.n)});
    order.sort(function(a,b){var A=by[a.id][0].ts,B=by[b.id][0].ts;return B<A?-1:B>A?1:0});
    order.forEach(function(p){
      var co=p.actor&&aById(p.actor);
      h+='<div class="vperson" id="vp-'+esc(p.id)+'"><div class="ahead"><h3 class="vname">'+esc(p.n)+'</h3><span class="small">'+esc(p.role)+(co?' · <a href="#acteurs/'+esc(co.id)+'">Fiche '+esc(co.n)+'</a>':'')+'</span></div>';
      if(p.alerts&&p.alerts.length)h+='<div class="valert small">Changement de poste possible, signalé par la presse : <a href="'+esc(link(p.alerts[0].url))+'" target="_blank" rel="noopener">'+esc(p.alerts[0].title)+' ↗</a></div>';
      h+=by[p.id].map(function(n){
        return'<div class="anews"><span class="small">'+esc(new Date(n.ts).toLocaleDateString(loc(),{day:"numeric",month:"short"}))+'</span><a href="'+esc(link(n.url))+'" target="_blank" rel="noopener">'+ttl(n)+'</a><span class="small">'+(n.kind==="video"?"Vidéo · ":"")+esc(n.source)+'</span></div>';
      }).join("")+'</div>';
    });
    if(!ve&&!S.vq.trim()&&vc==="ALL"){
      var empty=((S.voix&&S.voix.people)||[]).filter(function(p){return!(p.items||[]).length});
      if(empty.length)h+='<p class="small vempty">Aucune déclaration sur les 30 derniers jours : '+empty.map(function(p){return esc(p.n)}).join(", ")+'.</p>';
    }
    return h;
  }
  L.sort(function(a,b){return b.n.ts<a.n.ts?-1:b.n.ts>a.n.ts?1:0});
  var dc={};L.forEach(function(x){var d=dayKey(x.n.ts);dc[d]=(dc[d]||0)+1});
  var total=L.length,day="";L=L.slice(0,S.vlimit);
  var catL={};VCATS.forEach(function(c){catL[c[0]]=c[1]});
  L.forEach(function(x){
    var n=x.n,d=dayKey(n.ts),k=vKey(n.url);
    if(d!==day){day=d;h+='<div class="day">'+esc(fmtDay(n.ts))+' <span>'+dc[d]+' '+(dc[d]>1?'déclarations':'déclaration')+'</span></div>'}
    h+='<div class="vrow'+(S.open[k]?' open':'')+'"><span class="time">'+esc(fmtTime(n.ts))+'</span><span class="vwho"><a href="#acteurs/voix/'+esc(x.p.id)+'" data-vp="'+esc(x.p.id)+'">'+esc(x.p.n)+'</a><span class="small">'+esc(x.p.role)+'</span></span>'+
     '<a class="ttl" href="'+esc(link(n.url))+'" target="_blank" rel="noopener">'+ttl(n)+'</a><span class="rsrc">'+(n.kind==="video"?"Vidéo · ":"")+esc(n.source)+'</span>'+
     '<button class="rtog" data-toggle="'+esc(k)+'" aria-label="Afficher le détail">›</button>'+
     '<div class="sum"><div class="meta"><span class="cat">'+esc(catL[x.p.cat]||x.p.cat)+'</span>'+imp(vImp(n))+'<a href="'+esc(link(n.url))+'" target="_blank" rel="noopener">Lire sur '+esc(n.source)+' ↗</a></div></div></div>';
  });
  if(total>L.length)h+='<div style="text-align:center;padding:24px 0"><button class="btn" data-vmore="1">Voir '+Math.min(80,total-L.length)+' déclarations de plus ('+(total-L.length)+' restantes)</button></div>';
  return h;
}
function aVoix(){
  var P=(S.voix&&S.voix.people)||[];
  var h=aTabs("vx")+'<h2 class="sec">Insiders</h2><p class="lede">Ce que disent les dirigeants, cofondateurs, chercheurs, responsables publics et investisseurs de l\'IA, du plus récent au plus ancien (30 derniers jours). Titres de presse traduits ; seuls ceux où la personne s\'exprime sont retenus. « Essentiel » : propos repris par plusieurs médias, ou prise de parole forte d\'une voix majeure.</p>';
  if(!P.length)return h+'<p class="small">Aucune déclaration collectée pour l\'instant.</p>';
  return h+'<div class="toolbar frow vtool"><span id="vbtns">'+vBtns()+'</span><input id="vq" class="vsearch" type="search" placeholder="Rechercher une personne" value="'+esc(S.vq)+'" aria-label="Rechercher une personne"></div><div id="vpanel">'+vPanel()+'</div><div id="vbody">'+vList()+'</div>';
}

function rActeurs(){
  var el=$("v-acteurs");if(!el||!S.acteurs)return;
  if(S.actor==="voix"){el.innerHTML=aVoix();return}
  var a=S.actor&&aById(S.actor);
  if(a){el.innerHTML=aFiche(a);return}
  var blocks=aBlocks();
  el.innerHTML=aTabs("co")+'<h2 class="sec">Acteurs</h2><p class="lede">Les entreprises de la chaîne de l\'IA : ce qu\'elles font, leurs chiffres, leurs parts de marché et leurs clients, chacun daté et sourcé. Un champ sans source reste vide.</p>'+
   '<div class="toolbar"><button class="chip'+(S.ab==="ALL"?' on':'')+'" data-ab="ALL">Toutes ('+S.acteurs.actors.length+')</button>'+blocks.map(function(b){return'<button class="chip'+(S.ab===b?' on':'')+'" data-ab="'+esc(b)+'">'+esc(b)+'</button>'}).join("")+'</div>'+
   '<input id="aq" class="asearch" type="search" placeholder="Rechercher un acteur" value="'+esc(S.aq)+'" aria-label="Rechercher un acteur"><div id="alist" class="agrid">'+aList()+'</div>';
}

function renderAll(){
  if(!S.market)return;
  rUne();rFeed();rMarket();rInfra();rCarte();rActeurs();rMethod();
}
function show(tab){
  var parts=String(tab||"").split("/");tab=parts[0];var toRace=tab==="usa-chine";if(toRace)tab="marche";
  if(TABS.indexOf(tab)<0)tab="une";
  if(tab==="acteurs"){S.actor=parts[1]||null;S.arv=false;if(S.acteurs)rActeurs()}
  S.tab=tab;if(typeof mSet==="function")mSet(false);if(typeof sClose==="function")sClose();
  TABS.forEach(function(t){$("v-"+t).classList.toggle("on",t===tab)});
  [].forEach.call(document.querySelectorAll(".tab"),function(b){b.classList.toggle("on",b.getAttribute("data-tab")===tab)});
  window.scrollTo(0,0);
  if(tab==="infrastructure"&&parts[1]){S.open["l"+parts[1]]=true;if(S.layers)rInfra();var dl=$("infra-list");dl=dl&&dl.closest("details");if(dl)dl.open=true;var lye=$("ly-"+parts[1]);if(lye)lye.scrollIntoView({block:"start"})}
  if(toRace){var rc=$("m-race");if(rc){rc.open=true;rc.scrollIntoView({block:"start"})}}
  if(tab==="acteurs"&&parts[1]==="voix"&&!parts[2]&&S.vv!=="flux"){S.vv="flux";rActeurs()}
  if(tab==="acteurs"&&parts[1]==="voix"&&parts[2]){S.vc="ALL";S.vv="pers";S.vq="";S.ve=false;S.vfo=null;rActeurs();var pe=document.getElementById("vp-"+parts[2]);if(pe)pe.scrollIntoView({block:"start"})}
}
function mSet(o){var m=$("mnu"),b=$("mbtn");if(!m)return;m.hidden=!o;b.setAttribute("aria-expanded",o?"true":"false");document.body.classList.toggle("mopen",!!o)}
function go(tab){mSet(false);if(location.hash!=="#"+tab)location.hash=tab;else show(tab)}

function setLang(l){
  S.lang=l==="en"?"en":"fr";
  try{localStorage.setItem("lang",S.lang)}catch(e){}
  if(window.I18N)I18N.set(S.lang);chainLang();carteLang();
  [].forEach.call(document.querySelectorAll("[data-lang]"),function(b){b.classList.toggle("on",b.getAttribute("data-lang")===S.lang)});
  if(S.market){freshness();renderAll()}
}
document.addEventListener("click",function(e){
  var lg=e.target.closest("[data-lang]");if(lg){setLang(lg.getAttribute("data-lang"));return}
  var j=e.target.closest("[data-jump]");
  if(j){e.preventDefault();var id=j.getAttribute("data-jump"),el=$(id);if(el){if(el.tagName==="DETAILS")el.open=true;el.scrollIntoView({behavior:"smooth",block:"start"})}return}
  var vcb=e.target.closest("[data-vc]");if(vcb){S.vc=vcb.getAttribute("data-vc");S.vlimit=80;S.vfo=null;vRefresh();return}
  var vfo=e.target.closest("[data-vfo]");if(vfo){var vf=vfo.getAttribute("data-vfo");S.vfo=S.vfo===vf?null:vf;vRefresh();return}
  var vvb=e.target.closest("[data-vv]");if(vvb){S.vv=vvb.getAttribute("data-vv");S.vfo=null;vRefresh();return}
  if(e.target.closest("[data-ve]")){S.ve=!S.ve;S.vlimit=80;vRefresh();return}
  if(e.target.closest("[data-vmore]")){S.vlimit+=80;vRefresh();return}
  var ab=e.target.closest("[data-ab]");if(ab){S.ab=ab.getAttribute("data-ab");rActeurs();return}
  if(e.target.closest("[data-arv]")){S.arv=!S.arv;rActeurs();return}
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
function vRefresh(){var b=$("vbody");if(b){$("vbtns").innerHTML=vBtns();$("vpanel").innerHTML=vPanel();b.innerHTML=vList()}else rActeurs()}
document.addEventListener("input",function(e){if(e.target&&e.target.id==="vq"){S.vq=e.target.value;S.vlimit=80;vRefresh();return}if(e.target&&e.target.id==="aq"){S.aq=e.target.value;var l=$("alist");if(l)l.innerHTML=aList()}});

/* Recherche globale */
var SG=["Entreprises","Personnes","Déclarations","Actualités","Couches de l'infrastructure"],SCAP=[6,6,6,8,3];
function sIndex(){
  var K=[],A=(S.acteurs&&S.acteurs.actors)||[],P=(S.voix&&S.voix.people)||[],en=isEn();
  A.forEach(function(a){
    var subs=(a.roles||[]).map(function(r){return r.sub.replace(/\s*\(.*$/,"")}).filter(function(x,i,l){return l.indexOf(x)===i}).slice(0,2).join(" · ");
    K.push({g:0,t:a.n,s:(a.pays?a.pays+" · ":"")+subs,h:"#acteurs/"+a.id,k:nz(a.n),x:nz((a.roles||[]).map(function(r){return r.block+" "+r.sub}).join(" ")+" "+(a.desc||"")+" "+(a.pays||""))});
  });
  P.forEach(function(p){
    var h=p.items&&p.items.length?"#acteurs/voix/"+p.id:(p.actor&&aById(p.actor)?"#acteurs/"+p.actor:"#acteurs/voix");
    K.push({g:1,t:p.n,s:p.role,h:h,k:nz(p.n),x:nz(p.role+" "+p.co)});
    (p.items||[]).forEach(function(n){
      var t=!en&&n.title_fr?n.title_fr:n.title;
      K.push({g:2,t:t,s:p.n+" · "+n.source,u:n.url,ts:n.ts,k:"",x:nz(n.title+" "+(n.title_fr||"")+" "+p.n+" "+n.source)});
    });
  });
  var dupS=voixDupFn();
  S.feed.forEach(function(it){
    if(dupS(it))return;
    K.push({g:3,t:tx(it,"title"),s:it.source+" · "+ago(it.ts),u:it.url,ts:it.ts,k:"",x:nz((it.title||"")+" "+(it.orig||"")+" "+(it.title_en||"")+" "+(it.summary||"")+" "+(it.summary_en||"")+" "+it.source)});
  });
  ((S.layers&&S.layers.layers)||[]).forEach(function(l){
    K.push({g:4,t:l.name,s:l.key_stat||"",h:"#infrastructure/"+l.id,k:nz(l.name),x:nz(l.name+" "+(l.key_stat||"")+" "+(l.note||"")+" "+(l.leaders||[]).map(function(o){return o.n}).join(" "))});
  });
  return K;
}
function sRun(q){
  var box=$("sres"),qq=nz(q).trim(),T=qq.split(/\s+/).filter(Boolean);
  if(qq.length<2){box.innerHTML=sSug();return}
  var K=sIndex().filter(function(r){var hay=r.k+" "+r.x;return T.every(function(w){return hay.indexOf(w)>=0})});
  K.forEach(function(r){r.sc=r.k.indexOf(qq)===0?0:r.k.indexOf(qq)>=0?1:2});
  var h="",n=0;
  SG.forEach(function(name,g){
    var L=K.filter(function(r){return r.g===g});
    if(g===1||g===0)L.sort(function(a,b){return a.sc-b.sc});
    else if(g===2)L.sort(function(a,b){return b.ts<a.ts?-1:b.ts>a.ts?1:0});
    if(!L.length)return;
    h+='<div class="sg">'+name+'</div>'+L.slice(0,SCAP[g]).map(function(r){
      n++;
      var a=r.u?'<a class="sr" href="'+esc(link(r.u))+'" target="_blank" rel="noopener" data-sx="1">':'<a class="sr" href="'+esc(r.h)+'" data-sr="'+esc(r.h)+'">';
      return a+'<span class="st">'+esc(r.t)+'</span><span class="ss small">'+esc(r.s)+'</span></a>';
    }).join("")+(L.length>SCAP[g]?'<div class="small sm2">+ '+(L.length-SCAP[g])+' autres</div>':'');
  });
  box.innerHTML=n?h:'<p class="small sh">Aucun résultat pour « '+esc(q.trim())+' »</p>';
}
function sSug(){
  var en=isEn(),Ls=((S.layers&&S.layers.layers)||[]).filter(function(l){return l.tension!=null}).slice().sort(function(a,b){return b.tension-a.tension}),top=Ls[0];
  var td=dayKey(new Date().toISOString()),ess=S.feed.filter(function(x){return x.importance>=3&&dayKey(x.ts)===td}).length;
  var c=[[en?'Today’s essentials':'Les essentiels du jour',ess+(en?' key stories':' histoires essentielles'),'#actualites','ess'],
    top?[tx(top,'name')+(en?': tension ':' : tension ')+top.tension+'/10',top.key_stat||'','#infrastructure/'+top.id]:null,
    [en?'Data center map':'Carte des datacenters',en?'Where compute is built':'Où se construit la puissance de calcul','#carte'],
    [en?'Next six months':'Calendrier des 6 prochains mois',en?'Dated events and their odds':'Événements datés et leur probabilité','#marche']].filter(Boolean);
  var q=["Nvidia","HBM","Stargate","DeepSeek","TSMC"];
  return'<div class="ssug">'+c.map(function(x){return'<a class="scard" href="'+x[2]+'" data-sr="'+x[2]+'"'+(x[3]?' data-ess="1"':'')+'><span><b>'+esc(x[0])+'</b><i>'+esc(x[1])+'</i></span><em>'+ARW+'</em></a>'}).join("")+'</div><p class="sfreq">'+(en?'Popular searches: ':'Recherches fréquentes : ')+q.map(function(w){return'<button type="button" data-sq="'+w+'">'+w+'</button>'}).join(" · ")+'</p>';
}
function sOpen(){var o=$("sov");o.hidden=false;document.body.style.overflow="hidden";var i=$("sq");i.value="";sRun("");i.focus()}
function sClose(){var o=$("sov");if(o.hidden)return;o.hidden=true;document.body.style.overflow=""}
document.addEventListener("click",function(e){
  if(e.target.closest("#mbtn")){var m=$("mnu");mSet(m.hidden);if(!m.hidden)sClose();return}
  if(e.target.closest("#sbtn")){mSet(false);sOpen();return}
  if(e.target.closest("[data-sclose]")){sClose();return}
  var sq=e.target.closest("[data-sq]");if(sq){var qi=$("sq");qi.value=sq.getAttribute("data-sq");sRun(qi.value);qi.focus();return}
  if(e.target.closest("[data-ess]")){S.top=true;S.limit=120;renderAll()}
  var r=e.target.closest("[data-sr]");
  if(r){e.preventDefault();var h=r.getAttribute("data-sr");sClose();if(location.hash===h)show(h.slice(1));else location.hash=h;return}
  if(e.target.closest("[data-sx]"))setTimeout(sClose,0);
});
document.addEventListener("input",function(e){if(e.target&&e.target.id==="sq")sRun(e.target.value)});
document.addEventListener("keydown",function(e){
  var tg=e.target&&e.target.tagName,typing=tg==="INPUT"||tg==="TEXTAREA"||(e.target&&e.target.isContentEditable);
  if(e.key==="Escape"){sClose();mSet(false);return}
  if((e.key==="/"&&!typing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k")){e.preventDefault();sOpen();return}
  if(e.key==="Enter"&&e.target&&e.target.id==="sq"){var f=document.querySelector("#sres .sr");if(f)f.click()}
});
window.addEventListener("hashchange",function(){show(location.hash.slice(1))});
setLang(S.lang);
show(location.hash.slice(1));
refresh();
})();
