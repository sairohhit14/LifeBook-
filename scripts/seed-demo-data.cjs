/**
 * Demo data seeder — creates two demo accounts with data for EVERY feature:
 * memories (+media), timeline milestones, family members, legacy messages,
 * secure-vault documents, AI biography (memoir), AI companion history,
 * notifications, subscription, family workspace, and an autobiography draft.
 *
 * Idempotent: re-running purges and recreates only the demo accounts' data.
 * Run: node scripts/seed-demo-data.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(process.cwd(), "db.json");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DEMO_PASSWORD = "demo1234";

// Stable ids so re-seeding replaces exactly the demo records
const ANANYA_ID = "google_demo_ananya";
const MARCUS_ID = "google_demo_marcus";
const DEMO_EMAILS = new Set(["ananya.demo@lifebook.dev", "marcus.demo@lifebook.dev"]);

const iso = (d) => d.toISOString();
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));
const daysAhead = (n) => iso(new Date(Date.now() + n * 86400000));

function buildUser(id, name, email, dob, phone, bio, createdAt) {
  return {
    id, name, email,
    password: hashPassword(DEMO_PASSWORD),
    dob, phone,
    profilePhoto: "",
    bio,
    legacyKey: id === ANANYA_ID ? "LB-DEMO1" : "LB-DEMO2",
    createdAt,
  };
}

function seedAnanya(db) {
  const uid = ANANYA_ID;
  db.memories.push(
    { id: "mem_ana_1", userId: uid, title: "First monsoon in the new house", description: "The rains arrived the week we moved in. Amma made pakoras on the kitchen floor because the stove wasn't connected yet, and we ate them watching the street turn into a river. The house smelled of fresh paint and wet earth.", date: "1998-06-12", location: "Kochi, Kerala", tags: ["family", "childhood", "home"], media: [], createdAt: daysAgo(40) },
    { id: "mem_ana_2", userId: uid, title: "Dad teaching me to ride a bicycle", description: "Red Hero bicycle, slightly too big for me. He ran behind holding the seat for three evenings until, on the fourth, I looked back and he was standing at the end of the road, laughing.", date: "1999-01-20", location: "Kochi, Kerala", tags: ["family", "childhood"], media: [], createdAt: daysAgo(39) },
    { id: "mem_ana_3", userId: uid, title: "College festival — first time on stage", description: "Sang solo at the cultural festival. Terrified until the second verse, then something loosened. Won second place, but the real prize was Appa's face in the front row.", date: "2012-03-08", location: "Bengaluru", tags: ["school", "achievement"], media: [], createdAt: daysAgo(38) },
    { id: "mem_ana_4", userId: uid, title: "The night Arjun proposed", description: "Rooftop, string lights he'd clearly spent hours untangling, and his grandmother's ring. I said yes before he finished the question.", date: "2019-11-02", location: "Bengaluru", tags: ["love", "family"], media: [], createdAt: daysAgo(37) },
    { id: "mem_ana_5", userId: uid, title: "Meera's first steps", description: "She let go of the coffee table, wobbled like a small sailor, and walked straight into my arms. We must have replayed it a hundred times for the video call home.", date: "2023-04-17", location: "Bengaluru", tags: ["family", "milestone"], media: [], createdAt: daysAgo(36) },
    { id: "mem_ana_6", userId: uid, title: "Sunday lunches at Paati's", description: "Every Sunday of my childhood: sambar, three kinds of rice, cousins crammed onto the veranda bench, and Paati refusing help in the kitchen until you helped anyway.", date: "2001-07-15", location: "Chennai", tags: ["family", "tradition", "childhood"], media: [], createdAt: daysAgo(35) }
  );

  db.milestones.push(
    { id: "mil_ana_1", userId: uid, title: "Born in Kochi", description: "The beginning — monsoon season, per family legend.", date: "1994-08-30", category: "Birth", location: "Kochi, Kerala", media: [], createdAt: daysAgo(40) },
    { id: "mil_ana_2", userId: uid, title: "Graduated — Computer Science", description: "Four years, one thesis on speech recognition, and a convocation where Amma cried more than I did.", date: "2016-05-20", category: "Education", location: "Bengaluru", media: [], createdAt: daysAgo(39) },
    { id: "mil_ana_3", userId: uid, title: "Joined my first team as a lead", description: "Six engineers, one very imposter-syndromic new lead, and the project that taught me leadership is mostly listening.", date: "2021-02-01", category: "Career", location: "Bengaluru", media: [], createdAt: daysAgo(38) },
    { id: "mil_ana_4", userId: uid, title: "Married Arjun", description: "A morning wedding under a canopy of jasmine, both grandmothers insisting on walking me down the aisle.", date: "2020-12-11", category: "Family", location: "Chennai", media: [], createdAt: daysAgo(37) },
    { id: "mil_ana_5", userId: uid, title: "Meera born", description: "3:12 a.m., the quietest hospital ward in the world, and the loudest my heart has ever been.", date: "2023-04-15", category: "Family", location: "Bengaluru", media: [], createdAt: daysAgo(36) }
  );

  db.family.push(
    { id: "fam_ana_1", userId: uid, name: "Arjun Sharma", relationship: "Spouse", email: "arjun@family.demo", phone: "+91 98450 00001", dob: "1993-03-22", permission: "Contributor", role: "Contributor", profilePhoto: "", createdAt: daysAgo(30) },
    { id: "fam_ana_2", userId: uid, name: "Lakshmi Menon", relationship: "Mother", email: "lakshmi@family.demo", phone: "+91 98450 00002", dob: "1968-11-05", permission: "Viewer", role: "Viewer", profilePhoto: "", createdAt: daysAgo(30) },
    { id: "fam_ana_3", userId: uid, name: "Rohan Menon", relationship: "Brother", email: "rohan@family.demo", phone: "+91 98450 00003", dob: "1997-06-14", permission: "Editor", role: "Editor", profilePhoto: "", createdAt: daysAgo(30) }
  );

  db.messages.push(
    { id: "msg_ana_1", userId: uid, title: "For Meera's 18th birthday", recipientName: "Meera Sharma", recipientEmail: "meera@family.demo", deliveryOption: "Exact Date", deliveryDate: "2041-04-15", deliveryTime: "09:00", deliveryDateUtc: "2041-04-15T03:30:00.000Z", type: "text", content: "My darling Meera — by the time you read this you'll be an adult, and I'll have eighteen years of memories I haven't made yet. But here is what I know already: the day you took your first steps, you walked straight into my arms, and you've been walking bravely ever since. Happy birthday, sweetheart.", mediaUrl: "", mediaName: "", status: "scheduled", createdAt: daysAgo(20) },
    { id: "msg_ana_2", userId: uid, title: "Anniversary letter to Arjun", recipientName: "Arjun Sharma", recipientEmail: "arjun@family.demo", deliveryOption: "Exact Date", deliveryDate: daysAhead(30).slice(0, 10), deliveryTime: "08:00", deliveryDateUtc: daysAhead(30), type: "text", content: "Ten years ago you untangled string lights on a rooftop. Thank you for still untangling things with me.", mediaUrl: "", mediaName: "", status: "scheduled", createdAt: daysAgo(20) }
  );

  db.documents.push(
    { id: "doc_ana_1", userId: uid, name: "Grandmother's recipe notebook", title: "Grandmother's recipe notebook", category: "Family Heirloom", size: "1.2 MB", fileSize: "1.2 MB", uploadDate: daysAgo(25).slice(0, 10), fileUrl: "", fileName: "paati-recipes.pdf", mimeType: "application/pdf", isEncrypted: true, notes: "Scanned pages of Paati's handwritten cookbook — start with the sambar page." },
    { id: "doc_ana_2", userId: uid, name: "Property deeds — Kochi house", title: "Property deeds — Kochi house", category: "Legal", size: "3.4 MB", fileSize: "3.4 MB", uploadDate: daysAgo(24).slice(0, 10), fileUrl: "", fileName: "kochi-deeds.pdf", mimeType: "application/pdf", isEncrypted: true, notes: "Original deeds for the family home. Rohan has a copy." },
    { id: "doc_ana_3", userId: uid, name: "Meera's birth certificate", title: "Meera's birth certificate", category: "Identity", size: "0.8 MB", fileSize: "0.8 MB", uploadDate: daysAgo(23).slice(0, 10), fileUrl: "", fileName: "meera-birth-cert.pdf", mimeType: "application/pdf", isEncrypted: true, notes: "" }
  );

  db.stories.push({
    id: "story_ana_1",
    userId: uid,
    title: "The Monsoon Years — Ananya's Memoir",
    biographyLength: "medium",
    chapters: [
      { title: "Rains and New Beginnings", content: "Some lives begin quietly. Mine began with a monsoon — the week my family moved into a house that smelled of fresh paint and wet earth, where my mother fried pakoras on a kitchen floor because the stove wasn't connected yet. It was, she says, the happiest week of her life. The bicycle came next: a red Hero, slightly too big, my father running behind it for three evenings pretending to hold on. When I finally looked back, he was at the end of the road, laughing. These are the first pages of my story — ordinary evenings that became the world I knew." },
      { title: "Classrooms and Courage", content: "School gave me two things: a love of books and a fear of stages. The fear lost in 2012, at the college festival, when I sang solo and discovered that terror and excitement are the same feeling wearing different clothes. Four years later I graduated in computer science; my mother cried more at convocation than I did. What I remember most is not the degree but the doorway it opened — into teams, into code, into a career I stumbled into and stayed for." },
      { title: "The Life I'm Building", content: "Then came Arjun, a rooftop, and a question I answered before he finished asking. Then Meera — 3:12 a.m., first steps into my arms, the loudest my heart has ever been. If my story has a theme so far, it is this: the bravest things I've done were all small, and all of them were easier because someone was standing at the end of the road, laughing." }
    ],
    generatedAt: daysAgo(15)
  });

  db.chatHistory[uid] = [
    { id: "chat_ana_1", role: "user", sender: "user", text: "What did I write about my grandmother?", date: daysAgo(10) },
    { id: "chat_ana_2", role: "model", sender: "companion", text: "You've preserved two lovely threads about her: the Sunday lunches at Paati's house — sambar, three kinds of rice, cousins on the veranda — and her recipe notebook, which you scanned into your vault. Would you like me to help you write a memory about her kitchen?", date: daysAgo(10) }
  ];

  db.notifications.push(
    { id: "notif_ana_1", userId: uid, title: "Legacy Message Scheduled", message: "Scheduled a legacy text message for Meera Sharma (Exact Date).", date: daysAgo(20), read: false },
    { id: "notif_ana_2", userId: uid, title: "Biography Generated", message: "Your LifeBook Memoir \"The Monsoon Years\" is ready to read!", date: daysAgo(15), read: false },
    { id: "notif_ana_3", userId: uid, title: "Memory Added", message: "Successfully saved your memory: \"Sunday lunches at Paati's\".", date: daysAgo(35), read: true }
  );

  // Autobiography: ready-for-review draft grounded in the seeded memories
  db.autobiographies.push({
    id: "auto_ana",
    userId: uid,
    title: "My Life Story",
    subtitle: "Ananya Sharma",
    coverPhotoId: "",
    status: "ready_for_review",
    narrativeStyle: "warm",
    perspective: "first",
    chapters: [
      {
        id: "auto_ana_ch1", title: "The Memories I Have Preserved", subtitle: "A beginning",
        order: 0, period: "1994 – present",
        sections: [
          "I was born in Kochi during monsoon season, and the rain seems to have followed the family ever since — through Sunday lunches at my grandmother's in Chennai, a red bicycle my father chased down the road, and eventually a new home in Bengaluru.",
          "The memories I have preserved here are mostly small ones. A festival stage in 2012. A rooftop full of string lights. A little girl wobbling like a sailor into my arms. I've learned that these are the ones worth keeping."
        ],
        memoryIds: ["mem_ana_1", "mem_ana_2", "mem_ana_3", "mem_ana_4", "mem_ana_5", "mem_ana_6"],
        photoIds: [], status: "ready", userEdited: false, updatedAt: daysAgo(12)
      }
    ],
    sourceHash: "demo-seed-v1",
    progress: { total: 1, done: 1 },
    conflicts: [],
    createdAt: daysAgo(12), updatedAt: daysAgo(12)
  });

  db.subscriptions.push({
    id: "sub_ana_1", userId: uid, planTier: "Yearly Plan", billingCycle: "yearly",
    amount: 499, currency: "INR", status: "active", storageAllocatedGB: 15,
    startDate: daysAgo(90), nextBillingDate: daysAhead(275).slice(0, 10),
    autoRenew: true, paymentMethod: "UPI"
  });
}

function seedMarcus(db) {
  const uid = MARCUS_ID;
  db.memories.push(
    { id: "mem_mar_1", userId: uid, title: "Learning to cook jollof with Mama", description: "She never measured anything. 'Until your spirit says stop,' she'd say. My first pot was a disaster; my tenth was almost hers.", date: "2003-08-09", location: "Lagos, Nigeria", tags: ["family", "tradition"], media: [], createdAt: daysAgo(42) },
    { id: "mem_mar_2", userId: uid, title: "The university acceptance letter", description: "Papa read it aloud twice, then went quiet, then said 'we celebrate on Sunday' — which in our house meant goat pepper soup for the whole street.", date: "2009-02-14", location: "Lagos, Nigeria", tags: ["achievement", "family"], media: [], createdAt: daysAgo(41) },
    { id: "mem_mar_3", userId: uid, title: "First snow", description: "Landed in Toronto in January, walked out of the airport, and immediately understood every warning I'd ignored. Bought a coat the next morning.", date: "2011-01-05", location: "Toronto, Canada", tags: ["milestone", "life"], media: [], createdAt: daysAgo(40) },
    { id: "mem_mar_4", userId: uid, title: "Amara's first word", description: "'Dada.' She said it to the ceiling fan, but I'm claiming it. Called Ada at work; she cried in a meeting room.", date: "2018-09-30", location: "Toronto, Canada", tags: ["family", "milestone"], media: [], createdAt: daysAgo(39) },
    { id: "mem_mar_5", userId: uid, title: "Christmas in Lagos after ten years", description: "Took Amara home for the first time. She and her cousin communicated entirely in laughter and stolen puff-puff. Mama held my face and said 'you did well.'", date: "2022-12-25", location: "Lagos, Nigeria", tags: ["family", "tradition", "milestone"], media: [], createdAt: daysAgo(38) }
  );

  db.milestones.push(
    { id: "mil_mar_1", userId: uid, title: "Born in Lagos", description: "Third of four children, Surulere, Lagos.", date: "1991-05-19", category: "Birth", location: "Lagos, Nigeria", media: [], createdAt: daysAgo(42) },
    { id: "mil_mar_2", userId: uid, title: "Moved to Toronto", description: "One suitcase, two phone numbers written on paper, and a winter coat purchased too late.", date: "2011-01-04", category: "Life Event", location: "Toronto, Canada", media: [], createdAt: daysAgo(41) },
    { id: "mil_mar_3", userId: uid, title: "Married Adaeze", description: "Two ceremonies, four days, three hundred guests, one perfect mess of joy.", date: "2016-08-27", category: "Family", location: "Lagos, Nigeria", media: [], createdAt: daysAgo(40) },
    { id: "mil_mar_4", userId: uid, title: "Became a father", description: "Amara Chioma Okafor, 6 lb 11 oz. I rehearsed a speech; I managed one word: 'wow.'", date: "2018-09-12", category: "Family", location: "Toronto, Canada", media: [], createdAt: daysAgo(39) },
    { id: "mil_mar_5", userId: uid, title: "Promoted to Engineering Director", description: "The team threw a surprise party. Ada recorded it. I said something grateful and incoherent.", date: "2024-03-01", category: "Career", location: "Toronto, Canada", media: [], createdAt: daysAgo(38) }
  );

  db.family.push(
    { id: "fam_mar_1", userId: uid, name: "Adaeze Okafor", relationship: "Spouse", email: "adaeze@family.demo", phone: "+1 416 555 0101", dob: "1992-10-03", permission: "Contributor", role: "Contributor", profilePhoto: "", createdAt: daysAgo(28) },
    { id: "fam_mar_2", userId: uid, name: "Amara Okafor", relationship: "Daughter", email: "amara@family.demo", phone: "", dob: "2018-09-12", permission: "Viewer", role: "Viewer", profilePhoto: "", createdAt: daysAgo(28) },
    { id: "fam_mar_3", userId: uid, name: "Ngozi Okafor", relationship: "Mother", email: "ngozi@family.demo", phone: "+234 803 555 0102", dob: "1965-01-30", permission: "Viewer", role: "Viewer", profilePhoto: "", createdAt: daysAgo(28) }
  );

  db.messages.push(
    { id: "msg_mar_1", userId: uid, title: "For Amara on her wedding day", recipientName: "Amara Okafor", recipientEmail: "amara@family.demo", deliveryOption: "Exact Date", deliveryDate: "2045-09-12", deliveryTime: "10:00", deliveryDateUtc: "2045-09-12T14:00:00.000Z", type: "text", content: "Amara — your first word was 'Dada,' addressed to a ceiling fan, and I have never been prouder of anything. Whoever you marry, remember what Mama told me: love is measured in pepper soup and patience. I love you past the ceiling fan and the moon.", mediaUrl: "", mediaName: "", status: "scheduled", createdAt: daysAgo(18) },
    { id: "msg_mar_2", userId: uid, title: "Thank you, Mama", recipientName: "Ngozi Okafor", recipientEmail: "ngozi@family.demo", deliveryOption: "Exact Date", deliveryDate: daysAhead(7).slice(0, 10), deliveryTime: "17:00", deliveryDateUtc: daysAhead(7), type: "text", content: "You taught me that 'until your spirit says stop' applies to jollof and to life. I'm still cooking.", mediaUrl: "", mediaName: "", status: "scheduled", createdAt: daysAgo(18) }
  );

  db.documents.push(
    { id: "doc_mar_1", userId: uid, name: "Canadian citizenship certificate", title: "Canadian citizenship certificate", category: "Identity", size: "0.9 MB", fileSize: "0.9 MB", uploadDate: daysAgo(22).slice(0, 10), fileUrl: "", fileName: "citizenship.pdf", mimeType: "application/pdf", isEncrypted: true, notes: "The day after, I made jollof for the neighborhood." },
    { id: "doc_mar_2", userId: uid, name: "Family land records — Lagos", title: "Family land records — Lagos", category: "Legal", size: "5.1 MB", fileSize: "5.1 MB", uploadDate: daysAgo(21).slice(0, 10), fileUrl: "", fileName: "lagos-land.pdf", mimeType: "application/pdf", isEncrypted: true, notes: "Mama's plot in Surulere. Keep for Amara." }
  );

  db.chatHistory[uid] = [
    { id: "chat_mar_1", role: "user", sender: "user", text: "Help me remember what I said about my first snow.", date: daysAgo(8) },
    { id: "chat_mar_2", role: "model", sender: "companion", text: "You preserved it beautifully: landing in Toronto in January, walking out of the airport, and immediately understanding every warning you'd ignored. The coat came the next morning — proof that experience is the best teacher, at least the expensive kind. Shall we add the follow-up story about your first proper toboggan run?", date: daysAgo(8) }
  ];

  db.notifications.push(
    { id: "notif_mar_1", userId: uid, title: "Legacy Message Scheduled", message: "Scheduled a legacy text message for Amara Okafor (Exact Date).", date: daysAgo(18), read: false },
    { id: "notif_mar_2", userId: uid, title: "Document Securely Stored", message: "Stored \"Family land records — Lagos\" in your secure vault.", date: daysAgo(21), read: true },
    { id: "notif_mar_3", userId: uid, title: "Milestone Added", message: "Added new milestone to your life timeline: \"Promoted to Engineering Director\".", date: daysAgo(38), read: true }
  );

  db.subscriptions.push({
    id: "sub_mar_1", userId: uid, planTier: "Free", billingCycle: "monthly",
    amount: 0, currency: "INR", status: "active", storageAllocatedGB: 15,
    startDate: daysAgo(200), nextBillingDate: "Lifetime Free",
    autoRenew: false, paymentMethod: "Free Tier"
  });
}

function purgeDemo(db) {
  const ids = new Set([ANANYA_ID, MARCUS_ID]);
  db.users = (db.users || []).filter((u) => !ids.has(u.id) && !DEMO_EMAILS.has(String(u.email || "").toLowerCase()));
  db.memories = (db.memories || []).filter((m) => !ids.has(m.userId));
  db.milestones = (db.milestones || []).filter((m) => !ids.has(m.userId));
  db.family = (db.family || []).filter((m) => !ids.has(m.userId));
  db.messages = (db.messages || []).filter((m) => !ids.has(m.userId));
  db.documents = (db.documents || []).filter((m) => !ids.has(m.userId));
  db.stories = (db.stories || []).filter((m) => !ids.has(m.userId));
  db.notifications = (db.notifications || []).filter((m) => !ids.has(m.userId));
  db.autobiographies = (db.autobiographies || []).filter((m) => !ids.has(m.userId));
  db.subscriptions = (db.subscriptions || []).filter((m) => !ids.has(m.userId));
  if (db.chatHistory) { delete db.chatHistory[ANANYA_ID]; delete db.chatHistory[MARCUS_ID]; }
  // Also purge any stale demo docs created by earlier seed generations
  db.users = (db.users || []).filter((u) => !/^(google_demo_)/.test(String(u.id || "")));
  db.memories = (db.memories || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.milestones = (db.milestones || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.family = (db.family || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.messages = (db.messages || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.documents = (db.documents || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.stories = (db.stories || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.notifications = (db.notifications || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.autobiographies = (db.autobiographies || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
  db.subscriptions = (db.subscriptions || []).filter((m) => !/^(google_demo_)/.test(String(m.userId || "")));
}

function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

  // Initialize collections that routes read but that older db files may lack
  db.chatHistory = db.chatHistory || {};
  db.subscriptions = db.subscriptions || [];
  db.familyGroups = db.familyGroups || [];
  db.autobiographies = db.autobiographies || [];

  purgeDemo(db);

  const now = new Date().toISOString();
  db.users.push(
    buildUser(ANANYA_ID, "Ananya Sharma", "ananya.demo@lifebook.dev", "1994-08-30", "+91 98450 00000",
      "Engineer, mother, keeper of her grandmother's recipe notebook. Grew up in Kochi and Chennai, building a life in Bengaluru.", now),
    buildUser(MARCUS_ID, "Marcus Okafor", "marcus.demo@lifebook.dev", "1991-05-19", "+1 416 555 0100",
      "Lagos-born, Toronto-based engineering director. Cooks jollof by spirit, not measurement. Father of Amara.", now)
  );

  seedAnanya(db);
  seedMarcus(db);

  // Family workspace group used by the family-workspace routes
  if (!db.familyGroups.some((g) => g.id === "famgrp_demo")) {
    db.familyGroups.push({
      id: "famgrp_demo",
      familyAdminId: ANANYA_ID,
      familyName: "The Menon–Sharma Family",
      totalStorageGB: 100,
      usedStorageGB: 14.5,
      createdAt: now,
      members: [
        { userId: ANANYA_ID, name: "Ananya Sharma", role: "admin" },
        { userId: MARCUS_ID, name: "Marcus Okafor", role: "contributor" }
      ],
      albums: [
        { id: "album_1", name: "Meera's First Year", memoryCount: 24, coverColor: "#315C4A" },
        { id: "album_2", name: "Sunday Lunches", memoryCount: 11, coverColor: "#C9A66B" }
      ],
      activities: [
        { id: "act_1", familyId: "famgrp_demo", memberName: "Marcus Okafor", action: "uploaded 3 photos to \"Sunday Lunches\"", date: daysAgo(2) },
        { id: "act_2", familyId: "famgrp_demo", memberName: "Ananya Sharma", action: "added a memory: \"Sunday lunches at Paati's\"", date: daysAgo(5) }
      ],
      invitations: []
    });
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

  // Self-check: the demo data must be complete and consistent
  const chk = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const assert = (cond, msg) => { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } };
  assert(chk.users.some((u) => u.id === ANANYA_ID), "Ananya exists");
  assert(chk.users.some((u) => u.id === MARCUS_ID), "Marcus exists");
  for (const col of ["memories", "milestones", "family", "messages", "documents", "stories", "notifications", "autobiographies", "subscriptions"]) {
    assert(chk[col].some((x) => x.userId === ANANYA_ID), `Ananya has ${col}`);
  }
  for (const col of ["memories", "milestones", "family", "messages", "documents", "notifications", "subscriptions"]) {
    assert(chk[col].some((x) => x.userId === MARCUS_ID), `Marcus has ${col}`);
  }
  assert(chk.chatHistory[ANANYA_ID]?.length > 0, "Ananya has chat history");
  assert(chk.chatHistory[MARCUS_ID]?.length > 0, "Marcus has chat history");
  assert(chk.familyGroups.some((g) => g.id === "famgrp_demo"), "family group exists");
  // Ownership integrity: no demo record points at a nonexistent user
  const userIds = new Set(chk.users.map((u) => u.id));
  for (const col of ["memories", "milestones", "family", "messages", "documents", "stories", "notifications", "autobiographies", "subscriptions"]) {
    assert(chk[col].every((x) => userIds.has(x.userId)), `no orphaned records in ${col}`);
  }
  console.log("Demo data seeded:");
  console.log("  ananya.demo@lifebook.dev / " + DEMO_PASSWORD);
  console.log("  marcus.demo@lifebook.dev / " + DEMO_PASSWORD);
}

main();
