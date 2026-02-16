/* ===== Helpers ===== */
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* ===== Boot ===== */
window.addEventListener("load", () => {
  // Footer year
  const y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  initSmoothScroll();
  initScrollSpy();
  initCardLight();
  initBlobBackground();
  initJellyfishRoam();
  initToolboardWires();
  initDrawer();
  initExhibitSheet();
  initGenerativeThumbs();
});

/* ===== Smooth scroll ===== */
function initSmoothScroll() {
  // data-scrollto buttons
  qsa("[data-scrollto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-scrollto");
      const el = target ? qs(target) : null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // dock anchor links
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

/* ===== Scroll spy (dock highlight) ===== */
function initScrollSpy() {
  const navItems = qsa(".dock__item");
  const sections = qsa("[data-section]");

  const byId = new Map(navItems.map((a) => [a.getAttribute("data-nav"), a]));

  const obs = new IntersectionObserver((entries) => {
    // pick the most visible section
    let best = null;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
    }
    if (!best) return;

    const id = best.target.id;
    navItems.forEach((a) => a.classList.toggle("is-active", a.getAttribute("data-nav") === id));
  }, { threshold: [0.18, 0.28, 0.38, 0.48, 0.58, 0.68] });

  sections.forEach((s) => obs.observe(s));
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

/* ===== Ambient blob background canvas ===== */
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

    // Base clear (soft, keeps texture)
    ctx.fillStyle = "rgba(10,10,10,0.22)";
    ctx.fillRect(0, 0, w, h);

    for (const b of blobs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // slow drift back towards center so they don't bunch up
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

  // First paint
  ctx.fillStyle = "rgba(10,10,10,1)";
  ctx.fillRect(0, 0, w, h);
  requestAnimationFrame(tick);
}

function hexToRgba(hex, a) {
  // expects #RRGGBB
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(245,245,245,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ===== Jellyfish roaming ===== */
function initJellyfishRoam() {
  const jf = qs("#jellyfish");
  if (!jf) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  let bounds = { w: window.innerWidth, h: window.innerHeight };
  const size = () => {
    const r = jf.getBoundingClientRect();
    return { w: r.width || 160, h: r.height || 160 };
  };

  let s = size();

  let x = Math.random() * (bounds.w - s.w);
  let y = Math.random() * (bounds.h - s.h);
  let vx = (Math.random() < 0.5 ? -1 : 1) * (0.20 + Math.random() * 0.25);
  let vy = (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.22);

  // gentle heading changes
  let turn = 0;

  function onResize() {
    bounds.w = window.innerWidth;
    bounds.h = window.innerHeight;
    s = size();
    x = clamp(x, 10, Math.max(10, bounds.w - s.w - 10));
    y = clamp(y, 10, Math.max(10, bounds.h - s.h - 10));
  }
  window.addEventListener("resize", onResize, { passive: true });

  let last = performance.now();

  function tick(now) {
    const dt = Math.min(28, now - last);
    last = now;

    // random-ish turn (low frequency)
    turn += (Math.random() - 0.5) * 0.004 * dt;
    turn = clamp(turn, -0.035, 0.035);

    // apply turn by slightly rotating velocity vector
    const cs = Math.cos(turn);
    const sn = Math.sin(turn);
    const nvx = vx * cs - vy * sn;
    const nvy = vx * sn + vy * cs;
    vx = nvx;
    vy = nvy;

    // drift
    x += vx * dt;
    y += vy * dt;

    // soft boundaries + bounce
    const pad = 12;
    const maxX = bounds.w - s.w - pad;
    const maxY = bounds.h - s.h - pad;

    if (x < pad) { x = pad; vx *= -1; turn *= -0.6; }
    if (x > maxX) { x = maxX; vx *= -1; turn *= -0.6; }
    if (y < pad) { y = pad; vy *= -1; turn *= -0.6; }
    if (y > maxY) { y = maxY; vy *= -1; turn *= -0.6; }

    // angle based on direction
    const angle = Math.atan2(vy, vx) * 180 / Math.PI;

    // slight scale breathing (separate from CSS pulse)
    const breathe = 1 + Math.sin(now * 0.0012) * 0.03;

    jf.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle * 0.12}deg) scale(${breathe})`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ===== Toolboard wires (dynamic SVG linking nodes) ===== */
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
    ["backend", "core"],
  ];

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    return {
      x: (r.left - br.left) + r.width / 2,
      y: (r.top - br.top) + r.height / 2
    };
  }

  function findNode(name) {
    return nodes.find(n => n.getAttribute("data-node") === name);
  }

  function draw() {
    const br = box.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${br.width} ${br.height}`);
    svg.setAttribute("width", `${br.width}`);
    svg.setAttribute("height", `${br.height}`);
    svg.innerHTML = "";

    // subtle wiring style
    for (const [a, b] of pairs) {
      const na = findNode(a);
      const nb = findNode(b);
      if (!na || !nb) continue;

      const A = centerOf(na);
      const B = centerOf(nb);

      // slight curve for “generative” feel
      const midX = (A.x + B.x) / 2;
      const midY = (A.y + B.y) / 2;
      const bend = 28;
      const cx = midX + (Math.sin((A.x + B.x) * 0.01) * bend);
      const cy = midY + (Math.cos((A.y + B.y) * 0.01) * bend);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(245,245,245,0.14)");
      path.setAttribute("stroke-width", "1.25");
      path.setAttribute("stroke-dasharray", "4 10");
      path.setAttribute("opacity", "0.8");
      svg.appendChild(path);

      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", "rgba(77,150,255,0.10)");
      glow.setAttribute("stroke-width", "6");
      glow.setAttribute("opacity", "0.55");
      svg.appendChild(glow);
    }

    // faint points at node centers
    for (const n of nodes) {
      const c = centerOf(n);
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", `${c.x}`);
      dot.setAttribute("cy", `${c.y}`);
      dot.setAttribute("r", "2.6");
      dot.setAttribute("fill", "rgba(245,245,245,0.22)");
      svg.appendChild(dot);
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(box);
  window.addEventListener("resize", draw, { passive: true });
  draw();
}

/* ===== Drawer controls + meta ===== */
function initDrawer() {
  const drawer = qs("#drawer");
  const meta = qs("#drawerMeta");
  if (!drawer || !meta) return;

  const frames = qsa(".frame", drawer);
  const n = frames.length || 1;

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

  function updateMeta() {
    const i = nearestIndex();
    meta.textContent = `PIECE ${String(i + 1).padStart(2, "0")} OF ${String(n).padStart(2, "0")} • SCROLL / DRAG • TAP TO OPEN`;
  }

  let raf = null;
  drawer.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateMeta);
  }, { passive: true });

  // buttons
  qsa("[data-drawer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-drawer");
      const i = nearestIndex();
      const next = dir === "next" ? Math.min(n - 1, i + 1) : Math.max(0, i - 1);
      frames[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  });

  // keyboard (when drawer focused)
  drawer.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = nearestIndex();
    const next = e.key === "ArrowRight" ? Math.min(n - 1, i + 1) : Math.max(0, i - 1);
    frames[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });

  updateMeta();
}

/* ===== Exhibit sheet open/close ===== */
function initExhibitSheet() {
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

    // draw larger generative art in sheet
    drawGenerativeArt(canvas, `${title}::sheet`, accent);

    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // open handlers
  qsa(".frame").forEach((frame) => {
    // open exhibit button
    qs("[data-open]", frame)?.addEventListener("click", () => openFromFrame(frame));

    // repo button
    qs("[data-repo]", frame)?.addEventListener("click", () => {
      const repo = frame.getAttribute("data-repo");
      if (repo) window.open(repo, "_blank", "noopener");
    });

    // click on matte opens
    qs(".frame__matte", frame)?.addEventListener("click", () => openFromFrame(frame));
  });

  overlay.addEventListener("click", close);
  closeBtns.forEach((b) => b.addEventListener("click", close));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("is-open")) close();
  });

  // close from internal links
  qsa("[data-sheet='close']").forEach((el) => {
    if (el.tagName.toLowerCase() === "a") el.addEventListener("click", close);
  });
}

/* ===== Generative thumbnails for gallery cards ===== */
function initGenerativeThumbs() {
  const thumbs = qsa("canvas.thumb");
  if (!thumbs.length) return;

  const ro = new ResizeObserver(() => {
    thumbs.forEach((c) => {
      const seed = c.getAttribute("data-seed") || "thumb";
      // accent from parent card
      const accent = c.closest(".frame")?.getAttribute("data-accent") || "blue";
      drawGenerativeArt(c, seed, accent);
    });
  });

  thumbs.forEach((c) => ro.observe(c));

  // first draw
  thumbs.forEach((c) => {
    const seed = c.getAttribute("data-seed") || "thumb";
    const accent = c.closest(".frame")?.getAttribute("data-accent") || "blue";
    drawGenerativeArt(c, seed, accent);
  });
}

/* ===== Seeded PRNG ===== */
function hashString(str) {
  // FNV-1a
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

/* ===== Generative art drawing (for thumbs + sheet) ===== */
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

  // base
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(10,10,10,0.92)";
  ctx.fillRect(0, 0, w, h);

  // faint gradient wash
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(245,245,245,0.06)");
  g.addColorStop(1, "rgba(245,245,245,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // field lines
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

  // constellation arcs
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

  // orbiting nodes
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

    // occasional connecting line
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

  // vignette
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
  vg.addColorStop(0, "rgba(10,10,10,0)");
  vg.addColorStop(1, "rgba(10,10,10,0.78)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/* (sheet canvas uses same helper; keep hexToRgba from earlier) */
function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(245,245,245,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
