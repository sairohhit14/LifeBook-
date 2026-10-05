/**
 * Self-check for server/gemini-adapter.ts (assert-based, no framework).
 * Run: npx tsx test/gemini-adapter-check.ts
 *
 * Verifies the outbound Gemini request shape and response unwrapping with no
 * network (global fetch is stubbed):
 *   - Type constants are Gemini's own schema vocabulary (sent verbatim)
 *   - prompt string -> contents[{role:user,parts:[{text}]}]
 *   - {parts} vision object -> inlineData passed through untouched
 *   - systemInstruction hoisted to its own top-level field
 *   - responseMimeType / responseSchema / maxOutputTokens -> generationConfig
 *   - multi-turn contents array keeps user/model roles in order
 *   - text unwrapped from candidates[0].content.parts
 *   - safety block throws (so callers hit their fallback, not an empty book)
 *   - HTTP error surfaces as thrown Error with status
 */
import assert from "assert";

process.env.GEMINI_BASE_URL = "http://127.0.0.1:0"; // unreachable; never contacted
const mod: any = await import("../server/gemini-adapter");
const { Type, createGeminiClient } = mod;

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

// Capture outgoing requests by stubbing global fetch.
let captured: any = null;
let canned: any = {
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => ({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }),
};
(globalThis as any).fetch = async (url: any, init: any) => {
  captured = { url, init };
  return canned;
};
const client = createGeminiClient("test-gemini-key");

const lastBody = () => JSON.parse(captured.init.body);

await check("Type constants are Gemini's native schema vocabulary", () => {
  assert.strictEqual(Type.STRING, "STRING");
  assert.strictEqual(Type.OBJECT, "OBJECT");
  assert.strictEqual(Type.ARRAY, "ARRAY");
  assert.strictEqual(Type.NUMBER, "NUMBER");
  assert.strictEqual(Type.INTEGER, "INTEGER");
  assert.strictEqual(Type.BOOLEAN, "BOOLEAN");
});

await check("model is addressed in the URL path and key in x-goog-api-key header", async () => {
  await client.models.generateContent({ contents: "hi", model: "gemini-3.5-flash" });
  assert.ok(captured.url.endsWith("/v1beta/models/gemini-3.5-flash:generateContent"), captured.url);
  assert.strictEqual(captured.init.headers["x-goog-api-key"], "test-gemini-key");
});

await check("string contents -> one user content with a text part", async () => {
  await client.models.generateContent({ contents: "hi there", model: "m" });
  assert.deepStrictEqual(lastBody().contents, [{ role: "user", parts: [{ text: "hi there" }] }]);
});

await check("inlineData image part passes through untouched (vision)", async () => {
  await client.models.generateContent({
    contents: { parts: [{ inlineData: { mimeType: "image/png", data: "QUJD" } }, { text: "describe" }] },
    model: "m",
  });
  const parts = lastBody().contents[0].parts;
  assert.deepStrictEqual(parts[0], { inlineData: { mimeType: "image/png", data: "QUJD" } });
  assert.deepStrictEqual(parts[1], { text: "describe" });
});

await check("systemInstruction is a top-level field, not a message", async () => {
  await client.models.generateContent({ contents: "do it", config: { systemInstruction: "be nice" }, model: "m" });
  assert.deepStrictEqual(lastBody().systemInstruction, { parts: [{ text: "be nice" }] });
  assert.ok(!lastBody().contents.some((c: any) => c.role === "system"), "system text must not leak into contents");
});

await check("responseSchema keeps UPPERCASE types on the wire (no lowercasing)", async () => {
  await client.models.generateContent({
    contents: "do it",
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, n: { type: Type.NUMBER } }, required: ["title"] },
    },
    model: "m",
  });
  const gen = lastBody().generationConfig;
  assert.strictEqual(gen.responseMimeType, "application/json");
  assert.strictEqual(gen.responseSchema.type, "OBJECT");
  assert.strictEqual(gen.responseSchema.properties.title.type, "STRING");
  assert.strictEqual(gen.responseSchema.properties.n.type, "NUMBER");
});

await check("maxOutputTokens maps into generationConfig", async () => {
  await client.models.generateContent({ contents: "x", config: { maxOutputTokens: 32 }, model: "m" });
  assert.strictEqual(lastBody().generationConfig.maxOutputTokens, 32);
});

await check("no config -> generationConfig omitted entirely", async () => {
  await client.models.generateContent({ contents: "x", model: "m" });
  assert.strictEqual(lastBody().generationConfig, undefined);
});

await check("multi-turn contents array preserves user/model order", async () => {
  await client.models.generateContent({
    contents: [
      { role: "user", parts: [{ text: "a" }] },
      { role: "model", parts: [{ text: "b" }] },
      { role: "user", parts: [{ text: "c" }] },
    ],
    model: "m",
  });
  assert.deepStrictEqual(lastBody().contents.map((c: any) => c.role), ["user", "model", "user"]);
  assert.deepStrictEqual(lastBody().contents.map((c: any) => c.parts[0].text), ["a", "b", "c"]);
});

await check("text unwrapped and joined from candidates[0].content.parts", async () => {
  canned = { ok: true, status: 200, text: async () => "", json: async () => ({ candidates: [{ content: { parts: [{ text: "he" }, { text: "llo" }] } }] }) };
  const r = await client.models.generateContent({ contents: "x", model: "m" });
  assert.strictEqual(r.text, "hello");
});

await check("empty candidate returns empty text (caller's empty_reply path)", async () => {
  canned = { ok: true, status: 200, text: async () => "", json: async () => ({ candidates: [{ content: { parts: [] } }] }) };
  const r = await client.models.generateContent({ contents: "x", model: "m" });
  assert.strictEqual(r.text, "");
});

await check("safety block throws instead of silently returning empty", async () => {
  canned = {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({ promptFeedback: { blockReason: "SAFETY" }, candidates: [{ content: { parts: [] } }] }),
  };
  await assert.rejects(() => client.models.generateContent({ contents: "x", model: "m" }), /SAFETY/);
});

await check("HTTP error surfaces as thrown Error with status", async () => {
  canned = { ok: false, status: 400, text: async () => "API key not valid", json: async () => ({}) };
  await assert.rejects(() => client.models.generateContent({ contents: "x", model: "m" }), /400/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures above)" : ""}`);
if (process.exitCode) console.log("GEMINI ADAPTER CHECK FAILED");
