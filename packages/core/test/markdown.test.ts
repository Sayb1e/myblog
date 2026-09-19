import { describe, expect, it } from "vitest";
import {
  getSection,
  readLabeledParagraph,
  splitSections,
  upsertLabeledParagraph,
} from "../src/markdown.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("学习进度总览.md");

describe("splitSections", () => {
  it("ignores headings inside fenced code blocks", () => {
    const titles = splitSections(raw).map((section) => section.title);
    expect(titles).toContain("现在学到哪了");
    expect(titles).toContain("工具与环境备忘");
    expect(titles).not.toContain("前情提要");
    expect(titles).not.toContain("这次");
    expect(titles).not.toContain("下次从哪继续");
  });
});

describe("labeled paragraphs", () => {
  it("reads each label from its own blank-line separated paragraph", () => {
    const section = getSection(raw, "现在学到哪了");
    expect(section).toBeDefined();
    const body = section?.body ?? "";
    expect(readLabeledParagraph(body, "学到哪了")).toBe("环境全通（G1）——工具都装好了。");
    expect(readLabeledParagraph(body, "下次从哪继续")).toBe("写脚本 Hook Demo（G3）。");
    expect(readLabeledParagraph(body, "最近一次")).toBe("[2026-09-17](./2026-09-17/总结.md)");
    expect(readLabeledParagraph(body, "不存在")).toBe("");
  });

  it("upserts in place without swallowing neighbouring lines", () => {
    const body = getSection(raw, "现在学到哪了")?.body ?? "";
    const updated = upsertLabeledParagraph(body, "下次从哪继续", "新目标");
    expect(updated.split("\n")).toHaveLength(body.split("\n").length);
    expect(updated).toContain("下次从哪继续：新目标");
    expect(updated).toContain("学到哪了：环境全通（G1）——工具都装好了。");
    expect(updated).toContain("最近一次：[2026-09-17](./2026-09-17/总结.md)");
  });

  it("appends a label when missing", () => {
    const body = "第一段\n\n第二段\n";
    const updated = upsertLabeledParagraph(body, "标签", "值");
    expect(updated.endsWith("标签：值\n")).toBe(true);
    expect(readLabeledParagraph(updated, "标签")).toBe("值");
  });
});
