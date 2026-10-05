/**
 * Regression check for Supabase Auth as the identity provider (server.ts).
 *
 * The real Supabase vault is NOT touched: global fetch is stubbed with a tiny
 * in-memory GoTrue so the server's auth flows can be driven end-tos-end:
 *   - registration provisions the identity via the admin API
 *   - login verifies the password against GoTrue and resolves the profile
 *   - a Supabase-only account gets a fresh local profile on first login
 *   - a legacy local account migrates into Supabase Auth on first login
 *   - password change verifies + updates the identity in GoTrue
 *
 * Runs with fake but "real-looking" SUPABASE_URL/KEY (isRealSupabaseConfig
 * gates the code paths; the mock never hits the network).
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "node:crypto";

// Isolate the db file BEFORE importing server.ts (it reads env at module load)
// and chdir away from the repo so dotenv can't load the developer's real .env.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-auth-"));
process.chdir(tmpDir);
process.env.LIFEBOOK_DB_PATH = path.join(tmpDir, "db.json");
process.env.LIFEBOOK_SKIP_AUTOSTART = "1"; // don't start Vite/listener on import
process.env.SESSION_SECRET = "test-secret-for-supabase-auth";
process.env.SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_KEY = "test-service-key-does-not-reach-network";

const realFetch: typeof fetch = (globalThis as any).fetch;

// ---- Mock GoTrue (stubbed global fetch) ----
const supabaseUsers = new Map<string, { id: string; password: string; name: string }>();
let lastAdminCreate: any = null;
let lastAdminPut: { id: string; password: string } | null = null;

const ADMIN_CREATES: any[] = [];

function mockId(email: string): string {
  return "00000000-0000-4000-8000-" + crypto.createHash("sha256").update(email).digest("hex").slice(0, 12);
}

(globalThis as any).fetch = async (input: any, init?: any): Promise<Response> => {
  const url = typeof input === "string" ? input : (input as Request).url;
  const method = (init?.method || "GET") as string;
  const u = new URL(url);
  const body = init?.body ? JSON.parse(String(init.body)) : {};

  if (u.pathname.endsWith("/auth/v1/admin/users") && method === "POST") {
    lastAdminCreate = body;
    ADMIN_CREATES.push(body);
    const id = mockId(body.email);
    supabaseUsers.set(body.email, { id, password: body.password, name: body.user_metadata?.name || "" });
    return new Response(JSON.stringify({ id, email: body.email, user_metadata: body.user_metadata }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const adminPut = u.pathname.match(/\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (adminPut && method === "PUT") {
    lastAdminPut = { id: adminPut[1], password: body.password };
    for (const rec of supabaseUsers.values()) {
      if (rec.id === adminPut[1]) rec.password = body.password;
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (u.pathname.endsWith("/auth/v1/token") && method === "POST") {
    const rec = supabaseUsers.get(body.email);
    if (rec && rec.password === body.password) {
      return new Response(JSON.stringify({
        access_token: `tok-${rec.id}`,
        user: { id: rec.id, email: body.email, user_metadata: { name: rec.name, dob: "", phone: "" } },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Vault sync / backups background noise — swallow.
  return new Response(null, { status: 200 });
};

const serverModule = await import("../server");
const app: any = (serverModule as any).default;
const resetAuthRateLimiter: () => void = (serverModule as any).resetAuthRateLimiterForTests;

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

const DB_PATH = process.env.LIFEBOOK_DB_PATH as string;
function readDbFile(): any {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function writeDbFile(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function call(method: string, url: string, body?: any, token?: string) {
  const res = await realFetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  resetAuthRateLimiter(); // the whole suite shares one IP (15/min budget)
  await fn();
  passed++;
  console.log(`PASS: ${name}`);
}

await check("registration provisions the identity in Supabase Auth", async () => {
  const reg = await call("POST", "/api/auth/register", {
    name: "Supabase Sue", email: "sue@example.com", password: "Sup3rSecret!", dob: "1992-02-02", phone: "555",
  });
  assert.strictEqual(reg.status, 201, JSON.stringify(reg.body));
  assert.strictEqual(lastAdminCreate?.email, "sue@example.com");
  assert.strictEqual(lastAdminCreate?.email_confirm, true, "email_confirm auto-logs the user in");
  assert.strictEqual(lastAdminCreate?.password, "Sup3rSecret!");
  assert.deepStrictEqual(lastAdminCreate?.user_metadata, { name: "Supabase Sue", dob: "1992-02-02", phone: "555" });
  const sueId = mockId("sue@example.com");
  const sue = readDbFile().users.find((u: any) => u.email === "sue@example.com");
  assert.ok(sue, "local profile created");
  assert.strictEqual(sue.id, sueId, "profile keyed to the Supabase identity");
  assert.strictEqual(sue.supabaseUid, sueId);
});

await check("login verifies against Supabase and returns a session", async () => {
  const login = await call("POST", "/api/auth/login", { email: "sue@example.com", password: "Sup3rSecret!" });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.id, "signed session token issued");
  const sue = readDbFile().users.find((u: any) => u.email === "sue@example.com");
  assert.strictEqual(login.body.legacyKey, sue.legacyKey, "same profile record");
});

await check("Supabase-only account gets a profile on first login", async () => {
  // Not in db.json; created directly in the auth provider (e.g. dashboard).
  supabaseUsers.set("direct@example.com", { id: mockId("direct@example.com"), password: "DirectPass1", name: "Direct User" });
  const login = await call("POST", "/api/auth/login", { email: "direct@example.com", password: "DirectPass1" });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));
  assert.strictEqual(login.body.name, "Direct User");
  const direct = readDbFile().users.find((u: any) => u.email === "direct@example.com");
  assert.ok(direct, "profile provisioned on first login");
  assert.strictEqual(direct.id, mockId("direct@example.com"));
});

await check("legacy local account migrates into Supabase Auth on its own login", async () => {
  // Start from a fresh db.json containing ONLY a pre-Supabase local account.
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync("LegacyPass1", salt, 64).toString("hex");
  writeDbFile({
    users: [{
      id: "legacy_local_x", name: "Legacy Larry", email: "larry@example.com",
      password: `${salt}:${hash}`, dob: "1980-01-01", phone: "", profilePhoto: "",
      legacyKey: "LB-AAAAAA", createdAt: "2025-01-01T00:00:00.000Z",
    }],
    memories: [], milestones: [], messages: [], family: [], documents: [],
    stories: [], notifications: [], chatHistory: {}, subscriptions: [], autobiographies: [],
  });

  const createsBefore = ADMIN_CREATES.length;
  const login = await call("POST", "/api/auth/login", { email: "larry@example.com", password: "LegacyPass1" });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));

  // Identity provisioned in GoTrue with the plaintext password, profile linked.
  const provision = ADMIN_CREATES[ADMIN_CREATES.length - 1];
  assert.ok(ADMIN_CREATES.length === createsBefore + 1, "legacy account provisioned into Supabase");
  assert.strictEqual(provision.email, "larry@example.com");
  assert.strictEqual(provision.password, "LegacyPass1");
  const larry = readDbFile().users.find((u: any) => u.email === "larry@example.com");
  assert.strictEqual(larry.supabaseUid, mockId("larry@example.com"), "profile linked to the new identity");
  assert.strictEqual(larry.id, "legacy_local_x", "existing profile/data stay stable");
});

await check("password change verifies and updates the identity in GoTrue", async () => {
  const login = await call("POST", "/api/auth/login", { email: "larry@example.com", password: "LegacyPass1" });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));
  const token: string = login.body.id;
  // Wrong current password must refuse before any admin update.
  const wrong = await call("PUT", "/api/settings/password", { currentPassword: "WrongPass1", newPassword: "NewPass99" }, token);
  assert.strictEqual(wrong.status, 400, JSON.stringify(wrong.body));
  assert.strictEqual(lastAdminPut, null, "no admin update on a failed verification");

  const ok = await call("PUT", "/api/settings/password", { currentPassword: "LegacyPass1", newPassword: "NewPass99" }, token);
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.strictEqual(lastAdminPut?.id, mockId("larry@example.com"));
  assert.strictEqual(lastAdminPut?.password, "NewPass99");

  // New password is now the live password on the Supabase side.
  const relogin = await call("POST", "/api/auth/login", { email: "larry@example.com", password: "NewPass99" });
  assert.strictEqual(relogin.status, 200, JSON.stringify(relogin.body));
});

server.close();
console.log(`\nSUPABASE AUTH CHECK PASSED (${passed} checks)`);