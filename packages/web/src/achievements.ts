import type { Events } from "./events.js";

export type AchievementGroup = "总结" | "坚持" | "能力" | "目标" | "AI 协作" | "工具";

export type AchievementIcon =
  | "book"
  | "pen"
  | "layers"
  | "library"
  | "flame"
  | "calendar"
  | "moon"
  | "moon-star"
  | "mountain"
  | "compass"
  | "steps"
  | "furnace"
  | "gem"
  | "sprout"
  | "stairs"
  | "target"
  | "blueprint"
  | "chat"
  | "chat-question"
  | "quote"
  | "terminal"
  | "git"
  | "puzzle";

export const GROUP_ORDER: AchievementGroup[] = ["总结", "坚持", "能力", "目标", "AI 协作", "工具"];

/** 难度 -> 稀有度名（青铜 / 白银 / 黄金） */
export const RARITY_LABEL: Record<Tier, string> = { 1: "青铜", 2: "白银", 3: "黄金" };

export type Tier = 1 | 2 | 3;

export interface Achievement {
  id: string;
  name: string;
  task: string;
  group: AchievementGroup;
  /** 难度：1 入门 / 2 进阶 / 3 高阶 */
  tier: Tier;
  icon: AchievementIcon;
  done: boolean;
  /** 当前进度数值 */
  value: number;
  /** 目标数值 */
  target: number;
  /** 未达成时想显示的中文短语（如「待推进」）；缺省则显示 value/target */
  progressLabel?: string;
}

export interface AchievementInput {
  summaryCount: number;
  currentStreak: number;
  activityDays: number;
  /** 所有库里已闭环的能力总数 */
  closedCapabilities: number;
  /** 所有库的能力总数 */
  goalCount: number;
  maxCapabilityDays: number;
  chatted: boolean;
  pluginCount: number;
  events: Events;
}

const CLOSED = /已闭环|已通|已完成|闭环/;

/** 能力状态是否算「已闭环」 */
export function isClosedStatus(status: string): boolean {
  return CLOSED.test(status);
}

type Progress = Pick<Achievement, "done" | "value" | "target" | "progressLabel">;

const step = (value: number, target: number): Progress =>
  value >= target ? { done: true, value, target } : { done: false, value, target };

const flag = (done: boolean, label: string): Progress =>
  done ? { done: true, value: 1, target: 1 } : { done: false, value: 0, target: 1, progressLabel: label };

export function computeAchievements(input: AchievementInput): Achievement[] {
  const closed = input.closedCapabilities;
  const goals = input.goalCount;
  const { events } = input;

  return [
    { id: "note-1", name: "开卷有益", task: "写下第 1 篇每日总结", group: "总结", tier: 1, icon: "book", ...step(input.summaryCount, 1) },
    { id: "note-5", name: "笔耕不辍", task: "累计 5 篇总结", group: "总结", tier: 2, icon: "pen", ...step(input.summaryCount, 5) },
    { id: "note-10", name: "积少成多", task: "累计 10 篇总结", group: "总结", tier: 2, icon: "layers", ...step(input.summaryCount, 10) },
    { id: "note-30", name: "著书立说", task: "累计 30 篇总结", group: "总结", tier: 3, icon: "library", ...step(input.summaryCount, 30) },
    { id: "streak-3", name: "三日之约", task: "连续学习 3 天", group: "坚持", tier: 1, icon: "flame", ...step(input.currentStreak, 3) },
    { id: "streak-7", name: "七日之志", task: "连续学习 7 天", group: "坚持", tier: 2, icon: "calendar", ...step(input.currentStreak, 7) },
    { id: "streak-14", name: "半月不辍", task: "连续学习 14 天", group: "坚持", tier: 2, icon: "moon", ...step(input.currentStreak, 14) },
    { id: "streak-30", name: "月满功成", task: "连续学习 30 天", group: "坚持", tier: 3, icon: "moon-star", ...step(input.currentStreak, 30) },
    { id: "days-100", name: "百尺竿头", task: "累计 100 天有学习进展", group: "坚持", tier: 3, icon: "mountain", ...step(input.activityDays, 100) },
    { id: "g-1", name: "初窥门径", task: "闭环第 1 个能力（G）", group: "能力", tier: 1, icon: "compass", ...step(closed, 1) },
    { id: "g-3", name: "渐入佳境", task: "闭环 3 个能力", group: "能力", tier: 2, icon: "steps", ...step(closed, 3) },
    { id: "g-5", name: "炉火纯青", task: "闭环 5 个能力", group: "能力", tier: 2, icon: "furnace", ...step(closed, 5) },
    { id: "g-10", name: "融会贯通", task: "闭环 10 个能力", group: "能力", tier: 3, icon: "gem", ...step(closed, 10) },
    { id: "deep-15", name: "深耕一隅", task: "同一个能力累计学习 15 天", group: "能力", tier: 2, icon: "sprout", ...step(input.maxCapabilityDays, 15) },
    { id: "stage-up", name: "更上层楼", task: "推进到一个新的学习阶段", group: "目标", tier: 3, icon: "stairs", ...flag(events.stageAdvanced, "待推进") },
    { id: "goals", name: "立下志向", task: "建立学习目标（GOALS.md 有 ≥1 个能力）", group: "目标", tier: 1, icon: "target", ...step(goals, 1) },
    { id: "goals-redraw", name: "蓝图重绘", task: "用模型重新生成过学习目标", group: "目标", tier: 2, icon: "blueprint", ...flag(events.goalsRewritten, "待重绘") },
    { id: "chat-1", name: "问道于师", task: "第一次用 AI 规划", group: "AI 协作", tier: 1, icon: "chat", ...flag(input.chatted, "待开启") },
    { id: "chat-20", name: "不耻下问", task: "与 AI 累计对话 20 轮", group: "AI 协作", tier: 2, icon: "chat-question", ...step(events.chats, 20) },
    { id: "quote-1", name: "温故知新", task: "把某天的总结引用进对话", group: "AI 协作", tier: 1, icon: "quote", ...step(events.quote, 1) },
    { id: "terminal", name: "工欲善其事", task: "第一次打开内置终端", group: "工具", tier: 1, icon: "terminal", ...flag(events.terminal, "待开启") },
    { id: "git-1", name: "存档留痕", task: "在工作区完成第一次 git 提交", group: "工具", tier: 1, icon: "git", ...flag(events.gitCommit, "待提交") },
    { id: "plugin-1", name: "广纳百川", task: "安装第一个插件", group: "工具", tier: 2, icon: "puzzle", ...step(input.pluginCount, 1) },
  ];
}

/** 进度比例 0..1（已达成恒为 1） */
export function progressRatio(item: Achievement): number {
  if (item.done) return 1;
  if (item.target <= 0) return 0;
  return Math.max(0, Math.min(1, item.value / item.target));
}

/** 未达成时的进度文案 */
export function progressText(item: Achievement): string {
  if (item.done) return "已解锁";
  if (item.progressLabel) return item.progressLabel;
  return `${Math.min(item.value, item.target)}/${item.target}`;
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
