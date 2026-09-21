import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";
type Push = (kind: ToastKind, text: string) => void;

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastContext = createContext<Push>(() => {});

const MAX_TOASTS = 4;

let nextId = 1;

function ToastIcon({ kind }: { kind: ToastKind }) {
  return (
    <svg
      className="toast-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "success" && <path d="M5 12.5l4.5 4.5L19 7" />}
      {kind === "error" && (
        <>
          <path d="M12 3l9 16H3z" />
          <path d="M12 9v4M12 16h.01" />
        </>
      )}
      {kind === "info" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      )}
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<Push>((kind, text) => {
    const id = nextId;
    nextId += 1;
    setToasts((current) => [...current, { id, kind, text }].slice(-MAX_TOASTS));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            <ToastIcon kind={toast.kind} />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Push {
  return useContext(ToastContext);
}
