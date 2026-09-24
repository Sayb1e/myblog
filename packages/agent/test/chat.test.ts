import { describe, expect, it } from "vitest";
import type { ContextBundle } from "@myblog/core";
import { summarizeContext } from "../src/chat.js";

function bundle(): ContextBundle {
  return {
    root: "/w",
    initialized: true,
    stage: "G3",
    stageIds: ["G3"],
    active: [{ id: "G3", name: "Hook", question: "?", status: "未开始", active: true }],
    next: "写脚本",
    lastDate: "2026-09-17",
    lastNext: "1. 起 Frida",
    lastSkills: ["G1", "G2"],
    progress: { learned: "环境全通", next: "写脚本", latest: "[2026-09-17](./2026-09-17/SUMMARY.md)" },
    records: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-09-0${index + 1}`,
      didWhat: "x",
      link: "",
      linkText: "",
    })),
    directions: ["G1 环境"],
    capabilities: Array.from({ length: 12 }, (_, index) => ({
      id: `G${index + 1}`,
      name: "n",
      question: "q",
      status: "未开始",
      active: false,
    })),
    missing: [],
    check: { ok: true, issues: [] },
  } as unknown as ContextBundle;
}

describe("summarizeContext", () => {
  it("keeps active capabilities but drops the full list and check issues", () => {
    const out = summarizeContext(bundle());
    expect(out).not.toHaveProperty("capabilities");
    expect(out).not.toHaveProperty("check");
    expect(out.capabilityCount).toBe(12);
    expect(out.active).toHaveLength(1);
  });

  it("limits recent records to five", () => {
    const out = summarizeContext(bundle());
    expect((out.recentRecords as unknown[]).length).toBe(5);
  });
});
