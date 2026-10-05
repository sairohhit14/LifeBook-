/**
 * End-to-end check for the Memory Vault photo flow (manual, needs dev server on :3000).
 * Drives headless Chrome (CDP) — the real user flow:
 * register → open Memory Vault → upload photo → save memory → verify grid <img>
 * renders → open viewer → verify image + "Back to Grid" → back closes the viewer
 * → same assertions on a mobile viewport (390x844).
 * Assert-based, no framework. Run: node test/memory-photo-flow-check.mjs
 * ponytail: throwaway user is registered each run; delete it from db.json afterwards.
 */
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const APP = "http://localhost:3000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
};

let ws, msgId = 0;
const pending = new Map();
const sessionHandlers = new Map();
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
    } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  throw new Error("Could not connect to Chrome DevTools on :9222");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const userDataDir = mkdtempSync(join(tmpdir(), "lb-repro-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--remote-debugging-port=9222", "--no-first-run",
    "--no-default-browser-check", "--disable-gpu", `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  try {
    await connect();
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const handlers = new Set();
    sessionHandlers.set(sessionId, handlers);
    const page = { sessionId, send: (m, p) => send(m, p, sessionId), on: (h) => handlers.add(h) };
    const consoleErrors = [];
    const failedRequests = [];
    page.on((method, params) => {
      if (method === "Runtime.consoleAPICalled" && params.type === "error")
        consoleErrors.push(params.args?.map(a => a.value || a.description || "").join(" ").slice(0, 300));
      if (method === "Runtime.exceptionThrown")
        consoleErrors.push("EXCEPTION: " + (params.exceptionDetails?.exception?.description || "").slice(0, 300));
      if (method === "Network.loadingFailed") failedRequests.push(params.errorText + " " + (params.blockedReason || ""));
    });
    await page.send("Runtime.enable");
    await page.send("Network.enable");
    await page.send("Page.enable");
    const evaluate = async (expr) => {
      const r = await page.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
      return r.result.value;
    };

    await page.send("Page.navigate", { url: APP });
    await sleep(2500);

    // --- Auth: register a throwaway user through the real UI's API ---
    const email = `repro_${Date.now()}@example.com`;
    await evaluate(`(async () => {
      localStorage.clear();
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Repro Tester', email: '${email}', password: 'Testpass1', dob: '1990-01-01' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'register failed');
      localStorage.setItem('lifebook_userId', data.id);
      return data.id.slice(0, 12);
    })()`);

    await page.send("Page.navigate", { url: APP });
    await sleep(3000);

    // Navigate like a real user: click "Memories" in the sidebar (no URL routing in this app)
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('nav button')].find(b => b.innerText.trim().startsWith('Memories'));
      if (!btn) throw new Error('Memories nav button not found');
      btn.click();
    })()`);
    await sleep(1500);

    // Confirm we're on the Memory Vault
    const hasVault = await evaluate(`!!document.querySelector('#memory-vault-root')`);
    ok("Memory Vault opens", hasVault);
    if (!hasVault) {
      const txt = await evaluate(`document.body.innerText.slice(0,300)`);
      ok("vault visible", false, txt);
      return;
    }

    // --- Upload a photo through the real UI: DataTransfer onto the hidden file input ---
    // 1x1 red PNG (base64), same as the server test suite uses.
    const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const dataUrl = "data:image/png;base64," + pngB64;
    const uploadInfo = await evaluate(`(async () => {
      // Open the form modal first — file inputs only exist inside it
      const addBtn = document.querySelector('#add-memory-btn');
      if (!addBtn) return { error: 'add-memory button not found' };
      addBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const photoInput = [...document.querySelectorAll('#memory-vault-root input[type=file]')].find(i => (i.accept||'').startsWith('image'));
      if (!photoInput) return { error: 'no photo input after opening form' };
      const res = await fetch('${dataUrl}');
      const blob = await res.blob();
      const file = new File([blob], 'repro-test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      photoInput.files = dt.files;
      photoInput.dispatchEvent(new Event('change', { bubbles: true }));
      // wait for upload round-trip (upload endpoint returns URL)
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        const imgs = [...document.querySelectorAll('#memory-vault-root form img')];
        if (imgs.length > 0) return { previewCount: imgs.length, previewSrc: imgs[0].src.slice(0, 120) };
      }
      return { error: 'no preview <img> appeared in form within 10s' };
    })()`);
    ok("Photo upload → preview appears in form", !uploadInfo.error, uploadInfo.error || uploadInfo.previewSrc);

    if (uploadInfo.error) return;

    // Fill required fields and save
    const saved = await evaluate(`(async () => {
      const root = document.querySelector('#memory-vault-root');
      const setVal = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const text = [...root.querySelectorAll('input[type=text],textarea')];
      const title = text.find(i => (i.placeholder||'').includes('Childhood summers'));
      if (title) setVal(title, 'Repro memory ' + Date.now());
      const desc = root.querySelector('textarea');
      if (desc) setVal(desc, 'Diagnostic memory with a photo attachment.');
      const submit = [...root.querySelectorAll('button[type=submit]')].find(b => b.innerText.toLowerCase().includes('save'));
      if (!submit) return { error: 'no save button' };
      submit.click();
      await new Promise(r => setTimeout(r, 1500));
      return { modalGone: !root.querySelector('form textarea') };
    })()`);
    ok("Memory saved (form closed)", !saved.error && saved.modalGone, saved.error || "");

    // Grid should show the photo capsule <img>
    await sleep(1000);
    const gridImg = await evaluate(`(() => {
      const imgs = [...document.querySelectorAll('#memories-grid img')];
      if (imgs.length === 0) return { count: 0 };
      return { count: imgs.length, src: imgs[0].src.slice(0, 120), complete: imgs[0].complete, nw: imgs[0].naturalWidth };
    })()`);
    ok("Photo shows in memories grid", gridImg.count > 0, gridImg.count ? `src=${gridImg.src} naturalWidth=${gridImg.nw}` : "no <img> in grid");

    // --- Open the viewer (click the capsule) — try programmatic first, then a real CDP mouse click ---
    await evaluate(`(() => {
      const card = document.querySelector('#memories-grid > div');
      window.__cardRect = card ? card.getBoundingClientRect().toJSON() : null;
      card?.click();
    })()`);
    await sleep(1200);
    let diag = await evaluate(`(() => ({
      modals: [...document.querySelectorAll('.fixed.inset-0')].map(d => (d.innerText||'').slice(0,80).replace(/\\n/g,' | ')),
      bodyHasViewerText: document.body.innerText.includes('Memory Capsule details'),
    }))()`);
    console.log('  [diag after programmatic click]', JSON.stringify(diag));
    if (!diag.bodyHasViewerText) {
      // Real input-path click at the card's center (tests hit-testing/overlays)
      const rect = await evaluate(`window.__cardRect`);
      if (rect) {
        const cx = Math.round(rect.left + rect.width/2), cy = Math.round(rect.top + rect.height/2);
        await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
        await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 });
        await sleep(1200);
        diag = await evaluate(`(() => ({
          modals: [...document.querySelectorAll('.fixed.inset-0')].map(d => (d.innerText||'').slice(0,80).replace(/\\n/g,' | ')),
          bodyHasViewerText: document.body.innerText.includes('Memory Capsule details'),
        }))()`);
        console.log('  [diag after real mouse click]', JSON.stringify(diag));
      }
    }
    const viewer = await evaluate(`(() => {
      const viewer = [...document.querySelectorAll('.fixed.inset-0')].find(d => /memory capsule details/i.test(d.innerText || ""));
      if (!viewer) return { open: false };
      const mainImg = [...viewer.querySelectorAll('img')].find(i => (i.src||'').includes('/uploads/') || (i.src||'').startsWith('http'));
      return { open: true, hasMainImg: !!mainImg, imgComplete: mainImg?.complete, imgNaturalWidth: mainImg?.naturalWidth,
               hasBackBtn: [...viewer.querySelectorAll('button')].some(b => /back to grid/i.test(b.innerText)) };
    })()`);
    ok("Viewer opens with photo", viewer.open && viewer.hasMainImg,
      viewer.open ? (viewer.hasMainImg ? `loaded=${viewer.imgComplete && viewer.imgNaturalWidth > 0}` : "no media <img> in viewer") : "viewer did not open");
    ok("Back button visible in viewer", viewer.open && viewer.hasBackBtn, viewer.open ? "" : "viewer did not open");

    // Click Back and verify modal closes
    await evaluate(`(() => {
      const viewer = [...document.querySelectorAll('.fixed.inset-0')].find(d => /memory capsule details/i.test(d.innerText || ""));
      const back = [...(viewer?.querySelectorAll('button')||[])].find(b => /back to grid/i.test(b.innerText));
      back?.click();
    })()`);
    await sleep(800);
    const backWorks = await evaluate(`!(() => [...document.querySelectorAll('.fixed.inset-0')].find(d => /memory capsule details/i.test(d.innerText || "")))()`);
    ok("Back to Grid closes viewer", backWorks);

    ok("No console errors during flow", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
    const mediaFailures = failedRequests.filter(t => !t.includes("ERR_ABORTED"));
    ok("No failed network requests", mediaFailures.length === 0, mediaFailures.slice(0, 3).join(" | "));

    // Screenshot for the record
    const shot = await page.send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("fs");
    writeFileSync(join(process.cwd(), "test", "screenshots", "repro-memory-photo.png"), Buffer.from(shot.data, "base64"));

    // ---- Mobile viewport pass: is the back/close control reachable on a phone? ----
    const { Emulation } = { Emulation: null };
    await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(800);
    // Reopen the viewer
    await evaluate(`document.querySelector('#memories-grid > div')?.click()`);
    await sleep(1200);
    const mobile = await evaluate(`(() => {
      const viewer = [...document.querySelectorAll('.fixed.inset-0')].find(d => /memory capsule details/i.test(d.innerText || ""));
      if (!viewer) return { open: false };
      const back = [...viewer.querySelectorAll('button')].find(b => /back to grid/i.test(b.innerText));
      const x = [...viewer.querySelectorAll('button')].find(b => (b.title||'').toLowerCase().includes('close'));
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
      const backBtnRect = r(back);
      const xRect = r(x);
      const onScreen = (rc) => rc && rc.top >= 0 && rc.left >= 0 && rc.bottom <= window.innerHeight && rc.right <= window.innerWidth && rc.w > 0;
      return { open: true, backVisible: onScreen(backBtnRect), backRect: backBtnRect, xVisible: onScreen(xRect), xRect, viewportH: window.innerHeight };
    })()`);
    ok("Mobile: viewer opens", mobile.open);
    ok("Mobile: close X on screen", !!mobile.xVisible, mobile.xRect ? JSON.stringify(mobile.xRect) : "X not found");
    ok("Mobile: Back button on screen without scrolling", !!mobile.backVisible, mobile.backRect ? JSON.stringify(mobile.backRect) : "needs scrolling or hidden");

    const failedCount = results.filter(r => !r.pass).length;
    console.log(failedCount === 0 ? "\nALL CHECKS PASSED" : `\n${failedCount} CHECK(S) FAILED`);
    process.exitCode = failedCount === 0 ? 0 : 1;
  } finally {
    try { chrome.kill(); } catch {}
    try { ws.close(); } catch {}
  }
}
main().catch(e => { console.error("REPRO SCRIPT ERROR:", e.message); process.exit(1); });
