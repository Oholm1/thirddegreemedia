(async function(){
  const res = await fetch('/news.json', {cache:'no-store'});
  if (!res.ok) return;
  const data = await res.json();
  const wrap = document.getElementById('news-feed');
  wrap.innerHTML = '';

  data.items.slice(0,10).forEach(it => {
    const li = document.createElement('li');
    li.className = "mb-2";

    const a = document.createElement('a');
    a.href = it.link;
    a.textContent = it.title;
    a.rel = "noopener noreferrer";
    a.className = "font-medium hover:underline";

    const meta = document.createElement('div');
    meta.className = "text-xs opacity-70";
    meta.textContent = `${it.source} — ${it.published}`;

    li.appendChild(a);
    li.appendChild(meta);
    wrap.appendChild(li);
  });
})();
