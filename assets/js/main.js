/* ===== Helpers ===== */
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return `rgba(245,245,245,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ===== Boot ===== */
window.addEventListener("load", () => {
  const y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  initSmoothScroll();
  initScrollSpyStable();     // FIXED: no more jumping
  initCardLight();
  initBlobBackground();
  initJellyfishRoam();       // desktop full-page, mobile hero-only
  initToolboardWires();      // tuned so wires don't wash text
  const drawerApi = initDrawerAutoPin(); // auto every 5s + click pin + dblclick repo
  initExhibitSheet(drawerApi);
  initGenerativeThumbs();
});

/* ===== Smooth scroll ===== */
function initSmoothScroll() {
  qsa("[data-scrollto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-scrollto");
      const el = target ? qs(target) : null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  qsa(".studio-dock a[href^='#']").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id ? qs(id) : null;
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", id);
    });
  });
}

/* ===== Scroll spy (stable, non-jumpy) ===== */
function initScrollSpyStable() {
  const navItems = qsa(".dock__item");
  const sections = qsa("[data-section]");
  if (!navItems.length || !sections.length) return;

  const header = qs(".top-strip");
  const headerH = () => (header?.getBoundingClientRect().height || 0);

  let currentId = null;
  let ticking = false;

  function setActive(id) {
    if (!id || id === currentId) return;
    currentId = id;
    navItems.forEach((a) => a.classList.toggle("is-active", a.getAttribute("data-nav") === id));
  }

  function compute() {
    ticking = false;

    const marker = headerH() + window.innerHeight * 0.30; // stable marker line
    let best = null;
    let bestDist = Infinity;

    for (const s of sections) {
      const r = s.getBoundingClientRect();

      // Prefer section that actually contains marker
      if (r.top <= marker && r.bottom >= marker) {
        best = s;
        break;
      }

      // Otherwise choose nearest top to marker
      const dist = Math.abs(r.top - marker);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }

    setActive(best?.id || sections[0].id);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(compute);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", compute, { passive: true });
  compute();
}

/* ===== Card “studio light” ===== */
function initCardLight() {
  qsa(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty("--mx", `${x}%`);
      card.style.setProperty("--my", `${y}%`);
    });
  });
}

/* ===== Ambient blob background ===== */
function initBlobBackground() {
  const canvas = qs("#bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const rootStyle = getComputedStyle(document.documentElement);
  const cCoral = rootStyle.getPropertyValue("--coral").trim() || "#FF6B6B";
  const cBlue  = rootStyle.getPropertyValue("--blue").trim()  || "#4D96FF";
  const cGreen = rootStyle.getPropertyValue("--green").trim() || "#6BCB77";

  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const palette = [
    { hex: cCoral, a: 0.11 },
    { hex: cBlue,  a: 0.10 },
    { hex: cGreen, a: 0.09 },
  ];

  const blobs = Array.from({ length: prefersReduced ? 4 : 6 }).map((_, i) => {
    const p = palette[i % palette.length];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.min(w, h) * (0.18 + Math.random() * 0.18)),
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      c: p.hex,
      a: p.a,
    };
  });

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(32, now - last);
    last = now;

    ctx.fillStyle = "rgba(10,10,10,0.22)";
    ctx.fillRect(0, 0, w, h);

    for (const b of blobs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.x += (w * 0.5 - b.x) * 0.00002 * dt;
      b.y += (h * 0.5 - b.y) * 0.00002 * dt;

      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r;
      if (b.y > h + b.r) b.y = -b.r;

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, hexToRgba(b.c, b.a));
      g.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    if (!prefersReduced) requestAnimationFrame(tick);
  }

  ctx.fillStyle = "rgba(10,10,10,1)";
  ctx.fillRect(0, 0, w, h);
  requestAnimationFrame(tick);
}

/* ===== Jellyfish roaming
   Desktop: entire viewport (fixed)
   Mobile: hero-only (absolute inside hero) ===== */
function initJellyfishRoam() {
  const jf = qs("#jellyfish");
  const hero = qs("#home");
  if (!jf || !hero) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  const mqMobile = window.matchMedia("(max-width: 768px)");

  let bounds = { w: window.innerWidth, h: window.innerHeight };
  let s = { w: 160, h: 160 };

  function size() {
    const r = jf.getBoundingClientRect();
    s = { w: r.width || 160, h: r.height || 160 };
  }

  // target-seeking drift state
  let x = 0, y = 0, vx = 0, vy = 0;
  let tx = 0, ty = 0;
  let nextTargetAt = 0;

  function mode() {
    return mqMobile.matches ? "hero" : "viewport";
  }

  function getArea() {
    if (mode() === "hero") {
      // confine to hero visible space on mobile
      const w = Math.min(hero.clientWidth || window.innerWidth, window.innerWidth);
      const h = Math.min(hero.clientHeight || window.innerHeight, window.innerHeight);
      return { w, h, pad: 10 };
    }
    // desktop: whole viewport
    return { w: window.innerWidth, h: window.innerHeight, pad: 10 };
  }

  function clampX(nx, area) {
    const maxX = area.w - s.w - area.pad;
    return clamp(nx, area.pad, Math.max(area.pad, maxX));
  }
  function clampY(ny, area) {
    const maxY = area.h - s.h - area.pad;
    return clamp(ny, area.pad, Math.max(area.pad, maxY));
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function pickTarget(now) {
    const area = getArea();
    tx = rand(area.pad, Math.max(area.pad, area.w - s.w - area.pad));
    ty = rand(area.pad, Math.max(area.pad, area.h - s.h - area.pad));
    nextTargetAt = now + 2600 + Math.random() * 3200;
  }

  function reset() {
    size();
    const area = getArea();
    x = clampX(rand(area.pad, area.w - s.w - area.pad), area);
    y = clampY(rand(area.pad, area.h - s.h - area.pad), area);
    vx = 0; vy = 0;
    pickTarget(performance.now());
  }

  function onResize() {
    bounds.w = window.innerWidth;
    bounds.h = window.innerHeight;
    size();
  }

  window.addEventListener("resize", onResize, { passive: true });
  mqMobile.addEventListener?.("change", reset);

  reset();

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(34, now - last);
    last = now;

    if (now >= nextTargetAt) pickTarget(now);

    const area = getArea();

    // floaty accel towards target
    const ax = (tx - x) * 0.00035;
    const ay = (ty - y) * 0.00035;

    vx = (vx + ax * dt) * 0.985;
    vy = (vy + ay * dt) * 0.985;

    // organic noise
    vx += (Math.random() - 0.5) * 0.0020 * dt;
    vy += (Math.random() - 0.5) * 0.0020 * dt;

    x += vx * dt;
    y += vy * dt;

    const x2 = clampX(x, area);
    const y2 = clampY(y, area);
    if (x2 !== x) vx *= -0.55;
    if (y2 !== y) vy *= -0.55;
    x = x2; y = y2;

    const angle = Math.atan2(vy, vx) * 180 / Math.PI;
    const breathe = 1 + Math.sin(now * 0.0011) * 0.03;

    jf.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle * 0.10}deg) scale(${breathe})`;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ===== Toolboard wires (behind cards; tuned so it doesn't wash text) ===== */
function initToolboardWires() {
  const box = qs("#toolboardBox");
  const svg = qs("#toolboardWires");
  if (!box || !svg) return;

  const nodes = qsa(".toolnode", box);
  if (!nodes.length) return;

  const pairs = [
    ["backend", "genai"],
    ["backend", "data"],
    ["data", "cloud"],
    ["cloud", "genai"],
    ["genai", "core"],
  ];

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    return { x: (r.left - br.left) + r.width / 2, y: (r.top - br.top) + r.height / 2 };
  }
  function findNode(name) { return nodes.find(n => n.getAttribute("data-node") === name); }

  function draw() {
    const br = box.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${br.width} ${br.height}`);
    svg.setAttribute("width", `${br.width}`);
    svg.setAttribute("height", `${br.height}`);
    svg.innerHTML = "";

    for (const [a, b] of pairs) {
      const na = findNode(a);
      const nb = findNode(b);
      if (!na || !nb) continue;

      const A = centerOf(na);
      const B = centerOf(nb);

      const midX = (A.x + B.x) / 2;
      const midY = (A.y + B.y) / 2;
      const bend = 24;

      const cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      const cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      // glow (subtle)
      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "rgba(77,150,255,0.08)");
      glow.setAttribute("stroke-width", "4");
      glow.setAttribute("opacity", "0.7");
      glow.setAttribute("stroke-linecap", "round");
      svg.appendChild(glow);

      // dashed wire
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(245,245,245,0.11)");
      path.setAttribute("stroke-width", "1.2");
      path.setAttribute("stroke-dasharray", "3 11");
      path.setAttribute("opacity", "0.95");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);

      // endpoints
      for (const P of [A, B]) {
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", `${P.x}`);
        ring.setAttribute("cy", `${P.y}`);
        ring.setAttribute("r", "4.2");
        ring.setAttribute("fill", "rgba(77,150,255,0.10)");
        svg.appendChild(ring);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", `${P.x}`);
        dot.setAttribute("cy", `${P.y}`);
        dot.setAttribute("r", "2.2");
        dot.setAttribute("fill", "rgba(245,245,245,0.24)");
        svg.appendChild(dot);
      }
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(box);
  window.addEventListener("resize", draw, { passive: true });
  draw();
}

/* ===== Drawer: auto-advance every 5s, click pins, dblclick opens repo ===== */
function initDrawerAutoPin() {
  const drawer = qs("#drawer");
  const meta = qs("#drawerMeta");
  if (!drawer || !meta) return null;

  const frames = qsa(".frame", drawer);
  const n = frames.length || 1;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  let pinned = false;
  let pinnedIndex = 0;
  let timer = null;

  function nearestIndex() {
    const dr = drawer.getBoundingClientRect();
    let best = { idx: 0, dist: Infinity };
    frames.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const center = r.left + r.width / 2;
      const target = dr.left + dr.width / 2;
      const dist = Math.abs(center - target);
      if (dist < best.dist) best = { idx: i, dist };
    });
    return best.idx;
  }

  function setPinnedUI(idx) {
    frames.forEach((f, i) => f.classList.toggle("is-pinned", i === idx));
  }

  function goTo(idx, behavior = "smooth") {
    const el = frames[idx];
    if (!el) return;
    el.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }

  function updateMeta() {
    if (pinned) {
      meta.textContent = `PINNED • PIECE ${String(pinnedIndex + 1).padStart(2,"0")} OF ${String(n).padStart(2,"0")} • DOUBLE‑CLICK FOR REPO`;
    } else {
      const i = nearestIndex();
      meta.textContent = `AUTO • PIECE ${String(i + 1).padStart(2,"0")} OF ${String(n).padStart(2,"0")} • MOVES EVERY 5s • CLICK TO PIN • DOUBLE‑CLICK FOR REPO`;
    }
  }

  function startAuto() {
    if (prefersReduced) return;
    if (timer || pinned) return;
    timer = window.setInterval(() => {
      if (pinned) return;
      const i = nearestIndex();
      const next = (i + 1) % n;
      goTo(next, "smooth");
    }, 5000);
  }

  function stopAuto() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  function pinTo(idx) {
    pinned = true;
    pinnedIndex = idx;
    stopAuto();
    setPinnedUI(idx);
    goTo(idx, "smooth");
    updateMeta();
  }

  function unpin() {
    pinned = false;
    frames.forEach(f => f.classList.remove("is-pinned"));
    updateMeta();
    startAuto();
  }

  // click to pin + center
  frames.forEach((frame, idx) => {
    frame.addEventListener("click", (e) => {
      // ignore clicks on "Open exhibit" button so it doesn't pin if you don't want
      if (e.target.closest("button, a")) return;
      pinTo(idx);
    });

    frame.addEventListener("dblclick", () => {
      const repo = frame.getAttribute("data-repo");
      if (repo) window.open(repo, "_blank", "noopener");
    });
  });

  // arrow buttons still work; they also keep auto unless pinned
  qsa("[data-drawer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-drawer");
      const i = pinned ? pinnedIndex : nearestIndex();
      const next = dir === "next" ? (i + 1) % n : (i - 1 + n) % n;
      goTo(next, "smooth");
      if (pinned) {
        pinnedIndex = next;
        setPinnedUI(next);
      }
      updateMeta();
    });
  });

  // keyboard
  drawer.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();

    const i = pinned ? pinnedIndex : nearestIndex();
    const next = e.key === "ArrowRight" ? (i + 1) % n : (i - 1 + n) % n;
    goTo(next, "smooth");

    if (pinned) {
      pinnedIndex = next;
      setPinnedUI(next);
    }
    updateMeta();
  });

  // update meta on scroll
  let raf = null;
  drawer.addEventListener("scroll", () => {
    if (pinned) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateMeta);
  }, { passive: true });

  // optional: any interaction pauses auto a bit, but still continues unless pinned
  drawer.addEventListener("pointerdown", () => { if (!pinned) stopAuto(); }, { passive:true });
  drawer.addEventListener("pointerup", () => { if (!pinned) startAuto(); }, { passive:true });

  // Start
  updateMeta();
  startAuto();

  return {
    pause: stopAuto,
    resume: () => { if (!pinned) startAuto(); },
    isPinned: () => pinned,
    unpin
  };
}

/* ===== Exhibit sheet ===== */
function initExhibitSheet(drawerApi) {
  const sheet = qs("#sheet");
  const overlay = qs(".sheet__overlay", sheet || undefined);
  const closeBtns = qsa("[data-sheet='close']", sheet || undefined);

  const titleEl = qs("#sheetTitle");
  const descEl = qs("#sheetDesc");
  const tagsEl = qs("#sheetTags");
  const kindEl = qs("#sheetKind");
  const repoEl = qs("#sheetRepo");
  const canvas = qs("#sheetCanvas");

  if (!sheet || !overlay || !titleEl || !descEl || !tagsEl || !kindEl || !repoEl || !canvas) return;

  function openFromFrame(frame) {
    drawerApi?.pause?.();

    const title = frame.getAttribute("data-title") || "Project";
    const kind = frame.getAttribute("data-kind") || "Project";
    const desc = frame.getAttribute("data-desc") || "";
    const tags = (frame.getAttribute("data-tags") || "").split(",").map(s => s.trim()).filter(Boolean);
    const repo = frame.getAttribute("data-repo") || "#";
    const accent = frame.getAttribute("data-accent") || "blue";

    titleEl.textContent = title;
    descEl.textContent = desc;
    kindEl.textContent = kind.toUpperCase();
    repoEl.href = repo;

    tagsEl.innerHTML = "";
    tags.forEach(t => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      tagsEl.appendChild(span);
    });

    drawGenerativeArt(canvas, `${title}::sheet`, accent);

    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    drawerApi?.resume?.();
  }

  // Only open via "Open exhibit" button (so single click can pin)
  qsa(".frame").forEach((frame) => {
    qs("[data-open]", frame)?.addEventListener("click", (e) => {
      e.stopPropagation();
      openFromFrame(frame);
    });
  });

  overlay.addEventListener("click", close);
  closeBtns.forEach((b) => b.addEventListener("click", close));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("is-open")) close();
  });

  qsa("[data-sheet='close']").forEach((el) => {
    if (el.tagName.toLowerCase() === "a") el.addEventListener("click", close);
  });
}

/* ===== Generative thumbnails ===== */
function initGenerativeThumbs() {
  const thumbs = qsa("canvas.thumb");
  if (!thumbs.length) return;

  const ro = new ResizeObserver(() => {
    thumbs.forEach((c) => {
      const seed = c.getAttribute("data-seed") || "thumb";
      const accent = c.closest(".frame")?.getAttribute("data-accent") || "blue";
      drawGenerativeArt(c, seed, accent);
    });
  });

  thumbs.forEach((c) => ro.observe(c));

  thumbs.forEach((c) => {
    const seed = c.getAttribute("data-seed") || "thumb";
    const accent = c.closest(".frame")?.getAttribute("data-accent") || "blue";
    drawGenerativeArt(c, seed, accent);
  });
}

/* ===== Seeded PRNG ===== */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getAccentColor(accent) {
  const cs = getComputedStyle(document.documentElement);
  if (accent === "coral") return cs.getPropertyValue("--coral").trim() || "#FF6B6B";
  if (accent === "green") return cs.getPropertyValue("--green").trim() || "#6BCB77";
  return cs.getPropertyValue("--blue").trim() || "#4D96FF";
}

/* ===== Generative art drawing ===== */
function drawGenerativeArt(canvas, seed, accentName) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, canvas.clientWidth || 640);
  const h = Math.max(1, canvas.clientHeight || 360);

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const r = mulberry32(hashString(seed));
  const accent = getAccentColor(accentName);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(10,10,10,0.92)";
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(245,245,245,0.06)");
  g.addColorStop(1, "rgba(245,245,245,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const y = (i / 9) * h;
    ctx.strokeStyle = `rgba(245,245,245,${0.03 + r() * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const arcs = 10 + Math.floor(r() * 10);
  for (let i = 0; i < arcs; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const rad = (0.08 + r() * 0.45) * Math.min(w, h);
    const start = r() * Math.PI * 2;
    const end = start + (0.4 + r() * 1.6);

    ctx.strokeStyle = i % 2 === 0
      ? hexToRgba(accent, 0.18 + r() * 0.12)
      : `rgba(245,245,245,${0.06 + r() * 0.09})`;

    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, start, end);
    ctx.stroke();
  }

  const nodes = 24 + Math.floor(r() * 22);
  for (let i = 0; i < nodes; i++) {
    const x = r() * w;
    const y = r() * h;
    const rr = 1.5 + r() * 3.8;

    ctx.fillStyle = i % 5 === 0
      ? hexToRgba(accent, 0.55)
      : `rgba(245,245,245,${0.10 + r() * 0.20})`;

    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();

    if (i % 6 === 0) {
      const x2 = clamp(x + (r() - 0.5) * w * 0.35, 0, w);
      const y2 = clamp(y + (r() - 0.5) * h * 0.35, 0, h);
      ctx.strokeStyle = `rgba(245,245,245,${0.05 + r() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  vg.addColorStop(0, "rgba(10,10,10,0)");
  vg.addColorStop(1, "rgba(10,10,10,0.78)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
