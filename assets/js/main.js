(() => {
  // =========================
  // Utilities
  // =========================
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const parseDelayMs = (s) => {
    if (!s) return 0;
    const v = parseFloat(s);
    if (Number.isNaN(v)) return 0;
    if (s.includes("ms")) return v;
    if (s.includes("s")) return v * 1000;
    return v;
  };

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Header height -> CSS var
  const headerEl = document.querySelector("header");
  const setHeaderHeight = () => {
    const hh = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--header-h", `${hh}px`);
  };
  setHeaderHeight();
  window.addEventListener("resize", setHeaderHeight, { passive: true });

  // Reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // =========================
  // Mobile menu
  // =========================
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (btn && menu) {
    const closeMenu = () => {
      menu.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
      setHeaderHeight();
    };

    btn.addEventListener("click", () => {
      const isHidden = menu.classList.contains("hidden");
      if (isHidden) {
        menu.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        closeMenu();
      }
      setHeaderHeight();
    });

    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  }

  // =========================
  // Scroll progress
  // =========================
  const progressBar = document.getElementById("scroll-progress-bar");
  if (progressBar) {
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = clamp(scrollTop / max, 0, 1);
      progressBar.style.transform = `scaleX(${p})`;
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => update(), { passive: true });
    update();
  }

  // =========================
  // Scroll reveal + glint + chip cascade
  // =========================
  const revealTargets = Array.from(document.querySelectorAll("main .os-header, main .glass"));

  if (revealTargets.length) {
    if (prefersReducedMotion) {
      revealTargets.forEach((el) => el.classList.add("reveal", "is-visible"));
    } else {
      revealTargets.forEach((el, i) => {
        el.classList.add("reveal");
        el.style.transitionDelay = `${Math.min(180, (i % 8) * 22)}ms`;
      });

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;

            const el = e.target;
            const baseDelay = parseDelayMs(el.style.transitionDelay);

            if (el.classList.contains("skill-card")) {
              const pills = Array.from(el.querySelectorAll(".pill"));
              pills.forEach((pill, idx) => {
                pill.style.transitionDelay = `${baseDelay + 120 + idx * 45}ms`;
              });
            }

            el.classList.add("is-visible");

            if (el.classList.contains("glass")) {
              window.setTimeout(() => el.classList.add("glint"), baseDelay + 160);
            }

            io.unobserve(el);
          }
        },
        { threshold: 0.14, rootMargin: "0px 0px -12% 0px" }
      );

      revealTargets.forEach((el) => io.observe(el));
    }
  }

  // =========================
  // Projects drawer (pin = click, open repo = double click)
  // =========================
  const projectsSection = document.getElementById("projects");
  const track = document.getElementById("projects-track");
  const prev = document.getElementById("projects-prev");
  const next = document.getElementById("projects-next");
  const dotsEl = document.getElementById("projects-dots");
  const currentEl = document.getElementById("projects-current");
  const totalEl = document.getElementById("projects-total");

  const AUTO_SCROLL_MS = 10_000;
  const RESUME_AFTER_MS = 2200;

  let autoTimer = null;
  let resumeTimer = null;
  let projectsInView = false;

  let manualLock = false;
  let selectedIndex = 0;
  let lastDragTime = 0;

  let startAuto = () => {};
  let stopAuto = () => {};

  if (track && projectsSection) {
    const getCards = () => Array.from(track.querySelectorAll(".project-card"));

    const normIndex = (idx) => {
      const cards = getCards();
      if (cards.length === 0) return 0;
      return ((idx % cards.length) + cards.length) % cards.length;
    };

    const getTrackPadLeft = () => {
      const s = getComputedStyle(track);
      return parseFloat(s.paddingLeft || "0") || 0;
    };

    const scrollToCard = (idx, smooth) => {
      const cards = getCards();
      if (cards.length === 0) return;

      const i = normIndex(idx);
      const padLeft = getTrackPadLeft();
      const left = Math.max(0, cards[i].offsetLeft - padLeft);
      track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    };

    const getScrollActiveIndex = () => {
      const cards = getCards();
      if (cards.length === 0) return 0;

      const center = track.scrollLeft + track.clientWidth * 0.5;
      let best = 0;
      let bestD = Infinity;

      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const cx = c.offsetLeft + c.offsetWidth * 0.5;
        const d = Math.abs(cx - center);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    const getActiveIndex = () => (manualLock ? normIndex(selectedIndex) : getScrollActiveIndex());

    const updateProjectsUI = () => {
      const cards = getCards();
      if (cards.length === 0) return;

      const idx = getActiveIndex();

      cards.forEach((c, i) => {
        c.classList.toggle("is-active", i === idx);
        c.classList.toggle("is-dim", i !== idx);
      });

      const dots = Array.from(dotsEl?.querySelectorAll(".dot") || []);
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));

      if (currentEl) currentEl.textContent = String(idx + 1).padStart(2, "0");
      if (totalEl) totalEl.textContent = String(cards.length).padStart(2, "0");
    };

    const pauseAutoInternal = () => {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
      clearTimeout(resumeTimer);
    };

    stopAuto = () => pauseAutoInternal();

    startAuto = () => {
      if (!track) return;
      if (!projectsInView) return;
      if (document.hidden) return;
      if (manualLock) return;
      if (autoTimer) return;

      autoTimer = setInterval(() => {
        if (manualLock) return;
        scrollToCard(getScrollActiveIndex() + 1, true);
        updateProjectsUI();
      }, AUTO_SCROLL_MS);
    };

    const scheduleResume = () => {
      if (manualLock) return;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => startAuto(), RESUME_AFTER_MS);
    };

    const lockToIndex = (idx, smooth = true) => {
      manualLock = true;
      selectedIndex = normIndex(idx);
      pauseAutoInternal();
      scrollToCard(selectedIndex, smooth);
      updateProjectsUI();
    };

    const unlockSelection = () => {
      if (!manualLock) return;
      manualLock = false;
      updateProjectsUI();
      startAuto();
    };

    const openRepoForCard = (cardEl) => {
      const url = cardEl?.dataset?.repo;
      if (!url) return;
      window.open(url, "_blank", "noopener");
    };

    const cards = getCards();
    if (totalEl) totalEl.textContent = String(cards.length).padStart(2, "0");

    if (dotsEl) {
      dotsEl.innerHTML = "";
      cards.forEach((_, i) => {
        const b = document.createElement("button");
        b.className = "dot";
        b.type = "button";
        b.setAttribute("aria-label", `Go to piece ${i + 1}`);
        b.addEventListener("click", () => lockToIndex(i, true));
        dotsEl.appendChild(b);
      });
    }

    prev?.addEventListener("click", () => lockToIndex(getActiveIndex() - 1, true));
    next?.addEventListener("click", () => lockToIndex(getActiveIndex() + 1, true));

    cards.forEach((card, i) => {
      card.addEventListener("click", () => {
        if (performance.now() - lastDragTime < 240) return;
        lockToIndex(i, true);
      });

      card.addEventListener("dblclick", () => {
        if (performance.now() - lastDragTime < 240) return;
        openRepoForCard(card);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openRepoForCard(card);
        }
      });
    });

    let pointerActive = false;
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let pid = null;
    const DRAG_THRESHOLD = 7;

    track.classList.add("grab");

    const endPointer = () => {
      if (!pointerActive) return;
      pointerActive = false;

      if (dragging) {
        dragging = false;
        track.classList.remove("grabbing");
        lastDragTime = performance.now();
        updateProjectsUI();
        scheduleResume();
      }
      pid = null;
    };

    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerActive = true;
      dragging = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      pid = e.pointerId;
    });

    track.addEventListener("pointermove", (e) => {
      if (!pointerActive) return;
      const dx = e.clientX - startX;

      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        dragging = true;
        pauseAutoInternal();
        try {
          track.setPointerCapture(pid);
        } catch (_) {}
        track.classList.add("grabbing");
      }

      track.scrollLeft = startLeft - dx;
    });

    track.addEventListener("pointerup", endPointer);
    track.addEventListener("pointercancel", endPointer);
    track.addEventListener("lostpointercapture", endPointer);

    let scrollRAF = 0;
    track.addEventListener(
      "scroll",
      () => {
        if (scrollRAF) cancelAnimationFrame(scrollRAF);
        scrollRAF = requestAnimationFrame(() => updateProjectsUI());
      },
      { passive: true }
    );

    window.addEventListener("resize", () => updateProjectsUI(), { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        projectsInView = !!entry?.isIntersecting && entry.intersectionRatio >= 0.25;
        if (projectsInView) startAuto();
        else stopAuto();
      },
      { threshold: [0, 0.25, 0.6, 1] }
    );
    io.observe(projectsSection);

    document.addEventListener("pointerdown", (e) => {
      if (!manualLock) return;

      const insideCard = e.target.closest(".project-card");
      if (insideCard) return;

      const insideControl = e.target.closest(".drawer-btn") || e.target.closest(".dot");
      if (insideControl) return;

      const insideProjects = e.target.closest("#projects");
      if (!insideProjects) {
        unlockSelection();
        return;
      }

      unlockSelection();
    });

    updateProjectsUI();
  }

  // =========================
  // Background animation (2D blobs)
  // =========================
  const canvas = document.getElementById("art-bg");
  function initBlobBackground() {
    if (!canvas) return null;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    let rafId = null;
    let running = false;

    let w = 0;
    let h = 0;
    let dpr = 1;

    // Keep this *very* subtle so content stays art-first.
    const palette = [
      { rgb: [255, 107, 107], a: 0.09 }, // coral
      { rgb: [77, 150, 255], a: 0.09 }, // blue
      { rgb: [107, 203, 119], a: 0.085 }, // green
    ];

    let blobs = [];

    let pointer = { x: 0.5, y: 0.35, has: false };
    const onPointer = (e) => {
      pointer.x = clamp(e.clientX / Math.max(1, window.innerWidth), 0, 1);
      pointer.y = clamp(e.clientY / Math.max(1, window.innerHeight), 0, 1);
      pointer.has = true;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    function makeBlob(i) {
      const p = palette[i % palette.length];
      const minR = Math.min(w, h) * 0.18;
      const maxR = Math.min(w, h) * 0.36;

      return {
        x: rand(0, w),
        y: rand(0, h),
        r: rand(minR, maxR),
        vx: rand(-10, 10),
        vy: rand(-8, 8),
        rgb: p.rgb,
        a: p.a,
        phase: rand(0, Math.PI * 2),
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const blobCount = clamp(Math.round((w * h) / 180000), 5, 8);
      blobs = Array.from({ length: blobCount }, (_, i) => makeBlob(i));
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();

    let last = performance.now();

    function draw(now) {
      if (!running) return;

      const dt = clamp((now - last) / 1000, 0.01, 0.05);
      last = now;

      ctx.clearRect(0, 0, w, h);

      // very subtle, additive blobs
      ctx.globalCompositeOperation = "lighter";

      for (const b of blobs) {
        // drift
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // soft steering towards pointer (very mild)
        if (pointer.has) {
          const tx = pointer.x * w;
          const ty = pointer.y * h;
          b.vx += (tx - b.x) * 0.0002;
          b.vy += (ty - b.y) * 0.0002;
        }

        // clamp velocity
        b.vx = clamp(b.vx, -18, 18);
        b.vy = clamp(b.vy, -16, 16);

        // bounce
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;

        // gentle breathing
        b.phase += dt * 0.6;
        const rr = b.r * (0.92 + 0.08 * Math.sin(b.phase));

        const [R, G, B] = b.rgb;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
        g.addColorStop(0, `rgba(${R},${G},${B},${b.a})`);
        g.addColorStop(1, `rgba(${R},${G},${B},0)`);

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";

      rafId = requestAnimationFrame(draw);
    }

    return {
      start() {
        if (prefersReducedMotion) return;
        if (running) return;
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(draw);
      },
      stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      },
      renderOnce() {
        // for reduced motion: paint a single frame
        running = false;
        last = performance.now();
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        for (const b of blobs) {
          const [R, G, B] = b.rgb;
          const rr = b.r * 0.98;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
          g.addColorStop(0, `rgba(${R},${G},${B},${b.a})`);
          g.addColorStop(1, `rgba(${R},${G},${B},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      },
    };
  }

  const bg = initBlobBackground();
  if (bg) {
    if (prefersReducedMotion) bg.renderOnce();
    else if (!document.hidden) bg.start();
  }

  // =========================
  // Jellyfish movement:
  // - Desktop: roam around viewport
  // - Mobile: roam around the name inside hero
  // =========================
  function initJellyfish() {
    const el = document.getElementById("jellyfish");
    if (!el) return null;

    const hero = document.getElementById("intro");
    const name = document.getElementById("name-title");

    let rafId = null;
    let running = false;

    let x = 0,
      y = 0;
    let vx = 0,
      vy = 0;
    let targetX = 0,
      targetY = 0;

    let last = performance.now();
    let cruise = rand(18, 34);

    let nextTargetAt = 0;
    let nextBoostAt = performance.now() + rand(12000, 22000);
    let boostUntil = 0;

    let size = { w: 132, h: 176 };

    const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

    const measure = () => {
      const r = el.getBoundingClientRect();
      size = { w: r.width || 132, h: r.height || 176 };
    };

    const boundsDesktop = () => {
      const ww = window.innerWidth;
      const hh = window.innerHeight;
      const M = Math.max(10, Math.min(28, Math.round(Math.min(ww, hh) * 0.02)));

      return {
        minX: M,
        maxX: Math.max(M, ww - size.w - M),
        minY: M + 6,
        maxY: Math.max(M, hh - size.h - M),
      };
    };

    const boundsMobile = () => {
      const hr = hero?.getBoundingClientRect();
      const nr = name?.getBoundingClientRect();
      if (!hr || !nr) return boundsDesktop();

      const heroW = hr.width;
      const heroH = hr.height;

      const nx = nr.left - hr.left;
      const ny = nr.top - hr.top;
      const nw = nr.width;
      const nh = nr.height;

      const padX = Math.max(26, Math.min(48, heroW * 0.08));
      const padTop = 18;
      const padBottom = 86;

      const minX = clamp(nx - padX, 8, heroW - size.w - 8);
      const maxX = clamp(nx + nw + padX - size.w, 8, heroW - size.w - 8);
      const minY = clamp(ny - padTop, 8, heroH - size.h - 8);
      const maxY = clamp(ny + nh + padBottom - size.h, 8, heroH - size.h - 8);

      return {
        minX,
        maxX: Math.max(minX, maxX),
        minY,
        maxY: Math.max(minY, maxY),
      };
    };

    const getBounds = () => (isMobile() ? boundsMobile() : boundsDesktop());

    const pickTarget = (force = false) => {
      const b = getBounds();
      targetX = rand(b.minX, b.maxX);
      targetY = rand(b.minY, b.maxY);

      if (force || Math.random() < 0.45) {
        cruise = rand(isMobile() ? 14 : 18, isMobile() ? 26 : 34);
      }
      nextTargetAt = performance.now() + rand(2600, 5200);
    };

    const pickFarTarget = () => {
      const b = getBounds();
      targetX = rand(b.minX, b.maxX);
      targetY = rand(b.minY, b.maxY);
      nextTargetAt = performance.now() + rand(1600, 2600);
    };

    const clampToBounds = () => {
      const b = getBounds();
      if (x < b.minX) {
        x = b.minX;
        vx = Math.abs(vx) * 0.7;
      }
      if (x > b.maxX) {
        x = b.maxX;
        vx = -Math.abs(vx) * 0.7;
      }
      if (y < b.minY) {
        y = b.minY;
        vy = Math.abs(vy) * 0.7;
      }
      if (y > b.maxY) {
        y = b.maxY;
        vy = -Math.abs(vy) * 0.7;
      }
    };

    const tick = (now) => {
      if (!running) return;

      const dt = clamp((now - last) / 1000, 0.01, 0.05);
      last = now;

      if (now > nextTargetAt) pickTarget(false);

      // Occasional pulse on desktop only
      if (!isMobile() && now > nextBoostAt) {
        boostUntil = now + rand(1400, 2600);
        nextBoostAt = now + rand(14000, 26000);
        cruise = rand(54, 86);
        pickFarTarget();
      }

      const boosting = !isMobile() && now < boostUntil;
      el.classList.toggle("boost", boosting);

      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.hypot(dx, dy) || 0.0001;

      const desiredVX = (dx / dist) * cruise;
      const desiredVY = (dy / dist) * cruise;

      const steer = boosting ? 0.11 : 0.075;
      vx += (desiredVX - vx) * steer;
      vy += (desiredVY - vy) * steer;

      const maxSpeed = boosting ? 110 : isMobile() ? 34 : 52;
      const sp = Math.hypot(vx, vy) || 0.0001;
      if (sp > maxSpeed) {
        vx = (vx / sp) * maxSpeed;
        vy = (vy / sp) * maxSpeed;
      }

      x += vx * dt;
      y += vy * dt;

      clampToBounds();

      const dir = vx >= 0 ? 1 : -1;
      const bob = Math.sin(now * 0.0022 + 1.4) * (boosting ? 1.4 : 2.6);

      const trail = clamp((sp - 8) / 90, 0, 1);
      el.style.setProperty("--trail", trail.toFixed(3));

      const op = clamp((isMobile() ? 0.44 : 0.36) + trail * 0.12, 0.28, 0.55);
      el.style.opacity = String(op);

      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y + bob)}px, 0) scaleX(${dir})`;

      rafId = requestAnimationFrame(tick);
    };

    let heroVisible = true;
    let heroIO = null;

    const setupHeroObserver = () => {
      if (!hero || !("IntersectionObserver" in window)) return;

      if (heroIO) heroIO.disconnect();

      heroIO = new IntersectionObserver(
        ([entry]) => {
          heroVisible = !!entry?.isIntersecting;
          if (isMobile()) {
            if (heroVisible) start();
            else stop();
          }
        },
        { threshold: 0.08 }
      );

      heroIO.observe(hero);
    };

    const start = () => {
      if (prefersReducedMotion) return;
      if (running) return;
      if (isMobile() && !heroVisible) return;

      running = true;
      measure();

      const b = getBounds();
      x = rand(b.minX, b.maxX);
      y = rand(b.minY, b.maxY);
      vx = rand(-8, 8);
      vy = rand(-7, 7);

      pickTarget(true);
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      el.style.opacity = "0";
    };

    const resize = () => {
      measure();
      clampToBounds();
      pickTarget(true);
    };

    setupHeroObserver();

    return { start, stop, resize };
  }

  const jelly = initJellyfish();
  if (jelly && !document.hidden && !prefersReducedMotion) jelly.start();
  window.addEventListener("resize", () => jelly?.resize(), { passive: true });

  // Background visibility handling
  const startBgIfVisible = () => {
    if (!bg) return;
    if (prefersReducedMotion) return;
    if (document.hidden) return;
    bg.start();
  };
  const stopBg = () => bg && bg.stop();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopBg();
      stopAuto();
      jelly?.stop();
    } else {
      startBgIfVisible();
      startAuto();
      jelly?.start();
      jelly?.resize();
    }
  });
})();
