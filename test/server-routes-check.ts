/**
 * Regression checks for the security-sensitive server.ts routes.
 * Assert-based, no framework: imports the Express app and drives it with
 * supertest-style HTTP calls via Node's fetch against an ephemeral listener.
 *
 * Covers the route changes made during backend stabilization:
 *   - /api/admin/* requires the platform-admin role (403 for normal users)
 *   - /api/subscription/upgrade is a hard 501 stub (no fake payments)
 *   - /api/ads/:id/click|view and POST /api/ads require authentication
 *   - POST /api/user/role cannot self-assign "admin"
 *   - /api/auth/confirm-login locks after OTP_MAX_ATTEMPTS wrong codes
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

// Isolate the db file BEFORE importing server.ts (it reads env at module load).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifebook-test-"));
process.env.LIFEBOOK_DB_PATH = path.join(tmpDir, "db.json");
process.env.LIFEBOOK_SKIP_AUTOSTART = "1"; // don't start Vite/listener on import
process.env.SESSION_SECRET = "test-secret-for-routes-check";

const serverModule = await import("../server");
const app: any = (serverModule as any).default;
const resetAuthRateLimiter: () => void = (serverModule as any).resetAuthRateLimiterForTests;

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

async function registerUser(name: string, email: string, role?: string): Promise<string> {
  const reg = await call("POST", "/api/auth/register", {
    name,
    email,
    password: "Sup3rSecret!",
    dob: "1990-01-01",
  });
  assert.strictEqual(reg.status, 201, `register failed: ${JSON.stringify(reg.body)}`);
  if (role) {
    // Grant role directly in the db file (self-service endpoint blocks "admin")
    const dbPath = process.env.LIFEBOOK_DB_PATH as string;
    const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    const user = db.users.find((u: any) => u.email === email);
    user.role = role;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }
  const login = await call("POST", "/api/auth/login", { email, password: "Sup3rSecret!" });
  assert.strictEqual(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
  return login.body.id; // signed session token
}

let passed = 0;
function check(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    passed++;
    console.log(`PASS: ${name}`);
  });
}

await check("admin metrics forbidden for normal user", async () => {
  const token = await registerUser("Plain User", "plain@example.com");
  const res = await call("GET", "/api/admin/metrics", undefined, token);
  assert.strictEqual(res.status, 403);
});

await check("admin metrics allowed for admin user", async () => {
  const token = await registerUser("Admin User", "admin@example.com", "admin");
  const res = await call("GET", "/api/admin/metrics", undefined, token);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.totalUsers !== undefined);
});

await check("admin revenue forbidden for normal user", async () => {
  const token = await registerUser("Plain Two", "plain2@example.com");
  const res = await call("GET", "/api/admin/revenue", undefined, token);
  assert.strictEqual(res.status, 403);
});

await check("subscription upgrade is a 501 stub", async () => {
  const token = await registerUser("Stub User", "stub@example.com");
  const res = await call("POST", "/api/subscription/upgrade", { planTier: "Individual Yearly" }, token);
  assert.strictEqual(res.status, 501);
});

await check("role switch rejects self-assigned admin", async () => {
  const token = await registerUser("Escalator", "esc@example.com");
  const res = await call("POST", "/api/user/role", { role: "admin" }, token);
  assert.strictEqual(res.status, 403);
});

await check("ad click tracker requires auth", async () => {
  const res = await call("POST", "/api/ads/ad_x/click");
  assert.strictEqual(res.status, 401);
});

await check("ad view tracker requires auth", async () => {
  const res = await call("POST", "/api/ads/ad_x/view");
  assert.strictEqual(res.status, 401);
});

await check("ad creation requires admin", async () => {
  const token = await registerUser("Ad Guy", "adguy@example.com");
  const res = await call("POST", "/api/ads", { title: "t" }, token);
  assert.strictEqual(res.status, 403);
});

await check("OTP confirmation locks after repeated wrong codes", async () => {
  resetAuthRateLimiter(); // shared-IP budget is spent by the register calls above
  const email = "otp@example.com";
  const token = await registerUser("Otp User", email);

  // Request a recovery code
  const forgot = await call("POST", "/api/auth/forgot-password", { email });
  assert.strictEqual(forgot.status, 200, JSON.stringify(forgot.body));

  // No real email is sent (Ethereal may be unreachable) — pull the OTP from the db
  const dbPath = process.env.LIFEBOOK_DB_PATH as string;
  const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const user = db.users.find((u: any) => u.email === email);
  assert.ok(user.loginOtp, "OTP should be persisted");

  const wrongCodes = ["000000", "000001", "000002", "000003"];
  for (const code of wrongCodes) {
    const res = await call("POST", "/api/auth/confirm-login", { email, otp: code });
    assert.strictEqual(res.status, 400, `wrong code ${code} should 400, got ${res.status}`);
  }
  // Fifth wrong attempt hits the limit (>= 5 accumulated)
  const fifth = await call("POST", "/api/auth/confirm-login", { email, otp: "000004" });
  assert.strictEqual(fifth.status, 400);
  const sixth = await call("POST", "/api/auth/confirm-login", { email, otp: "000005" });
  assert.strictEqual(sixth.status, 429, "should lock out with 429");

  // Even the CORRECT code is now rejected until a new one is requested
  const correct = await call("POST", "/api/auth/confirm-login", { email, otp: user.loginOtp });
  assert.strictEqual(correct.status, 429, "locked account must reject even correct codes");
  void token;
});

server.close();

console.log(`\nSERVER ROUTES CHECK PASSED (${passed} checks)`);
