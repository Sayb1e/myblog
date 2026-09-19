import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initWorkspace, parseAgents } from "../src/templates.js";

let root = "";

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "myblog-init-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("parseAgents", () => {
  it("expands all", () => {
    expect(parseAgents("all")).toEqual(["opencode", "claude", "cursor", "agents"]);
  });

  it("splits, trims and dedupes", () => {
    expect(parseAgents("opencode, claude opencode")).toEqual(["opencode", "claude"]);
  });

  it("throws on unknown agents", () => {
    expect(() => parseAgents("vscode")).toThrow();
  });
});

describe("initWorkspace", () => {
  it("writes per-agent files with frontmatter and a skill", async () => {
    const result = await initWorkspace({ root, agents: ["opencode", "claude", "cursor", "agents"] });
    expect(result.written).toHaveLength(10);

    const today = await readFile(path.join(root, ".opencode", "command", "today.md"), "utf8");
    expect(today.startsWith("---\ndescription:")).toBe(true);
    expect(today).toContain("agent: build");
    expect(today).toContain("$ARGUMENTS");

    const skill = await readFile(path.join(root, ".claude", "skills", "learning-loop", "SKILL.md"), "utf8");
    expect(skill).toContain("name: learning-loop");
  });

  it("registers the MCP server in .opencode/opencode.json", async () => {
    await initWorkspace({ root, agents: ["opencode"] });
    const file = path.join(root, ".opencode", "opencode.json");
    const config = JSON.parse(await readFile(file, "utf8")) as {
      $schema?: string;
      mcp?: Record<string, unknown>;
    };
    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(config.mcp?.myblog).toBeDefined();

    const again = await initWorkspace({ root, agents: ["opencode"] });
    expect(again.skipped).toContain(path.join(".opencode", "opencode.json"));
  });

  it("merges into an existing .opencode/opencode.json", async () => {
    await mkdir(path.join(root, ".opencode"), { recursive: true });
    await writeFile(path.join(root, ".opencode", "opencode.json"), JSON.stringify({ model: "vendor/model" }));

    await initWorkspace({ root, agents: ["opencode"] });
    const config = JSON.parse(await readFile(path.join(root, ".opencode", "opencode.json"), "utf8")) as {
      model?: string;
      mcp?: Record<string, unknown>;
    };
    expect(config.model).toBe("vendor/model");
    expect(config.mcp?.myblog).toBeDefined();
  });

  it("is idempotent and overwrites with force", async () => {
    await initWorkspace({ root, agents: ["cursor"] });
    const second = await initWorkspace({ root, agents: ["cursor"] });
    expect(second.written).toHaveLength(0);
    expect(second.skipped).toHaveLength(2);

    await writeFile(path.join(root, ".cursor", "commands", "today.md"), "custom");
    const forced = await initWorkspace({ root, agents: ["cursor"], force: true });
    expect(forced.written).toHaveLength(2);
    expect(await readFile(path.join(root, ".cursor", "commands", "today.md"), "utf8")).toContain("$ARGUMENTS");
  });

  it("upserts the managed AGENTS.md block without clobbering content", async () => {
    await writeFile(path.join(root, "AGENTS.md"), "# 我的仓库\n\n已有内容\n");
    await initWorkspace({ root, agents: ["agents"] });
    const first = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(first).toContain("# 我的仓库");
    expect(first.match(/myblog:start/g)).toHaveLength(1);

    const again = await initWorkspace({ root, agents: ["agents"] });
    expect(again.skipped).toContain("AGENTS.md");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toBe(first);
  });
});
