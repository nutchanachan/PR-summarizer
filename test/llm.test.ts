import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.ts";
import { createProvider } from "../src/llm/index.ts";
import { MockProvider } from "../src/llm/mock.ts";
import { COMMENT_MARKER, summarizePullRequest } from "../src/summarize.ts";

test("เลือก provider ตาม env และอ่าน input แบบ GitHub Action ได้", () => {
  assert.equal(createProvider(loadConfig({ LLM_PROVIDER: "mock" })).name, "mock");
  const cfg = loadConfig({ INPUT_LLM_PROVIDER: "gemini", INPUT_LLM_API_KEY: "x", INPUT_LLM_MODEL: "gemini-custom" });
  const p = createProvider(cfg);
  assert.equal(p.name, "gemini");
  assert.equal(p.model, "gemini-custom");
});

test("แจ้ง error ชัดเจนเมื่อไม่มี API key หรือชื่อ provider ผิด", () => {
  assert.throws(() => loadConfig({ LLM_PROVIDER: "anthropic" }), /ANTHROPIC_API_KEY/);
  assert.throws(() => loadConfig({ LLM_PROVIDER: "foo" }), /ไม่รู้จัก/);
});

test("summarize ทำงานครบ flow และไม่ส่ง secret ไปยัง LLM", async () => {
  const llm = new MockProvider();
  const pr = {
    owner: "o", repo: "r", number: 1, title: "Add rate limit", body: "", commits: ["feat: rate limit"],
    files: [
      { filename: "src/a.ts", status: "modified", additions: 1, deletions: 0, patch: '+const t = "ghp_' + "a".repeat(36) + '"' },
      { filename: "yarn.lock", status: "modified", additions: 10, deletions: 2, patch: "+x" },
    ],
  };
  const { markdown, diff } = await summarizePullRequest(pr, llm, { language: "th", maxDiffChars: 10_000 });
  assert.ok(markdown.startsWith(COMMENT_MARKER));
  assert.deepEqual(diff.ignored, ["yarn.lock"]);
  const sent = llm.calls[0]!.map((m) => m.content).join("\n");
  assert.doesNotMatch(sent, /ghp_a{10}/);
  assert.match(sent, /\[REDACTED\]/);
});
