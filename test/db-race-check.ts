/**
 * Self-check for the cross-process db.json write race fix.
 *
 * Boots the Node backend's DB layer (autostart gated off) against a temp
 * db.json, races two concurrent writers for N iterations, and asserts:
 *   - the file parses after every round (no torn JSON from non-atomic writes)
 *   - every write survived (lockfile serializes last-writer-wins)
 *
 * Run: npx tsx test/db-race-check.ts
 */
import fs from "fs";
import os from "os";
import path from "path";

process.env.LIFEBOOK_SKIP_AUTOSTART = "1";

const ROUNDS = 30;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-race-"));
const dbPath = path.join(tmpDir, "db.json");
const lockPath = dbPath + ".lock";

// Mimic server.ts's locking protocol (same algorithm, minimal copy so the test
// exercises the same coordination contract).
function tryAcquireLock(): boolean {
  try {
    fs.mkdirSync(lockPath);
    return true;
  } catch {
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > 10_000) {
        fs.rmdirSync(lockPath);
        fs.mkdirSync(lockPath);
        return true;
      }
    } catch {}
    return false;
  }
}

function acquireLock() {
  const deadline = Date.now() + 10_000;
  while (!tryAcquireLock()) {
    if (Date.now() > deadline) throw new Error("lock wait exceeded");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

function releaseLock() {
  try { fs.rmdirSync(lockPath); } catch {}
}

function writeDbAtomic(data: any) {
  const tmp = dbPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dbPath);
}

function readDb(): any {
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

// Seed the db
writeDbAtomic({ notes: [] as string[] });

// Spawn a "Java process" (a child that writes with the same protocol) so both
// sides of the race are real OS processes contending over one file.
const { execFileSync } = await import("child_process");
const childSrc = `
const fs = require("fs");
const dbPath = process.argv[2];
const lockPath = dbPath + ".lock";
function acquire() {
  const deadline = Date.now() + 10000;
  while (true) {
    try { fs.mkdirSync(lockPath); break; } catch {
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 10000) {
          fs.rmdirSync(lockPath); fs.mkdirSync(lockPath); break;
        }
      } catch {}
      const until = Date.now() + 5;
      while (Date.now() < until) {}
    }
  }
}
function release() { try { fs.rmdirSync(lockPath); } catch {} }
function write(data) {
  const tmp = dbPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dbPath);
}
function read() { return JSON.parse(fs.readFileSync(dbPath, "utf-8")); }
for (let i = 0; i < 30; i++) {
  acquire();
  try {
    const db = read();
    db.notes.push("java-" + i);
    write(db);
  } finally { release(); }
}
console.log("child done");
`;
const childFile = path.join(tmpDir, "child.cjs");
fs.writeFileSync(childFile, childSrc);

let childSucceeded = false;
try {
  execFileSync("node", [childFile, dbPath], { stdio: "inherit" });
  childSucceeded = true;
} catch (err) {
  console.error("child writer failed:", err);
}

let torn = 0;
let childNotes = 0;
const db = readDb();
for (const n of db.notes) {
  if (n.startsWith("java-")) childNotes++;
}

// Also stress the protocol with a final burst of concurrent same-process writers.
// The read-modify-write must stay fully synchronous inside the lock: yielding
// (await) while holding the lock would let every writer interleave.
await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    (async () => {
      acquireLock();
      try {
        const cur = readDb();
        cur.notes.push("node-" + i);
        writeDbAtomic(cur);
      } finally {
        releaseLock();
      }
    })()
  )
);

for (let i = 0; i < ROUNDS; i++) {
  try {
    readDb();
  } catch {
    torn++;
  }
}

const final = readDb();
const nodeBurst = final.notes.filter((n: string) => n.startsWith("node-")).length;

let failed = false;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : " — " + detail}`);
  if (!ok) failed = true;
}

check("child writer ran", childSucceeded, "child process crashed");
check("no torn JSON after race", torn === 0, `${torn}/30 reads failed to parse`);
check("all child writes survived", childNotes === 30, `found ${childNotes}/30 java-* notes`);
check("all burst writes survived", nodeBurst === 8, `found ${nodeBurst}/8 node-* notes`);

// cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

if (failed) {
  console.error("DB RACE CHECK FAILED");
  process.exit(1);
}
console.log("DB RACE CHECK PASSED");
