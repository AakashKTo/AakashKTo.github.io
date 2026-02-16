/* ========= Helpers (safe + compatible) ========= */
function qs(sel, el){ return (el || document).querySelector(sel); }
function qsa(sel, el){ return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function pad2(n){ return (n < 10 ? "0" : "") + String(n); }

// Math.imul fallback
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

/* ========= Scroll lock (prevents “layout jump” due to scrollbar changes) ========= */
function lockScroll(){
  var de = document.documentElement;
  // scrollbar width: innerWidth - clientWidth
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

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", function(){
  document.documentElement.classList.add("js");

  safe("scrollRestoration", function(){
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  });

  safe("year", function(){
    var y = qs("#year");
    if (y) y.textContent = String(new Date().getFullYear());
  });

  safe("smoothScroll", initSmoothScroll);
  safe("dockSpy", initDockSpyStable);
  safe("cardLight", initCardLight);

  // background more eye-catching
  safe("bg", initEyeCatchingBackground);

  safe("jellyfish", initJellyfishSlowPath);
  safe("toolboardWires", initToolboardWires);

  var drawerApi = null;
  safe("drawerInfinite", function(){ drawerApi = initDrawerInfiniteLoop(); });

  safe("sheet", function(){ initExhibitSheet(drawerApi); });
  safe("thumbs", initGenerativeThumbs);
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

  qsa(".studio-dock a[href^='#']").forEach(function(a){
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

/* ========= Dock Spy (no jump) ========= */
function initDockSpyStable() {
  var navItems = qsa(".dock__item");
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
      a.classList.toggle("is-active", a.getAttribute("data-nav") === id);
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

/* ========= Card light ========= */
function initCardLight() {
  qsa(".card").forEach(function(card){
    card.addEventListener("pointermove", function(e){
      var r = card.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty("--mx", x + "%");
      card.style.setProperty("--my", y + "%");
    });
  });
}

/* ========= Background: aurora + particles + grain (eye-catching but tasteful) ========= */
function initEyeCatchingBackground(){
  var canvas = qs("#bg-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha:true });
  if (!ctx) return;

  var rs = getComputedStyle(document.documentElement);
  var cCoral = rs.getPropertyValue("--coral").trim() || "#FF6B6B";
  var cBlue  = rs.getPropertyValue("--blue").trim()  || "#4D96FF";
  var cGreen = rs.getPropertyValue("--green").trim() || "#6BCB77";

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var w=0,h=0,dpr=1;
  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize, { passive:true });

  function onMove(e){
    var x = (e.clientX || 0) / Math.max(1, w);
    var y = (e.clientY || 0) / Math.max(1, h);
    pointer.tx = clamp(x, 0, 1);
    pointer.ty = clamp(y, 0, 1);
  }
  window.addEventListener("pointermove", onMove, { passive:true });
  window.addEventListener("mousemove", onMove, { passive:true });

  // Orbs (aurora blobs)
  var orbCount = prefersReduced ? 4 : 7;
  var orbs = [];
  var pal = [cBlue, cCoral, cGreen, cBlue, cGreen, cCoral, cBlue];
  for (var i=0; i<orbCount; i++){
    var base = pal[i % pal.length];
    orbs.push({
      x: Math.random()*w,
      y: Math.random()*h,
      r: (Math.min(w,h) * (0.18 + Math.random()*0.22)),
      vx: (Math.random()-0.5) * 0.06,
      vy: (Math.random()-0.5) * 0.06,
      c: base,
      a: 0.14 + Math.random()*0.06
    });
  }

  // Particles (generative geometry)
  var pCount = prefersReduced ? 24 : 44;
  var particles = [];
  for (var p=0; p<pCount; p++){
    particles.push({
      x: Math.random()*w,
      y: Math.random()*h,
      vx: (Math.random()-0.5) * 0.03,
      vy: (Math.random()-0.5) * 0.03,
      r: 0.9 + Math.random()*1.6
    });
  }

  // Grain pattern
  var noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 128;
  noiseCanvas.height = 128;
  var nctx = noiseCanvas.getContext("2d");
  var noisePattern = null;

  function buildNoise(){
    if (!nctx) return;
    var img = nctx.createImageData(128, 128);
    for (var i=0; i<img.data.length; i+=4){
      var v = (Math.random()*255)|0;
      img.data[i] = v;
      img.data[i+1] = v;
      img.data[i+2] = v;
      img.data[i+3] = 28; // alpha
    }
    nctx.putImageData(img, 0, 0);
    try { noisePattern = ctx.createPattern(noiseCanvas, "repeat"); }
    catch(e){ noisePattern = null; }
  }
  buildNoise();

  var last = performance.now();
  function tick(now){
    var dt = Math.min(34, now-last);
    last = now;

    // smooth pointer
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // gentle trail fade
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(10,10,10,0.18)";
    ctx.fillRect(0,0,w,h);

    // aurora blobs (screen blend)
    ctx.globalCompositeOperation = "screen";
    var px = (pointer.x - 0.5) * 34;
    var py = (pointer.y - 0.5) * 22;

    for (var i=0; i<orbs.length; i++){
      var b = orbs[i];

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // slow “breathing” drift
      b.x += (w*0.5 - b.x) * 0.000006 * dt;
      b.y += (h*0.5 - b.y) * 0.000006 * dt;

      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r;
      if (b.y > h + b.r) b.y = -b.r;

      var ox = b.x + px;
      var oy = b.y + py;

      var g = ctx.createRadialGradient(ox, oy, 0, ox, oy, b.r);
      g.addColorStop(0, hexToRgba(b.c, b.a));
      g.addColorStop(0.55, hexToRgba(b.c, b.a * 0.35));
      g.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox-b.r, oy-b.r, b.r*2, b.r*2);
    }

    // particles + links
    ctx.globalCompositeOperation = "lighter";
    for (var j=0; j<particles.length; j++){
      var pt = particles[j];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;

      // wrap
      if (pt.x < -10) pt.x = w + 10;
      if (pt.x > w + 10) pt.x = -10;
      if (pt.y < -10) pt.y = h + 10;
      if (pt.y > h + 10) pt.y = -10;

      // dot
      ctx.fillStyle = "rgba(245,245,245,0.16)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2);
      ctx.fill();
    }

    // links (keep light so it doesn't get noisy)
    var maxD = 140;
    for (var a=0; a<particles.length; a++){
      for (var b= a+1; b<particles.length; b++){
        var dx = particles[a].x - particles[b].x;
        var dy = particles[a].y - particles[b].y;
        var d2 = dx*dx + dy*dy;
        if (d2 > maxD*maxD) continue;
        var d = Math.sqrt(d2);
        var alpha = (1 - d/maxD) * 0.07;
        ctx.strokeStyle = "rgba(245,245,245," + alpha + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(particles[a].x, particles[a].y);
        ctx.lineTo(particles[b].x, particles[b].y);
        ctx.stroke();
      }
    }

    // grain overlay
    ctx.globalCompositeOperation = "source-over";
    if (noisePattern){
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = noisePattern;
      ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 1;
    }

    // vignette
    var vg = ctx.createRadialGradient(w*0.5, h*0.5, 0, w*0.5, h*0.5, Math.max(w,h)*0.72);
    vg.addColorStop(0, "rgba(10,10,10,0)");
    vg.addColorStop(1, "rgba(10,10,10,0.78)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);

    if (!prefersReduced) requestAnimationFrame(tick);
  }

  // first paint
  ctx.fillStyle = "rgba(10,10,10,1)";
  ctx.fillRect(0,0,w,h);
  requestAnimationFrame(tick);
}

/* ========= Jellyfish: VERY slow smooth path ========= */
function initJellyfishSlowPath(){
  var jf = qs("#jellyfish");
  var hero = qs("#home");
  if (!jf || !hero) return;

  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : { matches:false };

  var size = { w: 160, h: 160 };
  function measure(){
    var r = jf.getBoundingClientRect();
    size.w = r.width || 160;
    size.h = r.height || 160;
  }

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

  measure();
  window.addEventListener("resize", function(){ measure(); }, { passive:true });

  var start = performance.now();
  function tick(now){
    var t = (now - start) * 0.000035; // slower than before (~180s cycle)

    var a = area();
    var aw = Math.max(0, a.w - size.w - 2*a.pad);
    var ah = Math.max(0, a.h - size.h - 2*a.pad);

    var cx = a.pad + aw/2;
    var cy = a.pad + ah/2;

    var x = cx + (aw/2) * Math.sin(t);
    var y = cy + (ah/2) * Math.sin(t * 0.72 + 1.4);

    var rot = Math.sin(t * 1.1) * 1.3;
    var scl = 1 + Math.sin(t * 0.9) * 0.012;

    jf.style.transform =
      "translate3d(" + x + "px," + y + "px,0) rotate(" + rot + "deg) scale(" + scl + ")";

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
      var bend = 22;
      var cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      var cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      var glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "rgba(77,150,255,0.07)");
      glow.setAttribute("stroke-width", "4");
      glow.setAttribute("opacity", "0.7");
      glow.setAttribute("stroke-linecap", "round");
      svg.appendChild(glow);

      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(245,245,245,0.11)");
      path.setAttribute("stroke-width", "1.2");
      path.setAttribute("stroke-dasharray", "3 11");
      path.setAttribute("opacity", "0.95");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    }
  }

  window.addEventListener("resize", draw, { passive:true });
  draw();
}

/* ========= Drawer: TRUE infinite loop ========= */
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
  var before = [];
  var after = [];

  originals.forEach(function(f, i){
    var cb = f.cloneNode(true);
    cb.setAttribute("data-clone", "before");
    cb.setAttribute("data-original-index", String(i));
    fragBefore.appendChild(cb);
    before.push(cb);

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

/* ========= Exhibit sheet ========= */
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

/* ========= Thumbnails (no ResizeObserver) ========= */
function initGenerativeThumbs(){
  function drawAll(){
    qsa("canvas.thumb").forEach(function(c){
      var seed = c.getAttribute("data-seed") || "thumb";
      var frame = c.closest ? c.closest(".frame") : null;
      var accent = frame ? (frame.getAttribute("data-accent") || "blue") : "blue";
      drawGenerativeArt(c, seed, accent);
    });
  }

  drawAll();
  window.addEventListener("resize", function(){
    clearTimeout(initGenerativeThumbs._t);
    initGenerativeThumbs._t = setTimeout(drawAll, 120);
  }, { passive:true });
}

/* ========= Seeded PRNG ========= */
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

/* ========= Generative art drawing ========= */
function drawGenerativeArt(canvas, seed, accentName) {
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = Math.max(1, canvas.clientWidth || 640);
  var h = Math.max(1, canvas.clientHeight || 360);

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var r = mulberry32(hashString(seed));
  var accent = getAccentColor(accentName);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(10,10,10,0.92)";
  ctx.fillRect(0, 0, w, h);

  var g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(245,245,245,0.06)");
  g.addColorStop(1, "rgba(245,245,245,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (var i = 0; i < 10; i++) {
    var yy = (i / 9) * h;
    ctx.strokeStyle = "rgba(245,245,245," + (0.03 + r() * 0.03) + ")";
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  var arcs = 10 + Math.floor(r() * 10);
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

  var nodes = 24 + Math.floor(r() * 22);
  for (var k = 0; k < nodes; k++) {
    var x = r() * w;
    var y = r() * h;
    var rr = 1.5 + r() * 3.8;

    ctx.fillStyle = (k % 5 === 0)
      ? hexToRgba(accent, 0.55)
      : "rgba(245,245,245," + (0.10 + r() * 0.20) + ")";

    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();

    if (k % 6 === 0) {
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
  vg.addColorStop(0, "rgba(10,10,10,0)");
  vg.addColorStop(1, "rgba(10,10,10,0.78)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
