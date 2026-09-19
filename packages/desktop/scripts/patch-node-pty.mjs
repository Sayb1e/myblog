import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../../../node_modules/node-pty"),
  path.resolve(here, "../node_modules/node-pty"),
];

let root = "";
for (const candidate of candidates) {
  try {
    await access(candidate);
    root = candidate;
    break;
  } catch {
    continue;
  }
}

if (!root) {
  console.error("找不到 node-pty（先 npm install）");
  process.exit(1);
}

const files = (await readdir(root, { recursive: true })).filter((entry) => entry.endsWith(".gyp") || entry.endsWith(".gypi"));
let patchedCount = 0;

for (const relative of files) {
  const file = path.join(root, relative);
  const original = await readFile(file, "utf8");
  if (!original.includes("SpectreMitigation")) continue;

  const patched = original.replace(/(['"]SpectreMitigation['"]\s*:\s*)'Spectre'/g, "$1'false'");
  if (patched === original) continue;

  await writeFile(file, patched, "utf8");
  patchedCount += 1;
  console.log(`已关闭 Spectre 要求：${path.relative(process.cwd(), file)}`);
}

console.log(patchedCount === 0 ? "node-pty 无需补丁" : `共补丁 ${patchedCount} 个文件`);
