import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "oc-studio-test-"));
const published = path.join(tmp, "published.json");
await fs.copyFile(new URL("./published.json", import.meta.url), published);
const child = spawn(
  process.execPath,
  [new URL("./server.mjs", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")],
  {
    env: {
      ...process.env,
      OC_STUDIO_PORT: "4175",
      OC_STUDIO_STORE: tmp,
      OC_STUDIO_PUBLIC_FILE: published,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
try {
  await new Promise((resolve, reject) => {
    child.stdout.once("data", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(Error("Server exited " + code)));
  });
  const origin = "http://127.0.0.1:4175";
  const get = async (p) => (await fetch(origin + p)).json();
  const session = await get("/api/session");
  const draft = await get("/api/draft");
  const privateId = draft.characters[0].id;
  draft.characters[0].visibility = "private";
  draft.characters[1].privateNotes = "PRIVATE-SENTINEL";
  let r = await fetch(origin + "/api/draft", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  assert.equal(r.status, 403);
  const post = async (p, body) =>
    fetch(origin + p, {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Studio-Token": session.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  r = await post("/api/draft", draft);
  assert.equal(r.status, 200);
  assert.equal(
    (await get("/api/draft")).characters[1].privateNotes,
    "PRIVATE-SENTINEL",
  );
  assert(
    !(await get("/preview/published.json")).characters.some(
      (c) => c.privateNotes === "PRIVATE-SENTINEL",
    ),
  );
  r = await post("/api/publish", {});
  assert.equal(r.status, 200);
  const live = await get("/preview/published.json");
  assert(!live.characters.some((c) => c.id === privateId));
  assert(!JSON.stringify(live).includes("PRIVATE-SENTINEL"));
  const versions = await get("/api/snapshots");
  assert.equal(versions.length, 1);
  r = await post("/api/restore", { id: versions[0] });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).characters.length, 39);
  r = await fetch(origin + "/.oc-studio/draft.json");
  assert.equal(r.status, 404);
  const hostStatus = await new Promise((resolve, reject) => {
    http
      .get(
        origin + "/api/draft",
        { headers: { Host: "evil.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on("error", reject);
  });
  assert.equal(hostStatus, 403);
  console.log(
    "通过：未授权写入拦截、草稿保存、公开过滤、发布快照、恢复、私有目录隔离。",
  );
} finally {
  child.kill();
}
