import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApi, type MyBlogApi } from "../src/handlers.js";

const exec = promisify(execFile);
const roots: string[] = [];
let gitAvailable = false;

async function hasGit(): Promise<boolean> {
  try {
    await exec("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  gitAvailable = await hasGit();
});

async function makeApi(): Promise<{ root: string; api: MyBlogApi }> {
  const root = await mkdtemp(path.join(tmpdir(), "myblog-files-"));
  roots.push(root);
  const api = createApi({ root, agentConfigPath: path.join(root, "config", "agent.json") });
  return { root, api };
}

afterEach(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("files", () => {
  it("列出目录：目录优先、隐藏 .git、带相对路径与大小", async () => {
    const { root, api } = await makeApi();
    await writeFile(path.join(root, "a.txt"), "hello", "utf8");
    await mkdir(path.join(root, "sub"), { recursive: true });
    await writeFile(path.join(root, "sub", "b.txt"), "bb", "utf8");
    await mkdir(path.join(root, ".git"), { recursive: true });
    await writeFile(path.join(root, ".git", "config"), "x", "utf8");

    const listing = (await api.dispatch("files")) as {
      path: string;
      entries: { name: string; type: string; size: number; path: string }[];
    };

    expect(listing.path).toBe(".");
    expect(listing.entries.map((entry) => entry.name)).toEqual(["sub", "a.txt"]);
    expect(listing.entries[1]).toMatchObject({ type: "file", size: 5, path: "a.txt" });
  });

  it("可以进入子目录", async () => {
    const { root, api } = await makeApi();
    await mkdir(path.join(root, "sub"), { recursive: true });
    await writeFile(path.join(root, "sub", "b.txt"), "bb", "utf8");

    const listing = (await api.dispatch("files", { path: "sub" })) as {
      path: string;
      entries: { name: string; path: string }[];
    };

    expect(listing.path).toBe("sub");
    expect(listing.entries.map((entry) => entry.path)).toEqual(["sub/b.txt"]);
  });

  it("拒绝越界路径", async () => {
    const api = (await makeApi()).api;
    await expect(api.dispatch("files", { path: "../outside" })).rejects.toThrow("超出工作区");
  });
});

describe("readFile", () => {
  it("读取文本内容", async () => {
    const { root, api } = await makeApi();
    await writeFile(path.join(root, "note.md"), "# hi\n", "utf8");

    const file = (await api.dispatch("readFile", { path: "note.md" })) as {
      path: string;
      binary: boolean;
      content: string;
    };

    expect(file).toMatchObject({ path: "note.md", binary: false, content: "# hi\n" });
  });

  it("二进制文件不返回内容", async () => {
    const { root, api } = await makeApi();
    await writeFile(path.join(root, "bin.dat"), Buffer.from([1, 0, 2, 0]));

    const file = (await api.dispatch("readFile", { path: "bin.dat" })) as { binary: boolean; content: string };

    expect(file.binary).toBe(true);
    expect(file.content).toBe("");
  });

  it("目录或不存在的文件报错", async () => {
    const { root, api } = await makeApi();
    await mkdir(path.join(root, "sub"), { recursive: true });

    await expect(api.dispatch("readFile", { path: "sub" })).rejects.toThrow("文件不存在");
    await expect(api.dispatch("readFile", { path: "missing.txt" })).rejects.toThrow("文件不存在");
  });

  it("图片返回 mime 与 dataUrl", async () => {
    const { root, api } = await makeApi();
    await writeFile(path.join(root, "shot.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));

    const file = (await api.dispatch("readFile", { path: "shot.png" })) as { mime?: string; dataUrl?: string };

    expect(file.mime).toBe("image/png");
    expect(file.dataUrl?.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("search", () => {
  it("在工作区文档里找关键词并给出位置", async () => {
    const { root, api } = await makeApi();
    await writeFile(path.join(root, "PROGRESS.md"), "# 总览\n\n学到哪了：装包跑通 DENIED\n", "utf8");
    await mkdir(path.join(root, "2026-09-17"), { recursive: true });
    await writeFile(path.join(root, "2026-09-17", "总结.md"), "# 2026-09-17\n\n## 这次\n装了 apktool\n", "utf8");
    await writeFile(path.join(root, "GOALS.md"), "# 目标\n\n## 能力编号\n\n| 编号 | 能力 | 岗位侧在问什么 | 当前状态 |\n|---|---|---|---|\n| G3 | Hook | Frida | 未开始 |\n", "utf8");

    const found = (await api.dispatch("search", { query: "apktool" })) as {
      hits: { path: string; date: string | null; line: number }[];
    };
    expect(found.hits).toHaveLength(1);
    expect(found.hits[0]).toMatchObject({ date: "2026-09-17", line: 4 });

    const denied = (await api.dispatch("search", { query: "denied" })) as { hits: unknown[] };
    expect(denied.hits).toHaveLength(1);

    const short = (await api.dispatch("search", { query: "a" })) as { hits: unknown[] };
    expect(short.hits).toHaveLength(0);
  });
});

describe("setCapability", () => {
  it("只改状态单元格", async () => {
    const { root, api } = await makeApi();
    const goals = [
      "# 目标",
      "",
      "## 能力编号",
      "",
      "| 编号 | 能力 | 岗位侧在问什么 | 当前状态 |",
      "|---|---|---|---|",
      "| G1 | 环境 | adb | 已通 |",
      "| G3 | Hook | Frida | 未开始 |",
      "",
    ].join("\n");
    await writeFile(path.join(root, "GOALS.md"), goals, "utf8");

    const result = (await api.dispatch("setCapability", { id: "G3", status: "进行中" })) as { changed: boolean };
    expect(result.changed).toBe(true);

    const raw = await readFile(path.join(root, "GOALS.md"), "utf8");
    expect(raw).toContain("| G3 | Hook | Frida | 进行中 |");
    expect(raw).toContain("| G1 | 环境 | adb | 已通 |");
  });
});

describe("opencode auth import", () => {
  it("没有 auth.json 时返回空列表", async () => {
    const { root } = await makeApi();
    const api = createApi({ root, opencodeAuthPath: path.join(root, "nope", "auth.json") });
    const view = (await api.dispatch("opencodeAuth")) as { available: unknown[] };
    expect(view.available).toEqual([]);
  });

  it("读到 opencode 登录后可以一键导入模型配置", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "myblog-opencode-"));
    roots.push(base);
    const configDir = path.join(base, "config");
    const authFile = path.join(base, "auth.json");
    await writeFile(authFile, JSON.stringify({ "opencode-go": { type: "api", key: "test-key-123" } }), "utf8");
    await writeFile(path.join(base, "PROGRESS.md"), "# 总览\n", "utf8");

    const api = createApi({
      root: base,
      agentConfigPath: path.join(configDir, "agent.json"),
      opencodeAuthPath: authFile,
      opencodeModelsPath: path.join(base, "nope", "models.json"),
    });

    const view = (await api.dispatch("opencodeAuth")) as { available: { id: string; baseURL: string }[] };
    expect(view.available).toHaveLength(1);
    expect(view.available[0]).toMatchObject({ id: "opencode-go", baseURL: "https://opencode.ai/zen/go/v1" });

    const imported = (await api.dispatch("importOpencode", {})) as { provider: string; model: string };
    expect(imported.provider).toBe("opencode-go");

    const saved = JSON.parse(await readFile(path.join(configDir, "agent.json"), "utf8")) as {
      baseURL: string;
      apiKey: string;
      model: string;
    };
    expect(saved).toMatchObject({
      baseURL: "https://opencode.ai/zen/go/v1",
      apiKey: "test-key-123",
      model: "deepseek-v4-flash",
    });

    const config = (await api.dispatch("agent")) as { hasApiKey: boolean; configured: boolean };
    expect(config.hasApiKey).toBe(true);
    expect(config.configured).toBe(true);
  });
});

describe("workspace management", () => {
  async function makeTwo(): Promise<{ a: string; b: string; api: MyBlogApi }> {
    const base = await mkdtemp(path.join(tmpdir(), "myblog-ws-"));
    roots.push(base);
    const a = path.join(base, "ws-a");
    const b = path.join(base, "ws-b");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, "PROGRESS.md"), "# a\n", "utf8");
    await writeFile(path.join(b, "PROGRESS.md"), "# b\n", "utf8");
    const api = createApi({ root: a, agentConfigPath: path.join(base, "config", "agent.json") });
    await api.dispatch("addWorkspace", { path: b });
    await api.dispatch("setWorkspace", { path: a });
    return { a, b, api };
  }

  it("可以给工作区起别名、清空别名", async () => {
    const { a, api } = await makeTwo();

    const renamed = (await api.dispatch("renameWorkspace", { path: a, name: "  手机逆向  " })) as {
      names: Record<string, string>;
    };
    expect(renamed.names[a]).toBe("手机逆向");

    const cleared = (await api.dispatch("renameWorkspace", { path: a, name: "" })) as {
      names: Record<string, string>;
    };
    expect(cleared.names[a]).toBeUndefined();
  });

  it("移除工作区：从列表去掉并保留别名以外的数据", async () => {
    const { a, b, api } = await makeTwo();
    await api.dispatch("renameWorkspace", { path: b, name: "备用" });

    const after = (await api.dispatch("removeWorkspace", { path: b })) as {
      list: string[];
      active: string;
      names: Record<string, string>;
    };

    expect(after.list).toEqual([a]);
    expect(after.active).toBe(a);
    expect(after.names[b]).toBeUndefined();
    expect(existsSync(b)).toBe(true);
  });

  it("移除当前工作区会切到剩下的那个", async () => {
    const { a, b, api } = await makeTwo();
    const after = (await api.dispatch("removeWorkspace", { path: a })) as { list: string[]; active: string };
    expect(after.list).toEqual([b]);
    expect(after.active).toBe(b);
  });

  it("至少要保留一个工作区，且不能操作白名单外的路径", async () => {
    const { a, api } = await makeTwo();
    await api.dispatch("removeWorkspace", { path: a });
    const names = (await api.dispatch("workspaces")) as { list: string[] };
    const only = names.list[0] as string;

    await expect(api.dispatch("removeWorkspace", { path: only })).rejects.toThrow("至少要保留一个工作区");
    await expect(api.dispatch("renameWorkspace", { path: "C:/not-listed", name: "x" })).rejects.toThrow("白名单");
  });
});

describe("agent config resolution", () => {
  it("默认/配置档/工作区文件/环境变量 的优先级", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "myblog-agent-"));
    roots.push(base);
    const root = path.join(base, "ws");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "PROGRESS.md"), "# x\n", "utf8");
    const api = createApi({ root, agentConfigPath: path.join(base, "config", "agent.json") });

    // 1）默认（全局 agent.json）
    await api.dispatch("saveAgent", { baseURL: "https://default.example/v1", model: "m-default", apiKey: "k-default" });
    let view = (await api.dispatch("agent")) as { source: string; baseURL: string; hasApiKey: boolean };
    expect(view).toMatchObject({ source: "default", baseURL: "https://default.example/v1", hasApiKey: true });

    // 2）配置档 + 绑定
    await api.dispatch("saveAgent", {
      baseURL: "https://profile.example/v1",
      model: "m-profile",
      apiKey: "k-profile",
      target: "profile",
      profile: "本地 Ollama",
    });
    view = (await api.dispatch("agent")) as { source: string };
    expect(view.source).toBe("default");

    const bound = (await api.dispatch("bindWorkspaceProfile", { profile: "本地 Ollama" })) as { bound: string };
    expect(bound.bound).toBe("本地 Ollama");
    view = (await api.dispatch("agent")) as { source: string; baseURL: string; profile: string };
    expect(view).toMatchObject({ source: "profile", baseURL: "https://profile.example/v1", profile: "本地 Ollama" });

    // 3）工作区文件优先于配置档
    await writeFile(
      path.join(root, "myblog.agent.json"),
      JSON.stringify({ baseURL: "https://file.example/v1", model: "m-file" }),
      "utf8",
    );
    view = (await api.dispatch("agent")) as { source: string; baseURL: string };
    expect(view).toMatchObject({ source: "workspace-file", baseURL: "https://file.example/v1" });

    // 4）环境变量最优先
    process.env.MYBLOG_AGENT_BASE_URL = "https://env.example/v1";
    process.env.MYBLOG_AGENT_MODEL = "m-env";
    try {
      view = (await api.dispatch("agent")) as { source: string; baseURL: string };
      expect(view).toMatchObject({ source: "env", baseURL: "https://env.example/v1" });
    } finally {
      delete process.env.MYBLOG_AGENT_BASE_URL;
      delete process.env.MYBLOG_AGENT_MODEL;
    }

    // 5）删掉配置档会同时解除绑定
    await api.dispatch("deleteProfile", { profile: "本地 Ollama" });
    const after = (await api.dispatch("bindWorkspaceProfile", { profile: "" })) as { bound: string };
    expect(after.bound).toBe("");
  });

  it("存储路径校验：拒绝盘符根目录与「目录当文件」", async () => {
    const { root, api } = await makeApi();
    const rootDir = path.parse(path.resolve(root)).root;

    await expect(api.dispatch("saveStorage", { agentConfigPath: rootDir })).rejects.toThrow("盘符根目录");
    await expect(api.dispatch("saveStorage", { agentConfigPath: root })).rejects.toThrow("不要填目录");

    const file = path.join(root, "not-a-dir.txt");
    await writeFile(file, "x", "utf8");
    await expect(api.dispatch("saveStorage", { historyDir: file })).rejects.toThrow("不能是文件");
  });
});

describe("git", () => {
  it("未初始化时返回 isRepo=false", async () => {
    const { api } = await makeApi();
    const state = (await api.dispatch("git")) as { isRepo: boolean };
    expect(state.isRepo).toBe(false);
    await expect(api.dispatch("gitCommit", { message: "x" })).rejects.toThrow("不是 git 仓库");
  });

  it("初始化后能读到状态并提交", async () => {
    if (!gitAvailable) return;
    const { root, api } = await makeApi();
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
    await exec("git", ["config", "user.name", "Test"], { cwd: root });
    await writeFile(path.join(root, "a.md"), "hello", "utf8");

    const state = (await api.dispatch("git")) as { isRepo: boolean; dirty: number; suggested: string };
    expect(state.isRepo).toBe(true);
    expect(state.dirty).toBeGreaterThan(0);

    const committed = (await api.dispatch("gitCommit", { message: "test: 初始化" })) as { ok: boolean };
    expect(committed.ok).toBe(true);

    const after = (await api.dispatch("git")) as { dirty: number };
    expect(after.dirty).toBe(0);
  });
});
