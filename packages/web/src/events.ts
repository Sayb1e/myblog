export interface Events {
  /** 打开过终端 */
  terminal: boolean;
  /** 工作区第一次 git 提交 */
  gitCommit: boolean;
  /** 推进到新阶段 */
  stageAdvanced: boolean;
  /** 用模型重写过学习目标 */
  goalsRewritten: boolean;
  /** 累计引用总结次数 */
  quote: number;
  /** 累计对话轮数 */
  chats: number;
}

export const DEFAULT_EVENTS: Events = {
  terminal: false,
  gitCommit: false,
  stageAdvanced: false,
  goalsRewritten: false,
  quote: 0,
  chats: 0,
};

const KEY = "myblog:events";

export function readEvents(): Events {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_EVENTS, ...(JSON.parse(raw) as Partial<Events>) } : { ...DEFAULT_EVENTS };
  } catch {
    return { ...DEFAULT_EVENTS };
  }
}

function writeEvents(events: Events): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // localStorage unavailable
  }
  try {
    window.dispatchEvent(new Event("myblog:events-changed"));
  } catch {
    // no window
  }
}

export function setEvent<K extends keyof Events>(key: K, value: Events[K]): void {
  const events = readEvents();
  if (events[key] === value) return;
  events[key] = value;
  writeEvents(events);
}

export function bumpEvent(key: "quote" | "chats", by = 1): void {
  const events = readEvents();
  events[key] += by;
  writeEvents(events);
}
