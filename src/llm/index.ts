import type { Config } from "../config.ts";
import type { LLMProvider } from "../types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { GeminiProvider } from "./gemini.ts";
import { MockProvider } from "./mock.ts";
import { OpenAIProvider } from "./openai.ts";

/** จุดเดียวที่รู้ว่ามี provider อะไรบ้าง อยากเพิ่มเจ้าใหม่ก็แก้แค่ตรงนี้ */
export function createProvider(cfg: Config): LLMProvider {
  switch (cfg.provider) {
    case "anthropic":
      return new AnthropicProvider(cfg.apiKey!, cfg.model);
    case "openai":
      return new OpenAIProvider(cfg.apiKey!, cfg.model);
    case "gemini":
      return new GeminiProvider(cfg.apiKey!, cfg.model);
    case "mock":
      return new MockProvider();
  }
}
