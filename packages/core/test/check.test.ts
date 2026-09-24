import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code).sort();
}

describe("Workspace.check", () => {
  it("passes on the clean fixture", async () => {
    const result = await (await Workspace.load(root)).check();
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("reports missing summaries, stray files, undefined ids and broken links", async () => {
    const workspace = await Workspace.load(root);
    await mkdir(path.join(root, "2026-09-15"));
    await writeFile(path.join(root, "evil.apk"), "x");

    const raw = readFileSync(workspace.overviewPath, "utf8");
    const mutated = raw
      .replace(
        "3. **G3 动态 Hook**：Frida Hook / 主动调用",
        "3. **G99 动态 Hook**：Frida Hook / 主动调用",
      )
      .replace(
        "| 2026-09-13 | 对齐转岗背景和方向。 | [总结](./2026-09-13/SUMMARY.md) |",
        "| 2026-09-12 | 坏链 | [总结](./2026-09-12/SUMMARY.md) |",
      )
      .replace("最近一次：[2026-09-17](./2026-09-17/SUMMARY.md)", "最近一次：[2026-09-17](./2026-09-99/SUMMARY.md)");
    await writeFile(workspace.overviewPath, mutated, "utf8");

    const result = await workspace.check();
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toEqual([
      "broken-latest",
      "broken-record",
      "missing-summary",
      "stray-attachment",
      "undefined-skill",
    ]);
  });
});
