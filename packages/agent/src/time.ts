const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 本地系统时间的可读描述，注入系统提示词，避免模型自己猜日期 */
export function currentTimeLine(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    zone = "";
  }
  const suffix = zone ? `，${zone}` : "";
  return `当前系统时间：${date} ${time}（${WEEKDAYS[now.getDay()]}${suffix}）。需要日期/时间时以此为准，不要自己编造。`;
}
