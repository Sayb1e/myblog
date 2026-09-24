import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

async function makeRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "myblog-config-"));
}

describe("loadConfig", () => {
  it("uses PROGRESS.md / GOALS.md by default", async () => {
    const root = await makeRoot();
    const config = await loadConfig(root);
    expect(config.overview).toBe("PROGRESS.md");
    expect(config.goals).toBe("GOALS.md");
    expect(config.summaryFile).toBe("SUMMARY.md");
  });

  it("honours myblog.config.json overrides", async () => {
    const root = await makeRoot();
    await writeFile(path.join(root, "myblog.config.json"), JSON.stringify({ goals: "CUSTOM.md" }), "utf8");

    const config = await loadConfig(root);
    expect(config.goals).toBe("CUSTOM.md");
    expect(config.overview).toBe("PROGRESS.md");
  });
});
