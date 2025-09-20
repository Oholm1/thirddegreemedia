// File: docs/js/news.js
(function () {
  const FEED_URL = '/news.json'; // single source of truth

  const els = {
    privacy: document.getElementById('privacy-list') || document.querySelector('[data-feed="privacy"]'),
    investigations: document.getElementById('investigations-list') || document.querySelector('[data-feed="investigations"]'),
    btnPrivacy: document.getElementById('privacy-refresh') || document.querySelector('[data-refresh="privacy"]'),
    btnInvestigations: document.getElementById('investigations-refresh') || document.querySelector('[data-refresh="investigations"]')
  };

  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    children.forEach(c => el.appendChild(c));
    return el;
  }

  function status(target, text, isError = false) {
    if (!target) return;
    target.innerHTML = '';
    target.appendChild(h('div', { class: isError ? 'feed-status error' : 'feed-status' }, [document.createTextNode(text)]));
  }

  async function fetchJSONOnce(url) {
    const u = new URL(url, location.origin);
    u.searchParams.set('_', String(Date.now())); // cache-bust
    const res = await fetch(u.toString(), { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${u.pathname}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (/^\s*</.test(text)) throw new Error('Expected JSON but got HTML (check path/CSP)');
      throw new Error('Invalid JSON');
    }
  }

  function renderList(target, items) {
    if (!target) return;
    target.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      target.appendChild(h('p', {}, [document.createTextNode('No articles yet.')]));
      return;
    }
    const ul = h('ul', { class: 'feed-list' });
    items.forEach(it => {
      const li = h('li', { class: 'feed-item' }, [
        h('a', { href: it.url, rel: 'noopener noreferrer' }, [document.createTextNode(it.title || 'Untitled')]),
        it.date ? h('time', { datetime: it.date }, [document.createTextNode(` — ${it.date}`)]) : document.createTextNode('')
      ]);
      ul.appendChild(li);
    });
    target.appendChild(ul);
  }

  async function loadAll() {
    if (els.privacy) status(els.privacy, 'Loading…');
    if (els.investigations) status(els.investigations, 'Loading…');
    try {
      const data = await fetchJSONOnce(FEED_URL);
      if (els.privacy) renderList(els.privacy, data.privacy || []);
      if (els.investigations) renderList(els.investigations, data.investigations || []);
    } catch (err) {
      if (els.privacy) status(els.privacy, `Error loading privacy: ${err.message}`, true);
      if (els.investigations) status(els.investigations, `Error loading investigations: ${err.message}`, true);
    }
  }

  function init() {
    loadAll();
    if (els.btnPrivacy) els.btnPrivacy.addEventListener('click', loadAll);
    if (els.btnInvestigations) els.btnInvestigations.addEventListener('click', loadAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
