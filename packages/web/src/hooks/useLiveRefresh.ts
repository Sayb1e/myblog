import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../prefs.js";

export function useLiveRefresh(onChange: () => void): boolean {
  const { prefs } = usePrefs();
  const [connected, setConnected] = useState(false);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (!prefs.liveRefresh) {
      setConnected(false);
      return;
    }
    const api = window.myblog?.api;
    if (!api) {
      setConnected(false);
      return;
    }
    setConnected(true);
    return api.onFsChange(() => callback.current());
  }, [prefs.liveRefresh]);

  return connected;
}
