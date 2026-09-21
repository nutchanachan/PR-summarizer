import type { ChatMessage, LLMProvider } from "../types.ts";

/** provider ปลอมสำหรับทดสอบ flow ทั้งหมดโดยไม่ต้องมี API key และไม่เสียเงิน */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock";
  calls: ChatMessage[][] = [];

  async complete(messages: ChatMessage[]) {
    this.calls.push(messages);
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const files = [...user.matchAll(/^### (\S+)/gm)].map((m) => m[1]);
    return [
      "## สรุป",
      `(mock) PR นี้แก้ไข ${files.length} ไฟล์`,
      "",
      "## จุดที่ควรรีวิวละเอียด",
      ...files.slice(0, 5).map((f) => `- \`${f}\``),
    ].join("\n");
  }
}
