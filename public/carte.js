/* Carte du monde : datacenters (Epoch AI, CC BY 4.0) et usines de puces / mémoire (liste suivie à la main, un lien source par site). */
(function () {
"use strict";
var qs = new URLSearchParams(location.search), LANG = qs.get("lang") === "en" ? "en" : "fr";

var W = window.WORLD, RAD = Math.PI / 180, DEG = 180 / Math.PI;
var DLS = [], DLC = [], DLO = [];
for (var q = 0; q < W.dots.length; q += 2) { var la = W.dots[q] / 10 * RAD; DLS.push(Math.sin(la)); DLC.push(Math.cos(la)); DLO.push(W.dots[q + 1] / 10 * RAD); }
var T = {
  fr: {
    title: "Où est la puissance de calcul", dc: "Datacenters", logic: "Usines de puces", memory: "Usines de mémoire", packaging: "Assemblage avancé",
    now: "Aujourd'hui", plan: "Horizon prévu", us: "États-Unis", asia: "Asie de l'Est", eu: "Europe", reset: "Vue d'ensemble",
    sites: "datacenters suivis", mw: "puissance IT en service", h100: "équivalents H100", cmw: "puissance IT prévue", fabs: "usines de puces suivies",
    byc: "Puissance IT par pays (datacenters suivis par Epoch)", top: "Les plus gros sites", topPlan: "Les plus gros sites à l'horizon prévu", unit: "MW",
    hint: "Glissez pour tourner la Terre · molette ou + / − pour zoomer", lgLand: "Un point ≈ 140 km de terre", pick: "Cliquez un site sur le globe pour voir qui l'exploite, sa puissance et ce qui arrive ensuite.",
    owner: "Exploitant", users: "Utilisateurs", power: "Puissance IT en service", chips: "Puces", cost: "Investissement cumulé", next: "Prochain jalon", last: "Dernier jalon connu", loc: "Position",
    locA: "à l'adresse", locC: "à la commune près", likely: "probable", spec: "spéculatif", src: "Source", status: "Statut", co: "Entreprise", kind: "Type", asof: "Données Epoch du",
    st: { ramp: "Montée en cadence", build: "En construction", plan: "Projet", live: "En service (presse)", known: "Site recensé (statut non précisé)" }, kd: { logic: "Gravure de puces", memory: "Mémoire (DRAM, HBM, NAND)", packaging: "Assemblage avancé" },
    lgDc: "Datacenter (taille = puissance)", extra: "Presse (hors Epoch)", lgExtra: "Presse : annoncé ou recensé (hors Epoch)", lgLive: "Presse : en service (hors Epoch)", kdx: { site: "Site annoncé", zone: "Zone (plusieurs sites)" }, annw: "Capacité annoncée", annwLive: "Puissance IT en service (presse)", warnx: "Source presse, non vérifiée par Epoch. Ce point n'entre dans aucun total.", lgPlan: "Capacité prévue", lgZero: "Pas encore de puissance en service", lgOn: "Usine en production", lgBuild: "En construction", lgProj: "Projet",
    note1: "Datacenters : base « Frontier Data Centers » d'Epoch AI (licence CC BY 4.0). Elle recense les plus grands sites, surtout américains et chinois, entre 2024 et 2028 ; Epoch estime couvrir 44 % du calcul IA mondial (intervalle de confiance à 90 % : 29 à 77 %) : elle n'est pas exhaustive, et les petits sites ou ceux des pays moins documentés (Chine, Moyen-Orient, Europe…) y sont peu représentés. Coordonnées : OpenStreetMap, à l'adresse quand elle est connue, sinon à la commune.",
    note2: "Usines : liste choisie à la main, au moins un site par société pour les 10 premières fonderies (TSMC, Samsung, SMIC, UMC, GlobalFoundries, Hua Hong, Tower, VIS, Nexchip, PSMC) et les fabricants de DRAM et de NAND (Samsung, SK hynix, Micron, CXMT, Nanya, Kioxia, Sandisk, YMTC), plus Intel et Rapidus, chaque fiche cite sa source et son état à la date indiquée. Couverture par société, pas par usine : ce n'est pas un recensement complet. Fond de carte : Natural Earth.", note3: "Points « Presse » (gris) : sites et zones relevés à la main dans la presse (un lien par fiche), surtout en Chine, au Moyen-Orient, en Inde, en Corée, en Europe et chez les néoclouds (Nebius, Nscale, IREN) et chez les hyperscalers (Meta, Amazon, Google). Pleins : puissance en service déclarée ; en pointillés : capacité annoncée ou site recensé sans puissance publiée (taille fixe, la puissance annoncée n'est pas représentée par la taille). Hors des totaux d'Epoch. Chine : SemiAnalysis estime la flotte chinoise de datacenters (tous usages) à plus de 24 GW, bien au-delà de ce que montre Epoch. CoreWeave déclare 52 datacenters et plus de 1,7 GW de puissance active (679 MW dans Epoch) : 24 sont placés ici (Epoch et presse), les autres sont introuvables ou sans ville précise, et la puissance par site n'est pas publiée.",
    load: "Chargement de la carte…", err: "La carte n'a pas pu être chargée.", aria: "Voir la fiche de ", mwl: " MW", gw: " GW"
  },
  en: {
    title: "Where the compute is", dc: "Datacenters", logic: "Chip fabs", memory: "Memory fabs", packaging: "Advanced packaging",
    now: "Today", plan: "Planned", us: "United States", asia: "East Asia", eu: "Europe", reset: "Overview",
    sites: "datacenters tracked", mw: "IT power in service", h100: "H100 equivalents", cmw: "planned IT power", fabs: "chip fabs tracked",
    byc: "IT power by country (datacenters tracked by Epoch)", top: "Largest sites", topPlan: "Largest sites at the planned horizon", unit: "MW",
    hint: "Drag to spin the Earth · wheel or + / − to zoom", lgLand: "One dot ≈ 140 km of land", pick: "Click a site on the globe to see who runs it, its power and what comes next.",
    owner: "Operator", users: "Users", power: "IT power in service", chips: "Chips", cost: "Cumulative investment", next: "Next milestone", last: "Last known milestone", loc: "Position",
    locA: "at the street address", locC: "to the nearest town", likely: "likely", spec: "speculative", src: "Source", status: "Status", co: "Company", kind: "Type", asof: "Epoch data as of",
    st: { ramp: "Ramping", build: "Under construction", plan: "Planned", live: "In service (press)", known: "Listed site (status not stated)" }, kd: { logic: "Chip fabrication", memory: "Memory (DRAM, HBM, NAND)", packaging: "Advanced packaging" },
    lgDc: "Datacenter (size = power)", extra: "Press (not in Epoch)", lgExtra: "Press: announced or listed (not in Epoch)", lgLive: "Press: in service (not in Epoch)", kdx: { site: "Announced site", zone: "Zone (several sites)" }, annw: "Announced capacity", annwLive: "IT power in service (press)", warnx: "Press source, not verified by Epoch. This dot is in no total.", lgPlan: "Planned capacity", lgZero: "No power in service yet", lgOn: "Fab in production", lgBuild: "Under construction", lgProj: "Planned",
    note1: "Datacenters: Epoch AI's Frontier Data Centers database (CC BY 4.0). It covers the largest sites, mostly in the US and China, for 2024–2028; Epoch estimates it covers 44% of global AI compute (90% confidence interval: 29% to 77%): it is not exhaustive, and small sites or those in less-documented countries (China, Middle East, Europe…) are thinly represented. Coordinates: OpenStreetMap, at street address when known, otherwise to the town.",
    note2: "Fabs: a hand-picked list, at least one site per company for the top 10 foundries (TSMC, Samsung, SMIC, UMC, GlobalFoundries, Hua Hong, Tower, VIS, Nexchip, PSMC) and the DRAM and NAND makers (Samsung, SK hynix, Micron, CXMT, Nanya, Kioxia, Sandisk, YMTC), plus Intel and Rapidus; each entry cites its source and status as of the date shown. Coverage is by company, not by fab: it is not a full census. Base map: Natural Earth.", note3: "“Press” dots (grey): sites and zones collected by hand from the press (one link per card), mostly in China, the Middle East, India, Korea, Europe and among neoclouds (Nebius, Nscale, IREN) and hyperscalers (Meta, Amazon, Google) et chez les hyperscalers (Meta, Amazon, Google). Solid: reported power in service; dashed: announced capacity or listed site with no published power (fixed size: announced power is not shown by size). Outside Epoch's totals. China: SemiAnalysis estimates China's data center fleet (all uses) at over 24 GW, far above what Epoch shows. CoreWeave reports 52 data centers and over 1.7 GW of active power (679 MW in Epoch): 24 are placed here (Epoch and press), the rest could not be found or have no precise town, and per-site power is not published.",
    load: "Loading the map…", err: "The map could not be loaded.", aria: "Open the card for ", mwl: " MW", gw: " GW"
  }
};
var CN = { "United States": "États-Unis", China: "Chine", Malaysia: "Malaisie", Norway: "Norvège", "United Kingdom": "Royaume-Uni", Indonesia: "Indonésie", Finland: "Finlande", Australia: "Australie", Portugal: "Portugal", Iceland: "Islande", Sweden: "Suède", "United Arab Emirates": "Émirats arabes unis" };
var CC = { TW: ["Taïwan", "Taiwan"], US: ["États-Unis", "United States"], JP: ["Japon", "Japan"], DE: ["Allemagne", "Germany"], KR: ["Corée du Sud", "South Korea"], SG: ["Singapour", "Singapore"], CN: ["Chine", "China"], SA: ["Arabie saoudite", "Saudi Arabia"], FR: ["France", "France"], IN: ["Inde", "India"], FI: ["Finlande", "Finland"], GB: ["Royaume-Uni", "United Kingdom"], SE: ["Suède", "Sweden"], EE: ["Estonie", "Estonia"], CA: ["Canada", "Canada"], ES: ["Espagne", "Spain"], NO: ["Norvège", "Norway"], DK: ["Danemark", "Denmark"], IS: ["Islande", "Iceland"], MY: ["Malaisie", "Malaysia"] };
function t(k) { return T[LANG][k]; }
var NS = "http://www.w3.org/2000/svg";
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function nf(n, d) { return Number(n).toLocaleString(LANG === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: d || 0 }); }
function pw(mw) { return mw >= 1000 ? nf(mw / 1000, 2) + t("gw") : nf(mw) + t("mwl"); }
function dt(d) { try { return new Date(d + "T00:00:00Z").toLocaleDateString(LANG === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); } catch (e) { return d; } }
function country(c) { return LANG === "fr" ? (CN[c] || c) : c; }
function safeUrl(u) { return /^https:\/\/[^\s"<>]+$/.test(u || "") ? u : ""; }


var DC = null, FB = null, EX = { sites: [] }, ST = { layers: { dc: true, logic: false, memory: false, packaging: false, extra: false }, alert: true, mode: "now", sel: null, view: { lat: 49, lon: 12, z: 1 } };
var EUROPE = { lat: 49, lon: 12, z: 1 }, REG = { eu: EUROPE, us: { lat: 38, lon: -96, z: 2.1 }, asia: { lat: 31, lon: 115, z: 2.1 } };
var cv, ctx, box, tip, CW = 800, CH = 520, DPR = 1, ITEMS = [], SCR = [], raf = 0, anim = null, vel = { x: 0, y: 0 }, ptrs = {}, drag = { on: false, moved: false }, hov = null;
var NS_CHIP = { extra: "#8E8E93", dc: "var(--dc)", logic: "var(--logic)", memory: "var(--mem)", packaging: "var(--pack)" }, FCOL = { logic: "#5E5CE6", memory: "#FF3B30", packaging: "#FF9500" };

function load() {
  var h = document.getElementById("app");
  h.innerHTML = '<p class="kicker">' + t("load") + "</p>";
  Promise.all([fetch("data/datacenters.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }), fetch("data/fabs.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }), fetch("data/dc-extra.json").then(function (r) { return r.ok ? r.json() : { sites: [] }; }).catch(function () { return { sites: [] }; })])
    .then(function (a) { DC = a[0]; FB = a[1]; EX = a[2] && a[2].sites ? a[2] : { sites: [] }; build(); })
    .catch(function () { h.innerHTML = '<p class="kicker">' + t("err") + "</p>"; report(); });
}

function items() {
  var out = [], seen = {};
  DC.sites.forEach(function (s) { out.push({ k: "dc", id: "dc:" + s.id, d: s, lat: s.lat, lon: s.lon }); });
  FB.fabs.forEach(function (f) { out.push({ k: f.kind, id: "fb:" + f.id, d: f, lat: f.lat, lon: f.lon }); });
  EX.sites.forEach(function (x) { out.push({ k: "extra", id: "ex:" + x.id, d: x, lat: x.lat, lon: x.lon }); });
  out.forEach(function (it) {
    it.la = it.lat * RAD; it.lo = it.lon * RAD; it.sl = Math.sin(it.la); it.cl = Math.cos(it.la);
    var key = it.lat.toFixed(1) + "," + it.lon.toFixed(1); it.dup = seen[key] = (seen[key] || 0) + 1;
  });
  return out;
}
function mwOf(s) { return ST.mode === "plan" ? Math.max(s.mw, s.peak ? s.peak.mw : 0, s.next ? s.next.mw : 0) : s.mw; }
function sc() { return Math.sqrt(ST.view.z); }
function rOf(m) { return (m > 0 ? 2.4 + Math.sqrt(m) * 0.2 : 3.6) * sc(); }
function RR() { return Math.min(CW, CH) / 2 * 0.94 * ST.view.z; }

function build() {
  ITEMS = items();
  var h = document.getElementById("app");
  h.innerHTML =
    '<div class="bar" id="lay"></div><section class="tile"><div class="alert" id="al" role="status"><div class="alin"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FF3B30" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4"/><path d="M12 17h.01"/></svg><span><b id="alt"></b><i id="ald"></i></span><button type="button" class="alx" id="alx" aria-label="Fermer"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>' +
    '<div class="mapbox" id="mb"><canvas id="cv" role="img" aria-label="' + esc(t("title")) + '"></canvas><div class="tip hide" id="tp0"></div><div class="regs" id="rg"></div><div class="hintb">' + esc(t("hint")) + '</div>' +
    '<div class="zoom"><button class="zb" id="zi" aria-label="+"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button class="zb" id="zo" aria-label="−"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button></div></div>' +
    '<div class="leg" id="lg"></div></section><div class="fiche" id="fc"></div>' +
    '<section class="tile"><div class="thead"><span class="eb" id="kpe"></span><h2 id="kpt"></h2></div><div class="kpis" id="kp"></div></section>' +
    '<div class="cols"><section class="tile half"><div class="thead"><span class="eb" id="h1"></span><h2 id="h1t"></h2></div><div id="bc"></div></section><section class="tile half"><div class="thead"><span class="eb" id="h2"></span><h2 id="h2t"></h2></div><div id="tp"></div></section></div>' +
    '<p class="note" id="nt"></p>';
  cv = document.getElementById("cv"); ctx = cv.getContext("2d"); box = document.getElementById("mb"); tip = document.getElementById("tp0");
  size(); bind(); draw(); setTimeout(report, 60);
}

function size() {
  CW = box.clientWidth || 800; CH = Math.round(Math.min(640, Math.max(380, CW * 0.62))); DPR = window.devicePixelRatio || 1;
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR); cv.style.width = CW + "px"; cv.style.height = CH + "px";
}

function chips() {
  var L = ST.layers;
  var h = ["dc", "logic", "memory", "packaging"].concat(EX.sites.length ? ["extra"] : []).map(function (k) { return '<button class="chip' + (L[k] ? " on" : "") + '" data-l="' + k + '" aria-pressed="' + (L[k] ? "true" : "false") + '"><i class="k-' + k + '"></i>' + t(k) + "</button>"; }).join("");
  h += '<span class="sp"></span><span class="seg">' + ["now", "plan"].map(function (m) { return '<button class="' + (ST.mode === m ? "on" : "") + '" data-m="' + m + '">' + t(m) + "</button>"; }).join("") + "</span>";
  document.getElementById("lay").innerHTML = h;
  document.getElementById("rg").innerHTML = ["eu", "us", "asia"].map(function (r) { return '<button class="rb" data-r="' + r + '">' + t(r) + "</button>"; }).join("");
  var al = document.getElementById("al"); al.classList.toggle("open", !!ST.alert);
  document.getElementById("alt").textContent = LANG === "fr" ? "Environ 50 % des datacenters recensés" : "About 50% of data centers covered";
  document.getElementById("ald").textContent = LANG === "fr" ? "Bien couverts aux États-Unis, beaucoup moins en Chine, au Moyen-Orient et en Europe." : "Well covered in the US, far less in China, the Middle East and Europe.";
}

/* ---------- rendu du globe (projection orthographique) ---------- */
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(ts) {
  raf = 0;
  if (anim) {
    var k = Math.min(1, (ts - anim.t0) / anim.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, f = anim.from, g = anim.to, dl = ((g.lon - f.lon + 540) % 360) - 180;
    ST.view = { lat: f.lat + (g.lat - f.lat) * e, lon: f.lon + dl * e, z: f.z + (g.z - f.z) * e };
    if (k >= 1) anim = null;
  } else if (!drag.on && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
    rotate(vel.x, vel.y); vel.x *= 0.93; vel.y *= 0.93;
  }
  render();
  if (anim || (!drag.on && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02))) schedule();
}
function rotate(dx, dy) {
  var r = RR(), v = ST.view;
  v.lon = ((v.lon - dx / r * DEG + 540) % 360) - 180; v.lat = Math.max(-82, Math.min(82, v.lat + dy / r * DEG));
}
function render() {
  var v = ST.view, p0 = v.lat * RAD, l0 = v.lon * RAD, sp0 = Math.sin(p0), cp0 = Math.cos(p0), R = RR(), cx = CW / 2, cy = CH / 2, i, c, dl, x, y;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, CW, CH);
  // mer
  var gr = ctx.createRadialGradient(cx - R * 0.24, cy - R * 0.36, 0, cx - R * 0.24, cy - R * 0.36, R * 1.5);
  gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(1, "#E9E9EE");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
  var pj = function (la, lo) { var d = lo - l0, cl = Math.cos(la), cc = sp0 * Math.sin(la) + cp0 * cl * Math.cos(d); return [cx + R * cl * Math.sin(d), cy - R * (cp0 * Math.sin(la) - sp0 * cl * Math.cos(d)), cc]; };
  // terres : points, aplatis près du bord pour rendre la courbure
  var rd = 0.7 + R / 600, B = [[], [], [], []], al = [0.2, 0.38, 0.6, 0.82];
  for (i = 0; i < DLO.length; i++) {
    dl = DLO[i] - l0; var cd = Math.cos(dl);
    c = sp0 * DLS[i] + cp0 * DLC[i] * cd; if (c <= 0.02) continue;
    x = cx + R * DLC[i] * Math.sin(dl); y = cy - R * (cp0 * DLS[i] - sp0 * DLC[i] * cd);
    if (x < -4 || x > CW + 4 || y < -4 || y > CH + 4) continue;
    B[c < 0.2 ? 0 : c < 0.45 ? 1 : c < 0.75 ? 2 : 3].push(x, y, c);
  }
  ctx.fillStyle = "#9C9CA3";
  for (var bk = 0; bk < 4; bk++) {
    ctx.globalAlpha = al[bk]; ctx.beginPath(); var arr = B[bk];
    for (i = 0; i < arr.length; i += 3) {
      x = arr[i]; y = arr[i + 1]; c = arr[i + 2];
      if (c > 0.75) { ctx.moveTo(x + rd, y); ctx.arc(x, y, rd, 0, 6.2832); }
      else { var rot = Math.atan2(y - cy, x - cx), ry = rd * Math.max(0.28, c * 1.1); ctx.moveTo(x + Math.cos(rot) * ry, y + Math.sin(rot) * ry); ctx.ellipse(x, y, ry, rd, rot, 0, 6.2832); }
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // ombre du limbe
  var sh = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(30,30,25,.07)");
  ctx.fillStyle = sh; ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,.07)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
  // sites
  SCR = []; var s = sc(), vis = [];
  for (i = 0; i < ITEMS.length; i++) {
    var it = ITEMS[i]; if (!ST.layers[it.k]) continue;
    dl = it.lo - l0; var cdl = Math.cos(dl); c = sp0 * it.sl + cp0 * it.cl * cdl; if (c <= 0.03) continue;
    x = cx + R * it.cl * Math.sin(dl); y = cy - R * (cp0 * it.sl - sp0 * it.cl * cdl);
    if (it.dup > 1) { var an = it.dup * 2.4, rr = 6 * s * Math.ceil((it.dup - 1) / 6); x += Math.cos(an) * rr; y += Math.sin(an) * rr; }
    if (x < -20 || x > CW + 20 || y < -20 || y > CH + 20) continue;
    vis.push({ it: it, x: x, y: y, c: c, m: it.k === "dc" ? mwOf(it.d) : 0 });
  }
  vis.sort(function (p, q2) { return (p.it.k === "dc" ? 0 : 1) - (q2.it.k === "dc" ? 0 : 1) || q2.m - p.m; });
  vis.forEach(function (o) {
    var it = o.it, d = it.d, fade = Math.min(1, 0.3 + o.c * 1.4), sel = ST.sel === it.id, r;
    ctx.globalAlpha = fade;
    if (it.k === "dc") {
      r = rOf(o.m);
      if (ST.mode === "plan" && d.peak && d.peak.mw > d.mw) { ctx.beginPath(); ctx.setLineDash([3, 2]); ctx.strokeStyle = "#0071E3"; ctx.lineWidth = 1; ctx.arc(o.x, o.y, rOf(d.peak.mw), 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.2832);
      if (o.m > 0) { ctx.fillStyle = "rgba(0,113,227,.88)"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
      else { ctx.setLineDash([2, 2]); ctx.strokeStyle = "#0071E3"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
    } else if (it.k === "extra") {
      r = d.status === "live" && d.mw > 0 ? Math.max(4 * s, rOf(d.mw)) : (d.kind === "zone" ? 8 : 6) * s;
      var lv = d.status === "live"; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.2832); ctx.fillStyle = lv ? "rgba(107,114,128,.55)" : "rgba(107,114,128,.12)"; ctx.fill();
      if (!lv) ctx.setLineDash([3, 2]); ctx.strokeStyle = "#8E8E93"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    } else {
      r = 4.6 * s; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.2832);
      var fs = d.status === "plan" ? 0 : d.status === "build" ? 0.3 : 1;
      ctx.globalAlpha = fade * fs; ctx.fillStyle = FCOL[it.k]; ctx.fill(); ctx.globalAlpha = fade;
      ctx.strokeStyle = fs === 1 ? "#fff" : FCOL[it.k]; ctx.lineWidth = fs === 1 ? 1 : 1.6; if (d.status === "plan") ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (sel) { ctx.beginPath(); ctx.arc(o.x, o.y, r + 5, 0, 6.2832); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.globalAlpha = 1; o.r = r; SCR.push(o);
  });
}

function hit(px, py) {
  var best = null, bd = 1e9;
  for (var i = SCR.length - 1; i >= 0; i--) { var o = SCR[i], d = Math.hypot(o.x - px, o.y - py), lim = Math.max(8, o.r + 3); if (d <= lim && (d < bd || (d === bd && o.r < best.r))) { bd = d; best = o; } }
  return best;
}
function go(to, dur) { anim = { from: { lat: ST.view.lat, lon: ST.view.lon, z: ST.view.z }, to: to, t0: performance.now(), dur: dur || 800 }; vel.x = vel.y = 0; schedule(); }
function draw() { chips(); legend(); fiche(); stats(); render(); }

function legend() {
  var dot = function (c, cls) { return '<svg viewBox="-8 -8 16 16"><circle r="5.5" fill="' + c + '" stroke="' + (cls ? c : "#fff") + '" ' + (cls === "b" ? 'fill-opacity=".3"' : cls === "p" ? 'fill-opacity="0" stroke-dasharray="2 2"' : "") + "/></svg>"; };
  document.getElementById("lg").innerHTML =
    "<b>" + dot("#0071E3") + t("dc") + "</b><b>" + dot(FCOL.logic) + t("logic") + "</b><b>" + dot(FCOL.memory) + t("memory") + "</b><b>" + dot(FCOL.packaging) + t("packaging") + "</b>" +
    "<b>" + dot("#555") + t("lgOn") + "</b><b>" + dot("#555", "b") + t("lgBuild") + "</b><b>" + dot("#555", "p") + t("lgProj") + "</b>" +
    '<b><svg viewBox="-8 -8 16 16"><circle r="6" fill="none" stroke="#0071E3" stroke-dasharray="3 2"/></svg>' + t("lgPlan") + "</b>" + (EX.sites.length ? '<b><svg viewBox="-8 -8 16 16"><circle r="5.5" fill="#8E8E93" fill-opacity=".12" stroke="#8E8E93" stroke-width="1.5" stroke-dasharray="3 2"/></svg>' + t("lgExtra") + '</b><b><svg viewBox="-8 -8 16 16"><circle r="5.5" fill="#8E8E93" fill-opacity=".55" stroke="#8E8E93" stroke-width="1.5"/></svg>' + t("lgLive") + "</b>" : "") +
    '<b><svg viewBox="-8 -8 16 16"><circle r="2" fill="#9C9CA3" fill-opacity=".8"/></svg>' + t("lgLand") + "</b>";
}
function find(id) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i]; return null; }
function dl(k, v) { return v ? "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>" : ""; }
function fiche() {
  var el = document.getElementById("fc"), it = ST.sel && find(ST.sel);
  if (!it) { el.innerHTML = '<p class="none">' + t("pick") + "</p>"; return; }
  var d = it.d, h;
  if (it.k === "dc") {
    var conf = d.owner_conf === "likely" ? " (" + t("likely") + ")" : d.owner_conf === "speculative" ? " (" + t("spec") + ")" : "";
    h = "<h3>" + esc(d.name) + '</h3><div class="sub">' + esc(country(d.country)) + (d.project ? " · " + esc(d.project) : "") + " · " + t("loc") + " " + (d.prec === "adresse" ? t("locA") : t("locC")) + "</div><dl>" +
      dl(t("owner"), esc(d.owner || "—") + conf) + dl(t("users"), d.users ? esc(d.users) : "") + dl(t("power"), d.mw > 0 ? pw(d.mw) : "—") +
      dl(t("h100"), d.h100e > 0 ? nf(d.h100e) : "") + dl(t("chips"), d.chips ? esc(d.chips) : "") + dl(t("cost"), d.cost_bn ? nf(d.cost_bn, 1) + (LANG === "fr" ? " Md$" : " $bn") : "") + "</dl>";
    if (d.next) h += "<p><b>" + t("next") + " :</b> " + dt(d.next.d) + " — " + pw(d.next.mw) + "</p>";
    if (d.peak && (!d.next || d.peak.d !== d.next.d)) h += "<p><b>" + t("last") + " :</b> " + dt(d.peak.d) + " — " + pw(d.peak.mw) + "</p>";
    var u = d.src && safeUrl(d.src.u);
    h += "<p>" + (u ? t("src") + ' : <a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(d.src.t) + "</a> · " : "") + 'Epoch AI (CC BY 4.0)</p>';
  } else if (it.k === "extra") {
    var eu = safeUrl(d.src && d.src.u), en = CC[d.cc] ? CC[d.cc][LANG === "fr" ? 0 : 1] : d.cc;
    h = "<h3>" + esc(d.name) + '</h3><div class="sub">' + esc(en) + " · " + esc(t("kdx")[d.kind]) + "</div><dl>" + dl(t("co"), esc(d.co)) + dl(t("status"), esc(t("st")[d.status])) + dl(t(d.status === "live" ? "annwLive" : "annw"), d.mw > 0 ? pw(d.mw) : "") + "</dl><p>" + esc(d[LANG]) + "</p>" +
      "<p><b>" + esc(t("warnx")) + "</b></p><p>" + (eu ? t("src") + ' : <a href="' + esc(eu) + '" target="_blank" rel="noopener">' + esc(d.src.t) + "</a>" : "") + " · " + esc(EX.as_of) + "</p>";
  } else {
    var su = safeUrl(d.src && d.src.u), nm = CC[d.cc] ? CC[d.cc][LANG === "fr" ? 0 : 1] : d.cc;
    h = "<h3>" + esc(d.name) + '</h3><div class="sub">' + esc(nm) + " · " + esc(t("kd")[d.kind]) + "</div><dl>" + dl(t("co"), esc(d.co)) + dl(t("status"), esc(t("st")[d.status])) + "</dl><p>" + esc(d[LANG]) + "</p>" +
      "<p>" + (su ? t("src") + ' : <a href="' + esc(su) + '" target="_blank" rel="noopener">' + esc(d.src.t) + "</a>" : "") + " · " + esc(FB.as_of) + "</p>";
  }
  el.innerHTML = h;
}

function stats() {
  var D = DC.sites, mw = 0, h = 0, plan = 0, by = {};
  D.forEach(function (s) { mw += s.mw; h += s.h100e; var p = Math.max(s.mw, s.peak ? s.peak.mw : 0, s.next ? s.next.mw : 0); plan += p; var c = by[s.country] = by[s.country] || { now: 0, plan: 0, n: 0 }; c.now += s.mw; c.plan += p; c.n++; });
  var plan1 = ST.mode === "plan";
  document.getElementById("kp").innerHTML =
    '<div class="kpi"><b>' + nf(D.length) + "</b><span>" + t("sites") + '</span></div><div class="kpi"><b>' + pw(Math.round(mw)) + "</b><span>" + t("mw") + '</span></div><div class="kpi"><b>' + nf(h / 1e6, 1) + (LANG === "fr" ? " M" : "M") + "</b><span>" + t("h100") + '</span></div><div class="kpi"><b>' + pw(Math.round(plan)) + "</b><span>" + t("cmw") + '</span></div><div class="kpi"><b>' + FB.fabs.length + "</b><span>" + t("fabs") + "</span></div>";
  document.getElementById("h1").textContent = t("byc"); document.getElementById("h2").textContent = plan1 ? t("topPlan") : t("top");
  document.getElementById("kpe").textContent = LANG === "fr" ? "En chiffres" : "In numbers"; document.getElementById("kpt").textContent = LANG === "fr" ? "La puissance suivie" : "The compute we track";
  document.getElementById("h1t").textContent = LANG === "fr" ? "Les États-Unis loin devant" : "The US far ahead"; document.getElementById("h2t").textContent = LANG === "fr" ? "Le gigawatt est franchi" : "The gigawatt is crossed";
  var cs = Object.keys(by).sort(function (a, b) { return by[b][plan1 ? "plan" : "now"] - by[a][plan1 ? "plan" : "now"]; }).slice(0, 6), mx = Math.max.apply(null, cs.map(function (c) { return by[c][plan1 ? "plan" : "now"]; })) || 1;
  document.getElementById("bc").innerHTML = cs.map(function (c) {
    var a = by[c], v = plan1 ? a.plan : a.now;
    return '<div class="row"><span class="nm">' + esc(country(c)) + '</span><span class="bg"><i style="width:' + (a.now / mx * 100).toFixed(1) + '%"></i>' + (plan1 ? '<u style="left:' + (a.now / mx * 100).toFixed(1) + "%;width:" + (Math.max(0, a.plan - a.now) / mx * 100).toFixed(1) + '%"></u>' : "") + '</span><span class="v">' + pw(Math.round(v)) + " · " + a.n + (a.n > 1 ? " sites" : " site") + "</span></div>";
  }).join("");
  var top = D.slice().sort(function (a, b) { return mwOf(b) - mwOf(a); }).slice(0, 6), m2 = mwOf(top[0]) || 1;
  document.getElementById("tp").innerHTML = top.map(function (s) {
    return '<button class="row site" data-id="dc:' + esc(s.id) + '"><span class="nm"><b>' + esc(s.name) + '</b><small>' + esc(country(s.country)) + ' · ' + pw(mwOf(s)) + '</small></span><span class="arw"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span></button>';
  }).join("");
  document.getElementById("nt").innerHTML = esc(t("note1")) + "<br>" + esc(t("note2")) + (EX.sites.length ? "<br>" + esc(t("note3")) : "") + " " + t("asof") + " " + esc(DC.as_of) + ' · <a href="' + esc(DC.source.url) + '" target="_blank" rel="noopener">epoch.ai</a>';
}


function select(id) {
  ST.sel = id; draw(); var it = find(id);
  if (it) go({ lat: Math.max(-70, Math.min(70, it.lat)), lon: it.lon, z: Math.max(ST.view.z, 1.7) }, 900);
  report();
}

function bind() {
  document.getElementById("app").addEventListener("click", function (e) {
    if (e.target.closest("#alx")) { ST.alert = false; draw(); setTimeout(report, 480); return; }
    var b = e.target.closest("[data-l],[data-m],[data-r],[data-id]"); if (!b) return;
    if (b.dataset.l) { ST.layers[b.dataset.l] = !ST.layers[b.dataset.l]; if (b.dataset.l === "dc") ST.alert = !ST.alert; draw(); setTimeout(report, 480); }
    else if (b.dataset.m) { ST.mode = b.dataset.m; draw(); }
    else if (b.dataset.r) go(REG[b.dataset.r], 900);
    else if (b.dataset.id) select(b.dataset.id);
  });
  document.getElementById("zi").onclick = function () { zoomTo(ST.view.z * 1.4); };
  document.getElementById("zo").onclick = function () { zoomTo(ST.view.z / 1.4); };
  cv.addEventListener("wheel", function (e) { e.preventDefault(); zoomTo(ST.view.z * (e.deltaY > 0 ? 0.9 : 1.1), true); }, { passive: false });
  cv.addEventListener("pointerdown", function (e) {
    cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; anim = null; vel.x = vel.y = 0;
    if (Object.keys(ptrs).length === 1) { drag.on = true; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY; } else { drag.on = false; drag.pd = pdist(); drag.z = ST.view.z; }
  });
  cv.addEventListener("pointermove", function (e) {
    var n = Object.keys(ptrs).length, r = cv.getBoundingClientRect();
    if (ptrs[e.pointerId]) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (n >= 2 && drag.pd) { zoomTo(drag.z * pdist() / drag.pd, true); return; }
    if (drag.on) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { rotate(dx, dy); vel.x = dx; vel.y = dy; drag.x = e.clientX; drag.y = e.clientY; schedule(); }
      tip.classList.add("hide"); return;
    }
    var o = hit(e.clientX - r.left, e.clientY - r.top);
    cv.style.cursor = o ? "pointer" : "grab";
    if (o) { tip.textContent = o.it.d.name; tip.style.left = Math.min(CW - 160, o.x + 12) + "px"; tip.style.top = Math.max(2, o.y - 30) + "px"; tip.classList.remove("hide"); } else tip.classList.add("hide");
  });
  var up = function (e) {
    var wasDrag = drag.moved, r = cv.getBoundingClientRect(); delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) drag.pd = 0;
    if (!Object.keys(ptrs).length) {
      drag.on = false;
      if (!wasDrag && e.type === "pointerup") { var o = hit(e.clientX - r.left, e.clientY - r.top); if (o) select(o.it.id); }
      else if (wasDrag) schedule();
    }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", function () { tip.classList.add("hide"); });
  if (window.ResizeObserver) new ResizeObserver(function () { if (Math.abs(box.clientWidth - CW) > 1) { size(); render(); report(); } }).observe(box);
}
function pdist() { var k = Object.keys(ptrs); if (k.length < 2) return 1; return Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y) || 1; }
function zoomTo(z, now) { z = Math.max(0.8, Math.min(6, z)); if (now) { anim = null; ST.view.z = z; render(); } else go({ lat: ST.view.lat, lon: ST.view.lon, z: z }, 350); }

function report() { try { parent.postMessage({ carteH: Math.ceil(document.querySelector(".wrap").getBoundingClientRect().height) + 6 }, location.origin); } catch (e) {} }
window.CarteFrame = { setLang: function (l) { LANG = l === "en" ? "en" : "fr"; document.documentElement.lang = LANG; if (DC) { var h = box.querySelector(".hintb"); if (h) h.textContent = t("hint"); draw(); } setTimeout(report, 50); } };
document.documentElement.lang = LANG;
load();
})();
