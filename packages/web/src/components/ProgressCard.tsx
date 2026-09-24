import type { ProgressSnapshot } from "@myblog/core";
import { EditableField } from "./EditableField.js";

interface Props {
  progress: ProgressSnapshot;
  onSave: (patch: Partial<ProgressSnapshot>) => Promise<void>;
}

export function ProgressCard({ progress, onSave }: Props) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>进度</h2>
      </div>

      <div className="field">
        <label>学到哪了</label>
        <EditableField value={progress.learned} multiline placeholder="还没写" onSave={(value) => onSave({ learned: value })} />
      </div>
      <div className="field">
        <label>下次从哪继续</label>
        <EditableField value={progress.next} multiline placeholder="还没写" onSave={(value) => onSave({ next: value })} />
      </div>
      <div className="field">
        <label>最近一次</label>
        <EditableField value={progress.latest} placeholder="还没写" onSave={(value) => onSave({ latest: value })} />
      </div>
    </section>
  );
}
