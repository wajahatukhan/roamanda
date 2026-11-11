// Runs `next build` unless .next holds a production build newer than every input to it, so `npm run ci:speed`
// measures the current code without rebuilding straight after `npm run ci` has built it.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUILD_ID = ".next/BUILD_ID";
const INPUT_DIRS = ["src", "public"];
const INPUT_FILES = ["next.config.ts", "package.json", "package-lock.json", "tsconfig.json"];

function newestMtime(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(stat.mtimeMs, ...readdirSync(path).map((name) => newestMtime(join(path, name))));
}

const inputs = Math.max(...INPUT_DIRS.map(newestMtime), ...INPUT_FILES.map(newestMtime));
if (existsSync(BUILD_ID) && statSync(BUILD_ID).mtimeMs > inputs) {
  console.log("Production build is up to date; not rebuilding.");
} else {
  const result = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
