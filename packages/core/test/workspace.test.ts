import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "../src/workspace.js";
import { makeTempWorkspace } from "./helpers.js";

let root = "";

beforeEach(async () => {
  root = await makeTempWorkspace();
});

afterEach(async () => {
  await rm(path.dirname(root), { recursive: true, force: true });
});

describe("Workspace.readStatus", () => {
  it("keeps only the bold current stage active", async () => {
    const status = await (await Workspace.load(root)).readStatus();
    expect(status.stageIds).toEqual(["G3"]);
    expect(status.capabilities.filter((capability) => capability.active).map((capability) => capability.id)).toEqual(["G3"]);
  });
});

describe("Workspace.scaffoldDay", () => {
  it("creates once and never overwrites", async () => {
    const workspace = await Workspace.load(root);
    const first = await workspace.scaffoldDay("2026-09-18", { skills: ["G3"], preview: "上次到 G3" });
    expect(first.created).toBe(true);
    const content = readFileSync(first.path, "utf8");
    expect(content).toContain("能力：G3");

    const second = await workspace.scaffoldDay("2026-09-18");
    expect(second.created).toBe(false);
    expect(readFileSync(first.path, "utf8")).toBe(content);
  });
});

describe("Workspace.closeDay", () => {
  const input = {
    date: "2026-09-18",
    learned: "Hook 通了",
    next: "进入 G4",
    didWhat: "Frida Hook 闭环",
    link: "./2026-09-18/总结.md",
    linkText: "总结",
  };

  it("does not write on dry run and is idempotent on write", async () => {
    const workspace = await Workspace.load(root);
    const before = readFileSync(workspace.overviewPath, "utf8");

    const dry = await workspace.closeDay(input, { dryRun: true });
    expect(dry.overviewChanged).toBe(true);
    expect(dry.preview).toContain("最近一次：[2026-09-18](./2026-09-18/总结.md)");
    expect(readFileSync(workspace.overviewPath, "utf8")).toBe(before);

    const first = await workspace.closeDay(input);
    expect(first).toMatchObject({ overviewChanged: true, progressUpdated: true, recordAdded: true });
    const after = readFileSync(workspace.overviewPath, "utf8");
    expect(after).toContain("最近一次：[2026-09-18](./2026-09-18/总结.md)");
    expect(after).toContain("| 2026-09-18 | Frida Hook 闭环 | [总结](./2026-09-18/总结.md) |");

    const second = await workspace.closeDay(input);
    expect(second.overviewChanged).toBe(false);
    expect(readFileSync(workspace.overviewPath, "utf8")).toBe(after);
  });

  it("does not move 最近一次 back when closing an older date", async () => {
    const workspace = await Workspace.load(root);
    await workspace.closeDay({ date: "2026-09-18", link: "./2026-09-18/总结.md" });

    const afterNew = readFileSync(workspace.overviewPath, "utf8");
    expect(afterNew).toContain("最近一次：[2026-09-18](./2026-09-18/总结.md)");

    await workspace.closeDay({ date: "2026-09-13", didWhat: "补记", link: "./2026-09-13/extra.md", linkText: "总结" });
    const afterOld = readFileSync(workspace.overviewPath, "utf8");
    expect(afterOld).toContain("最近一次：[2026-09-18](./2026-09-18/总结.md)");
    expect(afterOld).toContain("| 2026-09-13 | 补记 | [总结](./2026-09-13/extra.md) |");
  });
});
