import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./icons.js";

interface Props {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeOnOverlay?: boolean;
}

const FOCUSABLE =
  "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function Modal({ open, title, onClose, children, className = "", closeOnOverlay = true }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div ref={panelRef} className={`palette modal ${className}`} onClick={(event) => event.stopPropagation()}>
        {title !== undefined && (
          <div className="palette-input">
            <span className="modal-title">{title}</span>
            <button type="button" className="ghost icon-btn sm modal-close" aria-label="关闭" onClick={onClose}>
              <IconClose />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
