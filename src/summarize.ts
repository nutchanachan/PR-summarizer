import type { Config } from "./config.ts";
import { filterDiff } from "./diff-filter.ts";
import { buildMessages } from "./prompts.ts";
import type { LLMProvider, PullRequestInfo } from "./types.ts";

export const COMMENT_MARKER = "<!-- pr-summarizer -->";

export async function summarizePullRequest(pr: PullRequestInfo, llm: LLMProvider, cfg: Pick<Config, "language" | "maxDiffChars">) {
  const diff = filterDiff(pr.files, cfg.maxDiffChars);
  if (diff.included.length === 0) {
    return { markdown: "ไม่มีไฟล์โค้ดที่ต้องสรุป (มีแต่ lock/build/binary)", diff };
  }
  const summary = await llm.complete(buildMessages(pr, diff, cfg.language));

  const footer = [
    `<sub>สรุปอัตโนมัติโดย ${llm.name}/${llm.model}`,
    diff.truncated.length ? ` · ${diff.truncated.length} ไฟล์ใหญ่เกินไม่ได้อ่าน diff` : "",
    diff.redactions ? ` · ปิดบังข้อมูลคล้าย secret ${diff.redactions} จุด` : "",
    " · ตรวจสอบก่อนเชื่อเสมอ</sub>",
  ].join("");

  return { markdown: `${COMMENT_MARKER}\n${summary.trim()}\n\n${footer}`, diff };
}
