// docs/js/search.js
(async function () {
  const input = document.querySelector('#site-search');
  const results = document.querySelector('#search-results');
  if (!input || !results) return;

  const resp = await fetch('/search-data.json', { cache: 'no-store' });
  const docs = await resp.json();

  // Build index
  const mini = new MiniSearch({
    fields: ['title', 'content', 'section'],
    storeFields: ['title', 'url', 'section'],
    searchOptions: {
      boost: { title: 4, section: 2, content: 1 },
      fuzzy: 0.1,
      prefix: true
    }
  });
  mini.addAll(docs);

  const render = (items) => {
    if (!items.length) { results.innerHTML = '<li class="muted">No results</li>'; return; }
    results.innerHTML = items.slice(0, 20).map(hit => {
      const { title, url, section } = hit;
      const sec = section ? `<span class="badge">${section}</span>` : '';
      return `<li><a href="${url}">${title}</a> ${sec}</li>`;
    }).join('');
  };

  let t;
  input.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(t);
    t = setTimeout(() => {
      if (!q) { results.innerHTML = ''; return; }
      render(mini.search(q));
    }, 80);
  });
})();
