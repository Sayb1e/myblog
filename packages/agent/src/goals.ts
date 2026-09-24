import { parseGoals } from "@myblog/core";
import { inferFormat, type AgentConfig } from "./config.js";
import {
  streamCompletion,
  streamCompletionAnthropic,
  type ChatMessage,
  type ProviderEvent,
} from "./provider.js";

export interface GoalsDraftInput {
  text: string;
}

export interface GoalsValidation {
  ok: boolean;
  capabilities: number;
  problems: string[];
}

export interface GoalsDraftResult {
  markdown: string;
  attempts: number;
  validation: GoalsValidation;
}

export const GOALS_DRAFT_SYSTEM = [
  "你在帮用户把「想学什么」整理成一份学习地图，输出 Markdown 文件 GOALS.md 的完整内容。",
  "",
  "硬性格式要求（必须完全一致）：",
  "1. 必须有一级标题 `# 学习目标（学习地图，不是进度表）`。",
  "2. 必须有二级标题 `## 当前阶段`，正文用 `**G1**：一句话` 指出当前该打的阶段。",
  "3. 必须有二级标题 `## 能力编号`，紧接着一张四列表格，表头为 `| 编号 | 能力 | 要能回答什么 | 当前状态 |`，分隔行为 `|---|---|---|---|`；数据行编号用 G1、G2… 从 G1 连续递增，不能跳号；「当前状态」只能填 `未开始` / `进行中` / `已闭环`。",
  "4. 必须有二级标题 `## 阶段顺序`，用有序列表写 `1. **现在**：G1`、`2. **之后**：G2 → G3`。",
  "",
  "内容要求：",
  "- 根据用户的自述拆出 3–8 个可验证的能力，从基础到进阶，每个能力一行。",
  "- 「要能回答什么」写成这个能力是否掌握的自检问题，简短具体。",
  "- 只输出 Markdown 本身，不要代码块围栏，不要任何解释或前后缀文字。",
].join("\n");

export function buildGoalsDraftMessages(input: GoalsDraftInput): ChatMessage[] {
  const text = input.text.trim();
  return [
    { role: "system", content: GOALS_DRAFT_SYSTEM },
    {
      role: "user",
      content: `这是我的学习想法，请据此生成 GOALS.md：\n\n${text || "（用户没写具体内容，请给出一份通用的入门学习地图）"}`,
    },
  ];
}

/** 去掉代码块围栏和开头寒暄，只留 Markdown 正文 */
export function extractGoalsMarkdown(raw: string): string {
  let text = raw.trim();
  const heading = text.search(/^#\s/m);
  if (heading > 0) text = text.slice(heading).trim();

  const fenced = /^```[a-zA-Z0-9]*\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(text);
  if (fenced) text = (fenced[1] ?? "").trim();
  else text = text.replace(/\r?\n```\s*$/, "").trim();
  return text;
}

export function validateGoalsDraft(raw: string): GoalsValidation {
  const problems: string[] = [];
  const goals = parseGoals(raw);
  const capabilities = goals.capabilities.filter((capability) => capability.id !== "");

  if (capabilities.length === 0) {
    problems.push("没有解析到「能力编号」表格（需要 `## 能力编号` 和四列表格）");
  }

  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (!/^G\d+$/.test(capability.id)) problems.push(`能力编号「${capability.id}」应为 G1、G2 这种`);
    else if (seen.has(capability.id)) problems.push(`能力编号「${capability.id}」重复`);
    else seen.add(capability.id);
    if (capability.name.trim() === "") problems.push(`能力 ${capability.id} 缺少名称`);
  }

  return { ok: problems.length === 0, capabilities: capabilities.length, problems };
}

type Completion = (messages: ChatMessage[], signal?: AbortSignal) => AsyncGenerator<ProviderEvent>;

export interface GoalsDraftOptions {
  signal?: AbortSignal;
  /** 测试注入；默认走真实模型 */
  complete?: Completion;
  maxAttempts?: number;
}

export async function draftGoals(
  config: AgentConfig,
  input: GoalsDraftInput,
  options: GoalsDraftOptions = {},
): Promise<GoalsDraftResult> {
  const signal = options.signal;
  const maxAttempts = options.maxAttempts ?? 2;
  const complete =
    options.complete ??
    ((messages, inner) =>
      (inferFormat(config) === "anthropic" ? streamCompletionAnthropic : streamCompletion)(
        config,
        messages,
        [],
        inner,
      ));

  const messages = buildGoalsDraftMessages(input);
  let markdown = "";
  let validation: GoalsValidation = { ok: false, capabilities: 0, problems: ["尚未生成"] };
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    let text = "";
    for await (const event of complete(messages, signal)) {
      if (event.type === "text") text += event.text;
    }
    markdown = extractGoalsMarkdown(text);
    validation = validateGoalsDraft(markdown);
    if (validation.ok || attempt === maxAttempts) break;
    messages.push({ role: "assistant", content: text || markdown });
    messages.push({
      role: "user",
      content: `上面的输出格式不对：${validation.problems.join("；")}。请只输出修正后的完整 Markdown，不要解释。`,
    });
  }

  return { markdown, attempts, validation };
}
