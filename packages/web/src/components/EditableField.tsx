import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown.js";

interface Props {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}

export function EditableField({ value, placeholder, multiline, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async (): Promise<void> => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    setEditing(false);
    if (draft === value) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div
        className={`editable${saving ? " saving" : ""}`}
        role="button"
        tabIndex={0}
        title="点击编辑"
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
      >
        {value ? <Markdown inline>{value}</Markdown> : <span className="placeholder">{placeholder ?? "点击填写"}</span>}
        <span className="edit-hint">编辑</span>
      </div>
    );
  }

  const cancel = (): void => {
    cancelled.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (multiline) {
    return (
      <textarea
        className="editable-input"
        autoFocus
        rows={3}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}
      />
    );
  }

  return (
    <input
      className="editable-input"
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") cancel();
      }}
    />
  );
}
