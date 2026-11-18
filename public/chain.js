/* Schéma interactif « Du campus à la puce » : chargé en iframe par l'onglet Infrastructure.
   Données : data/chain.json (pièces, fiches marché) + data/layers.json (tension par couche) + data/en.json (traduction). */
(function(){
var qs=new URLSearchParams(location.search),LANG=qs.get("lang")==="en"?"en":"fr";
function get(u){return fetch(u,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(u+" "+r.status);return r.json()})}
function fail(e){var s=document.getElementById("sc");if(s)s.innerHTML='<p class="hint" style="padding:24px">Le schéma n\'a pas pu être chargé. Rechargez la page.</p>';try{console.error(e)}catch(x){}}
Promise.all([get("data/chain.json"),get("data/layers.json"),get("data/en.json").catch(function(){return {}}),get("data/watch.json").catch(function(){return null})]).then(function(r){
  var ten={};(r[1].layers||[]).forEach(function(l){ten[l.id]={t:l.tension,lab:l.tension_label,key:l.key_stat,note:l.note,leaders:l.leaders,src:l.sources}});
  run(r[0],ten,r[3]);
  if(window.I18N){I18N.extra(r[2]);I18N.set(LANG)}
  report();
}).catch(fail);
function report(){try{parent.postMessage({chainH:Math.ceil(document.querySelector(".wrap").getBoundingClientRect().height)},location.origin)}catch(e){}}
window.ChainFrame={setLang:function(l){LANG=l==="en"?"en":"fr";if(window.I18N)I18N.set(LANG);if(window.ChainFrame.refresh)window.ChainFrame.refresh();setTimeout(report,50)}};
if(window.ResizeObserver)new ResizeObserver(report).observe(document.documentElement);
window.addEventListener("load",report);
function run(CH,LY,WT){
var PARTS=CH.parts,U=CH.u,BMK=CH.bmk,DET=CH.det,FM=CH.fm,FMAP=CH.fmap,FMVIA=CH.fmvia,RULE=CH.rule,MKT={};
Object.keys(CH.mkt).forEach(function(k){var m=CH.mkt[k],o={};if(m.s)o.s=U[m.s];if(m.d)o.d=U[m.d];MKT[k]=o});

var BY={};CH.blocks.forEach(function(b){BY[b.id]=b});
var FAM={en:["Énergie","#EBA73A"],cool:["Refroidissement","#5B9BDB"],st:["Structure (bâtiment, boîtier, carte)","#D6CAB5"],calc:["Calcul","#34476B"],mem:["Mémoire","#34BBA0"],li:["Liaisons (électrique, cuivre, fibre, commutateurs)","#8B6FD6"],use:["Usages (modèles, applications)","#79C477"]};
var GRP={en:"en",cool:"cool",bld:"st",asm:"st",brd:"st",calc:"calc",mem:"mem",el:"li",cu:"li",op:"li",net:"li",use:"use",use2:"use"};
var PF={smr:"en",gas:"en",trf:"en",bld:"bld",cool:"cool",fibc:"op",models:"use2",apps:"use",rack:"calc",bus:"en",loop:"cool",sw:"net",fib:"op",cu:"cu",cold:"cool",dies:"calc",fab:"calc",hbm:"mem",wires:"el",ip:"asm",cpo:"op",sub:"asm",pcb:"brd",power:"en",aec:"cu",mod:"op",las:"op",sw2:"net"};
var FC={en:"#EBA73A",cool:"#5B9BDB",bld:"#E3DACB",calc:"#34476B",mem:"#34BBA0",asm:"#D6CAB5",brd:"#BFB29C",cu:"#8B6FD6",op:"#B9A5F0",el:"#5B45A3",net:"#7458C4",use:"#79C477",use2:"#58AB57"};
var ZOOM={bld:1,rack:2};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function Z(b,k,extra){return"calc("+b+"px + "+k+" * var(--gap)"+(extra?" + "+extra:"")+")"}
var BUILDING=false,RECBY={};
function box(o){
 if(BUILDING){(RECBY[o.p]=RECBY[o.p]||[]).push(o)}
 var d=typeof o.d==="number"?o.d+"px":o.d;
 return'<div class="bx '+(o.f?"f-"+o.f+" ":"")+(o.c||"")+'" data-part="'+o.p+'" data-fam="'+(o.f||"")+'" style="--w:'+o.w+'px;--h:'+o.h+'px;--d:'+d+';width:'+o.w+'px;height:'+o.h+'px;transform:translate3d('+o.x+'px,'+o.y+'px,'+(o.z||Z(o.b||0,o.k||0))+')"><i class="t"></i><i class="fr"></i><i class="bk"></i><i class="lf"></i><i class="rt"></i></div>';
}
function flat(o){if(BUILDING){o.flat=true;(RECBY[o.p]=RECBY[o.p]||[]).push(o)}return'<div class="fl '+(o.c||"")+'" data-part="'+o.p+'" data-fam="'+(o.f||"")+'" style="width:'+o.w+'px;height:'+o.h+'px;transform:translate3d('+o.x+'px,'+o.y+'px,'+(o.z||Z(o.b||0,o.k||0))+')"></div>'}
/* ---------- levels ---------- */
function buildCampus(){
 var h="";
 h+=box({c:"ground",p:"ground",x:-620,y:-300,w:1240,h:530,d:1,b:0});
 // energy: SMR ghosts, gas turbines, transformers
 h+=box({f:"en",c:"ghost",p:"smr",x:-560,y:-205,w:70,h:70,d:70,b:1});
 h+=box({f:"en",c:"ghost",p:"smr",x:-470,y:-205,w:70,h:70,d:70,b:1});
 h+=box({f:"en",p:"gas",x:-560,y:-80,w:120,h:38,d:30,b:1});h+=box({f:"en",p:"gas",x:-560,y:-30,w:120,h:38,d:30,b:1});
 h+=box({f:"en",p:"gas",x:-446,y:-72,w:10,h:10,d:56,b:1});h+=box({f:"en",p:"gas",x:-446,y:-22,w:10,h:10,d:56,b:1});
 [-540,-490,-440].forEach(function(x){h+=box({f:"en",p:"trf",x:x,y:40,w:36,h:36,d:30,b:1})});
 h+=flat({c:"c-en dash",p:"smr",x:-400,y:-173,w:150,h:6,b:1.5});h+=flat({c:"c-en dash",p:"smr",x:-253,y:-173,w:6,h:80,b:1.5});h+=flat({c:"c-en dash",p:"smr",x:-253,y:-99,w:73,h:6,b:1.5});
 h+=flat({c:"c-en",p:"gas",x:-436,y:-54,w:256,h:6,b:1.5});
 h+=flat({c:"c-en",p:"trf",x:-404,y:55,w:224,h:6,b:1.5});
 // building
 h+=box({f:"bld",c:"roof",p:"bld",x:-180,y:-110,w:360,h:220,d:60,b:1});
 // cooling yard
 for(var i=0;i<5;i++)h+=box({f:"cool",c:"fan",p:"cool",x:-170+i*70,y:138,w:56,h:46,d:26,b:1});
 for(i=0;i<5;i++)h+=flat({c:"c-cool",p:"cool",x:-145+i*70,y:110,w:6,h:28,b:1.5});
 // usages
 h+=box({f:"use2",p:"models",x:300,y:-120,w:100,h:100,d:120,b:1});
 [40,70,55,80,45,65].forEach(function(d,j){h+=box({f:"use",p:"apps",x:320+(j%3)*52,y:30+Math.floor(j/3)*52,w:38,h:38,d:d,b:1})});
 h+=flat({c:"c-op",p:"fibc",x:180,y:-73,w:120,h:6,b:1.5});h+=flat({c:"c-op",p:"fibc",x:240,y:-73,w:6,h:128,b:1.5});h+=flat({c:"c-op",p:"fibc",x:240,y:49,w:80,h:6,b:1.5});
 return h;
}
var CAMPUS_L=[["smr",[-525,-170,70,0]],["gas",[-500,-60,30,0]],["trf",[-490,58,30,0]],["bld",[0,0,60,0]],["cool",[0,160,26,0]],["fibc",[240,-10,2,0]],["models",[350,-70,120,0]],["apps",[372,60,80,0]]];
function buildHall(){
 var h="";
 h+=box({c:"floor",p:"floor",x:-330,y:-240,w:650,h:440,d:2,b:0});
 var rows=[-150,-60,30,120],X0=-250;
 rows.forEach(function(y,ri){for(var i=0;i<8;i++){
  h+=box({f:"calc",c:(ri===1&&i===3)?"tgt":"",p:"rack",x:X0+i*42,y:y,w:34,h:52,d:80,b:2});
  if(ri===0)h+=flat({c:"c-cu",p:"cu",x:X0+i*42+9,y:y+24,w:16,h:4,b:82.5});
 }
 h+=flat({c:"c-en",p:"bus",x:X0,y:y+18,w:336,h:6,b:90});
 h+=flat({c:"c-op",p:"fib",x:X0,y:y+30,w:420,h:4,b:94});
 h+=box({f:"net",p:"sw",x:170,y:y+12,w:70,h:28,d:50,b:2});});
 [-82,8,98].forEach(function(y){h+=flat({c:"c-cool",p:"loop",x:-330,y:y,w:650,h:6,b:2.5});h+=box({f:"cool",p:"loop",x:-352,y:y-12,w:22,h:30,d:40,b:0})});
 return h;
}
var HALL_L=[["rack",[-80,-34,82,0]],["bus",[-200,-132,90,0]],["loop",[-100,-79,3,0]],["sw",[205,-124,52,0]],["fib",[130,-116,94,0]],["cu",[-240,-124,83,0]]];
function buildPkg(){
 var h="";
 h+=box({f:"brd",p:"pcb",x:-250,y:-210,w:640,h:420,d:8,b:0,k:0});
 [[-236,-120,34,66],[-236,-33,34,66],[-236,54,34,66]].forEach(function(v){h+=box({f:"en",p:"pcb",x:v[0],y:v[1],w:v[2],h:v[3],d:14,b:8,k:0})});
 h+=flat({c:"ball",p:"sub",x:-170,y:-140,w:340,h:280,b:8.4,k:.5});
 h+=flat({c:"wl",p:"pcb",x:170,y:-101,w:84,h:8,b:8.3,k:0});
 h+=flat({c:"wl",p:"pcb",x:170,y:93,w:74,h:8,b:8.3,k:0});
 h+=box({f:"asm",c:"sub",p:"sub",x:-170,y:-140,w:340,h:280,d:10,b:8,k:1});
 h+=box({f:"asm",c:"ip",p:"ip",x:-140,y:-105,w:280,h:210,d:6,b:18,k:2});
 [[-166,-84],[-166,16],[146,-84],[146,16]].forEach(function(v){h+=box({f:"op",p:"cpo",x:v[0],y:v[1],w:20,h:68,d:12,b:18,k:2})});
 h+=flat({c:"w",p:"wires",x:-102,y:-99,w:22,h:198,b:24.3,k:2});
 h+=flat({c:"w",p:"wires",x:80,y:-99,w:22,h:198,b:24.3,k:2});
 var rows=[-99,-49,1,51];
 [-130,102].forEach(function(x0){rows.forEach(function(y0){
  h+=box({f:"mem",c:"mem-base",p:"hbm",x:x0,y:y0,w:28,h:44,d:4,b:24,k:3});
  for(var i=0;i<4;i++)(function(i){h+=box({f:"mem",p:"hbm",x:x0,y:y0,w:28,h:44,d:3,z:"calc(28px + "+(i*3)+"px + 3 * var(--gap) + "+(i+1)+" * var(--sg))",zf:function(G,S){return 28+i*3+3*G+(i+1)*S}})})(i);
  [6,19].forEach(function(dx){h+=box({f:"el",c:"tsv",p:"hbm",x:x0+dx,y:y0+20,w:2,h:3,d:"calc(15px + 4 * var(--sg))",z:"calc(28px + 3 * var(--gap))",zf:function(G,S){return 28+3*G},dn:function(S){return 15+4*S}})});
 })});
 h+=box({f:"calc",p:"dies",x:-80,y:-75,w:76,h:150,d:9,b:24,k:3});
 h+=box({f:"calc",p:"dies",x:4,y:-75,w:76,h:150,d:9,b:24,k:3});
 h+=box({f:"cool",c:"cold",p:"cold",x:-135,y:-115,w:270,h:230,d:14,b:42,k:4});
 h+=box({f:"cu",p:"aec",x:250,y:-118,w:40,h:36,d:16,b:8,k:1});
 h+=box({f:"cu",p:"aec",x:290,y:-106,w:210,h:12,d:8,b:8,k:1});
 h+=box({f:"op",p:"mod",x:240,y:70,w:90,h:60,d:24,b:8,k:1});
 h+=box({f:"op",p:"las",x:262,y:90,w:20,h:20,d:6,b:32,k:2,c:"las"});
 h+=box({f:"op",c:"fib",p:"mod",x:330,y:95,w:170,h:3,d:3,b:14,k:1});
 h+=box({f:"op",c:"fib",p:"mod",x:330,y:104,w:170,h:3,d:3,b:14,k:1});
 h+=box({f:"op",c:"fib",p:"cpo",x:166,y:-52,w:330,h:3,d:3,b:20,k:2});
 h+=box({f:"op",c:"fib",p:"cpo",x:166,y:50,w:330,h:3,d:3,b:20,k:2});
 h+=box({f:"op",c:"fib",p:"cpo",x:-300,y:-52,w:134,h:3,d:3,b:20,k:2});
 h+=box({f:"op",c:"fib",p:"cpo",x:-300,y:50,w:134,h:3,d:3,b:20,k:2});
 return h;
}
var PKG_L=[["cold",[0,0,52,4]],["dies",[-42,-30,33,3]],["fab",[42,30,33,3]],["hbm",[116,-70,34,3]],["wires",[-92,40,24,2]],["ip",[0,100,24,2]],["cpo",[156,-50,30,2]],["sub",[0,-170,18,1]],["pcb",[-160,160,8,0]],["power",[-250,0,8,0]],["aec",[290,-100,24,1]],["mod",[285,100,32,1]],["las",[272,100,38,2]],["sw2",[500,0,12,1]]];
var LV=[
 {id:"campus",name:"Data center",ww:1010,cx:-10,cy:10,zc:30,rx:56,rz:-28,build:buildCampus,L:CAMPUS_L,rep:["energie","datacenter","modeles","applications","reseau"],lvZoom:"Zoomer : Salle ▸"},
 {id:"hall",name:"Salle",ww:610,cx:-10,cy:10,zc:50,rx:56,rz:-26,build:buildHall,L:HALL_L,rep:["calcul","datacenter","reseau","optique","cuivre"],lvZoom:"Zoomer : Module ▸"},
 {id:"pkg",name:"Module",ww:820,cx:125,cy:70,zc:null,rx:58,rz:-35,build:buildPkg,L:PKG_L,rep:["datacenter","calcul","memoire","packaging","optique","cuivre","reseau","energie"],lvZoom:""}
];
var cur=0,sel={part:null,block:null},gap=60,sg=9,moved=0;
var sc=document.getElementById("sc"),ly=document.getElementById("ly"),cr=document.getElementById("cr"),bz=document.getElementById("bz"),exw=document.getElementById("bx");
function init(){
 BUILDING=true;
 LV.forEach(function(v,i){
  var el=document.createElement("div");el.className="lvl";el.innerHTML='<div class="world"><div class="stack">'+v.build()+v.L.map(function(l,j){var a=l[1];return'<i class="an" data-i="'+j+'" style="transform:translate3d('+a[0]+'px,'+a[1]+'px,'+Z(a[2],a[3])+')"></i>'}).join("")+'</div></div><div class="ov"><svg></svg>'+v.L.map(function(l,j){var p=PARTS[l[0]];return'<button class="lb" style="--lc:'+FC[PF[l[0]]]+'" data-part="'+l[0]+'" data-i="'+j+'">'+esc(p.n)+'<small>'+esc(p.c)+'</small></button>'}).join("")+'</div>';
  sc.appendChild(el);v.el=el;v.wd=el.querySelector(".world");v.st=el.querySelector(".stack");v.ov=el.querySelector(".ov");v.sv=el.querySelector("svg");
 });
 BUILDING=false;
 buildIndex();
 go(0,true);
}
function go(i,quiet){
 cur=i;
 LV.forEach(function(v,j){v.el.className="lvl"+(j===i?" on":(j<i?" past":""))});
 cr.innerHTML=LV.map(function(v,j){return'<button data-lv="'+j+'" class="'+(j===i?"on":"")+'">'+v.name+'</button>'}).join("<span>›</span>");
 bz.classList.toggle("hide",i>=2);bz.textContent=LV[i].lvZoom;
 exw.classList.toggle("hide",i!==2);
 sel={part:null,block:null};
 chips();mark();view();
}
function chips(){
 ly.innerHTML=''+CH.blocks.map(function(b){return'<button class="chip" data-block="'+b.id+'" title="'+esc(b.short)+'"><b>'+b.n+'</b>'+esc(b.name)+'</button>'}).join("");
 ly.querySelectorAll(".chip").forEach(function(e){e.classList.toggle("sel",e.getAttribute("data-block")===sel.block)});
}
function view(){
 var v=LV[cur],W=sc.clientWidth;
 LV.forEach(function(u){
  var S=Math.min(1.1,Math.max(.4,(W-(W<900?20:400))/u.ww));
  u.wd.style.setProperty("--rx",u.rx+"deg");u.wd.style.setProperty("--rz",u.rz+"deg");u.wd.style.setProperty("--s",S);
  u.st.style.setProperty("--gap",gap+"px");u.st.style.setProperty("--sg",sg+"px");
  var zc=u.zc==null?-(2*gap+20):-u.zc;
  u.st.style.transform="translate3d("+(-u.cx)+"px,"+(-u.cy)+"px,"+zc+"px)";
 });
 anim();
}
var raf=0,until=0;
function anim(){until=performance.now()+950;if(!raf)raf=requestAnimationFrame(tick)}
function tick(){place();if(performance.now()<until)raf=requestAnimationFrame(tick);else raf=0}
function place(){
 var v=LV[cur];if(sc.clientWidth<900)return;
 var r=sc.getBoundingClientRect(),W=r.width,H=r.height,P=[];
 v.L.forEach(function(l,i){var a=v.st.querySelector('.an[data-i="'+i+'"]').getBoundingClientRect();P.push({i:i,ax:a.left+a.width/2-r.left,ay:a.top+a.height/2-r.top})});
 P.sort(function(a,b){return a.ax-b.ax});var half=Math.ceil(P.length/2),lines="";
 [[P.slice(0,half),0,0],[P.slice(half),W-176,1]].forEach(function(g){var arr=g[0].sort(function(a,b){return a.ay-b.ay}),prev=g[2]?40:-40;
  arr.forEach(function(o){var y=Math.max(o.ay-18,prev+44);y=Math.min(y,H-44);prev=y;var el=v.ov.querySelector('.lb[data-i="'+o.i+'"]');el.style.left=g[1]+"px";el.style.top=y+"px";
   var lx=g[2]?g[1]:g[1]+176;lines+='<line x1="'+lx+'" y1="'+(y+18)+'" x2="'+o.ax+'" y2="'+o.ay+'"/><circle cx="'+o.ax+'" cy="'+o.ay+'" r="2.5"/>'});});
 v.sv.innerHTML=lines;
}
function fig(f){return'<div class="fig"><div class="v">'+esc(f.v)+'</div><div>'+esc(f.l)+'<div class="m">'+esc(f.as_of)+' · <a href="'+esc(f.u)+'" target="_blank" rel="noopener">'+esc(f.src)+' ↗</a></div></div></div>'}
function cls(t){return t==null?"":(t>=8?"hi":(t>=6?"mid":"lo"))}
var hovP=null;
var famCur=null;
function refreshCol(){
 LV.forEach(function(v){
  v.st.querySelectorAll("[data-part]").forEach(function(e){var p=e.getAttribute("data-part");
   var on=(sel.block&&inSel(p))||(hovP&&p===hovP)||(famCur&&GRP[e.getAttribute("data-fam")]===famCur);
   e.classList.toggle("col",!!on)});
  v.ov.querySelectorAll(".lb").forEach(function(e){var p=e.getAttribute("data-part");
   e.classList.toggle("fc",(hovP&&p===hovP)||(famCur&&PF[p]&&GRP[PF[p]]===famCur))});
 });
}
function inSel(p){return sel.part?p===sel.part:(PARTS[p]&&PARTS[p].b===sel.block)}
function mark(){
 LV.forEach(function(v){
  v.st.querySelectorAll("[data-part]").forEach(function(e){var on=sel.block&&inSel(e.getAttribute("data-part"));e.classList.toggle("sel",!!on&&e.classList.contains("bx"));e.classList.toggle("dim",!!sel.block&&!on)});
  v.ov.querySelectorAll(".lb").forEach(function(e){var on=sel.block&&inSel(e.getAttribute("data-part"));e.classList.toggle("sel",!!on);e.classList.toggle("dim",!!sel.block&&!on)});
 });
 ly.querySelectorAll(".chip").forEach(function(e){e.classList.toggle("sel",e.getAttribute("data-block")===sel.block)});
 refreshCol();duo();
}
function pick(part,block){sel={part:part,block:block};mark()}
function pickLayer(id){
 var lv=[];LV.forEach(function(v,i){if(v.L.some(function(l){return PARTS[l[0]]&&PARTS[l[0]].b===id}))lv.push(i)});
 if(lv.length&&lv.indexOf(cur)<0){go(lv.reduce(function(a,b){return Math.abs(b-cur)<Math.abs(a-cur)?b:a}))}
 pick(null,id);
}
/* ---------- recherche dans l'architecture ---------- */
var SX=[],SR=[],SI=-1;
function norm(t){return String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function buildIndex(){
 SX=[];
 CH.blocks.forEach(function(b){var subs=(b.subs||[]).map(function(x){return x.name}).join(" ");SX.push({k:"b",id:b.id,name:b.name,sub:"Couche "+b.n+" · "+b.short,t:norm(b.name+" "+b.short+" "+subs),nt:norm(b.name),ex:[]})});
 Object.keys(PARTS).forEach(function(p){
  var P=PARTS[p],b=BY[P.b],ex=[],key=FMAP[p],f=key&&FM[key];
  if(f){ex.push(f.name);if(f.pie)f.pie.items.forEach(function(i){ex.push(i.n)})}
  var m=MKT[p];if(m&&m.s)m.s.items.forEach(function(i){ex.push(i.n)});
  var lvs=[];LV.forEach(function(v,i){if(v.L.some(function(l){return l[0]===p}))lvs.push(i)});
  if(!lvs.length||!b)return;
  SX.push({k:"p",id:p,name:P.n,sub:"Couche "+b.n+" "+b.name+" · "+LV[lvs[0]].name,t:norm(P.n+" "+P.c+" "+P.r+" "+ex.join(" ")),nt:norm(P.n+" "+P.c),ex:ex,lv:lvs})});
}
function doSearch(q){
 var qn=norm(q).trim(),tk=qn.split(/\s+/).filter(Boolean),res=document.getElementById("res");
 if(!tk.length){SR=[];res.classList.add("hide");res.innerHTML="";return}
 SR=SX.filter(function(e){return tk.every(function(t){return e.t.indexOf(t)>=0})}).map(function(e){
  var sc=(e.nt.indexOf(qn)===0?4:(e.nt.indexOf(qn)>=0?3:(tk.every(function(t){return e.nt.indexOf(t)>=0})?2:0)))+(e.k==="b"?.5:0)+(e.k==="p"&&FMAP[e.id]===e.id?1.5:0);return{e:e,sc:sc}}).sort(function(a,b){return b.sc-a.sc}).slice(0,8).map(function(x){return x.e});
 SI=SR.length?0:-1;
 res.innerHTML=SR.length?SR.map(function(e,i){
  var via="";if(e.k==="p"&&e.sc!==undefined){}var hit=e.ex.filter(function(x){return tk.every(function(t){return norm(x).indexOf(t)>=0})})[0];
  if(e.k==="p"&&hit&&norm(e.name).indexOf(tk[0])<0)via=" · cité dans la fiche marché : "+hit;
  return'<button data-sx="'+i+'" class="'+(i===SI?"on":"")+'"><b>'+esc(e.name)+'</b><small>'+esc(e.sub+via)+'</small></button>'}).join(""):'<div class="none2">Aucun résultat dans l\'architecture.</div>';
 res.classList.remove("hide");
}
function chooseSearch(e){
 document.getElementById("res").classList.add("hide");
 if(e.k==="b"){pickLayer(e.id);return}
 if(e.lv.indexOf(cur)<0)go(e.lv[0]);
 pick(e.id,PARTS[e.id].b);
}
(function(){
 var q=document.getElementById("q"),res=document.getElementById("res");
 q.addEventListener("input",function(){doSearch(q.value)});
 q.addEventListener("focus",function(){if(q.value)doSearch(q.value)});
 q.addEventListener("keydown",function(ev){
  if(ev.key==="Escape"){res.classList.add("hide");q.blur();return}
  if(!SR.length)return;
  if(ev.key==="ArrowDown"||ev.key==="ArrowUp"){ev.preventDefault();SI=(SI+(ev.key==="ArrowDown"?1:-1)+SR.length)%SR.length;res.querySelectorAll("button").forEach(function(b,i){b.classList.toggle("on",i===SI)});return}
  if(ev.key==="Enter"){ev.preventDefault();chooseSearch(SR[Math.max(SI,0)])}
 });
 res.addEventListener("click",function(ev){var b=ev.target.closest("[data-sx]");if(b)chooseSearch(SR[+b.getAttribute("data-sx")])});
 document.addEventListener("click",function(ev){if(!ev.target.closest(".srch"))res.classList.add("hide")});
})();
document.addEventListener("click",function(e){
 var c=e.target.closest("[data-block]");if(c){pickLayer(c.getAttribute("data-block"));return}
 var z=e.target.closest("[data-lv]");if(z){go(+z.getAttribute("data-lv"));return}
 if(moved>4)return;
 var lb=e.target.closest(".lb[data-part]");if(lb){var p=lb.getAttribute("data-part");pick(p,PARTS[p].b);return}
 var t=e.target.closest(".bx[data-part],.fl[data-part]");
 if(!t&&e.target===sc){var hs=document.elementsFromPoint(e.clientX,e.clientY);for(var k=0;k<hs.length&&!t;k++)t=hs[k].closest&&hs[k].closest(".bx[data-part],.fl[data-part]")}
 if(t){var p2=t.getAttribute("data-part");if(!PARTS[p2])return;
  pick(p2,PARTS[p2].b)}
});
sc.addEventListener("dblclick",function(e){if(moved>4)return;var t=e.target.closest(".bx[data-part],.fl[data-part]");if(!t)return;var p=t.getAttribute("data-part");if(ZOOM[p]!=null&&ZOOM[p]===cur+1)go(cur+1)});
bz.addEventListener("click",function(){if(cur<2)go(cur+1)});
sc.addEventListener("mouseover",function(e){var t=e.target.closest(".bx[data-part],.fl[data-part],.lb[data-part]");var p=t?t.getAttribute("data-part"):null;if(p!==hovP){hovP=p;refreshCol()}});
sc.addEventListener("mouseleave",function(){hovP=null;refreshCol()});
var bx=document.getElementById("bx"),expl=false;
function setGap(v){gap=v*.9;sg=v*.13;view();expl=v>40;bx.textContent=expl?"Assembler":"Éclater"}
bx.addEventListener("click",function(e){e.stopPropagation();setGap(expl?0:70)});
document.getElementById("br").addEventListener("click",function(e){e.stopPropagation();var d=[[56,-28],[56,-26],[58,-35]][cur];LV[cur].rx=d[0];LV[cur].rz=d[1];setGap(0);sel={part:null,block:null};mark();view()});
var dr=null;
sc.addEventListener("pointerdown",function(e){if(e.target.closest(".lb,.acts"))return;var v=LV[cur];dr={x:e.clientX,y:e.clientY,rx:v.rx,rz:v.rz,id:e.pointerId,cap:0};moved=0});
sc.addEventListener("pointermove",function(e){if(!dr)return;var v=LV[cur];moved=Math.abs(e.clientX-dr.x)+Math.abs(e.clientY-dr.y);if(moved>4&&!dr.cap){dr.cap=1;try{sc.setPointerCapture(dr.id)}catch(_){}}v.rz=dr.rz+(e.clientX-dr.x)*.3;v.rx=Math.max(15,Math.min(85,dr.rx-(e.clientY-dr.y)*.3));view()});
sc.addEventListener("pointerup",function(){dr=null;setTimeout(function(){moved=0},0)});
window.addEventListener("resize",function(){chips();view()});
/* ---------- marché : parts + demande (chiffres datés et sourcés) ---------- */
var HBMFILTER=function(o){return o.x>=-130&&o.x<=-102&&o.y>=-99&&o.y<=-55};
function fmt(v){return String(v).replace(".",",")}
function mini(part){
 var R=(RECBY[part]||[]).filter(function(o){if(o.flat&&(o.w>140||o.h>140))return false;return part==="hbm"?HBMFILTER(o):true});
 if(!R.length)return"";
 var G=part==="hbm"?0:30,S=part==="hbm"?14:6,L=[],mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9,mnz=1e9,mxz=-1e9;
 R.forEach(function(o){var z=o.zf?o.zf(G,S):(o.b||0)+(o.k||0)*G,d=o.flat?.6:(o.dn?o.dn(S):(typeof o.d==="number"?o.d:10));
  L.push({o:o,z:z,d:d});mnx=Math.min(mnx,o.x);mxx=Math.max(mxx,o.x+o.w);mny=Math.min(mny,o.y);mxy=Math.max(mxy,o.y+o.h);mnz=Math.min(mnz,z);mxz=Math.max(mxz,z+d)});
 var cx=(mnx+mxx)/2,cy=(mny+mxy)/2,cz=(mnz+mxz)/2,ext=Math.max(mxx-mnx,mxy-mny,(mxz-mnz)*1.2,1),sc=Math.min(7,Math.max(.5,330/ext));
 var wasB=BUILDING;BUILDING=false;
 var h=L.map(function(e){var o=e.o,c=Object.assign({},o,{x:o.x-cx,y:o.y-cy,z:(e.z-cz)+"px",d:e.d});delete c.zf;return o.flat?flat(c):box(c)}).join("");
 BUILDING=wasB;
 return'<div class="mw" data-sc="'+sc+'" style="transform:rotateX(58deg) scale('+sc+')"><div class="spin">'+h+'</div></div>';
}
/* ---------- fiche marché unifiée : camembert | chiffre d'affaires | tension (chiffres datés et sourcés) ---------- */
function tens(f){var g=f.gap?f.gap.hi:0,t=g>=30?9:(g>=20?8:(g>=10?6:3));if(f.lead&&f.lead>=36)t=Math.max(t,9);return t}
function tlab(t){return t>=8?"Critique":(t>=6?"Élevé":(t>=4?"Modéré":"Faible"))}
function tensInfo(part){
 var P=PARTS[part],key=FMAP[part],f=key&&FM[key],b=BY[P.b],l=b.layer&&LY[b.layer];
 if(f&&(f.gap||f.lead)){var ev=(f.evid||[]);return{t:tens(f),why:f.why+(f.leadTxt?" Délai : "+f.leadTxt+".":""),ev:ev,basis:"Déduite des écarts et délais documentés",rule:RULE}}
 if(l&&l.t!=null)return{t:l.t,why:((l.key?l.key.replace(/\.?$/,"."):"")+(l.note?" "+l.note:"")).trim(),ev:[],links:(l.src||[]).slice(0,3),basis:"Niveau de la couche",rule:""};
 return null}
var SH=function(c,i){return/^(autres?|other)/i.test(c||"")?"var(--cg)":"var(--c"+(Math.min(i,5)+1)+")"};
function fmtPct(v){return String(v).replace(".",",")+" %"}
function nice(v){var p=Math.pow(10,Math.floor(Math.log10(v))),a=[1,1.5,2,2.5,3,4,5,6,8,10];for(var i=0;i<a.length;i++)if(a[i]*p>=v)return a[i]*p;return 10*p}
function fv(v){return fmt(v>=10?Math.round(v*10)/10:Math.round(v*100)/100)}
function donut2(items){
 var tot=items.reduce(function(a,x){return a+x.v},0),R=52,r=32,c=60,a0=-Math.PI/2,out="";
 items.forEach(function(x,i){
  var a1=a0+x.v/tot*2*Math.PI,big=(a1-a0)>Math.PI?1:0;
  var P=function(rad,a){return(c+rad*Math.cos(a)).toFixed(2)+" "+(c+rad*Math.sin(a)).toFixed(2)};
  var d=items.length===1?"M"+(c-R)+" "+c+" A"+R+" "+R+" 0 1 1 "+(c+R)+" "+c+" A"+R+" "+R+" 0 1 1 "+(c-R)+" "+c+" Z":"M"+P(R,a0)+" A"+R+" "+R+" 0 "+big+" 1 "+P(R,a1)+" L"+P(r,a1)+" A"+r+" "+r+" 0 "+big+" 0 "+P(r,a0)+" Z";
  out+='<path d="'+d+'" style="fill:'+SH(x.n,i)+'" stroke="#fff" stroke-width="1.5"><title>'+esc(x.n)+' : '+fmtPct(fmt(Math.round(x.v/tot*1000)/10))+'</title></path>';a0=a1});
 return'<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Camembert">'+out+'</svg>'}
/* camembert issu d'une ancienne série de parts (%) : on complète à 100 % quand le total est inférieur */
function sPie(s){
 if(!s||!s.items||!s.items.length||s.su!=="%")return null;
 var tot=s.items.reduce(function(a,i){return a+i.v},0);if(tot>100.5)return null;
 var items=s.items.map(function(i){return{n:i.n,v:i.v,ap:i.ap,min:i.min}});
 if(tot<99.5)items.push({n:"Autres (calculé)",v:Math.round((100-tot)*10)/10});
 return{t:s.t,m:"Part du marché",items:items,as_of:s.as_of,src:s.src,u:s.u,note:s.note||""}}
function piePanel(p){
 if(!p||!p.items||!p.items.length)return'<div class="col"><div class="none">Aucune visualisation disponible</div></div>';
 var tot=p.items.reduce(function(a,i){return a+i.v},0);
 var leg=p.items.map(function(it,i){var pc=Math.round(it.v/tot*1000)/10;return'<li><i style="background:'+SH(it.n,i)+'"></i><span>'+esc(it.n)+'</span><b>'+(it.min?'> ':(it.ap?'≈ ':''))+fmtPct(fmt(pc))+'</b></li>'}).join("");
 return'<div class="col"><h4>'+esc(p.t)+'</h4><div class="sm">'+esc(p.m)+'</div><div class="pie">'+donut2(p.items)+'<ul class="pleg">'+leg+'</ul></div><div class="sf"><a href="'+esc(p.u)+'" target="_blank" rel="noopener">'+esc(p.src)+' ↗</a> · '+esc(p.as_of)+'</div></div>'}
function lineChart(d){
 var W=560,H=170,pl=30,pr=30,pt=26,pb=30,n=d.pts.length,mx=0;d.pts.forEach(function(p){mx=Math.max(mx,p.v)});mx*=1.18;
 function X(i){return n===1?W/2:pl+(W-pl-pr)*i/(n-1)}function Y(v){return pt+(H-pt-pb)*(1-v/mx)}
 var C='var(--c1)',g='<line x1="'+pl+'" y1="'+(H-pb)+'" x2="'+(W-pr)+'" y2="'+(H-pb)+'" class="gl2"/><line x1="'+pl+'" y1="'+pt+'" x2="'+(W-pr)+'" y2="'+pt+'" class="gl"/>';
 for(var i=0;i<n-1;i++){var a=d.pts[i],b=d.pts[i+1],dash=(b.proj||b.calc||a.calc)?' stroke-dasharray="5 4"':'';g+='<line x1="'+X(i)+'" y1="'+Y(a.v)+'" x2="'+X(i+1)+'" y2="'+Y(b.v)+'" style="stroke:'+C+'" stroke-width="1.8"'+dash+'/>'}
 d.pts.forEach(function(p,i){var hollow=p.calc||p.proj;g+='<circle cx="'+X(i)+'" cy="'+Y(p.v)+'" r="3.6" style="fill:'+(hollow?'#fff':C)+';stroke:'+C+'" stroke-width="1.8"/><text class="vl" x="'+X(i)+'" y="'+(Y(p.v)-10)+'" text-anchor="middle">'+(p.min&&!p.l?'> ':'')+esc(p.l||fmt(p.v))+'</text><text class="ax" x="'+X(i)+'" y="'+(H-pb+17)+'" text-anchor="middle">'+esc(p.x)+'</text>'});
 return'<svg class="lc" viewBox="0 0 '+W+' '+H+'">'+g+'</svg>'}
function revChart(c){
 var W=560,H=184,L=38,R=22,T=10,B=24,n=c.x.length,mx=0;
 c.ser.forEach(function(s){s.v.forEach(function(v){if(v>mx)mx=v})});mx=nice(mx*1.04);
 function X(i){return L+(W-L-R)*i/(n-1)}function Y(v){return T+(H-T-B)*(1-v/mx)}
 var g='';
 [0,.5,1].forEach(function(k){var yy=Y(mx*k).toFixed(1);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" class="'+(k?'gl':'gl2')+'"/><text x="'+(L-5)+'" y="'+(+yy+3)+'" text-anchor="end" class="ax">'+fv(mx*k)+'</text>'});
 c.x.forEach(function(x,i){g+='<text x="'+X(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" class="ax">'+esc(x)+'</text>'});
 c.ser.forEach(function(s,i){
  var col=SH(s.n,i),d="";s.v.forEach(function(v,k){d+=(k?'L':'M')+X(k).toFixed(1)+' '+Y(v).toFixed(1)});
  g+='<path d="'+d+'" fill="none" style="stroke:'+col+'" stroke-width="1.9" stroke-linejoin="round"'+(s.dash?' stroke-dasharray="6 4"':'')+'/>';
  s.v.forEach(function(v,k){var hol=(s.hol||[]).indexOf(k)>=0,last=k===n-1;g+='<circle cx="'+X(k).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="'+(last?3.4:2.4)+'" style="'+(hol?'fill:#fff;stroke:'+col+';stroke-width:1.6':'fill:'+col)+'"><title>'+esc(s.n+" · "+c.x[k]+" : "+fv(v)+(s.eur?" Md€":" Md$")+(hol?" (calculé)":""))+'</title></circle>'})});
 var leg=c.ser.map(function(s,i){
  var a=s.v[n-1],b=s.v[n-5],hl=s.hol||[],gr=(b>0&&!(s.interp&&(hl.indexOf(n-1)>=0||hl.indexOf(n-5)>=0)))?Math.round((a/b-1)*100):null;
  return'<li><svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true"><path d="M0 4H22" style="stroke:'+SH(s.n,i)+'" stroke-width="2"'+(s.dash?' stroke-dasharray="6 4"':'')+' fill="none"/></svg><span>'+esc(s.n)+'</span><b>'+fv(a)+(s.eur?' Md€':' Md$')+'</b>'+(gr==null?'<em class="dl"></em>':'<em class="dl '+(gr>=0?'up':'dn')+'" title="Variation sur un an">'+(gr>=0?'▲ ':'▼ ')+Math.abs(gr)+' %</em>')+'</li>'}).join("");
 return'<svg class="lc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Chiffre d\'affaires par trimestre">'+g+'</svg><ul class="cleg">'+leg+'</ul>'}
function qIdx(l){var m=/^T([1-4]) (\d\d)$/.exec(l||"");return m?(2000+ +m[2])*4+(+m[1]-1):null}
function qLab(i){return"T"+(i%4+1)+" "+String(Math.floor(i/4)).slice(2)}
function dueQ(lag){var n=Date.now(),y0=new Date().getUTCFullYear(),b=null;for(var y=y0-1;y<=y0;y++)for(var q=1;q<=4;q++)if(Date.UTC(y,q*3,0)+lag*864e5<=n){var i=y*4+q-1;if(b==null||i>b)b=i}return b}
function staleTag(ch){var l=qIdx(ch.x[ch.x.length-1]),d=dueQ(ch.lag||50);return(l!=null&&d!=null&&l<d)?' · <span class="stl"><span>À actualiser</span> : '+qLab(d)+'</span>':''}
function chartPanel(ch,rv){
 if(ch)return'<div class="col"><h4>'+esc(ch.t)+'</h4><div class="sm">'+esc(ch.u)+'</div>'+revChart(ch)+'<div class="sf">'+'<span>'+esc(ch.as_of)+'</span> · <span>Sources ci-dessous</span>'+staleTag(ch)+'</div></div>';
 if(rv&&rv.pts&&rv.pts.length)return'<div class="col"><h4>'+esc(rv.t)+'</h4><div class="sm">'+esc(rv.u)+'</div>'+lineChart(rv)+'<div class="sf"><a href="'+esc(rv.url)+'" target="_blank" rel="noopener">'+esc(rv.src)+' ↗</a> · '+esc(rv.as_of)+'</div></div>';
 return'<div class="col"><div class="none">Aucune visualisation disponible</div></div>'}
function ringHtml(t,c){
 var R=46,C=2*Math.PI*R;
 return'<svg class="ring '+c+'" viewBox="0 0 120 120" role="img" aria-label="Tension '+t+' sur 10"><circle cx="60" cy="60" r="'+R+'" class="bg"/><circle cx="60" cy="60" r="'+R+'" class="fg" stroke-dasharray="'+(C*t/10).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 60 60)"/><text x="60" y="64" text-anchor="middle" class="rn">'+t+'</text><text x="60" y="82" text-anchor="middle" class="rd">/10</text></svg>'}
function tensPanel(ti){
 if(!ti)return'<div class="col"><div class="none">Aucune visualisation disponible</div></div>';
 var c=cls(ti.t);
 return'<div class="col tcol '+c+'"><h4>Tension</h4><div class="sm">Niveau de 0 à 10</div><div class="tr0">'+ringHtml(ti.t,c)+'<div class="tl"><b class="tv">'+tlab(ti.t)+'</b><span class="why1">'+esc(ti.why)+'</span></div></div></div>'}
function notesHtml(f,pie,ch,rv,ti){
 var h="";
 if(pie){h+='<div class="nb"><div class="st">Camembert</div>'+(pie.note?'<p>'+esc(pie.note)+'</p>':'')+'<div class="src">'+esc(pie.as_of)+' · <a href="'+esc(pie.u)+'" target="_blank" rel="noopener">'+esc(pie.src)+' ↗</a></div></div>'}
 else if(f&&f.pieNote)h+='<div class="nb"><div class="st">Camembert</div><p>'+esc(f.pieNote)+'</p></div>';
 if(ch){
  var pl=(ch.proj||[]).concat(ch.oth||[]).map(function(x){return'<li><b>'+esc(x.v)+'</b> · '+esc(x.l)+' · '+esc(x.as_of)+' · <a href="'+esc(x.u)+'" target="_blank" rel="noopener">'+esc(x.src)+' ↗</a></li>'}).join("");
  h+='<div class="nb"><div class="st">Chiffre d\'affaires</div><p>'+esc(ch.note||"")+'</p><div class="src">'+esc(ch.as_of)+' · '+ch.srcs.map(function(x){return'<a href="'+esc(x[1])+'" target="_blank" rel="noopener">'+esc(x[0])+' ↗</a>'}).join(" · ")+'</div>'+(pl?'<ul class="pl">'+pl+'</ul>':'')+'</div>'}
 else if(rv&&rv.pts&&rv.pts.length&&rv.note)h+='<div class="nb"><div class="st">Chiffre d\'affaires</div><p>'+esc(rv.note)+'</p></div>';
 if(ti){h+='<div class="nb"><div class="st">Tension</div><p>'+esc(ti.why)+'</p>'+evRows(ti.ev||[])+(ti.links||[]).map(function(x){return'<div class="src"><a href="'+esc(x.u)+'" target="_blank" rel="noopener">'+esc(x.t)+' ↗</a></div>'}).join("")+'<div class="src">'+esc(ti.basis)+'</div>'+(ti.rule?'<div class="rule">'+esc(ti.rule)+'</div>':'')+'</div>'}
 return h?'<details class="why"><summary>Sources, méthode et limites</summary>'+h+'</details>':""}
function evRows(a){return a.map(function(f){return'<div class="ev"><div class="v">'+esc(f.v)+'</div><div>'+esc(f.l)+'<div class="src">'+esc(f.as_of)+' · <a href="'+esc(f.u)+'" target="_blank" rel="noopener">'+esc(f.src)+' ↗</a></div></div></div>'}).join("")}
/* ---------- actualités du composant (watchlist, hors trading) : data/watch.json, produit par le collecteur ---------- */
var NSHOW=6;
function tx(fr,en){return LANG==="en"?en:fr}
function nwParts(){return sel.part?[sel.part]:(sel.block?Object.keys(PARTS).filter(function(p){return PARTS[p].b===sel.block}):[])}
function nwGroups(){
 if(!WT||!WT.groups)return[];var ps=nwParts();
 return Object.keys(WT.groups).filter(function(g){return WT.groups[g].parts.some(function(p){return ps.indexOf(p)>=0})})}
function nwDate(ts){try{return new Date(ts).toLocaleDateString(LANG==="en"?"en-GB":"fr-FR",{day:"numeric",month:"short"})}catch(e){return String(ts).slice(0,10)}}
function nwScore(x){return Date.parse(x.ts)+((x.imp||1)-1)*2*864e5}
function nwFollowed(gs){
 var seen={},key=[],em=[];
 gs.forEach(function(g){WT.groups[g].cos.forEach(function(c){if(seen[c.n])return;seen[c.n]=1;(c.k==="k"?key:em).push(c.n)})});
 return{key:key,em:em}}
function newsHtml(){
 if(!WT||!WT.items)return"";
 var gs=nwGroups();if(!gs.length)return"";
 var its=WT.items.filter(function(x){return x.g.some(function(g){return gs.indexOf(g)>=0})}).sort(function(a,b){return nwScore(b)-nwScore(a)});
 var shown=nwShown?its:its.slice(0,NSHOW),F=nwFollowed(gs);
 var nm=gs.map(function(g){return WT.groups[g].name}).join(" · ");
 var li=shown.map(function(x){
  var t=LANG==="en"?(x.title_en||x.title):x.title;
  var cs=(x.cos||[]).slice(0,3).map(function(c){return'<span class="nco">'+esc(c)+'</span>'}).join("");
  return'<li><time>'+esc(nwDate(x.ts))+'</time><div><a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(t)+'</a><div class="nm"><span>'+esc(x.source)+'</span>'+cs+'</div></div></li>'}).join("");
 var more=its.length>NSHOW&&!nwShown?'<button class="nmore" type="button">'+tx("Afficher les "+(its.length-NSHOW)+" autres","Show the other "+(its.length-NSHOW))+'</button>':"";
 var chips=function(a,c){return a.map(function(n){return'<span class="nco '+c+'">'+esc(n)+'</span>'}).join("")};
 return'<div class="nwh"><span class="st">'+tx("Actualités du composant","Component news")+'</span><span class="nsc">'+esc(nm)+'</span><span class="nfn">'+tx("Hors Bourse : ni cours, ni notes d'analystes","No stock prices or analyst ratings")+'</span></div>'+
  (li?'<ul class="nl">'+li+'</ul>'+more:'<div class="none2">'+tx("Aucune actualité récente sur les entreprises suivies pour ce composant.","No recent news on the companies tracked for this component.")+'</div>')+
  '<details class="wlst"><summary>'+tx("Entreprises suivies","Companies tracked")+' ('+(F.key.length+F.em.length)+')</summary><div class="wlb"><div class="wlr"><b>'+tx("Acteurs clés","Key players")+'</b>'+chips(F.key,"k")+'</div>'+
  (F.em.length?'<div class="wlr"><b>'+tx("Émergents","Emerging")+'</b>'+chips(F.em,"e")+'</div>':'')+'</div></details>'}
var nwShown=false;
function paintNews(){var el=document.getElementById("nw");if(el){el.innerHTML=newsHtml();bindNews()}}
function bindNews(){var b=document.querySelector("#nw .nmore");if(b)b.addEventListener("click",function(){nwShown=true;paintNews();report()})}
window.ChainFrame.refresh=paintNews;
function mkHtml(part){
 var P=PARTS[part],key=FMAP[part],f=key&&FM[key],m=MKT[part]||{},nm=f?f.name:P.n;
 var pie=f?f.pie:sPie(m.s),ch=f?(f.chart||null):null,rv=f?(f.rev||null):(m.d||null),ti=tensInfo(part);
 return'<div class="hd"><span class="kicker">Fiche marché</span><h3>'+esc(nm)+'</h3>'+(FMVIA[part]?'<span class="via">'+esc(FMVIA[part])+'</span>':'')+'</div>'+
  '<div class="g3">'+piePanel(pie)+chartPanel(ch,rv)+tensPanel(ti)+'</div>'+(WT?'<div class="nws" id="nw">'+newsHtml()+'</div>':'')+notesHtml(f,pie,ch,rv,ti)}


function duo(){
 var L=document.getElementById("sqL"),R=document.getElementById("sqR"),K=document.getElementById("mk");
 var part=sel.part||(sel.block?BMK[sel.block]:null);
 if(!part||!PARTS[part]){
  L.innerHTML='<span class="kicker">Zoom sur la pièce</span><div class="empty">Cliquez une pièce sur le schéma :<br>elle s\'affiche ici en gros, avec ses composants.</div>';
  R.innerHTML='<span class="kicker">Fiche technique</span><div class="empty">Ce que c\'est, à quoi ça sert, de quoi ça dépend et ce que ça alimente.</div>';
  K.innerHTML='<span class="kicker">Fiche marché</span><div class="empty" style="padding:34px 20px">Cliquez une pièce : part de marché, chiffre d\'affaires et tension.</div>';return}
 var P=PARTS[part],b=BY[P.b],fam=PF[part],dt=DET[part]||[],mh=mini(part);
 L.innerHTML='<div class="kk"><span class="kicker">Zoom sur la pièce</span><span class="tag">'+esc(b.name)+'</span></div><h3>'+esc(P.n)+'</h3>'+
  (mh?'<div class="mini">'+mh+'</div>':'<p class="big">'+esc(P.r)+'</p>')+
  (dt.length?'<div class="det">'+dt.map(function(r){return'<div><i style="background:'+FC[r[0]]+'"></i><p><b>'+esc(r[1])+'</b> <span>'+esc(r[2])+'</span></p></div>'}).join("")+'</div>':(mh?'<div class="det"><div><i style="background:'+FC[fam]+'"></i><p><span>'+esc(P.r)+'</span></p></div></div>':''));
 centerMini(L.querySelector(".mini"));
 function chs(a){return a.map(function(id){return'<button class="chip" data-block="'+id+'">'+BY[id].n+' '+esc(BY[id].name)+'</button>'}).join("")}
 var t='<div class="kk"><span class="kicker">Fiche technique</span><span class="tag">'+esc(P.c)+'</span></div><h3>'+esc(P.n)+'</h3><div class="ft">'+
  '<div class="blk"><div class="st">Ce que c\'est</div><p>'+esc(P.r)+'</p></div>'+
  '<div class="blk"><div class="st">À quoi ça sert dans l\'infrastructure</div><p>'+esc(b.why)+'</p></div>'+
  '<div class="blk"><div class="st">Dépend de</div><div class="cl">'+(b.needs.length?chs(b.needs):'<span class="src">Rien en amont dans ce schéma.</span>')+'</div></div>'+
  '<div class="blk"><div class="st">Alimente</div><div class="cl">'+(b.feeds.length?chs(b.feeds):'<span class="src">Dernier maillon du schéma.</span>')+'</div></div></div>';
 R.innerHTML=t;
 nwShown=false;K.innerHTML=mkHtml(part);bindNews();
}
function centerMini(box){
 if(!box)return;var mw=box.querySelector(".mw"),sp=box.querySelector(".spin");if(!mw||!sp)return;
 var S=parseFloat(mw.getAttribute("data-sc"))||1,Tx=0,Ty=0;
 var els=sp.querySelectorAll(".bx i,.fl");
 sp.style.animation="none";
 function meas(){var u=null;for(var a=0;a<360;a+=40){sp.style.transform="rotateZ("+a+"deg)";for(var i=0;i<els.length;i++){var r=els[i].getBoundingClientRect();if(!r.width&&!r.height)continue;if(!u)u={l:r.left,t:r.top,r:r.right,b:r.bottom};else{u.l=Math.min(u.l,r.left);u.t=Math.min(u.t,r.top);u.r=Math.max(u.r,r.right);u.b=Math.max(u.b,r.bottom)}}}return u}
 for(var it=0;it<3;it++){
  mw.style.transform="translate("+Tx+"px,"+Ty+"px) rotateX(58deg) scale("+S+")";
  var u=meas(),bb=box.getBoundingClientRect();if(!u)break;
  var cx=(u.l+u.r)/2,cy=(u.t+u.b)/2;
  Tx+=bb.left+bb.width/2-cx;Ty+=bb.top+bb.height/2-cy;
  if(it===0){var k=Math.min(bb.width*.8/(u.r-u.l),bb.height*.82/(u.b-u.t));S=Math.max(.3,Math.min(S*k,S*6,14))}
 }
 mw.style.transform="translate("+Tx+"px,"+Ty+"px) rotateX(58deg) scale("+S+")";
 sp.style.transform="";sp.style.animation="";
}
window.addEventListener("resize",function(){var m=document.querySelector("#sqL .mini");if(m)centerMini(m)});

init();setGap(0);
}
})();
