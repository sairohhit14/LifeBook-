/**
 * Checks for per-user AI companion tuning.
 * Assert-based, no framework: drives the Express app over an ephemeral listener.
 *
 * - A fresh user starts with an empty learned profile
 * - Chatting folds signals into the stored profile (message count + topics)
 * - PATCH validates and persists explicit preferences (tone/verbosity/topics)
 * - Profiles are isolated per user: two users get different tuning
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

// Isolate the db file BEFORE importing server.ts (it reads env at module load).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-tuning-test-"));
// chdir away from the repo so dotenv (override:true) can't load the developer's
// real .env — inherited Firebase creds would register users in the live project
// and re-runs would die with EMAIL_EXISTS (same isolation as supabase-sync-check).
process.chdir(tmpDir);
process.env.LIFEBOOK_DB_PATH = path.join(tmpDir, "db.json");
process.env.LIFEBOOK_SKIP_AUTOSTART = "1"; // don't start Vite/listener on import
process.env.SESSION_SECRET = "test-secret-for-tuning-check";
process.env.COMPANION_MONTHLY_LIMIT = "-1"; // unlimited: this suite chats more than the default cap

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

const tokenA = await registerLogin("Tuning Alice", "alice-tuning@example.com");

await check("fresh user starts with an empty learned profile", async () => {
  const res = await call("GET", "/api/chat/preferences", undefined, tokenA);
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.strictEqual(res.body.messageCount, 0);
  assert.strictEqual(res.body.toneSource, "learned from their style");
  assert.deepStrictEqual(res.body.preferences, { tone: "auto", verbosity: "auto", focusTopics: [] });
});

await check("chatting stores behaviour signals in the profile", async () => {
  for (const text of [
    "I love playing cricket with my grandfather every Sunday morning",
    "Cricket practice was cancelled, so we talked about old cricket trophies",
    "Do you remember my favourite cricket memory?",
  ]) {
    const chat = await call("POST", "/api/chat", { message: text }, tokenA);
    assert.strictEqual(chat.status, 200, `chat failed: ${JSON.stringify(chat.body)}`);
  }
  const res = await call("GET", "/api/chat/preferences", undefined, tokenA);
  assert.strictEqual(res.body.messageCount, 3);
  assert.ok(
    (res.body.interests as string[]).includes("cricket"),
    `cricket should be a top interest, got: ${JSON.stringify(res.body.interests)}`
  );
});

await check("explicit preferences override learned style", async () => {
  const patched = await call(
    "PATCH",
    "/api/chat/preferences",
    { tone: "playful", verbosity: "concise", focusTopics: ["gardening"] },
    tokenA
  );
  assert.strictEqual(patched.status, 200, `expected 200, got ${patched.status}: ${JSON.stringify(patched.body)}`);
  assert.strictEqual(patched.body.tone, "playful");
  assert.strictEqual(patched.body.toneSource, "chosen by the user");
  assert.strictEqual(patched.body.verbosity, "concise");
  assert.ok(
    (patched.body.interests as string[]).includes("gardening"),
    `gardening should lead interests, got: ${JSON.stringify(patched.body.interests)}`
  );
  const again = await call("GET", "/api/chat/preferences", undefined, tokenA);
  assert.strictEqual(again.body.preferences.tone, "playful");
});

await check("invalid preference values are rejected", async () => {
  const badTone = await call("PATCH", "/api/chat/preferences", { tone: "pirate" }, tokenA);
  assert.strictEqual(badTone.status, 400, `expected 400, got ${badTone.status}`);
  const badVerb = await call("PATCH", "/api/chat/preferences", { verbosity: "endless" }, tokenA);
  assert.strictEqual(badVerb.status, 400, `expected 400, got ${badVerb.status}`);
  const badTopics = await call("PATCH", "/api/chat/preferences", { focusTopics: "gardening" }, tokenA);
  assert.strictEqual(badTopics.status, 400, `expected 400, got ${badTopics.status}`);
});

await check("a second user gets their own isolated tuning", async () => {
  const tokenB = await registerLogin("Tuning Bob", "bob-tuning@example.com");
  const res = await call("GET", "/api/chat/preferences", undefined, tokenB);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.messageCount, 0, "Bob must not see Alice's signals");
  assert.deepStrictEqual(res.body.interests, [], "Bob must not see Alice's interests");
});

server.close();

console.log(`\nCOMPANION TUNING CHECK PASSED (${passed} checks)`);
