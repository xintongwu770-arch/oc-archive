import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { validate, publicData } from "./model.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(dir),
  store = process.env.OC_STUDIO_STORE || path.join(root, ".oc-studio");
const publicFile =
  process.env.OC_STUDIO_PUBLIC_FILE || path.join(dir, "published.json");
await fs.mkdir(path.join(store, "snapshots"), { recursive: true });
await fs.mkdir(path.join(store, "originals"), { recursive: true });
await fs.mkdir(path.join(dir, "media"), { recursive: true });
const port = Number(process.env.OC_STUDIO_PORT || 4174),
  origin = `http://127.0.0.1:${port}`,
  token = crypto.randomBytes(32).toString("hex");
let locked = false;
const load = async () =>
  JSON.parse(
    await fs
      .readFile(path.join(store, "draft.json"), "utf8")
      .catch(() => fs.readFile(publicFile, "utf8")),
  );
const atomic = async (file, value) => {
  await fs.writeFile(file + ".tmp", JSON.stringify(value, null, 2));
  await fs.rename(file + ".tmp", file);
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.host !== `127.0.0.1:${port}`)
        return send(403, { error: "仅支持本机工作台地址" });
      const url = new URL(req.url, origin),
        p = url.pathname;
      if (p.startsWith("/api/")) {
        if (req.method === "GET" && p === "/api/session")
          return send(200, { local: true, token });
        if (
          req.method !== "GET" &&
          (req.headers.origin !== origin ||
            req.headers["x-studio-token"] !== token)
        )
          return send(403, { error: "编辑会话失效，请刷新页面" });
        if (req.method === "GET" && p === "/api/draft")
          return send(200, await load());
        if (req.method === "GET" && p === "/api/snapshots")
          return send(
            200,
            (await fs.readdir(path.join(store, "snapshots")))
              .filter((x) => x.endsWith(".json"))
              .sort()
              .reverse(),
          );
        if (req.method !== "POST") return send(404, { error: "不存在的操作" });
        if (locked)
          return send(409, { error: "另一个保存正在进行，请稍后重试" });
        locked = true;
        try {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 35 * 1024 * 1024)
              throw new Error("文件过大，单次限制 35MB");
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
          if (p === "/api/draft") {
            validate(body);
            await atomic(path.join(store, "draft.json"), body);
            return send(200, { savedAt: new Date().toISOString() });
          }
          if (p === "/api/publish") {
            const data = validate(await load()),
              old = JSON.parse(await fs.readFile(publicFile, "utf8"));
            const stamp = Date.now();
            const previous = JSON.parse(
              await fs
                .readFile(path.join(store, "last-published.json"), "utf8")
                .catch(() => JSON.stringify(old)),
            );
            await atomic(
              path.join(store, "snapshots", `${stamp}.json`),
              previous,
            );
            const published = publicData(data);
            for (const match of JSON.stringify(published).matchAll(
              /preview\/media\/([\w-]+\.jpg)/g,
            ))
              await fs
                .copyFile(
                  path.join(store, match[1]),
                  path.join(dir, "media", match[1]),
                )
                .catch(async (error) => {
                  if (error.code !== "ENOENT") throw error;
                  await fs.access(path.join(dir, "media", match[1]));
                });
            await atomic(publicFile, published);
            await atomic(path.join(store, "last-published.json"), data);
            return send(200, {
              publishedAt: new Date().toISOString(),
              local: true,
            });
          }
          if (p === "/api/restore") {
            if (!/^\d+\.json$/.test(body.id)) throw new Error("无效版本");
            const restored = validate(
              JSON.parse(
                await fs.readFile(
                  path.join(store, "snapshots", body.id),
                  "utf8",
                ),
              ),
            );
            await atomic(
              path.join(store, "snapshots", `${Date.now()}.json`),
              await load(),
            );
            await atomic(path.join(store, "draft.json"), restored);
            return send(200, restored);
          }
          if (p === "/api/upload") {
            const match =
              /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
                body.original || "",
              );
            const display =
              /^data:image\/jpeg;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
                body.display || "",
              );
            if (!match || !display)
              throw new Error("仅支持 PNG、JPEG、WebP 图片");
            const id = crypto.randomUUID();
            await fs.writeFile(
              path.join(store, "originals", `${id}.${match[1]}`),
              Buffer.from(match[2], "base64"),
            );
            // Display images remain private until referenced by the published dataset.
            await fs.writeFile(
              path.join(store, `${id}.jpg`),
              Buffer.from(display[1], "base64"),
            );
            return send(200, {
              src: `preview/media/${id}.jpg`,
              original: `${id}.${match[1]}`,
            });
          }
          return send(404, { error: "不存在的操作" });
        } finally {
          locked = false;
        }
      }
      let relative =
        decodeURIComponent(p).replace(/^\//, "") || "preview/index.html";
      if (relative === "preview/") relative += "index.html";
      if (
        !/^(preview\/(index\.html|app\.(js|css)|model\.mjs|published\.json|media\/[\w-]+\.jpg)|images\/[\w\-.\u4e00-\u9fff]+)$/.test(
          relative,
        )
      )
        return send(404, { error: "文件不存在" });
      if (relative.startsWith("preview/media/")) {
        const file = path.basename(relative),
          published = await fs.readFile(
            path.join(dir, "published.json"),
            "utf8",
          );
        if (published.includes(relative)) {
          await fs
            .copyFile(path.join(store, file), path.join(dir, "media", file))
            .catch(() => {});
        } else if (req.headers.referer?.startsWith(origin + "/preview/")) {
          const bytes = await fs.readFile(path.join(store, file));
          res.writeHead(200, {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
          });
          return res.end(bytes);
        }
      }
      const bytes = await fs.readFile(
        relative === "preview/published.json"
          ? publicFile
          : path.join(root, relative),
      );
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(relative)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(bytes);
    } catch (error) {
      send(400, { error: error.message });
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`OC 工作台 ${origin}/preview/`));
