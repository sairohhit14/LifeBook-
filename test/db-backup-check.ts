/**
 * db-backup self-check: snapshot upload → list → restore round-trip against a
 * faked Supabase Storage endpoint, plus corrupt-snapshot refusal, name-format
 * guards, and prune retention. Assert-based, no framework.
 *
 * Runs with Supabase env pointed at a fake host — the harness in test-ts.cjs
 * clears SUPABASE_* for children, and we re-set them here for the module under
 * test. The fake fetch below rejects any URL it doesn't recognize, so no real
 * network calls happen.
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

process.env.SUPABASE_URL = "https://fake-supabase.example";
process.env.SUPABASE_KEY = "fake-service-key";

const { uploadBackup, listBackups, downloadBackup, pruneBackups, runBackupCycle, restoreBackup } =
  await import("../server/db-backup");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-backup-test-"));
const dbPath = path.join(tmpDir, "db.json");
fs.writeFileSync(dbPath, JSON.stringify({ users: [{ id: "u1" }], memories: [] }, null, 2));

// ---- fake Supabase Storage ----
const objects = new Map<string, Uint8Array>(); // objectName -> gzip bytes

const realFetch = globalThis.fetch;
// ponytail: hand-rolled route table on global fetch — supertest-style servers
// can't intercept the module's direct Supabase calls; the fake stays inside
// this process and rejects unknown URLs.
(globalThis as any).fetch = async (url: any, init?: any) => {
  const u = String(url);
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (u === "https://fake-supabase.example/storage/v1/object/db-backups" && init?.method === "POST") {
    return json({ message: "no object" }, 400);
  }
  const up = /^https:\/\/fake-supabase\.example\/storage\/v1\/object\/db-backups\/([^/?]+)$/.exec(u);
  if (up && init?.method === "POST") {
    objects.set(decodeURIComponent(up[1]), new Uint8Array(init.body));
    return json({ Key: up[1] }, 200);
  }
  if (u.startsWith("https://fake-supabase.example/storage/v1/object/list/db-backups")) {
    return json([...objects.keys()].map((name) => ({ name })), 200);
  }
  const dl = /^https:\/\/fake-supabase\.example\/storage\/v1\/object\/db-backups\/([^/?]+)$/.exec(u);
  if (dl && (!init?.method || init.method === "GET")) {
    const data = objects.get(decodeURIComponent(dl[1]));
    if (!data) return json({ message: "not found" }, 404);
    return new Response(data as any, { status: 200 });
  }
  const del = /^https:\/\/fake-supabase\.example\/storage\/v1\/object\/db-backups\/([^/?]+)$/.exec(u);
  if (del && init?.method === "DELETE") {
    objects.delete(decodeURIComponent(del[1]));
    return json({}, 200);
  }
  return json({ message: `unexpected fetch: ${u}` }, 500);
};

let passed = 0;
function check(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    });
}

await check("upload creates a well-named snapshot", async () => {
  const name = await uploadBackup(dbPath, new Date("2026-09-20T12:00:00Z"));
  assert.match(name, /^db-2026-09-20T12-00-00-000Z\.json\.gz$/, "timestamped gzip name");
  assert.ok(objects.has(name));
});

await check("list returns snapshots oldest-first", async () => {
  await uploadBackup(dbPath, new Date("2026-09-20T13:00:00Z"));
  const names = await listBackups();
  assert.deepStrictEqual(names, ["db-2026-09-20T12-00-00-000Z.json.gz", "db-2026-09-20T13-00-00-000Z.json.gz"]);
});

await check("restore round-trips the exact db content", async () => {
  const json = await downloadBackup("db-2026-09-20T12-00-00-000Z.json.gz");
  assert.deepStrictEqual(JSON.parse(json), { users: [{ id: "u1" }], memories: [] });
  const target = path.join(tmpDir, "restored.json");
  await restoreBackup("db-2026-09-20T12-00-00-000Z.json.gz", target);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(target, "utf-8")), { users: [{ id: "u1" }], memories: [] });
});

await check("restore refuses corrupt snapshots", async () => {
  const zlib = await import("zlib");
  const { promisify } = await import("util");
  const gzip = promisify(zlib.gzip);
  objects.set("db-corrupt.json.gz", new Uint8Array(await gzip(Buffer.from("not json at all"))));
  const target = path.join(tmpDir, "should-not-exist.json");
  await assert.rejects(() => restoreBackup("db-corrupt.json.gz", target), /Unexpected token|is not valid JSON|JSON/i);
  assert.ok(!fs.existsSync(target), "target must be untouched");
  // leave the fake bucket clean for the prune test
  objects.delete("db-corrupt.json.gz");
});

await check("download rejects path-shaped object names", async () => {
  await assert.rejects(() => downloadBackup("../service_role/keys.json.gz"), /Invalid backup object name/);
});

await check("prune keeps only BACKUP_MAX_SNAPSHOTS", async () => {
  const { BACKUP_MAX_SNAPSHOTS } = await import("../server/db-backup");
  const before = await listBackups();
  for (let i = 0; i < BACKUP_MAX_SNAPSHOTS + 3; i++) {
    await uploadBackup(dbPath, new Date(Date.UTC(2026, 8, 20, 14, 0, i)));
  }
  const pruned = await pruneBackups();
  assert.strictEqual(pruned.length, before.length + 3, "everything above the retention cap is pruned");
  const remaining = await listBackups();
  assert.strictEqual(remaining.length, BACKUP_MAX_SNAPSHOTS);
  // oldest first: the survivors must be the newest snapshots
  assert.ok(remaining[remaining.length - 1] > remaining[0]);
});

await check("runBackupCycle is a safe no-op without configuration", async () => {
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_KEY = "";
  // new import to pick up cleared env — module reads env lazily per call
  const mod = await import(`../server/db-backup?nocache=${Date.now()}`);
  assert.strictEqual(await mod.runBackupCycle(dbPath), null);
  process.env.SUPABASE_URL = "https://fake-supabase.example";
  process.env.SUPABASE_KEY = "fake-service-key";
});

(globalThis as any).fetch = realFetch;

console.log(`\nDB BACKUP CHECK PASSED (${passed} checks)`);
