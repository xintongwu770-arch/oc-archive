import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, publicData } from "./model.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(dir);
const raw = vm.runInNewContext(
  fs.readFileSync(path.join(root, "js/data.js"), "utf8") +
    "\nJSON.stringify({worlds:WORLDS,arcs:STORY_ARCS,characters:CHARACTERS,stories:STORIES,relations:RELATIONS})",
);
const data = JSON.parse(raw);
for (const [key, items] of Object.entries(data))
  items.forEach((item, i) => {
    item.id ||= `${key}-${i}`;
    item.visibility = item.hiddenFromRoster ? "reveal" : "public";
    if (item.sections)
      item.sections.forEach(
        (s) => (s.visibility = s.classified ? "reveal" : "public"),
      );
  });
for (const story of data.stories)
  if (story.source)
    story.content = fs.readFileSync(path.join(root, story.source), "utf8");
data.arcs.find((x) => x.id === "demon-company").summary = data.arcs
  .find((x) => x.id === "demon-company")
  .summary.replace("队里最年轻的成年人", "队里冰蓝发的小孩");
data.artworks = data.characters.flatMap((c) =>
  (c.gallery || []).map((src, i) => ({
    id: `art-${c.id}-${i}`,
    characterId: c.id,
    title: `${c.name} · 其他立绘 ${i + 1}`,
    src,
    credit: "",
    notes: "",
    visibility: c.visibility,
  })),
);
Object.assign(data, {
  schema: 1,
  events: [],
  layouts: {},
  issues: [],
  updatedAt: new Date().toISOString(),
});
validate(data);
fs.writeFileSync(
  path.join(dir, "published.json"),
  JSON.stringify(publicData(data), null, 2),
);
console.log(
  `迁移完成：${data.characters.length} 位角色 / ${data.arcs.length} 条故事线 / ${data.stories.length} 篇文章 / ${data.artworks.length} 张额外立绘。未推测剧情日期。`,
);
