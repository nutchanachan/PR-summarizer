import type { ChatMessage, LLMProvider } from "../types.ts";
import { postJson } from "./http.ts";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  constructor(private apiKey: string, readonly model = "claude-sonnet-5") {}

  async complete(messages: ChatMessage[], opts: { maxTokens?: number } = {}) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: opts.maxTokens ?? 1500,
        system,
        messages: messages.filter((m) => m.role === "user").map((m) => ({ role: "user", content: m.content })),
      },
    );
    return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  }
}
