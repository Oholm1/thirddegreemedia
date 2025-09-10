(() => {
  const mediaOk = !(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const saveData = (navigator.connection && navigator.connection.saveData) || false;
  if (!mediaOk || saveData) return;

  let MODE = (window.TRAIL_MODE || document.body.getAttribute('data-trail') || 'rainbow').toLowerCase();
  if (MODE === 'off') return;

  // Device-aware sizing
  const devMem = navigator.deviceMemory || 4;
  const BASE_POOL = devMem <= 4 ? 72 : 120;
  const POOL_SIZE = BASE_POOL;
  const pool = []; let poolIndex = 0;

  // PERF switches (will flip if FPS low)
  let ALLOW_BLUR = true;
  const hasAnime = () => typeof window.anime === 'function';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => Math.random() * (b - a) + a;

  // Golden angle hue
  const golden = 0.61803398875; let hue = Math.floor(rand(0, 360));
  const nextHue = (step = golden * 360) => (hue = (hue + step) % 360);

  function makeParticle() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position:'fixed', width:'12px', height:'12px', borderRadius:'50%',
      pointerEvents:'none', zIndex:'7', /* lower than before to avoid huge layer stacks */
      transform:'translate(-50%, -50%)',
      willChange:'transform, opacity',
      opacity:'0', backfaceVisibility:'hidden'
    });
    el.className = 'trail';
    document.body.appendChild(el);
    return el;
  }
  function nextParticle(){ const el = pool[poolIndex++ % POOL_SIZE]; el.style.opacity='1'; return el; }

  function animate(el, opts) {
    if (hasAnime()) {
      anime({
        targets: el,
        opacity: [opts.opacityFrom ?? 1, 0],
        translateX: opts.tx ?? 0,
        translateY: opts.ty ?? 0,
        scale: [opts.scaleFrom ?? 1, opts.scaleTo ?? 1.8],
        duration: opts.duration ?? 420,
        easing: opts.easing || 'easeOutExpo',
        complete: () => { el.style.opacity = '0'; el.style.filter=''; }
      });
    } else {
      // Lightweight fallback
      el.style.transition = 'opacity .42s ease-out, transform .42s ease-out';
      requestAnimationFrame(() => {
        el.style.opacity = '0';
        el.style.transform += ' scale(1.8)';
      });
      setTimeout(() => { el.style.opacity = '0'; el.style.filter=''; }, 450);
    }
  }

  const modes = {
    rainbow(e) {
      const el = nextParticle();
      const h = nextHue();
      el.style.width = el.style.height = '12px';
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
      el.style.background = `hsl(${h} 100% 60%)`;
      el.style.boxShadow = ALLOW_BLUR ? '0 0 8px rgba(255,255,255,.15)' : 'none';
      animate(el, { duration: 420, scaleTo: 1.9 });
    },
    comet(e) {
      const tail = 4; // ↓ from 6 (cheaper)
      const vx = e.movementX || 0, vy = e.movementY || 0;
      for (let i = 0; i < tail; i++) {
        const el = nextParticle();
        const size = 10 + i * 2;
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.left = (e.clientX - vx * i * 0.55) + 'px';
        el.style.top  = (e.clientY - vy * i * 0.55) + 'px';
        el.style.background = '#00ffcc';
        el.style.filter = (ALLOW_BLUR ? `blur(${i * 0.4}px)` : 'none');
        animate(el, { duration: 380 + i * 30, scaleTo: 1.4 + i * 0.08, opacityFrom: 1 - i / tail });
      }
    },
    sparks(e) {
      const n = 8; // ↓ from 10
      for (let i = 0; i < n; i++) {
        const el = nextParticle();
        const angle = rand(0, Math.PI * 2);
        const dist = rand(8, 32);
        el.style.width = el.style.height = '10px';
        el.style.left = e.clientX + 'px';
        el.style.top  = e.clientY + 'px';
        el.style.background = `hsl(${(hue + i * 18) % 360} 100% 60%)`;
        el.style.filter = ALLOW_BLUR ? 'none' : 'none';
        animate(el, { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, duration: 420 + i * 6, scaleTo: 1.15 });
      }
    },
    minimal(e) {
      const el = nextParticle();
      el.style.width = el.style.height = '10px';
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
      el.style.background = 'currentColor';
      el.style.boxShadow = 'none';
      el.style.filter = 'none';
      animate(el, { duration: 300, scaleTo: 1.2 });
    }
  };

  // rAF-throttled dispatcher + cap per frame
  let pending = false, lastEvent = null, perFrame = 0;
  function onMove(e){
    lastEvent = e; if (pending) return; pending = true; perFrame = 0;
    requestAnimationFrame(() => {
      if (MODE !== 'off') {
        (modes[MODE] || modes.rainbow)(lastEvent);
        // Cap extra spawns
        if (++perFrame > 1 && MODE !== 'minimal') modes.minimal(lastEvent);
      }
      pending = false;
    });
  }
  function onClick(e){
    // small burst but bounded
    const count = (MODE === 'minimal') ? 3 : 6;
    for (let i = 0; i < count; i++) modes.sparks(e);
  }
  function onTouch(e){
    const t = e.touches && e.touches[0]; if (!t) return;
    onMove({ clientX: t.clientX, clientY: t.clientY, movementX: 0, movementY: 0 });
  }

  // Public API
  window.setTrailMode = function(mode){
    MODE = (mode || 'off').toLowerCase();
    if (MODE === 'off') { window.removeEventListener('mousemove', onMove); window.removeEventListener('touchmove', onTouch); window.removeEventListener('click', onClick); }
    document.body.setAttribute('data-trail', MODE);
  };

  // Init pool
  function init(){
    for (let i = 0; i < POOL_SIZE; i++) pool.push(makeParticle());
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
  }
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', init, { once:true }) : init();

  // FPS watchdog → if slow, drop effects
  (function fpsWatch(){
    let last = performance.now(), slowFrames = 0;
    function tick(now){
      const dt = now - last; last = now;
      if (dt > 24) slowFrames++; else if (slowFrames) slowFrames--;
      if (slowFrames > 20) { // ~0.33s of struggling
        ALLOW_BLUR = false;               // kill blur first
        if (MODE !== 'minimal') MODE = 'minimal'; // downgrade visual complexity
        slowFrames = 0;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
})();

