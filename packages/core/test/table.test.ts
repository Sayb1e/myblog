import { describe, expect, it } from "vitest";
import { getSection } from "../src/markdown.js";
import {
  escapeCell,
  findFirstTable,
  insertTableRow,
  parseLink,
  splitTableRow,
} from "../src/table.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("PROGRESS.md");

describe("findFirstTable", () => {
  it("returns absolute offsets relative to the passed raw markdown", () => {
    const section = getSection(raw, "学习记录");
    expect(section).toBeDefined();
    const table = findFirstTable(section?.body ?? "", section?.bodyStart ?? 0);
    expect(table).not.toBeNull();
    expect(raw.slice(table?.start, (table?.start ?? 0) + (table?.headerLine.length ?? 0))).toBe(
      "| 日期 | 这次做了什么 | 链接 |",
    );
    expect(raw.slice(table?.end ?? 0)).toMatch(/^\n/);
    expect(table?.rows).toHaveLength(2);
  });

  it("returns null when there is no table", () => {
    expect(findFirstTable("没有表格\n只有文字\n")).toBeNull();
  });
});

describe("insertTableRow", () => {
  it("inserts at the top right below the separator and keeps the rest byte-identical", () => {
    const section = getSection(raw, "学习记录");
    const table = findFirstTable(section?.body ?? "", section?.bodyStart ?? 0);
    expect(table).not.toBeNull();
    if (!table) return;

    const row = "| 2026-09-18 | Frida Hook 闭环 | [总结](./2026-09-18/总结.md) |";
    const updated = insertTableRow(raw, table, ["2026-09-18", "Frida Hook 闭环", "[总结](./2026-09-18/总结.md)"]);
    const lines = updated.split("\n");
    const headerIndex = lines.indexOf("| 日期 | 这次做了什么 | 链接 |");
    expect(lines[headerIndex + 2]).toBe(row);
    expect(updated.replace(`${row}\n`, "")).toBe(raw);
  });

  it("inserts at the bottom when requested", () => {
    const section = getSection(raw, "学习记录");
    const table = findFirstTable(section?.body ?? "", section?.bodyStart ?? 0);
    expect(table).not.toBeNull();
    if (!table) return;

    const row = "| 2026-09-18 | 新 | [总结](./2026-09-18/总结.md) |";
    const updated = insertTableRow(raw, table, ["2026-09-18", "新", "[总结](./2026-09-18/总结.md)"], "bottom");
    expect(updated.replace(`${row}\n`, "")).toBe(raw);
    const lines = updated.split("\n");
    expect(lines.indexOf(row)).toBe(lines.indexOf("| 2026-09-13 | 对齐转岗背景和方向。 | [总结](./2026-09-13/总结.md) |") + 1);
  });
});

describe("cells and links", () => {
  it("splits rows", () => {
    expect(splitTableRow("| a | b | c |")).toEqual(["a", "b", "c"]);
  });

  it("escapes pipes and newlines", () => {
    expect(escapeCell("a|b\nc")).toBe("a\\|b c");
  });

  it("parses markdown links", () => {
    expect(parseLink("[总结](./2026-09-17/总结.md)")).toEqual({
      text: "总结",
      target: "./2026-09-17/总结.md",
    });
    expect(parseLink("没有链接")).toBeNull();
  });
});
