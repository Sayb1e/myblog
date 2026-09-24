import { describe, expect, it } from "vitest";
import {
  buildGoalsDraftMessages,
  draftGoals,
  extractGoalsMarkdown,
  validateGoalsDraft,
} from "../src/goals.js";
import type { ProviderEvent } from "../src/provider.js";

const GOOD = [
  "# 学习目标（学习地图，不是进度表）",
  "",
  "## 当前阶段",
  "",
  "**G1**：打好工具与环境的基础。",
  "",
  "## 能力编号",
  "",
  "| 编号 | 能力 | 要能回答什么 | 当前状态 |",
  "|---|---|---|---|",
  "| G1 | 环境 | 能跑通 hello world 吗 | 未开始 |",
  "| G2 | 基础 | 能解释核心概念吗 | 未开始 |",
  "",
  "## 阶段顺序",
  "",
  "1. **现在**：G1",
  "2. **之后**：G2",
].join("\n");

const BROKEN = "# 学习目标\n\n随便写点什么，没有表格。";

function fakeComplete(...responses: string[]) {
  let index = 0;
  return async function* complete(): AsyncGenerator<ProviderEvent> {
    const text = responses[index] ?? responses[responses.length - 1] ?? "";
    index += 1;
    yield { type: "text", text };
    yield { type: "message", message: { role: "assistant", content: text } };
  };
}

const config = { baseURL: "https://example.com/v1", apiKey: "k", model: "m" };

describe("buildGoalsDraftMessages", () => {
  it("pins the required headings and carries the user text", () => {
    const messages = buildGoalsDraftMessages({ text: "我想学安卓逆向" });
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("## 能力编号");
    expect(messages[1]?.content).toContain("我想学安卓逆向");
  });
});

describe("extractGoalsMarkdown", () => {
  it("keeps a clean markdown document untouched", () => {
    expect(extractGoalsMarkdown(GOOD)).toBe(GOOD);
  });

  it("strips leading prose and a wrapping fence", () => {
    expect(extractGoalsMarkdown(`好的，这是结果：\n\n\`\`\`markdown\n${GOOD}\n\`\`\``)).toBe(GOOD);
  });

  it("strips a bare wrapping fence", () => {
    expect(extractGoalsMarkdown("```markdown\n" + GOOD + "\n```")).toBe(GOOD);
  });
});

describe("validateGoalsDraft", () => {
  it("passes a well-formed document", () => {
    const result = validateGoalsDraft(GOOD);
    expect(result.ok).toBe(true);
    expect(result.capabilities).toBe(2);
    expect(result.problems).toEqual([]);
  });

  it("reports a missing capability table", () => {
    const result = validateGoalsDraft(BROKEN);
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it("rejects non-G ids", () => {
    const doc = [
      "## 能力编号",
      "| 编号 | 能力 | 要能回答什么 | 当前状态 |",
      "|---|---|---|---|",
      "| A1 | 环境 | 能跑通吗 | 未开始 |",
    ].join("\n");
    expect(validateGoalsDraft(doc).ok).toBe(false);
  });
});

describe("draftGoals", () => {
  it("returns the parsed document when the first attempt is valid", async () => {
    const result = await draftGoals(config, { text: "x" }, { complete: fakeComplete(GOOD) });
    expect(result.attempts).toBe(1);
    expect(result.validation.ok).toBe(true);
    expect(result.markdown).toBe(GOOD);
  });

  it("retries once with feedback when the first attempt is broken", async () => {
    const result = await draftGoals(config, { text: "x" }, { complete: fakeComplete(BROKEN, GOOD) });
    expect(result.attempts).toBe(2);
    expect(result.validation.ok).toBe(true);
    expect(result.markdown).toBe(GOOD);
  });

  it("gives up after maxAttempts but still returns the last markdown", async () => {
    const result = await draftGoals(config, { text: "x" }, { complete: fakeComplete(BROKEN, BROKEN) });
    expect(result.attempts).toBe(2);
    expect(result.validation.ok).toBe(false);
    expect(result.markdown).toBe(BROKEN);
  });
});
