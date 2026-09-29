import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./icons.js";

interface Props {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeOnOverlay?: boolean;
  /** 垂直居中显示（默认靠上） */
  centered?: boolean;
}

const FOCUSABLE =
  "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

// 打开中的弹窗栈；只有最上层响应 Esc / Tab，避免嵌套弹窗被一起关掉
const modalStack: object[] = [];

export function Modal({ open, title, onClose, children, className = "", closeOnOverlay = true, centered = false }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 只在打开时聚焦一次；键盘监听用 ref 取最新的 onClose，避免每次渲染重跑 effect 抢焦点
  useEffect(() => {
    if (!open) return;
    const id = {};
    modalStack.push(id);
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
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
    return () => {
      const index = modalStack.indexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={`palette-overlay${centered ? " centered" : ""}`} onClick={closeOnOverlay ? onClose : undefined}>
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
