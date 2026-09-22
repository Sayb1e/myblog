import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevron } from "./icons.js";

interface Props {
  value: string;
  onChange: (date: string) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parse(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: year || now.getFullYear(),
    month: month || now.getMonth() + 1,
    day: day || now.getDate(),
  };
}

function format(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function todayString(): string {
  const now = new Date();
  return format(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parse(value));
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setCursor(parse(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1);
    const start = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
    const prevDays = new Date(cursor.year, cursor.month - 1, 0).getDate();
    const list: { date: string; day: number; outside: boolean }[] = [];
    for (let index = start - 1; index >= 0; index -= 1) {
      const day = prevDays - index;
      const month = cursor.month - 1 < 1 ? 12 : cursor.month - 1;
      const year = cursor.month - 1 < 1 ? cursor.year - 1 : cursor.year;
      list.push({ date: format(year, month, day), day, outside: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push({ date: format(cursor.year, cursor.month, day), day, outside: false });
    }
    while (list.length < 42) {
      const day = list.length - (start + daysInMonth) + 1;
      const month = cursor.month + 1 > 12 ? 1 : cursor.month + 1;
      const year = cursor.month + 1 > 12 ? cursor.year + 1 : cursor.year;
      list.push({ date: format(year, month, day), day, outside: true });
    }
    return list;
  }, [cursor]);

  const today = todayString();

  const shift = (deltaMonth: number, deltaYear: number): void => {
    setCursor((current) => {
      const total = (current.year + deltaYear) * 12 + (current.month - 1) + deltaMonth;
      return { ...current, year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  };

  return (
    <div className="datepicker" ref={rootRef}>
      <button type="button" className="datepicker-trigger" onClick={() => setOpen((open) => !open)}>
        <span>{value || "选择日期"}</span>
      </button>
      {open && (
        <div className="datepicker-pop">
          <div className="datepicker-head">
            <button type="button" className="dp-nav" aria-label="上一年" onClick={() => shift(0, -1)} data-tip="上一年">
              «
            </button>
            <button type="button" className="dp-nav" aria-label="上个月" onClick={() => shift(-1, 0)} data-tip="上个月">
              <IconChevron />
            </button>
            <span className="dp-label">
              {cursor.year} 年 {cursor.month} 月
            </span>
            <button type="button" className="dp-nav flip" aria-label="下个月" onClick={() => shift(1, 0)} data-tip="下个月">
              <IconChevron />
            </button>
            <button type="button" className="dp-nav" aria-label="下一年" onClick={() => shift(0, 1)} data-tip="下一年">
              »
            </button>
          </div>

          <div className="datepicker-week">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="datepicker-grid">
            {cells.map((cell) => (
              <button
                key={cell.date + (cell.outside ? "o" : "")}
                type="button"
                className={`dp-day${cell.outside ? " outside" : ""}${cell.date === value ? " selected" : ""}${
                  cell.date === today ? " today" : ""
                }`}
                onClick={() => {
                  onChange(cell.date);
                  setOpen(false);
                }}
              >
                {cell.day}
              </button>
            ))}
          </div>

          <div className="datepicker-foot">
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
