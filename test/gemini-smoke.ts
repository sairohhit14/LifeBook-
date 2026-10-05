/**
 * Live smoke test for the Google Gemini integration — manual, NOT part of npm
 * test (it makes real API calls and costs a fraction of a cent).
 *
 * Run: npx tsx test/gemini-smoke.ts
 *
 * Exercises exactly what server.ts does in production:
 *   - createGeminiClient (server/gemini-adapter.ts) with GEMINI_API_KEY
 *   - the model fallback chain
 *     gemini-3.5-flash -> gemini-3.1-flash-lite -> gemini-2.5-flash
 *   - plain text call (companion chat path) + structured responseSchema call
 *     (biography/translation path) — the two wire formats the app depends on
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createGeminiClient } from "../server/gemini-adapter";

dotenv.config();

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey.startsWith("AIza") || apiKey.length < 20) {
  console.error("FAIL: GEMINI_API_KEY missing or placeholder in .env — nothing to smoke-test.");
  console.error("      Get one at https://aistudio.google.com/apikey (looks like AIza...).");
  process.exit(1);
}
console.log(`Key loaded from ${fs.existsSync(path.join(process.cwd(), ".env")) ? ".env" : "environment"} (length ${apiKey.length}).`);

const client = createGeminiClient(apiKey);

async function withFallback(params: any) {
  let lastError: any;
  for (const model of MODELS) {
    try {
      const res = await client.models.generateContent({ ...params, model });
      console.log(`  (model: ${model})`);
      return res;
    } catch (err: any) {
      console.warn(`  ${model} failed: ${String(err.message).slice(0, 200)} — trying fallback...`);
      lastError = err;
    }
  }
  throw lastError;
}

let failed = false;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : " — " + detail}`);
  if (!ok) failed = true;
}

// 1. Plain text (companion-chat path)
const t0 = Date.now();
const plain = await withFallback({
  contents: "Reply with exactly one word: ping",
  config: { systemInstruction: "You are terse." },
});
check("plain call returns non-empty text", !!plain.text.trim(), JSON.stringify(plain).slice(0, 120));
console.log(`  reply: ${plain.text.trim().slice(0, 60)} | latency: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2. Structured output (biography-generation path): the UPPERCASE schema must
//    be accepted natively by Gemini and come back as parseable JSON.
const structured = await withFallback({
  contents: "Give me a two-item grocery list.",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: { items: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["items"],
    },
  },
});
let parsed: any = null;
try { parsed = JSON.parse(structured.text); } catch { /* surfaced below */ }
check("structured call returns parseable JSON", !!parsed, structured.text.slice(0, 120));
check("schema survived translation", Array.isArray(parsed?.items) && parsed.items.every((s: any) => typeof s === "string"), JSON.stringify(parsed));

if (failed) {
  console.error("GEMINI SMOKE TEST FAILED");
  process.exit(1);
}
console.log("GEMINI SMOKE TEST PASSED");
