/* =========================================================
   AAKASH — main.js (performance + aurora + nav spy + drawer)
   ========================================================= */

function qs(sel, el){ return (el || document).querySelector(sel); }
function qsa(sel, el){ return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

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

function getPerfProfile(){
  var reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch(e){}
  var dm = 0, hc = 0, saveData = false;
  try { dm = navigator.deviceMemory || 0; } catch(e){}
  try { hc = navigator.hardwareConcurrency || 0; } catch(e){}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch(e){}

  var low = false;
  if (reduced) low = true;
  if (saveData) low = true;
  if (dm && dm <= 4) low = true;
  if (hc && hc <= 4) low = true;

  try {
    var p = new URLSearchParams(location.search);
    if (p.get("low") === "1") low = true;
    if (p.get("high") === "1") low = false;
  } catch(e){}

  return { low: !!low, reduced: !!reduced };
}

function applyPerformanceProfile(){
  var perf = getPerfProfile();
  window.__STUDIO_PERF__ = perf;
  document.documentElement.classList.toggle("perf-low", !!perf.low);
  return perf;
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", function(){
  applyPerformanceProfile();

  // Prevent weird autoscroll on some machines
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  } catch(e){}

  // year
  var y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  initMobileNavDropdown();
  initSmoothScroll();
  initNavSpyFixStuck();     // ✅ this fixes “stuck after first click”
  initAuroraBorealis();
  initJellyfishSlow();
  initToolboardWires();
  var drawerApi = initDrawerInfinite();
  initExhibitSheet(drawerApi);
});

/* =========================================================
   MOBILE NAV DROPDOWN
   ========================================================= */
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
  function isOpen(){ return document.body.classList.contains("nav-open"); }

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

/* =========================================================
   SMOOTH SCROLL (buttons + nav)
   ========================================================= */
function initSmoothScroll(){
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

/* =========================================================
   NAV SPY — Fix “stuck after first click”
   Works even if scroll events are weird: includes polling fallback.
   ========================================================= */
function initNavSpyFixStuck(){
  var navItems = qsa(".top-nav__item[data-nav]");
  var header = qs(".top-strip");
  if (!navItems.length) return;

  var sections = navItems
    .map(function(a){ return document.getElementById(a.getAttribute("data-nav")); })
    .filter(Boolean);

  if (!sections.length) return;

  function setActive(id){
    navItems.forEach(function(a){
      var on = a.getAttribute("data-nav") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function computeActive(){
    var headerH = header ? header.getBoundingClientRect().height : 0;
    var marker = headerH + 28;

    var active = sections[0].id;
    var bestTop = -Infinity;

    for (var i=0;i<sections.length;i++){
      var r = sections[i].getBoundingClientRect();
      if (r.top <= marker && r.top > bestTop){
        bestTop = r.top;
        active = sections[i].id;
      }
    }
    return active;
  }

  var ticking = false;
  function update(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      ticking = false;
      setActive(computeActive());
    });
  }

  // Listen on both (covers different browsers / scroll containers)
  window.addEventListener("scroll", update, { passive:true });
  document.addEventListener("scroll", update, true);
  window.addEventListener("resize", update, { passive:true });
  window.addEventListener("load", update);

  // When clicking nav, set instantly then update after scroll settles
  navItems.forEach(function(a){
    a.addEventListener("click", function(){
      var id = a.getAttribute("data-nav");
      if (id) setActive(id);
      // smooth-scroll animation window
      var start = performance.now();
      (function pump(){
        update();
        if (performance.now() - start < 900) requestAnimationFrame(pump);
      })();
      setTimeout(update, 140);
    });
  });

  // ✅ polling fallback (fixes “stuck” even if scroll events stop firing)
  var poll = setInterval(update, 250);
  document.addEventListener("visibilitychange", function(){
    if (document.hidden){
      clearInterval(poll);
      poll = null;
    } else if (!poll){
      poll = setInterval(update, 250);
      update();
    }
  });

  update();
}

/* =========================================================
   AURORA BOREALIS — optimized (low-res + fps cap)
   ========================================================= */
function initAuroraBorealis(){
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

  var vw=0, vh=0, w=0, h=0, dpr=1, scale=1;
  var fps = low ? 18 : 30;
  var last = 0;
  var start = performance.now();
  var running = true;

  var pointer = { x:0.5, y:0.5, tx:0.5, ty:0.5 };

  function applyQuality(){
    perf = window.__STUDIO_PERF__ || perf;
    low = !!perf.low;
    reduced = !!perf.reduced;
    fps = low ? 18 : 30;
    scale = low ? 0.55 : 0.75;
    dpr = low ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
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
    if (running && !reduced){
      last = 0;
      requestAnimationFrame(frame);
    }
  });

  function hexToRgba(hex, a) {
    var h = String(hex).replace("#", "");
    if (h.length !== 6) return "rgba(245,245,245," + a + ")";
    var r = parseInt(h.slice(0,2), 16);
    var g = parseInt(h.slice(2,4), 16);
    var b = parseInt(h.slice(4,6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  // simple smooth noise
  function rand1(i, seed){
    var x = (i|0) + (seed|0) * 131;
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
  function fbm1(x, seed){
    var sum = 0, amp = 0.55, freq = 1;
    for (var o=0; o<4; o++){
      sum += amp * noise1(x*freq, seed + o*17);
      amp *= 0.5; freq *= 2;
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

    var step = low ? 20 : 14;

    var g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0.00, hexToRgba(color, 0.00));
    g.addColorStop(clamp(baseY/h - 0.03, 0, 1), hexToRgba(color, 0.00));
    g.addColorStop(clamp((baseY + baseH*0.18)/h, 0, 1), hexToRgba(color, 0.26*intensity));
    g.addColorStop(clamp((baseY + baseH*0.60)/h, 0, 1), hexToRgba(color, 0.12*intensity));
    g.addColorStop(clamp((baseY + baseH)/h, 0, 1), hexToRgba(color, 0.00));

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    ctx.globalAlpha = (low ? 0.26 : 0.32) * intensity;
    ctx.lineWidth = low ? 10 : 12;

    // cheap single-stroke curtain
    ctx.beginPath();
    for (var x=-22; x<=w+22; x+=step){
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
  }

  function vignette(){
    var vg = ctx.createRadialGradient(w*0.52, h*0.44, 0, w*0.52, h*0.44, Math.max(w,h)*0.82);
    vg.addColorStop(0, "rgba(5,10,24,0)");
    vg.addColorStop(1, "rgba(5,10,24,0.84)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);
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

    vignette();
  }

  function frame(now){
    if (!running) return;

    if (reduced){
      render(now);
      return;
    }

    var minDt = 1000 / fps;
    if (last && (now - last) < minDt){
      requestAnimationFrame(frame);
      return;
    }
    last = now;

    render(now);
    requestAnimationFrame(frame);
  }

  resize();
  if (reduced) frame(performance.now());
  else requestAnimationFrame(frame);
}

/* =========================================================
   JELLYFISH — slow roam + slow trick
   ========================================================= */
function initJellyfishSlow(){
  var jf = qs("#jellyfish");
  var hero = qs("#home");
  if (!jf || !hero) return;

  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : { matches:false };

  function area(){
    if (mqMobile.matches) {
      return {
        w: Math.min(hero.clientWidth || window.innerWidth, window.innerWidth),
        h: Math.min(hero.clientHeight || window.innerHeight, window.innerHeight),
        pad: 12
      };
    }
    return { w: window.innerWidth, h: window.innerHeight, pad: 12 };
  }

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

    var size = 86;
    var aw = Math.max(0, a.w - size - 2*a.pad);
    var ah = Math.max(0, a.h - size - 2*a.pad);

    var cx = a.pad + aw/2;
    var cy = a.pad + ah/2;

    var t = secs * 0.11;
    var x = cx + (aw/2) * Math.sin(t);
    var y = cy + (ah/2) * Math.sin(t * 0.72 + 1.18);

    // slow trick
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

/* =========================================================
   TOOLBOARD WIRES (behind nodes)
   ========================================================= */
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
    for (var i=0;i<nodes.length;i++){
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

    // defs gradient
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    var grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "wireGrad");
    grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "1"); grad.setAttribute("y2", "1");
    var s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", "rgba(42,245,255,0.20)");
    var s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s2.setAttribute("offset", "50%");
    s2.setAttribute("stop-color", "rgba(109,40,217,0.18)");
    var s3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s3.setAttribute("offset", "100%");
    s3.setAttribute("stop-color", "rgba(255,79,216,0.14)");
    grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3);
    defs.appendChild(grad);
    svg.appendChild(defs);

    for (var i=0;i<pairs.length;i++){
      var a = pairs[i][0], b = pairs[i][1];
      var na = findNode(a), nb = findNode(b);
      if (!na || !nb) continue;

      var A = centerOf(na);
      var B = centerOf(nb);

      var midX = (A.x + B.x)/2;
      var midY = (A.y + B.y)/2;
      var bend = 18;
      var cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      var cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      var glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "url(#wireGrad)");
      glow.setAttribute("stroke-width", "6");
      glow.setAttribute("opacity", "0.18");
      glow.setAttribute("stroke-linecap", "round");
      svg.appendChild(glow);

      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(245,245,245,0.12)");
      path.setAttribute("stroke-width", "1.2");
      path.setAttribute("stroke-dasharray", "3 12");
      path.setAttribute("opacity", "0.85");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    }
  }

  window.addEventListener("resize", draw, { passive:true });
  window.addEventListener("load", draw);
  draw();
}

/* =========================================================
   PROJECT DRAWER — infinite loop + 5s auto + click pin + dblclick repo
   ========================================================= */
function initDrawerInfinite(){
  var drawer = qs("#drawer");
  if (!drawer) return null;

  var originals = qsa(".frame", drawer);
  var n = originals.length;
  if (!n) return null;

  originals.forEach(function(f, i){
    f.setAttribute("data-original-index", String(i));
    f.removeAttribute("data-clone");
  });

  // clone set before and after
  var fragBefore = document.createDocumentFragment();
  var fragAfter = document.createDocumentFragment();
  var clonesAfter = [];

  originals.forEach(function(f, i){
    var cb = f.cloneNode(true);
    cb.setAttribute("data-clone", "before");
    cb.setAttribute("data-original-index", String(i));
    fragBefore.appendChild(cb);

    var ca = f.cloneNode(true);
    ca.setAttribute("data-clone", "after");
    ca.setAttribute("data-original-index", String(i));
    fragAfter.appendChild(ca);
    clonesAfter.push(ca);
  });

  drawer.insertBefore(fragBefore, drawer.firstChild);
  drawer.appendChild(fragAfter);

  var frames = qsa(".frame", drawer);

  function recalcGeom(){
    var start = originals[0].offsetLeft;
    var setWidth = (clonesAfter[0] ? clonesAfter[0].offsetLeft : start) - start;
    return { start: start, setWidth: setWidth };
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
    for (var i=0;i<frames.length;i++){
      var f = frames[i];
      var fc = f.offsetLeft + f.clientWidth/2;
      var d = Math.abs(fc - center);
      if (d < bestDist){ bestDist = d; best = f; }
    }
    return best;
  }

  function normalize(){
    var g = recalcGeom();
    if (!g.setWidth) return;

    var min = g.start;
    var max = g.start + g.setWidth;

    while (drawer.scrollLeft < min) drawer.scrollLeft += g.setWidth;
    while (drawer.scrollLeft >= max) drawer.scrollLeft -= g.setWidth;
  }

  // start centered at first original
  centerTo(originals[0], "auto");
  normalize();

  // pin logic
  var pinned = false;
  var pinnedIndex = 0;
  function setPinnedUI(el){
    frames.forEach(function(f){ f.classList.remove("is-pinned"); });
    if (el) el.classList.add("is-pinned");
  }

  var clickTimer = null;

  function pinTo(idx){
    pinned = true;
    pinnedIndex = idx;
    stopAuto();
    setPinnedUI(originals[idx]);
    centerTo(originals[idx], "smooth");
  }

  function unpin(){
    pinned = false;
    setPinnedUI(null);
    startAuto();
  }

  // attach click/dblclick
  frames.forEach(function(frame){
    var openBtn = qs("[data-open]", frame);
    if (openBtn){
      openBtn.addEventListener("click", function(e){
        e.stopPropagation();
      });
    }

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
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      var repo = frame.getAttribute("data-repo");
      if (repo) window.open(repo, "_blank", "noopener");
    });
  });

  // arrow controls
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
    });
  });

  // normalize after scroll ends
  var scrollEnd = null;
  drawer.addEventListener("scroll", function(){
    if (scrollEnd) clearTimeout(scrollEnd);
    scrollEnd = setTimeout(function(){
      normalize();
    }, 120);
  }, { passive:true });

  window.addEventListener("resize", function(){
    normalize();
  }, { passive:true });

  // auto advance
  var timer = null;
  function startAuto(){
    if (timer || pinned) return;
    timer = setInterval(function(){
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
    clearInterval(timer);
    timer = null;
  }

  startAuto();

  return { pause: stopAuto, resume: startAuto, isPinned: function(){ return pinned; } };
}

/* =========================================================
   EXHIBIT SHEET (modal)
   ========================================================= */
function initExhibitSheet(drawerApi){
  var sheet = qs("#sheet");
  if (!sheet) return;

  var overlay = qs(".sheet__overlay", sheet);
  var closeBtns = qsa("[data-sheet='close']", sheet);

  var titleEl = qs("#sheetTitle");
  var descEl = qs("#sheetDesc");
  var tagsEl = qs("#sheetTags");
  var kindEl = qs("#sheetKind");
  var repoEl = qs("#sheetRepo");
  var imgEl = qs("#sheetImage");

  if (!overlay || !titleEl || !descEl || !tagsEl || !kindEl || !repoEl || !imgEl) return;

  function openFromFrame(frame){
    if (drawerApi && drawerApi.pause) drawerApi.pause();

    var title = frame.getAttribute("data-title") || "Project";
    var kind = frame.getAttribute("data-kind") || "Project";
    var desc = frame.getAttribute("data-desc") || "";
    var tags = (frame.getAttribute("data-tags") || "").split(",").map(function(s){ return s.trim(); }).filter(Boolean);
    var repo = frame.getAttribute("data-repo") || "#";
    var img = frame.getAttribute("data-image") || "";

    titleEl.textContent = title;
    descEl.textContent = desc;
    kindEl.textContent = String(kind).toUpperCase();
    repoEl.href = repo;

    imgEl.src = img;
    imgEl.alt = title + " preview";

    tagsEl.innerHTML = "";
    tags.forEach(function(t){
      var span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      tagsEl.appendChild(span);
    });

    lockScroll();
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function close(){
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (drawerApi && drawerApi.resume) drawerApi.resume();
  }

  // open buttons
  qsa(".frame").forEach(function(frame){
    var btn = qs("[data-open]", frame);
    if (btn){
      btn.addEventListener("click", function(e){
        e.preventDefault();
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
