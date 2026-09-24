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

export function LearningCurve({ activity, weeks = 16 }: Props) {
  const { points, area, total, startLabel, endLabel, peak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7;
    const start = addDays(today, -dow - (weeks - 1) * 7);

    const weekly = new Array<number>(weeks).fill(0);
    for (const [date, count] of activity) {
      if (count <= 0) continue;
      const day = new Date(`${date}T00:00:00`);
      const index = Math.floor(Math.round((day.getTime() - start.getTime()) / 86400000) / 7);
      if (index >= 0 && index < weeks) weekly[index] = (weekly[index] ?? 0) + 1;
    }

    let run = 0;
    const cumulative = weekly.map((value) => (run += value));
    const max = Math.max(1, run);
    const W = 320;
    const H = 120;
    const pad = 8;
    const stepX = weeks > 1 ? (W - pad * 2) / (weeks - 1) : 0;
    const coords = cumulative.map((value, index) => {
      const x = pad + index * stepX;
      const y = H - pad - (value / max) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return {
      points: coords.join(" "),
      area: `${pad},${H - pad} ${coords.join(" ")} ${W - pad},${H - pad}`,
      total: run,
      peak: Math.max(0, ...weekly),
      startLabel: fmt(start),
      endLabel: fmt(today),
    };
  }, [activity, weeks]);

  return (
    <section className="card curve-card">
      <div className="card-head">
        <h2>学习曲线</h2>
        <span className="muted">累计 {total} 天 · 近 {weeks} 周 · 单周最多 {peak} 天</span>
      </div>
      <div className="curve-wrap">
        <svg viewBox="0 0 320 120" preserveAspectRatio="none" className="curve-svg" aria-hidden="true">
          <polygon points={area} className="curve-area" />
          <polyline points={points} className="curve-line" />
        </svg>
      </div>
      <div className="curve-axis">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <p className="muted curve-caption">口径：按有学习记录/总结的天数累计（投入曲线，不是掌握度）。</p>
    </section>
  );
}
