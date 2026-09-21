import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch } from "./icons.js";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.hint ?? ""}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const run = (command?: Command): void => {
    if (!command) return;
    onClose();
    command.run();
  };

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <IconSearch />
          <input
            ref={inputRef}
            value={query}
            placeholder="输入命令：页面 / 日期 / 设置…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((current) => Math.min(current + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(filtered[index]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <span className="palette-kbd">Esc</span>
        </div>
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty muted">没有匹配的命令</div>}
          {filtered.map((command, i) => (
            <button
              key={command.id}
              type="button"
              className={`palette-item${i === index ? " active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(command)}
            >
              <span>{command.label}</span>
              {command.hint && <span className="palette-hint">{command.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
