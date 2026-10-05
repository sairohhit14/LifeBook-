/**
 * Checks for the monthly per-user AI Companion limit.
 * Assert-based, no framework: drives the Express app over an ephemeral listener.
 *
 * - Default cap is 2 per calendar month, enforced server-side in POST /api/chat
 * - First two messages pass (degraded-mode replies — no AI key needed), third gets 429
 * - GET /api/chat/preferences reports used/limit/remaining
 * - The cap is per user: a second user still has their full quota
 * - COMPANION_MONTHLY_LIMIT env override (-1 unlimited) works
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

// Isolate the db file BEFORE importing server.ts (it reads env at module load).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-limit-test-"));
// chdir away from the repo so dotenv (override:true) can't load the developer's
// real .env (same isolation as companion-tuning-check).
process.chdir(tmpDir);
process.env.LIFEBOOK_DB_PATH = path.join(tmpDir, "db.json");
process.env.LIFEBOOK_SKIP_AUTOSTART = "1"; // don't start Vite/listener on import
process.env.SESSION_SECRET = "test-secret-for-limit-check";
process.env.GEMINI_API_KEY = ""; // exercise the degraded path — no AI needed
// dotenv inside server.ts runs with override:true and re-loads the developer's
// real .env — re-clear AFTER import so tests never reach the real AI API.
process.env.COMPANION_MONTHLY_LIMIT = "2";

const serverModule = await import("../server");
process.env.GEMINI_API_KEY = "";
process.env.COMPANION_MONTHLY_LIMIT = "2";
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

async function registerLogin(name: string, email: string): Promise<string> {
  const reg = await call("POST", "/api/auth/register", {
    name,
    email,
    password: "Sup3rSecret!",
    dob: "1990-01-01",
  });
  assert.strictEqual(reg.status, 201, `register failed: ${JSON.stringify(reg.body)}`);
  const login = await call("POST", "/api/auth/login", { email, password: "Sup3rSecret!" });
  assert.strictEqual(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
  return login.body.id;
}

let passed = 0;
function check(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    passed++;
    console.log(`PASS: ${name}`);
  });
}

const tokenA = await registerLogin("Limit Alice", "alice-limit@example.com");

await check("fresh user has full quota reported in preferences", async () => {
  const res = await call("GET", "/api/chat/preferences", undefined, tokenA);
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.deepStrictEqual(res.body.usage, { used: 0, limit: 2, remaining: 2, month: new Date().toISOString().slice(0, 7) });
});

await check("first two messages succeed, third is rejected with 429", async () => {
  for (let i = 1; i <= 2; i++) {
    const chat = await call("POST", "/api/chat", { message: `hello there ${i}` }, tokenA);
    assert.strictEqual(chat.status, 200, `message ${i} failed: ${JSON.stringify(chat.body)}`);
    assert.strictEqual(chat.body.sender, "companion");
  }
  const third = await call("POST", "/api/chat", { message: "one too many" }, tokenA);
  assert.strictEqual(third.status, 429, `expected 429, got ${third.status}: ${JSON.stringify(third.body)}`);
  assert.strictEqual(third.body.code, "COMPANION_LIMIT_REACHED");
  assert.strictEqual(third.body.usage.remaining, 0);
});

await check("rejected message never lands in chat history", async () => {
  const hist = await call("GET", "/api/chat/history", undefined, tokenA);
  assert.strictEqual(hist.status, 200);
  const userTexts = (hist.body as any[]).filter((m) => m.sender === "user").map((m) => m.text);
  assert.deepStrictEqual(userTexts, ["hello there 1", "hello there 2"], "only the two admitted messages may persist");
});

await check("preferences report the exhausted quota", async () => {
  const res = await call("GET", "/api/chat/preferences", undefined, tokenA);
  assert.strictEqual(res.body.usage.used, 2);
  assert.strictEqual(res.body.usage.remaining, 0);
});

await check("the cap is per user — another user keeps their full quota", async () => {
  const tokenB = await registerLogin("Limit Bob", "bob-limit@example.com");
  const chat = await call("POST", "/api/chat", { message: "bob's first message" }, tokenB);
  assert.strictEqual(chat.status, 200, `Bob's first message must pass, got ${chat.status}`);
  const prefs = await call("GET", "/api/chat/preferences", undefined, tokenB);
  assert.deepStrictEqual(prefs.body.usage, { used: 1, limit: 2, remaining: 1, month: new Date().toISOString().slice(0, 7) });
});

await check("COMPANION_MONTHLY_LIMIT=-1 disables the cap", async () => {
  // Same app, fresh user: flip the env — it is read per request.
  process.env.COMPANION_MONTHLY_LIMIT = "-1";
  try {
    const reg = await call("POST", "/api/auth/register", {
      name: "Unlimited Uma", email: "uma@example.com", password: "Sup3rSecret!", dob: "1990-01-01",
    });
    assert.strictEqual(reg.status, 201);
    const login = await call("POST", "/api/auth/login", { email: "uma@example.com", password: "Sup3rSecret!" });
    const token = login.body.id;
    for (let i = 0; i < 4; i++) {
      const chat = await call("POST", "/api/chat", { message: `free chat ${i}` }, token);
      assert.strictEqual(chat.status, 200, `unlimited chat ${i} failed: ${JSON.stringify(chat.body)}`);
    }
    const prefs = await call("GET", "/api/chat/preferences", undefined, token);
    assert.strictEqual(prefs.body.usage.limit, -1);
    assert.strictEqual(prefs.body.usage.remaining, null);
  } finally {
    process.env.COMPANION_MONTHLY_LIMIT = "2";
  }
});

console.log(`\nCOMPANION LIMIT CHECK PASSED (${passed} checks)`);
server.close();
process.exit(0);
