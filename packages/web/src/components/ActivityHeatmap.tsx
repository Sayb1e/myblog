import { useMemo } from "react";

interface Props {
  /** 日期(YYYY-MM-DD) -> 当天活动条数 */
  activity: Map<string, number>;
  weeks?: number;
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isNextDay(prev: string, next: string): boolean {
  const a = new Date(`${prev}T00:00:00`);
  const b = new Date(`${next}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) === 1;
}

const WEEKDAY_LABELS = ["一", "", "三", "", "五", "", "日"];

export function ActivityHeatmap({ activity, weeks = 12 }: Props) {
  const { days, current, longest, activeCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = 周一
    const sunday = addDays(today, 6 - dow);
    const start = addDays(sunday, -(weeks * 7 - 1));
    const list: Date[] = [];
    for (let i = 0; i < weeks * 7; i += 1) list.push(addDays(start, i));

    const active = (date: Date): number => activity.get(fmt(date)) ?? 0;

    let streak = 0;
    let cursor = new Date(today);
    if (active(cursor) === 0) cursor = addDays(cursor, -1);
    while (active(cursor) > 0) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    const keys = [...activity.entries()].filter(([, count]) => count > 0).map(([date]) => date).sort();
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const key of keys) {
      run = prev && isNextDay(prev, key) ? run + 1 : 1;
      if (run > best) best = run;
      prev = key;
    }

    return { days: list, current: streak, longest: best, activeCount: keys.length };
  }, [activity, weeks]);

  const level = (count: number): number => (count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3);

  return (
    <section className="card heatmap-card">
      <div className="card-head">
        <h2>学习热力图</h2>
        <span className="muted">
          连续 <strong>{current}</strong> 天 · 最长 {longest} 天 · 共 {activeCount} 天有进展
        </span>
      </div>
      <div className="heatmap">
        <div className="heatmap-days">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
        <div className="heatmap-grid">
          {days.map((day) => {
            const count = activity.get(fmt(day)) ?? 0;
            const future = day.getTime() > Date.now();
            return (
              <span
                key={fmt(day)}
                className={`heat-cell level-${level(count)}${future ? " future" : ""}`}
                data-tip={`${fmt(day)} · ${count > 0 ? `${count} 项进展` : "没有记录"}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
