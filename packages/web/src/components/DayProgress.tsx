import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { errorMessage, getDayProgress } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { Modal } from "./Modal.js";

interface DayData {
  date: string;
  records: { lib: string; didWhat: string; link: string }[];
  summaries: { lib: string; path: string }[];
  inbox: { name: string }[];
}

interface Props {
  date: string;
  count?: number;
  onClose: () => void;
  onOpenDaily?: (date: string) => void;
  onOpenInbox?: () => void;
}

export function DayProgress({ date, count, onClose, onOpenDaily, onOpenInbox }: Props) {
  const toast = useToast();
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    if (date === "") {
      setData(null);
      return;
    }
    void getDayProgress(date)
      .then(setData)
      .catch((caught) => toast("error", errorMessage(caught)));
  }, [date, toast]);

  return createPortal(
    <Modal open={date !== ""} title={`${date} 的进展`} onClose={onClose} className="day-progress-modal">
      {data && (
        <div className="day-progress">
          {(() => {
            const recordLibs = new Set(data.records.map((record) => record.lib));
            const countedSummaries = data.summaries.filter((summary) => !recordLibs.has(summary.lib)).length;
            const total = count ?? data.records.length + countedSummaries + data.inbox.length;
            const skipped = data.summaries.length - countedSummaries;
            return (
              <>
                <p className="day-progress-total">
                  共 <strong>{total}</strong> 项进展 ＝ 学习记录 {data.records.length} 条 ＋ 每日总结 {countedSummaries} 份 ＋ 收件箱 {data.inbox.length} 篇
                </p>
                <section>
                  <h4>学习记录（{data.records.length} 条）</h4>
                  {data.records.length === 0 ? (
                    <p className="muted">无</p>
                  ) : (
                    <ul>
                      {data.records.map((record, index) => (
                        <li key={index}>
                          <span className="day-progress-lib">{record.lib}</span>
                          <span className="day-progress-text">{record.didWhat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4>
                    每日总结（{data.summaries.length} 份{skipped > 0 ? `，其中 ${skipped} 份所在库当天已有记录、不另计入` : ""}）
                  </h4>
                  {data.summaries.length === 0 ? (
                    <p className="muted">无</p>
                  ) : (
                    <ul>
                      {data.summaries.map((summary, index) => (
                        <li key={index}>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => {
                              onOpenDaily?.(date);
                              onClose();
                            }}
                          >
                            {summary.lib} · {summary.path}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4>收件箱（{data.inbox.length} 篇）</h4>
                  {data.inbox.length === 0 ? (
                    <p className="muted">无</p>
                  ) : (
                    <ul>
                      {data.inbox.map((note, index) => (
                        <li key={index}>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => {
                              onOpenInbox?.();
                              onClose();
                            }}
                          >
                            {note.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            );
          })()}
        </div>
      )}
    </Modal>,
    document.body,
  );
}
