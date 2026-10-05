/**
 * Checks for the time-capsule Gmail delivery fix + memory photo captions.
 * Assert-based, no framework: drives the Express app over an ephemeral listener.
 *
 * - Invalid recipient emails are rejected on message create/update (400)
 * - Instant delivery without a real SMTP/Resend transport fails honestly
 *   (500, status "failed") instead of fake-marking "delivered" via Ethereal
 * - Memory media captions (per-photo text) survive a create → read round-trip
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

// Isolate the db file BEFORE importing server.ts (it reads env at module load).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-capsule-test-"));
// chdir away from the repo so dotenv (override:true) can't load the developer's
// real .env — inherited Firebase creds would register users in the live project
// and re-runs would die with EMAIL_EXISTS (same isolation as supabase-sync-check).
process.chdir(tmpDir);
process.env.LIFEBOOK_DB_PATH = path.join(tmpDir, "db.json");
process.env.LIFEBOOK_SKIP_AUTOSTART = "1"; // don't start Vite/listener on import
process.env.SESSION_SECRET = "test-secret-for-capsule-check";
// Ensure no real transport is configured, so the honest-fail path is exercised.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.RESEND_API_KEY;

const serverModule = await import("../server");
const app: any = (serverModule as any).default;

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

async function call(method: string, url: string, body?: any, token?: string) {
  const res = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json };
}

let passed = 0;
function check(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    passed++;
    console.log(`PASS: ${name}`);
  });
}

// Register + login a fresh user for the checks below.
const reg = await call("POST", "/api/auth/register", {
  name: "Capsule Tester",
  email: "capsule@example.com",
  password: "Sup3rSecret!",
  dob: "1990-01-01",
});
assert.strictEqual(reg.status, 201, `register failed: ${JSON.stringify(reg.body)}`);
const login = await call("POST", "/api/auth/login", {
  email: "capsule@example.com",
  password: "Sup3rSecret!",
});
assert.strictEqual(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
const token: string = login.body.id;

const validMsg = {
  title: "For the future",
  recipientName: "Granddaughter",
  recipientEmail: "granddaughter@gmail.com",
  deliveryOption: "Specific Date",
  deliveryDate: "2041-04-15",
  deliveryTime: "09:00",
  type: "text",
  content: "Hello from the past.",
};

await check("create message rejects invalid recipient email", async () => {
  const res = await call("POST", "/api/messages", { ...validMsg, recipientEmail: "not-an-email" }, token);
  assert.strictEqual(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
});

let msgId = "";
await check("create message accepts a real Gmail-style address", async () => {
  const res = await call("POST", "/api/messages", validMsg, token);
  assert.strictEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.strictEqual(res.body.recipientEmail, "granddaughter@gmail.com");
  msgId = res.body.id;
});

await check("update message rejects invalid recipient email", async () => {
  const res = await call("PUT", `/api/messages/${msgId}`, { recipientEmail: "bad@@x" }, token);
  assert.strictEqual(res.status, 400, `expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
});

await check("instant delivery fails honestly without a real transport", async () => {
  const res = await call("POST", `/api/messages/${msgId}/deliver`, undefined, token);
  assert.strictEqual(res.status, 500, `expected 500, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.match(String(res.body.error || ""), /not configured/i);
  const list = await call("GET", "/api/messages", undefined, token);
  const msg = (list.body as any[]).find((m: any) => m.id === msgId);
  assert.ok(msg, "message should still exist");
  assert.strictEqual(msg.status, "failed", `expected status failed, got ${msg.status}`);
  assert.ok(msg.status !== "delivered", "must NOT be fake-marked delivered");
});

await check("memory photo captions survive create → read", async () => {
  const created = await call(
    "POST",
    "/api/memories",
    {
      title: "Diwali 1998",
      description: "Festival of lights at grandma's.",
      date: "1998-10-20",
      location: "Jaipur",
      tags: ["family"],
      media: [{ id: "media_1", type: "image", url: "/uploads/x.png", name: "x.png", caption: "Diwali at grandma's, 1998" }],
    },
    token
  );
  assert.strictEqual(created.status, 201, `expected 201, got ${created.status}: ${JSON.stringify(created.body)}`);
  const list = await call("GET", "/api/memories", undefined, token);
  const mem = (list.body as any[]).find((m: any) => m.id === created.body.id);
  assert.ok(mem, "memory should be readable");
  assert.strictEqual(mem.media[0].caption, "Diwali at grandma's, 1998");
});

server.close();

console.log(`\nMESSAGE CAPSULE CHECK PASSED (${passed} checks)`);
