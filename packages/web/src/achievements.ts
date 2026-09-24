import type { CapabilityStatus } from "@myblog/core";

export interface Achievement {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

const CLOSED = /已闭环|已通|已完成|闭环/;

export function computeAchievements(input: {
  summaryCount: number;
  currentStreak: number;
  capabilities: CapabilityStatus[];
  chatted: boolean;
}): Achievement[] {
  const closed = input.capabilities.filter((capability) => CLOSED.test(capability.status)).length;
  const at = (value: number, target: number): string => `${Math.min(value, target)}/${target}`;

  return [
    { id: "note-1", label: "写下第一篇总结", done: input.summaryCount >= 1, hint: input.summaryCount >= 1 ? undefined : at(input.summaryCount, 1) },
    { id: "note-5", label: "累计 5 篇总结", done: input.summaryCount >= 5, hint: input.summaryCount >= 5 ? undefined : at(input.summaryCount, 5) },
    { id: "note-20", label: "累计 20 篇总结", done: input.summaryCount >= 20, hint: input.summaryCount >= 20 ? undefined : at(input.summaryCount, 20) },
    { id: "streak-3", label: "连续学习 3 天", done: input.currentStreak >= 3, hint: input.currentStreak >= 3 ? undefined : at(input.currentStreak, 3) },
    { id: "streak-7", label: "连续学习 7 天", done: input.currentStreak >= 7, hint: input.currentStreak >= 7 ? undefined : at(input.currentStreak, 7) },
    { id: "streak-30", label: "连续学习 30 天", done: input.currentStreak >= 30, hint: input.currentStreak >= 30 ? undefined : at(input.currentStreak, 30) },
    { id: "g-1", label: "闭环第一个能力（G）", done: closed >= 1, hint: closed >= 1 ? undefined : at(closed, 1) },
    { id: "g-5", label: "闭环 5 个能力", done: closed >= 5, hint: closed >= 5 ? undefined : at(closed, 5) },
    { id: "chat-1", label: "第一次用 AI 规划", done: input.chatted },
  ];
}
