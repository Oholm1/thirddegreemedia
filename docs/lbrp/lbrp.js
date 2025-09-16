Here’s the JavaScript portion extracted cleanly from the original `<script>…</script>` block. Save this as `docs/lbrp/lbrp.js`:

```javascript
(function(){
  const stage = document.getElementById('stage');
  const layerBase = document.getElementById('layer-base');
  const layerDraw = document.getElementById('layer-draw');
  const layerOverlay = document.getElementById('layer-overlay');
  const chantEl = document.getElementById('chant');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');
  const stepsList = document.getElementById('steps');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const speedCtl = document.getElementById('speed');
  const muteCtl = document.getElementById('mute');

  let playing = false;
  let idx = 0;
  let speed = 1;

  function log(msg){ const t = new Date().toLocaleTimeString(); logEl.innerHTML += `[${t}] ${msg}<br>`; logEl.scrollTop = logEl.scrollHeight; }
  function setStatus(msg){ statusEl.textContent = msg; }
  function sleep(ms){ return new Promise(r=> setTimeout(r, ms / speed)); }

  // Simple audio beeps via WebAudio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext || function(){})();
  function beep(freq=440, dur=200, type='sine', gain=0.06){
    if (!audioCtx || muteCtl.checked) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g);
    g.connect(audioCtx.destination); g.gain.value = gain;
    o.start(); setTimeout(()=>{ o.stop(); }, dur / speed);
  }

  // Geometry helpers
  function polar(r, ang){ return [r*Math.cos(ang), r*Math.sin(ang)]; }
  function starPath(R=120){
    const pts = [];
    for(let i=0;i<5;i++){
      const a = (-Math.PI/2) + i * (2*Math.PI/5);
      pts.push(polar(R, a));
    }
    const order = [1,4,2,0,3];
    const seq = order.map(i=>pts[i]);
    let d = `M ${seq[0][0]} ${seq[0][1]}`;
    for(let i=1;i<seq.length;i++){ d += ` L ${seq[i][0]} ${seq[i][1]}`; }
    d += ` Z`;
    return d;
  }

  function drawCircle(r=160){
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('class','circle'); c.setAttribute('cx','0'); c.setAttribute('cy','0'); c.setAttribute('r', r);
    return c;
  }

  function pathEl(d){ const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); p.setAttribute('class','pentagram'); return p; }

  async function animateStroke(el, ms=1400){
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset ${ms/speed}ms ease-in-out`;
    el.style.strokeDashoffset = '0';
    await sleep(ms + 60);
  }

  async function flashChant(text, color='var(--muted)', ms=1200){
    chantEl.textContent = text; chantEl.style.color = color; chantEl.style.opacity = 0;
    chantEl.animate([{opacity:0, transform:'translate(-50%,-50%) scale(.95)'},{opacity:1, transform:'translate(-50%,-50%) scale(1)'},{opacity:0}], {duration: ms/speed, easing:'ease-in-out'});
    beep(392, 180, 'sine'); await sleep(ms);
  }

  async function qabalisticCross(open=true){
    setStatus(open? 'Centering — Qabalistic Cross' : 'Closing — Qabalistic Cross');
    log(open? 'Qabalistic Cross (opening)' : 'Qabalistic Cross (closing)');
    layerDraw.innerHTML = '';
    await flashChant('Ateh (For Thine)');
    await flashChant('Malkuth (The Kingdom)');
    await flashChant('Ve-Geburah (The Power)');
    await flashChant('Ve-Gedulah (The Glory)');
    await flashChant('Le-Olam, Amen (Forever)');
  }

  async function banish(direction){
    const map = {
      east: { name: 'YHVH', color:'var(--air)', angle:0 },
      south:{ name: 'ADONAI', color:'var(--fire)', angle:90 },
      west: { name: 'EHEIEH', color:'var(--water)', angle:180 },
      north:{ name: 'AGLA', color:'var(--earth)', angle:270 }
    };
    const cfg = map[direction];
    setStatus(`Banishing — ${direction.toUpperCase()} (${cfg.name})`);
    log(`Pentagram ${direction} — ${cfg.name}`);
    layerDraw.innerHTML = '';
    const circle = drawCircle(160); layerDraw.appendChild(circle);
    const p = pathEl(starPath(120)); layerDraw.appendChild(p);
    const group = document.createElementNS('http://www.w3.org/2000/svg','g');
    group.appendChild(circle); group.appendChild(p);
    layerDraw.innerHTML = ''; layerDraw.appendChild(group);
    group.setAttribute('transform', `rotate(${cfg.angle})`);
    beep(523, 120, 'sine'); await animateStroke(p, 1500);
    await flashChant(cfg.name, cfg.color, 1400);
    await sleep(250);
  }

  async function archangels(){
    setStatus('Archangels'); log('Archangels called'); layerDraw.innerHTML = '';
    const angels = [
      {label:'Before me', name:'RAPHAEL', x:0, y:-180, color:'var(--air)'},
      {label:'Behind me', name:'GABRIEL', x:0, y:180, color:'var(--water)'},
      {label:'On my right', name:'MICHAEL', x:180, y:0, color:'var(--fire)'},
      {label:'On my left', name:'URIEL', x:-180, y:0, color:'var(--earth)'}
    ];
    for(const a of angels){
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class','archangel'); g.setAttribute('transform',`translate(${a.x},${a.y})`);
      const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
      halo.setAttribute('r','26'); halo.setAttribute('fill','none'); halo.setAttribute('stroke', a.color); halo.setAttribute('stroke-width','3');
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('y','6'); txt.setAttribute('text-anchor','middle'); txt.setAttribute('fill', a.color); txt.textContent = a.name;
      g.appendChild(halo); g.appendChild(txt);
      layerDraw.appendChild(g);
      g.animate([{opacity:0, transform:`translate(${a.x}px,${a.y}px) scale(.7)`},{opacity:1, transform:`translate(${a.x}px,${a.y}px) scale(1)`}], {duration: 600/speed, easing:'ease-out'});
      beep(440, 120, 'triangle'); await sleep(320);
    }
    await flashChant('For about me flames the Pentagram', 'var(--muted)', 1400);
    await flashChant('Within me shines the Six-Rayed Star', 'var(--muted)', 1400);
  }

  const program = [
    () => qabalisticCross(true),
    () => banish('east'),
    () => banish('south'),
    () => banish('west'),
    () => banish('north'),
    () => archangels(),
    () => qabalisticCross(false)
  ];

  async function run(){
    playing = true; btnStart.disabled = true; btnPause.disabled = false; btnReset.disabled = false; setStatus('Running…');
    while (playing && idx < program.length){
      [...stepsList.querySelectorAll('li')].forEach((li,i)=> li.style.color = i===idx? 'var(--accent)' : '');
      try{ await program[idx](); }catch(e){ console.error(e); log('Error: '+e.message); }
      idx++;
      if (!playing) break;
      await sleep(500);
    }
    if (idx >= program.length){ setStatus('Complete'); log('Ritual complete ✧'); playing=false; btnStart.disabled=false; btnPause.disabled=true; }
  }

  function reset(){ idx=0; playing=false; layerDraw.innerHTML=''; chantEl.textContent=''; setStatus('Ready'); [...stepsList.querySelectorAll('li')].forEach(li=> li.style.color=''); }

  btnStart.addEventListener('click', ()=>{ if (!playing){ run(); } });
  btnPause.addEventListener('click', ()=>{ playing=false; btnStart.disabled=false; btnPause.disabled=true; setStatus('Paused'); log('Paused'); });
  btnReset.addEventListener('click', ()=>{ reset(); btnReset.disabled=true; btnPause.disabled=true; btnStart.disabled=false; log('Reset'); });
  speedCtl.addEventListener('input', e=>{ speed = parseFloat(e.target.value || '1'); setStatus(`Speed ×${speed.toFixed(1)}`); });

  document.addEventListener('keydown', (e)=>{
    if (e.code==='Space'){ e.preventDefault(); if (!playing) run(); else { playing=false; setStatus('Paused'); btnStart.disabled=false; btnPause.disabled=true; } }
    if (e.code==='ArrowRight'){ playing=false; btnStart.disabled=false; btnPause.disabled=true; if (idx < program.length-1){ idx++; log('Step >>'); } }
    if (e.code==='ArrowLeft'){ playing=false; btnStart.disabled=false; btnPause.disabled=true; if (idx > 0){ idx--; log('Step <<'); } }
  });

  // Base grid
  function grid(){
    const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('opacity','.25');
    const rings=[60,120,180]; rings.forEach(r=> g.appendChild(drawCircle(r)));
    const ax = document.createElementNS('http://www.w3.org/2000/svg','path'); ax.setAttribute('d','M -260 0 L 260 0 M 0 -200 L 0 200'); ax.setAttribute('stroke','rgba(150,170,220,.4)'); ax.setAttribute('stroke-width','1'); ax.setAttribute('stroke-dasharray','4 6'); g.appendChild(ax);
    layerBase.appendChild(g);
  }
  grid();
})();
```

👉 Save this as `docs/lbrp/lbrp.js`.  

Next step is the **HTML skeleton** (`index.html`) that wires together `lbrp.css` and `lbrp.js`. Want me to hand that over now?
