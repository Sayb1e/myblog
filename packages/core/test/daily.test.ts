import { describe, expect, it } from "vitest";
import { parseSummary, scaffoldSummary } from "../src/daily.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("2026-09-17/SUMMARY.md");

describe("parseSummary", () => {
  it("extracts date, preview, capability ids and next", () => {
    const summary = parseSummary(raw);
    expect(summary.date).toBe("2026-09-17");
    expect(summary.preview).toContain("09-16 装好");
    expect(summary.thisTime).toContain("点 check 读到 `DENIED`");
    expect(summary.skills).toEqual(["G1", "G2"]);
    expect(summary.next.split("\n")[0]).toBe("1. 起 Frida server");
  });
});

describe("scaffoldSummary", () => {
  it("renders the agreed template", () => {
    const text = scaffoldSummary("2026-09-18", { skills: ["G3"], preview: "上次到 G3", next: "Hook 完成" });
    expect(text).toContain("# 2026-09-18");
    expect(text).toContain("## 前情提要");
    expect(text).toContain("上次到 G3");
    expect(text).toContain("能力：G3");
    expect(text).toContain("## 下次从哪继续");
    expect(text.endsWith("Hook 完成\n")).toBe(true);
  });

  it("falls back to placeholders", () => {
    const text = scaffoldSummary("2026-09-18");
    expect(text).toContain("能力：G?");
  });
});
