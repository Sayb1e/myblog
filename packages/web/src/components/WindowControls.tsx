import { useEffect, useState } from "react";
import { IconClose, IconMaximize, IconMinimize, IconRestore } from "./icons.js";

export function WindowControls() {
  const controls = typeof window !== "undefined" ? window.myblog?.windowControls : undefined;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    controls?.onMaximized(setMaximized);
  }, [controls]);

  if (!controls) return null;

  return (
    <div className="win-controls">
      <button type="button" className="win-btn" aria-label="最小化" data-tip="最小化" onClick={() => controls.minimize()}>
        <IconMinimize />
      </button>
      <button
        type="button"
        className="win-btn"
        aria-label={maximized ? "还原" : "最大化"}
        data-tip={maximized ? "还原" : "最大化"}
        onClick={() => controls.toggleMaximize()}
      >
        {maximized ? <IconRestore /> : <IconMaximize />}
      </button>
      <button type="button" className="win-btn close" aria-label="关闭" data-tip="关闭" onClick={() => controls.close()}>
        <IconClose />
      </button>
    </div>
  );
}
