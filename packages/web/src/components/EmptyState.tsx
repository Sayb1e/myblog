import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  mark?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, icon, mark, className = "", children }: Props) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ""}`}>
      <div className="empty-mark">{mark ?? icon}</div>
      <h2>{title}</h2>
      {description && <p className="muted">{description}</p>}
      {children}
    </div>
  );
}
