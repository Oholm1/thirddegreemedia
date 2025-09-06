/* SVG Glyph Trail — drop-in script
   - Uses an SVG <symbol> once and reuses via <use>
   - Respects prefers-reduced-motion
   - Uses anime.js if available, CSS fallback otherwise
   - Particle pooling for performance
*/
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const POOL = 90;              // number of pooled glyphs
  const BASE_SIZE = 14;         // starting size in px
  const SIZE_JITTER = 10;       // random extra size
  const ROT_JITTER = 45;        // degrees to rotate during fade
  const DURATION = 550;         // ms per particle

  // Create one glyph instance
  function makeGlyph(symbolId = '#glyph-star') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(BASE_SIZE));
    svg.setAttribute('height', String(BASE_SIZE));
    svg.style.position = 'fixed';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '9999';
    svg.style.transform = 'translate(-50%, -50%)';
    svg.style.willChange = 'transform, opacity';
    svg.style.opacity = '0';
    svg.style.fill = 'currentColor';

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    // modern href on xlink namespace for broad support
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', symbolId);
    svg.appendChild(use);

    document.body.appendChild(svg);
    return svg;
  }

  // Build a pool to avoid DOM churn
  const pool = Array.from({ length: POOL }, () => makeGlyph());
  let idx = 0;
  const next = () => pool[idx++ % POOL];

  let hue = 0; // rainbow color cycling
  const hasAnime = () => typeof window.anime === 'function';

  function animate(el, rot, scaleTo) {
    if (hasAnime()) {
      anime({
        targets: el,
        opacity: [1, 0],
        rotate: ['+' + 0, '+' + rot],
        scale: [1, scaleTo],
        duration: DURATION,
        easing: 'easeOutExpo',
        complete: () => { el.style.opacity = '0'; }
      });
    } else {
      el.style.transition = `opacity ${DURATION}ms ease-out, transform ${DURATION}ms ease-out`;
      requestAnimationFrame(() => {
        el.style.opacity = '0';
        el.style.transform += ` rotate(${rot}deg) scale(${scaleTo})`;
      });
      setTimeout(() => { el.style.opacity = '0'; }, DURATION + 20);
    }
  }

  let pending = false; let lastEvt = null;
  function onMove(e) {
    lastEvt = e; if (pending) return; pending = true;
    requestAnimationFrame(() => {
      const el = next();
      hue = (hue + 7) % 360;
      const size = BASE_SIZE + Math.random() * SIZE_JITTER;
      const rot = Math.random() * ROT_JITTER;

      el.setAttribute('width', String(size));
      el.setAttribute('height', String(size));
      el.style.left = lastEvt.clientX + 'px';
      el.style.top = lastEvt.clientY + 'px';
      el.style.opacity = '1';
      el.style.color = `hsl(${hue} 100% 60%)`;

      animate(el, rot, 1.8);
      pending = false;
    });
  }

  function onTouch(e) {
    const t = e.touches[0]; if (!t) return;
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
})();
