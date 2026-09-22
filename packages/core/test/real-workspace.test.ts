import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addRecord, parseOverview, updateProgress } from "../src/overview.js";

const realRoot = process.env.MYBLOG_REAL_ROOT;
const suite = realRoot && existsSync(path.join(realRoot, "PROGRESS.md")) ? describe : describe.skip;

suite("real workspace (set MYBLOG_REAL_ROOT to enable)", () => {
  const overviewPath = path.join(realRoot ?? "", "PROGRESS.md");

  it("parses the real overview", () => {
    const doc = parseOverview(readFileSync(overviewPath, "utf8"));
    expect(doc.records.length).toBeGreaterThan(0);
    expect(doc.progress.learned).not.toBe("");
  });

  it("updateProgress touches exactly one line", () => {
    const raw = readFileSync(overviewPath, "utf8");
    const updated = updateProgress(raw, { next: "（fixture 测试值）" });
    const before = raw.split("\n");
    const after = updated.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, index) => (line === before[index] ? [] : [index]));
    expect(changed).toHaveLength(1);
    expect(after[changed[0] ?? -1]).toBe("下次从哪继续：（fixture 测试值）");
  });

  it("addRecord is a pure insertion", () => {
    const raw = readFileSync(overviewPath, "utf8");
    const row = "| 1999-01-01 | fixture | [总结](./1999-01-01/总结.md) |";
    const updated = addRecord(raw, {
      date: "1999-01-01",
      didWhat: "fixture",
      link: "./1999-01-01/总结.md",
      linkText: "总结",
    });
    expect(updated.replace(`${row}\n`, "")).toBe(raw);
  });
});
