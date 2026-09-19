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
    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => setConnected(true));
    source.addEventListener("change", () => callback.current());
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [prefs.liveRefresh]);

  return connected;
}
