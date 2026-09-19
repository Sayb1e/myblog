import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("用法: npx version:bump <version>，例如 0.1.1（0.x 为测试版）");
  process.exit(1);
}

const targets = [path.join(root, "package.json")];
for (const entry of await readdir(path.join(root, "packages"), { withFileTypes: true })) {
  if (entry.isDirectory()) targets.push(path.join(root, "packages", entry.name, "package.json"));
}

for (const target of targets) {
  const data = JSON.parse(await readFile(target, "utf8"));
  data.version = version;
  await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`${path.relative(root, target)} -> ${version}`);
}

const changelogPath = path.join(root, "CHANGELOG.md");
try {
  const changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes(`## [${version}]`)) {
    const date = new Date().toISOString().slice(0, 10);
    const entry = `## [${version}] - ${date}\n\n### 变更\n\n- 待补充\n\n`;
    const firstEntry = changelog.search(/^## \[/m);
    const next =
      firstEntry === -1
        ? `${changelog.replace(/\s*$/, "")}\n\n${entry}`
        : `${changelog.slice(0, firstEntry)}${entry}${changelog.slice(firstEntry)}`;
    await writeFile(changelogPath, next, "utf8");
    console.log(`CHANGELOG.md 已插入 [${version}] 占位条目（记得补充）`);
  }
} catch {
  // 没有 CHANGELOG.md 就跳过
}
