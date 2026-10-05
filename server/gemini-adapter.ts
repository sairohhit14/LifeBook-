/**
 * Minimal Google Gemini adapter — REST /v1beta/models/{model}:generateContent.
 *
 * Exposes the `models.generateContent({ contents, config, model })` surface the
 * server's call sites already use and returns `{ text }`, so swapping providers
 * is a one-line change at the client and nothing else in server.ts moves.
 *
 * `Type` keeps the values @google/genai exported ("STRING", "OBJECT", …). Those
 * are Gemini's OWN schema vocabulary, so `responseSchema` literals in server.ts
 * go on the wire verbatim — the xAI adapter had to lowercase them, this one
 * does not.
 *
 * ponytail: an empty candidate (no text, no block) returns "" exactly as the
 * previous provider did, so the existing empty_reply / static-fallback paths
 * keep their behaviour. Only an explicit safety block throws, which lands in
 * the biography route's existing catch-and-fall-back-to-static-story handler.
 */
export const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
} as const;

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";

/**
 * Normalize what the server passes into native Gemini `contents[]`.
 * Accepts: a prompt string, a `{ parts }` object (vision), or a contents array
 * with `role` ("user" | "model") + `parts` (multi-turn chat).
 */
export function toGeminiContents(contents: any): any[] {
  if (typeof contents === "string") return [{ role: "user", parts: [{ text: contents }] }];
  if (Array.isArray(contents)) {
    return contents.map((c: any) =>
      typeof c === "string"
        ? { role: "user", parts: [{ text: c }] }
        : { role: c?.role || "user", parts: c?.parts ?? [] }
    );
  }
  return [{ role: contents?.role || "user", parts: contents?.parts ?? [] }];
}

export function createGeminiClient(apiKey: string) {
  return {
    models: {
      async generateContent({ contents, config, model }: any) {
        const generationConfig: any = {};
        if (config?.maxOutputTokens) generationConfig.maxOutputTokens = config.maxOutputTokens;
        if (config?.responseMimeType) generationConfig.responseMimeType = config.responseMimeType;
        if (config?.responseSchema) generationConfig.responseSchema = config.responseSchema;

        const body: any = { contents: toGeminiContents(contents) };
        if (config?.systemInstruction) {
          body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
        }
        if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

        const res = await fetch(`${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Gemini request failed: ${res.status} ${errText}`);
        }

        const data: any = await res.json();
        const blockReason = data?.promptFeedback?.blockReason;
        // A safety block returns HTTP 200 with no usable candidate. Throwing here
        // routes it into the caller's existing fallback instead of silently
        // persisting an empty book with a success notification.
        if (blockReason) {
          throw new Error(`Gemini blocked the request: ${blockReason}`);
        }

        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p?.text ?? "").join("");
        return { text };
      },
    },
  };
}
