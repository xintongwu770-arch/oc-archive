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
function arcById(id) { return STORY_ARCS.find((a) => a.id === id); }
function charById(id) { return CHARACTERS.find((c) => c.id === id); }
function charsOfArc(arcId) { return CHARACTERS.filter((c) => c.storyArcId === arcId); }
function relationsOfArc(arcId) { return RELATIONS.filter((r) => r.storyArcId === arcId); }
function storiesOfArc(arcId) { return STORIES.filter((s) => s.storyArcId === arcId); }

/* ---------- 站点头部信息（每个页面都会调用） ---------- */
function applySiteHeader() {
  document.querySelectorAll("[data-site-name]").forEach((n) => (n.textContent = SITE.name));
  document.querySelectorAll("[data-site-subtitle]").forEach((n) => (n.textContent = SITE.subtitle));
}

/* ---------- 宇宙风背景：随机分布的闪烁星点 ---------- */
function renderStarfield() {
  if (document.querySelector(".starfield")) return;
  const field = document.createElement("div");
  field.className = "starfield";
  field.setAttribute("aria-hidden", "true");
  const count = window.innerWidth < 640 ? 45 : 90;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("i");
    star.className = "star";
    const size = (Math.random() * 2 + 0.6).toFixed(2);
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.top = (Math.random() * 100).toFixed(2) + "%";
    star.style.left = (Math.random() * 100).toFixed(2) + "%";
    star.style.animationDuration = (Math.random() * 4 + 3).toFixed(2) + "s";
    star.style.animationDelay = (Math.random() * -6).toFixed(2) + "s";
    field.appendChild(star);
  }
  document.body.insertBefore(field, document.body.firstChild);
}

/* ---------- 首页：世界观 / 地点栏目网格 ---------- */
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
    const isMain = w.id === MAIN_WORLD_ID;
    const metaRight = isMain
      ? `${CHARACTERS.length} 位角色 · ${STORY_ARCS.length} 条故事线`
      : (w.placeholder ? "待补充" : "地点笔记");
    const cardClass =
      "world-card cosmic-block" +
      (isMain ? " world-card-main" : "") +
      (w.placeholder ? " world-card-placeholder" : "");
    const card = el(
      "a",
      { class: cardClass, href: `world.html?id=${w.id}` },
      [
        el("div", { class: "world-id", text: w.code || w.id }),
        el("h3", { text: w.title }),
        el("p", { text: w.summary || w.tagline || "" }),
        el("div", { class: "world-meta" }, [
          el("span", { text: metaRight }),
          el("span", { text: `更新于 ${w.updatedAt || "—"}` }),
        ]),
      ]
    );
    container.appendChild(card);
  });
}

/* ---------- 世界观 / 地点栏目详情页 ---------- */
function renderWorldDetail() {
  const id = qsParam("id");
  const world = worldById(id);
  const root = document.getElementById("world-root");
  if (!world) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "没有找到这个栏目" }),
        el("div", { text: "检查一下链接里的 id，或者回首页看看。" }),
      ])
    );
    return;
  }

  document.title = `${world.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [el("a", { href: "index.html", text: "首页" }), " / ", world.title])
  );

  // 统一展示：大banner + 简介，主世界观（cosmos-mythos）额外带插图
  const bannerChildren = [
    el("div", { class: "world-banner-eyebrow", text: world.code || "" }),
    el("h1", { text: world.title }),
  ];
  if (world.illustration) {
    bannerChildren.push(el("img", { class: "world-banner-illustration", src: world.illustration, alt: world.title }));
  }
  bannerChildren.push(el("p", { text: world.summary }));
  if (world.illustrationCredit) {
    bannerChildren.push(el("div", { class: "world-banner-credit", text: world.illustrationCredit }));
  }
  root.appendChild(el("div", { class: "world-banner cosmic-block" }, bannerChildren));
}

/* ---------- 角色档案页（按故事线分组） ---------- */
function renderCharacterArchive(container) {
  if (CHARACTERS.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "还没有角色" }),
        el("div", { text: "去 js/data.js 的 CHARACTERS 数组里添加，storyArcId 填对应故事线的 id。" }),
      ])
    );
    return;
  }
  STORY_ARCS.forEach((arc) => {
    const chars = charsOfArc(arc.id);
    if (chars.length === 0) return;
    const section = el("div", { class: "arc-section" });
    section.appendChild(
      el("div", { class: "arc-section-header" }, [
        el("h2", { text: arc.title }),
        el("p", { text: arc.tagline || "" }),
      ])
    );
    const grid = el("div", { class: "char-grid" });
    chars.forEach((c) => {
      grid.appendChild(
        el("a", { class: "char-card cosmic-block", href: `character.html?id=${c.id}` }, [
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
    section.appendChild(grid);
    container.appendChild(section);
  });

  const orphans = CHARACTERS.filter((c) => !arcById(c.storyArcId));
  if (orphans.length) {
    const section = el("div", { class: "arc-section" });
    section.appendChild(el("div", { class: "arc-section-header" }, [el("h2", { text: "未分类" })]));
    const grid = el("div", { class: "char-grid" });
    orphans.forEach((c) => {
      grid.appendChild(
        el("a", { class: "char-card cosmic-block", href: `character.html?id=${c.id}` }, [
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
    section.appendChild(grid);
    container.appendChild(section);
  }
}

/* ---------- 角色关系图页（每条故事线各一张图） ---------- */
function renderRelationsPage(container) {
  if (STORY_ARCS.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "还没有故事线" })])
    );
    return;
  }
  STORY_ARCS.forEach((arc) => {
    const chars = charsOfArc(arc.id);
    if (chars.length === 0) return;
    const section = el("div", { class: "arc-section" });
    section.appendChild(el("div", { class: "arc-section-header" }, [el("h2", { text: arc.title })]));
    renderRelationGraph(section, chars, relationsOfArc(arc.id));
    container.appendChild(section);
  });
}

/* ---------- 故事目录页：按故事线列出卡片，点进去到 arc.html ---------- */
function renderStoryArcCatalog(container) {
  if (STORY_ARCS.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "还没有故事线" }),
        el("div", { text: "去 js/data.js 的 STORY_ARCS 数组里添加一条记录即可。" }),
      ])
    );
    return;
  }
  const grid = el("div", { class: "arc-story-intros" });
  STORY_ARCS.forEach((arc) => {
    const count = storiesOfArc(arc.id).length;
    const charCount = charsOfArc(arc.id).length;
    grid.appendChild(
      el("a", { class: "world-card cosmic-block" + (arc.placeholder ? " world-card-placeholder" : ""), href: `arc.html?id=${arc.id}` }, [
        el("div", { class: "world-id", text: arc.code || arc.id }),
        el("h3", { text: arc.title }),
        el("p", { text: arc.summary || arc.tagline || "" }),
        el("div", { class: "world-meta" }, [
          el("span", { text: `${charCount} 位角色 · ${count} 篇故事` }),
          el("span", { text: `更新于 ${arc.updatedAt || "—"}` }),
        ]),
      ])
    );
  });
  container.appendChild(grid);
}

/* ---------- 故事线详情页（banner + 三个分类入口） ---------- */
function renderArcDetail() {
  const id = qsParam("id");
  const arc = arcById(id);
  const root = document.getElementById("arc-root");
  if (!arc) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "没有找到这条故事线" }),
      ])
    );
    return;
  }
  document.title = `${arc.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [el("a", { href: "index.html", text: "首页" }), " / ", el("a", { href: "stories.html", text: "故事" }), " / ", arc.title])
  );

  root.appendChild(
    el("div", { class: "world-banner cosmic-block" }, [
      el("div", { class: "world-banner-eyebrow", text: arc.code || "" }),
      el("h1", { text: arc.title }),
      el("p", { text: arc.summary }),
    ])
  );

  const chars = charsOfArc(arc.id);
  const relations = relationsOfArc(arc.id);
  const stories = storiesOfArc(arc.id);
  root.appendChild(
    el("div", { class: "category-nav" }, [
      el("a", { class: "category-btn cosmic-block", href: `arc-characters.html?id=${arc.id}` }, [
        el("span", { class: "category-btn-title", text: "角色档案" }),
        el("span", { class: "category-btn-desc", text: `${chars.length} 位角色` }),
      ]),
      el("a", { class: "category-btn cosmic-block", href: `arc-relations.html?id=${arc.id}` }, [
        el("span", { class: "category-btn-title", text: "角色关系" }),
        el("span", { class: "category-btn-desc", text: `${relations.length} 条关系` }),
      ]),
      el("a", { class: "category-btn cosmic-block", href: `arc-stories.html?id=${arc.id}` }, [
        el("span", { class: "category-btn-title", text: "短打 / 故事" }),
        el("span", { class: "category-btn-desc", text: `${stories.length} 篇` }),
      ]),
    ])
  );
}

/* ---------- 故事线专属：角色档案子页 ---------- */
function renderArcCharacters() {
  const id = qsParam("id");
  const arc = arcById(id);
  const root = document.getElementById("arc-characters-root");
  if (!arc) {
    root.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "没有找到这条故事线" })]));
    return;
  }
  document.title = `角色档案 · ${arc.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }), " / ",
      el("a", { href: "stories.html", text: "故事" }), " / ",
      el("a", { href: `arc.html?id=${arc.id}`, text: arc.title }), " / ",
      "角色档案",
    ])
  );
  const chars = charsOfArc(arc.id);
  if (chars.length === 0) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "这条故事线还没有角色" }),
        el("div", { text: "去 js/data.js 的 CHARACTERS 数组里添加，storyArcId 填这条故事线的 id。" }),
      ])
    );
    return;
  }
  const grid = el("div", { class: "char-grid" });
  chars.forEach((c) => {
    grid.appendChild(
      el("a", { class: "char-card cosmic-block", href: `character.html?id=${c.id}` }, [
        el("div", { class: "char-portrait" }, c.portrait ? el("img", { src: c.portrait, alt: c.name }) : "肖像占位"),
        el("div", { class: "char-info" }, [
          el("div", { class: "char-name", text: c.name }),
          el("div", { class: "char-role", text: c.role || "" }),
        ]),
      ])
    );
  });
  root.appendChild(grid);
}

/* ---------- 故事线专属：角色关系图子页 ---------- */
function renderArcRelations() {
  const id = qsParam("id");
  const arc = arcById(id);
  const root = document.getElementById("arc-relations-root");
  if (!arc) {
    root.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "没有找到这条故事线" })]));
    return;
  }
  document.title = `角色关系 · ${arc.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }), " / ",
      el("a", { href: "stories.html", text: "故事" }), " / ",
      el("a", { href: `arc.html?id=${arc.id}`, text: arc.title }), " / ",
      "角色关系",
    ])
  );
  renderRelationGraph(root, charsOfArc(arc.id), relationsOfArc(arc.id));
}

/* ---------- 故事线专属：短打/故事子页 ---------- */
function renderArcStories() {
  const id = qsParam("id");
  const arc = arcById(id);
  const root = document.getElementById("arc-stories-root");
  if (!arc) {
    root.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "没有找到这条故事线" })]));
    return;
  }
  document.title = `故事 · ${arc.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }), " / ",
      el("a", { href: "stories.html", text: "故事" }), " / ",
      el("a", { href: `arc.html?id=${arc.id}`, text: arc.title }), " / ",
      "短打 / 故事",
    ])
  );
  const stories = storiesOfArc(arc.id);
  if (stories.length === 0) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "这条故事线还没有故事" }),
        el("div", { text: "去 js/data.js 的 STORIES 数组里添加，storyArcId 填这条故事线的 id。" }),
      ])
    );
    return;
  }
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
  root.appendChild(list);
}

/* ---------- 角色关系图（简单力导向占位版：固定圆形布局 + 可拖拽） ---------- */
function renderRelationGraph(container, chars, relations) {
  if (!chars || chars.length === 0) {
    container.appendChild(
      el("div", { class: "empty-state" }, [
        el("div", { class: "empty-title", text: "暂无角色，无法生成关系图" }),
      ])
    );
    return;
  }

  const wrap = el("div", { class: "relation-canvas-wrap" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "relation-svg-" + Math.random().toString(36).slice(2));
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
      el("div", { class: "dot" }, c.portrait ? el("img", { src: c.portrait, alt: c.name }) : c.name.slice(0, 1)),
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
  const arc = arcById(c.storyArcId);
  document.title = `${c.name} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }),
      " / ",
      world ? el("a", { href: `world.html?id=${world.id}`, text: world.title }) : "未知世界观",
      " / ",
      arc ? el("a", { href: `arc.html?id=${arc.id}`, text: arc.title }) : "未分类",
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

  if (c.gallery && c.gallery.length) {
    root.appendChild(
      el("div", { class: "section-block" }, [
        el("h2", { text: "更多立绘" }),
        el(
          "div",
          { class: "char-gallery" },
          c.gallery.map((src) => el("a", { href: src, target: "_blank", class: "char-gallery-item" }, el("img", { src, alt: c.name })))
        ),
      ])
    );
  }

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
  const related = STORIES.filter((s) => s.storyArcId === c.storyArcId);
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
  const arc = arcById(s.storyArcId);
  document.title = `${s.title} · ${SITE.name}`;
  document.getElementById("breadcrumb").appendChild(
    el("span", {}, [
      el("a", { href: "index.html", text: "首页" }),
      " / ",
      arc ? el("a", { href: `arc.html?id=${arc.id}`, text: arc.title }) : el("a", { href: "drabbles.html", text: "短打" }),
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
document.addEventListener("DOMContentLoaded", renderStarfield);
