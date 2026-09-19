import { describe, expect, it } from "vitest";
import { addRecord, parseOverview, updateProgress } from "../src/overview.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("学习进度总览.md");

describe("parseOverview", () => {
  it("parses progress, records, directions and tools", () => {
    const doc = parseOverview(raw);
    expect(doc.progress.learned).toContain("环境全通");
    expect(doc.progress.next).toBe("写脚本 Hook Demo（G3）。");
    expect(doc.progress.latest).toBe("[2026-09-17](./2026-09-17/总结.md)");
    expect(doc.records).toHaveLength(2);
    expect(doc.records[0]).toMatchObject({
      date: "2026-09-17",
      link: "./2026-09-17/总结.md",
      linkText: "总结",
    });
    expect(doc.records[0]?.didWhat).toContain("G2 闭环");
    expect(doc.directions).toHaveLength(3);
    expect(doc.tools.length).toBeGreaterThan(0);
  });
});

describe("updateProgress", () => {
  it("changes only the target line and preserves every other byte", () => {
    const updated = updateProgress(raw, { next: "新目标" });
    const before = raw.split("\n");
    const after = updated.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, index) => (line === before[index] ? [] : [index]));
    expect(changed).toHaveLength(1);
    expect(after[changed[0] ?? -1]).toBe("下次从哪继续：新目标");
  });

  it("throws when the section is missing", () => {
    expect(() => updateProgress("# 空\n", { next: "x" })).toThrow();
  });
});

describe("addRecord", () => {
  it("is a pure single-line insertion", () => {
    const row = "| 2026-09-18 | Frida Hook 闭环 | [总结](./2026-09-18/总结.md) |";
    const updated = addRecord(raw, {
      date: "2026-09-18",
      didWhat: "Frida Hook 闭环",
      link: "./2026-09-18/总结.md",
      linkText: "总结",
    });
    expect(updated.replace(`${row}\n`, "")).toBe(raw);
    const lines = updated.split("\n");
    expect(lines[lines.indexOf("| 日期 | 这次做了什么 | 链接 |") + 2]).toBe(row);
  });
});
