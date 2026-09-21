/**
 * จุดเริ่มต้นเมื่อรันเป็น GitHub Action
 * GitHub ส่งข้อมูล event มาทางไฟล์ที่ GITHUB_EVENT_PATH และส่ง input มาเป็น INPUT_<NAME>
 */
import { readFileSync } from "node:fs";
import { loadConfig, readVar } from "./config.ts";
import { fetchPullRequest, upsertComment } from "./github.ts";
import { createProvider } from "./llm/index.ts";
import { summarizePullRequest } from "./summarize.ts";

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("ไม่พบ GITHUB_EVENT_PATH (ต้องรันใน GitHub Actions)");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const prNumber: number | undefined = event.pull_request?.number;
  if (!prNumber) {
    console.log("event นี้ไม่ใช่ pull_request ข้าม");
    return;
  }
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/") as [string, string];
  const token = readVar("GITHUB_TOKEN");
  if (!token) throw new Error("ต้องตั้งค่า github_token");

  const cfg = loadConfig();
  const llm = createProvider(cfg);
  const pr = await fetchPullRequest(owner, repo, prNumber, token);
  const { markdown, diff } = await summarizePullRequest(pr, llm, cfg);
  console.log(`ส่ง ${diff.included.length} ไฟล์, ข้าม ${diff.ignored.length}, ตัด ${diff.truncated.length}, redact ${diff.redactions}`);

  const result = await upsertComment(owner, repo, prNumber, markdown, token);
  console.log(`คอมเมนต์ ${result.action} (id ${result.id})`);
}

main().catch((err) => {
  // ::error:: ทำให้ GitHub แสดงข้อความเป็น annotation สีแดง
  console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
