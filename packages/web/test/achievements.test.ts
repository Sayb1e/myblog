import { describe, expect, it } from "vitest";
import {
  GROUP_ORDER,
  computeAchievements,
  progressRatio,
  progressText,
  type Achievement,
} from "../src/achievements.js";
import { ACHIEVEMENT_ICONS } from "../src/components/AchievementBadge.js";
import { DEFAULT_EVENTS } from "../src/events.js";

const base = {
  summaryCount: 0,
  currentStreak: 0,
  activityDays: 0,
  closedCapabilities: 0,
  goalCount: 0,
  maxCapabilityDays: 0,
  chatted: false,
  pluginCount: 0,
  events: { ...DEFAULT_EVENTS },
};

function find(list: Achievement[], id: string): Achievement {
  const item = list.find((entry) => entry.id === id);
  if (!item) throw new Error(`missing achievement ${id}`);
  return item;
}

describe("computeAchievements", () => {
  it("每个成就都有徽章图标与数值进度", () => {
    const list = computeAchievements(base);
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(ACHIEVEMENT_ICONS[item.icon]).toBeTruthy();
      expect(item.target).toBeGreaterThan(0);
      expect(item.value).toBeGreaterThanOrEqual(0);
      expect(GROUP_ORDER).toContain(item.group);
    }
  });

  it("按数值门槛解锁并给出进度", () => {
    const list = computeAchievements({ ...base, summaryCount: 1 });
    expect(find(list, "note-1").done).toBe(true);
    const five = find(list, "note-5");
    expect(five.done).toBe(false);
    expect(five.value).toBe(1);
    expect(five.target).toBe(5);
    expect(progressRatio(five)).toBeCloseTo(0.2);
    expect(progressText(five)).toBe("1/5");
  });

  it("事件型成就未达成时用中文短语与 0 进度", () => {
    const terminal = find(computeAchievements(base), "terminal");
    expect(terminal.done).toBe(false);
    expect(terminal.value).toBe(0);
    expect(progressText(terminal)).toBe("待开启");
    expect(progressRatio(terminal)).toBe(0);
  });

  it("已达成成就进度恒为 1", () => {
    const list = computeAchievements({ ...base, events: { ...DEFAULT_EVENTS, terminal: true } });
    const terminal = find(list, "terminal");
    expect(terminal.done).toBe(true);
    expect(progressRatio(terminal)).toBe(1);
    expect(progressText(terminal)).toBe("已解锁");
  });

  it("进度比例被夹在 0..1", () => {
    const list = computeAchievements({ ...base, summaryCount: 99 });
    expect(progressRatio(find(list, "note-5"))).toBe(1);
  });
});
