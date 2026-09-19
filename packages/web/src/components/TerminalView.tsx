import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useResolvedTheme } from "../prefs.js";

interface Props {
  cwd: string;
  active?: boolean;
}

function terminalTheme(dark: boolean) {
  if (dark) {
    return {
      background: "#0b0e15",
      foreground: "#e8ebf2",
      cursor: "#5b8cff",
      cursorAccent: "#0b0e15",
      selectionBackground: "rgba(91, 140, 255, 0.3)",
      black: "#0b0e15",
      red: "#ff6b6b",
      green: "#5fd08a",
      yellow: "#e6c15a",
      blue: "#6fa0ff",
      magenta: "#c08bff",
      cyan: "#5fd0d0",
      white: "#d7dce6",
      brightBlack: "#5b6478",
      brightRed: "#ff8a8a",
      brightGreen: "#7ee0a2",
      brightYellow: "#f0d078",
      brightBlue: "#8fb6ff",
      brightMagenta: "#d0a6ff",
      brightCyan: "#7ee0e0",
      brightWhite: "#ffffff",
    };
  }
  return {
    background: "#ffffff",
    foreground: "#1b2230",
    cursor: "#3b6fe0",
    cursorAccent: "#ffffff",
    selectionBackground: "rgba(59, 111, 224, 0.22)",
    black: "#1b2230",
    red: "#c02a2a",
    green: "#1a7f45",
    yellow: "#8a6100",
    blue: "#1f56c4",
    magenta: "#8034c4",
    cyan: "#0f7a7a",
    white: "#4a5468",
    brightBlack: "#6b7488",
    brightRed: "#d23b3b",
    brightGreen: "#228b50",
    brightYellow: "#9c6f00",
    brightBlue: "#2f68d8",
    brightMagenta: "#9345d6",
    brightCyan: "#128a8a",
    brightWhite: "#1b2230",
  };
}

export function TerminalView({ cwd, active = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const idRef = useRef(0);
  const theme = useResolvedTheme();

  useEffect(() => {
    const api = window.myblog?.terminal;
    const container = containerRef.current;
    if (!api || !container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Cascadia Mono", "Microsoft YaHei", monospace',
      scrollback: 5000,
      theme: terminalTheme(theme === "dark"),
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    termRef.current = term;
    term.loadAddon(fit);
    term.open(container);
    try {
      fit.fit();
    } catch {
      // not laid out yet
    }

    api.onData((payload) => {
      if (idRef.current === 0 || payload.id === idRef.current) term.write(payload.data);
    });
    api.onExit((payload) => {
      if (payload.id === idRef.current) term.write("\r\n\x1b[38;5;245m[进程已退出]\x1b[0m\r\n");
    });

    void api.create({ cwd, cols: term.cols, rows: term.rows }).then((created) => {
      idRef.current = created.id;
      term.write(`\x1b[38;5;245m# ${created.shell}  ·  ${cwd}\x1b[0m\r\n\r\n`);
    });

    const input = term.onData((data) => {
      if (idRef.current !== 0) api.write(idRef.current, data);
    });

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        return;
      }
      if (idRef.current !== 0) api.resize(idRef.current, term.cols, term.rows);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      input.dispose();
      if (idRef.current !== 0) api.kill(idRef.current);
      api.removeAllListeners();
      term.dispose();
      fitRef.current = null;
      termRef.current = null;
      idRef.current = 0;
    };
  }, [cwd]);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = terminalTheme(theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const fit = fitRef.current;
      const term = termRef.current;
      const api = window.myblog?.terminal;
      if (!fit || !term) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      if (api && idRef.current !== 0) api.resize(idRef.current, term.cols, term.rows);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <div className="terminal-wrap">
      <div className="terminal-host" ref={containerRef} />
    </div>
  );
}
