/* ========= Helpers ========= */
function qs(sel, el){ return (el || document).querySelector(sel); }
function qsa(sel, el){ return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function pad2(n){ return (n < 10 ? "0" : "") + String(n); }

var _imul = Math.imul || function(a, b) {
  var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
  return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
};

function safe(name, fn){
  try { fn(); }
  catch (e) {
    if (window && window.console && console.warn) console.warn("[studio] " + name + " failed:", e);
  }
}

function hexToRgba(hex, a) {
  var h = String(hex).replace("#", "");
  if (h.length !== 6) return "rgba(245,245,245," + a + ")";
  var r = parseInt(h.slice(0,2), 16);
  var g = parseInt(h.slice(2,4), 16);
  var b = parseInt(h.slice(4,6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

/* ========= Scroll lock (no layout shift) ========= */
function lockScroll(){
  var de = document.documentElement;
  var sbw = (window.innerWidth || 0) - (de.clientWidth || 0);
  if (sbw < 0) sbw = 0;
  de.style.setProperty("--sbw", sbw + "px");
  de.classList.add("no-scroll");
}
function unlockScroll(){
  var de = document.documentElement;
  de.classList.remove("no-scroll");
  de.style.setProperty("--sbw", "0px");
}

/* ========= Performance profile =========
   - Auto low mode on weak devices
   - Force with:
       ?low=1  (forces low)
       ?high=1 (forces high)
   - Or localStorage:
       localStorage.setItem('studioPerf','low'|'high')
*/
function getPerfProfile(){
  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch(e){}

  var dm = 0, hc = 0, saveData = false;
  try { dm = navigator.deviceMemory || 0; } catch(e){}
  try { hc = navigator.hardwareConcurrency || 0; } catch(e){}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch(e){}

  var low = false;
  if (reduced) low = true;
  if (saveData) low = true;
  if (dm && dm <= 4) low = true;
  if (hc && hc <= 4) low = true;

  // URL override
  try {
    var p = new URLSearchParams(location.search);
    if (p.get("low") === "1") low = true;
    if (p.get("high") === "1") low = false;
  } catch(e){}

  // localStorage override
  try {
    var stored = localStorage.getItem("studioPerf");
    if (stored === "low") low = true;
    if (stored === "high") low = false;
  } catch(e){}

  return { low: !!low, reduced: !!reduced };
}

function applyPerformanceProfile(){
  var perf = getPerfProfile();
  window.__STUDIO_PERF__ = perf;
  document.documentElement.classList.toggle("perf-low", !!perf.low);
  return perf;
}

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", function(){
  document.documentElement.classList.add("js");

  // Apply perf profile BEFORE starting animations
  var perf = applyPerformanceProfile();

  safe("scrollRestoration", function(){
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  });

  safe("year", function(){
    var y = qs("#year");
    if (y) y.textContent = String(new Date().getFullYear());
  });

  safe("smoothScroll", initSmoothScroll);
  safe("navSpy", initTopNavSpyStable);
  safe("mobileNavDropdown", initMobileNavDropdown);

  safe("scrollRefraction", initScrollGlassRefraction);
  safe("aurora", initAuroraBorealisBackground);

  safe("jellyfish", initJellyfishSlowTricks);

  safe("toolboardWires", initToolboardWires);

  var drawerApi = null;
  safe("drawerInfinite", function(){ drawerApi = initDrawerInfiniteLoop(); });

  safe("sheet", function(){ initExhibitSheet(drawerApi); });

  // Lazy thumbnails: big initial-load win
  safe("thumbs", initGenerativeThumbsLazy);
});

/* ========= Smooth scroll ========= */
function initSmoothScroll() {
  qsa("[data-scrollto]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var target = btn.getAttribute("data-scrollto");
      var el = target ? qs(target) : null;
      if (!el) return;
      el.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });

  qsa(".top-nav a[href^='#']").forEach(function(a){
    a.addEventListener("click", function(e){
      var id = a.getAttribute("href");
      var el = id ? qs(id) : null;
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior:"smooth", block:"start" });
      history.replaceState(null, "", id);
    });
  });
}

/* ========= Mobile dropdown menu ========= */
function initMobileNavDropdown(){
  var toggle = qs("#navToggle");
  var nav = qs("#topNav");
  var scrim = qs("#navScrim");
  if (!toggle || !nav || !scrim) return;

  function open(){
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
  }
  function close(){
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }
  function isOpen(){
    return document.body.classList.contains("nav-open");
  }

  toggle.addEventListener("click", function(){
    if (isOpen()) close(); else open();
  });

  scrim.addEventListener("click", close);

  qsa("a[href^='#']", nav).forEach(function(a){
    a.addEventListener("click", function(){ close(); });
  });

  window.addEventListener("keydown", function(e){
    if (e.key === "Escape") close();
  });

  window.addEventListener("resize", function(){
    if (window.innerWidth > 1000) close();
  }, { passive:true });
}

/* ========= Top nav spy (stable) ========= */
function initTopNavSpyStable() {
  var navItems = qsa(".top-nav__item[data-nav]");
  var sections = qsa("[data-section]");
  var header = qs(".top-strip");
  if (!navItems.length || !sections.length) return;

  var tops = [];
  function recalc() {
    tops = sections.map(function(s){
      var r = s.getBoundingClientRect();
      return { id: s.id, top: r.top + window.scrollY };
    }).sort(function(a,b){ return a.top - b.top; });
  }

  function setActive(id){
    navItems.forEach(function(a){
      var on = a.getAttribute("data-nav") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  var ticking = false;
  function onScroll(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      ticking = false;
      var headerH = header ? header.getBoundingClientRect().height : 0;
      var marker = window.scrollY + headerH + 40;

      var active = tops.length ? tops[0].id : sections[0].id;
      for (var i=0; i<tops.length; i++){
        if (tops[i].top <= marker) active = tops[i].id;
        else break;
      }
      setActive(active);
    });
  }

  window.addEventListener("scroll", onScroll, { passive:true });
  window.addEventListener("resize", function(){ recalc(); onScroll(); }, { passive:true });

  recalc();
  onScroll();
}

/* ========= Scroll-driven glass refraction =========
   Disabled in perf-low because backdrop-related effects can stall GPUs
*/
function initScrollGlassRefraction(){
  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  if (perf.low || perf.reduced) return;

  var root = document.documentElement;
  var baseBlur = 16;
  var baseSat = 1.16;

  var curBlur = baseBlur, curSat = baseSat;
  var tgtBlur = baseBlur, tgtSat = baseSat;

  var lastY = window.scrollY || 0;
  var lastT = performance.now();

  var running = false;

  function setVars(){
    root.style.setProperty("--glass-blur", curBlur.toFixed(2) + "px");
    root.style.setProperty("--glass-sat", curSat.toFixed(3));
  }

  function onScroll(){
    var now = performance.now();
    var y = window.scrollY || 0;
    var dy = Math.abs(y - lastY);
    var dt = Math.max(1, now - lastT);

    lastY = y;
    lastT = now;

    var v = dy / dt;
    var boost = clamp(v * 160, 0, 9.0);

    tgtBlur = baseBlur + boost;
    tgtSat = baseSat + boost * 0.010;

    if (!running){
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function tick(){
    curBlur += (tgtBlur - curBlur) * 0.14;
    curSat  += (tgtSat  - curSat)  * 0.14;

    tgtBlur += (baseBlur - tgtBlur) * 0.10;
    tgtSat  += (baseSat  - tgtSat)  * 0.10;

    setVars();

    var done =
      Math.abs(curBlur - baseBlur) < 0.12 &&
      Math.abs(tgtBlur - baseBlur) < 0.12 &&
      Math.abs(curSat - baseSat) < 0.01;

    if (done){
      running = false;
      curBlur = baseBlur; curSat = baseSat;
      tgtBlur = baseBlur; tgtSat = baseSat;
      setVars();
      return;
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", onScroll, { passive:true });
  setVars();
}

/* ========= Aurora Borealis background (optimized) ========= */
function initAuroraBorealisBackground(){
  var canvas = qs("#bg-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha:true });
  if (!ctx) return;

  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  var low = !!perf.low;
  var reduced = !!perf.reduced;

  var rs = getComputedStyle(document.documentElement);
  var C_TEAL = (rs.getPropertyValue("--teal").trim() || "#2AF5FF");
  var C_VIO  = (rs.getPropertyValue("--violet").trim() || "#6D28D9");
  var C_MAG  = (rs.getPropertyValue("--magenta").trim() || "#FF4FD8");

  var hasFilter = ("filter" in ctx);

  var vw=0,vh=0,w=0,h=0,dpr=1,scale=1;
  var fps = 30;
  var last = 0;
  var start = performance.now();
  var running = true;

  var pointer = { x:0.5, y:0.5, tx:0.5, ty:0.5 };

  // auto-degrade if frame time too slow
  var slowScore = 0;

  function applyQuality(){
    perf = window.__STUDIO_PERF__ || perf;
    low = !!perf.low;

    // Big win: render at lower internal resolution
    scale = low ? 0.55 : 0.75;
    dpr = low ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
    fps = low ? 18 : 30;
  }

  function resize(){
    applyQuality();
    vw = Math.floor(window.innerWidth);
    vh = Math.floor(window.innerHeight);

    w = Math.max(1, Math.floor(vw * scale));
    h = Math.max(1, Math.floor(vh * scale));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function onMove(e){
    var x = (e.clientX || 0) / Math.max(1, vw);
    var y = (e.clientY || 0) / Math.max(1, vh);
    pointer.tx = clamp(x, 0, 1);
    pointer.ty = clamp(y, 0, 1);
  }

  window.addEventListener("pointermove", onMove, { passive:true });
  window.addEventListener("mousemove", onMove, { passive:true });
  window.addEventListener("resize", resize, { passive:true });

  document.addEventListener("visibilitychange", function(){
    running = !document.hidden;
    if (running && !reduced) {
      last = 0;
      requestAnimationFrame(frame);
    }
  });

  function rand1(i, seed){
    var x = (i | 0) + (seed | 0) * 131;
    x = (x << 13) ^ x;
    var t = (x * (x * x * 15731 + 789221) + 1376312589) & 0x7fffffff;
    return t / 2147483647;
  }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function smooth(t){ return t*t*(3-2*t); }

  function noise1(x, seed){
    var i0 = Math.floor(x);
    var i1 = i0 + 1;
    var f = x - i0;
    var u = smooth(f);
    return lerp(rand1(i0, seed), rand1(i1, seed), u);
  }

  // fewer octaves than before (cheaper)
  function fbm1(x, seed){
    var sum = 0, amp = 0.55, freq = 1;
    for (var o=0; o<4; o++){
      sum += amp * noise1(x*freq, seed + o*17);
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }

  var stars = [];
  function buildStars(){
    stars = [];
    var area = w*h;
    var base = low ? 120000 : 90000;
    var count = Math.round(area / base);
    count = clamp(count, low ? 30 : 45, low ? 85 : 110);

    for (var i=0; i<count; i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*(h*0.58),
        r: 0.5 + Math.random()*1.2,
        a: 0.05 + Math.random()*0.14,
        tw: Math.random()*6.28
      });
    }
  }

  function paintBase(){
    var bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0, "rgba(5,10,24,1)");
    bg.addColorStop(0.55, "rgba(4,8,20,1)");
    bg.addColorStop(1, "rgba(2,5,14,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);
  }

  function drawStars(s){
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i=0; i<stars.length; i++){
      var st = stars[i];
      var tw = 0.65 + 0.35 * Math.sin(s*0.55 + st.tw);
      ctx.fillStyle = "rgba(245,245,245," + (st.a * tw) + ")";
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCurtain(color, baseY, baseH, seed, s, intensity){
    var px = (pointer.x - 0.5) * (low ? 10 : 16);
    var py = (pointer.y - 0.5) * (low ? 6 : 9);

    var freq = 0.012;
    var speed = 0.050;   // slow
    var speed2 = 0.038;

    var stepBlur = low ? 20 : 14;
    var stepFine = low ? 14 : 10;

    var g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0.00, hexToRgba(color, 0.00));
    g.addColorStop(clamp(baseY/h - 0.03, 0, 1), hexToRgba(color, 0.00));
    g.addColorStop(clamp((baseY + baseH*0.18)/h, 0, 1), hexToRgba(color, 0.28*intensity));
    g.addColorStop(clamp((baseY + baseH*0.60)/h, 0, 1), hexToRgba(color, 0.12*intensity));
    g.addColorStop(clamp((baseY + baseH)/h, 0, 1), hexToRgba(color, 0.00));

    // ---- Pass 1: bloom strands (1 stroke total)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    if (hasFilter) ctx.filter = "blur(" + (low ? 10 : 14) + "px)";
    ctx.globalAlpha = (low ? 0.26 : 0.32) * intensity;
    ctx.lineWidth = low ? 10 : 12;

    ctx.beginPath();
    for (var x=-22; x<=w+22; x+=stepBlur){
      var n = fbm1(x*freq + s*speed, seed);
      var n2 = fbm1(x*freq*0.7 + s*speed2, seed+99);
      var top = baseY + (n - 0.5) * (h*0.07) + py;
      var bottom = top + baseH + (n2 - 0.5) * (h*0.10);

      top += Math.sin(s*0.18 + x*0.004) * 4 + px*0.12;
      bottom += Math.cos(s*0.16 + x*0.003) * 6 + px*0.10;

      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    ctx.stroke();
    ctx.restore();

    // ---- Pass 2: fine strands (CHEAP: 1 stroke total, skipped in low mode)
    if (low) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    if (hasFilter) ctx.filter = "blur(1.2px)";
    ctx.globalAlpha = 0.09 * intensity;
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (var x2=-10; x2<=w+10; x2+=stepFine){
      var m = fbm1(x2*freq*1.10 + s*(speed*1.10), seed+17);
      var m2 = fbm1(x2*freq*0.86 + s*(speed2*1.05), seed+117);

      var top2 = baseY + (m - 0.5) * (h*0.09) + py;
      var bottom2 = top2 + baseH + (m2 - 0.5) * (h*0.12);

      top2 += Math.sin(s*0.20 + x2*0.0045) * 5 + px*0.12;
      bottom2 += Math.cos(s*0.18 + x2*0.0038) * 8 + px*0.10;

      ctx.moveTo(x2, top2);
      ctx.lineTo(x2, bottom2);
    }
    ctx.stroke();
    ctx.restore();
  }

  function vignette(){
    var vg = ctx.createRadialGradient(w*0.52, h*0.44, 0, w*0.52, h*0.44, Math.max(w,h)*0.82);
    vg.addColorStop(0, "rgba(5,10,24,0)");
    vg.addColorStop(1, "rgba(5,10,24,0.84)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);
  }

  function groundHaze(){
    var g = ctx.createLinearGradient(0, h*0.55, 0, h);
    g.addColorStop(0, "rgba(5,10,24,0)");
    g.addColorStop(1, "rgba(5,10,24,0.66)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h*0.55, w, h*0.45);
  }

  function render(now){
    var s = (now - start) / 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    paintBase();
    drawStars(s);

    drawCurtain(C_TEAL, h*0.07, h*0.72, 11, s, 0.92);
    drawCurtain(C_VIO,  h*0.10, h*0.66, 29, s*0.92, 0.76);
    drawCurtain(C_MAG,  h*0.14, h*0.58, 43, s*0.86, 0.56);

    groundHaze();
    vignette();
  }

  function frame(now){
    if (!running) return;

    if (reduced){
      render(now);
      return;
    }

    // FPS cap
    var minDt = 1000 / fps;
    if (last && (now - last) < minDt){
      requestAnimationFrame(frame);
      return;
    }

    var dt = last ? (now - last) : minDt;
    last = now;

    // Auto-degrade if too slow while in high mode
    if (!low && dt > 80) slowScore++;
    else slowScore = Math.max(0, slowScore - 1);

    if (!low && slowScore > 25){
      // flip to low perf mode
      var perf2 = window.__STUDIO_PERF__ || { low:false, reduced:false };
      perf2.low = true;
      window.__STUDIO_PERF__ = perf2;
      document.documentElement.classList.add("perf-low");
      low = true;
      slowScore = 0;
      resize();
    }

    render(now);
    requestAnimationFrame(frame);
  }

  resize();

  // If reduced-motion: draw once and stop (fast + accessible)
  if (reduced) {
    frame(performance.now());
  } else {
    requestAnimationFrame(frame);
  }
}

/* ========= Jellyfish smaller + slow (throttled FPS) ========= */
function initJellyfishSlowTricks(){
  var jf = qs("#jellyfish");
  var hero = qs("#home");
  if (!jf || !hero) return;

  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : { matches:false };

  var size = { w: 88, h: 88 };
  function measure(){
    var r = jf.getBoundingClientRect();
    size.w = r.width || 88;
    size.h = r.height || 88;
  }
  function area(){
    if (mqMobile.matches) {
      return {
        w: Math.min(hero.clientWidth || window.innerWidth, window.innerWidth),
        h: Math.min(hero.clientHeight || window.innerHeight, window.innerHeight),
        pad: 10
      };
    }
    return { w: window.innerWidth, h: window.innerHeight, pad: 10 };
  }

  measure();
  window.addEventListener("resize", function(){ measure(); }, { passive:true });

  var fps = perf.low ? 20 : 30;
  var last = 0;

  var start = performance.now();
  function ease(t){ return t*t*(3-2*t); }

  function tick(now){
    var minDt = 1000 / fps;
    if (last && (now - last) < minDt){
      requestAnimationFrame(tick);
      return;
    }
    last = now;

    var secs = (now - start) / 1000;
    var a = area();

    var aw = Math.max(0, a.w - size.w - 2*a.pad);
    var ah = Math.max(0, a.h - size.h - 2*a.pad);

    var cx = a.pad + aw/2;
    var cy = a.pad + ah/2;

    var t = secs * 0.11;
    var x = cx + (aw/2) * Math.sin(t);
    var y = cy + (ah/2) * Math.sin(t * 0.72 + 1.18);

    // very slow "trick"
    var cycle = 40;
    var win = 7.8;
    var within = secs % cycle;

    var extraX = 0, extraY = 0, extraRot = 0, extraScale = 0;
    if (within < win){
      var p = within / win;
      var e = ease(p);
      var loopR = Math.min(aw, ah) * 0.045;

      extraX = loopR * Math.sin(e * Math.PI * 2);
      extraY = loopR * Math.cos(e * Math.PI * 2);

      extraRot = e * 140;
      extraScale = Math.sin(e * Math.PI) * 0.05;
    }

    var rot = (Math.sin(secs * 0.28) * 1.0) + extraRot;
    var scl = 1 + (Math.sin(secs * 0.22) * 0.012) + extraScale;

    jf.style.transform =
      "translate3d(" + (x + extraX) + "px," + (y + extraY) + "px,0) rotate(" + rot + "deg) scale(" + scl + ")";

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ========= Toolboard wires ========= */
function initToolboardWires(){
  var box = qs("#toolboardBox");
  var svg = qs("#toolboardWires");
  if (!box || !svg) return;

  var nodes = qsa(".toolnode", box);
  if (!nodes.length) return;

  var pairs = [
    ["backend", "genai"],
    ["backend", "data"],
    ["data", "cloud"],
    ["cloud", "genai"],
    ["genai", "core"]
  ];

  function findNode(name){
    for (var i=0; i<nodes.length; i++){
      if (nodes[i].getAttribute("data-node") === name) return nodes[i];
    }
    return null;
  }

  function centerOf(el){
    var r = el.getBoundingClientRect();
    var br = box.getBoundingClientRect();
    return { x: (r.left - br.left) + r.width/2, y: (r.top - br.top) + r.height/2 };
  }

  function draw(){
    var br = box.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + br.width + " " + br.height);
    svg.setAttribute("width", String(br.width));
    svg.setAttribute("height", String(br.height));
    svg.innerHTML = "";

    for (var i=0; i<pairs.length; i++){
      var a = pairs[i][0], b = pairs[i][1];
      var na = findNode(a), nb = findNode(b);
      if (!na || !nb) continue;

      var A = centerOf(na);
      var B = centerOf(nb);

      var midX = (A.x + B.x) / 2;
      var midY = (A.y + B.y) / 2;
      var bend = 18;
      var cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      var cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      var glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "rgba(42,245,255,0.03)");
      glow.setAttribute("stroke-width", "4");
      glow.setAttribute("opacity", "0.55");
      glow.setAttribute("stroke-linecap", "round");
      svg.appendChild(glow);

      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(245,245,245,0.085)");
      path.setAttribute("stroke-width", "1.05");
      path.setAttribute("stroke-dasharray", "3 12");
      path.setAttribute("opacity", "0.80");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    }
  }

  window.addEventListener("resize", draw, { passive:true });
  draw();
}

/* ========= Drawer / Sheet / Thumbs ========= */
function initDrawerInfiniteLoop(){
  var drawer = qs("#drawer");
  var meta = qs("#drawerMeta");
  if (!drawer || !meta) return null;

  var originals = qsa(".frame", drawer);
  var n = originals.length;
  if (!n) return null;

  originals.forEach(function(f, i){
    f.setAttribute("data-original-index", String(i));
    f.removeAttribute("data-clone");
  });

  var fragBefore = document.createDocumentFragment();
  var fragAfter = document.createDocumentFragment();
  var after = [];

  originals.forEach(function(f, i){
    var cb = f.cloneNode(true);
    cb.setAttribute("data-clone", "before");
    cb.setAttribute("data-original-index", String(i));
    fragBefore.appendChild(cb);

    var ca = f.cloneNode(true);
    ca.setAttribute("data-clone", "after");
    ca.setAttribute("data-original-index", String(i));
    fragAfter.appendChild(ca);
    after.push(ca);
  });

  drawer.insertBefore(fragBefore, drawer.firstChild);
  drawer.appendChild(fragAfter);

  var frames = qsa(".frame", drawer);

  var geom = { start: 0, setWidth: 0 };
  function recalcGeom(){
    var start = originals[0].offsetLeft;
    var setWidth = after[0].offsetLeft - start;
    geom.start = start;
    geom.setWidth = setWidth;
  }

  function centerTo(el, behavior){
    if (!el) return;
    var left = el.offsetLeft - (drawer.clientWidth - el.clientWidth)/2;
    drawer.scrollTo({ left: left, behavior: behavior || "smooth" });
  }

  function getCenteredFrame(){
    var center = drawer.scrollLeft + drawer.clientWidth/2;
    var best = frames[0];
    var bestDist = Infinity;
    for (var i=0; i<frames.length; i++){
      var f = frames[i];
      var fc = f.offsetLeft + f.clientWidth/2;
      var d = Math.abs(fc - center);
      if (d < bestDist){ bestDist = d; best = f; }
    }
    return best;
  }

  function normalize(){
    recalcGeom();
    if (!geom.setWidth) return;
    var min = geom.start;
    var max = geom.start + geom.setWidth;

    while (drawer.scrollLeft < min) drawer.scrollLeft += geom.setWidth;
    while (drawer.scrollLeft >= max) drawer.scrollLeft -= geom.setWidth;
  }

  recalcGeom();
  centerTo(originals[0], "auto");
  normalize();

  var pinned = false;
  var pinnedIndex = 0;
  var clickTimer = null;

  function setPinnedUI(el){
    frames.forEach(function(f){ f.classList.remove("is-pinned"); });
    if (el) el.classList.add("is-pinned");
  }

  function setMeta(){
    var cur = getCenteredFrame();
    var idx = parseInt(cur.getAttribute("data-original-index") || "0", 10) || 0;
    if (pinned) {
      meta.textContent =
        "PINNED • PIECE " + pad2(pinnedIndex + 1) + " OF " + pad2(n) +
        " • CLICK AGAIN TO UNPIN • DOUBLE‑CLICK FOR REPO";
    } else {
      meta.textContent =
        "INFINITE LOOP • PIECE " + pad2(idx + 1) + " OF " + pad2(n) +
        " • 5s • CLICK TO PIN • DOUBLE‑CLICK FOR REPO";
    }
  }

  function pinTo(idx){
    pinned = true;
    pinnedIndex = idx;
    stopAuto();
    setPinnedUI(originals[idx]);
    centerTo(originals[idx], "smooth");
    setMeta();
  }

  function unpin(){
    pinned = false;
    setPinnedUI(null);
    setMeta();
    startAuto();
  }

  frames.forEach(function(frame){
    frame.addEventListener("click", function(e){
      if (e.target && e.target.closest && e.target.closest("button,a")) return;
      if (clickTimer) return;

      clickTimer = window.setTimeout(function(){
        clickTimer = null;
        var idx = parseInt(frame.getAttribute("data-original-index") || "0", 10) || 0;
        if (pinned && pinnedIndex === idx) unpin();
        else pinTo(idx);
      }, 220);
    });

    frame.addEventListener("dblclick", function(){
      if (clickTimer) { window.clearTimeout(clickTimer); clickTimer = null; }
      var repo = frame.getAttribute("data-repo");
      if (repo) window.open(repo, "_blank", "noopener");
    });
  });

  qsa("[data-drawer]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var cur = getCenteredFrame();
      var i = frames.indexOf(cur);
      var dir = btn.getAttribute("data-drawer");
      var next = dir === "next" ? frames[i + 1] : frames[i - 1];
      if (!next) next = dir === "next" ? frames[0] : frames[frames.length - 1];
      centerTo(next, "smooth");

      if (pinned){
        pinnedIndex = parseInt(next.getAttribute("data-original-index") || "0", 10) || 0;
        setPinnedUI(originals[pinnedIndex]);
      }
      setMeta();
    });
  });

  var scrollEnd = null;
  drawer.addEventListener("scroll", function(){
    if (scrollEnd) window.clearTimeout(scrollEnd);
    scrollEnd = window.setTimeout(function(){
      normalize();
      setMeta();
    }, 120);
  }, { passive:true });

  window.addEventListener("resize", function(){
    normalize();
    setMeta();
  }, { passive:true });

  var timer = null;
  function startAuto(){
    if (timer || pinned) return;
    timer = window.setInterval(function(){
      if (pinned) return;
      var cur = getCenteredFrame();
      var i = frames.indexOf(cur);
      var next = frames[i + 1];
      if (!next) next = frames[0];
      centerTo(next, "smooth");
    }, 5000);
  }
  function stopAuto(){
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  setMeta();
  startAuto();

  return {
    pause: stopAuto,
    resume: startAuto,
    unpin: unpin,
    isPinned: function(){ return pinned; }
  };
}

function initExhibitSheet(drawerApi) {
  var sheet = qs("#sheet");
  if (!sheet) return;

  var overlay = qs(".sheet__overlay", sheet);
  var closeBtns = qsa("[data-sheet='close']", sheet);

  var titleEl = qs("#sheetTitle");
  var descEl = qs("#sheetDesc");
  var tagsEl = qs("#sheetTags");
  var kindEl = qs("#sheetKind");
  var repoEl = qs("#sheetRepo");
  var canvas = qs("#sheetCanvas");

  if (!overlay || !titleEl || !descEl || !tagsEl || !kindEl || !repoEl || !canvas) return;

  function openFromFrame(frame) {
    if (drawerApi && drawerApi.pause) drawerApi.pause();

    var title = frame.getAttribute("data-title") || "Project";
    var kind = frame.getAttribute("data-kind") || "Project";
    var desc = frame.getAttribute("data-desc") || "";
    var tags = (frame.getAttribute("data-tags") || "").split(",").map(function(s){ return s.trim(); }).filter(Boolean);
    var repo = frame.getAttribute("data-repo") || "#";
    var accent = frame.getAttribute("data-accent") || "blue";

    titleEl.textContent = title;
    descEl.textContent = desc;
    kindEl.textContent = kind.toUpperCase();
    repoEl.href = repo;

    tagsEl.innerHTML = "";
    tags.forEach(function(t){
      var span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      tagsEl.appendChild(span);
    });

    drawGenerativeArt(canvas, title + "::sheet", accent);

    lockScroll();
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function close() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (drawerApi && drawerApi.resume) drawerApi.resume();
  }

  qsa(".frame").forEach(function(frame){
    var btn = qs("[data-open]", frame);
    if (btn){
      btn.addEventListener("click", function(e){
        e.stopPropagation();
        openFromFrame(frame);
      });
    }
  });

  overlay.addEventListener("click", close);
  closeBtns.forEach(function(b){ b.addEventListener("click", close); });

  window.addEventListener("keydown", function(e){
    if (e.key === "Escape" && sheet.classList.contains("is-open")) close();
  });
}

/* ========= Lazy thumbnails (only render near viewport) ========= */
function initGenerativeThumbsLazy(){
  var canvases = qsa("canvas.thumb");
  if (!canvases.length) return;

  function renderCanvas(c){
    if (c.__rendered) return;
    c.__rendered = true;
    var seed = c.getAttribute("data-seed") || "thumb";
    var frame = c.closest ? c.closest(".frame") : null;
    var accent = frame ? (frame.getAttribute("data-accent") || "blue") : "blue";
    drawGenerativeArt(c, seed, accent);
  }

  // Fallback if IO not supported
  if (!("IntersectionObserver" in window)){
    canvases.forEach(renderCanvas);
    return;
  }

  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){
        renderCanvas(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { root: null, rootMargin: "220px 0px", threshold: 0.01 });

  canvases.forEach(function(c){ obs.observe(c); });

  // Re-render on resize (only those already rendered)
  window.addEventListener("resize", function(){
    clearTimeout(initGenerativeThumbsLazy._t);
    initGenerativeThumbsLazy._t = setTimeout(function(){
      canvases.forEach(function(c){
        if (c.__rendered) {
          var seed = c.getAttribute("data-seed") || "thumb";
          var frame = c.closest ? c.closest(".frame") : null;
          var accent = frame ? (frame.getAttribute("data-accent") || "blue") : "blue";
          drawGenerativeArt(c, seed, accent);
        }
      });
    }, 140);
  }, { passive:true });
}

/* ========= Generative art ========= */
function hashString(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = _imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = _imul(t ^ (t >>> 15), t | 1);
    t ^= t + _imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getAccentColor(accent) {
  var cs = getComputedStyle(document.documentElement);
  if (accent === "coral") return cs.getPropertyValue("--coral").trim() || "#FF6B6B";
  if (accent === "green") return cs.getPropertyValue("--green").trim() || "#6BCB77";
  return cs.getPropertyValue("--blue").trim() || "#4D96FF";
}

function drawGenerativeArt(canvas, seed, accentName) {
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  var low = !!perf.low;

  var dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2);
  var w = Math.max(1, canvas.clientWidth || 640);
  var h = Math.max(1, canvas.clientHeight || 360);

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var r = mulberry32(hashString(seed));
  var accent = getAccentColor(accentName);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(5,10,24,0.94)";
  ctx.fillRect(0, 0, w, h);

  var g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(245,245,245,0.06)");
  g.addColorStop(1, "rgba(245,245,245,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  var arcs = (low ? 8 : 10) + Math.floor(r() * (low ? 6 : 10));
  for (var j = 0; j < arcs; j++) {
    var cx = r() * w;
    var cy = r() * h;
    var rad = (0.08 + r() * 0.45) * Math.min(w, h);
    var start = r() * Math.PI * 2;
    var end = start + (0.4 + r() * 1.6);

    ctx.strokeStyle = (j % 2 === 0)
      ? hexToRgba(accent, 0.18 + r() * 0.12)
      : "rgba(245,245,245," + (0.06 + r() * 0.09) + ")";

    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, start, end);
    ctx.stroke();
  }

  var nodes = (low ? 18 : 24) + Math.floor(r() * (low ? 14 : 22));
  for (var k = 0; k < nodes; k++) {
    var x = r() * w;
    var y = r() * h;
    var rr = 1.5 + r() * 3.4;

    ctx.fillStyle = (k % 5 === 0)
      ? hexToRgba(accent, 0.50)
      : "rgba(245,245,245," + (0.10 + r() * 0.18) + ")";

    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();

    if (!low && k % 6 === 0) {
      var x2 = clamp(x + (r() - 0.5) * w * 0.35, 0, w);
      var y2 = clamp(y + (r() - 0.5) * h * 0.35, 0, h);
      ctx.strokeStyle = "rgba(245,245,245," + (0.05 + r() * 0.08) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  var vg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  vg.addColorStop(0, "rgba(5,10,24,0)");
  vg.addColorStop(1, "rgba(5,10,24,0.78)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
