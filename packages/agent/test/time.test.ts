import { describe, expect, it } from "vitest";
import { currentTimeLine } from "../src/time.js";

describe("currentTimeLine", () => {
  it("formats the local time and tells the model not to guess", () => {
    const line = currentTimeLine(new Date(2026, 8, 26, 9, 5)); // 2026-09-26 09:05 本地时间
    expect(line).toContain("2026-09-26");
    expect(line).toContain("09:05");
    expect(line).toContain("当前系统时间");
    expect(line).toContain("不要自己编造");
  });

  it("pads single-digit month, day, hour and minute", () => {
    const line = currentTimeLine(new Date(2026, 0, 3, 4, 7)); // 2026-01-03 04:07
    expect(line).toContain("2026-01-03");
    expect(line).toContain("04:07");
  });
});
