import { collections, validate, publicData } from "./model.mjs";
const $ = (s) => document.querySelector(s),
  main = $("#main");
const clone = (x) => JSON.parse(JSON.stringify(x));
let data,
  draft,
  session = null,
  editing = false,
  previewing = false,
  query = "",
  saveQueue = Promise.resolve(),
  saveError = null;
const faction = {
  "reincarnation-academy": "cosmos-illustration.jpg",
  "modern-cities": "city-diamond-v1.png",
  "tangled-consequences": "city-diamond-v1.png",
  "demon-hunter": "city-club-v1.png",
  "resurrection-horror": "city-spade-v1.png",
  "demon-company": "demon-company-v1.png",
  "shaxia-prequel": "city-heart-v1.png",
  "red-heart-corporate": "city-heart-v1.png",
};
const names = {
  worlds: "世界与城市",
  arcs: "故事线",
  characters: "角色",
  stories: "文章",
  relations: "关系",
  events: "事件",
  artworks: "立绘",
};
const asset = (src) => {
  if (!src) return "";
  if (
    /^(images\/|preview\/media\/)[\w\-./\u4e00-\u9fff]+$/.test(src) &&
    !src.includes("..")
  )
    return new URL("../" + src, location.href).href;
  return "";
};
const E = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "text") n.textContent = v;
    else if (v != null) n.setAttribute(k, String(v));
  }
  children.flat(Infinity).forEach((c) => {
    if (c != null)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return n;
};
const btn = (text, fn, cls = "") =>
  E("button", { type: "button", class: cls, onclick: fn }, text);
const link = (text, href, cls = "") => E("a", { href, class: cls }, text);
const image = (src, alt, cls = "") =>
  E("img", { src: asset(src), alt, loading: "lazy", class: cls });
const vis = (x) =>
  x.visibility !== "private" && (x.visibility !== "reveal" || editing);
const belongs = (c, id) =>
  c.storyArcId === id || (c.storyArcIds || []).includes(id);
const route = () => location.hash.slice(1).split("/").map(decodeURIComponent);
const titleOf = (key, id) =>
  data[key].find((x) => x.id === id)?.name ||
  data[key].find((x) => x.id === id)?.title ||
  "未归档";
const arcArt = (id) =>
  data.arcs.find((a) => a.id === id)?.illustration ||
  "images/" + (faction[id] || "cosmos-illustration.jpg");
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
async function api(path, body) {
  const response = await fetch("../api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Studio-Token": session?.token || "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw Error(json.error || "请求失败");
  return json;
}
function save() {
  draft.updatedAt = new Date().toISOString();
  const snapshot = clone(draft);
  $("#notice").textContent = "正在保存到本机…";
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => api("draft", snapshot))
    .then(() => {
      saveError = null;
      $("#notice").textContent = "草稿已保存到本机 · 云端同步尚未连接";
    })
    .catch((e) => {
      saveError = e;
      $("#notice").textContent =
        "保存失败：" + e.message + "。请导出备份，勿关闭页面。";
    });
  return saveQueue;
}
function header(title, subtitle, actions = []) {
  return E(
    "div",
    { class: "page-head" },
    E(
      "div",
      {},
      E("span", { class: "eyebrow" }, "BLACK TIDE / ARCHIVE"),
      E("h1", {}, title),
      subtitle ? E("p", {}, subtitle) : null,
    ),
    E("div", { class: "actions" }, actions),
  );
}
function editButton(key, item) {
  return editing ? btn("编辑" + names[key], () => edit(key, item)) : null;
}
function addButton(key) {
  return editing
    ? btn("＋ 新建" + names[key], () => edit(key), "primary")
    : null;
}
function paragraph(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => E("p", {}, p));
}
function empty(text) {
  return E("div", { class: "empty" }, text);
}
function sidebar() {
  const current = route();
  $("#sidebar").replaceChildren(
    link("鱿鱼的世界", "#home", "brand"),
    E("div", { class: "side-sub" }, "THE LAST BLUE / OC ARCHIVE"),
    E("div", { class: "nav-group" }, "浏览档案"),
    ...[
      ["home", "⌂", "首页"],
      ["worlds", "◇", "世界与城市"],
      ["characters", "◈", "角色档案"],
      ["arcs", "▤", "故事书架"],
      ["relations", "⌘", "人物关系"],
      ["timeline", "⌁", "剧情时间轴"],
      ["gallery", "▧", "立绘展柜"],
    ].map(([id, icon, label]) =>
      link(
        icon + "　" + label,
        "#" + id,
        "nav-link" + (current[0] === id ? " active" : ""),
      ),
    ),
    E("div", { class: "nav-group" }, "故事线"),
    ...data.arcs
      .filter(vis)
      .map((a) =>
        link(
          a.title,
          "#arc/" + a.id,
          "nav-link" + (current[1] === a.id ? " active" : ""),
        ),
      ),
    editing
      ? E(
          "div",
          {},
          E("div", { class: "nav-group" }, "作者空间"),
          link("草稿 · 发布 · 备份", "#workspace", "nav-link"),
        )
      : document.createTextNode(""),
  );
}
function characterCard(c) {
  return E(
    "a",
    { href: "#character/" + c.id, class: "card" },
    image(c.portrait, c.name),
    E(
      "div",
      { class: "card-copy" },
      E("h3", {}, c.name),
      E("p", {}, c.role),
      editing
        ? E(
            "span",
            { class: "tag" },
            { public: "公开", reveal: "点击揭示", private: "仅自己" }[
              c.visibility
            ],
          )
        : null,
    ),
  );
}
function bookCard(a) {
  return E(
    "a",
    { href: "#arc/" + a.id, class: "card book" },
    image(arcArt(a.id), ""),
    E(
      "div",
      {},
      E("span", { class: "eyebrow" }, a.code || "STORY"),
      E("h3", {}, a.title),
      E("p", {}, a.tagline),
    ),
  );
}
function selectArc(value, onchange, includeCross = false) {
  const s = E(
    "select",
    { "aria-label": "选择故事线", onchange: (e) => onchange(e.target.value) },
    E("option", { value: "" }, "全部故事线"),
    data.arcs.filter(vis).map((a) => E("option", { value: a.id }, a.title)),
    includeCross ? E("option", { value: "cross-arc" }, "跨故事线关系") : null,
  );
  s.value = value || "";
  return s;
}
function home() {
  main.append(
    E(
      "section",
      { class: "hero" },
      image("images/home-blue-divinity-v1.webp", "蓝色的人的剪影"),
      E(
        "div",
        { class: "hero-copy" },
        E("span", { class: "eyebrow" }, "欢迎观看鱿鱼的 OC"),
        E("h1", {}, "是我创造了你们，", E("br"), "还是你们构成了我？"),
        E(
          "p",
          {},
          "地球大危机了！剩下的人类建立起四座城市，以各自的方法应对污染。",
        ),
      ),
    ),
    E(
      "div",
      { class: "portal-row" },
      [
        ["01", "认识这个世界", "worlds", "四座城与海洋"],
        [
          "02",
          "认识角色",
          "characters",
          data.characters.filter(vis).length + " 位在册角色",
        ],
        ["03", "开始读故事", "arcs", data.arcs.length + " 条故事线"],
      ].map(([num, t, id, sub]) =>
        E(
          "a",
          { href: "#" + id, class: "portal" },
          E("span", { class: "eyebrow" }, num),
          E("strong", {}, t),
          E("small", {}, sub + " ↗"),
        ),
      ),
    ),
    E(
      "div",
      { class: "section-title" },
      E("h2", {}, "从一段故事开始"),
      link("全部故事 ↗", "#arcs"),
    ),
    E(
      "div",
      { class: "grid book-grid" },
      data.arcs.filter(vis).slice(0, 3).map(bookCard),
    ),
  );
}
function worlds() {
  main.append(
    header("世界与城市", "地球、四座城市，以及无人知晓的海洋。", [
      addButton("worlds"),
    ]),
    E(
      "div",
      { class: "grid book-grid" },
      data.worlds
        .filter((x) => editing || vis(x))
        .map((w) =>
          E(
            "a",
            { href: "#world/" + w.id, class: "card book" },
            image(w.illustration, ""),
            E(
              "div",
              {},
              E("small", {}, w.code),
              E("h3", {}, w.title),
              E("p", {}, w.tagline),
            ),
          ),
        ),
    ),
  );
}
function world(id) {
  const w = data.worlds.find((x) => x.id === id);
  if (!w) return missing();
  main.append(
    header(w.title, "", [editButton("worlds", w)]),
    E(
      "section",
      { class: "region" },
      image(w.illustration, ""),
      E("div", { class: "prose" }, paragraph(w.summary || w.tagline)),
    ),
  );
}
function characters(arc) {
  main.append(
    header("角色档案", "每一个名字，都有各自尚未说完的故事。", [
      addButton("characters"),
    ]),
    E(
      "div",
      { class: "filters" },
      selectArc(arc, (v) => (location.hash = "characters/" + v)),
    ),
    E(
      "div",
      { class: "grid" },
      data.characters
        .filter((c) => (editing || vis(c)) && (!arc || belongs(c, arc)))
        .map(characterCard),
    ),
  );
}
function sections(c) {
  return (c.sections || [])
    .filter((s) => editing || s.visibility !== "private")
    .map((s) => {
      const body = [
        paragraph((s.content || []).join("\n\n")),
        s.items
          ? E(
              "dl",
              { class: "facts" },
              s.items.map(([k, v]) => [E("dt", {}, k), E("dd", {}, v)]),
            )
          : null,
      ];
      return (s.classified || s.visibility === "reveal") && !editing
        ? E("details", {}, E("summary", {}, s.title + " · 点击揭示"), body)
        : E("section", {}, E("h2", {}, s.title), body);
    });
}
function character(id) {
  const c = data.characters.find((x) => x.id === id);
  if (!c) return missing();
  if (c.visibility === "private" && !editing) return missing();
  main.append(header(c.name, c.role, [editButton("characters", c)]));
  const detail = E(
    "div",
    { class: "portrait-layout" },
    E(
      "div",
      { class: "portrait-column" },
      image(c.portrait, c.name),
      E(
        "div",
        {},
        (c.traits || []).map((t) => E("span", { class: "tag" }, t)),
      ),
      E(
        "dl",
        { class: "facts" },
        (c.quickFacts || []).map(([k, v]) => [E("dt", {}, k), E("dd", {}, v)]),
      ),
    ),
    E(
      "div",
      { class: "prose" },
      E("small", {}, titleOf("arcs", c.storyArcId)),
      sections(c),
      c.sections?.length ? null : paragraph(c.bio),
      id === "su-fusheng"
        ? E(
            "p",
            {},
            "最后成为最适合被送给 ",
            link("■■■■", "#character/galatea"),
            " 的人类样本",
          )
        : null,
      id === "dora"
        ? E("p", {}, "真实身份：", link("■■■■", "#character/pandoragon"))
        : null,
    ),
  );
  if (c.visibility === "reveal" && !editing)
    main.append(
      E(
        "details",
        { class: "prose" },
        E("summary", {}, "■■■■ · 打开隐藏档案"),
        detail,
      ),
    );
  else main.append(detail);
  const art = data.artworks.filter(
    (a) => a.characterId === id && (editing || vis(a)),
  );
  if (art.length)
    main.append(
      E("div", { class: "section-title" }, E("h2", {}, "其他立绘")),
      artGrid(art),
    );
}
function arcs() {
  main.append(
    header("故事书架", "从这里进入主线、前传与平行世界。", [
      addButton("arcs"),
      addButton("stories"),
    ]),
    E(
      "div",
      { class: "grid book-grid" },
      data.arcs.filter((a) => editing || vis(a)).map(bookCard),
    ),
  );
}
function arc(id) {
  const a = data.arcs.find((x) => x.id === id);
  if (!a) return missing();
  main.append(
    header(a.title, a.tagline, [editButton("arcs", a)]),
    E(
      "section",
      { class: "region" },
      image(arcArt(id), ""),
      E("div", { class: "prose" }, paragraph(a.summary)),
    ),
    E(
      "div",
      { class: "section-title" },
      E("h2", {}, "故事中的人"),
      link("关系图 ↗", "#relations/" + id),
    ),
    E(
      "div",
      { class: "grid" },
      data.characters
        .filter((c) => belongs(c, id) && (editing || vis(c)))
        .map(characterCard),
    ),
    E(
      "div",
      { class: "section-title" },
      E("h2", {}, "正文与短篇"),
      addButton("stories"),
    ),
  );
  const stories = data.stories.filter(
    (s) => s.storyArcId === id && (editing || vis(s)),
  );
  main.append(
    stories.length
      ? E(
          "div",
          {},
          stories.map((s) =>
            E(
              "a",
              { class: "story-row", href: "#story/" + s.id },
              E("small", {}, s.type || "故事"),
              E("h3", {}, s.title),
              E("p", {}, s.excerpt),
            ),
          ),
        )
      : empty("这条故事线暂时没有公开正文。"),
  );
}
function story(id) {
  const s = data.stories.find((x) => x.id === id);
  if (!s) return missing();
  const article = E(
    "article",
    { class: "reader" },
    E("small", {}, titleOf("arcs", s.storyArcId)),
    E("h1", {}, s.title),
    paragraph(s.content),
  );
  main.append(
    E(
      "div",
      { class: "actions" },
      link("← 返回故事线", "#arc/" + s.storyArcId),
      editButton("stories", s),
    ),
  );
  main.append(
    s.visibility === "reveal" && !editing
      ? E("details", {}, E("summary", {}, "点击阅读含剧透的文章"), article)
      : article,
  );
}
function artGrid(items) {
  return E(
    "div",
    { class: "grid gallery" },
    items.map((a) =>
      E(
        "div",
        { class: "card" },
        E(
          "button",
          {
            type: "button",
            style: "padding:0;border:0;width:100%",
            onclick: () => {
              const d = $("#editor");
              $("#edit-form").replaceChildren(
                E(
                  "div",
                  { class: "form-head" },
                  E("h2", {}, a.title),
                  btn("关闭", () => d.close()),
                ),
                image(a.src, a.title, "image-detail"),
                E("p", {}, a.credit || "作者 / 来源尚未填写"),
                paragraph(a.notes),
                editButton("artworks", a),
              );
              d.showModal();
            },
          },
          image(a.src, a.title),
        ),
        E(
          "div",
          { class: "card-copy" },
          E("h3", {}, a.title),
          E("small", {}, titleOf("characters", a.characterId)),
        ),
      ),
    ),
  );
}
function gallery(id) {
  main.append(
    header("立绘展柜", "收藏角色的不同模样。", [addButton("artworks")]),
    artGrid(
      data.artworks.filter(
        (a) => (editing || vis(a)) && (!id || a.characterId === id),
      ),
    ),
  );
}
function relations(arcId = "cross-arc") {
  let connecting = false,
    first = null;
  const connect = btn("点选两人连线", () => {
    connecting = !connecting;
    first = null;
    connect.textContent = connecting ? "请选择第一个角色" : "点选两人连线";
  });
  main.append(
    header("人物关系", "拖动人物卡调整位置；双向关系的不同看法列在图下。", [
      editing ? connect : null,
      addButton("relations"),
    ]),
    E(
      "div",
      { class: "filters" },
      selectArc(
        arcId,
        (v) => (location.hash = "relations/" + (v || "cross-arc")),
        true,
      ),
    ),
  );
  const rel = data.relations.filter(
    (r) => r.storyArcId === arcId && (editing || vis(r)),
  );
  const ids = new Set(rel.flatMap((r) => [r.from, r.to]));
  if (arcId !== "cross-arc")
    data.characters
      .filter((c) => belongs(c, arcId) && (editing || vis(c)))
      .forEach((c) => ids.add(c.id));
  const chars = [...ids]
    .map((id) => data.characters.find((c) => c.id === id))
    .filter((c) => c && (editing || c.visibility !== "private"));
  if (!chars.length) {
    main.append(empty("这张关系板还没有人物关系。"));
    return;
  }
  const board = E("div", { class: "board" }),
    wrap = E(
      "div",
      {
        class: "board-wrap",
        tabindex: "0",
        "aria-label": "可横向滚动的人物关系板",
      },
      board,
    );
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  board.append(svg);
  const coords = {};
  chars.forEach(
    (c, i) =>
      (coords[c.id] = data.layouts?.[arcId]?.[c.id] || {
        x: 100 + Math.cos((i / chars.length) * Math.PI * 2) * 430 + 450,
        y: 280 + Math.sin((i / chars.length) * Math.PI * 2) * 250,
      }),
  );
  board.style.height =
    Math.max(760, Math.ceil(chars.length / 6) * 235 + 120) + "px";
  const lines = () => {
    svg.replaceChildren();
    rel.forEach((r, i) => {
      const a = coords[r.from],
        b = coords[r.to];
      if (!a || !b) return;
      const line = document.createElementNS(svg.namespaceURI, "line");
      Object.entries({
        x1: a.x + 55,
        y1: a.y + 55,
        x2: b.x + 55,
        y2: b.y + 55,
        stroke: "#9f9277",
        "stroke-width": 1.5,
      }).forEach(([k, v]) => line.setAttribute(k, v));
      svg.append(line);
      const label = document.createElementNS(svg.namespaceURI, "text");
      label.setAttribute("x", (a.x + b.x) / 2 + 55);
      label.setAttribute("y", (a.y + b.y) / 2 + 50);
      label.setAttribute("fill", "#e8d3a9");
      label.setAttribute("font-size", "13");
      label.textContent = String(i + 1);
      svg.append(label);
    });
  };
  lines();
  const choose = (c) => {
    if (!connecting) {
      location.hash = "character/" + c.id;
      return;
    }
    if (!first) {
      first = c.id;
      connect.textContent = "已选 " + c.name + "，再选一位";
      return;
    }
    if (first === c.id) return;
    edit("relations", {
      id: crypto.randomUUID(),
      from: first,
      to: c.id,
      storyArcId: arcId,
      label: "",
      visibility: "public",
      directed: true,
    });
    connecting = false;
    first = null;
  };
  chars.forEach((c) => {
    const n = E(
      "button",
      {
        class: "node",
        type: "button",
        "aria-label": c.name + "，方向键可移动；回车选择",
      },
      image(c.portrait, c.name),
      E("strong", {}, c.name),
    );
    const position = () => {
      n.style.left = coords[c.id].x + "px";
      n.style.top = coords[c.id].y + "px";
    };
    const persist = () => {
      if (editing) {
        draft.layouts[arcId] = clone(coords);
        save();
      }
    };
    position();
    let drag = null;
    n.addEventListener("pointerdown", (e) => {
      drag = {
        x: e.clientX,
        y: e.clientY,
        initial: { ...coords[c.id] },
        moved: false,
      };
      n.setPointerCapture(e.pointerId);
    });
    n.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      coords[c.id] = {
        x: Math.max(0, Math.min(1140, drag.initial.x + dx)),
        y: Math.max(
          0,
          Math.min(parseInt(board.style.height) - 145, drag.initial.y + dy),
        ),
      };
      position();
      lines();
    });
    n.addEventListener("pointerup", () => {
      if (drag?.moved) persist();
      else choose(c);
      drag = null;
    });
    n.addEventListener("pointercancel", () => (drag = null));
    n.addEventListener("keydown", (e) => {
      const steps = {
        ArrowLeft: [-10, 0],
        ArrowRight: [10, 0],
        ArrowUp: [0, -10],
        ArrowDown: [0, 10],
      };
      if (steps[e.key]) {
        e.preventDefault();
        const [dx, dy] = steps[e.key];
        coords[c.id].x = Math.max(0, Math.min(1140, coords[c.id].x + dx));
        coords[c.id].y = Math.max(0, coords[c.id].y + dy);
        position();
        lines();
        persist();
      }
      if (e.key === "Enter") choose(c);
    });
    board.append(n);
  });
  main.append(
    wrap,
    E(
      "div",
      { class: "relation-list" },
      rel.map((r, i) =>
        E(
          "article",
          { class: "relation" },
          E("small", {}, "关系 " + (i + 1)),
          E(
            "strong",
            {},
            "　" +
              titleOf("characters", r.from) +
              (r.directed ? " → " : " ↔ ") +
              titleOf("characters", r.to),
          ),
          E("p", {}, r.label),
          r.reverseLabel
            ? E("p", {}, titleOf("characters", r.to) + " → " + r.reverseLabel)
            : null,
          editButton("relations", r),
        ),
      ),
    ),
  );
}
function timeline(arcId) {
  main.append(
    header(
      "剧情时间轴",
      "记录已经确认的日期、时期或先后顺序。各故事独立排列。",
      [addButton("events")],
    ),
    E(
      "div",
      { class: "filters" },
      selectArc(arcId, (v) => (location.hash = "timeline/" + v)),
    ),
  );
  const arcs = data.arcs.filter((a) => !arcId || a.id === arcId);
  let count = 0;
  for (const a of arcs) {
    const branches = [
      ...new Set(
        data.events
          .filter((e) => e.storyArcId === a.id)
          .map((e) => e.branch || "主线"),
      ),
    ];
    for (const branch of branches) {
      const events = data.events
        .filter(
          (e) =>
            e.storyArcId === a.id &&
            (e.branch || "主线") === branch &&
            (editing || e.visibility !== "private"),
        )
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      if (!events.length) continue;
      count += events.length;
      main.append(
        E("h2", {}, a.title + " · " + branch),
        E(
          "div",
          { class: "timeline" },
          events.map((e) =>
            E(
              "article",
              { class: "event" },
              E(
                "small",
                {},
                { date: "日期", period: "时期", order: "顺序" }[e.timeType] +
                  " · " +
                  (e.timeLabel || "未定") +
                  " / " +
                  (e.branch || "主线"),
              ),
              E("h3", {}, e.title),
              e.visibility === "reveal" && !editing
                ? E(
                    "details",
                    {},
                    E("summary", {}, "点击查看剧透"),
                    paragraph(e.description),
                  )
                : paragraph(e.description),
              editButton("events", e),
            ),
          ),
        ),
      );
    }
  }
  if (!count)
    main.append(
      empty(
        "还没有录入时间事件。原资料的文章日期是发布日，未擅自当成剧情日期；可在作者工作台新增事件。",
      ),
    );
}
function search() {
  main.append(header("搜索档案", "搜索：" + query));
  let count = 0;
  for (const key of ["characters", "arcs", "worlds", "stories"]) {
    const found = data[key].filter(
      (x) =>
        (editing || vis(x)) &&
        JSON.stringify(x).toLowerCase().includes(query.toLowerCase()),
    );
    if (!found.length) continue;
    count += found.length;
    main.append(
      E("h2", {}, names[key]),
      E(
        "div",
        {},
        found.map((x) =>
          E(
            "a",
            {
              class: "story-row",
              href:
                "#" +
                {
                  characters: "character",
                  arcs: "arc",
                  worlds: "world",
                  stories: "story",
                }[key] +
                "/" +
                x.id,
            },
            E("h3", {}, x.name || x.title),
            E("p", {}, x.role || x.tagline || x.excerpt),
          ),
        ),
      ),
    );
  }
  if (!count) main.append(empty("没有找到匹配资料。"));
}
function download(obj, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }),
  );
  const a = E("a", { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function workspace() {
  main.append(
    header("作者工作台", "在这里整理草稿，预览，再发布。"),
    E(
      "div",
      { class: "workspace-info" },
      "当前为本机工作台。草稿和原图保存在这台电脑，不会随公开网站上传。跨设备同步、远程登录与一键线上发布尚待云端接入。",
    ),
    E(
      "div",
      { class: "utility-grid" },
      E(
        "section",
        { class: "utility" },
        E("h2", {}, "预览与发布"),
        E("p", {}, "预览会过滤私人资料，保留访客可点击揭示的档案。"),
        E(
          "div",
          { class: "actions" },
          btn("预览草稿", () => {
            previewing = true;
            editing = false;
            data = publicData(draft);
            render();
          }),
          btn(
            "发布到本机预览",
            async () => {
              await save();
              if (saveError) return toast("保存失败，暂不能发布");
              if (
                !confirm(
                  "将草稿的公开部分发布到本机预览？不会替换 GitHub 或腾讯云网站。",
                )
              )
                return;
              try {
                await api("publish", {});
                toast("已发布到本机预览，并保存上一版");
              } catch (e) {
                toast(e.message);
              }
            },
            "primary",
          ),
        ),
      ),
      E(
        "section",
        { class: "utility" },
        E("h2", {}, "备份与恢复"),
        E(
          "p",
          {},
          "完整备份包含私人资料，请自行保管。导入前会下载一份当前备份。",
        ),
        E(
          "div",
          { class: "actions" },
          btn("导出完整备份", () => download(draft, "oc-private-backup.json")),
          btn("导出公开内容", () =>
            download(publicData(draft), "oc-public.json"),
          ),
          btn("导入备份", () => {
            const input = E("input", {
              type: "file",
              accept: ".json",
              onchange: async () => {
                try {
                  const imported = validate(
                    JSON.parse(await input.files[0].text()),
                  );
                  if (
                    !confirm("用这份备份替换当前草稿？现有草稿将先下载备份。")
                  )
                    return;
                  download(draft, "oc-before-import.json");
                  draft = imported;
                  data = draft;
                  await save();
                  render();
                } catch (e) {
                  toast(e.message);
                }
              },
            });
            input.click();
          }),
        ),
      ),
      E(
        "section",
        { class: "utility" },
        E("h2", {}, "版本历史"),
        E("p", {}, "每次发布保留上一版本。恢复到草稿后，可以继续编辑再发布。"),
        E("div", { id: "versions" }),
      ),
    ),
  );
  try {
    const list = await api("snapshots");
    const target = $("#versions");
    if (target)
      target.append(
        list.length
          ? E(
              "div",
              {},
              list.slice(0, 15).map((id) =>
                btn(
                  new Date(Number(id.split(".")[0])).toLocaleString() +
                    " · 恢复",
                  async () => {
                    if (!confirm("恢复这份版本到草稿？当前草稿也会存为快照。"))
                      return;
                    try {
                      draft = await api("restore", { id });
                      data = draft;
                      render();
                      toast("已恢复到草稿");
                    } catch (e) {
                      toast(e.message);
                    }
                  },
                ),
              ),
            )
          : E("small", {}, "发布后会在这里出现历史版本。"),
      );
  } catch (e) {
    toast(e.message);
  }
}
function missing() {
  main.append(empty("这份档案不存在，或尚未公开。"));
}
function render() {
  main.replaceChildren();
  sidebar();
  $("#mode").textContent = editing
    ? "退出编辑"
    : previewing
      ? "返回编辑"
      : "作者工作台";
  $("#notice").textContent = previewing
    ? "正在预览草稿的公开部分 · 点击右上角返回编辑"
    : editing
      ? "草稿保存在本机 · 云端同步尚未连接"
      : "";
  const [page = "home", id] = route();
  const handlers = {
    home,
    worlds,
    world,
    characters,
    character,
    arcs,
    arc,
    story,
    relations,
    timeline,
    gallery,
    search,
    workspace: () => (editing ? workspace() : missing()),
  };
  (handlers[page] || home)(id);
  document.title =
    (main.querySelector("h1")?.textContent || "鱿鱼的世界") + " · OC ARCHIVE";
}
const optionsVisibility = [
  ["public", "公开"],
  ["reveal", "点击揭示"],
  ["private", "仅自己可见"],
];
function field(label, value, onchange, type = "text", options) {
  let input;
  if (options) {
    input = E(
      "select",
      { onchange: (e) => onchange(e.target.value) },
      options.map(([v, t]) => E("option", { value: v }, t)),
    );
    input.value = value || "";
  } else {
    input = E(type === "textarea" ? "textarea" : "input", {
      type: type === "textarea" ? null : type,
      oninput: (e) => onchange(e.target.value),
    });
    input.value = value ?? "";
  }
  return E("label", { class: "field" }, E("span", {}, label), input);
}
function edit(key, existing) {
  const modal = $("#editor"),
    form = $("#edit-form");
  if (modal.open) modal.close();
  let item = existing
    ? clone(existing)
    : {
        id: crypto.randomUUID(),
        visibility: "public",
        storyArcId: route()[0] === "arc" ? route()[1] : data.arcs[0].id,
      };
  if (!existing) {
    if (key === "events")
      Object.assign(item, {
        timeType: "order",
        order: draft.events.length + 1,
        branch: "主线",
      });
    if (key === "artworks") item.characterId = data.characters[0]?.id || "";
  }
  let added = !!existing,
    timer;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const candidate = clone(draft);
        const index = candidate[key].findIndex((x) => x.id === item.id);
        if (index < 0) {
          if (!(item.name || item.title || item.from)) return;
          candidate[key].push(clone(item));
          added = true;
        } else candidate[key][index] = clone(item);
        validate(candidate);
        draft = candidate;
        data = draft;
        save();
      } catch (e) {
        toast(e.message);
      }
    }, 550);
  };
  const set = (k, v) => {
    item[k] = v;
    persist();
  };
  const f = (label, k, type = "text", opts) =>
    field(label, item[k], (v) => set(k, v), type, opts);
  const characterOptions = data.characters.map((c) => [c.id, c.name]);
  const arcOptions = data.arcs.map((a) => [a.id, a.title]);
  form.replaceChildren(
    E(
      "div",
      { class: "form-head" },
      E("h2", {}, (existing ? "编辑" : "新建") + names[key]),
      btn("关闭", () => modal.close()),
    ),
    E(
      "p",
      { class: "form-note" },
      "填写后自动保存草稿。关闭窗口不会发布。私人内容只保存在作者工作台。",
    ),
  );
  if (key === "relations") {
    form.append(
      f("起点角色", "from", "text", [["", "请选择"], ...characterOptions]),
      f("终点角色", "to", "text", [["", "请选择"], ...characterOptions]),
      f("关系归属", "storyArcId", "text", [
        ...arcOptions,
        ["cross-arc", "跨故事线关系"],
      ]),
      f("起点看向终点", "label", "textarea"),
      f("终点看向起点（可选）", "reverseLabel", "textarea"),
      field(
        "方向",
        item.directed ? "one" : "both",
        (v) => set("directed", v === "one"),
        "text",
        [
          ["one", "单向 →"],
          ["both", "双向 ↔"],
        ],
      ),
    );
  } else {
    form.append(
      f(
        key === "characters" ? "姓名" : "标题",
        key === "characters" ? "name" : "title",
      ),
    );
    if (["characters", "stories", "events"].includes(key))
      form.append(f("所属故事线", "storyArcId", "text", arcOptions));
    if (key === "characters") {
      form.append(
        E(
          "fieldset",
          {},
          E("legend", {}, "额外参与的故事（关系连线不会自动加入）"),
          arcOptions.map(([id, title]) => {
            const input = E("input", {
              type: "checkbox",
              onchange: (e) => {
                item.storyArcIds = e.target.checked
                  ? [...new Set([...(item.storyArcIds || []), id])]
                  : (item.storyArcIds || []).filter((x) => x !== id);
                persist();
              },
            });
            input.checked = (item.storyArcIds || []).includes(id);
            return E(
              "label",
              { style: "display:block;padding:7px" },
              input,
              " " + title,
            );
          }),
        ),
      );
      form.append(
        f("头像下的一句话", "role", "textarea"),
        f("角色简介", "bio", "textarea"),
        field("特质标签（逗号分隔）", (item.traits || []).join("，"), (v) =>
          set(
            "traits",
            v
              .split(/[,，]/)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ),
        field(
          "基本资料（每行：项目：内容）",
          (item.quickFacts || []).map((x) => x.join("：")).join("\n"),
          (v) =>
            set(
              "quickFacts",
              v
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const i = line.search(/[:：]/);
                  return i < 0
                    ? [line, ""]
                    : [line.slice(0, i), line.slice(i + 1)];
                }),
            ),
          "textarea",
        ),
      );
      (item.sections || []).forEach((section, i) => {
        form.append(
          E("h3", {}, section.title),
          field(
            "段落内容",
            (section.content || []).join("\n\n"),
            (v) => {
              item.sections[i].content = v.split(/\n\s*\n/);
              persist();
            },
            "textarea",
          ),
          field(
            "分栏条目（每行：项目：内容）",
            (section.items || []).map((x) => x.join("：")).join("\n"),
            (v) => {
              item.sections[i].items = v
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const p = line.search(/[:：]/);
                  return p < 0
                    ? [line, ""]
                    : [line.slice(0, p), line.slice(p + 1)];
                });
              persist();
            },
            "textarea",
          ),
          field(
            "本节可见性",
            section.visibility || "public",
            (v) => {
              item.sections[i].visibility = v;
              persist();
            },
            "text",
            optionsVisibility,
          ),
        );
      });
    }
    if (["worlds", "arcs"].includes(key))
      form.append(
        f("一句话介绍", "tagline", "textarea"),
        f("正文", "summary", "textarea"),
      );
    if (key === "stories")
      form.append(
        f("类型", "type", "text", [
          ["主线", "主线"],
          ["短篇", "短篇"],
          ["短打", "短打"],
          ["预告", "预告"],
        ]),
        f("简介", "excerpt", "textarea"),
        f("正文", "content", "textarea"),
      );
    if (key === "events")
      form.append(
        f("时间方式", "timeType", "text", [
          ["order", "仅先后顺序"],
          ["period", "时期"],
          ["date", "明确日期"],
        ]),
        f("日期或时期（可填：初瞑消逝后）", "timeLabel"),
        f("排列顺序（数值越小越靠前）", "order", "number"),
        f("时间线 / 平行分支", "branch"),
        f("事件内容", "description", "textarea"),
      );
    if (key === "artworks")
      form.append(
        f("关联角色", "characterId", "text", [
          ["", "未关联"],
          ...characterOptions,
        ]),
        f("画师 / 来源", "credit"),
        f("备注", "notes", "textarea"),
      );
    if (["characters", "artworks", "worlds", "arcs"].includes(key)) {
      const imageKey =
        key === "characters"
          ? "portrait"
          : key === "artworks"
            ? "src"
            : "illustration";
      form.append(
        f("展示图路径", imageKey),
        E(
          "label",
          { class: "field" },
          E("span", {}, "上传图片（原图私存，展示图自动压缩）"),
          E("input", {
            type: "file",
            accept: "image/png,image/jpeg,image/webp",
            onchange: async (e) => {
              try {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 18 * 1024 * 1024)
                  throw Error("请选择小于18MB的图片");
                toast("正在保存原图并制作展示图…");
                const original = await new Promise((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result);
                  r.onerror = reject;
                  r.readAsDataURL(file);
                });
                const bitmap = await createImageBitmap(file),
                  scale = Math.min(
                    1,
                    1400 / Math.max(bitmap.width, bitmap.height),
                  ),
                  canvas = document.createElement("canvas");
                canvas.width = Math.round(bitmap.width * scale);
                canvas.height = Math.round(bitmap.height * scale);
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#18232b";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
                const result = await api("upload", {
                  original,
                  display: canvas.toDataURL("image/jpeg", 0.88),
                });
                item[imageKey] = result.src;
                item.original = result.original;
                persist();
                toast("图片已存入草稿");
              } catch (err) {
                toast(err.message);
              }
            },
          }),
        ),
      );
    }
  }
  form.append(
    f("可见状态", "visibility", "text", optionsVisibility),
    f("私人笔记（始终不公开）", "privateNotes", "textarea"),
    E(
      "div",
      { class: "form-foot" },
      E("small", {}, "自动保存到本机草稿"),
      btn(
        "完成",
        async () => {
          clearTimeout(timer);
          const before = clone(draft);
          try {
            const idx = draft[key].findIndex((x) => x.id === item.id);
            if (idx < 0) draft[key].push(item);
            else draft[key][idx] = item;
            validate(draft);
            await save();
            if (saveError) throw saveError;
            modal.close();
            render();
          } catch (e) {
            draft = before;
            data = draft;
            toast(e.message);
          }
        },
        "primary",
      ),
    ),
  );
  form.onsubmit = (e) => e.preventDefault();
  modal.onclose = () => {
    clearTimeout(timer);
    if (added) {
      const i = draft[key].findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const candidate = clone(draft);
        candidate[key][i] = item;
        try {
          validate(candidate);
          draft = candidate;
          data = draft;
        } catch (e) {
          toast("未保存不完整的修改：" + e.message);
        }
      }
      save();
    }
    render();
  };
  modal.showModal();
}
$("#menu").onclick = () => {
  const open = document.body.classList.toggle("nav-open");
  $("#menu").setAttribute("aria-expanded", String(open));
};
$("#sidebar").onclick = (e) => {
  if (e.target.closest("a")) {
    document.body.classList.remove("nav-open");
    $("#menu").setAttribute("aria-expanded", "false");
  }
};
$("#search").oninput = (e) => {
  query = e.target.value.trim();
  if (query) {
    location.hash = "search";
    render();
  } else if (route()[0] === "search") location.hash = "home";
};
$("#mode").onclick = async () => {
  if (!session) {
    toast("这是公开预览。作者编辑需打开本机工作台；云端登录尚未接入。");
    return;
  }
  if (previewing) {
    previewing = false;
    editing = true;
    data = draft;
  } else if (editing) {
    await saveQueue;
    if (saveError) return toast("草稿尚未保存，请先备份");
    editing = false;
    data = await (await fetch("published.json", { cache: "no-store" })).json();
  } else {
    draft = await api("draft");
    data = draft;
    editing = true;
  }
  render();
};
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});
try {
  data = validate(
    await (await fetch("published.json", { cache: "no-store" })).json(),
  );
  if (location.hostname === "127.0.0.1")
    try {
      session = await api("session");
    } catch {}
  render();
} catch (e) {
  main.append(empty("档案暂时无法加载：" + e.message));
}
