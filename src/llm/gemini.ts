import type { ChatMessage, LLMProvider } from "../types.ts";
import { postJson } from "./http.ts";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  constructor(private apiKey: string, readonly model = "gemini-2.5-flash") {}

  async complete(messages: ChatMessage[], opts: { maxTokens?: number } = {}) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.filter((m) => m.role === "user").map((m) => ({ role: "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 1500 },
      },
    );
    return (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  }
}
