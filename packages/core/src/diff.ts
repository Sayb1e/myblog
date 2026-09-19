export function diffLines(before: string, after: string): string[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const n = left.length;
  const m = right.length;

  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = table[i];
      const nextRow = table[i + 1];
      if (!row || !nextRow) continue;
      row[j] = left[i] === right[j] ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      lines.push(`- ${i + 1}: ${left[i]}`);
      i += 1;
    } else {
      lines.push(`+ ${j + 1}: ${right[j]}`);
      j += 1;
    }
  }
  while (i < n) {
    lines.push(`- ${i + 1}: ${left[i]}`);
    i += 1;
  }
  while (j < m) {
    lines.push(`+ ${j + 1}: ${right[j]}`);
    j += 1;
  }
  return lines;
}
