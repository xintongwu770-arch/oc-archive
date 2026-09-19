import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { validate, publicData } from "./model.mjs";
new vm.Script(
  "(async()=>{" +
    fs
      .readFileSync(new URL("./app.js", import.meta.url), "utf8")
      .replace(/^import[^\n]+\n/, "") +
    "})()",
);
const data = validate(
  JSON.parse(
    fs.readFileSync(new URL("./published.json", import.meta.url), "utf8"),
  ),
);
assert.equal(data.characters.length, 39);
assert.equal(data.arcs.length, 9);
assert.equal(data.stories.length, 8);
assert(
  data.stories.every((s) => typeof s.content === "string" && s.content.length),
);
const copy = structuredClone(data);
copy.characters[0].visibility = "private";
copy.characters[1].privateNotes = "NEVER-PUBLISH";
copy.characters[1].sections = [
  { visibility: "private", content: ["SECRET-SECTION"] },
  { visibility: "reveal", content: ["REVEAL-OK"] },
];
copy.artworks.push({
  id: "secret-art",
  characterId: copy.characters[0].id,
  visibility: "public",
  src: "hidden.png",
  original: "SECRET-ORIGINAL",
});
const projected = publicData(copy),
  serialized = JSON.stringify(projected);
assert(!projected.characters.some((c) => c.id === copy.characters[0].id));
assert(!serialized.includes("NEVER-PUBLISH"));
assert(!serialized.includes("SECRET-SECTION"));
assert(!serialized.includes("SECRET-ORIGINAL"));
assert(serialized.includes("REVEAL-OK"));
assert(
  !projected.relations.some(
    (r) => r.from === copy.characters[0].id || r.to === copy.characters[0].id,
  ),
);
assert(
  !data.relations.some(
    (r) =>
      r.storyArcId === "shaxia-prequel" &&
      (r.from === "dora" || r.to === "dora"),
  ),
);
assert(
  data.relations.some(
    (r) =>
      r.storyArcId === "cross-arc" && r.from === "dora" && r.to === "shujin",
  ),
);
assert.throws(() =>
  validate({ ...data, characters: [data.characters[0], data.characters[0]] }),
);
console.log("通过：脚本语法、完整迁移、隐私过滤、关系隔离、备份校验。");
