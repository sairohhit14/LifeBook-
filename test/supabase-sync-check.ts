/**
 * Self-check for the Supabase vault sync (no network, no credentials).
 *
 * Stubs global fetch to mimic PostgREST: a fake vault_data table keyed by
 * db_key. Verifies, through the real server.ts code paths:
 *   - writeDb() pushes collections as db_key/db_value rows (merge-duplicates)
 *   - downloadDbFromSupabase() hydrates a fresh db.json from those rows
 *   - a full write -> download round-trip preserves the data
 *
 * Run: npx tsx test/supabase-sync-check.ts
 */
import fs from "fs";
import os from "os";
import path from "path";

// Isolate: point DB_PATH at a temp dir BEFORE server.ts is imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-supasync-"));
process.chdir(tmpDir);

process.env.LIFEBOOK_SKIP_AUTOSTART = "1";
process.env.SUPABASE_URL = "https://fake-project.supabase.co";
process.env.SUPABASE_KEY = "fake-service-key";
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;

// Fake PostgREST table
const vault = new Map<string, any>();
let uploadsSeen = 0;

(globalThis as any).fetch = async (url: string, init?: any) => {
  const u = String(url);
  const respond = (status: number, body: any) =>
    ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });

  if (u.includes("/rest/v1/vault_data")) {
    if ((init?.method || "GET") === "POST") {
      const rows = JSON.parse(init.body);
      for (const r of rows) vault.set(r.db_key, r.db_value);
      uploadsSeen += rows.length;
      return respond(201, []);
    }
    // GET: PostgREST returns an array of rows
    return respond(200, [...vault.entries()].map(([db_key, db_value]) => ({ db_key, db_value })));
  }
  return respond(404, { message: "unexpected url " + u });
};

const { readDb, writeDb, downloadDbFromSupabase } = await import("../server");

// 1. Seed db.json locally, then write through the real writeDb (should push to fake Supabase)
fs.writeFileSync(path.join(tmpDir, "db.json"), JSON.stringify({ users: [{ id: "u1", name: "Round" }], memories: [], notifications: [] }));
const seeded = readDb();
seeded.memories.push({ id: "m1", userId: "u1", title: "kept?" });
writeDb(seeded);

if (uploadsSeen === 0) { console.error("FAIL: writeDb did not push any rows to Supabase"); process.exit(1); }

// 2. Wipe the local file and hydrate from the fake vault through the real downloader
fs.rmSync(path.join(tmpDir, "db.json"));
// The downloader skips within its 3s cache window; wait it out.
await new Promise((r) => setTimeout(r, 3100));
await downloadDbFromSupabase();

if (!fs.existsSync(path.join(tmpDir, "db.json"))) {
  console.error("FAIL: downloadDbFromSupabase did not write db.json");
  process.exit(1);
}
const hydrated = JSON.parse(fs.readFileSync(path.join(tmpDir, "db.json"), "utf-8"));

let failed = false;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : " — " + detail}`);
  if (!ok) failed = true;
}

check("vault received collections as rows", vault.has("users") && vault.has("memories"), `keys: ${[...vault.keys()]}`);
check("users row preserved", JSON.stringify(vault.get("users")) === JSON.stringify([{ id: "u1", name: "Round" }]));
check("round-trip memory survived", hydrated.memories?.some((m: any) => m.id === "m1" && m.title === "kept?"), JSON.stringify(hydrated.memories || []));
check("hydrated users match", JSON.stringify(hydrated.users) === JSON.stringify([{ id: "u1", name: "Round" }]));

try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

if (failed) {
  console.error("SUPABASE SYNC CHECK FAILED");
  process.exit(1);
}
console.log("SUPABASE SYNC CHECK PASSED");
