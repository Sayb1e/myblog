import { watch, type FSWatcher } from "node:fs";

const IGNORED = /(^|[\\/])(\.git|node_modules|dist|\.idea)([\\/]|$)/;

export function createWorkspaceWatcher(root: string, onChange: () => void): () => void {
  let timer: NodeJS.Timeout | null = null;
  let watcher: FSWatcher | null = null;

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 150);
  };

  try {
    watcher = watch(root, { recursive: true }, (_event, filename) => {
      const name = filename ? String(filename) : "";
      if (IGNORED.test(name)) return;
      schedule();
    });
  } catch {
    watcher = null;
  }

  return () => {
    if (timer) clearTimeout(timer);
    watcher?.close();
  };
}
