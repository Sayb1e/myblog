import { cp, mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
export const workspaceFixture = path.join(fixturesDir, "workspace");

export function readFixture(relative: string): string {
  return readFileSync(path.join(workspaceFixture, relative), "utf8");
}

export async function makeTempWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "myblog-test-"));
  const destination = path.join(base, "workspace");
  await cp(workspaceFixture, destination, { recursive: true });
  return destination;
}
