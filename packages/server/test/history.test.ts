import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSession, listSessions, readActive, writeActive } from "../src/history.js";

const roots: string[] = [];

async function makeRoots(): Promise<{ root: string; historyDir: string }> {
  const base = await mkdtemp(path.join(tmpdir(), "myblog-history-"));
  roots.push(base);
  const root = path.join(base, "Mobile");
  await mkdir(root, { recursive: true });
  return { root, historyDir: path.join(base, "history") };
}

afterEach(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("history layout", () => {
  it("目录名可读（别名-短哈希），并写入 workspace.json", async () => {
    const { root, historyDir } = await makeRoots();
    await createSession(root, historyDir, "第一条", "手机逆向");

    const dirs = await readdir(historyDir);
    expect(dirs).toHaveLength(1);
    expect(dirs[0]).toMatch(/^手机逆向-[0-9a-f]{8}$/);

    const manifest = JSON.parse(await readFile(path.join(historyDir, dirs[0] as string, "workspace.json"), "utf8")) as {
      root: string;
      label: string;
    };
    expect(manifest.root).toBe(root);
    expect(manifest.label).toBe("手机逆向");
  });

  it("别名改了：自动改名目录并保住会话", async () => {
    const { root, historyDir } = await makeRoots();
    await createSession(root, historyDir, "会话A", "旧名字");

    const sessions = await listSessions(root, historyDir, "新名字");
    expect(sessions.sessions.map((session) => session.title)).toContain("会话A");

    const dirs = await readdir(historyDir);
    expect(dirs.some((name) => name.startsWith("新名字-"))).toBe(true);
    expect(dirs.some((name) => name.startsWith("旧名字-"))).toBe(false);
  });

  it("旧版纯哈希目录会自动改名迁移，历史不丢", async () => {
    const { root, historyDir } = await makeRoots();
    const hash16 = createHash("sha1").update(root).digest("hex").slice(0, 16);
    const legacyDir = path.join(historyDir, hash16);
    const now = new Date().toISOString();
    await mkdir(path.join(legacyDir, "旧会话"), { recursive: true });
    await writeFile(
      path.join(legacyDir, "index.json"),
      JSON.stringify({
        active: "s1",
        sessions: [{ id: "s1", title: "旧会话", folder: "旧会话", createdAt: now, updatedAt: now }],
      }),
      "utf8",
    );
    await writeFile(
      path.join(legacyDir, "旧会话", "messages.json"),
      JSON.stringify({ messages: [{ id: 1, role: "user", content: "hi", tools: [] }] }),
      "utf8",
    );

    const { messages } = await readActive(root, historyDir, "Mobile");
    expect(messages[0]?.content).toBe("hi");

    const dirs = await readdir(historyDir);
    expect(dirs).not.toContain(hash16);
    expect(dirs.some((name) => /^Mobile-[0-9a-f]{8}$/.test(name))).toBe(true);
  });

  it("迁移最早的「单文件历史」<hash>.json", async () => {
    const { root, historyDir } = await makeRoots();
    const hash16 = createHash("sha1").update(root).digest("hex").slice(0, 16);
    await mkdir(historyDir, { recursive: true });
    await writeFile(
      path.join(historyDir, `${hash16}.json`),
      JSON.stringify({ messages: [{ id: 1, role: "user", content: "老历史", tools: [] }], updatedAt: new Date().toISOString() }),
      "utf8",
    );

    const { messages } = await readActive(root, historyDir, "Mobile");
    expect(messages[0]?.content).toBe("老历史");

    const dirs = await readdir(historyDir);
    expect(dirs.some((name) => name.endsWith(".json"))).toBe(false);
    expect(dirs.some((name) => /^Mobile-[0-9a-f]{8}$/.test(name))).toBe(true);
  });

  it("写入后能读回", async () => {
    const { root, historyDir } = await makeRoots();
    await createSession(root, historyDir, "读写", "Mobile");
    await writeActive(root, historyDir, [{ id: 1, role: "assistant", content: "ok", tools: [] }], "Mobile");
    const { messages } = await readActive(root, historyDir, "Mobile");
    expect(messages[0]?.content).toBe("ok");
  });
});
