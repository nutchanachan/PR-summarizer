import type { ChatMessage, LLMProvider } from "../types.ts";
import { postJson } from "./http.ts";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  // ชื่อ model เปลี่ยนบ่อย ถ้า default นี้ใช้ไม่ได้ ให้ตั้ง LLM_MODEL เอง
  constructor(private apiKey: string, readonly model = "gpt-4.1-mini", private baseUrl = "https://api.openai.com/v1") {}

  async complete(messages: ChatMessage[], opts: { maxTokens?: number } = {}) {
    const data = await postJson(
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      { model: this.model, max_completion_tokens: opts.maxTokens ?? 1500, messages },
    );
    return data.choices?.[0]?.message?.content ?? "";
  }
}
