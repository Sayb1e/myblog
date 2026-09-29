import { useCallback, useEffect, useState } from "react";
import type { CheckResult, SummaryDoc, TodayPlan } from "@myblog/core";
import {
  errorMessage,
  getCheck,
  getMilestoneStats,
  getStatus,
  getSummaries,
  getToday,
  type MilestoneStats,
  type StatusResponse,
} from "../api.js";
import { useLiveRefresh } from "./useLiveRefresh.js";

export interface WorkspaceData {
  status: StatusResponse | null;
  today: TodayPlan | null;
  check: CheckResult | null;
  summaries: SummaryDoc[];
  milestones: MilestoneStats | null;
  loading: boolean;
  error: string;
  connected: boolean;
  refresh: () => Promise<void>;
}

export function useWorkspace(): WorkspaceData {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [today, setToday] = useState<TodayPlan | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [summaries, setSummaries] = useState<SummaryDoc[]>([]);
  const [milestones, setMilestones] = useState<MilestoneStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextToday, nextCheck, nextSummaries, nextMilestones] = await Promise.all([
        getStatus(),
        getToday(),
        getCheck(),
        getSummaries(),
        getMilestoneStats(),
      ]);
      setStatus(nextStatus);
      setToday(nextToday);
      setCheck(nextCheck);
      setSummaries(nextSummaries);
      setMilestones(nextMilestones);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  const connected = useLiveRefresh(refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, today, check, summaries, milestones, loading, error, connected, refresh };
}
