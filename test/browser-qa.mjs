/**
 * LifeBook browser QA (no dependencies — drives headless Chrome via CDP).
 *
 * Covers the UI transformation acceptance criteria:
 *   - Desktop (1440x900) + mobile (390x844) rendering of landing + authed app
 *   - Console errors / uncaught exceptions / failed asset requests
 *   - Horizontal overflow (excluding decorative, clipped, aria-hidden elements)
 *   - Mobile bottom nav presence, tap targets, and navigation
 *   - Sidebar + drawer navigation on each tab
 *   - 3D hero scene present on desktop, hidden on mobile
 *   - prefers-reduced-motion disables ambient animation
 *   - Screenshots saved to test/screenshots/
 *
 * Usage: node test/browser-qa.mjs   (expects the app running on :3000)
 */
import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const APP = "http://localhost:3000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS = join(process.cwd(), "test", "screenshots");

const findings = [];
const critical = (check, detail) => findings.push({ check, detail, level: "CRITICAL" });
const warn = (check, detail) => findings.push({ check, detail, level: "warn" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CDP plumbing
let ws, msgId = 0;
const pending = new Map();
const sessionHandlers = new Map(); // sessionId -> Set(handler)

function onMessage(raw) {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method && msg.sessionId) {
    const hs = sessionHandlers.get(msg.sessionId);
    if (hs) for (const h of hs) h(msg.method, msg.params);
  }
}

function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await (await fetch("http://127.0.0.1:9222/json/version")).json();
      ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = (e) => onMessage(e.data);
      return;
    } catch { await sleep(250); }
  }
  throw new Error("Could not connect to Chrome DevTools on :9222");
}

async function newPage(width, height, mobile) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const handlers = new Set();
  sessionHandlers.set(sessionId, handlers);

  const page = {
    sessionId,
    send: (m, p) => send(m, p, sessionId),
    on: (h) => handlers.add(h),
    consoleErrors: [],
    pageErrors: [],
    badAssets: [],
  };
  page.on((method, p) => {
    if (method === "Runtime.consoleAPICalled" && p.type === "error")
      page.consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    if (method === "Runtime.exceptionThrown")
      page.pageErrors.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "").slice(0, 200));
    if (method === "Log.entryAdded" && p.entry.level === "error" && !p.entry.text.includes("Failed to load resource"))
      page.consoleErrors.push("log: " + p.entry.text.slice(0, 200));
    if (method === "Network.responseReceived") {
      const { status, url } = p.response;
      if (status >= 400 && !url.includes("/api/") && !url.startsWith("data:"))
        page.badAssets.push(`${status} ${url.replace(APP, "")}`);
    }
  });

  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Log.enable");
  await page.send("Network.enable");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: mobile ? 2 : 1, mobile,
  });
  return page;
}

async function evalJs(page, expr) {
  const r = await page.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails)
    throw new Error("page eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 200));
  return r.result.value;
}

async function goto(page, url, settleMs = 900) {
  await page.send("Page.navigate", { url });
  await sleep(settleMs);
  await evalJs(page, "document.readyState");
  await sleep(settleMs);
}

async function shot(page, name) {
  const { data } = await page.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, name + ".png"), Buffer.from(data, "base64"));
}

// ------------------------------------------------------------------- probes
const OVERFLOW_PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.closest('.overflow-hidden, [class*="overflow-hidden"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    // Right-edge overflow is the real mobile killer. Left-edge negatives are
    // standard for off-canvas drawers / fixed elements — ignore those.
    if (r.right > vw + 2) {
      bad.push(el.tagName + "." + String(el.className).split(" ").slice(0,3).join("."));
      if (bad.length >= 5) break;
    }
  }
  return bad;
})()`;

async function waitFor(page, expr, timeoutMs = 15000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await evalJs(page, expr);
    if (last) return last;
    await sleep(300);
  }
  return last;
}

const PAGE_STATE = `(() => ({
  rootChildren: document.getElementById("root")?.children.length ?? 0,
  hScroll: document.scrollingElement.scrollWidth > document.documentElement.clientWidth + 1,
  focusVisibleRule: [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => r.selectorText && r.selectorText.includes(":focus-visible")); }
    catch { return false; }
  }),
}))()`;

function drain(page, label) {
  if (page.pageErrors.length) critical(`${label}: uncaught page exceptions`, page.pageErrors.slice(0, 3));
  if (page.consoleErrors.length) critical(`${label}: console errors`, page.consoleErrors.slice(0, 3));
  if (page.badAssets.length) critical(`${label}: failed asset requests`, page.badAssets.slice(0, 3));
}

async function closePage(p) {
  try {
    const info = await send("Target.getTargetInfo", { sessionId: p.sessionId });
    await send("Target.closeTarget", { targetId: info.targetInfo.targetId });
  } catch { /* some Chrome builds refuse; pages are harmless */ }
  sessionHandlers.delete(p.sessionId);
}

// §61: modal must open, fit the viewport (especially on mobile), and close cleanly.
async function probeMemoryModal(p, tag) {
  const navOk = await evalJs(p, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === "Memories");
    if (!b) return false; b.click(); return true;
  })()`);
  if (!navOk) { critical(`${tag}: modal probe`, "could not navigate to Memories"); return; }
  await sleep(1100);
  const opened = await evalJs(p, `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /First Memory/.test(b.textContent));
    if (!btn) return false; btn.click(); return true;
  })()`);
  if (!opened) { critical(`${tag}: memory modal`, "create-memory button not found on empty vault"); return; }
  await sleep(600);
  const fit = await evalJs(p, `(() => {
    const form = document.querySelector("form");
    if (!form) return { open: false };
    const card = form.closest("[class*=rounded]") || form;
    const r = card.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    return { open: true, left: Math.round(r.left), right: Math.round(r.right), vw, title: document.querySelector("form")?.closest("[class*=rounded]")?.querySelector("h3")?.textContent ?? null };
  })()`);
  if (!fit.open) { critical(`${tag}: memory modal`, "modal form did not open"); return; }
  if (fit.left < 0 || fit.right > fit.vw)
    critical(`${tag}: memory modal`, `overflows viewport (left=${fit.left}, right=${fit.right}, vw=${fit.vw})`);
  const closed = await evalJs(p, `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Cancel");
    if (!btn) return false; btn.click(); return true;
  })()`);
  await sleep(400);
  const formGone = await evalJs(p, `!document.querySelector("form")`);
  if (!closed || !formGone) critical(`${tag}: memory modal`, "modal did not close via Cancel");
}

// --------------------------------------------------------------------- main
async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const userDataDir = join(tmpdir(), "lifebook-qa-" + Date.now());
  const chrome = spawn(CHROME, [
    "--headless=new", "--remote-debugging-port=9222", "--no-first-run",
    "--no-default-browser-check", "--disable-gpu", `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  try {
    await connect();

    // Seed a QA user through the real API
    const stamp = Date.now();
    const reg = await fetch(`${APP}/api/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Bot", email: `qa.bot.${stamp}@lifebook.test`, password: "qa-password-123", dob: "1970-01-01" }),
    });
    if (!reg.ok) throw new Error("could not seed QA user: " + reg.status);
    const userId = (await reg.json()).id;

    const TABS = [
      ["Timeline", "timeline"], ["Memories", "memories"], ["Family", "family"],
      ["Vault", "vault"], ["Messages", "messages"], ["Stories", "stories"],
      ["AI Companion", "companion"], ["Legacy Film", "video"], ["Autobiography", "autobiography"], ["Settings", "settings"],
    ];

    // Viewport matrix: desktop (≥1024, sidebar pinned), mobile (<768, bottom nav),
    // tablet (768–1023, md: boundary — no bottom nav, drawer via hamburger).
    // QA_VIEWPORTS="1920x1080:desktop,768x1024:tablet" extends the matrix.
    const extra = (process.env.QA_VIEWPORTS || "").split(",").map(s => s.trim()).filter(Boolean).map(s => {
      const [w, h] = s.split(/[x:]/);
      const width = parseInt(w);
      return [width, parseInt(h), width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "mobile"];
    });
    // §76 matrix: 1920/1440/1280/1024 desktop · 768 tablet boundary · 480/390/360 mobile
    const VIEWPORTS = [
      [1920, 1080, "desktop"], [1440, 900, "desktop"], [1280, 800, "desktop"], [1024, 768, "desktop"],
      [768, 1024, "tablet"],
      [480, 800, "mobile"], [390, 844, "mobile"], [360, 740, "mobile"],
      ...extra,
    ];

    // ============================== LANDING (public) ==============================
    for (const [w, h, mode] of VIEWPORTS) {
      const tag = `${mode}-${w}`;
      const mobile = mode !== "desktop";
      const p = await newPage(w, h, mobile);
      await goto(p, APP + "/");
      // Dev mode compiles the app on first hit — poll for render instead of fixed sleep
      const rootChildren = await waitFor(p, `document.getElementById("root")?.children.length > 0`);
      if (!rootChildren) critical(`landing/${tag}`, "React root rendered nothing after 15s");
      const st = await evalJs(p, PAGE_STATE);
      if (st.hScroll) critical(`landing/${tag}`, "page scrolls horizontally");
      const overflow = await evalJs(p, OVERFLOW_PROBE);
      if (overflow.length) critical(`landing/${tag}: overflowing elements`, overflow);
      if (!st.focusVisibleRule) warn(`landing/${tag}`, "no :focus-visible style found");
      drain(p, `landing/${tag}`);
      await shot(p, `landing-${tag}`);
      await closePage(p);
    }

    // ============================== AUTHED APP ====================================
    for (const [w, h, mode] of VIEWPORTS) {
      const tag = `${mode}-${w}`;
      const mobile = mode === "mobile";
      const p = await newPage(w, h, mobile);
      await goto(p, APP + "/");
      await evalJs(p, `localStorage.setItem("lifebook_userId", ${JSON.stringify(userId)}); "ok"`);
      await goto(p, APP + "/");

      const shell = await evalJs(p, `(() => ({
        sidebar: !!document.getElementById("app-sidebar"),
        sidebarVisible: (() => { const s = document.getElementById("app-sidebar"); return s ? getComputedStyle(s).display !== "none" && s.getBoundingClientRect().left > -10 : false; })(),
        bottomNav: !!document.getElementById("app-mobile-nav"),
        bottomNavVisible: (() => { const n = document.getElementById("app-mobile-nav"); return n ? getComputedStyle(n).display !== "none" : false; })(),
        hero: !!document.getElementById("dashboard-hero"),
        gauge: !!document.getElementById("completion-gauge"),
        bookSceneVisible: (() => { const b = document.querySelector(".book-scene"); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).display !== "none"; })(),
        greeting: document.querySelector("#dashboard-hero h2")?.textContent?.slice(0, 60) ?? null,
      }))()`);
      if (!shell.hero) critical(`app/${tag}`, "dashboard hero missing");
      if (!shell.gauge) critical(`app/${tag}`, "completion gauge missing");
      if (!shell.bottomNav) critical(`app/${tag}`, "mobile bottom nav missing");
      if (mode === "mobile" && !shell.bottomNavVisible) critical(`app/${tag}`, "bottom nav hidden on mobile");
      if (mode !== "mobile" && shell.bottomNavVisible) critical(`app/${tag}`, "bottom nav visible outside mobile");
      if (mode === "desktop" && !shell.sidebarVisible) critical(`app/${tag}`, "sidebar not visible on desktop");
      if (mode !== "desktop" && shell.sidebarVisible) critical(`app/${tag}`, "sidebar visible off desktop (off-canvas expected)");
      if (mode !== "mobile" && !shell.bookSceneVisible) warn(`app/${tag}`, "3D book scene not visible on wide hero");
      if (mode === "mobile" && shell.bookSceneVisible) warn(`app/${tag}`, "3D book scene visible on mobile (expected hidden)");
      if (shell.greeting && /Data|sync/i.test(shell.greeting)) warn(`app/${tag}`, "greeting is not human: " + shell.greeting);

      const st = await evalJs(p, PAGE_STATE);
      if (st.hScroll) critical(`app/${tag}`, "page scrolls horizontally");
      const overflow = await evalJs(p, OVERFLOW_PROBE);
      if (overflow.length) critical(`app/${tag}: overflowing elements`, overflow);
      drain(p, `app/${tag} dashboard`);
      await shot(p, `dashboard-${tag}`);

      // Navigate tabs
      if (mode === "desktop") {
        for (const [label] of TABS) {
          const ok = await evalJs(p, `(() => {
            const btn = [...document.querySelectorAll('#app-sidebar button')].find(b => b.textContent.trim() === ${JSON.stringify(label)});
            if (!btn) return false; btn.click(); return true;
          })()`);
          if (!ok) { critical(`app/${mode}: tab "${label}"`, "button not found in sidebar"); continue; }
          await sleep(900); // generous: CI/dev machines are often under load
          const errsBefore = p.pageErrors.length + p.consoleErrors.length;
          const rendered = await evalJs(p, `document.getElementById("app-main-canvas").children.length > 0`);
          if (!rendered) critical(`app/${mode}: tab "${label}"`, "main canvas empty after click");
          if (p.pageErrors.length + p.consoleErrors.length > errsBefore)
            critical(`app/${mode}: tab "${label}"`, [...p.pageErrors, ...p.consoleErrors].slice(-2));
        }
        await shot(p, `tab-settings-${tag}`);
        await probeMemoryModal(p, `app/${tag}`);
      } else if (mode === "tablet") {
        // Tablet: no bottom nav — hamburger must open the drawer
        await evalJs(p, `document.querySelector('button[aria-label="Open menu"]')?.click()`);
        await sleep(500);
        const drawerOpen = await evalJs(p, `(() => { const s = document.getElementById("app-sidebar"); return s && s.getBoundingClientRect().left >= 0; })()`);
        if (!drawerOpen) critical("app/tablet: drawer", "hamburger did not open the sidebar drawer");
        const vaultOk = await evalJs(p, `(() => {
          const btn = [...document.querySelectorAll('#app-sidebar button')].find(b => b.textContent.trim() === "Vault");
          if (!btn) return false; btn.click(); return true;
        })()`);
        if (!vaultOk) critical("app/tablet: drawer nav", "Vault button not found in drawer");
        await sleep(500);
        const drawerClosed = await evalJs(p, `(() => { const s = document.getElementById("app-sidebar"); return !s || s.getBoundingClientRect().left < 0; })()`);
        if (!drawerClosed) critical("app/tablet: drawer", "drawer did not close after selecting a tab");
        await shot(p, `tab-vault-${tag}`);
      } else {
        // Bottom nav: tap each, verify aria-current moves
        for (const label of ["Home", "Timeline", "Family"]) {
          const moved = await evalJs(p, `(() => {
            const btn = [...document.querySelectorAll('#app-mobile-nav button')].find(b => b.textContent.trim() === ${JSON.stringify(label)});
            if (!btn) return false; btn.click(); return true;
          })()`);
          if (!moved) { critical(`app/mobile: bottom nav "${label}"`, "button not found"); continue; }
          await sleep(500);
        }
        const current = await evalJs(p, `document.querySelector('#app-mobile-nav [aria-current="page"]')?.textContent?.trim() ?? null`);
        if (current !== "Family") critical("app/mobile: bottom nav", "aria-current did not move to Family (got " + current + ")");
        // Touch targets
        const smallTargets = await evalJs(p, `[...document.querySelectorAll('#app-mobile-nav button')].filter(b => b.getBoundingClientRect().height < 40).length`);
        if (smallTargets > 0) critical("app/mobile: bottom nav", smallTargets + " tap targets under 40px tall");
        // "More" opens the drawer
        await evalJs(p, `[...document.querySelectorAll('#app-mobile-nav button')].find(b => b.getAttribute('aria-label') === 'More sections')?.click()`);
        await sleep(500);
        const drawerOpen = await evalJs(p, `(() => { const s = document.getElementById("app-sidebar"); return s && s.getBoundingClientRect().left >= 0; })()`);
        if (!drawerOpen) critical("app/mobile: drawer", "More button did not open the sidebar drawer");
        // Drawer: navigate to Vault
        const vaultOk = await evalJs(p, `(() => {
          const btn = [...document.querySelectorAll('#app-sidebar button')].find(b => b.textContent.trim() === "Vault");
          if (!btn) return false; btn.click(); return true;
        })()`);
        if (!vaultOk) critical("app/mobile: drawer nav", "Vault button not found in drawer");
        await sleep(500);
        const drawerClosed = await evalJs(p, `(() => { const s = document.getElementById("app-sidebar"); return !s || s.getBoundingClientRect().left < 0; })()`);
        if (!drawerClosed) critical("app/mobile: drawer", "drawer did not close after selecting a tab");
        await shot(p, `tab-vault-${tag}`);
      }
      if (mode !== "tablet") await probeMemoryModal(p, `app/${tag}`);
      await closePage(p);
    }

    // ============================== REDUCED MOTION ================================
    {
      const p = await newPage(1440, 900, false);
      await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await goto(p, APP + "/");
      await evalJs(p, `localStorage.setItem("lifebook_userId", ${JSON.stringify(userId)}); "ok"`);
      await goto(p, APP + "/");
      const rm = await evalJs(p, `(() => {
        const probe = document.querySelector(".animate-ambient-float") || document.querySelector(".animate-rise-in");
        if (!probe) return "no-animated-element";
        return getComputedStyle(probe).animationName;
      })()`);
      if (rm !== "none" && rm !== "no-animated-element")
        critical("reduced-motion", `animation still active under prefers-reduced-motion (${rm})`);
      drain(p, "reduced-motion");
      await closePage(p);
    }

    // ---------------------------------------------------------------- summary
    console.log("\n=== BROWSER QA SUMMARY ===");
    if (findings.length === 0) {
      console.log("ALL CHECKS PASSED — no console errors, no overflow, navigation works, reduced motion honored.");
    } else {
      for (const f of findings)
        console.log(`[${f.level}] ${f.check}${f.detail ? " — " + (Array.isArray(f.detail) ? "\n    · " + f.detail.join("\n    · ") : " " + f.detail) : ""}`);
      const crit = findings.filter((f) => f.level === "CRITICAL").length;
      console.log(`\n${crit} critical, ${findings.length - crit} warnings`);
      process.exitCode = crit > 0 ? 1 : 0;
    }
  } finally {
    chrome.kill();
    try { ws.close(); } catch {}
  }
}

main().catch((e) => { console.error("QA DRIVER FAILED:", e.message); process.exit(1); });
