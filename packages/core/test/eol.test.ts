import { describe, expect, it } from "vitest";
import { detectEol, upsertLabeledParagraph } from "../src/markdown.js";
import { addRecord, parseOverview, updateProgress } from "../src/overview.js";
import { readFixture } from "./helpers.js";

const lf = readFixture("PROGRESS.md");
const crlf = lf.replace(/\n/g, "\r\n");

function loneLf(text: string): number {
  return (text.match(/(?<!\r)\n/g) ?? []).length;
}

describe("detectEol", () => {
  it("picks the dominant line ending", () => {
    expect(detectEol(lf)).toBe("\n");
    expect(detectEol(crlf)).toBe("\r\n");
    expect(detectEol("a\r\nb\r\nc\n")).toBe("\r\n");
    expect(detectEol("单行没有换行")).toBe("\n");
  });
});

describe("EOL preservation on write", () => {
  it("updateProgress keeps CRLF and only touches the target line", () => {
    const updated = updateProgress(crlf, { next: "新目标" });
    expect(loneLf(updated)).toBe(0);
    const before = crlf.split("\r\n");
    const after = updated.split("\r\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, index) => (line === before[index] ? [] : [index]));
    expect(changed).toHaveLength(1);
  });

  it("addRecord keeps CRLF and is a pure insertion", () => {
    const row = "| 2026-09-18 | Frida Hook 闭环 | [总结](./2026-09-18/总结.md) |";
    const updated = addRecord(crlf, {
      date: "2026-09-18",
      didWhat: "Frida Hook 闭环",
      link: "./2026-09-18/总结.md",
      linkText: "总结",
    });
    expect(loneLf(updated)).toBe(0);
    expect(updated.replace(`${row}\r\n`, "")).toBe(crlf);
  });

  it("parses CRLF documents", () => {
    const doc = parseOverview(crlf);
    expect(doc.progress.next).toBe("写脚本 Hook Demo（G3）。");
    expect(doc.records).toHaveLength(2);
  });

  it("normalizes value newlines to the body EOL", () => {
    const body = "学到哪了：旧\r\n\r\n下次从哪继续：x\r\n";
    const updated = upsertLabeledParagraph(body, "学到哪了", "a\nb");
    expect(updated).toContain("学到哪了：a\r\nb");
    expect(loneLf(updated)).toBe(0);
  });
});
