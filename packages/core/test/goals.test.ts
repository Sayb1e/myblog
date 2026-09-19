import { describe, expect, it } from "vitest";
import { activeStageIds, getCapability, parseGoals } from "../src/goals.js";
import { readFixture } from "./helpers.js";

const raw = readFixture("岗位目标.md");

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
