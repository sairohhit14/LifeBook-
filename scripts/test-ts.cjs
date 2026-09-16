/**
 * Runs the TypeScript-side checks:
 *   1. tsc --noEmit        — typecheck the whole project
 *   2. test/db-race-check.ts — cross-process db.json write-race self-check
 *   3. test/supabase-sync-check.ts — Supabase vault round-trip self-check
 *   4. test/server-routes-check.ts — security-sensitive route unit checks
 *   5. test/design-tokens-check.ts — UI design-system regression guard
 *   6. test/autobiography-check.ts — autobiography pipeline + route security
 *
 * Uses npx so no locally-installed binary paths are assumed.
 */
const { spawnSync } = require("child_process");

let failed = false;

for (const [name, cmd, args] of [
  ["typecheck", "npx", ["tsc", "--noEmit"]],
  ["db-race-check", "npx", ["tsx", "test/db-race-check.ts"]],
  ["supabase-sync-check", "npx", ["tsx", "test/supabase-sync-check.ts"]],
  ["server-routes-check", "npx", ["tsx", "test/server-routes-check.ts"]],
  ["design-tokens-check", "npx", ["tsx", "test/design-tokens-check.ts"]],
  ["autobiography-check", "npx", ["tsx", "test/autobiography-check.ts"]],
]) {
  console.log(`\n=== ${name} ===`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`\n${name} FAILED`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
