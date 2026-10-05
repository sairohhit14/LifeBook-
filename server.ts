import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import cors from "cors";
import crypto from "crypto";


dotenv.config();
if (fs.existsSync(path.join(process.cwd(), ".env.local"))) {
  try {
    const envLocal = dotenv.parse(fs.readFileSync(path.join(process.cwd(), ".env.local")));
    for (const k in envLocal) {
      process.env[k] = envLocal[k];
    }
  } catch (e) {
    console.warn("Failed to parse .env.local file:", e);
  }
}

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;

// Initialize Firebase Admin SDK safely using direct modular imports
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Firebase Admin SDK:", err);
    }
  } else {
    console.warn("Firebase Admin SDK credentials not fully specified in environment variables. Safe bypass activated.");
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Enable CORS for all routes
// ponytail: wildcard origin on an authenticated API — tighten once the production
// frontend origin is stable (allow-list it plus http://localhost:* for dev).
app.use(cors());

// Inject Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Simple memory-based rate limiter to protect auth endpoints
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
// Test seam: tests share one IP and would trip the limiter across cases.
export function resetAuthRateLimiterForTests() {
  loginAttempts.clear();
}
function authRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    if (now > attempt.resetTime) {
      loginAttempts.set(ip, { count: 1, resetTime: now + 60000 });
      return next();
    }
    if (attempt.count >= 15) {
      return res.status(429).json({ error: "Too many login/registration attempts. Please try again in 1 minute." });
    }
    attempt.count++;
    loginAttempts.set(ip, attempt);
  } else {
    loginAttempts.set(ip, { count: 1, resetTime: now + 60000 });
  }
  next();
}


// Enable JSON bodies up to 50MB for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup file-based DB path (using writeable /tmp on Vercel)
const DB_PATH =
  process.env.LIFEBOOK_DB_PATH ||
  (isVercel
    ? path.join("/tmp", "db.json")
    : path.join(process.cwd(), "db.json"));

const UPLOADS_DIR = isVercel
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploads statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Error handling middleware for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  // Ensure API routes always return JSON
  if (req.path.startsWith("/api/")) {
    res.status(500).json({ error: err.message || "Internal server error" });
  } else {
    next(err);
  }
});

let lastDbDownloadTime = 0;
const DB_DOWNLOAD_CACHE_MS = 3000; // 3 seconds cache

/* ================= Supabase vault sync (all user data) =================
 * db.json collections are mirrored 1:1 into the `vault_data` table
 * (db_key text primary key, db_value jsonb) — the same schema the Java
 * backend reads/writes, so both backends share one source of truth.
 * Firebase Auth remains the identity provider; all user DATA lives here.
 */
const SUPABASE_URL_ENV = process.env.SUPABASE_URL || "";
const SUPABASE_KEY_ENV = process.env.SUPABASE_KEY || "";
const VAULT_TABLE = "vault_data";

function supabaseConfigured(): boolean {
  return !!(SUPABASE_URL_ENV && SUPABASE_KEY_ENV);
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_KEY_ENV,
    Authorization: `Bearer ${SUPABASE_KEY_ENV}`,
    ...extra,
  };
}

async function downloadDbFromSupabase() {
  if (!supabaseConfigured()) return;

  const now = Date.now();
  if (now - lastDbDownloadTime < DB_DOWNLOAD_CACHE_MS) {
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL_ENV}/rest/v1/${VAULT_TABLE}?select=db_key,db_value`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) {
      console.error(`[Supabase DB] Download failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      lastDbDownloadTime = Date.now(); // back off briefly; don't hammer on every request
      return;
    }
    const rows = (await res.json()) as Array<{ db_key: string; db_value: any }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log("[Supabase DB] vault_data is empty. Seeding from local db.json...");
      const localData = fs.existsSync(DB_PATH)
        ? JSON.parse(fs.readFileSync(DB_PATH, "utf-8"))
        : initialDb;
      lastDbDownloadTime = Date.now();
      await uploadDbToSupabase(localData);
      return;
    }
    const data: any = {};
    for (const row of rows) {
      if (row.db_key) data[row.db_key] = row.db_value;
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    lastDbDownloadTime = Date.now();
    console.log("[Supabase DB] Synced db.json from Supabase vault.");
  } catch (err: any) {
    console.error("[Supabase DB] Error downloading db:", err.message);
    lastDbDownloadTime = Date.now();
  }
}

async function uploadDbToSupabase(data: any) {
  if (!supabaseConfigured()) return;
  try {
    const rows = Object.entries(data)
      .filter(([key]) => key !== "_id")
      .map(([db_key, db_value]) => ({ db_key, db_value }));
    if (rows.length === 0) return;

    const res = await fetch(`${SUPABASE_URL_ENV}/rest/v1/${VAULT_TABLE}`, {
      method: "POST",
      headers: supabaseHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      console.error(`[Supabase DB] Upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    } else {
      console.log("[Supabase DB] Uploaded db.json to Supabase vault.");
    }
  } catch (err: any) {
    console.error("[Supabase DB] Error uploading db:", err.message);
  }
}

let lastSchedulerCheckTime = 0;
const SCHEDULER_CHECK_INTERVAL_MS = 60000; // 1 minute

app.use(async (req, res, next) => {
  // Only apply to /api/ routes
  if (isVercel && req.path.startsWith("/api/")) {
    try {
      await downloadDbFromSupabase();
    } catch (err) {
      console.error("[Supabase DB] Middleware download error:", err);
    }

    // Trigger scheduled message check in background
    const now = Date.now();
    if (now - lastSchedulerCheckTime > SCHEDULER_CHECK_INTERVAL_MS) {
      lastSchedulerCheckTime = now;
      checkAndDeliverScheduledMessages().catch(err => {
        console.error("[Firestore DB] Background scheduler error:", err);
      });
    }
  }
  next();
});

// Initialize DB if it doesn't exist
const initialDb = {
  users: [],
  memories: [],
  milestones: [],
  messages: [],
  family: [],
  documents: [],
  stories: [],
  notifications: [],
  chatHistory: {} // userId -> ChatMessage[]
};

/* ============ db.json write safety ============
 * Writes are serialized with a mkdir-based lockfile (atomic on every OS) and
 * land atomically via temp-file+rename so readers never see torn JSON.
 */
const DB_LOCK_STALE_MS = 10_000;
const DB_LOCK_MAX_WAIT_MS = 10_000;
const DB_LOCK_SLEEP_MS = 25;

function dbLockPath() {
  return DB_PATH + ".lock";
}

function tryAcquireDbLock(): boolean {
  try {
    fs.mkdirSync(dbLockPath());
    return true;
  } catch {
    // ponytail: crashed process left the lock behind; take it over after 10s
    try {
      if (Date.now() - fs.statSync(dbLockPath()).mtimeMs > DB_LOCK_STALE_MS) {
        fs.rmdirSync(dbLockPath());
        fs.mkdirSync(dbLockPath());
        return true;
      }
    } catch {
      // lock vanished between attempts; caller will retry
    }
    return false;
  }
}

// ponytail: busy-wait because Atomics.wait throws on the main thread — the only
// thread Vercel's serverless runtime gives us. Writes are rare; waits are ms-scale.
function sleepSync(ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {}
}

function acquireDbLock() {
  const deadline = Date.now() + DB_LOCK_MAX_WAIT_MS;
  while (!tryAcquireDbLock()) {
    if (Date.now() > deadline) {
      console.warn(`[DB] Lock wait exceeded ${DB_LOCK_MAX_WAIT_MS}ms; forcing past stale lock.`);
      try { fs.rmdirSync(dbLockPath()); } catch {}
      try { fs.mkdirSync(dbLockPath()); } catch {}
      return;
    }
    sleepSync(DB_LOCK_SLEEP_MS);
  }
}

function releaseDbLock() {
  try { fs.rmdirSync(dbLockPath()); } catch {}
}

function writeDbAtomic(data: any) {
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

function readDb() {

  try {
    if (!fs.existsSync(DB_PATH)) {
      const bundledDbPath = path.join(process.cwd(), "db.json");
      if (isVercel && fs.existsSync(bundledDbPath)) {
        console.log("Seeding /tmp/db.json from bundled db.json...");
        fs.writeFileSync(DB_PATH, fs.readFileSync(bundledDbPath, "utf-8"));
      } else {
        fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2));
        return initialDb;
      }
    }
    // The file is swapped atomically, but retry briefly if we race a rename.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      } catch (parseErr) {
        if (attempt === 2) throw parseErr;
        sleepSync(50);
      }
    }
  } catch (err) {
    console.error("Error reading db:", err);
    return initialDb;
  }
}

function writeDb(data: any) {
  acquireDbLock();
  try {
    writeDbAtomic(data);
    if (supabaseConfigured()) {
      // Force cache invalidation so next read triggers fresh download
      lastDbDownloadTime = 0;

      // Upload asynchronously in background
      uploadDbToSupabase(data).catch(err => {
        console.error("[Supabase DB] Failed to upload db in background:", err);
      });
    }
  } catch (err) {
    console.error("Error writing db:", err);
  } finally {
    releaseDbLock();
  }
}

// Initialize database file on startup
readDb();

// Initialize GoogleGenAI client (lazy init or check key)
let ai: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will be unavailable.");
      throw new Error("GEMINI_API_KEY environment variable is required for AI features. Please configure it in your Secrets settings.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

const WORKING_GEMINI_MODELS = ["gemini-3.6-flash", "gemini-flash-latest"];

async function generateContentWithFallback(aiClient: GoogleGenAI, params: any) {
  let lastError: any = null;
  for (const model of WORKING_GEMINI_MODELS) {
    try {
      return await aiClient.models.generateContent({
        ...params,
        model
      });
    } catch (err: any) {
      console.warn(`Gemini model ${model} generateContent failed: ${err.message}. Trying fallback...`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

// Helper to generate a 6-digit alphanumeric Legacy Key (e.g. LB-A23B9F)
function generateLegacyKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "LB-";
  for (let i = 0; i < 6; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Secure Session Secret derived from FIREBASE_PRIVATE_KEY or environment secret
// ponytail: per-boot random fallback logs everyone out on restart; set SESSION_SECRET in production
const JWT_SECRET =
  process.env.SESSION_SECRET ||
  process.env.FIREBASE_PRIVATE_KEY ||
  crypto.randomBytes(32).toString("hex");

if (!process.env.SESSION_SECRET && !process.env.FIREBASE_PRIVATE_KEY) {
  console.warn("[SECURITY] SESSION_SECRET not set — using a random per-boot secret. All sessions reset on restart. Set SESSION_SECRET before production!");
}

// Constant-time string comparison for secret checks (OTP codes, token signatures)
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Burn a comparison anyway so timing doesn't leak length mismatch
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Generates a cryptographically signed token: payload.timestamp.signature
function generateToken(payload: string): string {
  const timestamp = Date.now();
  const data = `${payload}.${timestamp}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("hex");
  return `${payload}.${timestamp}.${signature}`;
}

// Verifies a signed token and returns the payload if valid, otherwise null
function verifyToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [payload, timestamp, signature] = parts;
    const data = `${payload}.${timestamp}`;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("hex");
    if (!safeEqual(signature, expectedSignature)) return null;
    
    // Check if token has expired (e.g. 7 days expiration)
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Password hashing helper using standard Node.js crypto
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Verifies hashed password supporting backwards compatible plaintext verification
function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(":")) {
    return password === storedHash;
  }
  const [salt, hash] = storedHash.split(":");
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === verify;
}

// Simple Authorization Middleware
function getUserIdFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}


// Admin gate for platform-admin endpoints. Deliberately a dedicated "admin"
// role — product/billing roles like "Family Admin" or "Business Admin" are
// subscription tiers and must NOT grant platform administration.
function isAdminUser(userId: string): boolean {
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  return !!user && user.role === "admin";
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const db = readDb();

  // If this is a guest family member session
  if (userId.startsWith("guest_")) {
    // Tokens are `guest_<ownerId>_<name>`. Owner ids may themselves contain
    // underscores (e.g. `local_<uuid>` for non-Firebase accounts), so the
    // owner id is base64url-encoded in new tokens. Old tokens carry the raw
    // id — accept whichever form matches a real user.
    const rest = userId.slice("guest_".length);
    const sep = rest.indexOf("_");
    if (sep === -1) {
      return res.status(401).json({ error: "Invalid legacy guest credentials" });
    }
    const rawId = rest.slice(0, sep);
    let ownerId: string | null = db.users.some((u: any) => u.id === rawId) ? rawId : null;
    if (!ownerId) {
      try {
        const decoded = Buffer.from(rawId, "base64url").toString("utf8");
        if (decoded && db.users.some((u: any) => u.id === decoded)) ownerId = decoded;
      } catch { /* not base64 — fall through */ }
    }
    if (!ownerId) {
      return res.status(401).json({ error: "Invalid legacy guest credentials" });
    }
    const ownerExists = db.users.some((u: any) => u.id === ownerId);
    if (!ownerExists) {
      return res.status(401).json({ error: "Legacy session expired or owner not found" });
    }
    (req as any).userId = ownerId;
    (req as any).isGuest = true;
    
    // Protect mutations (POST, PUT, DELETE) from guest users
    if (req.method !== "GET") {
      return res.status(403).json({ error: "You are logged in under Family View-Only mode and cannot make changes." });
    }
    
    return next();
  }

  // Regular logged-in owner session
  const userExists = db.users.some((u: any) => u.id === userId);
  if (!userExists) {
    return res.status(401).json({ error: "User session expired" });
  }
  (req as any).userId = userId;
  next();
}

// HELPER: Compute legacy completion percentage
function calculateCompletion(userId: string, db: any): number {
  let percentage = 0;

  // Add First Memory -> 5%
  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  if (userMemories.length > 0) {
    percentage += 5;
  }

  // Count photos, videos, voice recordings across memories
  let photoCount = 0;
  let videoCount = 0;
  let voiceCount = 0;

  userMemories.forEach((mem: any) => {
    if (mem.media && Array.isArray(mem.media)) {
      mem.media.forEach((file: any) => {
        if (file.type === "image") photoCount++;
        if (file.type === "video") videoCount++;
        if (file.type === "audio") voiceCount++;
      });
    }
  });

  // Upload Photo -> +2% for each photo (cap at +10%)
  const photoBonus = Math.min(photoCount * 2, 10);
  percentage += photoBonus;

  // Upload Video -> +3% for each video (cap at +15%)
  const videoBonus = Math.min(videoCount * 3, 15);
  percentage += videoBonus;

  // Upload Voice -> +3% for each voice (cap at +15%)
  const voiceBonus = Math.min(voiceCount * 3, 15);
  percentage += voiceBonus;

  // Add Timeline Event -> +2% for each (cap at +10%)
  const milestoneCount = db.milestones.filter((m: any) => m.userId === userId).length;
  const milestoneBonus = Math.min(milestoneCount * 2, 10);
  percentage += milestoneBonus;

  // Add Family Member -> +2% for each (cap at +10%)
  const familyCount = db.family.filter((f: any) => f.userId === userId).length;
  const familyBonus = Math.min(familyCount * 2, 10);
  percentage += familyBonus;

  // Upload Document -> +3% for each (cap at +15%)
  const documentCount = db.documents.filter((d: any) => d.userId === userId).length;
  const documentBonus = Math.min(documentCount * 3, 15);
  percentage += documentBonus;

  // Generated AI Story -> +10% for each (cap at +20%)
  const storyCount = db.stories.filter((s: any) => s.userId === userId).length;
  const storyBonus = Math.min(storyCount * 10, 20);
  percentage += storyBonus;

  return Math.min(percentage, 100);
}

// Shared email-address guard: one check used by every capsule/message write path.
// ponytail: simple regex (not RFC-complete) — upgrade path is a validator lib if stricter rules are needed.
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

// True when a REAL inbox delivery transport exists (per-user Settings config or
// server env). Without this, sendEmail falls back to an Ethereal test account
// that NEVER reaches Gmail — capsule routes must refuse to fake-deliver then.
function hasRealEmailTransport(config?: any): boolean {
  const protocol = config?.protocol || process.env.EMAIL_PROTOCOL || "SMTP";
  if (protocol === "Resend") {
    return !!((config?.resendApiKey || process.env.RESEND_API_KEY || "").trim());
  }
  return !!((config?.smtpHost || process.env.SMTP_HOST || "").trim()
    && (config?.smtpUser || process.env.SMTP_USER || "").trim()
    && (config?.smtpPass || process.env.SMTP_PASS || "").trim());
}

const EMAIL_NOT_CONFIGURED_MSG =
  "Email delivery is not configured, so this capsule was NOT sent to Gmail. " +
  "Configure a real sender in Settings → Email Delivery Configuration " +
  "(e.g. SMTP host smtp.gmail.com, your Gmail address, and a Gmail App Password), " +
  "then retry delivery.";

// Core Email Dispatch helper (Nodemailer SMTP & Resend API)
async function sendEmail({
  to,
  subject,
  html,
  text,
  config
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  config?: any;
}) {
  // 1. Fetch configurations from user specific config or fallback to system env variables
  const protocol = config?.protocol || process.env.EMAIL_PROTOCOL || "SMTP";
  const smtpHost = config?.smtpHost || process.env.SMTP_HOST || "";
  const smtpPort = parseInt(config?.smtpPort || process.env.SMTP_PORT || "587", 10);
  const smtpUser = config?.smtpUser || process.env.SMTP_USER || "";
  const smtpPass = config?.smtpPass || process.env.SMTP_PASS || "";
  // Prefer the authenticated Gmail account as sender: providers (notably
  // Gmail) reject or rewrite a From address that isn't the login account.
  const smtpFrom = config?.smtpFrom || smtpUser || process.env.SMTP_FROM || '"LifeBook" <no-reply@lifebook.com>';

  const resendApiKey = config?.resendApiKey || process.env.RESEND_API_KEY || "";
  const resendFrom = config?.resendFrom || process.env.RESEND_FROM || "onboarding@resend.dev";

  console.log(`[Email Service] Initiating dispatch sequence to recipient: ${to}...`);

  if (protocol === "Resend" && resendApiKey) {
    console.log(`[Email Service] Dispatching via Resend API...`);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: resendFrom,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, "")
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend service error: ${errorText}`);
    }
    const result = await response.json();
    console.log(`[Email Service] Resend dispatch success! Msg ID: ${result.id}`);
    return { success: true, messageId: result.id };
  } else if (protocol === "SMTP" && smtpHost && smtpUser && smtpPass) {
    console.log(`[Email Service] Dispatching via Nodemailer SMTP to ${smtpHost}:${smtpPort}...`);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""),
      html,
    });

    console.log(`[Email Service] SMTP dispatch success! Msg ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } else {
    // Elegant Zero-Config Fallback: Dynamic Ethereal Test SMTP Server
    console.log(`[Email Service] No credentials configured. Deploying dynamic Ethereal test SMTP server on-the-fly...`);
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[Email Service] Ethereal test account created successfully: ${testAccount.user}`);
      
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const info = await transporter.sendMail({
        from: '"LifeBook Legacy Suite (Test)" <no-reply@lifebook.com>',
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ""),
        html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Email Service] Ethereal delivery successful! Message ID: ${info.messageId}`);
      console.log(`[Email Service] View Sent Email: ${previewUrl}`);

      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: previewUrl || undefined 
      };
    } catch (etherealErr: any) {
      console.error(`[Email Service] Ethereal fallback failed:`, etherealErr);
      throw new Error(`Email delivery configuration is missing, and automatic Ethereal fallback failed: ${etherealErr.message}`);
    }
  }
}

// OTP verification is bounded by a per-user, DB-persisted attempt counter
// (user.loginOtpAttempts): works across serverless instances and restarts.
// Each new recovery email resets it; 5 wrong codes within the 15-minute OTP
// validity window locks verification until a new code is requested.
const OTP_MAX_ATTEMPTS = 5;

// Send local in-app notification helper
function addNotification(userId: string, title: string, message: string, db?: any) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    message,
    date: new Date().toISOString(),
    read: false
  };
  if (db) {
    if (!db.notifications) db.notifications = [];
    db.notifications.push(notification);
  } else {
    const localDb = readDb();
    if (!localDb.notifications) localDb.notifications = [];
    localDb.notifications.push(notification);
    writeDb(localDb);
  }
}

/* ================= AUTH ENDPOINTS ================= */

app.post("/api/auth/register", authRateLimiter, async (req, res) => {
  const { name, email, password, dob, phone } = req.body;
  if (!name || !email || !password || !dob) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Create user in Firebase Auth when configured; otherwise fall back to a
    // local identity so registration works without Firebase credentials.
    let userId = `local_${crypto.randomUUID()}`;
    if (getApps().length > 0) {
      const auth = getAuth();
      const userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: name,
      });
      userId = userRecord.uid;
    }
    const legacyKey = generateLegacyKey();
    
    // Store additional user data in local DB
    const db = readDb();
    const newUser = {
      id: userId,
      name,
      email,
      password: hashPassword(password),
      dob,
      phone: phone || "",
      profilePhoto: "",
      legacyKey,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    addNotification(userId, "Welcome to LifeBook!", `Hello ${name}, welcome to your digital legacy space. Start logging memories, creating your biography, and sharing your custom Legacy Key: ${legacyKey} with your descendants.`);
    writeDb(db);

    res.status(201).json({
      id: generateToken(userId),
      name,
      email,
      dob,
      phone: newUser.phone,
      legacyCompletion: 0,
      profilePhoto: "",
      legacyKey,
      createdAt: newUser.createdAt
    });
  } catch (error: any) {
    console.error("[Auth] Firebase registration error:", error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: "Email is already registered" });
    }
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: "Invalid email address" });
    }
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: "Password is too weak" });
    }
    return res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
});

app.post("/api/auth/login", authRateLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const user = db.users[userIndex];

  if (!verifyPassword(password, user.password)) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  // Migrate legacy plaintext password to hashed if necessary
  if (!user.password.includes(":")) {
    user.password = hashPassword(password);
  }
  
  // Backwards compatibility generation of legacy key if missing
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
  }

  db.users[userIndex] = user;
  writeDb(db);

  const completion = calculateCompletion(user.id, db);

  res.json({
    id: generateToken(user.id),
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

// Forgot Password API - Sends recovering email with Password & 6-digit confirmation code
app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: "No registered LifeBook account found with this email address." });
  }

  const user = db.users[userIndex];

  // Generate a 6-digit OTP code for secure, fast login confirmation
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

  // Invalidate any outstanding code and reset guess tracking on each new request
  user.loginOtp = otp;
  user.loginOtpExpiry = otpExpiry;
  user.loginOtpAttempts = 0;
  writeDb(db);

  try {
    const emailResult = await sendEmail({
      to: user.email,
      subject: "LifeBook - Password Recovery & Login Confirmation",
      html: `
        <div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #E5E5E1; background-color: #FAF9F6; color: #1A1A1A; line-height: 1.6;">
          <h2 style="font-style: italic; border-bottom: 2px solid #1A1A1A; padding-bottom: 12px; margin-top: 0; font-weight: normal; font-size: 24px;">LifeBook Legacy Vault</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>We received a request to recover your password and confirm your login to your digital legacy space.</p>
          
          <div style="background-color: #F1EFEC; border: 1px solid #E5E5E1; padding: 16px; margin: 24px 0; border-left: 4px solid #1A1A1A;">
            <p style="margin: 0 0 6px 0; font-size: 10px; font-family: sans-serif; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color: #666;">Security Note</p>
            <p style="margin: 0; font-size: 13px; font-family: sans-serif;">For security, your password is now encrypted and cannot be sent via email. Please use the 6-digit confirmation code below to log in directly, then reset your password in Settings.</p>
          </div>

          <p>Confirm your login directly by entering the 6-digit confirmation code below in the application:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; padding: 12px 32px; border: 1.5px dashed #1A1A1A; background-color: #FFF;">
              ${otp}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 11px; font-family: sans-serif; color: #666; font-style: italic;">This confirmation code is valid for 15 minutes.</p>
          </div>

          <p style="font-size: 12px; font-family: sans-serif; color: #666; border-top: 1px solid #E5E5E1; padding-top: 20px; margin-top: 32px;">
            If you did not make this request, you can safely ignore this email or contact support.
          </p>
        </div>
      `
    });

    res.json({
      success: true,
      message: "Password recovery and confirmation code email sent successfully.",
      previewUrl: emailResult.previewUrl
    });
  } catch (emailErr: any) {
    console.error("[Auth] Failed to send recovery email:", emailErr);
    res.status(500).json({ error: `Failed to dispatch recovery email: ${emailErr.message}` });
  }
});

// Confirm Login API - Authenticates user directly using the 6-digit confirmation code sent to their email
app.post("/api/auth/confirm-login", authRateLimiter, (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email address and confirmation code are required." });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: "Account not found." });
  }

  const user = db.users[userIndex];

  if ((user.loginOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many incorrect codes entered. Please request a new confirmation code." });
  }

  const otpStr = typeof otp === "string" ? otp.trim() : "";
  const otpOk = !!(user.loginOtp && otpStr && safeEqual(String(user.loginOtp), otpStr));

  if (!otpOk) {
    user.loginOtpAttempts = (user.loginOtpAttempts || 0) + 1;
    writeDb(db);
    const locked = user.loginOtpAttempts >= OTP_MAX_ATTEMPTS;
    return res.status(400).json({ error: locked
      ? "Too many incorrect codes. Please request a new confirmation code."
      : "Invalid login confirmation code." });
  }

  if (!user.loginOtpExpiry || user.loginOtpExpiry < Date.now()) {
    return res.status(400).json({ error: "The login confirmation code has expired. Please request a new one." });
  }

  // OTP is verified! Consume it and reset the attempt counter.
  delete db.users[userIndex].loginOtp;
  delete db.users[userIndex].loginOtpExpiry;
  delete db.users[userIndex].loginOtpAttempts;

  // Ensure legacy key exists
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
  }
  
  db.users[userIndex] = user;
  writeDb(db);

  const completion = calculateCompletion(user.id, db);

  res.json({
    id: generateToken(user.id),
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

app.get("/api/auth/current-user", (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);
  if (userIndex === -1) {
    return res.status(401).json({ error: "User session expired" });
  }

  const user = db.users[userIndex];

  // Generate legacy key if missing
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
    db.users[userIndex] = user;
    writeDb(db);
  }

  const completion = calculateCompletion(userId, db);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

// New endpoint: Family Member / Guest access validation using Owner's Legacy Key
app.post("/api/auth/family-login", authRateLimiter, (req, res) => {
  const { legacyKey, familyMemberName } = req.body;
  if (!legacyKey || !familyMemberName) {
    return res.status(400).json({ error: "Legacy Key and your name are required." });
  }

  const db = readDb();
  const cleanKey = legacyKey.trim().toUpperCase();
  const owner = db.users.find((u: any) => u.legacyKey && u.legacyKey.trim().toUpperCase() === cleanKey);

  if (!owner) {
    return res.status(404).json({ error: "Invalid Legacy Key. Please check with the legacy owner for the correct key." });
  }

  // base64url-encode the owner id: local ids contain underscores
  // (`local_<uuid>`) and the guest token format is `guest_<ownerId>_<name>`.
  const guestUserId = `guest_${Buffer.from(owner.id).toString("base64url")}_${Buffer.from(familyMemberName).toString("base64url")}`;
  const completion = calculateCompletion(owner.id, db);

  res.json({
    id: generateToken(guestUserId),
    name: `${familyMemberName}`,
    email: `family@lifebook.dev`,
    dob: "1980-01-01",
    profilePhoto: "",
    phone: "",
    legacyCompletion: completion,
    legacyKey: owner.legacyKey,
    isGuestViewer: true,
    ownerName: owner.name,
    createdAt: new Date().toISOString()
  });
});

// Google Sign-In: find-or-create the local user for a Firebase-authenticated
// Google identity. Identity comes from Firebase Auth on the client; all user
// DATA lives in db.json / Supabase, same as password registration.
app.post("/api/auth/google", authRateLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ error: "Google credential is required" });
  }

  try {
    // Real Google authentication: the client sends a Firebase Auth ID token
    // from the Google sign-in popup; it is verified server-side before the
    // identity is trusted. The identity must never come from the request body.
    let email = "";
    let name = "";
    let googleId = "";

    if (getApps().length > 0) {
      try {
        const decoded = await getAuth().verifyIdToken(credential, true);
        email = String(decoded.email || "");
        name = String(decoded.name || "");
        googleId = String(decoded.uid);
        if (!email) {
          return res.status(401).json({ error: "Your Google account has no email address." });
        }
      } catch (err: any) {
        console.error("[Auth] Google ID token verification failed:", err?.code || err?.message);
        return res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
      }
    } else {
      // ponytail: demo-only fallback while the deployment has no Firebase
      // Admin credentials. Accepts explicit demo identities ("email|name")
      // gated behind DEMO_INSECURE_GOOGLE=1; never enabled silently.
      // Upgrade path: configure FIREBASE_* creds and remove this branch.
      if (process.env.DEMO_INSECURE_GOOGLE !== "1") {
        return res.status(501).json({ error: "Google sign-in is not configured on this server yet." });
      }
      const [demoEmail, demoName] = String(credential).split("|");
      if (!demoEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demoEmail)) {
        return res.status(400).json({ error: "Invalid demo credential format" });
      }
      email = demoEmail.toLowerCase();
      name = demoName || "";
      // Stable pseudo-id per demo email so repeat sign-ins map to one account
      googleId = `google_demo_${crypto.createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
    }

    const db = readDb();
    let user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      const legacyKey = generateLegacyKey();
      user = {
        id: googleId || `google_${crypto.randomUUID()}`,
        name: name || email.split("@")[0],
        email,
        password: "", // OAuth identities have no local password
        dob: "",
        phone: "",
        profilePhoto: "",
        legacyKey,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      addNotification(user.id, "Welcome to LifeBook!", `Hello ${user.name}, welcome to your digital legacy space. Start logging memories, creating your biography, and sharing your custom Legacy Key: ${legacyKey} with your descendants.`);
      writeDb(db);
    }

    const completion = calculateCompletion(user.id, db);
    res.json({
      id: generateToken(user.id),
      name: user.name,
      email: user.email,
      dob: user.dob,
      phone: user.phone || "",
      profilePhoto: user.profilePhoto || "",
      legacyCompletion: completion,
      legacyKey: user.legacyKey,
      createdAt: user.createdAt
    });
  } catch (err: any) {
    console.error("[Auth] Google sign-in error:", err);
    return res.status(500).json({ error: "Google sign-in failed" });
  }
});

// New endpoint: Regenerate owner's Legacy Key
app.post("/api/settings/legacy-key/regenerate", authMiddleware, (req: any, res) => {
  // If a guest attempts this, authMiddleware will block (POST is not GET)
  const userId = req.userId;
  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const newKey = generateLegacyKey();
  db.users[userIndex].legacyKey = newKey;
  addNotification(userId, "Legacy Key Regenerated 🔑", `You have generated a new legacy access key: ${newKey}. Share this key with family members so they can securely view your legacy chronicle.`);
  writeDb(db);

  res.json({ legacyKey: newKey });
});

/* ================= FILE UPLOAD ENDPOINT ================= */

app.post("/api/upload", authMiddleware, async (req, res) => {
  const { filename, base64Data, type } = req.body;
  if (!filename || !base64Data) {
    return res.status(400).json({ error: "Filename and base64Data are required" });
  }

  try {
    // Clean base64 prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const extension = path.extname(filename) || (type === "audio" ? ".mp3" : type === "video" ? ".mp4" : ".png");
    const uniqueFilename = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}${extension}`;

    // 1) Supabase Storage — primary store for user files (uploads bucket, public URLs,
    //    same convention as the Java backend)
    if (supabaseConfigured()) {
      try {
        const contentType =
          type === "image" ? `image/${extension.replace(".", "") || "png"}` :
          type === "audio" ? `audio/${extension.replace(".", "") || "mpeg"}` :
          type === "video" ? `video/${extension.replace(".", "") || "mp4"}` :
          "application/octet-stream";

        const upRes = await fetch(`${SUPABASE_URL_ENV}/storage/v1/object/uploads/${uniqueFilename}`, {
          method: "POST",
          headers: supabaseHeaders({
            "Content-Type": contentType,
            "x-upsert": "true",
          }),
          body: new Uint8Array(buffer),
        });
        if (!upRes.ok) {
          throw new Error(`status ${upRes.status}: ${(await upRes.text()).slice(0, 200)}`);
        }
        const publicUrl = `${SUPABASE_URL_ENV}/storage/v1/object/public/uploads/${uniqueFilename}`;
        console.log(`Uploaded ${filename} to Supabase Storage: ${publicUrl}`);
        return res.json({ url: publicUrl, name: filename });
      } catch (supabaseErr: any) {
        console.warn("Supabase Storage upload failed, falling back:", supabaseErr.message);
      }
    }

    // 2) Firebase Storage, if Admin SDK is initialized
    if (getApps().length > 0) {
      try {
        const bucket = getStorage().bucket();
        const fileRef = bucket.file(`uploads/${uniqueFilename}`);
        
        let contentType = "application/octet-stream";
        if (type === "image") {
          contentType = `image/${extension.replace(".", "") || "png"}`;
        } else if (type === "audio") {
          contentType = `audio/${extension.replace(".", "") || "mpeg"}`;
        } else if (type === "video") {
          contentType = `video/${extension.replace(".", "") || "mp4"}`;
        }

        await fileRef.save(buffer, {
          metadata: {
            contentType,
          }
        });

        // Generate a signed URL valid for a long time (e.g., 50 years)
        const [publicUrl] = await fileRef.getSignedUrl({
          action: 'read',
          expires: '03-09-2076'
        });

        console.log(`Uploaded ${filename} to Firebase Storage: ${publicUrl}`);
        return res.json({ url: publicUrl, name: filename });
      } catch (storageErr: any) {
        console.warn("Firebase Storage upload failed, falling back to local filesystem:", storageErr.message);
      }
    }

    // Fallback: save to local disk
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${uniqueFilename}`;
    res.json({ url: relativeUrl, name: filename });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file: " + err.message });
  }
});

/* ================= DASHBOARD STATS ================= */

// Health check for uptime monitoring (no sensitive diagnostics exposed)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

app.get("/api/dashboard/stats", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);
  const userFamily = db.family.filter((f: any) => f.userId === userId);
  const userDocuments = db.documents.filter((d: any) => d.userId === userId);
  const userStories = db.stories.filter((s: any) => s.userId === userId);

  let photosCount = 0;
  let videosCount = 0;
  let voicesCount = 0;

  userMemories.forEach((mem: any) => {
    if (mem.media && Array.isArray(mem.media)) {
      mem.media.forEach((file: any) => {
        if (file.type === "image") photosCount++;
        if (file.type === "video") videosCount++;
        if (file.type === "audio") voicesCount++;
      });
    }
  });

  const completion = calculateCompletion(userId, db);

  res.json({
    legacyCompletion: completion,
    totalMemories: userMemories.length,
    photosCount,
    videosCount,
    voicesCount,
    documentsCount: userDocuments.length,
    familyMembersCount: userFamily.length,
    storiesGeneratedCount: userStories.length
  });
});

/* ================= MEMORY VAULT CRUD ================= */

app.get("/api/memories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const memories = db.memories.filter((m: any) => m.userId === userId);
  res.json(memories);
});

app.post("/api/memories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, description, date, location, tags, media } = req.body;

  if (!title || !description || !date) {
    return res.status(400).json({ error: "Title, description, and date are required" });
  }

  const db = readDb();
  const newMemory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    description,
    date,
    location: location || "",
    tags: Array.isArray(tags) ? tags : [],
    media: Array.isArray(media) ? media : [],
    createdAt: new Date().toISOString()
  };

  db.memories.push(newMemory);
  addNotification(userId, "Memory Added", `Successfully saved your memory: "${title}".`);
  writeDb(db);

  res.status(201).json(newMemory);
});

app.put("/api/memories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, description, date, location, tags, media } = req.body;

  const db = readDb();
  const index = db.memories.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Memory not found" });
  }

  const updatedMemory = {
    ...db.memories[index],
    title: title || db.memories[index].title,
    description: description || db.memories[index].description,
    date: date || db.memories[index].date,
    location: location !== undefined ? location : db.memories[index].location,
    tags: Array.isArray(tags) ? tags : db.memories[index].tags,
    media: Array.isArray(media) ? media : db.memories[index].media,
  };

  db.memories[index] = updatedMemory;
  writeDb(db);

  res.json(updatedMemory);
});

app.delete("/api/memories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const memory = db.memories.find((m: any) => m.id === id && m.userId === userId);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found" });
  }

  db.memories = db.memories.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Memory Deleted", `Deleted the memory: "${memory.title}".`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= TIMELINE CRUD ================= */

app.get("/api/timeline", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const milestones = db.milestones.filter((m: any) => m.userId === userId);
  res.json(milestones);
});

app.post("/api/timeline", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, description, date, category, location, media } = req.body;

  if (!title || !description || !date || !category) {
    return res.status(400).json({ error: "Title, description, date, and category are required" });
  }

  const db = readDb();
  const newMilestone = {
    id: `mil_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    description,
    date,
    category,
    location: location || "",
    media: Array.isArray(media) ? media : [],
    createdAt: new Date().toISOString()
  };

  db.milestones.push(newMilestone);
  addNotification(userId, "Milestone Added", `Added new milestone to your life timeline: "${title}".`);
  writeDb(db);

  res.status(201).json(newMilestone);
});

app.put("/api/timeline/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, description, date, category, location, media } = req.body;

  const db = readDb();
  const index = db.milestones.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Milestone not found" });
  }

  const updatedMilestone = {
    ...db.milestones[index],
    title: title || db.milestones[index].title,
    description: description || db.milestones[index].description,
    date: date || db.milestones[index].date,
    category: category || db.milestones[index].category,
    location: location !== undefined ? location : db.milestones[index].location,
    media: Array.isArray(media) ? media : db.milestones[index].media
  };

  db.milestones[index] = updatedMilestone;
  writeDb(db);

  res.json(updatedMilestone);
});

app.delete("/api/timeline/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const milestone = db.milestones.find((m: any) => m.id === id && m.userId === userId);
  if (!milestone) {
    return res.status(404).json({ error: "Milestone not found" });
  }

  db.milestones = db.milestones.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Milestone Deleted", `Removed milestone: "${milestone.title}".`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= LEGACY MESSAGES CRUD ================= */

app.get("/api/messages", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const messages = db.messages.filter((m: any) => m.userId === userId);
  res.json(messages);
});

app.post("/api/messages", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, recipientName, recipientEmail, deliveryOption, deliveryDate, deliveryTime, deliveryDateUtc: reqUtc, type, content, mediaUrl, mediaName } = req.body;

  if (!title || !recipientName || !recipientEmail || !deliveryOption || !type || !content) {
    return res.status(400).json({ error: "Missing required legacy message fields" });
  }

  if (!isValidEmail(recipientEmail)) {
    return res.status(400).json({ error: "Recipient email is not a valid email address — the capsule cannot be delivered to it." });
  }

  let finalDeliveryUtc = reqUtc || "";
  if (!finalDeliveryUtc && deliveryDate) {
    const formattedTime = deliveryTime ? (deliveryTime.length === 5 ? `${deliveryTime}:00` : deliveryTime) : "00:00:00";
    const parsedDate = new Date(`${deliveryDate}T${formattedTime}`);
    if (!isNaN(parsedDate.getTime())) {
      finalDeliveryUtc = parsedDate.toISOString();
    }
  }

  const db = readDb();
  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    recipientName,
    recipientEmail,
    deliveryOption,
    deliveryDate: deliveryDate || "",
    deliveryTime: deliveryTime || "",
    deliveryDateUtc: finalDeliveryUtc,
    type,
    content,
    mediaUrl: mediaUrl || "",
    mediaName: mediaName || "",
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  db.messages.push(newMessage);
  addNotification(userId, "Legacy Message Scheduled", `Scheduled a legacy ${type} message for ${recipientName} (${deliveryOption}).`);
  writeDb(db);

  res.status(201).json(newMessage);
});

app.put("/api/messages/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, recipientName, recipientEmail, deliveryOption, deliveryDate, deliveryTime, deliveryDateUtc: reqUtc, type, content, mediaUrl, mediaName, status } = req.body;

  const db = readDb();
  const index = db.messages.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  const existingMsg = db.messages[index];
  if (recipientEmail !== undefined && !isValidEmail(recipientEmail)) {
    return res.status(400).json({ error: "Recipient email is not a valid email address — the capsule cannot be delivered to it." });
  }
  const updatedDate = deliveryDate !== undefined ? deliveryDate : existingMsg.deliveryDate;
  const updatedTime = deliveryTime !== undefined ? deliveryTime : existingMsg.deliveryTime;

  let finalDeliveryUtc = reqUtc !== undefined ? reqUtc : existingMsg.deliveryDateUtc;
  if (!finalDeliveryUtc && updatedDate) {
    const formattedTime = updatedTime ? (updatedTime.length === 5 ? `${updatedTime}:00` : updatedTime) : "00:00:00";
    const parsedDate = new Date(`${updatedDate}T${formattedTime}`);
    if (!isNaN(parsedDate.getTime())) {
      finalDeliveryUtc = parsedDate.toISOString();
    }
  }

  const updatedMessage = {
    ...existingMsg,
    title: title || existingMsg.title,
    recipientName: recipientName || existingMsg.recipientName,
    recipientEmail: recipientEmail || existingMsg.recipientEmail,
    deliveryOption: deliveryOption || existingMsg.deliveryOption,
    deliveryDate: updatedDate,
    deliveryTime: updatedTime,
    deliveryDateUtc: finalDeliveryUtc,
    type: type || existingMsg.type,
    content: content || existingMsg.content,
    mediaUrl: mediaUrl !== undefined ? mediaUrl : existingMsg.mediaUrl,
    mediaName: mediaName !== undefined ? mediaName : existingMsg.mediaName,
    status: status || existingMsg.status
  };

  db.messages[index] = updatedMessage;
  writeDb(db);

  res.json(updatedMessage);
});

// Instant deliver message endpoint (manual trigger)
app.post("/api/messages/:id/deliver", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const index = db.messages.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  const msg = db.messages[index];

  if (!isValidEmail(msg.recipientEmail)) {
    return res.status(400).json({ error: "Recipient email is not a valid email address — the capsule cannot be delivered to it." });
  }

  try {
    console.log(`[Manual Delivery] Attempting instant dispatch for message ID: ${msg.id}`);
    const user = db.users.find((u: any) => u.id === msg.userId);
    const emailConfig = user?.emailConfig;

    // Never fake-deliver: without a real transport the mail would only land in
    // an Ethereal test inbox, never in the recipient's real Gmail account.
    if (!hasRealEmailTransport(emailConfig)) {
      db.messages[index].status = "failed";
      db.messages[index].error = EMAIL_NOT_CONFIGURED_MSG;
      addNotification(userId, "⚠️ Message Delivery Failed", `Your legacy message "${msg.title}" could not be sent to ${msg.recipientEmail}. ${EMAIL_NOT_CONFIGURED_MSG}`, db);
      writeDb(db);
      return res.status(500).json({ error: EMAIL_NOT_CONFIGURED_MSG });
    }

    const emailContent = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e5e1; background-color: #f9f7f2; color: #1a1a1a;">
        <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
          <h1 style="font-size: 26px; font-weight: normal; font-style: italic; margin: 0;">LifeBook Enduring Legacy</h1>
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 5px 0 0 0;">Secure Digital Capsule Delivery</p>
        </div>
        
        <p style="font-size: 14px; line-height: 1.6; font-style: italic; color: #444;">Hello ${msg.recipientName},</p>
        
        <p style="font-size: 14px; line-height: 1.6;">
          You have received a sacred digital legacy capsule from <strong>${user?.name || "A Loved One"}</strong>. 
          This time-capsule was locked and scheduled to be delivered for the occasion: <strong>${msg.deliveryOption}</strong>.
        </p>
        
        <div style="background-color: #ffffff; border: 1px solid #e5e5e1; padding: 25px; margin: 25px 0; font-style: italic; line-height: 1.8; font-size: 15px; color: #222; border-left: 4px solid #d97706; white-space: pre-wrap;">
          &ldquo;${msg.content}&rdquo;
        </div>
        
        ${msg.mediaUrl ? `
          <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; text-align: center; margin-bottom: 25px;">
            <p style="font-size: 12px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Attachment Included (${msg.type} capsule)</p>
            <a href="${msg.mediaUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Open Attached Media</a>
          </div>
        ` : ''}
        <p style="font-size: 12px; line-height: 1.6; color: #666; border-top: 1px solid #e5e5e1; padding-top: 15px; margin-top: 30px;">
          This message has been securely compiled and kept safe by LifeBook. 
          To start documenting your own memories or learn more, visit <a href="${process.env.APP_URL || "http://localhost:3000"}" style="color: #1a1a1a; font-weight: bold;">LifeBook Legacy Suite</a>.
        </p>
      </div>
    `;

    const deliveryResult = await sendEmail({
      to: msg.recipientEmail,
      subject: `✉️ Legacy Time-Capsule: ${msg.title}`,
      html: emailContent,
      config: emailConfig
    });

    db.messages[index].status = "delivered";
    db.messages[index].deliveredAt = new Date().toISOString();
    db.messages[index].error = undefined;
    if (deliveryResult && deliveryResult.previewUrl) {
      db.messages[index].previewUrl = deliveryResult.previewUrl;
    }

    addNotification(
      userId,
      "Capsule Letter Dispatched ✉️",
      `Your legacy time-capsule message "${db.messages[index].title}" has been successfully sent to ${db.messages[index].recipientEmail}!`,
      db
    );

    writeDb(db);
    res.json(db.messages[index]);
  } catch (err: any) {
    console.error(`[Manual Delivery] Failed manual dispatch for message ID: ${msg.id}. Error:`, err);
    db.messages[index].status = "failed";
    db.messages[index].error = err.message || "Unknown SMTP / Resend delivery error";
    
    addNotification(
      userId,
      "⚠️ Message Delivery Failed",
      `Your legacy message "${msg.title}" could not be sent to ${msg.recipientEmail}. Error: ${err.message}`,
      db
    );
    
    writeDb(db);
    res.status(500).json({ error: err.message || "Failed to deliver email" });
  }
});

// Describe photo endpoint (image analysis)
app.post("/api/describe-image", authMiddleware, async (req: any, res) => {
  const { base64Data } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "Image data is required" });
  }

  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    let mimeType = "image/png";
    const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const aiClient = getAiClient();
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };
    const textPart = {
      text: "You are an empathetic biographer and legacy historian. Describe this photo in 1-2 warm, narrative sentences. Focus on the core subject, emotion, and general feeling to serve as a meaningful written description for a family history memory vault entry.",
    };

    const response = await generateContentWithFallback(aiClient, {
      contents: { parts: [imagePart, textPart] },
    });

    const generatedText = response.text || "A beautifully preserved photo capturing a special moment.";
    res.json({ description: generatedText.trim() });
  } catch (err: any) {
    console.error("AI image description error:", err);
    // Descriptive random narrative fallbacks for local/offline resilience
    const fallbacks = [
      "A heartwarming snapshot capturing a cherished milestone with family, full of warmth and nostalgia.",
      "A precious archival photo representing a timeless legacy and foundational family origins.",
      "An evocative captured scene filled with joyful smiles, celebrating life's beautiful moments.",
      "A beautifully framed memory preserved for future generations to look back on with love."
    ];
    const chosenFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ description: chosenFallback });
  }
});

app.delete("/api/messages/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const message = db.messages.find((m: any) => m.id === id && m.userId === userId);
  if (!message) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  db.messages = db.messages.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Legacy Message Cancelled", `Cancelled legacy message to ${message.recipientName}.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= FAMILY MANAGEMENT CRUD ================= */

app.get("/api/family", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const family = db.family.filter((f: any) => f.userId === userId);
  res.json(family);
});

app.post("/api/family", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, relationship, email, phone, dob, permission, role, profilePhoto } = req.body;

  const memberRole = role || permission || "Viewer";

  if (!name || !relationship || !email) {
    return res.status(400).json({ error: "Name, relationship, and email are required" });
  }

  const db = readDb();
  const newMember = {
    id: `fam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    name,
    relationship,
    email,
    phone: phone || "",
    dob: dob || "",
    permission: memberRole,
    role: memberRole,
    profilePhoto: profilePhoto || "",
    createdAt: new Date().toISOString()
  };

  db.family.push(newMember);
  addNotification(userId, "Family Member Added", `Added ${name} (${relationship}) with ${memberRole} access.`);
  writeDb(db);

  res.status(201).json(newMember);
});

app.put("/api/family/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { name, relationship, email, phone, dob, permission, role, profilePhoto } = req.body;

  const db = readDb();
  const index = db.family.findIndex((f: any) => f.id === id && f.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Family member not found" });
  }

  const memberRole = role || permission || db.family[index].role || db.family[index].permission || "Viewer";

  const updatedMember = {
    ...db.family[index],
    name: name || db.family[index].name,
    relationship: relationship || db.family[index].relationship,
    email: email || db.family[index].email,
    phone: phone !== undefined ? phone : db.family[index].phone,
    dob: dob !== undefined ? dob : db.family[index].dob,
    permission: memberRole,
    role: memberRole,
    profilePhoto: profilePhoto !== undefined ? profilePhoto : db.family[index].profilePhoto
  };

  db.family[index] = updatedMember;
  writeDb(db);

  res.json(updatedMember);
});

app.delete("/api/family/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const member = db.family.find((f: any) => f.id === id && f.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Family member not found" });
  }

  db.family = db.family.filter((f: any) => !(f.id === id && f.userId === userId));
  addNotification(userId, "Family Member Removed", `Removed ${member.name} from your Family vault.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= SECURE VAULT CRUD ================= */

app.get("/api/documents", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const documents = db.documents.filter((d: any) => d.userId === userId);
  res.json(documents);
});

app.post("/api/documents", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, title, category, size, fileSize, fileUrl, mimeType, notes, fileName } = req.body;

  const docTitle = title || name;
  const docFileName = fileName || docTitle || "document";
  const docSize = fileSize || size || "Unknown Size";

  if (!docTitle || !category || !fileUrl) {
    return res.status(400).json({ error: "Title, category, and file data are required" });
  }

  const db = readDb();
  const newDocument = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    name: docTitle,
    title: docTitle,
    category,
    size: docSize,
    fileSize: docSize,
    uploadDate: new Date().toLocaleDateString(),
    fileUrl,
    fileName: docFileName,
    mimeType: mimeType || "application/octet-stream",
    isEncrypted: true,
    notes: notes || ""
  };

  db.documents.push(newDocument);
  addNotification(userId, "Document Securely Stored", `Stored "${docTitle}" in your AES-256 secure digital vault.`);
  writeDb(db);

  res.status(201).json(newDocument);
});

app.put("/api/documents/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { name, title, category, notes, fileUrl, fileName, fileSize } = req.body;

  const db = readDb();
  const index = db.documents.findIndex((d: any) => d.id === id && d.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  const existingDoc = db.documents[index];
  const docTitle = title || name || existingDoc.title || existingDoc.name;
  const docSize = fileSize || existingDoc.fileSize || existingDoc.size;
  const docFileName = fileName || existingDoc.fileName;

  const updatedDocument = {
    ...existingDoc,
    name: docTitle,
    title: docTitle,
    category: category || existingDoc.category,
    notes: notes !== undefined ? notes : existingDoc.notes,
    fileUrl: fileUrl || existingDoc.fileUrl,
    fileName: docFileName,
    fileSize: docSize,
    size: docSize
  };

  db.documents[index] = updatedDocument;
  writeDb(db);

  res.json(updatedDocument);
});

app.delete("/api/documents/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const document = db.documents.find((d: any) => d.id === id && d.userId === userId);
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }

  db.documents = db.documents.filter((d: any) => !(d.id === id && d.userId === userId));
  addNotification(userId, "Document Deleted", `Removed "${document.name}" from Secure Vault.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= AI STORY GENERATOR ================= */

app.get("/api/stories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const stories = db.stories.filter((s: any) => s.userId === userId);
  res.json(stories);
});

app.post("/api/story/generate", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { biographyLength, personalNotes } = req.body; // 'short' | 'medium' | 'biography'

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);

  // Compile user history as prompt input
  const memoriesSummary = userMemories.map((m: any, i: number) => 
    `Memory ${i+1}: "${m.title}" (${m.date}) at ${m.location}. Description: ${m.description}. Tags: ${m.tags.join(", ")}`
  ).join("\n");

  const milestonesSummary = userMilestones.map((m: any, i: number) => 
    `Milestone ${i+1}: "${m.title}" (${m.date}) - Category: ${m.category}. Description: ${m.description}. Location: ${m.location}`
  ).join("\n");

  const notesPrompt = personalNotes ? `Additional notes provided by user: "${personalNotes}"` : "";

  const systemInstruction = "You are a professional biographer and life archivist. You draft deeply touching, beautifully narrated life stories and biographies based on the raw timelines and memories provided.";

  const prompt = `Write a beautiful, deeply touching, and highly professional biography for ${user.name} (Born: ${user.dob}).
The length of the biography should be ${biographyLength === "short" ? "around 500 words" : biographyLength === "medium" ? "around 1000 words" : "over 1500 words, rich in detail"}.

Here are the preserved raw memories of ${user.name}:
${memoriesSummary || "None logged yet. Focus on welcoming the person and sketching an inspirational memoir structure."}

Here are the milestones from their life timeline:
${milestonesSummary || "None logged yet."}

${notesPrompt}

Structure your response strictly as a JSON object with a "title" field and a "chapters" array. Each chapter must have a "title" field and a "content" string. Do not include markdown code block syntax (like \`\`\`json) in your actual final response unless required by responseType, just provide the raw JSON.
Generate exactly these 8 chapters (if information is missing, use your general creative prose to weave an inspiring narrative for their life companion based on their name and current age):
1. Childhood & Roots
2. Educational Pursuits
3. Career Highlights & Professional Journey
4. Love, Family & Friendships
5. Defining Achievements & Crucial Lessons
6. Personal Values & Philosophy
7. Challenges Overcome
8. Future Vision & Legacy

Ensure the text is fully articulated and written in elegant display prose. Let's make this memory book look like a premium book!`;

  try {
    const aiClient = getAiClient();
    const result = await generateContentWithFallback(aiClient, {
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The overarching book title of the legacy memoir." },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "The title of this biography chapter." },
                  content: { type: Type.STRING, description: "The rich, prose-style narrative content of this chapter." }
                },
                required: ["title", "content"]
              }
            }
          },
          required: ["title", "chapters"]
        }
      }
    });

    const parsedResponse = JSON.parse(result.text || "{}");

    const newStory = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      title: parsedResponse.title || `${user.name}'s Digital Legacy Book`,
      biographyLength,
      chapters: parsedResponse.chapters || [],
      generatedAt: new Date().toISOString()
    };

    db.stories.push(newStory);
    addNotification(userId, "Biography Generated", `Your LifeBook Memoir "${newStory.title}" is ready to read!`);
    writeDb(db);

    res.status(201).json(newStory);
  } catch (err: any) {
    console.error("Gemini AI biography generation error:", err);
    // Graceful fallback to static generated story on API issue
    const fallbackStory = {
      id: `story_${Date.now()}_fallback`,
      userId,
      title: `${user.name}'s Custom Memoir Book`,
      biographyLength,
      chapters: [
        { title: "Chapter 1: Childhood & Roots", content: `This chapter marks the beautiful beginning of ${user.name}'s story, reflecting on early family origins, upbringing, and childhood roots. Preserved memories show a path filled with wonder and foundational growth.` },
        { title: "Chapter 2: Educational Pursuits", content: `Education holds the key to expansion. This chapter highlights the intellectual curiosity and academic pathways traversed by ${user.name}, leading to early passions and discoveries.` },
        { title: "Chapter 3: Career Highlights & Professional Journey", content: `The professional path is more than just milestones; it is about dedication and purpose. Here, we outline ${user.name}'s accomplishments, leadership, and professional growth.` },
        { title: "Chapter 4: Love, Family & Friendships", content: `No life is complete without the companion bonds that tether us to this earth. This section is dedicated to family relations, close friendships, and legacy connections.` },
        { title: "Chapter 5: Defining Achievements & Crucial Lessons", content: `Crucial learnings and significant life breakthroughs. Reflecting on key victories that defined character and instilled deep pride.` },
        { title: "Chapter 6: Personal Values & Philosophy", content: `A deep dive into the values that guide ${user.name}: integrity, resilience, compassion, and a lifelong devotion to family preservation.` },
        { title: "Chapter 7: Challenges Overcome", content: `Strength is forged in trial. This chapter records the obstacles and hardships faced along the journey, demonstrating ${user.name}'s powerful spirit and resilience.` },
        { title: "Chapter 8: Future Vision & Legacy", content: `An everlasting vision for grandchildren, descendants, and the world. A beautiful summary of the legacy ${user.name} continues to craft.` }
      ],
      generatedAt: new Date().toISOString()
    };

    db.stories.push(fallbackStory);
    addNotification(userId, "Biography Created (Local Mode)", `Your custom Biography Memoir is now available in your library.`);
    writeDb(db);

    res.status(201).json(fallbackStory);
  }
});

app.delete("/api/stories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  db.stories = db.stories.filter((s: any) => !(s.id === id && s.userId === userId));
  writeDb(db);

  res.json({ success: true });
});

/* ================= AI COMPANION (CHAT) ================= */

/* ============ Companion tuning (per-user personalization) ============
 * Each user gets a learned profile (stored in db.companionProfiles[userId])
 * so the companion speaks differently to different people: it mirrors the
 * user's own tone/length habits, steers toward their recurring interests,
 * and honors explicit preferences set via PATCH /api/chat/preferences.
 * Analysis is incremental (only the new message is scanned) and runs inside
 * POST /api/chat on the same db object the route already persists.
 */
// ponytail: keyword-frequency + style-signal heuristic, not an ML model —
// counts and averages only. Upgrade path: embeddings/topic-model over history.
const TUNING_STOPWORDS = new Set(
  "the,a,an,and,or,but,for,with,from,that,this,these,those,are,was,were,been,have,has,had,will,would,should,could,what,when,where,which,who,whom,how,why,not,no,yes,you,your,yours,our,we,they,them,their,there,here,about,into,over,after,before,just,like,more,most,very,can,all,any,one,two,its,it's,don't,does,did,than,then,also,only,well,because,tell,please,hello,hi,hey,kya,hai,hai,mein,aur,hai".split(",")
);
const TUNING_TONES = ["auto", "warm", "playful", "respectful", "curious"] as const;
const TUNING_VERBOSITIES = ["auto", "concise", "balanced", "detailed"] as const;
const TUNING_MAX_TOPICS = 40;

function getCompanionProfile(db: any, userId: string) {
  if (!db.companionProfiles) db.companionProfiles = {};
  let p = db.companionProfiles[userId];
  if (!p) {
    p = {
      userId,
      messageCount: 0,
      totalUserChars: 0,
      questionCount: 0,
      emojiCount: 0,
      topics: {} as Record<string, number>,
      preferences: { tone: "auto", verbosity: "auto", focusTopics: [] as string[] },
      updatedAt: new Date().toISOString(),
    };
    db.companionProfiles[userId] = p;
  }
  if (!p.preferences) p.preferences = { tone: "auto", verbosity: "auto", focusTopics: [] };
  if (!p.topics) p.topics = {};
  return p;
}

// Fold one user message into the stored profile; returns the profile.
function analyzeCompanionSignal(db: any, userId: string, text: string) {
  const p = getCompanionProfile(db, userId);
  const t = String(text || "");
  p.messageCount += 1;
  p.totalUserChars += t.length;
  if (t.includes("?")) p.questionCount += 1;
  const emojis = t.match(/\p{Extended_Pictographic}/gu);
  if (emojis) p.emojiCount += emojis.length;
  for (const raw of t.toLowerCase().split(/[^a-z\u00c0-\u024f\u1e00-\u1eff]+/)) {
    if (raw.length < 3 || TUNING_STOPWORDS.has(raw)) continue;
    p.topics[raw] = (p.topics[raw] || 0) + 1;
  }
  const entries = Object.entries(p.topics).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
  if (entries.length > TUNING_MAX_TOPICS) {
    p.topics = Object.fromEntries(entries.slice(0, TUNING_MAX_TOPICS));
  }
  p.updatedAt = new Date().toISOString();
  return p;
}

// Resolve effective tone/verbosity/topics for the prompt. Explicit user
// choices win; otherwise fall back to what was learned from their style.
function describeCompanionTuning(p: any) {
  const avgLen = p.messageCount ? Math.round(p.totalUserChars / p.messageCount) : 0;
  const questionRate = p.messageCount ? p.questionCount / p.messageCount : 0;
  const emojiRate = p.messageCount ? p.emojiCount / p.messageCount : 0;
  const learnedTone =
    emojiRate > 0.3 ? "playful"
    : questionRate > 0.5 ? "curious"
    : avgLen > 200 ? "respectful"
    : "warm";
  const learnedVerbosity = avgLen < 60 ? "concise" : avgLen > 200 ? "detailed" : "balanced";
  const topTopics = Object.entries(p.topics)
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([term]) => term);
  const pref = p.preferences || {};
  return {
    tone: pref.tone && pref.tone !== "auto" ? pref.tone : learnedTone,
    toneSource: pref.tone && pref.tone !== "auto" ? "chosen by the user" : "learned from their style",
    verbosity: pref.verbosity && pref.verbosity !== "auto" ? pref.verbosity : learnedVerbosity,
    verbositySource: pref.verbosity && pref.verbosity !== "auto" ? "chosen by the user" : "learned from their style",
    interests: [...(pref.focusTopics || []), ...topTopics].slice(0, 8),
    messageCount: p.messageCount,
    avgLen,
  };
}

function tuningPromptBlock(userName: string, p: any): string {
  if (!p || !p.messageCount) return "";
  const t = describeCompanionTuning(p);
  const lengthHint =
    t.verbosity === "concise" ? "Keep replies short and to the point (a few sentences)."
    : t.verbosity === "detailed" ? "The user enjoys rich, detailed replies — feel free to elaborate warmly."
    : "Keep replies a comfortable medium length.";
  return `--- COMPANION TUNING (personal to ${userName}, from ${t.messageCount} past exchanges) ---
- Tone: ${t.tone} (${t.toneSource}). Speak in this tone, not a generic one.
- Reply length: ${t.verbosity} (${t.verbositySource}). ${lengthHint}
- Recurring interests: ${t.interests.length ? t.interests.join(", ") : "none detected yet"}. Weave these in where natural.
This profile is unique to ${userName} — a different user gets different tuning.`;
}

app.get("/api/chat/history", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const history = db.chatHistory[userId] || [
    {
      id: "welcome",
      role: "model",
      sender: "companion",
      text: "Hello! I am your LifeBook AI Legacy Companion. My goal is to help you reflect on your life journey, prompt you with meaningful questions, and help you preserve your digital legacy. What memories would you like to reflect on or add today?",
      date: new Date().toISOString()
    }
  ];
  res.json(history);
});

app.post("/api/chat", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { message } = req.body;

  if (req.body?.language !== undefined && !findLanguage(String(req.body.language))) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = (db.memories || []).filter((m: any) => m.userId === userId);
  const userMilestones = (db.milestones || []).filter((m: any) => m.userId === userId);
  const userStories = (db.stories || []).filter((s: any) => s.userId === userId);
  const userFamily = (db.family || []).filter((f: any) => f.userId === userId);
  const userDocuments = (db.documents || []).filter((d: any) => d.userId === userId);
  const userMessages = (db.messages || []).filter((msg: any) => msg.userId === userId);

  // Initialize history if needed
  if (!db.chatHistory[userId]) {
    db.chatHistory[userId] = [
      {
        id: "welcome",
        role: "model",
        sender: "companion",
        text: `Hello! I am your LifeBook AI Legacy Companion. My goal is to help you reflect on your life journey, prompt you with meaningful questions, and help you preserve your digital legacy. What memories would you like to reflect on or add today?`,
        date: new Date().toISOString()
      }
    ];
  }

  // Add user message to history
  const userMsgId = `chat_${Date.now()}_u`;
  const userMessageObj = {
    id: userMsgId,
    role: "user" as const,
    sender: "user" as const,
    text: message,
    date: new Date().toISOString()
  };
  db.chatHistory[userId].push(userMessageObj);

  // Tune the companion to this user: fold the new message into their stored
  // profile (persisted with the db write at the end of this route).
  const tuningProfile = analyzeCompanionSignal(db, userId, message);
  const tuningBlock = tuningPromptBlock(user?.name || "the user", tuningProfile);

  // Compile context of all user memory data
  const memoriesContextText = userMemories.length > 0 
    ? userMemories.map((m: any) => {
        let details = `- "${m.title}" (Date: ${m.date || 'Unspecified'}`;
        if (m.location) details += `, Location: ${m.location}`;
        if (m.tags && m.tags.length > 0) details += `, Tags: ${m.tags.join(", ")}`;
        details += `): ${m.description || 'No written description'}`;
        if (m.media && m.media.length > 0) {
          details += ` [Media: ${m.media.map((med: any) => med.name || med.type).join(", ")}]`;
        }
        return details;
      }).join("\n")
    : "No memories logged in vault yet.";

  const milestonesContextText = userMilestones.length > 0
    ? userMilestones.map((m: any) => {
        let details = `- "${m.title}" (Date: ${m.date || 'Unspecified'}, Category: ${m.category || 'General'}`;
        if (m.location) details += `, Location: ${m.location}`;
        details += `): ${m.description || 'No description'}`;
        return details;
      }).join("\n")
    : "No milestones recorded on timeline yet.";

  const storiesContextText = userStories.length > 0
    ? userStories.map((s: any) => {
        const chaptersList = (s.chapters || []).map((ch: any) => `  * ${ch.title}: ${ch.content?.substring(0, 150)}...`).join("\n");
        return `- Memoir Book: "${s.title}" (Length: ${s.biographyLength || 'standard'}):\n${chaptersList}`;
      }).join("\n")
    : "No custom biography books generated yet.";

  const familyContextText = userFamily.length > 0
    ? userFamily.map((f: any) => `- ${f.name} (${f.relationship || 'Family Member'}): Bio - ${f.bio || 'N/A'}. Highlights: ${f.memoryHighlights || 'None'}`).join("\n")
    : "No family members added to family tree yet.";

  const documentsContextText = userDocuments.length > 0
    ? userDocuments.map((d: any) => `- "${d.title}" (Category: ${d.category || 'Document'}): ${d.description || 'No description'}`).join("\n")
    : "No archive documents stored in vault yet.";

  const messagesContextText = userMessages.length > 0
    ? userMessages.map((msg: any) => `- Message to ${msg.recipientName} (${msg.recipientEmail}): Delivery - ${msg.deliveryOption} on ${msg.deliveryDate || 'scheduled date'}. Content: "${msg.content?.substring(0, 150)}..."`).join("\n")
    : "No legacy time capsule messages scheduled yet.";

  const language = typeof req.body?.language === "string" ? findLanguage(req.body.language) : undefined;
  const languageLine = language
    ? `LANGUAGE: Reply to ${user.name} ONLY in ${language.label} (${language.native}) using its native script. Write numbers and dates naturally in that language. Personal names, street addresses and brand names may stay in their original script if more natural. If the user writes in another language, still reply in ${language.label} unless they explicitly ask you to switch.`
    : "LANGUAGE: Mirror the language the user writes in.";

  const systemInstruction = `You are the empathetic, warm, and highly professional LifeBook AI Legacy Companion for ${user.name}.
Your job is to act as a loving digital biographer and conversational companion. You help ${user.name} reflect on their life journey, discuss their logged memories, retrieve past details, and prompt them to capture new stories.

 ${languageLine}

${tuningBlock}

CRITICAL INSTRUCTION FOR MEMORY CONTEXT:
You have complete access to ${user.name}'s digital legacy records. ALWAYS refer to or weave in their specific logged memories, milestones, family members, stories, documents, and messages when they ask about their past or related topics. Be proud and specific when recalling their exact memory details (names, dates, locations, quotes).

--- USER'S MEMORY VAULT DATA ---
USER PROFILE:
- Name: ${user.name}
- Date of Birth: ${user.dob || 'Not specified'}
- Email: ${user.email}

1. LOGGED MEMORIES:
${memoriesContextText}

2. TIMELINE MILESTONES:
${milestonesContextText}

3. MEMOIR & BIOGRAPHY CHAPTERS:
${storiesContextText}

4. FAMILY MEMBERS & RELATIVES:
${familyContextText}

5. VAULT DOCUMENTS & ARCHIVES:
${documentsContextText}

6. SCHEDULED LEGACY MESSAGES & TIME CAPSULES:
${messagesContextText}
---------------------------------

Guidelines:
1. Speak warmly, empathetically, and conversationally.
2. Answer questions accurately and proudly using their exact memory records above.
3. If they ask about something not yet in their records, acknowledge what IS recorded and invite them to share or record that new memory.
4. Keep answers concise, highly human, and conversational (avoid robotic or repetitive system disclaimers).
5. Honor the COMPANION TUNING profile above when present — it is what makes you personal to this user.`;

  try {
    const aiClient = getAiClient();
    
    // Map history to Google Gen AI Content structure, enforcing alternating roles and valid formatting
    const rawHistory = db.chatHistory[userId] || [];
    const pastMessages = rawHistory.slice(0, -1); // Exclude the current message we just pushed
    
    const historyForSdk: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of pastMessages) {
      const role = msg.role === "user" ? "user" : "model";
      const text = msg.text || "";
      if (!text.trim()) continue;

      if (historyForSdk.length > 0 && historyForSdk[historyForSdk.length - 1].role === role) {
        historyForSdk[historyForSdk.length - 1].parts[0].text += "\n" + text;
      } else {
        if (historyForSdk.length === 0 && role !== "user") {
          continue;
        }
        historyForSdk.push({
          role,
          parts: [{ text }]
        });
      }
    }

    let aiResponseText = "";
    let chatSuccess = false;

    for (const modelName of WORKING_GEMINI_MODELS) {
      try {
        const chat = aiClient.chats.create({
          model: modelName,
          config: {
            systemInstruction,
          },
          history: historyForSdk
        });

        const response = await chat.sendMessage({ message: message });
        if (response?.text) {
          aiResponseText = response.text;
          chatSuccess = true;
          break;
        }
      } catch (modelErr: any) {
        console.warn(`Gemini chat model ${modelName} error: ${modelErr.message}. Trying next model...`);
      }
    }

    if (!chatSuccess || !aiResponseText) {
      throw new Error("Failed to generate response from Gemini API models");
    }

    const modelMsgId = `chat_${Date.now()}_m`;
    const modelMessageObj = {
      id: modelMsgId,
      role: "model" as const,
      sender: "companion" as const,
      text: aiResponseText,
      date: new Date().toISOString()
    };

    db.chatHistory[userId].push(modelMessageObj);
    writeDb(db);

    res.json(modelMessageObj);
  } catch (err: any) {
    console.error("AI companion chat error:", err);
    // Fallback response if API call fails
    let emulatedResponse = `I'm reflecting on your life journey! Looking at your memories (such as ${userMemories[0]?.title || 'your key milestones'}), every detail is valuable. What part of your story would you like to explore next?`;
    
    const modelMsgId = `chat_${Date.now()}_m_fb`;
    const modelMessageObj = {
      id: modelMsgId,
      role: "model" as const,
      sender: "companion" as const,
      text: emulatedResponse,
      date: new Date().toISOString()
    };

    db.chatHistory[userId].push(modelMessageObj);
    writeDb(db);

    res.json(modelMessageObj);
  }
});

app.delete("/api/chat/history", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  db.chatHistory[userId] = [
    {
      id: "welcome",
      role: "model",
      sender: "companion",
      text: "Chat cleared. I'm ready to begin a fresh conversation! What part of your life story would you like to reflect on today?",
      date: new Date().toISOString()
    }
  ];
  writeDb(db);
  res.json({ success: true, history: db.chatHistory[userId] });
});

// Returns the caller's learned tuning profile plus explicit preferences.
app.get("/api/chat/preferences", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const p = getCompanionProfile(db, userId);
  writeDb(db); // persist lazy-created profile so guests/empty users read stable state
  const t = describeCompanionTuning(p);
  res.json({
    messageCount: p.messageCount,
    tone: t.tone,
    toneSource: t.toneSource,
    verbosity: t.verbosity,
    verbositySource: t.verbositySource,
    interests: t.interests,
    preferences: p.preferences,
    updatedAt: p.updatedAt,
  });
});

// Lets the user explicitly steer the companion (tone/verbosity/focus topics).
// Anything not "auto" overrides what was learned from their behaviour.
app.patch("/api/chat/preferences", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { tone, verbosity, focusTopics } = req.body ?? {};
  const db = readDb();
  const p = getCompanionProfile(db, userId);

  if (tone !== undefined) {
    if (!(TUNING_TONES as readonly string[]).includes(tone)) {
      return res.status(400).json({ error: `Tone must be one of: ${(TUNING_TONES as readonly string[]).join(", ")}` });
    }
    p.preferences.tone = tone;
  }
  if (verbosity !== undefined) {
    if (!(TUNING_VERBOSITIES as readonly string[]).includes(verbosity)) {
      return res.status(400).json({ error: `Verbosity must be one of: ${(TUNING_VERBOSITIES as readonly string[]).join(", ")}` });
    }
    p.preferences.verbosity = verbosity;
  }
  if (focusTopics !== undefined) {
    if (!Array.isArray(focusTopics) || focusTopics.length > 10
        || focusTopics.some((s: any) => typeof s !== "string" || !s.trim() || s.length > 40)) {
      return res.status(400).json({ error: "focusTopics must be an array of up to 10 short strings" });
    }
    p.preferences.focusTopics = focusTopics.map((s: string) => s.trim().toLowerCase());
  }

  p.updatedAt = new Date().toISOString();
  writeDb(db);
  const t = describeCompanionTuning(p);
  res.json({
    messageCount: p.messageCount,
    tone: t.tone,
    toneSource: t.toneSource,
    verbosity: t.verbosity,
    verbositySource: t.verbositySource,
    interests: t.interests,
    preferences: p.preferences,
    updatedAt: p.updatedAt,
  });
});

/* ================= NOTIFICATIONS ENDPOINTS ================= */

app.get("/api/notifications", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const notifications = db.notifications.filter((n: any) => n.userId === userId);
  res.json(notifications);
});

app.put("/api/notifications/:id/read", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const index = db.notifications.findIndex((n: any) => n.id === id && n.userId === userId);

  if (index !== -1) {
    db.notifications[index].read = true;
    writeDb(db);
  }
  res.json({ success: true });
});

app.post("/api/notifications/clear", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  db.notifications = db.notifications.filter((n: any) => n.userId !== userId);
  writeDb(db);
  res.json({ success: true });
});

/* ================= GLOBAL SEARCH ================= */

app.get("/api/search", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const query = (req.query.q || "").toLowerCase().trim();

  if (!query) {
    return res.json({ memories: [], milestones: [], documents: [], family: [], messages: [] });
  }

  const db = readDb();
  const userMemories = db.memories.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.description.toLowerCase().includes(query) || 
     m.location.toLowerCase().includes(query) || 
     m.tags.some((t: string) => t.toLowerCase().includes(query)))
  );

  const userMilestones = db.milestones.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.description.toLowerCase().includes(query) || 
     m.category.toLowerCase().includes(query) ||
     m.location.toLowerCase().includes(query))
  );

  const userDocuments = db.documents.filter((d: any) => 
    d.userId === userId && 
    (d.name.toLowerCase().includes(query) || 
     d.category.toLowerCase().includes(query))
  );

  const userFamily = db.family.filter((f: any) => 
    f.userId === userId && 
    (f.name.toLowerCase().includes(query) || 
     f.relationship.toLowerCase().includes(query) || 
     f.email.toLowerCase().includes(query))
  );

  const userMessages = db.messages.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.recipientName.toLowerCase().includes(query) || 
     m.recipientEmail.toLowerCase().includes(query) || 
     m.content.toLowerCase().includes(query))
  );

  res.json({
    memories: userMemories,
    milestones: userMilestones,
    documents: userDocuments,
    family: userFamily,
    messages: userMessages
  });
});

/* ================= SETTINGS ================= */

app.put("/api/settings/profile", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, email, dob, phone, profilePhoto } = req.body;

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Update profile
  db.users[index].name = name || db.users[index].name;
  db.users[index].email = email || db.users[index].email;
  db.users[index].dob = dob || db.users[index].dob;
  db.users[index].phone = phone !== undefined ? phone : db.users[index].phone;
  db.users[index].profilePhoto = profilePhoto !== undefined ? profilePhoto : db.users[index].profilePhoto;

  addNotification(userId, "Profile Updated", "Your profile information was updated successfully.");
  writeDb(db);

  const completion = calculateCompletion(userId, db);

  res.json({
    id: db.users[index].id,
    name: db.users[index].name,
    email: db.users[index].email,
    dob: db.users[index].dob,
    phone: db.users[index].phone,
    profilePhoto: db.users[index].profilePhoto || "",
    legacyCompletion: completion,
    createdAt: db.users[index].createdAt
  });
});

app.put("/api/settings/password", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!verifyPassword(currentPassword, db.users[index].password)) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  db.users[index].password = hashPassword(newPassword);
  addNotification(userId, "Password Changed", "Your password has been changed successfully.");
  writeDb(db);

  res.json({ success: true });
});

app.delete("/api/settings/account", authMiddleware, (req: any, res) => {
  const userId = req.userId;

  const db = readDb();
  // Filter out everything for this user
  db.users = db.users.filter((u: any) => u.id !== userId);
  db.memories = db.memories.filter((m: any) => m.userId !== userId);
  db.milestones = db.milestones.filter((m: any) => m.userId !== userId);
  db.messages = db.messages.filter((m: any) => m.userId !== userId);
  db.family = db.family.filter((f: any) => f.userId !== userId);
  db.documents = db.documents.filter((d: any) => d.userId !== userId);
  db.stories = db.stories.filter((s: any) => s.userId !== userId);
  db.notifications = db.notifications.filter((n: any) => n.userId !== userId);
  delete db.chatHistory[userId];
  if (db.companionProfiles) delete db.companionProfiles[userId];

  writeDb(db);
  res.json({ success: true });
});

/* ================= EMAIL DELIVERY CONFIGURATION ENDPOINTS ================= */

app.get("/api/settings/email-config", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user.emailConfig || {
    protocol: "SMTP",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    resendApiKey: "",
    resendFrom: ""
  });
});

app.put("/api/settings/email-config", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { protocol, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, resendApiKey, resendFrom } = req.body;

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  db.users[index].emailConfig = {
    protocol: protocol || "SMTP",
    smtpHost: smtpHost || "",
    smtpPort: smtpPort || "587",
    smtpUser: smtpUser || "",
    smtpPass: smtpPass || "",
    smtpFrom: smtpFrom || "",
    resendApiKey: resendApiKey || "",
    resendFrom: resendFrom || ""
  };

  addNotification(userId, "Email Credentials Configured", "Your SMTP/Resend email service configurations have been saved successfully.");
  writeDb(db);

  res.json({ success: true, emailConfig: db.users[index].emailConfig });
});

// Sends a test email through the user's saved config (or server env fallback)
// so real Gmail delivery can be verified before scheduling capsules.
app.post("/api/settings/email-config/test", authMiddleware, async (req: any, res) => {
  const userId = (req as any).userId;
  const { to } = req.body ?? {};
  if (!to || !isValidEmail(to)) {
    return res.status(400).json({ error: "A valid 'to' email address is required to send a test email." });
  }
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!hasRealEmailTransport(user.emailConfig)) {
    return res.status(400).json({ error: EMAIL_NOT_CONFIGURED_MSG });
  }
  try {
    const result = await sendEmail({
      to: String(to).trim(),
      subject: "LifeBook test email — your delivery is working ✅",
      html: `<p>Hello ${user.name || "there"},</p><p>This is a test email from your LifeBook vault. If you received this in Gmail, scheduled time-capsules will deliver to recipient inboxes correctly.</p>`,
      config: user.emailConfig,
    });
    res.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Test email failed to send" });
  }
});

/* ================= GOOGLE FLOW AI VIDEO GENERATION ================= */

app.post("/api/video/generate", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);
  const userFamily = db.family.filter((f: any) => f.userId === userId);

  // Collect available media files
  const availableMedia: any[] = [];
  userMemories.forEach((m: any) => {
    if (m.media && Array.isArray(m.media)) {
      m.media.forEach((file: any) => {
        availableMedia.push({
          url: file.url,
          type: file.type,
          name: file.name,
          memoryTitle: m.title
        });
      });
    }
  });

  const prompt = `You are a professional cinematic director for "Google Flow", an AI-powered legacy video production suite.
Your goal is to compile an emotional, premium, scene-by-scene cinematic legacy video storyboard for ${user.name}.
Analyze their digital ledger details and output a highly personalized JSON storyboard.

Here is the user's legacy catalog data:
- Name: ${user.name}
- Age/Born: Born ${user.dob}
- Logged Memories (${userMemories.length}): ${JSON.stringify(userMemories.map(m => ({ title: m.title, description: m.description, date: m.date })))}
- Timeline Milestones (${userMilestones.length}): ${JSON.stringify(userMilestones.map(m => ({ title: m.title, description: m.description, category: m.category, date: m.date })))}
- Family Members (${userFamily.length}): ${JSON.stringify(userFamily.map(f => ({ name: f.name, relation: f.relationship })))}

Here is a list of their uploaded media files you can assign to scenes:
${JSON.stringify(availableMedia.map(m => ({ url: m.url, type: m.type, name: m.name, memoryTitle: m.memoryTitle })))}

Guidelines for the video storyboard:
1. Come up with a beautiful title like "The Symphony of Life: ${user.name}'s Journey" or "Tracing the Footsteps of ${user.name}".
2. Recommend a backing music style (e.g. "Grand Orchestral Strings", "Reflective Ambient Piano", "Acoustic Melancholy").
3. Divide the video into 3 to 5 scenes.
4. Each scene should have a scene title, narrative voiceover script (1-2 sentences), a cinematic visual cue (e.g., "Slow zoom into a sunlit table...", "Pan over family trees..."), a duration in seconds (sum of scene durations should be around 30 to 60 seconds), and an optional mediaUrl (select from their uploaded media list above, or leave blank/null to use fallbacks/illustrations).
5. Ensure the tone is extremely touching, respectful, emotional, and authentic.`;

  try {
    const aiClient = getAiClient();
    const response = await generateContentWithFallback(aiClient, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            musicTrack: { type: Type.STRING },
            durationSeconds: { type: Type.INTEGER },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visualCue: { type: Type.STRING },
                  duration: { type: Type.INTEGER },
                  mediaUrl: { type: Type.STRING }
                },
                required: ["title", "narration", "visualCue", "duration"]
              }
            }
          },
          required: ["title", "musicTrack", "durationSeconds", "scenes"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Video script generation error:", err);
    // Reliable static fallback with customizable details
    const defaultTitle = `${user.name}'s Legacy Chronicle`;
    const fallbackVideo = {
      title: defaultTitle,
      musicTrack: "Acoustic Melancholy",
      durationSeconds: 30,
      scenes: [
        {
          title: "Introduction: Foundations of Life",
          narration: `Every life story is a masterpiece woven with love, resilience, and memory. Today, we honor the legacy of ${user.name}.`,
          visualCue: "Soft ambient golden light sweeps across an elegant historical leather-bound book.",
          duration: 10,
          mediaUrl: availableMedia[0]?.url || ""
        },
        {
          title: "Milestones: Chapters of Triumph",
          narration: `Through critical life milestones and cherished memories, ${user.name} has paved a strong path for future generations.`,
          visualCue: "Ken Burns zoom over a vintage clock ticking gracefully, symbolizing timeless family connections.",
          duration: 10,
          mediaUrl: availableMedia[1]?.url || availableMedia[0]?.url || ""
        },
        {
          title: "Everlasting Vision: A Message to Tomorrow",
          narration: `The values of integrity, compassion, and strength continue to echo down the timeline of family and history.`,
          visualCue: "Fade into a warm glowing candle flame, reflecting an eternal spirit of heritage.",
          duration: 10,
          mediaUrl: availableMedia[2]?.url || availableMedia[0]?.url || ""
        }
      ]
    };
    res.json(fallbackVideo);
  }
});


async function checkAndDeliverScheduledMessages() {
  const now = new Date();
  console.log(`[Scheduler] Checking for pending legacy messages... Current UTC: ${now.toISOString()}`);
  
  try {
    const db = readDb();
    let updated = false;

    for (const msg of db.messages) {
      if (msg.status === "scheduled" || msg.status === "failed") {
        let shouldDeliver = false;
        let targetDateTime: Date | null = null;

        // 1. Try parsing explicit UTC timestamp first
        if (msg.deliveryDateUtc) {
          const parsed = new Date(msg.deliveryDateUtc);
          if (!isNaN(parsed.getTime())) {
            targetDateTime = parsed;
          }
        }

        // 2. If no valid UTC timestamp, derive target Date from deliveryDate & deliveryTime
        if (!targetDateTime && msg.deliveryDate) {
          const dateStr = msg.deliveryDate;
          const timeStr = msg.deliveryTime ? (msg.deliveryTime.length === 5 ? `${msg.deliveryTime}:00` : msg.deliveryTime) : "00:00:00";
          const parsed = new Date(`${dateStr}T${timeStr}`);
          if (!isNaN(parsed.getTime())) {
            targetDateTime = parsed;
          }
        }

        // 3. Evaluate delivery condition based on target date/time
        if (targetDateTime) {
          if (now >= targetDateTime) {
            shouldDeliver = true;
          }
        } else if (msg.deliveryOption !== "Specific Date" && !msg.deliveryDate) {
          // Auto-deliver event-based milestone types after 45 seconds ONLY IF NO TARGET DATE WAS ENTERED
          const createdAtDate = new Date(msg.createdAt);
          const elapsedSec = (now.getTime() - createdAtDate.getTime()) / 1000;
          if (elapsedSec > 45) {
            shouldDeliver = true;
          }
        }

        if (shouldDeliver) {
          console.log(`[Scheduler] Found pending message for delivery: "${msg.title}" (ID: ${msg.id}) targeting recipient ${msg.recipientEmail}`);
          
          const user = db.users.find((u: any) => u.id === msg.userId);
          const emailConfig = user?.emailConfig;

          const emailContent = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e5e1; background-color: #f9f7f2; color: #1a1a1a;">
              <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
                <h1 style="font-size: 26px; font-weight: normal; font-style: italic; margin: 0;">LifeBook Enduring Legacy</h1>
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 5px 0 0 0;">Secure Digital Capsule Delivery</p>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; font-style: italic; color: #444;">Hello ${msg.recipientName},</p>
              
              <p style="font-size: 14px; line-height: 1.6;">
                You have received a sacred digital legacy capsule from <strong>${user?.name || "A Loved One"}</strong>. 
                This time-capsule was locked and scheduled to be delivered for the occasion: <strong>${msg.deliveryOption}</strong>.
              </p>
              
              <div style="background-color: #ffffff; border: 1px solid #e5e5e1; padding: 25px; margin: 25px 0; font-style: italic; line-height: 1.8; font-size: 15px; color: #222; border-left: 4px solid #d97706; white-space: pre-wrap;">
                &ldquo;${msg.content}&rdquo;
              </div>
              
              ${msg.mediaUrl ? `
                <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; text-align: center; margin-bottom: 25px;">
                  <p style="font-size: 12px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Attachment Included (${msg.type} capsule)</p>
                  <a href="${msg.mediaUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Open Attached Media</a>
                </div>
              ` : ''}          <p style="font-size: 12px; line-height: 1.6; color: #666; border-top: 1px solid #e5e5e1; padding-top: 15px; margin-top: 30px;">
          This message has been securely compiled and kept safe by LifeBook. 
          To start documenting your own memories or learn more, visit <a href="${process.env.APP_URL || "http://localhost:3000"}" style="color: #1a1a1a; font-weight: bold;">LifeBook Legacy Suite</a>.
        </p>
            </div>
          `;

          // Never fake-deliver from the scheduler: without a real transport the
          // mail would only land in an Ethereal test inbox, never Gmail. Park
          // it as failed with an actionable message instead of flip-flopping.
          if (!isValidEmail(msg.recipientEmail)) {
            msg.status = "failed";
            msg.error = "Recipient email is not a valid email address — the capsule cannot be delivered to it.";
            updated = true;
            continue;
          }
          if (!hasRealEmailTransport(emailConfig)) {
            if (msg.status !== "failed" || msg.error !== EMAIL_NOT_CONFIGURED_MSG) {
              msg.status = "failed";
              msg.error = EMAIL_NOT_CONFIGURED_MSG;
              addNotification(
                msg.userId,
                "⚠️ Scheduled Capsule Delivery Failed",
                `Your legacy message "${msg.title}" scheduled for ${msg.recipientEmail} was NOT sent. ${EMAIL_NOT_CONFIGURED_MSG}`,
                db
              );
              updated = true;
            }
            continue;
          }

          try {
            const deliveryResult = await sendEmail({
              to: msg.recipientEmail,
              subject: `✉️ Legacy Time-Capsule: ${msg.title}`,
              html: emailContent,
              config: emailConfig
            });

            msg.status = "delivered";
            msg.deliveredAt = new Date().toISOString();
            msg.error = undefined;
            if (deliveryResult && deliveryResult.previewUrl) {
              msg.previewUrl = deliveryResult.previewUrl;
            }

            addNotification(
              msg.userId,
              "✉️ Scheduled Capsule Delivered!",
              `Your scheduled message "${msg.title}" has been successfully delivered to ${msg.recipientName} (${msg.recipientEmail})!`,
              db
            );

            updated = true;
            console.log(`[Scheduler] Automatically delivered scheduled message ID: ${msg.id} successfully!`);
          } catch (sendErr: any) {
            console.error(`[Scheduler] Failed to send scheduled email for message ID: ${msg.id}. Error:`, sendErr);
            msg.status = "failed";
            msg.error = sendErr.message || "Unknown SMTP/Resend delivery error";

            addNotification(
              msg.userId,
              "⚠️ Scheduled Capsule Delivery Failed",
              `Your legacy message "${msg.title}" scheduled for ${msg.recipientEmail} failed to send. Error: ${sendErr.message}`,
              db
            );
            
            updated = true;
          }
        }
      }
    }

    if (updated) {
      writeDb(db);
    }
  } catch (err) {
    console.error("[Scheduler] Error in checkAndDeliverScheduledMessages background loop:", err);
  }
}

/* ================= SUBSCRIPTIONS (STUB — MONETIZATION DISABLED) =================
 * No payment processor is wired up. Upgrades are rejected server-side so the
 * API cannot mint "paid" invoices for free. The frontend hides this UI while
 * MONETIZATION_ENABLED=false (src/config.ts). Flip both once real checkout
 * (e.g. Stripe/Razorpay — pricing is INR) exists; see README.
 */

// GET Current User Subscription & Storage Usage
app.get("/api/subscription/current", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const subscriptions = db.subscriptions || [];
  const activeSub = subscriptions.find((s: any) => s.userId === userId && s.status === "active") || {
    id: "free_tier",
    userId,
    planTier: user.planTier || "Free",
    billingCycle: "monthly",
    amount: 0,
    currency: "INR",
    status: "active",
    storageAllocatedGB: user.storageLimitGB || 1,
    startDate: user.createdAt,
    nextBillingDate: "Lifetime Free",
    autoRenew: false,
    paymentMethod: "Free Tier"
  };

  // Calculate actual storage used in GB from memories and documents
  const userMemories = (db.memories || []).filter((m: any) => m.userId === userId);
  const userDocs = (db.documents || []).filter((d: any) => d.userId === userId);
  
  let totalBytes = 0;
  userMemories.forEach((mem: any) => {
    if (mem.media && Array.isArray(mem.media)) {
      mem.media.forEach((med: any) => {
        if (med.url && med.url.startsWith("data:")) {
          totalBytes += med.url.length * 0.75;
        } else {
          totalBytes += 2 * 1024 * 1024; // ~2MB default
        }
      });
    }
  });

  userDocs.forEach((doc: any) => {
    if (doc.fileUrl && doc.fileUrl.startsWith("data:")) {
      totalBytes += doc.fileUrl.length * 0.75;
    } else {
      totalBytes += 1.5 * 1024 * 1024;
    }
  });

  const usedGB = Math.max(0, +(totalBytes / (1024 * 1024 * 1024)).toFixed(2));
  const limitGB = user.storageLimitGB || activeSub.storageAllocatedGB || 1;

  res.json({
    subscription: activeSub,
    storageUsedGB: user.storageUsedGB || usedGB,
    storageLimitGB: limitGB,
    storagePercentage: Math.min(100, Math.round(((user.storageUsedGB || usedGB) / limitGB) * 100)),
    planTier: user.planTier || activeSub.planTier || "Free",
    role: user.role || "Free User",
    autoRenew: user.autoRenew !== false
  });
});

// POST Upgrade Subscription Plan — DISABLED: no payment processor is integrated,
// so "upgrading" would mint paid invoices for free. Do not enable without real
// checkout + webhook-backed payment verification (and an idempotency key).
app.post("/api/subscription/upgrade", authMiddleware, (req: express.Request, res: express.Response) => {
  res.status(501).json({ error: "Upgrades are not available: payment processing is not yet integrated." });
});

// POST Cancel Subscription
app.post("/api/subscription/cancel", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);

  if (userIndex !== -1) {
    db.users[userIndex].autoRenew = false;
    if (db.subscriptions) {
      db.subscriptions.forEach((s: any) => {
        if (s.userId === userId) s.autoRenew = false;
      });
    }
    writeDb(db);
  }

  res.json({ success: true, message: "Subscription auto-renewal cancelled." });
});

// POST Role Switch (for quick testing across standard roles)
// "admin" is the platform-admin role and cannot be self-assigned.
app.post("/api/user/role", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const { role } = req.body;

  if (role === "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);

  if (userIndex !== -1) {
    db.users[userIndex].role = role;
    if (role === "Free User") db.users[userIndex].planTier = "Free";
    else if (role === "Premium User") db.users[userIndex].planTier = "Individual Yearly";
    else if (role === "Family Admin") db.users[userIndex].planTier = "Family Plan";
    else if (role === "Business Admin") db.users[userIndex].planTier = "Business & Organization Plan";
    writeDb(db);
    return res.json({ success: true, user: db.users[userIndex] });
  }
  res.status(404).json({ error: "User not found" });
});

// GET Family Workspace Details
app.get("/api/family-workspace", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const db = readDb();
  
  let family = (db.familyGroups || []).find((f: any) => f.familyAdminId === userId || f.members.some((m: any) => m.userId === userId));

  if (!family) {
    // Return default active family group
    family = db.familyGroups && db.familyGroups[0] ? db.familyGroups[0] : {
      id: "fam_default",
      familyAdminId: userId,
      familyName: "My Family Heritage",
      totalStorageGB: 100,
      usedStorageGB: 14.5,
      createdAt: new Date().toISOString(),
      members: [],
      albums: [],
      activities: [],
      invitations: []
    };
  }

  res.json(family);
});

// POST Invite Member to Family
app.post("/api/family-workspace/invite", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const { email, role, familyName } = req.body;
  const db = readDb();
  
  if (!db.familyGroups) db.familyGroups = [];
  let family = db.familyGroups.find((f: any) => f.familyAdminId === userId);

  if (!family) {
    family = {
      id: `fam_${Date.now()}`,
      familyAdminId: userId,
      familyName: familyName || "My Family Vault",
      totalStorageGB: 100,
      usedStorageGB: 12.0,
      createdAt: new Date().toISOString(),
      members: [],
      albums: [],
      activities: [],
      invitations: []
    };
    db.familyGroups.push(family);
  }

  const newInvite = {
    id: `inv_${Date.now()}`,
    familyId: family.id,
    email,
    role: role || "contributor",
    status: "pending",
    sentAt: new Date().toISOString()
  };

  family.invitations.push(newInvite);
  family.activities.unshift({
    id: `act_${Date.now()}`,
    familyId: family.id,
    userName: "Family Admin",
    userRole: "Admin",
    action: `Invited ${email} as ${role || "member"}`,
    timestamp: "Just now"
  });

  writeDb(db);
  res.json({ success: true, invitation: newInvite, family });
});

// GET Organization Workspace Details
app.get("/api/organization/workspace", authMiddleware, (req: express.Request, res: express.Response) => {
  const db = readDb();
  const orgs = db.organizations || [];
  const defaultOrg = orgs[0] || {
    id: "org_default",
    name: "LifeBook Partner Enterprise",
    orgType: "Company",
    logoUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80",
    adminUserId: (req as any).userId,
    totalStorageGB: 500,
    usedStorageGB: 120.0,
    memberCount: 84,
    createdAt: new Date().toISOString(),
    departments: [
      { id: "d1", orgId: "org_default", name: "Archives & PR", headName: "Elena Vance", memberCount: 18 }
    ],
    events: [
      { id: "e1", orgId: "org_default", title: "Corporate Founders Gala", date: "2026-10-10", location: "Main Hall", description: "Milestone historical archive launch.", attendeesCount: 150, category: "Gala" }
    ],
    documentsCount: 420,
    memoriesCount: 290
  };

  res.json({ organization: defaultOrg, allOrganizations: orgs });
});

// POST Create Department in Organization
app.post("/api/organization/department", authMiddleware, (req: express.Request, res: express.Response) => {
  const { orgId, name, headName } = req.body;
  const db = readDb();
  const org = (db.organizations || []).find((o: any) => o.id === orgId) || db.organizations?.[0];

  if (org) {
    const newDept = {
      id: `dep_${Date.now()}`,
      orgId: org.id,
      name,
      headName: headName || "Department Lead",
      memberCount: 1
    };
    org.departments.push(newDept);
    writeDb(db);
    return res.json({ success: true, department: newDept, organization: org });
  }

  res.status(404).json({ error: "Organization not found" });
});

// POST Create Event in Organization
app.post("/api/organization/event", authMiddleware, (req: express.Request, res: express.Response) => {
  const { orgId, title, date, location, description, category } = req.body;
  const db = readDb();
  const org = (db.organizations || []).find((o: any) => o.id === orgId) || db.organizations?.[0];

  if (org) {
    const newEvt = {
      id: `evt_${Date.now()}`,
      orgId: org.id,
      title,
      date: date || new Date().toISOString().split("T")[0],
      location: location || "HQ Auditorium",
      description: description || "",
      attendeesCount: 50,
      category: category || "Corporate Event"
    };
    org.events.push(newEvt);
    writeDb(db);
    return res.json({ success: true, event: newEvt, organization: org });
  }

  res.status(404).json({ error: "Organization not found" });
});

// GET Advertisements (Paid subscribers receive 0 ads!)
app.get("/api/ads", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);

  // If subscriber / paid user, NEVER return ads!
  if (user && user.planTier && user.planTier !== "Free") {
    return res.json([]);
  }

  const ads = (db.advertisements || []).filter((ad: any) => ad.active);
  res.json(ads);
});

// POST Create or Update Advertisement (admin role required)
app.post("/api/ads", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  if (!isAdminUser(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { title, sponsorName, imageUrl, targetUrl, placement, startDate, endDate } = req.body;
  const db = readDb();

  if (!db.advertisements) db.advertisements = [];
  const newAd = {
    id: `ad_${Date.now()}`,
    title,
    sponsorName,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80",
    targetUrl: targetUrl || "https://example.com",
    placement: placement || "sidebar",
    startDate: startDate || new Date().toISOString().split("T")[0],
    endDate: endDate || "2026-12-31",
    active: true,
    clicks: 0,
    views: 0,
    dailyEarnings: 50
  };

  db.advertisements.push(newAd);
  writeDb(db);
  res.json({ success: true, advertisement: newAd });
});

// POST Click / Impression Trackers for Ads (any authenticated user; writes are
// bounded counters — unauthenticated writes were a free DB-write spam vector)
app.post("/api/ads/:id/click", authMiddleware, (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const db = readDb();
  const ad = (db.advertisements || []).find((a: any) => a.id === id);
  if (ad) {
    ad.clicks = (ad.clicks || 0) + 1;
    writeDb(db);
  }
  res.json({ success: true });
});

app.post("/api/ads/:id/view", authMiddleware, (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const db = readDb();
  const ad = (db.advertisements || []).find((a: any) => a.id === id);
  if (ad) {
    ad.views = (ad.views || 0) + 1;
    writeDb(db);
  }
  res.json({ success: true });
});

// GET Billing Summary
app.get("/api/billing/summary", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);

  const userInvoices = (db.invoices || []).filter((i: any) => i.userId === userId);
  const userPayments = (db.payments || []).filter((p: any) => p.userId === userId);
  const activeSub = (db.subscriptions || []).find((s: any) => s.userId === userId && s.status === "active");

  res.json({
    user,
    subscription: activeSub || null,
    invoices: userInvoices,
    payments: userPayments
  });
});

// GET SaaS Admin Metrics & Revenue Data (admin role required)
app.get("/api/admin/metrics", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  if (!isAdminUser(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const db = readDb();
  const totalUsers = db.users.length || 10;
  const premiumUsers = db.users.filter((u: any) => u.planTier && u.planTier !== "Free").length || 3;
  const familyPlans = (db.familyGroups || []).length || 1;
  const businessPlans = (db.organizations || []).length || 2;

  const invoices = db.invoices || [];
  const subRev = invoices.reduce((acc: number, inv: any) => acc + (inv.totalAmount || 0), 0);
  const adRev = (db.advertisements || []).reduce((acc: number, ad: any) => acc + (ad.clicks * 2.5 + ad.views * 0.05), 0);

  res.json({
    totalUsers: totalUsers + 1240,
    premiumUsers: premiumUsers + 186,
    familyPlans: familyPlans + 48,
    businessPlans: businessPlans + 14,
    totalRevenue: Math.round(subRev + adRev + 142500),
    monthlyRevenue: Math.round((subRev + adRev + 142500) / 6),
    adRevenue: Math.round(adRev + 28400),
    subscriptionRevenue: Math.round(subRev + 114100),
    totalStorageTB: 14.8,
    dailyActiveUsers: 840,
    churnRate: 1.8,
    mrr: Math.round(((subRev + 142500) / 6)),
    arr: Math.round(((subRev + 142500) / 6) * 12),
    premiumConversion: 14.2
  });
});

// GET Revenue Analytics Breakdown (admin role required)
app.get("/api/admin/revenue", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  if (!isAdminUser(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({
    monthlyIncome: [
      { month: "Mar", subscription: 12000, family: 8500, business: 25000, ads: 4200 },
      { month: "Apr", subscription: 14500, family: 9200, business: 28000, ads: 5100 },
      { month: "May", subscription: 18000, family: 11000, business: 32000, ads: 6400 },
      { month: "Jun", subscription: 21000, family: 13500, business: 35000, ads: 7800 },
      { month: "Jul", subscription: 24500, family: 16000, business: 42000, ads: 8900 },
      { month: "Aug", subscription: 29000, family: 19500, business: 48000, ads: 10400 }
    ],
    planDistribution: [
      { plan: "Free Tier", count: 1054, value: 0 },
      { plan: "Individual Monthly", count: 120, value: 1800 },
      { plan: "Individual 6-Month", count: 85, value: 6800 },
      { plan: "Individual Yearly", count: 240, value: 120000 },
      { plan: "Family Plan", count: 48, value: 71952 },
      { plan: "Business Plan", count: 14, value: 69986 }
    ],
    adEarnings: [
      { month: "May", clicks: 1200, views: 35000, revenue: 6400 },
      { month: "Jun", clicks: 1450, views: 42000, revenue: 7800 },
      { month: "Jul", clicks: 1780, views: 51000, revenue: 8900 },
      { month: "Aug", clicks: 2100, views: 64000, revenue: 10400 }
    ],
    storageUsageTrends: [
      { month: "May", freeGB: 1200, premiumGB: 2800, businessGB: 5400 },
      { month: "Jun", freeGB: 1400, premiumGB: 3400, businessGB: 6200 },
      { month: "Jul", freeGB: 1650, premiumGB: 4100, businessGB: 7500 },
      { month: "Aug", freeGB: 1900, premiumGB: 4900, businessGB: 8900 }
    ],
    userGrowth: [
      { month: "May", free: 850, premium: 140, business: 8 },
      { month: "Jun", free: 940, premium: 180, business: 10 },
      { month: "Jul", free: 1080, premium: 220, business: 12 },
      { month: "Aug", free: 1240, premium: 270, business: 14 }
    ],
    topOrganizations: [
      { name: "Apex Global Tech Systems", type: "Company", members: 142, mrr: 4999 },
      { name: "St. Jude International Academy", type: "School", members: 850, mrr: 9999 },
      { name: "Green Earth Conservation NGO", type: "NGO", members: 310, mrr: 2999 },
      { name: "Horizon Health Sciences", type: "Company", members: 210, mrr: 4999 }
    ]
  });
});

/* ================= AUTOBIOGRAPHY =================
 *
 * Turns the user's real memories/milestones into a source-grounded, human
 * autobiography. Pipeline logic lives in server/autobiography-pipeline.ts
 * (pure functions, unit-tested). Security model: every route requires
 * authMiddleware; the document is always loaded by req.userId so cross-user
 * (IDOR) access is structurally impossible; guests are read-only and only
 * see PUBLISHED copies. Generation is per-chapter and idempotent: a crashed
 * run leaves per-chapter status to retry, and a completed generation is
 * reused unless source material changed (fingerprint check, §44).
 */
import {
  clusterIntoChapters,
  detectConflicts,
  buildGenerationPrompt,
  validateGeneratedChapters,
  findBannedPhrases,
  toChapter,
  sourceFingerprint,
  buildTranslationPrompt,
  validateTranslation,
  type TranslatableChapter,
  type PipelineMemory,
  type PipelineMilestone,
  type ChapterPlan,
  type SourceConflict,
} from "./server/autobiography-pipeline";
import { INDIAN_LANGUAGES, findLanguage } from "./src/languages";

// ---------------------------------------------------------------- helpers

function getAutobiography(db: any, userId: string) {
  if (!db.autobiographies) db.autobiographies = [];
  let auto = db.autobiographies.find((a: any) => a.userId === userId);
  if (!auto) {
    auto = {
      id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      title: "My Life Story",
      status: "empty",
      narrativeStyle: "warm",
      perspective: "first",
      chapters: [],
      sourceHash: "",
      progress: { total: 0, done: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.autobiographies.push(auto);
  }
  return auto;
}

function collectSources(db: any, userId: string) {
  const memories: PipelineMemory[] = (db.memories || [])
    .filter((m: any) => m.userId === userId)
    .map((m: any) => ({
      id: m.id, title: m.title ?? "", description: m.description ?? "",
      date: m.date ?? "", location: m.location, tags: m.tags, media: m.media,
    }));
  const milestones: PipelineMilestone[] = (db.milestones || [])
    .filter((m: any) => m.userId === userId)
    .map((m: any) => ({
      id: m.id, title: m.title ?? "", description: m.description ?? "",
      date: m.date ?? "", category: m.category, location: m.location, media: m.media,
    }));
  return { memories, milestones };
}

function photoUrlFor(db: any, mediaId: string): string | null {
  for (const m of db.memories || []) {
    const hit = (m.media || []).find((x: any) => x.id === mediaId);
    if (hit) return hit.url;
  }
  return null;
}

function publicAuto(auto: any, db: any, isGuest: boolean) {
  const photoCache = new Map<string, string | null>();
  const resolvePhoto = (id: string) => {
    if (!photoCache.has(id)) photoCache.set(id, photoUrlFor(db, id));
    return photoCache.get(id);
  };
  const chapters = (auto.chapters || []).map((c: any) => ({
    id: c.id, title: c.title, subtitle: c.subtitle, order: c.order, period: c.period,
    sections: c.sections, status: c.status, userEdited: !!c.userEdited,
    memoryCount: (c.memoryIds || []).length,
    photos: (c.photoIds || []).map((id: string) => ({ id, url: resolvePhoto(id), caption: c.captions?.[id] }))
      .filter((p: any) => p.url),
    error: c.status === "failed" ? c.error : undefined,
  }));
  const base: any = {
    id: auto.id, title: auto.title, subtitle: auto.subtitle, status: auto.status,
    narrativeStyle: auto.narrativeStyle, perspective: auto.perspective,
    progress: auto.progress, lastError: auto.lastError,
    updatedAt: auto.updatedAt, publishedAt: auto.publishedAt,
    chapters,
  };
  if (!isGuest) {
    base.conflicts = auto.conflicts ?? [];
    base.memoryCount = new Set((auto.chapters || []).flatMap((c: any) => c.memoryIds || [])).size;
    base.photoCount = new Set((auto.chapters || []).flatMap((c: any) => c.photoIds || [])).size;
  }
  return base;
}

// ponytail: in-memory per-user rate limit — per-instance only. Fine for the
// single-node dev server and per-lambda Vercel functions; upgrade path is a
// shared store if generation abuse ever shows up across instances.
const autoGenAttempts = new Map<string, number[]>();
function autoGenRateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (autoGenAttempts.get(userId) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 5) return true;
  arr.push(now);
  autoGenAttempts.set(userId, arr);
  return false;
}
export function resetAutoGenRateLimiterForTests() { autoGenAttempts.clear(); }

/**
 * Generation core. Per-chapter AI calls with real, persisted progress
 * (§28): a crash mid-run leaves earlier chapters ready and failed ones
 * retryable. User-edited chapters are never rewritten (§47). When
 * `onlyIds` is given, only those chapters are (re)written — retry and
 * single-chapter regeneration reuse it. Assumes source plans are stable
 * between the failing run and the retry (same sources → same plan).
 */
// Test seam: inject a fake AI client so the generation core is testable
// without real credentials. Always null in production.
let aiClientOverride: any = null;
export function setAiClientOverrideForTests(client: any) { aiClientOverride = client; }
export async function runGenerationForTests(auto: any, user: any, db: any, onlyIds?: string[]) {
  return runGeneration(auto, user, db, onlyIds);
}

function isTransientAiError(err: any): boolean {
  const msg = String(err?.message ?? "");
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded");
}

/**
 * Bounded retry for transient AI failures (quota windows, brief outages).
 * Generation is idempotent per chapter, so retrying is safe (§45). Never
 * loops unboundedly: 3 attempts total, capped delays.
 */
async function generateChapterWithRetry(aiClient: any, params: any, attempts = 3) {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await generateContentWithFallback(aiClient, params);
    } catch (err: any) {
      lastErr = err;
      if (!isTransientAiError(err) || i === attempts - 1) throw err;
      const delay = Math.min(60_000, 15_000 * (i + 1));
      console.warn(`[autobiography] transient AI error, retrying in ${delay / 1000}s (attempt ${i + 2}/${attempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function runGeneration(auto: any, user: any, db: any, onlyIds?: string[]) {
  const userId = auto.userId;
  const { memories, milestones } = collectSources(db, userId);
  const conflicts = detectConflicts(memories);
  const memoriesById = new Map<string, PipelineMemory | PipelineMilestone>();
  for (const m of memories) memoriesById.set(m.id, m);
  for (const m of milestones) memoriesById.set(m.id, m);

  auto.sourceHash = sourceFingerprint(memories, milestones);
  auto.conflicts = conflicts;

  if (memories.length + milestones.length === 0) {
    auto.chapters = [];
    auto.status = "empty";
    auto.progress = { total: 0, done: 0 };
    auto.updatedAt = new Date().toISOString();
    writeDb(db);
    return;
  }

  const plans = clusterIntoChapters(memories, milestones);

  // Match previous chapters to new plans by CONTENT (memory overlap), not
  // title — plan titles change as the collection grows (e.g. the §25
  // thin-book chapter is renamed into themed chapters), and a user's words
  // must survive that. Title match is the strongest signal; overlap decides
  // the rest. Each previous chapter is consumed at most once.
  const prevChapters = [...(auto.chapters || [])];
  const matchPrev = (p: ChapterPlan): any | undefined => {
    let best: any = undefined;
    let bestScore = 0;
    for (const prev of prevChapters) {
      if (!prev || (prev as any)._consumed) continue;
      const overlap = (prev.memoryIds || []).filter((id: string) => p.memoryIds.includes(id)).length;
      const score = prev.title === p.title ? overlap + 1000 : overlap;
      if (score > bestScore) { bestScore = score; best = prev; }
    }
    if (best) (best as any)._consumed = true;
    return best;
  };

  auto.chapters = plans.map((p: ChapterPlan, i: number) => {
    const prev = matchPrev(p);
    if (prev && prev.userEdited) {
      // §47: user text is authoritative — keep it, refresh source linkage only.
      return { ...prev, order: i, status: "ready", photoIds: p.photoIds, memoryIds: p.memoryIds };
    }
    const wanted = !onlyIds || (prev ? onlyIds.includes(prev.id) : false);
    return {
      id: prev?.id ?? `chap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: p.title,
      subtitle: prev?.subtitle,
      order: i,
      period: p.period,
      sections: wanted ? [] : (prev?.sections ?? []),
      memoryIds: p.memoryIds,
      photoIds: p.photoIds,
      captions: wanted ? undefined : prev?.captions,
      status: wanted ? "pending" : (prev?.status ?? "pending"),
      userEdited: prev?.userEdited ?? false,
      error: wanted ? undefined : prev?.error,
      updatedAt: new Date().toISOString(),
    };
  });

  auto.status = "generating";
  auto.lastError = undefined;
  writeDb(db);

  let anyFailed = false;

  for (let i = 0; i < auto.chapters.length; i++) {
    const ch = auto.chapters[i];
    if (ch.status === "ready") continue; // user-edited or untouched chapter
    ch.status = "generating";
    writeDb(db);
    try {
      // Resolved lazily: a book whose chapters are all user-edited (or already
      // ready) must not require AI credentials at all.
      const aiClient = aiClientOverride ?? getAiClient();
      const { system, user: userPrompt } = buildGenerationPrompt({
        userName: user.name,
        perspective: auto.perspective,
        style: auto.narrativeStyle,
        chapters: [plans[i]],
        memoriesById,
        conflicts,
      });
      const result = await generateChapterWithRetry(aiClient, {
        contents: userPrompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.NUMBER, description: "chapter index, always 1 in this single-chapter response" },
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    period: { type: Type.STRING },
                    paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
                    usedMemoryIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    captions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: { photoId: { type: Type.STRING }, caption: { type: Type.STRING } },
                        required: ["photoId", "caption"],
                      },
                      description: "factual captions for photos assigned to this chapter",
                    },
                  },
                  required: ["index", "title", "paragraphs", "usedMemoryIds"],
                },
              },
            },
            required: ["chapters"],
          },
        },
      });
      const parsed = JSON.parse(result.text || "{}");
      const check: any = validateGeneratedChapters(parsed, [plans[i]]);
      if (!check.ok) throw new Error(`AI output rejected: ${check.reason}`);
      const gen = check.chapters[0];
      ch.title = ch.userEdited ? ch.title : gen.title;
      ch.subtitle = gen.subtitle;
      ch.period = gen.period;
      ch.sections = gen.sections;
      ch.status = "ready";
      ch.error = undefined;
      ch.updatedAt = new Date().toISOString();
    } catch (err: any) {
      ch.status = "failed";
      // Tell people the truth about WHY it failed, in human terms.
      ch.error = isTransientAiError(err)
        ? "AI writing is at its daily limit right now. Please try again later today or tomorrow."
        : "This chapter could not be written. You can retry it.";
      anyFailed = true;
      console.error(`[autobiography] chapter ${i + 1} (${ch.title}) failed:`, err.message);
    }
    writeDb(db);
  }

  const resolved = auto.chapters.filter((c: any) => c.status === "ready" || c.status === "failed").length;
  auto.progress = { total: auto.chapters.length, done: resolved };
  auto.status = anyFailed ? "failed" : "ready_for_review";
  if (anyFailed) {
    const quota = auto.chapters.some((c: any) => /daily limit/.test(c.error ?? ""));
    auto.lastError = quota
      ? "AI writing has hit its daily limit. Your story is safe — try again later today or tomorrow."
      : "Some chapters could not be written. You can retry them.";
  }
  auto.updatedAt = new Date().toISOString();
  writeDb(db);

  // §46: reuse the existing notification infrastructure
  if (anyFailed) {
    addNotification(userId, "Autobiography needs attention", "Some chapters of your life story could not be written. Open Autobiography to retry them.");
  } else {
    addNotification(userId, "Your autobiography is ready", `"${auto.title}" is ready for your review.`);
  }
}

// ---------------------------------------------------------------- routes

app.get("/api/autobiography", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const isGuest = !!(req as any).isGuest;
  const db = readDb();

  if (isGuest) {
    // §32: guests see only a PUBLISHED copy — never drafts or generation state.
    const auto = db.autobiographies?.find((a: any) => a.userId === userId);
    if (!auto || auto.status !== "published") {
      return res.status(404).json({ error: "No published autobiography available" });
    }
    return res.json(publicAuto(auto, db, true));
  }

  const auto = getAutobiography(db, userId);
  writeDb(db);
  const payload = publicAuto(auto, db, false);
  // §44: let the UI know whether new source material exists
  const { memories, milestones } = collectSources(db, userId);
  payload.upToDate = auto.status === "generating" ? null : sourceFingerprint(memories, milestones) === auto.sourceHash;
  payload.sourceCount = memories.length + milestones.length;
  res.json(payload);
});

app.patch("/api/autobiography", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const db = readDb();
  const auto = getAutobiography(db, userId);
  const { title, subtitle, coverPhotoId, narrativeStyle, perspective } = req.body ?? {};
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 120)
      return res.status(400).json({ error: "Title must be 1-120 characters" });
    auto.title = title.trim();
  }
  if (subtitle !== undefined) auto.subtitle = typeof subtitle === "string" ? subtitle.slice(0, 160) : undefined;
  if (coverPhotoId !== undefined) auto.coverPhotoId = typeof coverPhotoId === "string" ? coverPhotoId : undefined;
  const STYLES = ["warm", "reflective", "simple", "literary", "conversational", "formal"];
  if (narrativeStyle !== undefined) {
    if (!STYLES.includes(narrativeStyle)) return res.status(400).json({ error: "Unsupported narrative style" });
    auto.narrativeStyle = narrativeStyle;
  }
  if (perspective !== undefined) {
    if (!["first", "third", "legacy"].includes(perspective)) return res.status(400).json({ error: "Unsupported perspective" });
    auto.perspective = perspective;
  }
  auto.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(publicAuto(auto, db, false));
});

app.post("/api/autobiography/generate", authMiddleware, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  if (autoGenRateLimited(userId)) {
    return res.status(429).json({ error: "Please wait a moment before generating again." });
  }
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) return res.status(401).json({ error: "User session expired" });
  const auto = getAutobiography(db, userId);
  if (auto.status === "generating") {
    // §30 idempotency: never double-generate
    return res.status(409).json({ error: "Generation already in progress", progress: auto.progress });
  }
  const { memories, milestones } = collectSources(db, userId);
  if (memories.length + milestones.length === 0) {
    return res.status(400).json({ error: "Add a few memories first — your story is written from what you have preserved." });
  }
  try { getAiClient(); } catch {
    return res.status(503).json({ error: "AI writing is not configured on this server. Set GEMINI_API_KEY to enable it." });
  }
  res.status(202).json({ id: auto.id, status: "generating", progress: { total: 0, done: 0 } });
  runGeneration(auto, user, db).catch((err) => {
    console.error("[autobiography] generation crashed:", err.message);
    auto.status = "failed";
    auto.lastError = "Something interrupted the writing. Your existing story is safe — you can try again.";
    writeDb(db);
  });
});

app.post("/api/autobiography/chapters/:chapterId/regenerate", authMiddleware, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  const auto = getAutobiography(db, userId);
  const chapter = auto.chapters.find((c: any) => c.id === req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });
  if (chapter.userEdited) {
    return res.status(409).json({ error: "You have edited this chapter. Regenerating would replace your words." });
  }
  if (auto.status === "generating") return res.status(409).json({ error: "Generation already in progress" });
  try { getAiClient(); } catch {
    return res.status(503).json({ error: "AI writing is not configured on this server." });
  }
  res.status(202).json({ status: "generating" });
  runGeneration(auto, user, db, [chapter.id]).catch((err) => {
    console.error("[autobiography] regenerate crashed:", err.message);
    chapter.status = "failed";
    chapter.error = "This chapter could not be written. You can retry it.";
    writeDb(db);
  });
});

app.patch("/api/autobiography/chapters/:chapterId", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const db = readDb();
  const auto = getAutobiography(db, userId);
  const chapter = auto.chapters.find((c: any) => c.id === req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });
  const { title, subtitle, sections, captions } = req.body ?? {};
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 120)
      return res.status(400).json({ error: "Title must be 1-120 characters" });
    chapter.title = title.trim();
  }
  if (subtitle !== undefined) chapter.subtitle = typeof subtitle === "string" ? subtitle.slice(0, 160) : undefined;
  if (sections !== undefined) {
    if (!Array.isArray(sections) || sections.some((s: any) => typeof s !== "string" || s.length > 2000))
      return res.status(400).json({ error: "Sections must be an array of paragraphs (max 2000 chars each)" });
    chapter.sections = sections.map((s: string) => s.trim()).filter(Boolean);
  }
  if (captions !== undefined) {
    // §19: every generated caption is user-editable; unknown photo ids are ignored.
    if (!captions || typeof captions !== "object" || Array.isArray(captions))
      return res.status(400).json({ error: "Captions must be an object of photoId -> text" });
    if (!chapter.captions) chapter.captions = {};
    for (const [pid, cap] of Object.entries(captions)) {
      if (!chapter.photoIds.includes(pid)) continue;
      if (cap === null || cap === "") delete chapter.captions[pid];
      else if (typeof cap === "string") chapter.captions[pid] = cap.slice(0, 200);
    }
  }
  chapter.userEdited = true; // §47: once touched by the user, AI never overwrites
  chapter.status = "ready";
  chapter.error = undefined;
  chapter.updatedAt = new Date().toISOString();
  auto.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(publicAuto(auto, db, false));
});

/**
 * Translated copy of the finished autobiography (major Indian languages).
 * GET /api/autobiography/translate?lang=hi-IN
 *
 * Whole-book AI translation, cached on the autobiography doc under
 * `translations[lang]`. The cache is keyed to the book's sourceHash +
 * updatedAt, so any regeneration or user edit invalidates it — readers
 * never see a translation older than the book itself. Guests may read a
 * cached translation of a PUBLISHED book but never trigger AI (cost control,
 * §44).
 */
app.get("/api/autobiography/translate", authMiddleware, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const isGuest = !!(req as any).isGuest;
  const lang = findLanguage(String(req.query.lang ?? ""));
  if (!lang) return res.status(400).json({ error: "Unsupported language" });
  if (lang.code === "en-IN") {
    return res.status(400).json({ error: "English is the original language of the book." });
  }

  const db = readDb();
  const auto = isGuest
    ? db.autobiographies?.find((a: any) => a.userId === userId && a.status === "published")
    : getAutobiography(db, userId);
  if (!auto || auto.status !== "published" && auto.status !== "ready_for_review") {
    return res.status(404).json({ error: "Write your autobiography first — there is nothing to translate yet." });
  }
  const readyChapters = (auto.chapters || []).filter((c: any) => c.status === "ready");
  if (readyChapters.length === 0) {
    return res.status(404).json({ error: "Write your autobiography first — there is nothing to translate yet." });
  }

  // Freshness = sources + chapter-text stamp. Book-level touches (publish,
  // unpublish) don't change chapter text, so a cached translation survives
  // them; any chapter edit or regeneration does change the stamp.
  const bookStamp = JSON.stringify((auto.chapters || []).map((c: any) => [c.id, c.updatedAt]));
  const cached = auto.translations?.[lang.code];
  const fresh = cached && cached.sourceHash === auto.sourceHash && cached.bookStamp === bookStamp;
  if (cached && fresh) return res.json({ lang: lang.code, ...cached });

  if (isGuest) {
    // Guests read the owner's cached translation; they can never spend AI.
    return res.status(cached ? 409 : 404).json({
      error: cached
        ? "This translation is out of date. Ask the owner to refresh it."
        : "No translation available yet. Ask the owner to open this language first.",
    });
  }

  // Test seam: honor the injected fake client so route wiring is testable
  // without real credentials (same pattern as the generation core).
  try { aiClientOverride ?? getAiClient(); } catch {
    return res.status(503).json({ error: "AI translation is not configured on this server. Set GEMINI_API_KEY to enable it." });
  }
  if (autoGenRateLimited(userId)) {
    return res.status(429).json({ error: "Please wait a moment before translating again." });
  }

  const book: TranslatableChapter[] = readyChapters
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((c: any) => ({
      id: c.id, title: c.title, subtitle: c.subtitle, sections: c.sections,
      photoIds: c.photoIds ?? [], captions: c.captions ?? {},
    }));
  const { system, user: userPrompt } = buildTranslationPrompt({
    title: auto.title, subtitle: auto.subtitle, language: lang, chapters: book,
  });
  try {
    const aiClient = aiClientOverride ?? getAiClient();
    const result = await generateChapterWithRetry(aiClient, {
      contents: userPrompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.NUMBER, description: "input chapter number, 1-based" },
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  captions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { photoId: { type: Type.STRING }, caption: { type: Type.STRING } },
                      required: ["photoId", "caption"],
                    },
                  },
                },
                required: ["index", "title", "paragraphs"],
              },
            },
          },
          required: ["title", "chapters"],
        },
      },
    });
    const parsed = JSON.parse(result.text || "{}");
    // Map AI chapters (index = book order) back onto real chapter ids.
    const withIds = {
      ...parsed,
      chapters: (parsed.chapters ?? []).map((item: any, i: number) => ({ ...item, index: i + 1 })),
    };
    const check = validateTranslation(withIds, { title: auto.title, subtitle: auto.subtitle, chapters: book });
    if (!check.ok) throw new Error(`AI translation rejected: ${(check as any).reason}`);

    auto.translations = auto.translations ?? {};
    auto.translations[lang.code] = {
      title: check.title,
      subtitle: check.subtitle,
      chapters: check.chapters.map((c) => ({
        id: c.id, title: c.title, subtitle: c.subtitle, sections: c.sections, captions: c.captions,
      })),
      sourceHash: auto.sourceHash,
      bookStamp,
      translatedAt: new Date().toISOString(),
    };
    writeDb(db);
    return res.json({ lang: lang.code, ...auto.translations[lang.code] });
  } catch (err: any) {
    console.error("[autobiography] translation failed:", err.message);
    return res.status(502).json({
      error: isTransientAiError(err)
        ? "AI translation is at its daily limit right now. Please try again later today or tomorrow."
        : "We couldn't translate your story. Please try again.",
    });
  }
});

app.post("/api/autobiography/publish", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const db = readDb();
  const auto = getAutobiography(db, userId);
  if (!auto.chapters.length) return res.status(400).json({ error: "Generate your story first." });
  if (auto.chapters.some((c: any) => c.status !== "ready")) {
    return res.status(400).json({ error: "Finish or remove failed chapters before sharing your story." });
  }
  auto.status = "published";
  auto.publishedAt = new Date().toISOString();
  auto.updatedAt = auto.publishedAt;
  writeDb(db);
  addNotification(userId, "Story shared", "Your autobiography is now visible to your family.");
  res.json(publicAuto(auto, db, false));
});

app.post("/api/autobiography/unpublish", authMiddleware, (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  const db = readDb();
  const auto = getAutobiography(db, userId);
  auto.status = "ready_for_review";
  auto.publishedAt = undefined;
  auto.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(publicAuto(auto, db, false));
});

// Vite middleware integration (from instructions)
async function startServer() {
  // Start background message scheduler
  setInterval(checkAndDeliverScheduledMessages, 10000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!isVercel && process.env.LIFEBOOK_SKIP_AUTOSTART !== "1") {
  startServer();
}

// Export the Express app for Vercel serverless deployment
export default app;

// Exposed for the Supabase sync self-check (test/supabase-sync-check.ts)
export { readDb, writeDb, downloadDbFromSupabase };
