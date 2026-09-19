export const collections = [
  "worlds",
  "arcs",
  "characters",
  "stories",
  "relations",
  "events",
  "artworks",
];
export function validate(data) {
  if (!data || data.schema !== 1)
    throw new Error("备份格式不正确，请选择新版工作台导出的 JSON。");
  for (const key of collections) {
    if (!Array.isArray(data[key])) throw new Error(`缺少资料分类：${key}`);
    const ids = new Set();
    for (const item of data[key]) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[\w-]+$/.test(item.id) ||
        ids.has(item.id)
      )
        throw new Error(`${key} 存在无效或重复编号`);
      if (!["public", "reveal", "private"].includes(item.visibility))
        throw new Error("可见状态无效");
      ids.add(item.id);
    }
  }
  const characters = new Set(data.characters.map((x) => x.id));
  const arcs = new Set(data.arcs.map((x) => x.id));
  for (const r of data.relations)
    if (!characters.has(r.from) || !characters.has(r.to))
      throw new Error("关系中的角色不存在");
  for (const key of ["characters", "stories", "events", "relations"])
    for (const x of data[key]) {
      if (
        x.storyArcId &&
        x.storyArcId !== "cross-arc" &&
        !arcs.has(x.storyArcId)
      )
        throw new Error("关联的故事线不存在");
    }
  return data;
}
export function publicData(data) {
  const clean = (value) => {
    if (Array.isArray(value))
      return value.filter((v) => !v || v.visibility !== "private").map(clean);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([k]) => !["privateNotes", "original", "reviewNotes"].includes(k),
          )
          .map(([k, v]) => [k, clean(v)]),
      );
    return value;
  };
  const result = clean(data);
  const arcIds = new Set(result.arcs.map((a) => a.id));
  for (const key of ["characters", "stories", "events", "relations"])
    result[key] = result[key].filter(
      (x) =>
        !x.storyArcId ||
        x.storyArcId === "cross-arc" ||
        arcIds.has(x.storyArcId),
    );
  result.characters.forEach((c) => {
    c.storyArcIds = (c.storyArcIds || []).filter((id) => arcIds.has(id));
    delete c.gallery;
  });
  const ids = new Set(result.characters.map((c) => c.id));
  result.relations = result.relations.filter(
    (r) => ids.has(r.from) && ids.has(r.to),
  );
  result.artworks = result.artworks.filter(
    (a) => !a.characterId || ids.has(a.characterId),
  );
  result.events = result.events.map((e) => ({
    ...e,
    characterIds: (e.characterIds || []).filter((id) => ids.has(id)),
  }));
  result.issues = [];
  return result;
}
