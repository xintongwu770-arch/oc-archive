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
function isRosterVisible(c) { return c && !c.hiddenFromRoster; }
function charsOfArc(arcId) { return CHARACTERS.filter((c) => c.storyArcId === arcId && isRosterVisible(c)); }
function relationsOfArc(arcId) { return RELATIONS.filter((r) => r.storyArcId === arcId && isRosterVisible(charById(r.from)) && isRosterVisible(charById(r.to))); }
function storiesOfArc(arcId) { return STORIES.filter((s) => s.storyArcId === arcId); }
function factionOfArc(arcId) {
  return ({
    "modern-cities": "diamond", "shaxia-prequel": "heart",
    "tangled-consequences": "diamond", "reincarnation-academy": "cosmic",
    "resurrection-horror": "spade", "demon-hunter": "club",
    "demon-company": "ocean", "red-heart-corporate": "heart",
    "parallel-world-story": "cosmic"
  })[arcId] || "cosmic";
}
const FACTION_ART = {
  cosmic: "images/cosmos-illustration.jpg",
  spade: "images/city-spade-v1.png",
  diamond: "images/city-diamond-v1.png",
  heart: "images/city-heart-v1.png",
  club: "images/city-club-v1.png",
  ocean: "images/ocean-v1.png",
};
function factionArtUrl(key) { return new URL(FACTION_ART[key] || FACTION_ART.cosmic, location.href).href; }
function arcArtUrl(arcId) {
  const arc = arcById(arcId);
  return new URL(arc?.illustration || FACTION_ART[factionOfArc(arcId)] || FACTION_ART.cosmic, location.href).href;
}

/* ---------- 站点头部信息（每个页面都会调用） ---------- */
function applySiteHeader() {
  document.querySelectorAll("[data-site-name]").forEach((n) => (n.textContent = SITE.name));
  document.querySelectorAll("[data-site-subtitle]").forEach((n) => (n.textContent = SITE.subtitle));
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".topnav nav a").forEach((link) => {
    const target = new URL(link.href, location.href).pathname.split("/").pop();
    const groups = {
      "character.html": "characters.html", "arc-characters.html": "characters.html",
      "story.html": "stories.html", "arc.html": "stories.html", "arc-stories.html": "stories.html",
      "arc-relations.html": "relations.html", "world.html": "index.html"
    };
    link.classList.toggle("active", target === (groups[current] || current));
  });
}

function renderFactionMenu() {
  const page = location.pathname.split("/").pop() || "index.html";
  if (!["characters.html", "stories.html", "relations.html"].includes(page)) return;
  const currentFaction = qsParam("faction") || "all";
  const labels = [
    ["all", "全部档案", "cosmic"], ["diamond", "方片市", "diamond"],
    ["heart", "红桃市 / 学校", "heart"], ["club", "草花市", "club"],
    ["spade", "黑桃市", "spade"], ["ocean", "海洋 / 恶魔公司", "ocean"],
  ];
  const menu = el("nav", { class: "faction-menu", "aria-label": "按阵营浏览" });
  labels.forEach(([value, label, artKey]) => {
    const href = value === "all" ? page : `${page}?faction=${value}`;
    const link = el("a", {
      class: `faction-menu-item${currentFaction === value ? " active" : ""}`,
      href,
      "aria-current": currentFaction === value ? "page" : "false",
    }, [el("span", { text: label }), el("small", { text: value === "all" ? "ALL FILES" : value.toUpperCase() })]);
    link.style.setProperty("--menu-art", `url('${factionArtUrl(artKey)}')`);
    menu.appendChild(link);
  });
  const anchor = document.querySelector(".hero") || document.querySelector(".topnav");
  anchor?.insertAdjacentElement("afterend", menu);
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
        el("p", w.taglineHtml ? { html: w.taglineHtml } : { text: w.tagline || "" }),
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

  const isCity = Boolean(world.illustration);
  if (isCity) document.body.classList.add("city-world-page");

  // 所有世界观与地区共用沉浸式全屏封面。
  const bannerChildren = [
    el("div", { class: "world-banner-eyebrow", text: world.code || "" }),
    el("h1", { text: world.title }),
  ];
  if (world.illustration) {
    bannerChildren.push(el("img", { class: "world-banner-illustration", src: world.illustration, alt: world.title, decoding: "async" }));
  }
  bannerChildren.push(el("p", { text: world.summary }));
  if (world.illustrationCredit) {
    bannerChildren.push(el("div", { class: "world-banner-credit", text: world.illustrationCredit }));
  }
  if (isCity) bannerChildren.push(el("span", { class: "city-cover-scroll", text: "SCROLL / EXPLORE" }));
  const banner = el("div", { class: `world-banner${isCity ? " city-cover" : ""} cosmic-block` }, bannerChildren);
  if (isCity) banner.style.setProperty("--city-art", `url('${new URL(world.illustration, location.href).href}')`);
  root.appendChild(banner);
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
  const selectedFaction = qsParam("faction");
  STORY_ARCS.forEach((arc) => {
    if (selectedFaction && factionOfArc(arc.id) !== selectedFaction) return;
    const chars = charsOfArc(arc.id);
    if (chars.length === 0) return;
    const faction = factionOfArc(arc.id);
    const section = el("section", { id: `arc-${arc.id}`, class: `arc-section faction-${faction}` });
    section.style.setProperty("--arc-art", `url('${arcArtUrl(arc.id)}')`);
    section.appendChild(
      el("div", { class: "arc-section-header" }, [
        el("h2", { text: arc.title }),
        el("p", arc.taglineHtml ? { html: arc.taglineHtml } : { text: arc.tagline || "" }),
      ])
    );
    const grid = el("div", { class: "char-grid" });
    chars.forEach((c) => {
      grid.appendChild(
        el("a", { class: "char-card cosmic-block", href: `character.html?id=${c.id}` }, [
          el(
            "div",
            { class: `char-portrait${c.portrait?.includes("approved-") ? " approved-portrait" : ""}` },
            c.portrait ? el("img", { src: c.portrait, alt: c.name, loading: "lazy", decoding: "async" }) : "肖像占位"
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
            { class: `char-portrait${c.portrait?.includes("approved-") ? " approved-portrait" : ""}` },
            c.portrait ? el("img", { src: c.portrait, alt: c.name, loading: "lazy", decoding: "async" }) : "肖像占位"
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
  const selectedFaction = qsParam("faction");
  STORY_ARCS.forEach((arc) => {
    if (selectedFaction && factionOfArc(arc.id) !== selectedFaction) return;
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
  const selectedFaction = qsParam("faction");
  STORY_ARCS.forEach((arc) => {
    if (selectedFaction && factionOfArc(arc.id) !== selectedFaction) return;
    const count = storiesOfArc(arc.id).length;
    const charCount = charsOfArc(arc.id).length;
    const card = el("a", { class: `world-card arc-catalog-card faction-${factionOfArc(arc.id)} cosmic-block${arc.placeholder ? " world-card-placeholder" : ""}`, href: `arc.html?id=${arc.id}` }, [
        el("div", { class: "world-id", text: arc.code || arc.id }),
        el("h3", { text: arc.title }),
        el("p", arc.taglineHtml ? { html: arc.taglineHtml } : { text: arc.tagline || "" }),
        el("div", { class: "world-meta" }, [
          el("span", { text: `${charCount} 位角色 · ${count} 篇故事` }),
          el("span", { text: `更新于 ${arc.updatedAt || "—"}` }),
        ]),
      ]);
    card.style.setProperty("--arc-art", `url('${arcArtUrl(arc.id)}')`);
    grid.appendChild(card);
  });
  container.appendChild(grid);

  const mainStories = STORIES.filter((story) => story.type === "主线");
  if (mainStories.length) {
    const list = el("div", { class: "story-list main-story-list" });
    mainStories.forEach((story) => {
      const arc = arcById(story.storyArcId);
      list.appendChild(el("a", { class: "story-item", href: `story.html?id=${story.id}` }, [
        el("span", { class: "story-type", text: "主线" }),
        el("span", { class: "story-title", text: story.title }),
        el("span", { class: "story-arc", text: arc?.title || "未分类" }),
        story.excerpt ? el("p", { class: "story-preview", text: story.excerpt }) : null,
      ]));
    });
    container.appendChild(el("section", { class: "main-story-index" }, [
      el("div", { class: "section-heading" }, [
        el("div", {}, [el("div", { class: "micro-label", text: "MAIN NARRATIVE" }), el("h2", { text: "现有主线正文" })]),
        el("p", { text: `${mainStories.length} 篇已完成正文，按所属故事线归档。` }),
      ]),
      list,
    ]));
  }
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
        el("span", { class: "category-btn-title", text: "剧情文章" }),
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
        el("div", { class: `char-portrait${c.portrait?.includes("approved-") ? " approved-portrait" : ""}` }, c.portrait ? el("img", { src: c.portrait, alt: c.name, loading: "lazy", decoding: "async" }) : "肖像占位"),
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
      "剧情文章",
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

/* ---------- 角色关系图 ---------- */
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
  const stage = el("div", { class: "relation-stage" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "relation-svg-" + Math.random().toString(36).slice(2));
  svg.setAttribute("aria-hidden", "true");
  stage.appendChild(svg);
  wrap.appendChild(stage);
  container.appendChild(wrap);
  const relationIndex = el("div", { class: "relation-index", "aria-label": "关系索引" });
  container.appendChild(relationIndex);
  container.appendChild(el("div", { class: "relation-hint", text: "拖动头像可重新排列 · 点击头像进入角色档案 · 悬停或聚焦以查看关联" }));

  const positions = {};
  const cx = 50, cy = 48, radiusX = chars.length <= 4 ? 31 : 38, radiusY = chars.length <= 4 ? 29 : 35;
  chars.forEach((c, i) => {
    const angle = chars.length === 1 ? 0 : (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    positions[c.id] = {
      x: chars.length === 1 ? cx : cx + radiusX * Math.cos(angle),
      y: chars.length === 1 ? cy : cy + radiusY * Math.sin(angle),
    };
  });

  function draw() {
    svg.innerHTML = "";
    relations.forEach((rel, index) => {
      const a = positions[rel.from], b = positions[rel.to];
      if (!a || !b) return;
      const rect = stage.getBoundingClientRect();
      const x1 = a.x / 100 * rect.width, y1 = a.y / 100 * rect.height;
      const x2 = b.x / 100 * rect.width, y2 = b.y / 100 * rect.height;
      const bend = Math.min(54, Math.hypot(x2 - x1, y2 - y1) * .13) * (index % 2 ? -1 : 1);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      const cx1 = mx - (y2 - y1) / length * bend, cy1 = my + (x2 - x1) / length * bend;
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", `M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`);
      path.setAttribute("class", "relation-edge");
      path.dataset.from = rel.from;
      path.dataset.to = rel.to;
      path.dataset.relation = index;
      svg.appendChild(path);

      const badge = document.createElementNS(svg.namespaceURI, "circle");
      badge.setAttribute("cx", cx1);
      badge.setAttribute("cy", cy1);
      badge.setAttribute("r", "12");
      badge.setAttribute("class", "relation-edge-badge");
      badge.dataset.from = rel.from;
      badge.dataset.to = rel.to;
      badge.dataset.relation = index;
      svg.appendChild(badge);
      const text = document.createElementNS(svg.namespaceURI, "text");
      text.setAttribute("x", cx1);
      text.setAttribute("y", cy1 + 3.5);
      text.setAttribute("class", "relation-edge-label");
      text.setAttribute("text-anchor", "middle");
      text.dataset.from = rel.from;
      text.dataset.to = rel.to;
      text.dataset.relation = index;
      text.textContent = String(index + 1).padStart(2, "0");
      svg.appendChild(text);
    });
  }

  function focusCharacter(id) {
    stage.querySelectorAll(".relation-node").forEach((node) => node.classList.toggle("is-muted", id && node.dataset.id !== id && !relations.some((rel) => (rel.from === id && rel.to === node.dataset.id) || (rel.to === id && rel.from === node.dataset.id))));
    stage.querySelectorAll("[data-from]").forEach((edge) => edge.classList.toggle("is-muted", id && edge.dataset.from !== id && edge.dataset.to !== id));
    relationIndex.querySelectorAll(".relation-record").forEach((record) => record.classList.toggle("is-muted", id && record.dataset.from !== id && record.dataset.to !== id));
  }

  chars.forEach((c) => {
    const node = el("a", {
      class: "relation-node",
      href: `character.html?id=${c.id}`,
      style: `left:${positions[c.id].x}%; top:${positions[c.id].y}%`,
      "data-id": c.id,
    }, [
      el("div", { class: "dot" }, c.portrait ? el("img", { src: c.portrait, alt: "", loading: "lazy", decoding: "async" }) : c.name.slice(0, 1)),
      el("div", { class: "label" }, [el("strong", { text: c.name }), el("span", { text: c.role || "档案待补" })]),
    ]);

    let dragging = false;
    let moved = false;
    node.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      node.setPointerCapture?.(e.pointerId);
      node.style.cursor = "grabbing";
      e.preventDefault();
    });
    node.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      moved = true;
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      positions[c.id] = { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
      node.style.left = positions[c.id].x + "%";
      node.style.top = positions[c.id].y + "%";
      draw();
    });
    node.addEventListener("pointerup", () => {
      dragging = false;
      node.style.cursor = "grab";
    });
    node.addEventListener("pointercancel", () => { dragging = false; node.style.cursor = "grab"; });
    node.addEventListener("click", (e) => { if (moved) e.preventDefault(); });
    node.addEventListener("mouseenter", () => focusCharacter(c.id));
    node.addEventListener("mouseleave", () => focusCharacter(null));
    node.addEventListener("focus", () => focusCharacter(c.id));
    node.addEventListener("blur", () => focusCharacter(null));

    stage.appendChild(node);
  });

  if (relations.length) {
    relations.forEach((rel, index) => {
      const from = charById(rel.from), to = charById(rel.to);
      if (!from || !to) return;
      const record = el("article", { class: "relation-record", tabindex: "0", "data-from": rel.from, "data-to": rel.to }, [
        el("span", { class: "relation-record-no", text: String(index + 1).padStart(2, "0") }),
        el("div", { class: "relation-record-pair" }, [
          el("img", { src: from.portrait, alt: "", loading: "lazy", decoding: "async" }),
          el("span", { text: from.name }),
          el("i", { text: "×" }),
          el("img", { src: to.portrait, alt: "", loading: "lazy", decoding: "async" }),
          el("span", { text: to.name }),
        ]),
        el("p", { text: rel.label || "关系档案待补" }),
      ]);
      const focus = () => {
        focusCharacter(null);
        stage.querySelectorAll(`[data-relation="${index}"]`).forEach((edge) => edge.classList.add("is-active"));
        record.classList.add("is-active");
      };
      const clear = () => {
        stage.querySelectorAll(`[data-relation="${index}"]`).forEach((edge) => edge.classList.remove("is-active"));
        record.classList.remove("is-active");
      };
      record.addEventListener("mouseenter", focus);
      record.addEventListener("mouseleave", clear);
      record.addEventListener("focus", focus);
      record.addEventListener("blur", clear);
      relationIndex.appendChild(record);
    });
  } else {
    relationIndex.appendChild(el("div", { class: "empty-state" }, [el("div", { class: "empty-title", text: "关系档案尚未建立" })]));
  }

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
      { class: `char-detail-portrait${c.portrait?.includes("approved-") ? " approved-portrait" : ""}` },
      c.portrait ? el("img", { src: c.portrait, alt: c.name, decoding: "async" }) : "肖像占位"
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
          c.gallery.map((src) => el("a", { href: src, target: "_blank", class: "char-gallery-item" }, el("img", { src, alt: c.name, loading: "lazy", decoding: "async" })))
        ),
      ])
    );
  }

  if (c.bio) {
    root.appendChild(
      el("div", { class: "section-block" }, [
        el("h2", { text: "简介" }),
        el(
          "div",
          { class: "char-bio" },
          c.bio.split(/\n{2,}/).map((paragraph) => renderCharacterBioParagraph(c, paragraph))
        ),
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

function renderCharacterBioParagraph(character, paragraph) {
  const hiddenLinks = {
    "su-fusheng": ["[[GALATEA]]", "galatea"],
    dora: ["[[PANDORAGON]]", "pandoragon"],
  };
  const [token, targetId] = hiddenLinks[character.id] || [];
  if (!token || !paragraph.includes(token)) {
    return el("p", { text: paragraph });
  }
  const hidden = charById(targetId);
  const [before, after] = paragraph.split(token);
  const redaction = el("button", {
    class: "redacted-entity",
    type: "button",
    title: "读取被遮蔽的档案",
    "aria-label": `打开被遮蔽的${hidden?.name || "角色"}档案`,
  }, Array.from({ length: 4 }, () => el("span", { "aria-hidden": "true" })));
  redaction.addEventListener("click", () => openHiddenCharacter(targetId));
  return el("p", {}, [before, redaction, after]);
}

function openHiddenCharacter(id) {
  const hidden = charById(id);
  if (!hidden) return;
  const dialog = el("dialog", { class: "hidden-character-dialog" });
  const close = el("button", { class: "hidden-character-close", type: "button", text: "关闭档案", "aria-label": `关闭${hidden.name}档案` });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove());
  dialog.appendChild(el("article", { class: "hidden-character-window" }, [
    close,
    el("div", { class: "hidden-character-portrait" }, el("img", { src: hidden.portrait, alt: hidden.name, decoding: "async" })),
    el("div", { class: "hidden-character-content" }, [
      el("div", { class: "micro-label", text: "REDACTED / CREATION RECORD" }),
      el("h2", { text: hidden.name }),
      el("p", { class: "hidden-character-role", text: hidden.role }),
      el("dl", { class: "kv-list" }, (hidden.quickFacts || []).flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
      el("div", { class: "char-bio" }, (hidden.bio || "").split(/\n{2,}/).map((text) => el("p", { text }))),
    ]),
  ]));
  document.body.appendChild(dialog);
  dialog.showModal();
  close.focus();
}

/* ---------- 故事详情页 ---------- */
async function renderStoryDetail() {
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

  document.body.classList.add("story-reading-page");
  let content = s.content || s.excerpt || "";
  if (s.source) {
    try {
      const response = await fetch(s.source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      content = (await response.text())
        .replace(/^\uFEFF/, "")
        .replace(/^# .*\r?\n+/, "")
        .replace(/^(?:材料性质|状态)：.*\r?\n+/, "")
        .replace(/^---\r?\n+/, "")
        .trim();
    } catch (error) {
      console.error(`无法载入正文：${s.source}`, error);
    }
  }
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  root.appendChild(el("article", { class: "story-reader" }, [
    el("header", { class: "story-reader-header" }, [
      el("div", { class: "story-reader-meta" }, [
        el("span", { class: "tag", text: s.type }),
        el("time", { text: s.date || "" }),
      ]),
      el("h1", { text: s.title }),
      s.excerpt ? el("p", { class: "story-deck", text: s.excerpt }) : null,
    ]),
    el("div", { class: "prose story-prose" }, paragraphs.map((paragraph) => el("p", { text: paragraph }))),
  ]));
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
document.addEventListener("DOMContentLoaded", renderFactionMenu);

/* ---------- 全站阵营主题与电影式页面过渡 ---------- */
function applyArchiveTheme() {
  const page = location.pathname.split("/").pop() || "index.html";
  const id = qsParam("id");
  let theme = "cosmic";
  let artUrl = factionArtUrl(theme);
  if (page === "world.html") theme = worldById(id)?.theme || "cosmic";
  if (["characters.html", "stories.html", "relations.html"].includes(page)) theme = qsParam("faction") || "cosmic";
  if (page.startsWith("arc")) {
    theme = factionOfArc(id);
    artUrl = arcArtUrl(id);
  }
  if (page === "character.html") {
    const character = charById(id);
    theme = factionOfArc(character?.storyArcId);
    artUrl = arcArtUrl(character?.storyArcId);
  }
  if (page === "story.html") {
    const arcId = STORIES.find((story) => story.id === id)?.storyArcId;
    theme = factionOfArc(arcId);
    artUrl = arcArtUrl(arcId);
  }
  if (!page.startsWith("arc") && page !== "character.html" && page !== "story.html") artUrl = factionArtUrl(theme);
  document.documentElement.dataset.faction = theme;
  document.documentElement.style.setProperty("--faction-art", `url('${artUrl}')`);
}

function initArchiveMotion() {
  const transition = el("div", { class: "archive-transition", "aria-hidden": "true" }, [
    el("i", { class: "archive-shard shard-a" }),
    el("i", { class: "archive-shard shard-b" }),
    el("i", { class: "archive-shard shard-c" }),
    el("span", { class: "archive-transition-line" }),
    el("span", { class: "archive-transition-mark" }),
  ]);
  document.body.appendChild(transition);
  requestAnimationFrame(() => transition.classList.add("entry-settled"));
  const resetTransition = () => {
    document.body.classList.remove("page-leaving");
    transition.classList.add("no-motion");
    transition.classList.remove("is-active");
    requestAnimationFrame(() => transition.classList.remove("no-motion"));
  };
  addEventListener("pageshow", resetTransition);
  requestAnimationFrame(() => document.body.classList.add("page-ready"));
  const updateScrollProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty("--scroll-progress", max > 0 ? Math.min(1, scrollY / max) : 0);
  };
  addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();

  const revealTargets = document.querySelectorAll(
    ".world-card, .char-card, .story-item, .section-block, .city-card, .cast-card, .world-banner, .category-btn, .relation-canvas-wrap"
  );
  revealTargets.forEach((node, index) => {
    node.classList.add("reveal-item");
    node.style.setProperty("--reveal-order", index % 6);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6%", threshold: 0.08 });
    revealTargets.forEach((node) => observer.observe(node));
  } else {
    revealTargets.forEach((node) => node.classList.add("is-revealed"));
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.hash || link.hasAttribute("download") || link.target === "_blank") return;
    if (document.body.classList.contains("page-leaving")) return;
    event.preventDefault();
    document.body.classList.add("page-leaving");
    transition.classList.add("is-active");
    window.setTimeout(() => { location.href = url.href; }, 620);
  });
}

document.addEventListener("DOMContentLoaded", applyArchiveTheme);
document.addEventListener("DOMContentLoaded", initArchiveMotion);
