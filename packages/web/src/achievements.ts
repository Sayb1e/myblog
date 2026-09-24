import type { CapabilityStatus } from "@myblog/core";
import type { Events } from "./events.js";

export interface Achievement {
  id: string;
  name: string;
  task: string;
  done: boolean;
  /** 未达成时的进度，如 "3/7" */
  progress?: string;
}

export interface AchievementInput {
  summaryCount: number;
  currentStreak: number;
  activityDays: number;
  capabilities: CapabilityStatus[];
  maxCapabilityDays: number;
  chatted: boolean;
  pluginCount: number;
  events: Events;
}

const CLOSED = /已闭环|已通|已完成|闭环/;

const pct = (value: number, target: number): string => `${Math.min(value, target)}/${target}`;

export function computeAchievements(input: AchievementInput): Achievement[] {
  const closed = input.capabilities.filter((capability) => CLOSED.test(capability.status)).length;
  const goals = input.capabilities.length;
  const { events } = input;

  const step = (value: number, target: number): Pick<Achievement, "done" | "progress"> =>
    value >= target ? { done: true } : { done: false, progress: pct(value, target) };

  return [
    { id: "note-1", name: "开卷有益", task: "写下第 1 篇每日总结", ...step(input.summaryCount, 1) },
    { id: "note-5", name: "笔耕不辍", task: "累计 5 篇总结", ...step(input.summaryCount, 5) },
    { id: "note-10", name: "积少成多", task: "累计 10 篇总结", ...step(input.summaryCount, 10) },
    { id: "note-30", name: "著书立说", task: "累计 30 篇总结", ...step(input.summaryCount, 30) },
    { id: "streak-3", name: "三日之约", task: "连续学习 3 天", ...step(input.currentStreak, 3) },
    { id: "streak-7", name: "七日之志", task: "连续学习 7 天", ...step(input.currentStreak, 7) },
    { id: "streak-14", name: "半月不辍", task: "连续学习 14 天", ...step(input.currentStreak, 14) },
    { id: "streak-30", name: "月满功成", task: "连续学习 30 天", ...step(input.currentStreak, 30) },
    { id: "days-100", name: "百尺竿头", task: "累计 100 天有学习进展", ...step(input.activityDays, 100) },
    { id: "g-1", name: "初窥门径", task: "闭环第 1 个能力（G）", ...step(closed, 1) },
    { id: "g-3", name: "渐入佳境", task: "闭环 3 个能力", ...step(closed, 3) },
    { id: "g-5", name: "炉火纯青", task: "闭环 5 个能力", ...step(closed, 5) },
    { id: "g-10", name: "融会贯通", task: "闭环 10 个能力", ...step(closed, 10) },
    { id: "deep-15", name: "深耕一隅", task: "同一个能力累计学习 15 天", ...step(input.maxCapabilityDays, 15) },
    {
      id: "stage-up",
      name: "更上层楼",
      task: "推进到一个新的学习阶段",
      done: events.stageAdvanced,
      ...(events.stageAdvanced ? {} : { progress: "待推进" }),
    },
    { id: "goals", name: "立下志向", task: "建立学习目标（GOALS.md 有 ≥1 个能力）", ...step(goals, 1) },
    {
      id: "goals-redraw",
      name: "蓝图重绘",
      task: "用模型重新生成过学习目标",
      done: events.goalsRewritten,
      ...(events.goalsRewritten ? {} : { progress: "待重绘" }),
    },
    { id: "chat-1", name: "问道于师", task: "第一次用 AI 规划", done: input.chatted },
    { id: "chat-20", name: "不耻下问", task: "与 AI 累计对话 20 轮", ...step(events.chats, 20) },
    {
      id: "quote-1",
      name: "温故知新",
      task: "把某天的总结引用进对话",
      ...step(events.quote, 1),
    },
    {
      id: "terminal",
      name: "工欲善其事",
      task: "第一次打开内置终端",
      done: events.terminal,
      ...(events.terminal ? {} : { progress: "待开启" }),
    },
    {
      id: "git-1",
      name: "存档留痕",
      task: "在工作区完成第一次 git 提交",
      done: events.gitCommit,
      ...(events.gitCommit ? {} : { progress: "待提交" }),
    },
    { id: "plugin-1", name: "广纳百川", task: "安装第一个插件", ...step(input.pluginCount, 1) },
  ];
}

const TIME_KEY = "myblog:achievements:at";

export function readAchievementTimes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TIME_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberAchievementTimes(ids: string[]): void {
  try {
    const times = readAchievementTimes();
    const now = new Date().toISOString();
    let changed = false;
    for (const id of ids) {
      if (!times[id]) {
        times[id] = now;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(TIME_KEY, JSON.stringify(times));
  } catch {
    // localStorage unavailable
  }
}
