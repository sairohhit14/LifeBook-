/**
 * Live verification of the db-backup flow against a REAL Supabase project.
 *
 *   npm run backup:verify
 *
 * Safe by construction: it round-trips a tiny probe snapshot to a TEMP path —
 * the live db.json is never read for upload nor overwritten on restore — and
 * deletes only the probe object it created. Skips prune (never deletes real
 * snapshots). Requires SUPABASE_URL + SUPABASE_KEY (service_role) in .env /
 * .env.local; placeholder values are rejected with setup instructions.
 */
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
if (fs.existsSync(".env.local")) {
  try {
    const envLocal = dotenv.parse(fs.readFileSync(".env.local", "utf-8"));
    for (const k in envLocal) (process.env as any)[k] = envLocal[k];
  } catch { /* ignore */ }
}

const { BACKUP_BUCKET, backupsConfigured, uploadBackup, listBackups, downloadBackup, restoreBackup } =
  await import("../server/db-backup");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

function fail(msg: string): never {
  console.error(`\nVERIFY FAILED: ${msg}`);
  process.exit(1);
}

function authHeaders(extra: Record<string, string> = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}

let passed = 0;
function ok(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

// ---- 0. configuration ----
if (!SUPABASE_URL || !SUPABASE_KEY) {
  fail("SUPABASE_URL / SUPABASE_KEY are not set. Add them to .env.local (service_role key).");
}
if (!backupsConfigured()) {
  fail("SUPABASE_* still hold .env.example placeholders. Paste real values into .env.local — get them from the Supabase dashboard: Project Settings → API.");
}
console.log(`Project: ${SUPABASE_URL.replace(/^https:\/\/([^\.]+)\..*/, "$1")}.supabase… (key not printed)\n`);

// ---- 1. REST reachability ----
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/vault_data?select=db_key&limit=1`, { headers: authHeaders() });
  if (res.ok) {
    ok("REST API reachable (vault_data table responds)");
  } else if (res.status === 404) {
    console.log(`WARN: vault_data table missing (REST 404) — vault sync will not work until it is created:
  create table if not exists vault_data (db_key text primary key, db_value jsonb not null);`);
  } else {
    fail(`REST API responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
} catch (e: any) {
  fail(`REST API unreachable (${e.message}). Check the project is active and SUPABASE_URL is correct.`);
}

// ---- 2. ensure the private db-backups bucket ----
async function bucketExists(): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BACKUP_BUCKET}`, { headers: authHeaders() });
  return res.ok;
}
try {
  if (!(await bucketExists())) {
    console.log(`Bucket "${BACKUP_BUCKET}" not found — creating it as PRIVATE…`);
    const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: BACKUP_BUCKET, public: false }),
    });
    if (!create.ok && create.status !== 409 && create.status !== 400) {
      fail(`bucket create failed (${create.status}): ${(await create.text()).slice(0, 200)}`);
    }
    if (!(await bucketExists())) {
      fail(`could not create bucket "${BACKUP_BUCKET}". Create it manually: Supabase dashboard → Storage → New bucket → name "${BACKUP_BUCKET}", PRIVATE. (SQL: insert into storage.buckets (id, name, public) values ('${BACKUP_BUCKET}', '${BACKUP_BUCKET}', false);)`);
    }
  }
  ok(`private bucket "${BACKUP_BUCKET}" exists`);
  const detail = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BACKUP_BUCKET}`, { headers: authHeaders() });
  if (detail.ok) {
    const meta: any = await detail.json();
    if (meta.public === true) fail(`bucket "${BACKUP_BUCKET}" is PUBLIC — it holds whole-database snapshots and must be private.`);
  }
} catch (e: any) {
  fail(`storage bucket check failed (${e.message})`);
}

// ---- 3. round-trip: upload → list → download → restore (temp paths only) ----
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-verify-"));
const probeDb = path.join(tmpDir, "probe-db.json");
const marker = `verify-${Date.now()}`;
fs.writeFileSync(probeDb, JSON.stringify({ users: [], __backupVerify: marker }, null, 2));

let probeName = "";
try {
  probeName = await uploadBackup(probeDb);
  ok(`snapshot uploaded: ${probeName}`);

  const names = await listBackups();
  if (!names.includes(probeName)) fail("uploaded snapshot missing from bucket listing");
  ok(`bucket listing contains the snapshot (total snapshots: ${names.length})`);

  const json = await downloadBackup(probeName);
  const parsed = JSON.parse(json);
  if (parsed.__backupVerify !== marker) fail("downloaded snapshot content does not match the probe");
  ok("downloaded snapshot decompresses to the exact probe content");

  const restoreTarget = path.join(tmpDir, "restored.json");
  await restoreBackup(probeName, restoreTarget);
  const restored = JSON.parse(fs.readFileSync(restoreTarget, "utf-8"));
  if (restored.__backupVerify !== marker) fail("restored file content mismatch");
  ok("restore wrote a valid db file (to a temp path — live db.json untouched)");
} catch (e: any) {
  fail(`round-trip failed: ${e.message}`);
} finally {
  // cleanup: remove the probe object and temp files
  if (probeName) {
    try {
      const del = await fetch(`${SUPABASE_URL}/storage/v1/object/${BACKUP_BUCKET}/${probeName}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      console.log(del.ok ? "Cleanup: probe snapshot deleted from bucket." : `Cleanup: probe delete returned ${del.status} (harmless — it is a tiny gzip file).`);
    } catch { /* best effort */ }
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\nVERIFY PASSED (${passed} checks) — the restore flow works against this Supabase project.`);
console.log("Operate with:  npm run backup:restore            (list snapshots)");
console.log("               npm run backup:restore -- --latest (restore newest into ./db.json)");
