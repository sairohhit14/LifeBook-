/**
 * Demo accounts integrity check.
 * Ensures the demo accounts (ananya.demo@ / marcus.demo@lifebook.dev) exist
 * with usable data for every feature and that no demo record is orphaned.
 * Seeds automatically if the demo data is missing.
 */
import { execSync } from "child_process";
import * as fs from "fs";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log((cond ? "PASS" : "FAIL") + ": " + name);
  if (!cond) failures++;
}

// Self-heal: seed if the demo accounts are missing
const dbPath = "db.json";
const raw = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const hasDemo = (raw.users || []).some((u: any) => u.email === "ananya.demo@lifebook.dev");
if (!hasDemo) {
  execSync("node scripts/seed-demo-data.cjs", { stdio: "inherit" });
}

const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const ANA = "google_demo_ananya";
const MARCUS = "google_demo_marcus";

const ana = (db.users || []).find((u: any) => u.id === ANA);
const marcus = (db.users || []).find((u: any) => u.id === MARCUS);
check("demo users exist", !!ana && !!marcus);

if (ana && marcus) {
  check("demo passwords are hashed (not plaintext)", !String(ana.password).includes("demo1234") && ana.password.includes(":"));
  check("demo users have no auth bypass fields", ana.password !== "" && marcus.password !== "");

  const forAna = (col: string) => (db[col] || []).filter((x: any) => x.userId === ANA);
  const forMarcus = (col: string) => (db[col] || []).filter((x: any) => x.userId === MARCUS);

  check("ananya: memories, milestones, family, messages, documents, story, notifications, autobiography, subscription",
    forAna("memories").length > 0 && forAna("milestones").length > 0 && forAna("family").length > 0 &&
    forAna("messages").length > 0 && forAna("documents").length > 0 && forAna("stories").length > 0 &&
    forAna("notifications").length > 0 && forAna("autobiographies").length > 0 && forAna("subscriptions").length > 0);
  check("marcus: memories, milestones, family, messages, documents, notifications, subscription",
    forMarcus("memories").length > 0 && forMarcus("milestones").length > 0 && forMarcus("family").length > 0 &&
    forMarcus("messages").length > 0 && forMarcus("documents").length > 0 &&
    forMarcus("notifications").length > 0 && forMarcus("subscriptions").length > 0);
  // Seed-integrity check: scoped to the seeded messages (msg_ana_*). The demo
  // account can accumulate real app-created messages (e.g. delivered tests from
  // browser QA) — those must not fail a check about the seed itself.
  check("ananya: seeded scheduled legacy messages are in the future",
    forAna("messages").filter((m: any) => String(m.id).startsWith("msg_ana_"))
      .every((m: any) => !m.deliveryDateUtc || new Date(m.deliveryDateUtc).getTime() > Date.now() - 86400000));
  check("ananya autobiography: ready-for-review with valid memory references",
    forAna("autobiographies").some((a: any) =>
      a.status === "ready_for_review" &&
      a.chapters.every((c: any) => c.memoryIds.every((id: string) => forAna("memories").some((m: any) => m.id === id)))));
  check("companion chat history exists for both", (db.chatHistory?.[ANA]?.length || 0) > 0 && (db.chatHistory?.[MARCUS]?.length || 0) > 0);
  check("family workspace group exists with demo members",
    (db.familyGroups || []).some((g: any) => g.members?.some((m: any) => m.userId === ANA) && g.members?.some((m: any) => m.userId === MARCUS)));

  // Ownership integrity — no orphaned demo records
  const userIds = new Set((db.users || []).map((u: any) => u.id));
  let orphaned = 0;
  for (const col of ["memories", "milestones", "family", "messages", "documents", "stories", "notifications", "autobiographies", "subscriptions"]) {
    orphaned += (db[col] || []).filter((x: any) => String(x.userId || "").startsWith("google_demo") && !userIds.has(x.userId)).length;
  }
  check("no orphaned demo records", orphaned === 0);
}

console.log(failures === 0 ? "ALL DEMO CHECKS PASSED" : `${failures} DEMO CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
