/* Third Degree Media — Privacy News Widget (no deps) */
/* Usage: include on any page that has a <div id="news-root"></div> */

(function () {
  const JSON_URL = "/news_feed.json"; // served statically
  const root = document.getElementById("news-root");
  if (!root) return;

  const state = {
    items: [],
    filtered: [],
    sources: new Set(),
    q: "",
    source: "All"
  };

  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "href" || k === "target" || k === "rel" || k === "title" || k === "datetime") n.setAttribute(k, v);
      else n[k] = v;
    }
    children.forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  };

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  function renderControls(lastUpdated) {
    const controls = el("div", { class: "tdm-news-controls" }, [
      el("input", {
        type: "search",
        placeholder: "Search headlines…",
        class: "tdm-input",
        value: state.q,
        oninput: (e) => { state.q = e.target.value.trim(); filter(); renderList(); }
      }),
      el("select", {
        class: "tdm-select",
        onchange: (e) => { state.source = e.target.value; filter(); renderList(); }
      }, [
        el("option", { value: "All" }, ["All sources"]),
        ...[...state.sources].sort().map(s => el("option", { value: s }, [s]))
      ]),
      el("button", {
        class: "tdm-btn",
        onclick: () => { fetchData(true); }
      }, ["Refresh"]),
      el("span", { class: "tdm-updated" }, [`Last updated: ${fmtDate(lastUpdated)}`])
    ]);
    return controls;
  }

  function renderList() {
    const list = el("div", { class: "tdm-news-list" });
    if (state.filtered.length === 0) {
      list.appendChild(el("div", { class: "tdm-empty" }, ["No stories match that filter."]));
      swap(list);
      return;
    }
    state.filtered.forEach(item => {
      const cardContent = [
        el("header", { class: "tdm-card-head" }, [
          el("a", { href: item.url, target: "_blank", rel: "noopener", class: "tdm-title" }, [item.title]),
        ]),
        el("div", { class: "tdm-meta" }, [
          el("span", { class: "tdm-source" }, [item.source]),
          el("time", { class: "tdm-date", datetime: item.date }, [fmtDate(item.date)])
        ])
      ];

      // Add image if available
      if (item.image) {
        cardContent.push(
          el("div", { class: "tdm-card-image" }, [
            el("img", { 
              src: item.image, 
              alt: item.title, 
              loading: "lazy", 
              decoding: "async",
              class: "tdm-news-img"
            })
          ])
        );
      }

      // Add summary
      cardContent.push(
        item.summary ? el("p", { class: "tdm-summary" }, [item.summary]) : el("p", { class: "tdm-summary tdm-muted" }, ["(No summary)"])
      );

      const card = el("article", { class: "tdm-card" }, cardContent);
      list.appendChild(card);
    });
    swap(list);
  }

  function swap(body) {
    const shell = el("section", { class: "tdm-news" }, [
      renderControls(state.lastUpdated || new Date().toISOString()),
      body
    ]);
    root.replaceChildren(shell);
  }

  function filter() {
    const q = state.q.toLowerCase();
    state.filtered = state.items.filter(it => {
      const passSource = (state.source === "All") || (it.source === state.source);
      const passQ = !q || (it.title.toLowerCase().includes(q) || (it.summary || "").toLowerCase().includes(q));
      return passSource && passQ;
    });
  }

  async function fetchData(bustCache = false) {
    const url = bustCache ? `${JSON_URL}?t=${Date.now()}` : JSON_URL;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.items = (data.items || []).map(it => ({
        title: it.title || "(Untitled)",
        url: it.url,
        source: it.source || "Unknown",
        date: it.date || new Date().toISOString(),
        summary: it.summary || ""
      }));
      state.sources = new Set(state.items.map(i => i.source));
      state.lastUpdated = data.last_updated || new Date().toISOString();
      filter();
      renderList();
      // Optional tiny flourish that fits your brand
      if (window.anime) { try { window.anime({ targets: ".tdm-card", opacity: [0,1], translateY: [6,0], delay: window.anime.stagger(30) }); } catch(_){} }
    } catch (e) {
      root.textContent = "Could not load news right now.";
    }
  }

  // Initial render
  root.appendChild(el("div", { class: "tdm-skel" }, [ "Loading privacy news…" ]));
  fetchData(false);
})();