import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../../../CHANGELOG.md");
const target = path.resolve(here, "../release/CHANGELOG.md");

await copyFile(source, target);
console.log(`已复制更新日志到 ${path.relative(process.cwd(), target)}`);
