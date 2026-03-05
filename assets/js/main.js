/* =========================================================
   AAKASH — main.js (simplified)
   - REMOVED relationships system entirely
   - Jellyfish follows cursor / touch (slow + floaty)
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

/* Performance profile */
function getPerfProfile(){
  var reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch(e){}
  var dm = 0, hc = 0, saveData = false;
  try { dm = navigator.deviceMemory || 0; } catch(e){}
  try { hc = navigator.hardwareConcurrency || 0; } catch(e){}
  try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch(e){}

  var low = false;
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

function syncTopbarHeight(){
  var bar = document.getElementById("topStrip") || document.querySelector(".top-strip");
  if (!bar) return;
  var h = Math.ceil(bar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--topbar-h", h + "px");
}

/* Safe init wrapper */
function safeInit(name, fn){
  try { fn(); }
  catch (e) { console.warn("[init failed]", name, e); }
}

document.addEventListener("DOMContentLoaded", function(){
  applyPerformanceProfile();

  // stop weird auto-scroll behavior
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  } catch(e){}

  var y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  syncTopbarHeight();
  window.addEventListener("resize", syncTopbarHeight, { passive:true });
  window.addEventListener("load", syncTopbarHeight);

  safeInit("mobile nav", initMobileNavDropdown);
  safeInit("smooth scroll", initSmoothScroll);
  safeInit("nav spy", initNavSpyFixStuck);

  safeInit("aurora", initAuroraBorealisDepth);

  // Spotlight Cursor replaces Jellyfish
  safeInit("spotlight cursor", initSpotlightCursor);

  safeInit("card tilt", initCardTilt);
  safeInit("magnetic elements", initMagneticElements);
  safeInit("neural connections", initNeuralConnections);

  safeInit("universal lens", initUniversalLens);
  
  safeInit("scroll reveal", initScrollReveal);
  safeInit("animated counters", initAnimatedCounters);
  safeInit("page load", initPageLoadTransition);
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
    syncTopbarHeight();
  }
  function close(){
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    syncTopbarHeight();
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
   SMOOTH SCROLL
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
   NAV SPY (fix stuck)
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

  window.addEventListener("scroll", update, { passive:true });
  window.addEventListener("resize", update, { passive:true });
  window.addEventListener("load", update);

  navItems.forEach(function(a){
    a.addEventListener("click", function(){
      var id = a.getAttribute("data-nav");
      if (id) setActive(id);

      var start = performance.now();
      (function pump(){
        update();
        if (performance.now() - start < 900) requestAnimationFrame(pump);
      })();
      setTimeout(update, 140);
    });
  });

  // Poll fallback
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
   UNIVERSAL FOCUS LENS (Performant JS)
   ========================================================= */
function initUniversalLens(){
  var isMobile = false;
  try { isMobile = window.matchMedia("(pointer: coarse)").matches; } catch(e){}
  if (isMobile) return;

  var body = document.body;
  var hoverTimer;

  // Event delegation for extreme performance
  document.addEventListener('mouseover', function(e) {
    var card = e.target.closest('.cut');
    if (card && !card.closest('details[open]')) {
      clearTimeout(hoverTimer);
      body.classList.add('has-hovered-card');
    }
  }, { passive: true });
  
  document.addEventListener('mouseout', function(e) {
    var card = e.target.closest('.cut');
    if (card) {
      var related = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.cut') : null;
      if (!related || related === card) {
        // Small debounce to prevent flickering when moving between adjacent cards
        hoverTimer = setTimeout(function() {
          body.classList.remove('has-hovered-card');
        }, 50);
      }
    }
  }, { passive: true });
}

/* =========================================================
   ANIMATED COUNTERS (Impact Stamps)
   ========================================================= */
function initAnimatedCounters() {
  var stamps = qsa(".stamp__value");
  if (!stamps.length) return;

  stamps.forEach(function(el) {
    var raw = el.textContent.trim();
    // Extract number, prefix (e.g. +, -, −), and suffix (e.g. %)
    var match = raw.match(/^([^0-9]*)([0-9]+)(.*$)/);
    if (!match) return;

    var prefix = match[1];
    var target = parseInt(match[2], 10);
    var suffix = match[3];
    el.textContent = prefix + "0" + suffix;
    el.dataset.counterTarget = target;
    el.dataset.counterPrefix = prefix;
    el.dataset.counterSuffix = suffix;
    el.dataset.counted = "false";
  });

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && entry.target.dataset.counted === "false") {
        entry.target.dataset.counted = "true";
        animateValue(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stamps.forEach(function(el) { observer.observe(el); });

  function animateValue(el) {
    var target = parseInt(el.dataset.counterTarget, 10);
    var prefix = el.dataset.counterPrefix;
    var suffix = el.dataset.counterSuffix;
    var duration = 1200;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(eased * target);
      el.textContent = prefix + current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
}

/* =========================================================
   STARTUP REVEAL (Animated Neural Network - V3 Optimized)
   ========================================================= */
function initPageLoadTransition() {
  var overlay = qs('#startupOverlay');
  var canvas = qs('#startupCanvas');
  var brand = qs('.startup__brand');

  if (!overlay || !canvas) {
    document.body.classList.add('is-loaded');
    return;
  }

  // Hide site content behind overlay
  var mainContent = qs('main');
  var topStrip = qs('.top-strip');
  var footer = qs('.footer');
  if (mainContent) mainContent.style.opacity = '0';
  if (topStrip) topStrip.style.opacity = '0';
  if (footer) footer.style.opacity = '0';

  var ctx = canvas.getContext('2d', { alpha: false }); // optimization flag
  var w, h;
  var nodes = [];
  var isAnimating = true;
  var burstMode = false;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  }

  function spawnNode(isInitial) {
    var angle = Math.random() * Math.PI * 2;
    var distance = Math.random() * Math.max(w, h) * 0.8;
    return {
      angle: angle,
      distance: distance,
      speed: (Math.random() * 0.002 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      radius: Math.random() * 2 + 1,
      alpha: isInitial ? Math.random() * 0.5 : 0
    };
  }

  function initNodes() {
    nodes = [];
    var count = window.innerWidth < 768 ? 40 : 80;
    for (var i = 0; i < count; i++) {
      nodes.push(spawnNode(true));
    }
  }

  function draw() {
    if (!isAnimating) return;
    
    // Fake dark background for alpha: false optimization
    ctx.fillStyle = '#050A18';
    ctx.fillRect(0, 0, w, h);
    
    var centerX = w / 2;
    var centerY = h / 2;
    var centerRadius = burstMode ? 2000 : 300; 

    // O(N) loop ONLY. No node-to-node math.
    ctx.lineWidth = 1.2;
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      
      // Orbit logic
      p.angle += p.speed;
      if (burstMode) {
         p.distance += 25; // explode rapidly
         p.alpha *= 0.9;
      } else {
         p.alpha = Math.min(0.8, p.alpha + 0.01);
      }
      
      var x = centerX + Math.cos(p.angle) * p.distance;
      var y = centerY + Math.sin(p.angle) * p.distance;
      
      // Draw Node
      ctx.beginPath();
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(42, 245, 255, ' + p.alpha + ')'; 
      ctx.fill();

      // Draw connection to center brain (AAKASH)
      if (p.distance < centerRadius && !burstMode) {
          var lineAlpha = (1 - p.distance / centerRadius) * p.alpha * 0.8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(centerX, centerY);
          ctx.strokeStyle = 'rgba(77, 150, 255, ' + lineAlpha + ')'; 
          ctx.stroke();
      }
    }

    requestAnimationFrame(draw);
  }

  function startSequence() {
    window.addEventListener('resize', resize);
    resize();
    initNodes();
    requestAnimationFrame(draw);

    setTimeout(function() {
      if (brand) brand.classList.add('is-visible');
    }, 400);

    setTimeout(function() {
      if (brand) brand.classList.add('is-glowing');
      burstMode = true; // Ignites the network outward
    }, 1800);

    setTimeout(function() {
      overlay.classList.add('is-exiting');

      if (mainContent) { mainContent.style.transition = 'opacity 0.8s ease'; mainContent.style.opacity = '1'; }
      if (topStrip) { topStrip.style.transition = 'opacity 0.8s ease'; topStrip.style.opacity = '1'; }
      if (footer) { footer.style.transition = 'opacity 0.8s ease'; footer.style.opacity = '1'; }
      document.body.classList.add('is-loaded');

      setTimeout(function() {
        isAnimating = false;
        window.removeEventListener('resize', resize);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 1000); 
    }, 2400); 
  }

  if (document.readyState === 'complete') {
    startSequence();
  } else {
    window.addEventListener('load', startSequence);
  }
}

/* =========================================================
   SCROLL REVEAL (Intersection Observer)
   ========================================================= */
function initScrollReveal() {
  var elements = qsa(".reveal-up");
  if (!elements.length) return;

  var observer = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: "0px 0px -50px 0px",
    threshold: 0.1
  });

  elements.forEach(function(el) {
    observer.observe(el);
  });
}

/* =========================================================
   3D CARD TILT
   ========================================================= */
function initCardTilt() {
  var isMobile = false;
  try { isMobile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch(e){}
  if (isMobile) return;

  var cards = qsa('.cut');
  cards.forEach(function(card) {
    // Avoid tilting open details heavily as it breaks reading experience
    if (card.tagName.toLowerCase() === 'details') return;
    
    card.addEventListener('mousemove', function(e) {
      if (card.tagName.toLowerCase() === 'details' && card.hasAttribute('open')) return;
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;
      var percentX = (x - centerX) / centerX;
      var percentY = (y - centerY) / centerY;
      var maxTilt = 6;
      
      card.style.setProperty('--rx', (-percentY * maxTilt) + 'deg');
      card.style.setProperty('--ry', (percentX * maxTilt) + 'deg');
    }, { passive: true });
    
    card.addEventListener('mouseleave', function() {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    }, { passive: true });
  });
}

/* =========================================================
   MAGNETIC ELEMENTS
   ========================================================= */
function initMagneticElements() {
  var isMobile = false;
  try { isMobile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch(e){}
  if (isMobile) return;

  var magneticElements = qsa('.btn, .icon-btn, .icon-tile');
  if (!magneticElements.length) return;

  var pullRadius = 100;

  window.addEventListener('mousemove', function(e) {
    // requestAnimationFrame to avoid blocking
    requestAnimationFrame(function() {
      magneticElements.forEach(function(el) {
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        
        var dx = e.clientX - centerX;
        var dy = e.clientY - centerY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < pullRadius) {
          // Normalize distance and calculate pull
          var pull = 1 - (dist / pullRadius);
          var maxPull = 12; // max px to pull
          
          // Easing logic for smoother pull
          var easePull = pull * pull; 
          
          var mx = (dx / dist) * maxPull * easePull;
          var my = (dy / dist) * maxPull * easePull;
          
          el.style.setProperty('--mx', mx + 'px');
          el.style.setProperty('--my', my + 'px');
        } else {
          el.style.setProperty('--mx', '0px');
          el.style.setProperty('--my', '0px');
        }
      });
    });
  }, { passive: true });
}

/* =========================================================
   TECH STACK NEURAL CONNECTIONS
   ========================================================= */
function initNeuralConnections() {
  var isMobile = false;
  try { isMobile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch(e){}
  if (isMobile) return;

  var board = qs('#toolboardBox');
  if (!board) return;

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '0';
  svg.style.opacity = '0';
  svg.style.transition = 'opacity 0.3s ease';
  
  board.appendChild(svg);
  
  var nodes = qsa('.toolnode', board);
  
  var colors = {
    'coral': 'rgba(255,107,107, 0.45)',
    'blue': 'rgba(77,150,255, 0.45)',
    'green': 'rgba(107,203,119, 0.45)'
  };

  nodes.forEach(function(node) {
    node.addEventListener('mouseenter', function() {
      svg.innerHTML = '';
      var accent = node.getAttribute('data-accent') || 'blue';
      var color = colors[accent] || colors['blue'];
      
      var chips = qsa('.chip', node);
      if (chips.length < 2) return;
      
      var boardRect = board.getBoundingClientRect();
      var points = [];
      
      chips.forEach(function(chip) {
        var r = chip.getBoundingClientRect();
        points.push({
          x: r.left - boardRect.left + r.width / 2,
          y: r.top - boardRect.top + r.height / 2
        });
      });
      
      for (var i = 0; i < points.length; i++) {
        var maxConn = Math.min(2, points.length - 1 - i);
        for (var j = 1; j <= maxConn; j++) {
          var p1 = points[i];
          var p2 = points[i+j];
          
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          var d = "";
          if (Math.random() > 0.5) {
            d = "M " + p1.x + "," + p1.y + " Q " + p1.x + "," + p2.y + " " + p2.x + "," + p2.y;
          } else {
            d = "M " + p1.x + "," + p1.y + " Q " + p2.x + "," + p1.y + " " + p2.x + "," + p2.y;
          }
          
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', '1.5');
          path.setAttribute('class', 'neural-line');
          svg.appendChild(path);
        }
      }
      
      svg.style.opacity = '1';
    });
    
    node.addEventListener('mouseleave', function() {
      svg.style.opacity = '0';
    });
  });
}

/* =========================================================
   SPOTLIGHT CURSOR (Feature 3 Alternative)
   ========================================================= */
function initSpotlightCursor(){
  // Inject the spotlight div dynamically since we removed the SVG
  var spotlight = document.createElement('div');
  spotlight.className = 'spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  document.body.appendChild(spotlight);

  var root = document.documentElement;
  var isMobile = false;
  
  // Only activate precise hovering if it's a mouse
  try { isMobile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch(e){}

  if (isMobile) return;

  function updateMouseVars(e) {
    document.body.classList.add('has-mouse');
    
    // Global spotlight on body coordinates
    root.style.setProperty('--mouse-x', e.clientX + 'px');
    root.style.setProperty('--mouse-y', e.clientY + 'px');

    // Card-specific coordinates for highlighting borders/insides dynamically
    var cards = qsa('.cut');
    cards.forEach(function(card) {
      if (!card) return;
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', x + 'px');
      card.style.setProperty('--mouse-y', y + 'px');
    });
  }

  window.addEventListener('mousemove', function(e){
    // Debounce through requestAnimationFrame for performance
    requestAnimationFrame(function() {
      updateMouseVars(e);
    });
  }, { passive: true });
}

/* =========================================================
   AURORA — depth layers + dust (optimized)
   (unchanged from your last working version)
   ========================================================= */
function initAuroraBorealisDepth(){
  var canvas = qs("#bg-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha:true });
  if (!ctx) return;

  var perf = window.__STUDIO_PERF__ || { low:false, reduced:false };
  var low = !!perf.low;

  var rs = getComputedStyle(document.documentElement);
  var C_TEAL = (rs.getPropertyValue("--teal").trim() || "#2AF5FF");
  var C_VIO  = (rs.getPropertyValue("--violet").trim() || "#6D28D9");
  var C_MAG  = (rs.getPropertyValue("--magenta").trim() || "#FF4FD8");

  // Section-based aurora color palettes
  var PALETTES = {
    home:      { t: "#2AF5FF", v: "#6D28D9", m: "#FF4FD8" },
    impact:    { t: "#FF6B6B", v: "#FF4FD8", m: "#6D28D9" },
    techstack: { t: "#4D96FF", v: "#2AF5FF", m: "#6BCB77" },
    education: { t: "#6D28D9", v: "#FF4FD8", m: "#2AF5FF" },
    experience:{ t: "#FF6B6B", v: "#4D96FF", m: "#6BCB77" },
    projects:  { t: "#6BCB77", v: "#2AF5FF", m: "#4D96FF" },
    contact:   { t: "#2AF5FF", v: "#6D28D9", m: "#FF4FD8" }
  };

  // Observe sections and shift aurora colors
  var sections = document.querySelectorAll("[data-section]");
  if (sections.length) {
    var sectionObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id || "home";
          var p = PALETTES[id] || PALETTES.home;
          C_TEAL = p.t;
          C_VIO  = p.v;
          C_MAG  = p.m;
        }
      });
    }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
    sections.forEach(function(s) { sectionObs.observe(s); });
  }

  var hasFilter = ("filter" in ctx);

  var vw=0, vh=0, w=0, h=0, dpr=1, scale=1;
  var fps = low ? 18 : 30;
  var last = 0;
  var start = performance.now();
  var running = true;

  var slowScore = 0;

  var pointer = { x:0.5, y:0.5, tx:0.5, ty:0.5 };
  var stars = [];
  var dust = [];

  function applyQuality(){
    perf = window.__STUDIO_PERF__ || perf;
    low = !!perf.low;
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
    buildDust();
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
    if (running){
      last = 0;
      requestAnimationFrame(frame);
    }
  });

  function hexToRgba(hex, a) {
    var hh = String(hex).replace("#", "");
    if (hh.length !== 6) return "rgba(245,245,245," + a + ")";
    var r = parseInt(hh.slice(0,2), 16);
    var g = parseInt(hh.slice(2,4), 16);
    var b = parseInt(hh.slice(4,6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

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
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }

  function buildStars(){
    stars = [];
    var area = w*h;
    var base = low ? 120000 : 90000;
    var count = Math.round(area / base);
    count = clamp(count, low ? 35 : 50, low ? 90 : 130);

    for (var i=0; i<count; i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*(h*0.62),
        r: 0.5 + Math.random()*1.25,
        a: 0.04 + Math.random()*0.14,
        tw: Math.random()*6.28
      });
    }
  }

  function buildDust(){
    dust = [];
    var area = w*h;
    var base = low ? 80000 : 60000;
    var count = Math.round(area / base);
    count = clamp(count, low ? 18 : 28, low ? 60 : 90);

    for (var i=0; i<count; i++){
      dust.push({
        x: Math.random()*w,
        y: Math.random()*h,
        vy: (low ? 4 : 5) + Math.random() * (low ? 6 : 10),
        vx: (-1 + Math.random()*2) * (low ? 0.8 : 1.2),
        r: 0.4 + Math.random()*1.1,
        a: 0.015 + Math.random()*0.035,
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
      var tw = 0.65 + 0.35 * Math.sin(s*0.45 + st.tw);
      ctx.fillStyle = "rgba(245,245,245," + (st.a * tw) + ")";
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDust(dt, s){
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i=0; i<dust.length; i++){
      var d = dust[i];
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.y > h + 8) d.y = -8;
      if (d.x < -8) d.x = w + 8;
      if (d.x > w + 8) d.x = -8;

      var tw = 0.65 + 0.35 * Math.sin(s*0.35 + d.tw);
      ctx.fillStyle = "rgba(245,245,245," + (d.a * tw) + ")";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function curtainGradient(color, baseY, baseH, intensity){
    var g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0.00, hexToRgba(color, 0.00));
    g.addColorStop(clamp(baseY/h - 0.04, 0, 1), hexToRgba(color, 0.00));
    g.addColorStop(clamp((baseY + baseH*0.18)/h, 0, 1), hexToRgba(color, 0.28*intensity));
    g.addColorStop(clamp((baseY + baseH*0.62)/h, 0, 1), hexToRgba(color, 0.12*intensity));
    g.addColorStop(clamp((baseY + baseH)/h, 0, 1), hexToRgba(color, 0.00));
    return g;
  }

  function drawCurtainLayer(color, baseY, baseH, seed, s, intensity, opt){
    var px = (pointer.x - 0.5) * (opt.parX || 12);
    var py = (pointer.y - 0.5) * (opt.parY || 8);

    var freq = opt.freq || 0.012;
    var speed = opt.speed || 0.05;
    var speed2 = opt.speed2 || 0.038;
    var step = opt.step || 16;

    var g = curtainGradient(color, baseY, baseH, intensity);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    ctx.globalAlpha = (opt.alpha || 0.30) * intensity;
    ctx.lineWidth = opt.lineWidth || 12;

    if (hasFilter && opt.blur){
      ctx.filter = "blur(" + opt.blur + "px)";
    }

    ctx.beginPath();
    for (var x=-26; x<=w+26; x+=step){
      var n = fbm1(x*freq + s*speed, seed);
      var n2 = fbm1(x*freq*0.7 + s*speed2, seed+99);

      var top = baseY + (n - 0.5) * (h*0.07) + py;
      var bottom = top + baseH + (n2 - 0.5) * (h*0.10);

      top += Math.sin(s*0.16 + x*0.004) * (opt.wiggleTop || 4) + px*0.10;
      bottom += Math.cos(s*0.14 + x*0.003) * (opt.wiggleBot || 6) + px*0.08;

      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    ctx.stroke();
    ctx.restore();
  }

  function vignette(){
    var vg = ctx.createRadialGradient(w*0.52, h*0.44, 0, w*0.52, h*0.44, Math.max(w,h)*0.82);
    vg.addColorStop(0, "rgba(5,10,24,0)");
    vg.addColorStop(1, "rgba(5,10,24,0.86)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);
  }

  function render(now, dt){
    var s = (now - start) / 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    paintBase();
    drawStars(s);

    drawCurtainLayer(C_TEAL, h*0.02, h*0.80, 11, s*0.92, 1.0, {
      blur: low ? 10 : 16,
      lineWidth: low ? 14 : 18,
      step: low ? 22 : 18,
      alpha: low ? 0.22 : 0.26,
      parX: low ? 10 : 14,
      parY: low ? 7 : 9,
      speed: 0.035,
      speed2: 0.028,
      freq: 0.010
    });

    drawCurtainLayer(C_VIO, h*0.08, h*0.68, 29, s*1.05, 0.85, {
      blur: low ? 8 : 12,
      lineWidth: low ? 10 : 12,
      step: low ? 20 : 14,
      alpha: low ? 0.18 : 0.22,
      parX: low ? 12 : 18,
      parY: low ? 8 : 11,
      speed: 0.048,
      speed2: 0.040,
      freq: 0.012
    });

    drawCurtainLayer(C_MAG, h*0.14, h*0.58, 43, s*0.98, 0.70, {
      blur: low ? 8 : 11,
      lineWidth: low ? 9 : 11,
      step: low ? 20 : 14,
      alpha: low ? 0.14 : 0.18,
      parX: low ? 13 : 20,
      parY: low ? 9 : 12,
      speed: 0.045,
      speed2: 0.036,
      freq: 0.012
    });

    if (!low){
      drawCurtainLayer(C_TEAL, h*0.05, h*0.82, 71, s*1.10, 0.55, {
        blur: 0,
        lineWidth: 2,
        step: 8,
        alpha: 0.055,
        parX: 26,
        parY: 14,
        speed: 0.060,
        speed2: 0.045,
        freq: 0.020,
        wiggleTop: 2,
        wiggleBot: 3
      });
    }

    drawDust(dt, s);
    vignette();
  }

  function frame(now){
    if (!running) return;

    var minDt = 1000 / fps;
    if (last && (now - last) < minDt){
      requestAnimationFrame(frame);
      return;
    }

    var dt = last ? (now - last) : minDt;
    last = now;

    if (!low && dt > 85) slowScore++;
    else slowScore = Math.max(0, slowScore - 1);

    if (!low && slowScore > 25){
      perf.low = true;
      window.__STUDIO_PERF__ = perf;
      document.documentElement.classList.add("perf-low");
      low = true;
      slowScore = 0;
      resize();
    }

    render(now, dt / 1000);
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
}
