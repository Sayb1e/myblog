import { describe, expect, it } from "vitest";
import { activeStageIds, getCapability, parseGoals, updateCapabilityStatus } from "../src/goals.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("GOALS.md");

describe("parseGoals", () => {
  it("parses the current stage, capabilities and order", () => {
    const goals = parseGoals(raw);
    expect(goals.stageIds).toEqual(["G3"]);
    expect(goals.capabilities).toHaveLength(12);
    expect(getCapability(goals, "G3")).toMatchObject({ name: "Hook" });
    expect(getCapability(goals, "G99")).toBeUndefined();
    expect(goals.order.length).toBeGreaterThan(0);
  });
});

describe("activeStageIds", () => {
  it("prefers the bold current stage and ignores closed stages", () => {
    expect(activeStageIds("**G3**：真机动态 Hook（G2 已于 09-17 闭环）。")).toEqual(["G3"]);
  });

  it("falls back to every id when nothing is bold", () => {
    expect(activeStageIds("现在 G3，之后 G4")).toEqual(["G3", "G4"]);
  });
});

describe("updateCapabilityStatus", () => {
  it("replaces only the status cell of the target row", () => {
    const next = updateCapabilityStatus(raw, "G3", "进行中");
    expect(next).not.toBe(raw);
    expect(getCapability(parseGoals(next), "G3")?.status).toBe("进行中");
    expect(getCapability(parseGoals(next), "G2")?.status).toBe("已闭环");
    expect(next.split(/\r?\n/).length).toBe(raw.split(/\r?\n/).length);
  });

  it("keeps line endings untouched", () => {
    const crlf = raw.replace(/\r?\n/g, "\r\n");
    const next = updateCapabilityStatus(crlf, "G3", "进行中");
    expect(next.includes("\r\n")).toBe(true);
    expect(next.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("is a no-op for unknown ids or identical status", () => {
    expect(updateCapabilityStatus(raw, "G99", "进行中")).toBe(raw);
    expect(updateCapabilityStatus(raw, "G3", "未开始")).toBe(raw);
  });
});
