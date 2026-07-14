/* ============================================================
   main.js — 页面渲染逻辑
   一般不需要改这个文件；想改内容请去 js/data.js
   想改样式请去 css/theme.css / css/style.css
   ============================================================ */

/* ---------- 小工具 ---------- */
function qsParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}
function worldById(id) { return WORLDS.find((w) => w.id === id); }
function charById(id) { return CHARACTERS.find((c) => c.id === id); }
function charsOfWorld(worldId) { return CHARACTERS.filter((c) => c.worldId === worldId); }
function storiesOfWorld(worldId) { return STORIES.filter((s) => s.worldId === worldId); }

/* ---------- 站点头部信息（每个页面都会调用） ---------- */
function applySiteHeader() {
  document.querySelectorAll("[data-site-name]").forEach((n) => (n.textContent = SITE.name));
  document.querySelectorAll("[data-site-subtitle]").forEach((n) => (n.textContent = SITE.subtitle));
}

/* ---------- 首页：世界观网格 ---------- */
function renderWorldGrid(container) {
  if (WORLDS.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "还没有世界观" }),
        el("div", { text: "去 js/data.js 的 WORLDS 数组里添加第一个世界观吧。" }),
      ])
    );
    return;
  }
  WORLDS.forEach((w) => {
    const card = el("a", { class: "world-card", href: `world.html?id=${w.id}` }, [
      el("div", { class: "world-id", text: w.code || w.id }),
      el("h3", { text: w.title }),
      el("p", { text: w.summary || w.tagline || "" }),
      el("div", { class: "world-meta" }, [
        el("span", { text: `${charsOfWorld(w.id).length} 位角色` }),
        el("span", { text: `更新于 ${w.updatedAt || "—"}` }),
      ]),
    ]);
    container.appendChild(card);
  });
}

/* ---------- 世界观详情页 ---------- */
function renderWorldDetail() {
  const id = qsParam("id");
  const world = worldById(id);
  const root = document.getElementById("world-root");
  if (!world) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "没有找到这个世界观" }),
        el("div", { text: "检查一下链接里的 id，或者回首页看看。" }),
      ])
    );
    return;
  }

  document.title = `${world.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [el("a", { href: "index.html", text: "首页" }), " / ", world.title])
  );

  root.appendChild(
    el("div", { class: "panel" }, [
      el("div", { class: "panel-header" }, [
        el("span", { class: "tag", text: world.code || "" }),
        el("h2", { text: world.title }),
      ]),
      el("div", { class: "panel-body" }, [
        el("p", { style: "color:var(--color-text-dim); margin:0", text: world.summary }),
      ]),
    ])
  );

  // tabs
  const tabs = el("div", { class: "tabs" }, [
    el("a", { href: "#chars", class: "active", "data-tab": "chars", text: "角色档案" }),
    el("a", { href: "#relations", "data-tab": "relations", text: "角色关系图" }),
    el("a", { href: "#stories", "data-tab": "stories", text: "相关故事" }),
  ]);
  root.appendChild(tabs);

  const panes = {
    chars: el("div", { id: "pane-chars" }),
    relations: el("div", { id: "pane-relations", style: "display:none" }),
    stories: el("div", { id: "pane-stories", style: "display:none" }),
  };
  root.appendChild(panes.chars);
  root.appendChild(panes.relations);
  root.appendChild(panes.stories);

  tabs.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      tabs.querySelectorAll("a").forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      Object.entries(panes).forEach(([key, node]) => {
        node.style.display = key === a.dataset.tab ? "" : "none";
      });
    });
  });

  // 角色档案 pane
  const chars = charsOfWorld(world.id);
  if (chars.length === 0) {
    panes.chars.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "这个世界观还没有角色" }),
        el("div", { text: "去 js/data.js 的 CHARACTERS 数组里添加，worldId 填这个世界观的 id。" }),
      ])
    );
  } else {
    const grid = el("div", { class: "char-grid" });
    chars.forEach((c) => {
      grid.appendChild(
        el("a", { class: "char-card", href: `character.html?id=${c.id}` }, [
          el(
            "div",
            { class: "char-portrait" },
            c.portrait ? el("img", { src: c.portrait, alt: c.name }) : "肖像占位"
          ),
          el("div", { class: "char-info" }, [
            el("div", { class: "char-name", text: c.name }),
            el("div", { class: "char-role", text: c.role || "" }),
          ]),
        ])
      );
    });
    panes.chars.appendChild(grid);
  }

  // 关系图 pane
  renderRelationGraph(panes.relations, world.id);

  // 故事 pane
  const stories = storiesOfWorld(world.id);
  if (stories.length === 0) {
    panes.stories.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "还没有相关故事" }),
        el("div", { text: "去 js/data.js 的 STORIES 数组里添加，worldId 填这个世界观的 id。" }),
      ])
    );
  } else {
    const list = el("div", { class: "story-list" });
    stories.forEach((s) => {
      list.appendChild(
        el("a", { class: "story-item", href: `story.html?id=${s.id}` }, [
          el("span", { class: "story-type", text: s.type }),
          el("span", { class: "story-title", text: s.title }),
          el("span", { class: "story-date", text: s.date || "" }),
        ])
      );
    });
    panes.stories.appendChild(list);
  }
}

/* ---------- 角色关系图（简单力导向占位版：固定圆形布局 + 可拖拽） ---------- */
function renderRelationGraph(container, worldId) {
  const chars = charsOfWorld(worldId);
  const relations = RELATIONS.filter((r) => r.worldId === worldId);

  if (chars.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "暂无角色，无法生成关系图" }),
      ])
    );
    return;
  }

  const wrap = el("div", { class: "relation-canvas-wrap" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "relation-svg");
  wrap.appendChild(svg);
  container.appendChild(wrap);
  container.appendChild(
    el("div", { class: "relation-hint", text: "提示：节点可以拖动；点击节点跳转到角色档案。这是简易占位版关系图，后续可以替换成更复杂的可视化。" })
  );

  // 圆形初始布局
  const positions = {};
  const cx = 50, cy = 50, r = 34;
  chars.forEach((c, i) => {
    const angle = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    positions[c.id] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  function draw() {
    svg.innerHTML = "";
    relations.forEach((rel) => {
      const a = positions[rel.from], b = positions[rel.to];
      if (!a || !b) return;
      const wrapRect = wrap.getBoundingClientRect();
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", (a.x / 100) * wrapRect.width);
      line.setAttribute("y1", (a.y / 100) * wrapRect.height);
      line.setAttribute("x2", (b.x / 100) * wrapRect.width);
      line.setAttribute("y2", (b.y / 100) * wrapRect.height);
      line.setAttribute("class", "relation-edge");
      svg.appendChild(line);

      const midX = ((a.x + b.x) / 2 / 100) * wrapRect.width;
      const midY = ((a.y + b.y) / 2 / 100) * wrapRect.height;
      const text = document.createElementNS(svg.namespaceURI, "text");
      text.setAttribute("x", midX);
      text.setAttribute("y", midY);
      text.setAttribute("class", "relation-edge-label");
      text.setAttribute("text-anchor", "middle");
      text.textContent = rel.label || "";
      svg.appendChild(text);
    });
  }

  chars.forEach((c) => {
    const node = el("a", {
      class: "relation-node",
      href: `character.html?id=${c.id}`,
      style: `left:${positions[c.id].x}%; top:${positions[c.id].y}%`,
    }, [
      el("div", { class: "dot", text: c.name.slice(0, 1) }),
      el("div", { class: "label", text: c.name }),
    ]);

    let dragging = false;
    node.addEventListener("mousedown", (e) => {
      dragging = true;
      node.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const rect = wrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      positions[c.id] = { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
      node.style.left = positions[c.id].x + "%";
      node.style.top = positions[c.id].y + "%";
      draw();
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
      node.style.cursor = "grab";
    });
    node.addEventListener("click", (e) => { if (dragging) e.preventDefault(); });

    wrap.appendChild(node);
  });

  window.addEventListener("resize", draw);
  requestAnimationFrame(draw);
}

/* ---------- 角色详情页 ---------- */
function renderCharacterDetail() {
  const id = qsParam("id");
  const c = charById(id);
  const root = document.getElementById("char-root");
  if (!c) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "没有找到这个角色" }),
      ])
    );
    return;
  }
  const world = worldById(c.worldId);
  document.title = `${c.name} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }),
      " / ",
      world ? el("a", { href: `world.html?id=${world.id}`, text: world.title }) : "未知世界观",
      " / ",
      c.name,
    ])
  );

  const header = el("div", { class: "char-detail-header" }, [
    el(
      "div",
      { class: "char-detail-portrait" },
      c.portrait ? el("img", { src: c.portrait, alt: c.name }) : "肖像占位"
    ),
    el("div", { class: "char-detail-meta" }, [
      el("h1", { text: c.name }),
      el("div", { class: "subtitle", text: c.role || "" }),
      el(
        "dl",
        { class: "kv-list" },
        (c.quickFacts || []).flatMap(([k, v]) => [
          el("dt", { text: k }),
          el("dd", { text: v }),
        ])
      ),
    ]),
  ]);
  root.appendChild(header);

  if (c.bio) {
    root.appendChild(
      el("div", { class: "section-block" }, [
        el("h2", { text: "简介" }),
        el("p", { style: "color:var(--color-text-dim); margin:0", text: c.bio }),
      ])
    );
  }

  if (c.origin) {
    root.appendChild(
      el("div", { class: "section-block" }, [
        el("h2", { text: "本源 / 设定要点" }),
        el("p", { style: "color:var(--color-text-dim); margin:0", text: c.origin }),
      ])
    );
  }

  if (c.traits && c.traits.length) {
    root.appendChild(
      el("div", { class: "section-block" }, [
        el("h2", { text: "特质标签" }),
        el(
          "ul",
          { class: "bullet-list" },
          c.traits.map((t) => el("li", { text: t }))
        ),
      ])
    );
  }

  // 关联故事
  const related = STORIES.filter((s) => s.worldId === c.worldId);
  if (related.length) {
    const list = el("div", { class: "story-list" });
    related.forEach((s) => {
      list.appendChild(
        el("a", { class: "story-item", href: `story.html?id=${s.id}` }, [
          el("span", { class: "story-type", text: s.type }),
          el("span", { class: "story-title", text: s.title }),
        ])
      );
    });
    root.appendChild(el("div", { class: "section-block" }, [el("h2", { text: "相关故事" }), list]));
  }
}

/* ---------- 故事详情页 ---------- */
function renderStoryDetail() {
  const id = qsParam("id");
  const s = STORIES.find((x) => x.id === id);
  const root = document.getElementById("story-root");
  if (!s) {
    root.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "没有找到这篇故事" })]));
    return;
  }
  const world = worldById(s.worldId);
  document.title = `${s.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }),
      " / ",
      world ? el("a", { href: `world.html?id=${world.id}`, text: world.title }) : el("a", { href: "drabbles.html", text: "短打" }),
      " / ",
      s.title,
    ])
  );

  root.appendChild(
    el("div", { class: "panel" }, [
      el("div", { class: "panel-header" }, [
        el("span", { class: "tag", text: s.type }),
        el("h2", { text: s.title }),
      ]),
      el("div", { class: "panel-body" }, [
        el("div", { style: "color:var(--color-text-faint); font-size:12px; margin-bottom:16px", text: s.date || "" }),
        el("div", { class: "prose", text: s.content || s.excerpt || "" }),
      ]),
    ])
  );
}

/* ---------- 短打 / 全部故事 汇总页 ---------- */
function renderDrabbles(container) {
  const items = STORIES.filter((s) => s.type === "短打");
  if (items.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "还没有短打" }),
        el("div", { text: "去 js/data.js 的 STORIES 数组里添加一条 type 为 \"短打\" 的记录即可。" }),
      ])
    );
    return;
  }
  const list = el("div", { class: "story-list" });
  items.forEach((s) => {
    list.appendChild(
      el("a", { class: "story-item", href: `story.html?id=${s.id}` }, [
        el("span", { class: "story-type", text: s.type }),
        el("span", { class: "story-title", text: s.title }),
        el("span", { class: "story-date", text: s.date || "" }),
      ])
    );
  });
  container.appendChild(list);
}

document.addEventListener("DOMContentLoaded", applySiteHeader);
