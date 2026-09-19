import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressSnapshot } from "@myblog/core";
import { errorMessage, patchProgress } from "./api.js";
import { CapabilityMap } from "./components/CapabilityMap.js";
import { ChatView } from "./components/ChatView.js";
import { CheckView } from "./components/CheckView.js";
import { DailyView } from "./components/DailyView.js";
import { MarkdownProvider } from "./components/Markdown.js";
import { ProgressCard } from "./components/ProgressCard.js";
import { SettingsView } from "./components/SettingsView.js";
import { Sidebar } from "./components/Sidebar.js";
import { Timeline } from "./components/Timeline.js";
import { TodayCard } from "./components/TodayCard.js";
import { useToast } from "./hooks/useToasts.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { usePrefs } from "./prefs.js";
import type { View } from "./view.js";

const TerminalView = lazy(() =>
  import("./components/TerminalView.js").then((module) => ({ default: module.TerminalView })),
);

const TITLES: Record<View, string> = {
  overview: "概览",
  daily: "每日总结",
  chat: "对话",
  terminal: "终端",
  check: "校验",
  settings: "设置",
};

export function App() {
  const { status, today, check, summaries, loading, error, connected, refresh } = useWorkspace();
  const { prefs } = usePrefs();
  const toast = useToast();
  const [view, setView] = useState<View>("overview");
  const [date, setDate] = useState("");
  const [skill, setSkill] = useState<string | null>(null);
  const [visited, setVisited] = useState<Partial<Record<View, boolean>>>({ overview: true });

  useEffect(() => {
    if (!prefs.chatEnabled && view === "chat") setView("overview");
  }, [prefs.chatEnabled, view]);

  useEffect(() => {
    setVisited((current) => (current[view] ? current : { ...current, [view]: true }));
  }, [view]);

  const viewClass = (key: View): string => {
    if (!visited[key]) return "view hidden";
    return view === key ? "view active" : "view";
  };

  useEffect(() => {
    if (!date && status?.records[0]?.date) setDate(status.records[0].date);
  }, [status, date]);

  useEffect(() => {
    if (error) toast("error", error);
  }, [error, toast]);

  const skillsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const summary of summaries) map.set(summary.date, summary.skills);
    return map;
  }, [summaries]);

  const openDate = useCallback((value: string) => {
    setDate(value);
    setView("daily");
  }, []);

  const saveProgress = useCallback(
    async (patch: Partial<ProgressSnapshot>) => {
      try {
        const result = await patchProgress(patch);
        toast(result.changed ? "success" : "info", result.changed ? "已更新总览" : "内容没有变化");
        await refresh();
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    },
    [refresh, toast],
  );

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onView={setView}
        stageIds={status?.stageIds ?? []}
        connected={connected}
        issueCount={check?.issues.length ?? 0}
      />

      <main className="main">
        <div className="topbar">
          <h1>{TITLES[view]}</h1>
          <span className="root muted">{status?.root ?? ""}</span>
          <button type="button" className="ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </button>
        </div>

        <div className={viewClass("overview")}>
          <MarkdownProvider openDate={openDate}>
            <div className="overview">
              {today && <TodayCard plan={today} onOpenDate={openDate} />}
              <div className="grid">
                {status && <ProgressCard progress={status.progress} onSave={saveProgress} />}
                {status && (
                  <CapabilityMap capabilities={status.capabilities} selected={skill} onSelect={setSkill} />
                )}
                {status && (
                  <Timeline
                    records={status.records}
                    skillsByDate={skillsByDate}
                    skill={skill}
                    onOpen={openDate}
                  />
                )}
              </div>
            </div>
          </MarkdownProvider>
        </div>

        <div className={viewClass("daily")}>
          <MarkdownProvider openDate={openDate}>
            <DailyView date={date} summaries={summaries} onSelectDate={setDate} onRefresh={refresh} />
          </MarkdownProvider>
        </div>

        {visited.chat && prefs.chatEnabled && (
          <div className={viewClass("chat")}>
            <MarkdownProvider openDate={openDate}>
              <ChatView />
            </MarkdownProvider>
          </div>
        )}

        {visited.terminal && prefs.terminalEnabled && (
          <div className={viewClass("terminal")}>
            <Suspense fallback={<p className="muted">加载终端…</p>}>
              <TerminalView cwd={status?.root ?? ""} active={view === "terminal"} />
            </Suspense>
          </div>
        )}

        <div className={viewClass("check")}>{check && <CheckView result={check} />}</div>

        <div className={viewClass("settings")}>
          <SettingsView root={status?.root ?? ""} version={status?.version ?? ""} />
        </div>
      </main>
    </div>
  );
}
