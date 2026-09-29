import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Workspace } from "@myblog/core";
import { afterEach, describe, expect, it } from "vitest";
import { executeTool, toolSpecs } from "../src/tools.js";

const roots: string[] = [];

afterEach(async () => {
  roots.length = 0;
});

async function makeWorkspace(): Promise<Workspace> {
  const base = await mkdtemp(path.join(tmpdir(), "myblog-agent-"));
  roots.push(base);
  return Workspace.load(base);
}

describe("toolSpecs", () => {
  it("暴露 fs 读写工具", () => {
    const names = toolSpecs().map((spec) => spec.function.name);
    expect(names).toContain("fs_list");
    expect(names).toContain("fs_read");
    expect(names).toContain("fs_write");
  });
});

describe("fs_write", () => {
  it("dryRun 只返回 diff，不落盘", async () => {
    const workspace = await makeWorkspace();
    const result = (await executeTool(workspace, "fs_write", {
      path: "scripts/hello.java",
      content: "class Hello {}\n",
    })) as { dryRun: boolean; created: boolean; diff: string[] };

    expect(result.dryRun).toBe(true);
    expect(result.created).toBe(true);
    expect(result.diff.length).toBeGreaterThan(0);
    expect(existsSync(path.join(workspace.root, "scripts", "hello.java"))).toBe(false);
  });

  it("dryRun:false 时创建目录并写入", async () => {
    const workspace = await makeWorkspace();
    const result = (await executeTool(workspace, "fs_write", {
      path: "scripts/hello.java",
      content: "class Hello {}\n",
      dryRun: false,
    })) as { dryRun: boolean; created: boolean };

    expect(result.dryRun).toBe(false);
    expect(result.created).toBe(true);
    expect(await readFile(path.join(workspace.root, "scripts", "hello.java"), "utf8")).toBe("class Hello {}\n");
  });

  it("保留已存在文件的 CRLF 行尾", async () => {
    const workspace = await makeWorkspace();
    const target = path.join(workspace.root, "note.md");
    await writeFile(target, "a\r\nb\r\n", "utf8");

    await executeTool(workspace, "fs_write", { path: "note.md", content: "a\nc\n", dryRun: false });

    expect(await readFile(target, "utf8")).toBe("a\r\nc\r\n");
  });

  it("拒绝越界路径", async () => {
    const workspace = await makeWorkspace();
    const absolutePath = process.platform === "win32" ? "C:/evil.txt" : "/etc/evil.txt";
    const escaped = (await executeTool(workspace, "fs_write", { path: "../evil.txt", content: "x" })) as { error?: string };
    const absolute = (await executeTool(workspace, "fs_write", { path: absolutePath, content: "x" })) as { error?: string };

    expect(escaped.error).toContain("超出工作区");
    expect(absolute.error).toBeTruthy();
  });
});

describe("fs_read / fs_list", () => {
  it("读取文本文件", async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace.root, "a.txt"), "hello", "utf8");
    const result = (await executeTool(workspace, "fs_read", { path: "a.txt" })) as { content: string };

    expect(result.content).toBe("hello");
  });

  it("列出目录并把目录排在前面", async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace.root, "a.txt"), "hello", "utf8");
    await executeTool(workspace, "fs_write", { path: "sub/b.txt", content: "b", dryRun: false });

    const result = (await executeTool(workspace, "fs_list", {})) as { entries: { name: string; type: string }[] };
    const names = result.entries.map((entry) => entry.name);

    expect(names[0]).toBe("sub");
    expect(names).toContain("a.txt");
  });
});

describe("fs_move", () => {
  it("暴露 fs_move 工具", () => {
    expect(toolSpecs().map((spec) => spec.function.name)).toContain("fs_move");
  });

  it("dryRun 只返回预览，不移动", async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace.root, "a.py"), "print(1)\n", "utf8");
    const result = (await executeTool(workspace, "fs_move", { from: "a.py", to: "2026-09-26/a.py" })) as {
      dryRun: boolean;
      kind: string;
    };

    expect(result.dryRun).toBe(true);
    expect(result.kind).toBe("file");
    expect(existsSync(path.join(workspace.root, "a.py"))).toBe(true);
    expect(existsSync(path.join(workspace.root, "2026-09-26", "a.py"))).toBe(false);
  });

  it("dryRun:false 移动文件并创建父目录", async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace.root, "a.py"), "print(1)\n", "utf8");
    await executeTool(workspace, "fs_move", { from: "a.py", to: "2026-09-26/a.py", dryRun: false });

    expect(existsSync(path.join(workspace.root, "a.py"))).toBe(false);
    expect(await readFile(path.join(workspace.root, "2026-09-26", "a.py"), "utf8")).toBe("print(1)\n");
  });

  it("目标已存在时报错，不覆盖", async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace.root, "a.txt"), "A", "utf8");
    await writeFile(path.join(workspace.root, "b.txt"), "B", "utf8");
    const result = (await executeTool(workspace, "fs_move", { from: "a.txt", to: "b.txt", dryRun: false })) as {
      error?: string;
    };

    expect(result.error).toContain("已存在");
    expect(await readFile(path.join(workspace.root, "a.txt"), "utf8")).toBe("A");
    expect(await readFile(path.join(workspace.root, "b.txt"), "utf8")).toBe("B");
  });

  it("拒绝越界路径", async () => {
    const workspace = await makeWorkspace();
    const result = (await executeTool(workspace, "fs_move", { from: "a.txt", to: "../evil.txt" })) as { error?: string };
    expect(result.error).toContain("超出工作区");
  });
});
