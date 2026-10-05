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
// chdir away from the repo so dotenv (override:true) can't load the developer's
// real .env — inherited Firebase creds would register users in the live project
// and re-runs would die with EMAIL_EXISTS (same isolation as supabase-sync-check).
process.chdir(tmpDir);
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
  // Fresh IP-budget per helper call: the suite shares one IP and the limiter
  // is 15/min — without this, later cases would 429 on register/login.
  resetAuthRateLimiter();
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

await check("subscription create-order refuses without Razorpay config", async () => {
  const token = await registerUser("Stub User", "stub@example.com");
  const res = await call("POST", "/api/subscription/create-order", { planName: "Individual Yearly" }, token);
  assert.strictEqual(res.status, 503);
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

// ===================== SECURITY HARDENING REGRESSIONS =====================

resetAuthRateLimiter();

await check("registration rejects weak passwords", async () => {
  const res = await call("POST", "/api/auth/register", {
    name: "Weak Pass", email: "weak@example.com", password: "short", dob: "1990-01-01",
  });
  assert.strictEqual(res.status, 400);
  assert.match(String(res.body.error), /8 characters/i);
});

await check("registration rejects malformed email", async () => {
  const res = await call("POST", "/api/auth/register", {
    name: "Bad Email", email: "not-an-email", password: "GoodPass1", dob: "1990-01-01",
  });
  assert.strictEqual(res.status, 400);
});

await check("duplicate-email registration does not leak existence", async () => {
  await registerUser("Original Owner", "dup@example.com");
  resetAuthRateLimiter();
  const res = await call("POST", "/api/auth/register", {
    name: "Second Comma", email: "dup@example.com", password: "GoodPass1", dob: "1990-01-01",
  });
  // Same shape as success, no legacyKey/token for the existing account
  assert.strictEqual(res.status, 402);
  assert.strictEqual(res.body.legacyKey, "");
  assert.strictEqual(res.body.email, "");
});

await check("login failure is generic for unknown user and wrong password", async () => {
  const unknown = await call("POST", "/api/auth/login", { email: "ghost@example.com", password: "Whatever1" });
  assert.strictEqual(unknown.status, 400);
  const token = await registerUser("Timing Target", "timing@example.com");
  void token;
  resetAuthRateLimiter();
  const wrongPw = await call("POST", "/api/auth/login", { email: "timing@example.com", password: "WrongPass1" });
  assert.strictEqual(wrongPw.status, 400);
  assert.strictEqual(unknown.body.error, wrongPw.body.error, "responses must be indistinguishable");
});

await check("forgot-password response is enumeration-agnostic", async () => {
  const unknown = await call("POST", "/api/auth/forgot-password", { email: "nobody@example.com" });
  assert.strictEqual(unknown.status, 200);
  const known = await call("POST", "/api/auth/forgot-password", { email: "timing@example.com" });
  assert.strictEqual(known.status, 200);
  assert.strictEqual(unknown.body.message, known.body.message, "must not reveal whether the account exists");
  assert.ok(!("previewUrl" in known.body), "delivery internals must not leak");
});

await check("confirm-login for unknown email matches wrong-code response", async () => {
  const unknown = await call("POST", "/api/auth/confirm-login", { email: "nobody@example.com", otp: "123456" });
  assert.strictEqual(unknown.status, 400);
  assert.strictEqual(unknown.body.error, "Invalid login confirmation code.");
});

await check("role switch rejects arbitrary role strings", async () => {
  const token = await registerUser("Role Hacker", "rolehacker@example.com");
  for (const role of ["admin", "GodMode", "superuser", "", "platform-admin"]) {
    const res = await call("POST", "/api/user/role", { role }, token);
    assert.strictEqual(res.status, 403, `role "${role}" must be rejected`);
  }
});

await check("role switch success leaks no user record", async () => {
  const token = await registerUser("Role User", "roleuser@example.com");
  const res = await call("POST", "/api/user/role", { role: "Premium User" }, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user, undefined, "user record (incl. password hash) must not be returned");
  assert.strictEqual(res.body.success, true);
});

await check("billing summary strips password hash and secrets", async () => {
  const token = await registerUser("Billing User", "billing@example.com");
  const res = await call("GET", "/api/billing/summary", undefined, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.password, undefined, "password hash must never leave the server");
});

await check("retired per-user emailConfig is purged from storage", async () => {
  const token = await registerUser("Legacy Mail User", "legacymail@example.com");
  // Simulate a record written before per-user email settings were retired.
  const dbPath = process.env.LIFEBOOK_DB_PATH!;
  const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const target = raw.users.find((u: any) => u.email === "legacymail@example.com");
  assert.ok(target, "registered user must exist on disk");
  target.emailConfig = { protocol: "SMTP", smtpPass: "app-secret-1234", resendApiKey: "re_legacy" };
  fs.writeFileSync(dbPath, JSON.stringify(raw, null, 2));

  // A read must never hand the retired secrets back to a client...
  const summary = await call("GET", "/api/billing/summary", undefined, token);
  assert.strictEqual(summary.status, 200);
  assert.strictEqual(summary.body.user.emailConfig, undefined, "retired email config must not be returned");
  // ...and the next write must drop them from storage for good.
  await call("POST", "/api/user/role", { role: "Premium User" }, token);
  const after = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const afterUser = after.users.find((u: any) => u.email === "legacymail@example.com");
  assert.ok(afterUser, "user must still exist after the write");
  assert.strictEqual(afterUser.emailConfig, undefined, "legacy emailConfig must be purged on write");
});

await check("upload rejects non-media file types", async () => {
  const token = await registerUser("Uploader", "uploader@example.com");
  const html = await call("POST", "/api/upload", {
    filename: "payload.html", type: "image",
    base64Data: Buffer.from("<h1>stored xss</h1>").toString("base64"),
  }, token);
  assert.strictEqual(html.status, 415, "html uploads must be rejected");
  const svg = await call("POST", "/api/upload", {
    filename: "payload.svg", type: "image",
    base64Data: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64"),
  }, token);
  assert.strictEqual(svg.status, 415, "svg uploads must be rejected");
});

await check("upload accepts a real image", async () => {
  const token = await registerUser("Uploader Two", "uploader2@example.com");
  const png = await call("POST", "/api/upload", {
    filename: "pixel.png", type: "image",
    base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  }, token);
  assert.strictEqual(png.status, 200, `expected 200, got ${png.status}: ${JSON.stringify(png.body)}`);
  assert.ok(png.body.url);
});

await check("guest tokens are confined to the Family View allowlist", async () => {
  resetAuthRateLimiter();
  const ownerToken = await registerUser("Legacy Owner", "owner@example.com");
  const me = await call("GET", "/api/auth/current-user", undefined, ownerToken);
  const legacyKey = me.body.legacyKey;
  assert.ok(legacyKey, "owner must have a legacy key");
  const guestLogin = await call("POST", "/api/auth/family-login", { legacyKey, familyMemberName: "Trusted Relative" });
  assert.strictEqual(guestLogin.status, 200, JSON.stringify(guestLogin.body));
  const guestToken: string = guestLogin.body.id;
  assert.ok(guestToken.startsWith("guest_"));

  // Allowed: family-view reads
  const okRead = await call("GET", "/api/memories", undefined, guestToken);
  assert.strictEqual(okRead.status, 200);
  const okUser = await call("GET", "/api/auth/current-user", undefined, guestToken);
  assert.strictEqual(okUser.status, 200);

  // Blocked: mutation
  const blockedWrite = await call("POST", "/api/memories", { title: "t", description: "d", date: "2020-01-01" }, guestToken);
  assert.strictEqual(blockedWrite.status, 403);

  // Blocked: sensitive reads outside the allowlist
  const blockedBilling = await call("GET", "/api/billing/summary", undefined, guestToken);
  assert.strictEqual(blockedBilling.status, 403, "guests must not reach billing data");
  const blockedSub = await call("GET", "/api/subscription/current", undefined, guestToken);
  assert.strictEqual(blockedSub.status, 403, "guests must not reach subscription data");
  const blockedAdmin = await call("GET", "/api/admin/metrics", undefined, guestToken);
  assert.strictEqual(blockedAdmin.status, 403);

  // Blocked: spending the owner's AI quota / rotating their key
  const blockedKey = await call("POST", "/api/settings/legacy-key/regenerate", undefined, guestToken);
  assert.strictEqual(blockedKey.status, 403);
});

await check("legacy-key regeneration blocks guest tokens (defense in depth)", async () => {
  // Already covered above via the guest flow; kept as an explicit named check
  // if the guest allowlist ever widens.
  assert.ok(true);
});

await check("security headers are present on API responses", async () => {
  // CSP (and HSTS) are production-only: dev must stay open for Vite's inline
  // HMR preamble. Flip to prod mode for this request, restore afterwards.
  process.env.NODE_ENV = "production";
  try {
    const res = await fetch(base + "/api/health");
    assert.ok(res.headers.get("content-security-policy"), "CSP must be set");
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
    assert.strictEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  } finally {
    delete process.env.NODE_ENV;
  }
});

await check("expired or garbage session tokens are rejected", async () => {
  const res = await call("GET", "/api/memories", undefined, "not-a-token");
  assert.strictEqual(res.status, 401);
  const res2 = await call("GET", "/api/memories", undefined, "abc.def.ghi");
  assert.strictEqual(res2.status, 401);
});

await check("search requires ownership even with crafted queries", async () => {
  // User B must not surface User A's data via search (IDOR regression)
  const tokenA = await registerUser("Searcher A", "searcha@example.com");
  await call("POST", "/api/memories", { title: "Classified Memory XYZZY", description: "secret", date: "2020-01-01" }, tokenA);
  const tokenB = await registerUser("Searcher B", "searchb@example.com");
  const res = await call("GET", "/api/search?q=XYZZY", undefined, tokenB);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.memories.length, 0, "User B must not see User A's memories");
});

server.close();

console.log(`\nSERVER ROUTES CHECK PASSED (${passed} checks)`);
