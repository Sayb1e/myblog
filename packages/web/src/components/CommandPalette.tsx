import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchHit } from "../api.js";
import { IconFile, IconSearch } from "./icons.js";

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
  onSearch?: (query: string) => Promise<SearchHit[]>;
  onOpenHit?: (hit: SearchHit) => void;
}

export function CommandPalette({ open, commands, onClose, onSearch, onOpenHit }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.hint ?? ""}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    const needle = query.trim();
    if (!open || !onSearch || needle.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void onSearch(needle)
        .then((result) => {
          if (alive) setHits(result);
        })
        .catch(() => {
          if (alive) setHits([]);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [onSearch, open, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const hitCommands: Command[] = hits.map((hit) => ({
    id: `hit:${hit.path}:${hit.line}`,
    label: hit.text || hit.path,
    hint: hit.date ?? hit.path,
    run: () => onOpenHit?.(hit),
  }));
  const items = [...filtered, ...hitCommands];

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
            placeholder="命令 / 日期，或搜索总结内容…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((current) => Math.min(current + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(items[index]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <span className="palette-kbd">Esc</span>
        </div>
        <div className="palette-list">
          {items.length === 0 && <div className="palette-empty muted">没有匹配的命令</div>}
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

          {(hitCommands.length > 0 || searching) && (
            <div className="palette-section">
              {searching ? "搜索内容…" : `内容匹配 ${hitCommands.length}`}
            </div>
          )}
          {hitCommands.map((command, i) => {
            const position = filtered.length + i;
            return (
              <button
                key={command.id}
                type="button"
                className={`palette-item${position === index ? " active" : ""}`}
                onMouseEnter={() => setIndex(position)}
                onClick={() => run(command)}
              >
                <span className="palette-hit">
                  <IconFile />
                  <span className="palette-hit-text">{command.label}</span>
                </span>
                <span className="palette-hint">{command.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
