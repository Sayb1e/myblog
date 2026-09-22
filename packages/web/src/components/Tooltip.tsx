import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TipState {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let current: Element | null = null;

    const show = (target: Element): void => {
      const text = target.getAttribute("data-tip") ?? "";
      if (text === "") {
        setTip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const below = rect.top < 52;
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + 8 : rect.top - 8,
        below,
      });
    };

    const onOver = (event: Event): void => {
      const target = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
      if (!target || target === current) return;
      current = target;
      show(target);
    };

    const onOut = (event: MouseEvent): void => {
      if (!current) return;
      const related = event.relatedTarget;
      if (related instanceof Node && current.contains(related)) return;
      current = null;
      setTip(null);
    };

    const hide = (): void => {
      current = null;
      setTip(null);
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onOver, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("mousedown", hide, true);
    window.addEventListener("keydown", hide);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onOver, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("mousedown", hide, true);
      window.removeEventListener("keydown", hide);
    };
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !tip) return;
    const rect = element.getBoundingClientRect();
    setSize((current) =>
      Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
        ? current
        : { width: rect.width, height: rect.height },
    );
  }, [tip]);

  if (!tip) return null;

  const half = size.width / 2;
  const x = Math.min(Math.max(tip.x, half + 8), Math.max(window.innerWidth - half - 8, half + 8));

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className={`tooltip${tip.below ? " below" : ""}`}
      style={{ left: x, top: tip.y }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
