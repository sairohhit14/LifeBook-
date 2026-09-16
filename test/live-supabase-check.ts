/**
 * LIVE check + migration: pushes the current db.json into the real Supabase
 * vault_data table and verifies the round-trip, plus a Storage probe.
 *
 * Requires SUPABASE_URL / SUPABASE_KEY in .env (skips cleanly without them).
 * Safe to re-run: vault writes use merge-duplicates (idempotent upsert).
 *
 * Run: npx tsx test/live-supabase-check.ts
 */
import fs from "fs";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const url = env.SUPABASE_URL || "";
const key = env.SUPABASE_KEY || "";
const headers = { apikey: key, Authorization: `Bearer ${key}` };

if (!url || !key || key.startsWith("your-")) {
  console.log("SKIP: SUPABASE_URL/SUPABASE_KEY not configured");
  process.exit(0);
}

process.env.LIFEBOOK_SKIP_AUTOSTART = "1";
// Pin server.ts to the FILE values: dotenv.config() never overrides variables
// already present in the environment, so a stale SUPABASE_URL exported in the
// shell would otherwise silently win over the .env file.
process.env.SUPABASE_URL = url;
process.env.SUPABASE_KEY = key;

let failed = false;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : " — " + detail}`);
  if (!ok) failed = true;
}

// Remove junk rows from earlier connection probes (idempotent)
await fetch(`${url}/rest/v1/vault_data?db_key=in.(bigprobe,mtuprobe)`, { method: "DELETE", headers });

// Real server module against the real project dir (no stubs, no chdir)
const { readDb, writeDb } = await import("../server");

const db = readDb();
console.log(`local db.json: ${db.users?.length ?? 0} users, ${db.memories?.length ?? 0} memories`);

// Push everything to Supabase (same path every write takes in production)
writeDb(db);

// Poll the vault until the write lands (upload is async fire-and-forget)
let rows: Array<{ db_key: string }> = [];
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const res = await fetch(`${url}/rest/v1/vault_data?select=db_key`, { headers });
  rows = await res.json();
  if (rows.length > 0) break;
}

const keys = rows.map((r) => r.db_key);
check("vault_data received collections", rows.length > 0, "table still empty after 15s");
check("users row present", keys.includes("users"), `keys: ${keys.join(", ")}`);

// Order-insensitive compare: jsonb does not preserve object key order
const stable = (v: any): any =>
  Array.isArray(v) ? v.map(stable)
  : v && typeof v === "object"
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, val]) => [k, stable(val)]))
  : v;

if (keys.includes("users")) {
  const res = await fetch(`${url}/rest/v1/vault_data?select=db_value&db_key=eq.users`, { headers });
  const [row] = await res.json();
  const cloudUsers = row?.db_value ?? [];
  check(
    "cloud users match local db.json",
    JSON.stringify(stable(cloudUsers)) === JSON.stringify(stable(db.users)),
    `cloud: ${cloudUsers.length}, local: ${db.users?.length ?? 0}`
  );
}

// Storage probe: upload -> fetch public URL -> delete
const probeName = `lifebook-live-probe-${Date.now()}.txt`;
const upRes = await fetch(`${url}/storage/v1/object/uploads/${probeName}`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "text/plain", "x-upsert": "true" },
  body: "lifebook-live-check",
});
check("storage upload accepted", upRes.ok, `${upRes.status}: ${(await upRes.text()).slice(0, 150)}`);

const pubRes = await fetch(`${url}/storage/v1/object/public/uploads/${probeName}`);
check("public URL serves the file", pubRes.ok && (await pubRes.text()) === "lifebook-live-check", `status ${pubRes.status}`);

const delRes = await fetch(`${url}/storage/v1/object/uploads/${probeName}`, { method: "DELETE", headers });
check("probe file cleaned up", delRes.ok, `status ${delRes.status}`);

if (failed) {
  console.error("LIVE SUPABASE CHECK FAILED");
  process.exit(1);
}
console.log("LIVE SUPABASE CHECK PASSED");
