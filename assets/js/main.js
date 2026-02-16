/* ===== Helpers ===== */
function qs(sel, el){ return (el || document).querySelector(sel); }
function qsa(sel, el){ return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function hexToRgba(hex, a) {
  var h = String(hex).replace("#", "");
  if (h.length !== 6) return "rgba(245,245,245," + a + ")";
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

/* ===== Boot (DOM ready, not window.load) ===== */
document.addEventListener("DOMContentLoaded", function(){
  document.documentElement.classList.add("js");

  // Prevent “friend starts at bottom” via scroll restoration
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  var y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  initSmoothScroll();
  initDockSpyStable();     // fixed: non-jumpy
  initCardLight();
  initBlobBackground();
  initJellyfishRoam();     // hardened + no “silent disable”
  initToolboardWires();
  var drawerApi = initDrawerAutoPin(); // hardened: no vertical scroll
  initExhibitSheet(drawerApi);
  initGenerativeThumbs();
});

/* ===== Smooth scroll ===== */
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

/* ===== Dock Spy: stable, no jitter =====
   Logic: active = last section whose top has passed a fixed offset below header
*/
function initDockSpyStable() {
  var navItems = qsa(".dock__item");
  var sections = qsa("[data-section]");
  var header = qs(".top-strip");
  if (!navItems.length || !sections.length) return;

  var map = {};
  navItems.forEach(function(a){ map[a.getAttribute("data-nav")] = a; });

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

/* ===== Card light ===== */
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

/* ===== Ambient blobs ===== */
function initBlobBackground() {
  var canvas = qs("#bg-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha:true });
  if (!ctx) return;

  var rootStyle = getComputedStyle(document.documentElement);
  var cCoral = rootStyle.getPropertyValue("--coral").trim() || "#FF6B6B";
  var cBlue  = rootStyle.getPropertyValue("--blue").trim()  || "#4D96FF";
  var cGreen = rootStyle.getPropertyValue("--green").trim() || "#6BCB77";

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var w=0,h=0,dpr=1;

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

  var palette = [
    { hex: cCoral, a: 0.11 },
    { hex: cBlue,  a: 0.10 },
    { hex: cGreen, a: 0.09 }
  ];

  var count = prefersReduced ? 4 : 6;
  var blobs = [];
  for (var i=0; i<count; i++){
    var p = palette[i % palette.length];
    blobs.push({
      x: Math.random()*w,
      y: Math.random()*h,
      r: (Math.min(w,h) * (0.18 + Math.random()*0.18)),
      vx: (Math.random()-0.5)*0.18,
      vy: (Math.random()-0.5)*0.18,
      c: p.hex,
      a: p.a
    });
  }

  var last = performance.now();
  function tick(now){
    var dt = Math.min(32, now-last);
    last = now;

    ctx.fillStyle = "rgba(10,10,10,0.22)";
    ctx.fillRect(0,0,w,h);

    for (var i=0; i<blobs.length; i++){
      var b = blobs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.x += (w*0.5 - b.x) * 0.00002 * dt;
      b.y += (h*0.5 - b.y) * 0.00002 * dt;

      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r;
      if (b.y > h + b.r) b.y = -b.r;

      var g = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
      g.addColorStop(0, hexToRgba(b.c, b.a));
      g.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(b.x-b.r, b.y-b.r, b.r*2, b.r*2);
    }

    if (!prefersReduced) requestAnimationFrame(tick);
  }

  ctx.fillStyle = "rgba(10,10,10,1)";
  ctx.fillRect(0,0,w,h);
  requestAnimationFrame(tick);
}

/* ===== Jellyfish roam (hardened) =====
   Desktop: fixed in viewport
   Mobile: absolute inside hero (CSS), JS confines to hero box
   Also: never fully disables (reduced motion just slows)
*/
function initJellyfishRoam() {
  var jf = qs("#jellyfish");
  var hero = qs("#home");
  if (!jf || !hero) return;

  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 768px)") : { matches:false };

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motionScale = prefersReduced ? 0.35 : 1;

  var s = { w: 160, h: 160 };
  function measure(){
    var r = jf.getBoundingClientRect();
    s.w = r.width || 160;
    s.h = r.height || 160;
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

  function rand(min,max){ return min + Math.random()*(max-min); }

  var x=0,y=0,vx=0,vy=0,tx=0,ty=0,nextAt=0;
  function pickTarget(now){
    var a = area();
    tx = rand(a.pad, Math.max(a.pad, a.w - s.w - a.pad));
    ty = rand(a.pad, Math.max(a.pad, a.h - s.h - a.pad));
    nextAt = now + (2600 + Math.random()*3200) / motionScale;
  }

  function clampX(nx, a){
    return clamp(nx, a.pad, Math.max(a.pad, a.w - s.w - a.pad));
  }
  function clampY(ny, a){
    return clamp(ny, a.pad, Math.max(a.pad, a.h - s.h - a.pad));
  }

  function reset(){
    measure();
    var a = area();
    x = clampX(rand(a.pad, a.w - s.w - a.pad), a);
    y = clampY(rand(a.pad, a.h - s.h - a.pad), a);
    vx = 0; vy = 0;
    pickTarget(performance.now());
  }

  reset();

  function onMQChange(){ reset(); }
  if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMQChange);
  else if (mqMobile.addListener) mqMobile.addListener(onMQChange);

  window.addEventListener("resize", function(){ measure(); }, { passive:true });

  var last = performance.now();
  function tick(now){
    var dt = Math.min(34, now-last);
    last = now;

    if (now >= nextAt) pickTarget(now);

    var a = area();

    var ax = (tx - x) * 0.00035 * motionScale;
    var ay = (ty - y) * 0.00035 * motionScale;

    vx = (vx + ax * dt) * (1 - 0.015 * motionScale);
    vy = (vy + ay * dt) * (1 - 0.015 * motionScale);

    vx += (Math.random()-0.5) * 0.0020 * dt * motionScale;
    vy += (Math.random()-0.5) * 0.0020 * dt * motionScale;

    x += vx * dt;
    y += vy * dt;

    var x2 = clampX(x, a);
    var y2 = clampY(y, a);
    if (x2 !== x) vx *= -0.55;
    if (y2 !== y) vy *= -0.55;
    x = x2; y = y2;

    var angle = Math.atan2(vy, vx) * 180 / Math.PI;
    var breathe = 1 + Math.sin(now * 0.0011) * 0.03 * motionScale;

    jf.style.transform =
      "translate3d(" + x + "px," + y + "px,0) rotate(" + (angle*0.10) + "deg) scale(" + breathe + ")";

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ===== Toolboard wires ===== */
function initToolboardWires() {
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
      var bend = 24;
      var cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      var cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      var glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", "M " + A.x + " " + A.y + " Q " + cx + " " + cy + " " + B.x + " " + B.y);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "rgba(77,150,255,0.08)");
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

  var ro = new ResizeObserver(draw);
  ro.observe(box);
  window.addEventListener("resize", draw, { passive:true });
  draw();
}

/* ===== Drawer: auto only when visible, horizontal-only scrolling ===== */
function initDrawerAutoPin() {
  var drawer = qs("#drawer");
  var meta = qs("#drawerMeta");
  var gallery = qs("#gallery");
  if (!drawer || !meta || !gallery) return null;

  var frames = qsa(".frame", drawer);
  var n = frames.length || 1;

  var pinned = false;
  var pinnedIndex = 0;
  var timer = null;
  var clickTimer = null;

  function frameCenter(i){
    var el = frames[i];
    return el.offsetLeft + el.clientWidth/2;
  }

  function currentIndex(){
    var c = drawer.scrollLeft + drawer.clientWidth/2;
    var best = 0;
    var bestDist = Infinity;
    for (var i=0; i<frames.length; i++){
      var d = Math.abs(frameCenter(i) - c);
      if (d < bestDist){ bestDist = d; best = i; }
    }
    return best;
  }

  function scrollToIndex(i, behavior){
    var el = frames[i];
    if (!el) return;
    var left = el.offsetLeft - (drawer.clientWidth - el.clientWidth)/2;
    drawer.scrollTo({ left: left, behavior: behavior || "smooth" });
  }

  function updateMeta(){
    if (pinned) {
      meta.textContent =
        "PINNED • PIECE " + String(pinnedIndex + 1).padStart(2,"0") +
        " OF " + String(n).padStart(2,"0") +
        " • CLICK AGAIN TO UNPIN • DOUBLE‑CLICK FOR REPO";
    } else {
      var i = currentIndex();
      meta.textContent =
        "AUTO (WHEN VISIBLE) • PIECE " + String(i + 1).padStart(2,"0") +
        " OF " + String(n).padStart(2,"0") +
        " • 5s • CLICK TO PIN • DOUBLE‑CLICK FOR REPO";
    }
  }

  function startAuto(){
    if (timer || pinned) return;
    timer = window.setInterval(function(){
      if (pinned) return;
      var i = currentIndex();
      var next = (i + 1) % n;
      scrollToIndex(next, "smooth");
      updateMeta();
    }, 5000);
  }

  function stopAuto(){
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  function pinTo(i){
    pinned = true;
    pinnedIndex = i;
    stopAuto();
    frames.forEach(function(f, idx){ f.classList.toggle("is-pinned", idx === i); });
    scrollToIndex(i, "smooth");
    updateMeta();
  }

  function unpin(){
    pinned = false;
    frames.forEach(function(f){ f.classList.remove("is-pinned"); });
    updateMeta();
    // auto resumes only if visible
    if (isGalleryVisible()) startAuto();
  }

  function isGalleryVisible(){
    var r = gallery.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (visible <= 0) return false;
    var need = Math.min(vh, r.height) * 0.35;
    return visible >= need;
  }

  // Auto-run only when gallery is in view (prevents “scrolling me to projects” behavior)
  var visTick = false;
  function visLoop(){
    if (visTick) return;
    visTick = true;
    requestAnimationFrame(function(){
      visTick = false;
      if (pinned) return;

      if (isGalleryVisible()) startAuto();
      else stopAuto();
    });
  }
  window.addEventListener("scroll", visLoop, { passive:true });
  window.addEventListener("resize", visLoop, { passive:true });

  // Click logic:
  // - single click (not on buttons): pin (or unpin if already pinned on same card)
  // - double click: open repo (and does NOT pin)
  frames.forEach(function(frame, idx){
    frame.addEventListener("click", function(e){
      if (e.target.closest("button,a")) return;

      // delay to differentiate from dblclick
      if (clickTimer) return;
      clickTimer = window.setTimeout(function(){
        clickTimer = null;
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

  // Controls
  qsa("[data-drawer]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var dir = btn.getAttribute("data-drawer");
      var i = pinned ? pinnedIndex : currentIndex();
      var next = dir === "next" ? (i + 1) % n : (i - 1 + n) % n;
      scrollToIndex(next, "smooth");
      if (pinned){
        pinnedIndex = next;
        frames.forEach(function(f, j){ f.classList.toggle("is-pinned", j === next); });
      }
      updateMeta();
    });
  });

  // Meta update on horizontal scroll
  var raf = null;
  drawer.addEventListener("scroll", function(){
    if (pinned) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateMeta);
  }, { passive:true });

  updateMeta();
  visLoop(); // start/stop based on visibility
  return { pause: stopAuto, resume: visLoop, unpin: unpin, isPinned: function(){ return pinned; } };
}

/* ===== Exhibit sheet ===== */
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

    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (drawerApi && drawerApi.resume) drawerApi.resume();
  }

  qsa(".frame").forEach(function(frame){
    var openBtn = qs("[data-open]", frame);
    if (openBtn){
      openBtn.addEventListener("click", function(e){
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

  closeBtns.forEach(function(el){
    if (el.tagName && el.tagName.toLowerCase() === "a") el.addEventListener("click", close);
  });
}

/* ===== Generative thumbnails ===== */
function initGenerativeThumbs() {
  var thumbs = qsa("canvas.thumb");
  if (!thumbs.length) return;

  var ro = new ResizeObserver(function(){
    thumbs.forEach(function(c){
      var seed = c.getAttribute("data-seed") || "thumb";
      var frame = c.closest(".frame");
      var accent = frame ? (frame.getAttribute("data-accent") || "blue") : "blue";
      drawGenerativeArt(c, seed, accent);
    });
  });

  thumbs.forEach(function(c){ ro.observe(c); });

  thumbs.forEach(function(c){
    var seed = c.getAttribute("data-seed") || "thumb";
    var frame = c.closest(".frame");
    var accent = frame ? (frame.getAttribute("data-accent") || "blue") : "blue";
    drawGenerativeArt(c, seed, accent);
  });
}

/* ===== Seeded PRNG ===== */
function hashString(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getAccentColor(accent) {
  var cs = getComputedStyle(document.documentElement);
  if (accent === "coral") return cs.getPropertyValue("--coral").trim() || "#FF6B6B";
  if (accent === "green") return cs.getPropertyValue("--green").trim() || "#6BCB77";
  return cs.getPropertyValue("--blue").trim() || "#4D96FF";
}

/* ===== Generative art drawing ===== */
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
