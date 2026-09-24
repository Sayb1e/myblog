import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown } from "./icons.js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  placement?: "down" | "up";
  icon?: ReactNode;
  action?: SelectAction;
  actions?: SelectAction[];
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  className,
  title,
  placement = "down",
  icon,
  action,
  actions,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.value === value);
  const extras = actions ?? (action ? [action] : []);

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

  return (
    <div
      className={`select${open ? " open" : ""}${placement === "up" ? " up" : ""}${className ? ` ${className}` : ""}`}
      ref={rootRef}
      data-tip={title}
    >
      <button type="button" className="select-trigger" onClick={() => setOpen((current) => !current)}>
        {icon && <span className="select-icon">{icon}</span>}
        <span className="select-value">{current?.label ?? placeholder ?? "请选择"}</span>
        <IconChevronDown className="select-caret" />
      </button>
      {open && (
        <div className="select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-option${option.value === value ? " active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          {extras.length > 0 && (
            <>
              <div className="select-divider" />
              {extras.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className="select-option select-action"
                  onClick={() => {
                    setOpen(false);
                    entry.onSelect();
                  }}
                >
                  {entry.icon}
                  {entry.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
