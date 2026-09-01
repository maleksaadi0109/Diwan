import { existsSync, unlinkSync } from "node:fs";

const packageManager = process.env.npm_config_user_agent ?? "";

if (!packageManager.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  if (existsSync(lockfile)) {
    unlinkSync(lockfile);
  }
}