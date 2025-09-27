# Ensure js folder exists
mkdir docs\js -Force | Out-Null

@'
(async function () {
  const input  = document.querySelector("#site-search");
  const list   = document.querySelector("#search-results");
  if (!input || !list) return;

  function esc(s){ return s.replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

  let docs = [];
  try {
    const r = await fetch("/search-data.json", { cache: "no-store" });
    docs = await r.json();
  } catch(e) {
    list.innerHTML = "<li class='muted'>Search index not found.</li>";
    return;
  }

  const search = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return docs.map(d => {
      const t = (d.title||"").toLowerCase();
      const c = (d.content||"").toLowerCase();
      let score = 0;
      if (t.includes(q)) score += 5;
      // split into tokens to make it a bit smarter
      const toks = q.split(/\s+/).filter(Boolean);
      for (const tok of toks) {
        if (t.includes(tok)) score += 3;
        if (c.includes(tok)) score += 1;
      }
      return { d, score };
    }).filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0, 20)
      .map(x => x.d);
  };

  const render = (items) => {
    if (!items.length) { list.innerHTML = "<li class='muted'>No results</li>"; return; }
    list.innerHTML = items.map(it => (
      `<li><a href="${esc(it.url)}">${esc(it.title)}</a></li>`
    )).join("");
  };

  let t;
  input.addEventListener("input", e => {
    clearTimeout(t);
    const q = e.target.value;
    t = setTimeout(() => render(search(q)), 80);
  });
})();
'@ | Set-Content -Encoding UTF8 docs\js\search.js
